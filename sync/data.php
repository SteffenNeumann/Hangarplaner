<?php
/**
 * Optimiertes PHP-Script für die Hangar Planner Datensynchronisation.
 * Unterstützt das Speichern und Laden von JSON-Daten mit verbesserter Sicherheit.
 */

// Produktionseinstellungen - Fehlermeldungen nur bei Debug-Modus anzeigen
$debug_mode = isset($_GET['debug']) && $_GET['debug'] === 'true';
if ($debug_mode) {
    error_reporting(E_ALL);
    ini_set('display_errors', 1);
} else {
    error_reporting(0);
    ini_set('display_errors', 0);
}

// CORS-Header für die Entwicklung (bei Bedarf anpassen)
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, X-Sync-Role, X-Sync-Session, X-Display-Name");
header("Content-Type: application/json; charset=UTF-8");

// Bei OPTIONS-Anfragen (CORS preflight) sofort beenden
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit(0);
}

// VEREINFACHT: Nur Standard data.json verwenden (Master-Slave ohne Projekt-IDs)
$dataFile = __DIR__ . '/data.json';

// Neuer Endpoint für Timestamp-basierte Synchronisierung
if (isset($_GET['action']) && $_GET['action'] === 'timestamp') {
    if (file_exists($dataFile)) {
        echo json_encode([
            'timestamp' => filemtime($dataFile) * 1000, // Milliseconds für JS-Kompatibilität
            'size' => filesize($dataFile),
            'success' => true
        ]);
    } else {
        echo json_encode([
            'timestamp' => 0,
            'size' => 0,
            'success' => false
        ]);
    }
    exit(0);
}

// Optional: expose lock holder info for diagnostics
if (isset($_GET['action']) && $_GET['action'] === 'lock') {
    $lockFile = __DIR__ . '/master_lock.json';
    if (file_exists($lockFile)) {
        $lockRaw = @file_get_contents($lockFile);
        $lock = json_decode($lockRaw, true);
        echo json_encode([ 'success' => true, 'lock' => $lock ?: null ]);
    } else {
        echo json_encode([ 'success' => true, 'lock' => null ]);
    }
    exit(0);
}

// Maximale Dateigröße (5MB)
const MAX_FILE_SIZE = 5 * 1024 * 1024;

// GET-Anfrage: Daten zurückgeben
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    if (file_exists($dataFile)) {
        $fileContent = file_get_contents($dataFile);
        
        // Validiere, dass es gültiges JSON ist
        $data = json_decode($fileContent);
        if ($data === null && json_last_error() !== JSON_ERROR_NONE) {
            http_response_code(500);
            echo json_encode([
                'error' => 'Gespeicherte Daten sind beschädigt',
                'success' => false
            ]);
        } else {
            echo $fileContent;
        }
    } else {
        http_response_code(404);
        echo json_encode([
            'error' => 'Noch keine Daten gespeichert',
            'success' => false
        ]);
    }
}

// POST-Anfrage: Daten speichern
else if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    try {
        // Content-Length prüfen
        $contentLength = isset($_SERVER['CONTENT_LENGTH']) ? (int)$_SERVER['CONTENT_LENGTH'] : 0;
        
        if ($contentLength > MAX_FILE_SIZE) {
            throw new Exception("Datei zu groß. Maximum: " . (MAX_FILE_SIZE / 1024 / 1024) . "MB");
        }
        
        if ($contentLength === 0) {
            throw new Exception("Keine Daten empfangen");
        }

        // Require explicit master role header for writes
        $role = isset($_SERVER['HTTP_X_SYNC_ROLE']) ? strtolower($_SERVER['HTTP_X_SYNC_ROLE']) : '';
        if ($role !== 'master') {
            http_response_code(403);
            echo json_encode([
                'error' => 'Write not allowed: client is not in master mode.',
                'details' => 'Missing or invalid X-Sync-Role header',
                'success' => false
            ]);
            exit;
        }

        // Require session id for lock coordination
        $sessionId = isset($_SERVER['HTTP_X_SYNC_SESSION']) ? trim($_SERVER['HTTP_X_SYNC_SESSION']) : '';
        if ($sessionId === '') {
            http_response_code(403);
            echo json_encode([
                'error' => 'Write not allowed: missing X-Sync-Session',
                'success' => false
            ]);
            exit;
        }
        $displayName = isset($_SERVER['HTTP_X_DISPLAY_NAME']) ? trim($_SERVER['HTTP_X_DISPLAY_NAME']) : '';

        // Enforce single-writer lock (hard no-takeover) with TTL
        $lockFile = __DIR__ . '/master_lock.json';
        $LOCK_TTL_SECONDS = 120; // 2 minutes
        $now = time();
        $lockRaw = file_exists($lockFile) ? @file_get_contents($lockFile) : '';
        $lock = $lockRaw ? json_decode($lockRaw, true) : null;
        $holder = is_array($lock) ? ($lock['sessionId'] ?? '') : '';
        $lastSeen = is_array($lock) ? intval($lock['lastSeen'] ?? 0) : 0;
        if ($holder && $holder !== $sessionId && $lastSeen >= ($now - $LOCK_TTL_SECONDS)) {
            http_response_code(423); // Locked
            echo json_encode([
                'error' => 'Master lock held',
                'holder' => [
                    'sessionId' => $holder,
                    'displayName' => $lock['displayName'] ?? '',
                    'since' => $lock['since'] ?? null,
                    'lastSeen' => $lastSeen * 1000
                ],
                'success' => false
            ]);
            exit;
        }

        // JSON-Daten aus dem Request-Body lesen
        $jsonData = file_get_contents('php://input');
        
        if (empty($jsonData)) {
            throw new Exception("Leere Anfrage erhalten");
        }
        
        // Prüfen, ob es gültiges JSON ist
        $data = json_decode($jsonData, true);
        if ($data === null && json_last_error() !== JSON_ERROR_NONE) {
            throw new Exception("Ungültiges JSON-Format: " . json_last_error_msg());
        }
        
        // Basis-Validierung der Datenstruktur
        if (!isset($data['metadata'])) {
            $data['metadata'] = [];
        }
        
        // Timestamp hinzufügen falls nicht vorhanden
        if (!isset($data['metadata']['timestamp'])) {
            $data['metadata']['timestamp'] = time() * 1000; // Milliseconds für Konsistenz mit JavaScript
        }
        
        // Schreibzugriff prüfen
        if (!is_writable(__DIR__) && !file_exists($dataFile)) {
            throw new Exception("Keine Schreibberechtigung im Verzeichnis");
        }
        
        if (file_exists($dataFile) && !is_writable($dataFile)) {
            throw new Exception("Keine Schreibberechtigung für die Datei");
        }
        
        // JSON neu formatieren für bessere Lesbarkeit
        $formattedJson = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);

        // Update lock (or acquire if free/expired)
        $newLock = [
            'sessionId' => $sessionId,
            'displayName' => $displayName,
            'lastSeen' => $now,
            'since' => (is_array($lock) && $holder === $sessionId && isset($lock['since'])) ? $lock['since'] : $now,
        ];
        @file_put_contents($lockFile, json_encode($newLock, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), LOCK_EX);
        @chmod($lockFile, 0664);
        
        // Daten in Datei speichern
        $result = file_put_contents($dataFile, $formattedJson, LOCK_EX);
        
        if ($result === false) {
            throw new Exception("Fehler beim Schreiben der Datei");
        }
        
        // Erfolgsantwort
        echo json_encode([
            'message' => 'Daten erfolgreich gespeichert',
            'timestamp' => $data['metadata']['timestamp'],
            'size' => strlen($formattedJson),
            'success' => true
        ]);
        
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode([
            'error' => $e->getMessage(),
            'success' => false
        ]);
    }
}

// Andere Methoden nicht erlaubt
else {
    http_response_code(405);
    echo json_encode([
        'error' => 'Methode nicht erlaubt',
        'allowed_methods' => ['GET', 'POST', 'OPTIONS'],
        'success' => false
    ]);
}
?>
