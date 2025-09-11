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
        // Prefer high-resolution metadata.timestamp from JSON if available
        $metaTs = null;
        $fp = @fopen($dataFile, 'r');
        if ($fp) {
            if (@flock($fp, LOCK_SH)) {
                @rewind($fp);
                $raw = '';
                while (!feof($fp)) {
                    $chunk = fread($fp, 8192);
                    if ($chunk === false) break;
                    $raw .= $chunk;
                }
                @flock($fp, LOCK_UN);
                @fclose($fp);
                $json = json_decode($raw, true);
                if (is_array($json) && isset($json['metadata']) && isset($json['metadata']['timestamp'])) {
                    $metaTs = intval($json['metadata']['timestamp']);
                }
            } else {
                @fclose($fp);
            }
        }
        $fallbackTs = @filemtime($dataFile) ? (filemtime($dataFile) * 1000) : 0;
        $ts = ($metaTs && $metaTs > 0) ? $metaTs : $fallbackTs;
        echo json_encode([
            'timestamp' => $ts,
            'size' => @filesize($dataFile) ?: 0,
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
        // Read under shared lock to avoid partial reads during concurrent writes
        $fp = @fopen($dataFile, 'r');
        if ($fp && @flock($fp, LOCK_SH)) {
            @rewind($fp);
            $raw = '';
            while (!feof($fp)) {
                $chunk = fread($fp, 8192);
                if ($chunk === false) break;
                $raw .= $chunk;
            }
            @flock($fp, LOCK_UN);
            @fclose($fp);

            $data = json_decode($raw);
            if ($data === null && json_last_error() !== JSON_ERROR_NONE) {
                http_response_code(500);
                echo json_encode([
                    'error' => 'Gespeicherte Daten sind beschädigt',
                    'success' => false
                ]);
            } else {
                echo $raw;
            }
        } else {
            // Fallback if lock cannot be obtained
            if ($fp) { @fclose($fp); }
            $raw = @file_get_contents($dataFile);
            $data = json_decode($raw);
            if ($data === null && json_last_error() !== JSON_ERROR_NONE) {
                http_response_code(500);
                echo json_encode([
                    'error' => 'Gespeicherte Daten sind beschädigt',
                    'success' => false
                ]);
            } else {
                echo $raw;
            }
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

        // Multi-master mode: no exclusive lock enforcement
        $lockFile = __DIR__ . '/master_lock.json';
        $LOCK_TTL_SECONDS = 120; // retained for diagnostics
        $now = time();
        $lockRaw = file_exists($lockFile) ? @file_get_contents($lockFile) : '';
        $lock = $lockRaw ? json_decode($lockRaw, true) : null;
        // No 423 lock denial; proceed to write and update last writer info

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
        
        // UPDATE: Multi-master merge with tile-level patching
        // 1) Load existing server data (under a file lock)
        $existing = [];
        $merged = [];
        $appliedTiles = 0;
        $payload = '';

        // Normalize helpers
        $normalize_tile = function($tile) {
            if (!is_array($tile)) $tile = [];
            $tile['tileId'] = isset($tile['tileId']) ? intval($tile['tileId']) : 0;
            foreach (['aircraftId','arrivalTime','departureTime','position','hangarPosition','status','towStatus','notes'] as $k) {
                if (!array_key_exists($k, $tile)) { $tile[$k] = isset($tile[$k]) ? $tile[$k] : ''; }
            }
            return $tile;
        };
        $tiles_to_map = function($tiles) use ($normalize_tile) {
            $map = [];
            if (!is_array($tiles)) return $map;
            foreach ($tiles as $t) {
                $t = $normalize_tile($t);
                $id = intval($t['tileId'] ?? 0);
                if ($id) $map[$id] = $t;
            }
            return $map;
        };
        $map_to_sorted_array = function($map) {
            ksort($map, SORT_NUMERIC);
            return array_values($map);
        };

        // Update lock info for diagnostics (non-blocking policy)
        $newLock = [
            'sessionId' => $sessionId,
            'displayName' => $displayName,
            'lastSeen' => $now,
            'since' => (is_array($lock) && ($lock['sessionId'] ?? '') === $sessionId && isset($lock['since'])) ? $lock['since'] : $now,
        ];
        @file_put_contents($lockFile, json_encode($newLock, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), LOCK_EX);
        @chmod($lockFile, 0664);

        // Open data file for atomic read-modify-write
        $fp = @fopen($dataFile, 'c+');
        if ($fp) {
            if (@flock($fp, LOCK_EX)) {
                // Read existing
                @rewind($fp);
                $raw = '';
                while (!feof($fp)) {
                    $chunk = fread($fp, 8192);
                    if ($chunk === false) break;
                    $raw .= $chunk;
                }
                $existing = json_decode($raw, true);
                if (!is_array($existing)) $existing = [];

                // Prepare merged baseline
                $merged = $existing;
                if (!isset($merged['primaryTiles']) || !is_array($merged['primaryTiles'])) $merged['primaryTiles'] = [];
                if (!isset($merged['secondaryTiles']) || !is_array($merged['secondaryTiles'])) $merged['secondaryTiles'] = [];
                if (!isset($merged['settings']) || !is_array($merged['settings'])) $merged['settings'] = [];
                if (!isset($merged['metadata']) || !is_array($merged['metadata'])) $merged['metadata'] = [];

                // 2) Merge settings shallow + displayOptions deep
                if (isset($data['settings']) && is_array($data['settings'])) {
                    foreach ($data['settings'] as $k => $v) {
                        if ($k === 'displayOptions' && is_array($v)) {
                            if (!isset($merged['settings']['displayOptions']) || !is_array($merged['settings']['displayOptions'])) {
                                $merged['settings']['displayOptions'] = [];
                            }
                            foreach ($v as $dk => $dv) { $merged['settings']['displayOptions'][$dk] = $dv; }
                        } else {
                            $merged['settings'][$k] = $v;
                        }
                    }
                }

                // 3) Tile-level merge
                $serverPrimaryMap = $tiles_to_map($merged['primaryTiles']);
                $serverSecondaryMap = $tiles_to_map($merged['secondaryTiles']);
                $tileKeys = ['aircraftId','arrivalTime','departureTime','position','hangarPosition','status','towStatus','notes'];

                $apply_tile_if_changed = function(&$map, $ptile) use ($tileKeys, $normalize_tile, &$appliedTiles, $displayName) {
                    $ptile = $normalize_tile($ptile);
                    $id = intval($ptile['tileId'] ?? 0);
                    if (!$id) return;
                    $serverTile = isset($map[$id]) ? $map[$id] : [];
                    $changed = false;
                    foreach ($tileKeys as $k) {
                        if (array_key_exists($k, $ptile)) {
                            $old = $serverTile[$k] ?? null;
                            $new = $ptile[$k];
                            if ($old !== $new) { $changed = true; }
                        }
                    }
                    if ($changed) {
                        $map[$id] = array_merge($serverTile, $ptile);
                        $map[$id]['tileId'] = $id;
                        $map[$id]['updatedAt'] = date('c');
                        if (!empty($displayName)) { $map[$id]['updatedBy'] = $displayName; }
                        $appliedTiles++;
                    }
                };

                // If fieldUpdates provided, prefer fine-grained patching
                if (isset($data['fieldUpdates']) && is_array($data['fieldUpdates'])) {
                    foreach ($data['fieldUpdates'] as $fid => $val) {
                        $tid = null; $field = null; $isSecondary = false;
                        if (preg_match('/^aircraft-(\d+)$/', $fid, $m)) { $tid = intval($m[1]); $field = 'aircraftId'; }
                        elseif (preg_match('/^arrival-time-(\d+)$/', $fid, $m)) { $tid = intval($m[1]); $field = 'arrivalTime'; }
                        elseif (preg_match('/^departure-time-(\d+)$/', $fid, $m)) { $tid = intval($m[1]); $field = 'departureTime'; }
                        elseif (preg_match('/^hangar-position-(\d+)$/', $fid, $m)) { $tid = intval($m[1]); $field = 'hangarPosition'; }
                        elseif (preg_match('/^position-(\d+)$/', $fid, $m)) { $tid = intval($m[1]); $field = 'position'; }
                        elseif (preg_match('/^status-(\d+)$/', $fid, $m)) { $tid = intval($m[1]); $field = 'status'; }
                        elseif (preg_match('/^tow-status-(\d+)$/', $fid, $m)) { $tid = intval($m[1]); $field = 'towStatus'; }
                        elseif (preg_match('/^notes-(\d+)$/', $fid, $m)) { $tid = intval($m[1]); $field = 'notes'; }
                        if ($tid !== null && $field) {
                            $isSecondary = ($tid >= 100);
                            if ($isSecondary) {
                                if (!isset($serverSecondaryMap[$tid])) { $serverSecondaryMap[$tid] = ['tileId' => $tid]; }
                                $old = $serverSecondaryMap[$tid][$field] ?? null;
                                if ($old !== $val) { $serverSecondaryMap[$tid][$field] = $val; $serverSecondaryMap[$tid]['updatedAt'] = date('c'); if (!empty($displayName)) { $serverSecondaryMap[$tid]['updatedBy'] = $displayName; } $appliedTiles++; }
                            } else {
                                if (!isset($serverPrimaryMap[$tid])) { $serverPrimaryMap[$tid] = ['tileId' => $tid]; }
                                $old = $serverPrimaryMap[$tid][$field] ?? null;
                                if ($old !== $val) { $serverPrimaryMap[$tid][$field] = $val; $serverPrimaryMap[$tid]['updatedAt'] = date('c'); if (!empty($displayName)) { $serverPrimaryMap[$tid]['updatedBy'] = $displayName; } $appliedTiles++; }
                            }
                        }
                    }
                } else {
                    // Otherwise, merge posted tiles by difference
                    if (isset($data['primaryTiles']) && is_array($data['primaryTiles'])) {
                        foreach ($data['primaryTiles'] as $pt) { $apply_tile_if_changed($serverPrimaryMap, $pt); }
                    }
                    if (isset($data['secondaryTiles']) && is_array($data['secondaryTiles'])) {
                        foreach ($data['secondaryTiles'] as $pt) { $apply_tile_if_changed($serverSecondaryMap, $pt); }
                    }
                }

                // Rebuild arrays and ensure normalized keys exist for each tile
                $normalize_array = function($arr) use ($normalize_tile) {
                    $out = [];
                    foreach ($arr as $t) { $out[] = $normalize_tile($t); }
                    return $out;
                };
                $merged['primaryTiles'] = $normalize_array($map_to_sorted_array($serverPrimaryMap));
                $merged['secondaryTiles'] = $normalize_array($map_to_sorted_array($serverSecondaryMap));

                // 4) Metadata update (server-side)
                $merged['metadata'] = is_array($merged['metadata']) ? $merged['metadata'] : [];
                $merged['metadata']['lastModified'] = date('c');
                $merged['metadata']['timestamp'] = round(microtime(true) * 1000);
                if ($displayName !== '') $merged['metadata']['lastWriter'] = $displayName;
                $merged['metadata']['lastWriterSession'] = $sessionId;

                // 5) Write back under the same lock
                $payload = json_encode($merged, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
                if ($payload === false) { throw new Exception('JSON encoding failed'); }
                @ftruncate($fp, 0);
                @rewind($fp);
                $wrote = @fwrite($fp, $payload);
                @fflush($fp);
                @flock($fp, LOCK_UN);
                @fclose($fp);
                if ($wrote === false) { throw new Exception('Fehler beim Schreiben der Datei'); }
            } else {
                @fclose($fp);
                throw new Exception('Konnte Dateisperre nicht erhalten');
            }
        } else {
            // Fallback: no atomic merge possible, write posted data as-is
            $payload = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
            if ($payload === false) { throw new Exception('JSON encoding failed (fallback)'); }
            $result = file_put_contents($dataFile, $payload, LOCK_EX);
            if ($result === false) { throw new Exception('Fehler beim Schreiben der Datei (fallback)'); }
        }

        // Erfolgsantwort
        echo json_encode([
            'message' => 'Daten erfolgreich gespeichert',
            'timestamp' => isset($merged['metadata']['timestamp']) ? $merged['metadata']['timestamp'] : ($data['metadata']['timestamp'] ?? round(microtime(true)*1000)),
            'appliedTiles' => $appliedTiles,
            'size' => strlen($payload),
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
