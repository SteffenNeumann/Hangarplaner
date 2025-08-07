<?php
/**
 * Aviationstack API Proxy
 * CORS-Lösung für direkten Zugriff auf Aviationstack API
 * Erstellt: August 2025
 */

// CORS Headers setzen
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Content-Type: application/json; charset=utf-8');

// OPTIONS Request für Preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Nur GET-Requests erlauben
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit();
}

// Aviationstack API Konfiguration
$API_KEY = '426b652e15703c7b01f50adf5c41e7e6';
$BASE_URL = 'http://api.aviationstack.com/v1/';

// Parameter validieren
$endpoint = $_GET['endpoint'] ?? '';
$allowed_endpoints = ['flights', 'flightsFuture', 'airports', 'airlines', 'aircraft'];

if (!in_array($endpoint, $allowed_endpoints)) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid endpoint']);
    exit();
}

// Query Parameter sammeln (außer endpoint)
$query_params = $_GET;
unset($query_params['endpoint']);

// API Key hinzufügen
$query_params['access_key'] = $API_KEY;

// URL zusammenbauen
$url = $BASE_URL . $endpoint . '?' . http_build_query($query_params);

// Rate Limiting implementieren
$rate_limit_file = 'aviationstack_rate_limit.txt';
$current_time = time();
$requests_per_minute = 100; // Aviationstack Limit

if (file_exists($rate_limit_file)) {
    $last_requests = json_decode(file_get_contents($rate_limit_file), true) ?: [];
    
    // Requests der letzten Minute zählen
    $recent_requests = array_filter($last_requests, function($timestamp) use ($current_time) {
        return ($current_time - $timestamp) < 60;
    });
    
    if (count($recent_requests) >= $requests_per_minute) {
        http_response_code(429);
        echo json_encode([
            'error' => 'Rate limit exceeded',
            'message' => 'Maximum requests per minute reached'
        ]);
        exit();
    }
    
    // Aktuelle Request hinzufügen
    $recent_requests[] = $current_time;
} else {
    $recent_requests = [$current_time];
}

// Rate Limit Daten speichern
file_put_contents($rate_limit_file, json_encode($recent_requests));

// Logging für Debug
$log_entry = [
    'timestamp' => date('Y-m-d H:i:s'),
    'endpoint' => $endpoint,
    'params' => $query_params,
    'url' => $url,
    'ip' => $_SERVER['REMOTE_ADDR'] ?? 'unknown'
];

$log_file = 'aviationstack_log.txt';
file_put_contents($log_file, json_encode($log_entry) . "\n", FILE_APPEND | LOCK_EX);

// cURL Request zur Aviationstack API
$ch = curl_init();
curl_setopt_array($ch, [
    CURLOPT_URL => $url,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT => 30,
    CURLOPT_CONNECTTIMEOUT => 10,
    CURLOPT_FOLLOWLOCATION => true,
    CURLOPT_MAXREDIRS => 3,
    CURLOPT_USERAGENT => 'HangarPlanner/1.0 (Aviationstack Proxy)',
    CURLOPT_SSL_VERIFYPEER => true,
    CURLOPT_SSL_VERIFYHOST => 2
]);

$response = curl_exec($ch);
$http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curl_error = curl_error($ch);
curl_close($ch);

// cURL Fehler behandeln
if ($curl_error) {
    http_response_code(502);
    echo json_encode([
        'error' => 'Proxy error',
        'message' => 'Failed to connect to Aviationstack API',
        'details' => $curl_error
    ]);
    exit();
}

// HTTP Status Code weiterleiten
http_response_code($http_code);

// Response validieren und weiterleiten
if ($response === false) {
    echo json_encode([
        'error' => 'No response',
        'message' => 'No response from Aviationstack API'
    ]);
} else {
    // JSON Response validieren
    $decoded = json_decode($response, true);
    if (json_last_error() === JSON_ERROR_NONE) {
        // Gültige JSON Response
        echo $response;
    } else {
        // Ungültige JSON Response
        echo json_encode([
            'error' => 'Invalid response',
            'message' => 'Invalid JSON response from API',
            'raw_response' => substr($response, 0, 500) // Erste 500 Zeichen für Debug
        ]);
    }
}
?>
