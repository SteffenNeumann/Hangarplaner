<?php
/**
 * GoFlightLabs API Proxy Server
 * Löst CORS-Probleme für GoFlightLabs API-Aufrufe
 * Proxy für: https://api.goflightlabs.com/
 */

// CORS-Header setzen
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");
header("Content-Type: application/json; charset=UTF-8");

// Preflight OPTIONS-Request behandeln
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Nur GET-Requests erlauben
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode([
        'error' => [
            'code' => 'METHOD_NOT_ALLOWED',
            'message' => 'Only GET requests are allowed'
        ]
    ]);
    exit();
}

// GoFlightLabs API-Konfiguration
$GOFLIGHTLABS_API_KEY = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJhdWQiOiI0IiwianRpIjoiYmRlMmNiYmIxMDMzNzAzMjFkYjIzNzdiNmExNzc0Y2QyMTFiMGY5Zjk3ZWRjMGRkYmNlM2U4YWRjM2UwNGE4ZWM1YTRlY2RmMTQ5M2IxNzMiLCJpYXQiOjE3NTQ3MjgwMzgsIm5iZiI6MTc1NDcyODAzOCwiZXhwIjoxNzg2MjY0MDM4LCJzdWIiOiIyNTYyNCIsInNjb3BlcyI6W119.nR5qYTMV-A9oZferXED_WNpcl8XSl82YMZa9ufaxWGQo_7-1tS6ZH8bUpMZgmxqWbsrHEBIExgHGyb-zZiLEIA';
$GOFLIGHTLABS_BASE_URL = 'https://api.goflightlabs.com';

// Erlaubte Endpoints
$ALLOWED_ENDPOINTS = [
    'schedules',
    'live',
    'historical',
    'routes',
    'airports'
];

// Input-Parameter validieren
$endpoint = $_GET['endpoint'] ?? '';
$aircraft_reg = $_GET['aircraft_reg'] ?? '';
$date = $_GET['date'] ?? '';
$date_from = $_GET['date_from'] ?? '';
$date_to = $_GET['date_to'] ?? '';
$dep_iata = $_GET['dep_iata'] ?? '';
$arr_iata = $_GET['arr_iata'] ?? '';

// Debug-Parameter
$debug = isset($_GET['debug']) && $_GET['debug'] === 'true';

// Logging-Funktion
function logMessage($message, $debug = false) {
    if ($debug) {
        error_log("[GoFlightLabs Proxy] " . $message);
    }
}

// Endpoint validieren
if (empty($endpoint) || !in_array($endpoint, $ALLOWED_ENDPOINTS)) {
    http_response_code(400);
    echo json_encode([
        'error' => [
            'code' => 'INVALID_ENDPOINT',
            'message' => 'Invalid or missing endpoint. Allowed: ' . implode(', ', $ALLOWED_ENDPOINTS)
        ]
    ]);
    exit();
}

// Parameter für GoFlightLabs API aufbauen
$api_params = [
    'access_key' => $GOFLIGHTLABS_API_KEY
];

// Endpoint-spezifische Parameter hinzufügen
switch ($endpoint) {
    case 'schedules':
        if (!empty($aircraft_reg)) {
            $api_params['aircraft_reg'] = $aircraft_reg;
        }
        if (!empty($date)) {
            $api_params['date'] = $date;
        }
        if (!empty($date_from)) {
            $api_params['date_from'] = $date_from;
        }
        if (!empty($date_to)) {
            $api_params['date_to'] = $date_to;
        }
        if (!empty($dep_iata)) {
            $api_params['dep_iata'] = $dep_iata;
        }
        if (!empty($arr_iata)) {
            $api_params['arr_iata'] = $arr_iata;
        }
        break;
        
    case 'live':
        if (!empty($aircraft_reg)) {
            $api_params['aircraft_reg'] = $aircraft_reg;
        }
        break;
        
    case 'historical':
        if (!empty($aircraft_reg)) {
            $api_params['aircraft_reg'] = $aircraft_reg;
        }
        if (!empty($date_from)) {
            $api_params['date_from'] = $date_from;
        }
        if (!empty($date_to)) {
            $api_params['date_to'] = $date_to;
        }
        break;
}

// API-URL aufbauen
$api_url = $GOFLIGHTLABS_BASE_URL . '/' . $endpoint . '?' . http_build_query($api_params);

logMessage("API Request: " . $api_url, $debug);

// API-Anfrage durchführen
$context = stream_context_create([
    'http' => [
        'method' => 'GET',
        'header' => [
            'Accept: application/json',
            'User-Agent: HangarPlanner-GoFlightLabs-Proxy/1.0'
        ],
        'timeout' => 30
    ]
]);

$response = @file_get_contents($api_url, false, $context);
$http_response_header_status = $http_response_header[0] ?? '';

// Response-Status prüfen
if ($response === false) {
    logMessage("API Request failed: " . error_get_last()['message'], true);
    http_response_code(502);
    echo json_encode([
        'error' => [
            'code' => 'API_REQUEST_FAILED',
            'message' => 'Failed to fetch data from GoFlightLabs API'
        ]
    ]);
    exit();
}

// HTTP-Status prüfen
if (strpos($http_response_header_status, '200') === false) {
    logMessage("API returned non-200 status: " . $http_response_header_status, true);
    http_response_code(502);
    echo json_encode([
        'error' => [
            'code' => 'API_ERROR',
            'message' => 'GoFlightLabs API returned error: ' . $http_response_header_status
        ]
    ]);
    exit();
}

// JSON validieren
$data = json_decode($response, true);
if ($data === null && json_last_error() !== JSON_ERROR_NONE) {
    logMessage("Invalid JSON response: " . json_last_error_msg(), true);
    http_response_code(502);
    echo json_encode([
        'error' => [
            'code' => 'INVALID_JSON',
            'message' => 'Invalid JSON response from GoFlightLabs API'
        ]
    ]);
    exit();
}

// API-Fehler prüfen
if (isset($data['error'])) {
    logMessage("GoFlightLabs API Error: " . json_encode($data['error']), true);
    http_response_code(400);
    echo json_encode($data);
    exit();
}

// Debug-Informationen hinzufügen
if ($debug) {
    $data['_proxy_debug'] = [
        'endpoint' => $endpoint,
        'api_url' => $api_url,
        'response_length' => strlen($response),
        'timestamp' => date('Y-m-d H:i:s'),
        'data_count' => isset($data['data']) ? count($data['data']) : 0
    ];
}

// Erfolgreiche Antwort zurückgeben
logMessage("Successful response, data count: " . (isset($data['data']) ? count($data['data']) : 0), $debug);
echo json_encode($data);
?>
