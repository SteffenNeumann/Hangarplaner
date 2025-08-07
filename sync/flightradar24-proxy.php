<?php
/**
 * Flightradar24 API Proxy
 * Löst CORS-Probleme durch serverseitige API-Aufrufe
 */

// CORS-Header für Frontend-Zugriff
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json');

// OPTIONS-Request für Preflight handhaben
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// API-Konfiguration
const FR24_API_BASE = 'https://fr24api.flightradar24.com/api';
const FR24_API_TOKEN = '01988313-fa93-7159-9a43-872a2a31e88b|Kt9JoOnJRS6R1QMUmiu9gFmYh9PSh7rD1tLqgeNZ58450385';

/**
 * Macht cURL-Request zur Flightradar24 API mit Retry-Logik
 */
function makeFlightradar24Request($url, $maxRetries = 3) {
    $retryCount = 0;
    
    while ($retryCount < $maxRetries) {
        // FR24 API Token
        $fr24_token = '01988313-fa93-7159-9a43-872a2a31e88b|Kt9JoOnJRS6R1QMUmiu9gFmYh9PSh7rD1tLqgeNZ58450385';
        
        // FR24 API Headers
        $curl = curl_init();
        curl_setopt($curl, CURLOPT_URL, $url);
        curl_setopt($curl, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($curl, CURLOPT_HTTPHEADER, [
            'Authorization: Bearer ' . $fr24_token,
            'Accept: application/json',
            'Accept-Version: v1',
            'User-Agent: HangarPlanner/3.0 FlightAPI/Native'
        ]);
        
        $response = curl_exec($curl);
        $httpCode = curl_getinfo($curl, CURLINFO_HTTP_CODE);
        $error = curl_error($curl);
        
        curl_close($curl);
        
        if ($error) {
            throw new Exception("cURL Error: " . $error);
        }
        
        // Bei 429 (Rate Limit) - warte und versuche erneut
        if ($httpCode === 429) {
            $retryCount++;
            $waitTime = pow(2, $retryCount); // Exponential backoff: 2, 4, 8 Sekunden
            
            if ($retryCount < $maxRetries) {
                error_log("Rate limit hit, waiting {$waitTime}s before retry {$retryCount}/{$maxRetries}");
                sleep($waitTime);
                continue;
            } else {
                throw new Exception("HTTP Error: $httpCode - $response");
            }
        }
        
        if ($httpCode !== 200) {
            throw new Exception("HTTP Error: " . $httpCode . " - " . $response);
        }
        
        return $response;
    }
    
    throw new Exception("Max retries exceeded");
}

/**
 * Validiert und säubert Parameter
 */
function validateParams() {
    $registration = $_GET['registration'] ?? '';
    $date = $_GET['date'] ?? '';
    $endpoint = $_GET['endpoint'] ?? 'history';
    
    // Registrierung validieren
    if (empty($registration) || !preg_match('/^[A-Z0-9-]{3,10}$/i', $registration)) {
        throw new Exception("Ungültige Flugzeugregistrierung");
    }
    
    // Datum validieren
    if (empty($date) || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
        throw new Exception("Ungültiges Datum (Format: YYYY-MM-DD)");
    }
    
    // Endpoint validieren
    $allowedEndpoints = ['history', 'aircraft', 'flights'];
    if (!in_array($endpoint, $allowedEndpoints)) {
        throw new Exception("Ungültiger Endpoint");
    }
    
    return [
        'registration' => strtoupper(trim($registration)),
        'date' => $date,
        'endpoint' => $endpoint
    ];
}

/**
 * Baut die API-URL basierend auf Endpoint und Parametern
 */
function buildApiUrl($params) {
    $registration = $params['registration'];
    $date = $params['date'];
    $endpoint = $params['endpoint'];
    
    // Datum in FR24-Format konvertieren (YYYY-MM-DDTHH:MM:SS)
    $datetime_from = $date . 'T00:00:00';
    $datetime_to = $date . 'T23:59:59';
    
    switch ($endpoint) {
        case 'history':
        case 'flights':
        case 'aircraft':
            // Flight Summary API für historische Flugdaten nach Registrierung
            return FR24_API_BASE . "/flight-summary/full?registrations={$registration}&flight_datetime_from={$datetime_from}&flight_datetime_to={$datetime_to}";
            
        case 'live':
            // Live Flight Positions für aktuelle Flugdaten
            return FR24_API_BASE . "/live/flight-positions/full?registrations={$registration}";
            
        default:
            throw new Exception("Unbekannter Endpoint: $endpoint");
    }
}

/**
 * Loggt API-Anfragen für Debugging
 */
function logRequest($params, $success, $error = null) {
    $logEntry = [
        'timestamp' => date('Y-m-d H:i:s'),
        'registration' => $params['registration'],
        'date' => $params['date'],
        'endpoint' => $params['endpoint'],
        'success' => $success,
        'error' => $error,
        'ip' => $_SERVER['REMOTE_ADDR'] ?? 'unknown'
    ];
    
    $logFile = __DIR__ . '/logs/fr24-proxy.log';
    
    // Log-Verzeichnis erstellen falls nicht vorhanden
    $logDir = dirname($logFile);
    if (!is_dir($logDir)) {
        mkdir($logDir, 0755, true);
    }
    
    file_put_contents($logFile, json_encode($logEntry) . "\n", FILE_APPEND | LOCK_EX);
}

// Hauptverarbeitung
try {
    // Rate Limiting: Max 1 Request pro Sekunde pro IP
    $lockFile = __DIR__ . '/locks/rate_limit_' . md5($_SERVER['REMOTE_ADDR'] ?? 'unknown') . '.lock';
    $lockDir = dirname($lockFile);
    if (!is_dir($lockDir)) {
        mkdir($lockDir, 0755, true);
    }
    
    // Prüfe letzten Request
    if (file_exists($lockFile)) {
        $lastRequest = (int)file_get_contents($lockFile);
        $timeSinceLastRequest = time() - $lastRequest;
        
        if ($timeSinceLastRequest < 2) { // 2 Sekunden Wartezeit
            $waitTime = 2 - $timeSinceLastRequest;
            sleep($waitTime);
        }
    }
    
    // Speichere aktuellen Zeitstempel
    file_put_contents($lockFile, time());
    
    // Parameter validieren
    $params = validateParams();
    
    // API-URL erstellen
    $apiUrl = buildApiUrl($params);
    
    // Debug-Output
    if (isset($_GET['debug'])) {
        echo json_encode([
            'debug' => true,
            'params' => $params,
            'api_url' => $apiUrl,
            'timestamp' => date('Y-m-d H:i:s')
        ], JSON_PRETTY_PRINT);
        exit();
    }
    
    // API-Request ausführen
    $response = makeFlightradar24Request($apiUrl);
    
    // Response validieren
    $decodedResponse = json_decode($response, true);
    if (json_last_error() !== JSON_ERROR_NONE) {
        throw new Exception("Ungültige JSON-Antwort von der API");
    }
    
    // Erfolgreiche Antwort loggen
    logRequest($params, true);
    
    // Antwort mit zusätzlichen Metadaten
    $result = [
        'success' => true,
        'data' => $decodedResponse,
        'meta' => [
            'registration' => $params['registration'],
            'date' => $params['date'],
            'endpoint' => $params['endpoint'],
            'timestamp' => date('Y-m-d H:i:s'),
            'source' => 'flightradar24-native'
        ]
    ];
    
    echo json_encode($result);
    
} catch (Exception $e) {
    // Fehler loggen
    if (isset($params)) {
        logRequest($params, false, $e->getMessage());
    }
    
    // Fehlerantwort
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage(),
        'timestamp' => date('Y-m-d H:i:s')
    ]);
}
?>
