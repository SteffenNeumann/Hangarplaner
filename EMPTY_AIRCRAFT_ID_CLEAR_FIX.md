# Korrektur: Leere Aircraft ID Felder löschen zugehörige Flugdaten

## Problem

Wenn eine Aircraft ID aus einer Kachel entfernt wird (Feld wird geleert), bleiben die zugehörigen Flugdaten (Arr Time, Dep Time, Pos) in der Kachel bestehen, obwohl sie gelöscht werden sollten.

## Implementierte Lösung

### 1. ✅ Neue Event-Handler Funktion (`js/hangar-events.js`)

**Neue Funktion hinzugefügt:**

```javascript
handleAircraftIdChange(aircraftInputId, newValue) {
    // Extrahiere Cell ID aus der Input ID
    const cellId = aircraftInputId.replace("aircraft-", "");

    // Wenn Aircraft ID leer oder nur Whitespace ist, lösche alle zugehörigen Flugdaten
    if (!newValue || newValue.trim() === "") {
        // Lösche Arrival Time, Departure Time, Position
        // Speichere gelöschte Werte in localStorage
    }
}
```

**Funktionalität:**

- Überwacht Änderungen an Aircraft ID Feldern
- Prüft ob das Feld geleert wurde (leer oder nur Whitespace)
- Löscht automatisch alle zugehörigen Flugdaten:
  - `arrival-time-{cellId}`
  - `departure-time-{cellId}`
  - `position-{cellId}` oder `hangar-position-{cellId}`
- Speichert die Änderungen in localStorage

### 2. ✅ Event Manager Integration (`js/improved-event-manager.js`)

**Erweiterte Event-Handler:**

- `blur` Event: Wird ausgelöst wenn Aircraft ID Feld verlassen wird
- `change` Event: Wird ausgelöst bei Änderungen am Aircraft ID Feld

**Korrekturen in zwei Event-Handler-Bereichen:**

```javascript
// In attachEventHandlersToElement()
if (event.target.id.startsWith("aircraft-")) {
	if (
		window.hangarEvents &&
		typeof window.hangarEvents.handleAircraftIdChange === "function"
	) {
		window.hangarEvents.handleAircraftIdChange(
			event.target.id,
			event.target.value
		);
	}
}

// In registerHandlerForElement()
// Gleiche Logik implementiert
```

### 3. ✅ API Integration bereits vorhanden

Die bestehenden API-Korrekturen funktionieren weiterhin:

- `_clearFields` Flag wird gesetzt wenn keine Aircraft ID vorhanden
- `updateAircraftData()` behandelt leere Aircraft IDs korrekt
- UI-Update-Logik löscht Felder bei Clear-Flags

## Verhalten nach der Korrektur

### ✅ Neue Szenarien, die jetzt funktionieren:

1. **Aircraft ID wird gelöscht (Feld geleert):**

   - Alle Flugdaten (Arr Time, Dep Time, Pos) werden automatisch gelöscht
   - Änderungen werden in localStorage gespeichert

2. **Aircraft ID wird mit Whitespace geleert:**

   - Auch leere Strings mit Leerzeichen werden erkannt
   - Flugdaten werden gelöscht

3. **Verlassen des Aircraft ID Feldes:**

   - Prüfung wird sowohl bei `change` als auch bei `blur` Events durchgeführt
   - Doppelte Sicherheit für alle Interaktionsarten

4. **Bestehende API-Integration:**
   - API-Abfragen für leere Aircraft IDs funktionieren weiterhin
   - Konsistentes Verhalten zwischen manueller Löschung und API-Response

## Debugging

Die Console zeigt klare Nachrichten für Field-Clearing:

- `🔄 Aircraft ID geändert: aircraft-X = ""`
- `🧹 Aircraft ID für Kachel X ist leer - lösche Flugdaten`
- `🧹 Ankunftszeit für Kachel X gelöscht`
- `🧹 Abflugzeit für Kachel X gelöscht`
- `🧹 Position für Kachel X gelöscht`

## Getestete Dateien

- ✅ `js/hangar-events.js` - Neue Funktion hinzugefügt
- ✅ `js/improved-event-manager.js` - Event-Handler erweitert
- ✅ `js/aerodatabox-api.js` - Bereits korrekt (vorherige Korrekturen)

## Status: FERTIG ✅

Das Problem wurde vollständig behoben. Wenn eine Aircraft ID aus einer Kachel entfernt wird, werden automatisch alle zugehörigen Flugdaten (Arr Time, Dep Time, Pos) gelöscht. Dies funktioniert sowohl bei manueller Löschung als auch bei API-Aufrufen mit leeren Aircraft IDs.
