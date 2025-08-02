# Fleet Database - Serverseitige JSON-Datenbank

## Übersicht

Die Fleet Database ist eine serverseitige JSON-Datenbank für das HangarPlanner-System, die Flugzeug-Flottendaten intelligent verwaltet und synchronisiert.

## Funktionen

### 🗄️ Serverseitige Datenhaltung

- **JSON-Datenbank** auf dem Server gespeichert
- **Persistent** zwischen Browser-Sitzungen
- **Strukturiert** nach Airlines und Flugzeugen organisiert

### 🔄 Intelligente Synchronisation

- **Erstladung**: Füllt die Datenbank komplett bei der ersten Nutzung
- **Differential-Sync**: Gleicht nur Unterschiede bei weiteren Aufrufen ab
- **Automatisch**: Entscheidet selbstständig zwischen Erst- und Folge-Synchronisation

### ⚡ Performance-Optimierung

- **Sofortige Verfügbarkeit**: Daten beim Seitenladen direkt verfügbar
- **Lokaler Cache**: Reduziert Server-Anfragen
- **Rate Limiting**: Respektiert API-Grenzen

## Architektur

### Server-Komponenten

#### `/sync/fleet-database.php`

REST-API Endpunkt für Fleet-Daten:

- `GET`: Lädt Daten aus der Datenbank
- `POST`: Speichert/Synchronisiert Daten
- `PUT`: Fügt einzelne Flugzeuge hinzu
- `DELETE`: Entfernt Flugzeuge oder Airlines

#### `/sync/fleet-database.json`

JSON-Datenbank-Datei:

```json
{
  "fleetDatabase": {
    "version": "1.0.0",
    "lastUpdate": 1625097600000,
    "airlines": {
      "CLH": {
        "code": "CLH",
        "name": "Lufthansa CityLine",
        "color": "#0066CC",
        "aircrafts": [...],
        "lastSync": 1625097600000,
        "totalCount": 25
      }
    },
    "metadata": {
      "created": 1625097600000,
      "lastModified": 1625097600000,
      "totalAircrafts": 50,
      "syncStatus": "synced",
      "apiCalls": 5,
      "lastApiSync": 1625097600000
    }
  }
}
```

### Client-Komponenten

#### `/js/fleet-database-manager.js`

JavaScript-Manager für die Fleet Database:

- **FleetDatabaseManager-Klasse** für alle Datenbankoperationen
- **Automatische Initialisierung** beim Seitenladen
- **Event-Callbacks** für Daten-Updates

#### Integration in bestehende Systeme

- **fleet-database.html**: Vollständig integriert
- **index.html**: Manager verfügbar für andere Komponenten

## Verwendung

### Automatische Nutzung

Der Fleet Database Manager wird automatisch beim Seitenladen initialisiert:

```javascript
// Manager ist global verfügbar
const manager = window.fleetDatabaseManager;

// Callbacks für Events einrichten
manager.onDataLoaded = (data) => {
	console.log("Daten geladen:", data);
};

manager.onSyncComplete = (result, type) => {
	console.log("Sync abgeschlossen:", type, result);
};
```

### Manuelle API-Aufrufe

```javascript
// Status der Datenbank prüfen
const status = await manager.getServerStatus();

// Daten vom Server laden
const data = await manager.loadFromServer();

// API-Daten synchronisieren
const apiData = { airlines: { ... } };
await manager.syncWithApiData(apiData);

// Einzelnes Flugzeug hinzufügen
await manager.addOrUpdateAircraft('CLH', {
    registration: 'D-ABCD',
    type: 'Embraer 190'
});
```

### Daten abrufen

```javascript
// Alle Fleet-Daten
const allData = manager.getFleetData();

// Flotte einer Airline
const clhFleet = manager.getAirlineFleet("CLH");

// Alle Airlines
const airlines = manager.getAirlines();

// Flugzeug suchen
const aircraft = manager.findAircraftByRegistration("D-ABCD");

// Statistiken
const stats = manager.getStatistics();
```

## Workflow

### Beim ersten Besuch der Fleet Database:

1. 🔍 **Manager prüft** ob Daten auf dem Server vorhanden sind
2. 📡 **API-Aufruf** lädt alle Flottendaten von AeroDataBox
3. 💾 **Erstladung** speichert Daten in der serverseitigen Datenbank
4. ✅ **Anzeige** der Daten in der Benutzeroberfläche

### Bei weiteren Besuchen:

1. ⚡ **Sofortladen** der Daten aus der serverseitigen Datenbank
2. 🔄 **Differential-Sync** gleicht nur Änderungen mit der API ab
3. 📊 **Update-Statistik** zeigt was geändert wurde
4. 🔄 **Cache-Aktualisierung** für die nächste Sitzung

### Beim Klick auf "Daten laden":

- **Erste Synchronisation**: Füllt die Datenbank komplett
- **Folge-Synchronisation**: Gleicht nur Unterschiede ab
- **Automatische Erkennung** welcher Modus benötigt wird

## Vorteile

### 🚀 Performance

- **Sofortige Verfügbarkeit** der Daten beim Seitenladen
- **Reduzierte API-Aufrufe** durch intelligente Synchronisation
- **Lokaler Cache** für bessere Benutzerexperience

### 💾 Datenkonsistenz

- **Zentrale Datenhaltung** auf dem Server
- **Versionierung** und Metadaten für Nachvollziehbarkeit
- **Synchronisationsstatus** immer transparent

### 🛠️ Wartbarkeit

- **Klare Trennung** zwischen Client und Server
- **REST-API** für einfache Integration
- **Fehlerbehandlung** und Logging

## Testing

Test-Seite verfügbar unter: `debug/fleet-database-test.html`

### Verfügbare Tests:

- ✅ Server-Status prüfen
- ✅ Daten vom Server laden
- ✅ API-Synchronisation testen
- ✅ Fleet-Daten anzeigen
- ✅ Cache-Management

## Integration in bestehende Systeme

### fleet-database.html

- ✅ Vollständig integriert
- ✅ Automatische Synchronisation beim Laden-Button
- ✅ Daten sofort beim Seitenladen verfügbar

### index.html

- ✅ Manager global verfügbar
- 🔄 Kann von anderen Komponenten genutzt werden
- 📊 Statistiken für Dashboard verfügbar

## Konfiguration

### Server-Einstellungen (fleet-database.php)

```php
$debug_mode = isset($_GET['debug']) && $_GET['debug'] === 'true';
$maxFileSize = 10 * 1024 * 1024; // 10MB
```

### Client-Einstellungen (fleet-database-manager.js)

```javascript
this.apiEndpoint = "sync/fleet-database.php";
```

## Sicherheit

- ✅ **CORS-Header** konfiguriert
- ✅ **Input-Validierung** für JSON-Daten
- ✅ **File-Locking** beim Schreiben
- ✅ **Größenbegrenzung** für Uploads
- ✅ **Error-Handling** ohne sensitive Daten

## Monitoring

### Verfügbare Metriken:

- `totalAircrafts`: Anzahl aller Flugzeuge
- `totalAirlines`: Anzahl der Airlines
- `lastUpdate`: Zeitstempel der letzten Aktualisierung
- `syncStatus`: Status der Synchronisation
- `apiCalls`: Anzahl der durchgeführten API-Aufrufe

### Log-Ausgaben:

- 🛩️ Initialisierung
- 📡 API-Aufrufe und Responses
- 💾 Datenbank-Operationen
- ✅ Erfolgsmeldungen
- ❌ Fehlermeldungen mit Details
