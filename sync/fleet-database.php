<?php
/**
 * Serverseitige Fleet Database API für Hangar Planner
 * Verwaltet eine JSON-Datenbank für Flugzeug-Flottendaten
 * 
 * Funktionen:
 * - GET: Lädt vorhandene Fleet-Daten aus der Datenbank
 * - POST: Speichert/Aktualisiert Fleet-Daten (Erstladung oder Abgleich)
 * - PUT: Fügt neue Flugzeuge hinzu oder aktualisiert vorhandene
 * - DELETE: Entfernt Flugzeuge oder ganze Airlines
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

// CORS-Header
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, X-Requested-With");
header("Content-Type: application/json; charset=UTF-8");

// Bei OPTIONS-Anfragen (CORS preflight) sofort beenden
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit(0);
}

// Datenbankdatei für Fleet-Daten
$fleetDbFile = __DIR__ . '/fleet-database.json';
$maxFileSize = 10 * 1024 * 1024; // 10MB für Fleet-Daten

/**
 * Initialisiert eine leere Fleet-Datenbank
 */
function initializeFleetDatabase() {
    return [
        'fleetDatabase' => [
            'version' => '1.0.0',
            'lastUpdate' => time() * 1000,
            'airlines' => [],
            'metadata' => [
                'created' => time() * 1000,
                'lastModified' => time() * 1000,
                'totalAircrafts' => 0,
                'syncStatus' => 'initialized',
                'apiCalls' => 0,
                'lastApiSync' => null
            ]
        ]
    ];
}

/**
 * Lädt die Fleet-Datenbank oder erstellt eine neue
 */
function loadFleetDatabase($file) {
    if (file_exists($file)) {
        $content = file_get_contents($file);
        
        // Prüfe ob Datei leer ist
        if (empty(trim($content))) {
            throw new Exception('Datei ist leer');
        }
        
        $data = json_decode($content, true);
        
        // Prüfe JSON-Fehler
        if ($data === null) {
            $jsonError = json_last_error_msg();
            throw new Exception('JSON Parse Fehler: ' . $jsonError);
        }
        
        // Prüfe Datenstruktur
        if (!isset($data['fleetDatabase'])) {
            throw new Exception('Ungültige Datenstruktur: fleetDatabase fehlt');
        }
        
        return $data;
    }
    
    // Datei existiert nicht, erstelle neue
    return initializeFleetDatabase();
}

/**
 * Speichert die Fleet-Datenbank
 */
function saveFleetDatabase($file, $data) {
    // Metadaten aktualisieren
    $data['fleetDatabase']['lastUpdate'] = time() * 1000;
    $data['fleetDatabase']['metadata']['lastModified'] = time() * 1000;
    
    // Total aircrafts zählen
    $totalAircrafts = 0;
    foreach ($data['fleetDatabase']['airlines'] as $airline) {
        $totalAircrafts += count($airline['aircrafts']);
    }
    $data['fleetDatabase']['metadata']['totalAircrafts'] = $totalAircrafts;
    
    $formattedJson = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    return file_put_contents($file, $formattedJson, LOCK_EX);
}

/**
 * Führt einen Sync-Abgleich zwischen vorhandenen und neuen Daten durch
 */
function syncFleetData($existingData, $newData) {
    $changes = [
        'added' => 0,
        'updated' => 0,
        'removed' => 0,
        'unchanged' => 0
    ];
    
    $fleetDb = $existingData['fleetDatabase'];
    
    // Neue Airlines hinzufügen oder aktualisieren
    if (isset($newData['airlines'])) {
        foreach ($newData['airlines'] as $airlineCode => $newAirline) {
            if (!isset($fleetDb['airlines'][$airlineCode])) {
                // Neue Airline hinzufügen
                $fleetDb['airlines'][$airlineCode] = [
                    'code' => $airlineCode,
                    'name' => $newAirline['name'] ?? $airlineCode,
                    'color' => $newAirline['color'] ?? '#0066CC',
                    'aircrafts' => [],
                    'lastSync' => time() * 1000,
                    'totalCount' => 0
                ];
                $changes['added']++;
            }
            
            // Flugzeuge abgleichen
            if (isset($newAirline['aircrafts'])) {
                $existingAircrafts = $fleetDb['airlines'][$airlineCode]['aircrafts'];
                $existingRegistrations = array_column($existingAircrafts, 'registration');
                
                foreach ($newAirline['aircrafts'] as $aircraft) {
                    $registration = $aircraft['registration'];
                    $existingIndex = array_search($registration, $existingRegistrations);
                    
                    if ($existingIndex === false) {
                        // Neues Flugzeug hinzufügen
                        $fleetDb['airlines'][$airlineCode]['aircrafts'][] = array_merge($aircraft, [
                            'dateAdded' => time() * 1000,
                            'lastUpdated' => time() * 1000
                        ]);
                        $changes['added']++;
                    } else {
                        // Vorhandenes Flugzeug aktualisieren wenn sich Daten geändert haben
                        $existingAircraft = $existingAircrafts[$existingIndex];
                        $hasChanges = false;
                        
                        foreach ($aircraft as $key => $value) {
                            if (!isset($existingAircraft[$key]) || $existingAircraft[$key] !== $value) {
                                $hasChanges = true;
                                break;
                            }
                        }
                        
                        if ($hasChanges) {
                            $fleetDb['airlines'][$airlineCode]['aircrafts'][$existingIndex] = array_merge(
                                $existingAircraft,
                                $aircraft,
                                ['lastUpdated' => time() * 1000]
                            );
                            $changes['updated']++;
                        } else {
                            $changes['unchanged']++;
                        }
                    }
                }
                
                // Airline-Metadaten aktualisieren
                $fleetDb['airlines'][$airlineCode]['totalCount'] = count($fleetDb['airlines'][$airlineCode]['aircrafts']);
                $fleetDb['airlines'][$airlineCode]['lastSync'] = time() * 1000;
            }
        }
    }
    
    // Sync-Status aktualisieren
    $fleetDb['metadata']['syncStatus'] = 'synced';
    $fleetDb['metadata']['lastApiSync'] = time() * 1000;
    $fleetDb['metadata']['apiCalls'] = ($fleetDb['metadata']['apiCalls'] ?? 0) + 1;
    
    return [
        'fleetDatabase' => $fleetDb,
        'syncResult' => $changes
    ];
}

// Hauptlogik basierend auf HTTP-Methode
try {
    // Debug-Ausgabe für Entwicklung
    if ($debug_mode) {
        error_log("Fleet Database API - Method: " . $_SERVER['REQUEST_METHOD']);
        error_log("Fleet Database API - Query: " . http_build_query($_GET));
        error_log("Fleet Database API - File exists: " . (file_exists($fleetDbFile) ? 'yes' : 'no'));
    }
    
    switch ($_SERVER['REQUEST_METHOD']) {
        
        case 'GET':
            // Fleet-Daten laden
            $action = $_GET['action'] ?? 'load';
            
            if ($action === 'status') {
                // Nur Status-Informationen zurückgeben
                if (file_exists($fleetDbFile)) {
                    try {
                        $data = loadFleetDatabase($fleetDbFile);
                        echo json_encode([
                            'exists' => true,
                            'lastUpdate' => $data['fleetDatabase']['lastUpdate'],
                            'totalAircrafts' => $data['fleetDatabase']['metadata']['totalAircrafts'],
                            'syncStatus' => $data['fleetDatabase']['metadata']['syncStatus'],
                            'airlines' => array_keys($data['fleetDatabase']['airlines']),
                            'fileSize' => filesize($fleetDbFile),
                            'success' => true
                        ]);
                    } catch (Exception $e) {
                        // Datei existiert, aber ist beschädigt
                        echo json_encode([
                            'exists' => false,
                            'syncStatus' => 'corrupted_file',
                            'totalAircrafts' => 0,
                            'airlines' => [],
                            'error' => 'Datei beschädigt: ' . $e->getMessage(),
                            'success' => false
                        ]);
                    }
                } else {
                    echo json_encode([
                        'exists' => false,
                        'syncStatus' => 'never_synced',
                        'totalAircrafts' => 0,
                        'airlines' => [],
                        'success' => true
                    ]);
                }
            } else {
                // Vollständige Daten laden
                $data = loadFleetDatabase($fleetDbFile);
                echo json_encode($data);
            }
            break;
            
        case 'POST':
            // Fleet-Daten speichern oder synchronisieren
            $contentLength = isset($_SERVER['CONTENT_LENGTH']) ? (int)$_SERVER['CONTENT_LENGTH'] : 0;
            
            if ($contentLength > $maxFileSize) {
                throw new Exception("Datei zu groß. Maximum: " . ($maxFileSize / 1024 / 1024) . "MB");
            }
            
            if ($contentLength === 0) {
                throw new Exception("Keine Daten empfangen");
            }
            
            $jsonData = file_get_contents('php://input');
            $newData = json_decode($jsonData, true);
            
            if ($newData === null) {
                throw new Exception("Ungültiges JSON-Format: " . json_last_error_msg());
            }
            
            $syncMode = $_GET['sync'] ?? 'true';
            
            if ($syncMode === 'false' || !file_exists($fleetDbFile)) {
                // Vollständige Neuerstellung (Erstladung)
                if (isset($newData['fleetDatabase'])) {
                    $data = $newData;
                } else {
                    // Neue Daten in Fleet-DB-Format konvertieren
                    $data = initializeFleetDatabase();
                    $data['fleetDatabase']['airlines'] = $newData['airlines'] ?? [];
                    $data['fleetDatabase']['metadata']['syncStatus'] = 'initial_load';
                }
                
                if (saveFleetDatabase($fleetDbFile, $data) === false) {
                    throw new Exception("Fehler beim Speichern der Fleet-Datenbank");
                }
                
                echo json_encode([
                    'message' => 'Fleet-Datenbank erfolgreich erstellt',
                    'totalAircrafts' => $data['fleetDatabase']['metadata']['totalAircrafts'],
                    'airlines' => count($data['fleetDatabase']['airlines']),
                    'success' => true
                ]);
            } else {
                // Synchronisationsmodus - Abgleich mit vorhandenen Daten
                $existingData = loadFleetDatabase($fleetDbFile);
                $syncResult = syncFleetData($existingData, $newData);
                
                if (saveFleetDatabase($fleetDbFile, $syncResult) === false) {
                    throw new Exception("Fehler beim Aktualisieren der Fleet-Datenbank");
                }
                
                echo json_encode([
                    'message' => 'Fleet-Datenbank erfolgreich synchronisiert',
                    'changes' => $syncResult['syncResult'],
                    'totalAircrafts' => $syncResult['fleetDatabase']['metadata']['totalAircrafts'],
                    'success' => true
                ]);
            }
            break;
            
        case 'PUT':
            // Einzelne Flugzeuge hinzufügen/aktualisieren
            $jsonData = file_get_contents('php://input');
            $aircraftData = json_decode($jsonData, true);
            
            if (!isset($aircraftData['airline']) || !isset($aircraftData['aircraft'])) {
                throw new Exception("Airline-Code und Flugzeugdaten erforderlich");
            }
            
            $data = loadFleetDatabase($fleetDbFile);
            $airlineCode = $aircraftData['airline'];
            $aircraft = $aircraftData['aircraft'];
            
            // Airline erstellen wenn nicht vorhanden
            if (!isset($data['fleetDatabase']['airlines'][$airlineCode])) {
                $data['fleetDatabase']['airlines'][$airlineCode] = [
                    'code' => $airlineCode,
                    'name' => $aircraftData['airlineName'] ?? $airlineCode,
                    'color' => $aircraftData['airlineColor'] ?? '#0066CC',
                    'aircrafts' => [],
                    'lastSync' => time() * 1000,
                    'totalCount' => 0
                ];
            }
            
            // Flugzeug hinzufügen/aktualisieren
            $aircrafts = &$data['fleetDatabase']['airlines'][$airlineCode]['aircrafts'];
            $existingIndex = -1;
            
            for ($i = 0; $i < count($aircrafts); $i++) {
                if ($aircrafts[$i]['registration'] === $aircraft['registration']) {
                    $existingIndex = $i;
                    break;
                }
            }
            
            if ($existingIndex >= 0) {
                // Aktualisieren
                $aircrafts[$existingIndex] = array_merge($aircrafts[$existingIndex], $aircraft, [
                    'lastUpdated' => time() * 1000
                ]);
                $action = 'updated';
            } else {
                // Hinzufügen
                $aircrafts[] = array_merge($aircraft, [
                    'dateAdded' => time() * 1000,
                    'lastUpdated' => time() * 1000
                ]);
                $action = 'added';
            }
            
            // Airline-Metadaten aktualisieren
            $data['fleetDatabase']['airlines'][$airlineCode]['totalCount'] = count($aircrafts);
            $data['fleetDatabase']['airlines'][$airlineCode]['lastSync'] = time() * 1000;
            
            if (saveFleetDatabase($fleetDbFile, $data) === false) {
                throw new Exception("Fehler beim Speichern der Flugzeugdaten");
            }
            
            echo json_encode([
                'message' => "Flugzeug erfolgreich $action",
                'aircraft' => $aircraft['registration'],
                'airline' => $airlineCode,
                'action' => $action,
                'success' => true
            ]);
            break;
            
        case 'DELETE':
            // Flugzeuge oder Airlines löschen
            $registration = $_GET['registration'] ?? null;
            $airlineCode = $_GET['airline'] ?? null;
            
            if (!$airlineCode) {
                throw new Exception("Airline-Code erforderlich");
            }
            
            $data = loadFleetDatabase($fleetDbFile);
            
            if (!isset($data['fleetDatabase']['airlines'][$airlineCode])) {
                throw new Exception("Airline nicht gefunden");
            }
            
            if ($registration) {
                // Einzelnes Flugzeug löschen
                $aircrafts = &$data['fleetDatabase']['airlines'][$airlineCode]['aircrafts'];
                $found = false;
                
                for ($i = 0; $i < count($aircrafts); $i++) {
                    if ($aircrafts[$i]['registration'] === $registration) {
                        array_splice($aircrafts, $i, 1);
                        $found = true;
                        break;
                    }
                }
                
                if (!$found) {
                    throw new Exception("Flugzeug nicht gefunden");
                }
                
                // Airline-Metadaten aktualisieren
                $data['fleetDatabase']['airlines'][$airlineCode]['totalCount'] = count($aircrafts);
                $data['fleetDatabase']['airlines'][$airlineCode]['lastSync'] = time() * 1000;
                
                $message = "Flugzeug $registration erfolgreich gelöscht";
            } else {
                // Ganze Airline löschen
                unset($data['fleetDatabase']['airlines'][$airlineCode]);
                $message = "Airline $airlineCode erfolgreich gelöscht";
            }
            
            if (saveFleetDatabase($fleetDbFile, $data) === false) {
                throw new Exception("Fehler beim Löschen");
            }
            
            echo json_encode([
                'message' => $message,
                'success' => true
            ]);
            break;
            
        default:
            http_response_code(405);
            echo json_encode([
                'error' => 'Methode nicht erlaubt',
                'allowed_methods' => ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
                'success' => false
            ]);
    }
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'error' => $e->getMessage(),
        'success' => false
    ]);
}
?>
