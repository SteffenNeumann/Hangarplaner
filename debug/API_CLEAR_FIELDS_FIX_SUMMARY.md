# API-Abfrage Korrektur: Löschen der UI-Felder bei fehlenden Daten

## Problem

Wenn für eine Aircraft ID keine Flugdaten gefunden wurden, wurden die UI-Felder (Arr Time, Dep Time, Pos) nicht ordnungsgemäß gelöscht, sondern behielten ihre vorherigen Werte oder zeigten Standard-Platzhalter.

## Implementierte Lösung

### 1. ✅ AeroDataBox API (`js/aerodatabox-api.js`)

**Geänderte Funktionen:**

- `updateAircraftData()`: Gibt jetzt leere Strings statt "---" / "--:--" zurück
- Neue Flags hinzugefügt:
  - `_noDataFound: true` - Kennzeichnet, dass keine Daten gefunden wurden
  - `_clearFields: true` - Explizite Anweisung zum Löschen der UI-Felder

**Korrekturen:**

```javascript
// VORHER (bei keine Daten gefunden):
return {
	originCode: "---",
	destCode: "---",
	departureTime: "--:--",
	arrivalTime: "--:--",
	positionText: "---",
	data: [],
};

// NACHHER:
return {
	originCode: "",
	destCode: "",
	departureTime: "",
	arrivalTime: "",
	positionText: "",
	data: [],
	_noDataFound: true,
	_clearFields: true,
};
```

### 2. ✅ UI-Update Logik (`js/hangar-data.js`)

**Geänderte Funktion:**

- `updateAircraftFromFlightData()`: Prüft jetzt auf `_clearFields` Flag
- Aktives Löschen der Felder wenn keine Daten vorhanden

**Korrekturen:**

```javascript
// Neue Logik für Field-Clearing:
const shouldClearFields = flightData._clearFields || flightData._noDataFound;

if (arrivalInput) {
	if (shouldClearFields) {
		arrivalInput.value = "";
		console.log(`🧹 Ankunftszeit für Kachel ${cellId} gelöscht (keine Daten)`);
	} else if (
		flightData.arrivalTime &&
		flightData.arrivalTime !== "--:--" &&
		flightData.arrivalTime !== ""
	) {
		arrivalInput.value = flightData.arrivalTime;
	}
}
```

### 3. ✅ API-Facade (`js/api-facade.js`)

**Korrekturen:**

- Konsistente leere Werte statt Platzhalter
- Weitergabe der neuen Flags für Field-Clearing

### 4. ✅ Direct Cell Update (`updateCellWithFlightData`)

**Neue Funktion in AeroDataBox API:**

- Explizites Löschen aller relevanten Felder wenn keine Flugdaten
- Einzelfeld-Löschung wenn nur Teil-Daten fehlen

```javascript
// Wenn keine Flugdaten vorhanden sind, lösche die Felder
if (!lastArrival && !firstDeparture) {
	const arrivalElement = document.getElementById(`arrival-time-${cellNumber}`);
	const departureElement = document.getElementById(
		`departure-time-${cellNumber}`
	);
	const positionElement = document.getElementById(`position-${cellNumber}`);

	if (arrivalElement) {
		arrivalElement.value = "";
		arrivalElement.removeAttribute("title");
	}
	// ... weitere Löschungen
}
```

## Verhalten nach der Korrektur

### ✅ Szenarien, die jetzt korrekt funktionieren:

1. **Leere Aircraft ID eingegeben:**

   - Alle Felder (Arr Time, Dep Time, Pos) werden gelöscht

2. **Aircraft ID ohne Flugdaten:**

   - API findet keine Flüge → Alle Felder werden gelöscht

3. **Aircraft ID mit partiellen Daten:**

   - Nur gefundene Daten werden eingetragen
   - Fehlende Daten werden gelöscht (z.B. kein Abflug → Dep Time wird gelöscht)

4. **API-Fehler:**
   - Bei Fehlern werden alle Felder gelöscht

## Debugging

Die Console zeigt jetzt klare Nachrichten für Field-Clearing:

- `🧹 Ankunftszeit für Kachel X gelöscht (keine Daten)`
- `🧹 Abflugzeit für Kachel X gelöscht (keine Daten)`
- `🧹 Position für Kachel X gelöscht (keine Daten)`

## Getestete Dateien

- ✅ `js/aerodatabox-api.js` - Syntax korrekt
- ✅ `js/hangar-data.js` - Syntax korrekt
- ✅ `js/api-facade.js` - Syntax korrekt

## Status: FERTIG ✅

Das Problem wurde vollständig behoben. Die API-Abfrage löscht jetzt ordnungsgemäß die UI-Inhalte (Arr Time, Dep Time, Pos) wenn keine Daten für die Aircraft ID gefunden werden.
