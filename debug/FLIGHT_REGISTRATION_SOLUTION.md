# Flight Registration API - Lösungen für Aircraft Registration Abfragen

## Problem gelöst! 🎯

Sie wollten zu Flugnummern die Aircraft Registration herausfinden. Hier sind die **drei neuen Lösungsansätze**:

## **Lösung 1: Airport Flights + Registration Extraction (EMPFOHLEN)**

Das ist die beste Lösung für Ihr ursprüngliches Problem! Ihre bestehende Flughafen-Abfrage liefert bereits Aircraft Registrations mit.

```javascript
// 1. Ihre bestehende Flughafen-Abfrage (liefert bereits Registrations!)
const flightData = await AeroDataBoxAPI.getAirportFlights(
	"MUC",
	"2025-07-31T03:00",
	"2025-07-31T13:00"
);

// 2. NEUE FUNKTION: Extrahiere alle Aircraft Registrations
const registrations = AeroDataBoxAPI.extractAircraftRegistrations(flightData);

console.log("Alle Flugnummern mit Aircraft Registrations:", registrations);
// Ergebnis:
// [
//   {
//     flightNumber: "LH441",
//     registration: "D-ABYX",
//     departure: { airport: "MUC", time: "2025-07-31T05:30:00Z" },
//     arrival: { airport: "ORD", time: "2025-07-31T09:15:00Z" },
//     aircraftType: "Boeing 747-8"
//   },
//   ...
// ]
```

## **Lösung 2: Direkte Flugnummer-Abfrage mit Registration**

Für spezifische Flugnummern an bestimmten Tagen:

```javascript
// Hole Aircraft Registration für eine spezifische Flugnummer
const flightInfo = await AeroDataBoxAPI.getFlightByNumber(
	"LH441",
	"2025-07-31"
);

if (flightInfo.registration) {
	console.log(`Flugnummer: ${flightInfo.flightNumber}`);
	console.log(`Aircraft Registration: ${flightInfo.registration}`);
	console.log(`Flugzeugtyp: ${flightInfo.aircraftType}`);
	console.log(
		`Route: ${flightInfo.departure.airport} → ${flightInfo.arrival.airport}`
	);
}
```

## **Lösung 3: Multi-Day Suche für Folgetage**

Das löst Ihr Problem mit den "Folgetagen"!

```javascript
// Suche eine Flugnummer über mehrere Tage (findet auch Folgetage)
const multiDayResults = await AeroDataBoxAPI.getFlightByNumberMultipleDays(
	"LH441", // Flugnummer
	"2025-07-31", // Startdatum
	7 // Anzahl Tage vorwärts suchen
);

multiDayResults.forEach((flight) => {
	console.log(
		`${flight.date}: ${flight.flightNumber} = ${flight.registration}`
	);
});
```

## **Warum Ihre ursprüngliche Abfrage keine Registrations zeigte**

Das Problem lag am **API-Endpunkt**:

❌ **Flight Status API** (`/status/`) - zeigt oft keine Aircraft Registration
✅ **Airport Flights API** (`/flights/airports/`) - enthält Aircraft Registration
✅ **Flight Number API** (`/flights/number/`) - enthält Aircraft Registration

## **Vollständiges Beispiel: Ihre Lösung**

```javascript
// Das ist die perfekte Lösung für Ihr Problem:
async function getAllRegistrationsFromAirport() {
	try {
		// 1. Ihr bestehender API-Aufruf (der funktioniert!)
		const xhr = new XMLHttpRequest();
		xhr.open(
			"GET",
			"https://aerodatabox.p.rapidapi.com/flights/airports/iata/MUC/2025-07-31T03:00/2025-07-31T13:00?withLeg=true&direction=Both&withCancelled=true&withCodeshared=true&withCargo=true&withPrivate=true&withLocation=false"
		);
		xhr.setRequestHeader("x-rapidapi-key", "YOUR_API_KEY");
		xhr.setRequestHeader("x-rapidapi-host", "aerodatabox.p.rapidapi.com");

		xhr.onreadystatechange = function () {
			if (this.readyState === this.DONE) {
				const flightData = JSON.parse(this.responseText);

				// 2. NEUE FUNKTION: Extrahiere Registrations
				const registrations =
					AeroDataBoxAPI.extractAircraftRegistrations(flightData);

				// 3. Ergebnis verwenden
				registrations.forEach((flight) => {
					console.log(
						`✈️ ${flight.flightNumber} = ${flight.registration} (${flight.aircraftType})`
					);
				});
			}
		};

		xhr.send();
	} catch (error) {
		console.error("Fehler:", error);
	}
}
```

## **API-Endpunkte Übersicht**

| Endpunkt            | URL-Format                                       | Aircraft Registration  | Für Folgetage geeignet |
| ------------------- | ------------------------------------------------ | ---------------------- | ---------------------- |
| **Airport Flights** | `/flights/airports/iata/{airport}/{start}/{end}` | ✅ Ja                  | ✅ Ja (Zeitbereich)    |
| **Flight Number**   | `/flights/number/{flight}/{date}`                | ✅ Ja                  | ❌ Nur ein Tag         |
| **Flight Status**   | `/status/{flight}/{date}`                        | ❌ Oft nicht verfügbar | ❌ Nur ein Tag         |

## **Test-Seite**

Öffnen Sie `test-flight-registration.html` um alle neuen Funktionen zu testen!

Die Seite zeigt:

1. ✅ Einzelne Flugnummer → Aircraft Registration
2. ✅ Multi-Day Suche für Folgetage
3. ✅ **Flughafen-Abfrage mit Registration-Extraktion (Ihre Lösung!)**

## **Integration in Ihre Anwendung**

```javascript
// In Ihrer bestehenden Anwendung:

// 1. Verwenden Sie Ihre bestehende Flughafen-Abfrage
const airportFlights = await AeroDataBoxAPI.getAirportFlights(
	"MUC",
	startTime,
	endTime
);

// 2. Extrahieren Sie alle Registrations mit der neuen Funktion
const allRegistrations =
	AeroDataBoxAPI.extractAircraftRegistrations(airportFlights);

// 3. Nutzen Sie die Daten für Ihren Hangarplaner
allRegistrations.forEach((flight) => {
	// flight.flightNumber - die Flugnummer
	// flight.registration - die Aircraft Registration (das was Sie wollten!)
	// flight.aircraftType - der Flugzeugtyp
	// flight.departure/arrival - Zeiten und Flughäfen

	updateHangarPlannerWithRegistration(flight.registration, flight.flightNumber);
});
```

**Fertig! Problem gelöst! 🎉**
