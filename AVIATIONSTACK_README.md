# Aviationstack API Integration

## 🎯 Übersicht

Die Aviationstack API wurde erfolgreich in HangarPlanner integriert und ersetzt die "Non FlightRadar API" Option im Menü. Diese API ist **optimal für Übernachtungslogik** geeignet, da sie zukünftige Flugdaten bis zu 7 Tage im Voraus unterstützt.

## ✨ Features

### 🔮 Zukünftige Flugdaten

- **Dedicated `/flightsFuture` Endpoint** für Flüge der nächsten 7 Tage
- **Übernachtungslogik-Unterstützung** mit automatischer Erkennung
- **Aircraft Registration Search** via `aircraft_iata` Parameter

### 💰 Kosteneffizient

- **Free Plan**: 500 Requests/Monat
- **Basic Plan**: $10/Monat (5.000 Requests)
- **Professional Plan**: $50/Monat (50.000 Requests)

### 🛡️ Technische Features

- **CORS-Proxy-Lösung** via PHP (aviationstack-proxy.php)
- **Rate Limiting** (100 Requests/Minute)
- **Automatische Fehlerbehandlung**
- **Einheitliche API-Facade Integration**

## 📁 Dateien

### Neue Dateien

```
js/aviationstack-api.js          # Haupt-API-Implementation
js/aviationstack-test.js         # Test-Funktionen
js/aviationstack-debug.js        # Debug und Integration-Check
sync/aviationstack-proxy.php     # CORS-Proxy für serverseitige Anfragen
```

### Modifizierte Dateien

```
index.html                       # Aviationstack Option hinzugefügt
js/api-facade.js                 # Aviationstack Provider integriert
```

## 🚀 Verwendung

### 1. Provider umstellen

Im Menü unter "Flight Data" → "API-Provider" → **"Aviationstack API"** auswählen

### 2. Flugdaten abrufen

- Aircraft ID eingeben (z.B. `D-AIBL`)
- Datum für letzten Flug setzen
- Datum für ersten Flug setzen (morgen)
- "Update Data" klicken

### 3. Übernachtungslogik testen

```javascript
// Browser-Konsole
testOvernightLogic("D-AIBL");
```

## 🧪 Test-Funktionen

### Vollständiger API-Test

```javascript
testAviationstackAPI("D-AIBL");
```

### Übernachtungslogik

```javascript
testOvernightLogic("D-AIBL");
```

### Zukünftige Flüge (3 Tage)

```javascript
testFutureFlights("D-AIBL", 3);
```

### Integration prüfen

```javascript
checkAviationstackIntegration();
```

## 📊 API-Endpunkte

### Zukünftige Flüge

```javascript
aviationstackAPI.getFutureFlights("D-AIBL", {
	flight_date: "2025-08-08",
	dep_iata: "MUC",
	limit: 10,
});
```

### Aktuelle Flüge

```javascript
aviationstackAPI.getCurrentFlights("D-AIBL", {
	flight_date: "2025-08-07",
	flight_status: "active",
});
```

### Übernachtungslogik

```javascript
aviationstackAPI.getOvernightFlights("D-AIBL", "MUC");
```

### Flughafen-Flüge

```javascript
aviationstackAPI.getAirportFlights("MUC", {
	type: "departure",
	future: true,
	flight_date: "2025-08-08",
});
```

## 🔧 Konfiguration

### API-Token

Das Token ist bereits in der PHP-Proxy-Datei konfiguriert:

```php
$API_KEY = '426b652e15703c7b01f50adf5c41e7e6';
```

### Rate Limiting

- **Client-seitig**: 100 Requests/Minute
- **Server-seitig**: Tracking in `aviationstack_rate_limit.txt`

### Logging

Alle API-Calls werden geloggt in:

- `aviationstack_log.txt` (Server-seitig)
- Browser-Konsole (Client-seitig)

## 🌟 Vorteile gegenüber anderen APIs

| Feature                | Aviationstack   | FlightRadar24     | AeroDataBox |
| ---------------------- | --------------- | ----------------- | ----------- |
| Zukünftige Daten       | ✅ Bis 7 Tage   | ❌ Nur historisch | ✅ Begrenzt |
| Aircraft Registration  | ✅ Direkt       | ✅ Ja             | ✅ Ja       |
| Kosten                 | ✅ $10-50/Monat | ❌ Teuer          | 💰 Mittel   |
| Übernachtungslogik     | ✅ Optimal      | ❌ Ungeeignet     | ⚠️ Begrenzt |
| Future Flight Endpoint | ✅ Dediziert    | ❌ Nein           | ❌ Nein     |

## 🎯 Empfehlung

**Aviationstack ist die beste Wahl für:**

- ✅ Übernachtungslogik mit zukünftigen Flugdaten
- ✅ Kosteneffiziente Lösung für kleine/mittlere Projekte
- ✅ Einfache Integration und Wartung
- ✅ Zuverlässige zukünftige Flugpläne

## 🚨 Troubleshooting

### API nicht verfügbar

```javascript
// Prüfe ob API geladen ist
if (!window.aviationstackAPI) {
	console.error("Aviationstack API nicht geladen");
}
```

### CORS-Fehler

- Prüfe ob `sync/aviationstack-proxy.php` verfügbar ist
- Server muss PHP unterstützen

### Rate Limit

```javascript
// Check rate limit status
console.log(window.aviationstackAPI.rateLimit);
```

### Integration prüfen

```javascript
// Vollständige Diagnose
checkAviationstackIntegration();
```

## 📝 Changelog

### Version 1.0.0 (August 2025)

- ✅ Ersetzt "Non FlightRadar API" Option
- ✅ Vollständige API-Facade Integration
- ✅ CORS-Proxy-Lösung implementiert
- ✅ Übernachtungslogik optimiert
- ✅ Test-Suite erstellt
- ✅ Debug-Tools hinzugefügt

## 🤝 Support

Bei Problemen:

1. `checkAviationstackIntegration()` ausführen
2. Browser-Konsole prüfen
3. `aviationstack_log.txt` auf Server prüfen

**Die Aviationstack API ist jetzt vollständig integriert und einsatzbereit! 🎉**
