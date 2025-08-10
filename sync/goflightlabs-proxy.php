<?php
/**
 * GoFlightLabs API Proxy für CORS-freien Zugriff
 * Optimiert für Flight Data by Date API (v2/flight)
 * Unterstützt aircraft registration search und date ranges
 */

header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Accept, Authorization");

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// GoFlightLabs API Configuration
$API_BASE_URL = "https://www.goflightlabs.com";
$API_KEY = "eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJhdWQiOiI0IiwianRpIjoiYmRlMmNiYmIxMDMzNzAzMjFkYjIzNzdiNmExNzc0Y2QyMTFiMGY5Zjk3ZWRjMGRkYmNlM2U4YWRjM2UwNGE4ZWM1YTRlY2RmMTQ5M2IxNzMiLCJpYXQiOjE3NTQ3MjgwMzgsIm5iZiI6MTc1NDcyODAzOCwiZXhwIjoxNzg2MjY0MDM4LCJzdWIiOiIyNTYyNCIsInNjb3BlcyI6W119.nR5qYTMV-A9oZferXED_WNpcl8XSl82YMZa9ufaxWGQo_7-1tS6ZH8bUpMZgmxqWbsrHEBIExgHGyb-zZiLEIA";

// Available endpoints mapping
$ENDPOINTS = [
    'flights' => 'flights',                           // Real-time flights
    'schedules' => 'advanced-flights-schedules',     // Flight schedules
    'historical' => 'historical',                    // Historical flights
    'flight_by_date' => 'v2/flight',                // Flight Data by Date (EMPFOHLEN)
    'callsign' => 'flights-with-call-sign',         // Flights with callsign
    'future' => 'advanced-future-flights'           // Future flights prediction
];

/**
 * Log function for debugging
 */
function logMessage($message, $data = null) {
    $timestamp = date('Y-m-d H:i:s');
    $logEntry = "[$timestamp] $message";
    if ($data) {
        $logEntry .= " | Data: " . json_encode($data);
    }
    error_log($logEntry);
}

/**
 * Main proxy handler
 */
function handleRequest() {
    global $API_BASE_URL, $API_KEY, $ENDPOINTS;
    
    // Get endpoint from request
    $endpoint = $_GET['endpoint'] ?? 'flight_by_date';
    
    // Validate endpoint
    if (!isset($ENDPOINTS[$endpoint])) {
        http_response_code(400);
        echo json_encode([
            'error' => 'Invalid endpoint',
            'available_endpoints' => array_keys($ENDPOINTS),
            'requested' => $endpoint
        ]);
        return;
    }
    
    $api_endpoint = $ENDPOINTS[$endpoint];
    
    // Build API URL
    $api_url = $API_BASE_URL . '/' . $api_endpoint;
    
    // Prepare query parameters
    $params = $_GET;
    unset($params['endpoint']); // Remove our endpoint parameter
    
    // Add API key
    $params['access_key'] = $API_KEY;
    
    // Handle specific endpoint logic
    switch ($endpoint) {
        case 'flight_by_date':
            // Flight Data by Date API - EMPFOHLENE LÖSUNG
            if (!isset($params['search_by'])) {
                $params['search_by'] = 'reg'; // Default to registration search
            }
            
            // Validate registration parameter
            if ($params['search_by'] === 'reg' && !isset($params['reg'])) {
                http_response_code(400);
                echo json_encode([
                    'error' => 'Missing aircraft registration parameter',
                    'required_params' => ['reg'],
                    'example' => 'reg=D-AINY'
                ]);
                return;
            }
            
            // Default date range if not provided
            if (!isset($params['date_from'])) {
                $params['date_from'] = date('Y-m-d');
            }
            if (!isset($params['date_to'])) {
                $params['date_to'] = date('Y-m-d', strtotime('+1 day'));
            }
            
            logMessage("Flight by Date API", [
                'registration' => $params['reg'] ?? 'N/A',
                'date_from' => $params['date_from'],
                'date_to' => $params['date_to']
            ]);
            break;
            
        case 'flights':
            // Real-time flights
            if (isset($params['regNum'])) {
                logMessage("Real-time flights by registration", ['regNum' => $params['regNum']]);
            }
            break;
            
        case 'schedules':
            // Airport schedules
            if (!isset($params['iataCode'])) {
                http_response_code(400);
                echo json_encode([
                    'error' => 'Missing airport IATA code',
                    'required_params' => ['iataCode'],
                    'example' => 'iataCode=MUC'
                ]);
                return;
            }
            break;
            
        case 'historical':
            // Historical flights
            if (!isset($params['code'])) {
                http_response_code(400);
                echo json_encode([
                    'error' => 'Missing airport code for historical flights',
                    'required_params' => ['code'],
                    'example' => 'code=MUC'
                ]);
                return;
            }
            break;
    }
    
    // Build final URL with parameters
    $query_string = http_build_query($params);
    $final_url = $api_url . '?' . $query_string;
    
    logMessage("GoFlightLabs API Request", [
        'endpoint' => $endpoint,
        'url' => $final_url,
        'params_count' => count($params)
    ]);
    
    // Make the API request
    $context = stream_context_create([
        'http' => [
            'method' => 'GET',
            'header' => [
                'User-Agent: HangarPlanner/1.0 (GoFlightLabs Integration)',
                'Accept: application/json',
                'Content-Type: application/json'
            ],
            'timeout' => 30
        ]
    ]);
    
    $response = @file_get_contents($final_url, false, $context);
    
    if ($response === FALSE) {
        $error = error_get_last();
        logMessage("GoFlightLabs API Error", ['error' => $error['message']]);
        
        http_response_code(500);
        echo json_encode([
            'error' => 'Failed to fetch data from GoFlightLabs API',
            'details' => $error['message'] ?? 'Unknown error',
            'endpoint' => $endpoint,
            'timestamp' => date('c')
        ]);
        return;
    }
    
    // Parse and validate response
    $data = json_decode($response, true);
    
    if (json_last_error() !== JSON_ERROR_NONE) {
        logMessage("GoFlightLabs JSON Error", ['error' => json_last_error_msg()]);
        
        http_response_code(500);
        echo json_encode([
            'error' => 'Invalid JSON response from GoFlightLabs',
            'json_error' => json_last_error_msg(),
            'raw_response' => substr($response, 0, 500)
        ]);
        return;
    }
    
    // Check for API errors
    if (isset($data['error'])) {
        logMessage("GoFlightLabs API returned error", $data);
        
        http_response_code(400);
        echo json_encode([
            'error' => 'GoFlightLabs API Error',
            'api_error' => $data['error'],
            'endpoint' => $endpoint
        ]);
        return;
    }
    
    // Log successful response
    $dataCount = 0;
    if (isset($data['data'])) {
        $dataCount = is_array($data['data']) ? count($data['data']) : 1;
    }
    
    logMessage("GoFlightLabs Success", [
        'endpoint' => $endpoint,
        'data_count' => $dataCount,
        'has_success_flag' => isset($data['success']) ? $data['success'] : 'unknown'
    ]);
    
    // Add metadata to response
    $data['_proxy_info'] = [
        'endpoint' => $endpoint,
        'api_endpoint' => $api_endpoint,
        'timestamp' => date('c'),
        'data_count' => $dataCount
    ];
    
    // Return successful response
    http_response_code(200);
    echo json_encode($data);
}

// Handle the request
try {
    handleRequest();
} catch (Exception $e) {
    logMessage("Proxy Exception", ['exception' => $e->getMessage()]);
    
    http_response_code(500);
    echo json_encode([
        'error' => 'Proxy server error',
        'message' => $e->getMessage(),
        'timestamp' => date('c')
    ]);
}
?>
