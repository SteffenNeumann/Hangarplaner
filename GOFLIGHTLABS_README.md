# GoFlightLabs API Integration - HangarPlanner

## 🎯 Übersicht

Die GoFlightLabs API wurde erfolgreich in HangarPlanner integriert und bietet eine kostengünstige Alternative zu anderen Flugdaten-APIs. GoFlightLabs ist **optimal für Aircraft-spezifische Suchen** geeignet, da sie direkte Registrierungs-Abfragen unterstützt.

## 💰 Preisvergleich

| API Provider     | Monatspreis | API Calls  | Pro 1000 Calls | Aircraft Reg Search |
| ---------------- | ----------- | ---------- | -------------- | ------------------- |
| **GoFlightLabs** | **$9.99**   | **10.000** | **€0.90**      | ✅ **Direkt**       |
| AeroDataBox      | $49.99      | 10.000     | €4.50          | ✅ Ja               |
| Aviationstack    | $9.99       | 1.000      | €9.00          | ⚠️ Nur Basic+ Plan  |
| FlightRadar24    | $149.99     | 10.000     | €13.50         | ✅ Ja               |

**🏆 GoFlightLabs ist der günstigste Provider mit direkter Aircraft-Registrierung-Suche!**

## 🚀 Features

### ✅ Implementierte Funktionen

- **Aircraft Registration Search**: Direkte Suche nach Flugzeug-Registrierung (z.B. "D-AIBL")
- **Übernachtungslogik**: Automatische Erkennung von Übernachtungen am Flughafen
- **Zeitbasierte Flugsuche**: Flüge für spezifische Daten
- **Live Flight Data**: Aktuelle Flugdaten
- **Historical Data**: Historische Flugdaten
- **Rate Limiting**: Automatische Anfrage-Begrenzung
- **Error Handling**: Robuste Fehlerbehandlung mit Retry-Logik
- **Debugging**: Umfassende Debug- und Test-Funktionen

### 📡 API Endpoints

- `/schedules` - Flugplan-Daten (Hauptfunktion)
- `/live` - Live-Flugdaten
- `/historical` - Historische Flugdaten
- `/routes` - Flugstrecken
- `/airports` - Flughafen-Informationen

## 🛠️ Technische Integration

### 1. Neue Dateien

- `js/goflightlabs-api.js` - Haupt-API-Integration
- `js/goflightlabs-test.js` - Test- und Debug-Suite

### 2. Erweiterte Dateien

- `js/api-facade.js` - GoFlightLabs Provider hinzugefügt
- `index.html` - Menü-Option und Script-Includes

### 3. API-Konfiguration

```javascript
const config = {
	name: "GoFlightLabs API",
	baseUrl: "https://api.goflightlabs.com",
	apiKey: "eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9...", // Ihr API Key
	rateLimitDelay: 1000, // 1 Sekunde zwischen Anfragen
	maxRetries: 3,
};
```

## 🔧 Verwendung

### 1. Provider umstellen

Im Menü unter "Flight Data" → "API-Provider" → **"GoFlightLabs API"** auswählen

### 2. Flugdaten abrufen

- Aircraft ID eingeben (z.B. `D-AIBL`)
- Datum für letzten Flug setzen
- Datum für ersten Flug setzen (morgen)
- "Update Data" klicken

### 3. Übernachtungslogik testen

```javascript
// Browser-Konsole
testGoFlightLabsOvernightLogic("D-AIBL");
```

## 🧪 Test-Funktionen

### Verfügbare Browser-Konsole Befehle:

```javascript
// 1. Integration prüfen
checkGoFlightLabsIntegration();

// 2. Verbindung testen
await testGoFlightLabsConnection();

// 3. Flugsuche testen
await testGoFlightLabsFlightSearch("D-AIBL", "2025-08-09");

// 4. Übernachtungslogik testen
await testGoFlightLabsOvernightLogic("D-AIBL");

// 5. Zu GoFlightLabs wechseln
switchToGoFlightLabs();

// 6. Vollständiger Test
await runGoFlightLabsFullTest();
```

### Erwartete Test-Ausgabe:

```
🚀 === GOFLIGHTLABS VOLLSTÄNDIGER TEST ===
✅ GoFlightLabsAPI geladen
✅ GoFlightLabs in API-Facade integriert
✅ GoFlightLabs Option im Menü gefunden
✅ Verbindung zu GoFlightLabs erfolgreich!
✅ Provider erfolgreich zu GoFlightLabs gewechselt
📊 Suchergebnis: Flüge gefunden: 3
🏨 Übernachtung erfolgreich erkannt!
🎉 Alle Tests erfolgreich! GoFlightLabs ist einsatzbereit.
```

## 🔄 API-Request Beispiele

### 1. Aircraft Flights by Registration

```
GET https://api.goflightlabs.com/schedules?access_key=YOUR_KEY&aircraft_reg=D-AIBL&date=2025-08-09
```

### 2. Live Flight Data

```
GET https://api.goflightlabs.com/live?access_key=YOUR_KEY&aircraft_reg=D-AIBL
```

### 3. Historical Data

```
GET https://api.goflightlabs.com/historical?access_key=YOUR_KEY&aircraft_reg=D-AIBL&date_from=2025-08-01&date_to=2025-08-09
```

## 🌟 Vorteile gegenüber anderen APIs

| Feature                 | GoFlightLabs     | AeroDataBox | Aviationstack  | FlightRadar24    |
| ----------------------- | ---------------- | ----------- | -------------- | ---------------- |
| **Kosten**              | ✅ **$9.99**     | ❌ $49.99   | ⚠️ $9.99\*     | ❌ $149.99       |
| **Aircraft Reg Search** | ✅ **Direkt**    | ✅ Ja       | ⚠️ Basic+ only | ✅ Ja            |
| **API Calls/Monat**     | ✅ **10.000**    | ⚠️ 10.000   | ❌ 1.000       | ⚠️ 10.000        |
| **Übernachtungslogik**  | ✅ **Optimal**   | ✅ Gut      | ⚠️ Begrenzt    | ❌ Problematisch |
| **Zukünftige Daten**    | ✅ **Ja**        | ⚠️ Begrenzt | ✅ Ja          | ❌ Nein          |
| **Rate Limits**         | ✅ **Großzügig** | ⚠️ Streng   | ⚠️ Streng      | ❌ Sehr streng   |

\*Aviationstack: Nur 1.000 Calls im Basic Plan, Aircraft Registration erst ab Basic+ Plan

## 🔧 Implementierungs-Details

### Übernachtungslogik

```javascript
const updateAircraftData = async (aircraftId, currentDate, nextDate) => {
	// 1. Flugdaten für beide Tage abrufen
	const [currentDayData, nextDayData] = await Promise.all([
		getAircraftFlights(aircraftId, currentDate),
		getAircraftFlights(aircraftId, nextDate),
	]);

	// 2. Letzten Ankunftsflug am ersten Tag finden
	const lastArrivalToday = findLastArrivalToAirport(
		currentDayData,
		selectedAirport
	);

	// 3. Ersten Abflug am zweiten Tag finden
	const firstDepartureTomorrow = findFirstDepartureFromAirport(
		nextDayData,
		selectedAirport
	);

	// 4. Übernachtung nur wenn beide Flüge existieren
	if (lastArrivalToday && firstDepartureTomorrow) {
		return buildOvernightResult(lastArrivalToday, firstDepartureTomorrow);
	}
};
```

### Datenformat-Konvertierung

```javascript
const convertToUnifiedFormat = (
	goFlightLabsData,
	aircraftRegistration,
	date
) => {
	return {
		type: "DatedFlight",
		scheduledDepartureDate: date,
		flightDesignator: {
			carrierCode: flight.airline?.iata,
			carrierName: flight.airline?.name,
			flightNumber: flight.flight?.number,
		},
		flightPoints: [
			{
				departurePoint: true,
				iataCode: flight.departure?.iata,
				departure: {
					timings: [
						{
							qualifier: "STD",
							value: formatTime(flight.departure?.scheduled),
							isUtc: true,
						},
					],
				},
			},
			// ... arrival point
		],
	};
};
```

## 🎯 Empfehlung

**GoFlightLabs ist die beste Wahl für HangarPlanner weil:**

- ✅ **Günstigster Preis**: Nur $9.99 für 10.000 Calls
- ✅ **Direkte Aircraft-Suche**: Keine Umwege über Flughafen-Filter
- ✅ **Optimale Übernachtungslogik**: Perfekt für den HangarPlanner Use Case
- ✅ **Einfache Integration**: Standard REST API
- ✅ **Zuverlässige Daten**: Echte Flugplandaten, keine Mock-Daten
- ✅ **Gute Performance**: Schnelle Antwortzeiten

## 🚦 Status

✅ **Vollständig implementiert und getestet**

- API Integration: ✅ Fertig
- UI Integration: ✅ Fertig
- Übernachtungslogik: ✅ Fertig
- Test-Suite: ✅ Fertig
- Dokumentation: ✅ Fertig

## 📞 Support

Bei Problemen mit der GoFlightLabs Integration:

1. **Test-Suite ausführen**: `runGoFlightLabsFullTest()`
2. **Debug-Modus aktivieren**: `GoFlightLabsAPI.setDebugMode(true)`
3. **Verbindung prüfen**: `testGoFlightLabsConnection()`
4. **API-Status prüfen**: `GoFlightLabsAPI.getAPIInfo()`

---

**🎉 GoFlightLabs ist jetzt einsatzbereit und kann als primärer API-Provider verwendet werden!**
