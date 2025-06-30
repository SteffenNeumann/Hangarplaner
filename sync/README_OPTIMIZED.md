# Hangar Planner - Server Synchronisation (Optimiert)

## Überblick

Dieses Verzeichnis enthält die optimierte Server-Synchronisationsfunktionen für den Hangar Planner. Die Synchronisation ermöglicht das automatische Speichern und Laden von Projektdaten über einen Webserver.

## Dateien

### `data.php`

- **Zweck**: Haupt-API-Endpunkt für die Datensynchronisation
- **Funktionen**:
  - GET: Lädt gespeicherte Projektdaten
  - POST: Speichert neue Projektdaten
  - OPTIONS: CORS-Preflight-Unterstützung

### `data.json`

- **Zweck**: Gespeicherte Projektdaten (wird automatisch erstellt)
- **Format**: JSON-Datenstruktur mit Metadaten, Einstellungen und Kacheldaten

## Installation

1. Kopieren Sie den `sync`-Ordner auf Ihren Webserver
2. Stellen Sie sicher, dass PHP auf dem Server läuft
3. Setzen Sie Schreibberechtigungen für das `sync`-Verzeichnis:
   ```bash
   chmod 755 sync/
   chmod 644 sync/data.php
   ```

## Konfiguration

### Automatische Konfiguration

Die Anwendung erkennt automatisch die Server-URL basierend auf dem aktuellen Standort der Webanwendung.

### Manuelle Konfiguration

Falls die automatische Erkennung nicht funktioniert:

1. Öffnen Sie die Sidebar der Anwendung
2. Aktivieren Sie "Auto-Sync"
3. Die URL wird automatisch als `[Ihre-Domain]/sync/data.php` gesetzt

## Sicherheit

### Produktionsumgebung

- Debug-Modus ist standardmäßig deaktiviert
- Fehlermeldungen werden nicht an den Client gesendet
- Dateigröße ist auf 5MB begrenzt

### Debug-Modus

Für Entwicklung/Debugging:

- Fügen Sie `?debug=true` an die URL an
- Beispiel: `https://ihre-domain.com/sync/data.php?debug=true`

## Datenstruktur

```json
{
	"metadata": {
		"projectName": "Projektname",
		"timestamp": 1703123456789,
		"lastSaved": "2023-12-21T10:30:00.000Z"
	},
	"settings": {
		"tilesCount": 8,
		"secondaryTilesCount": 4,
		"layout": 4
	},
	"tilesData": [
		{
			"id": 1,
			"position": "A1",
			"aircraftId": "D-ABCD",
			"status": "ready",
			"notes": "Bemerkungen"
		}
	]
}
```

## Optimierungen

### Version 2.0 Verbesserungen:

- ✅ Verbesserte Fehlerbehandlung
- ✅ Dateigröße-Limits
- ✅ JSON-Validierung
- ✅ Produktions-Sicherheit
- ✅ Optimierte Synchronisation (30s statt 5s)
- ✅ Bessere Netzwerk-Fehlerbehandlung
- ✅ Entfernung nicht benötigter Funktionen

### Entfernte Legacy-Funktionen:

- ❌ `refreshFileList()` - nicht benötigt für Server-Sync
- ❌ Redundante Datensammlungs-Methoden
- ❌ Veraltete UI-Update-Routinen

## Fehlerbehebung

### Häufige Probleme:

1. **Keine Schreibberechtigung**

   ```bash
   chmod 755 sync/
   ```

2. **CORS-Fehler**

   - Prüfen Sie die Header-Konfiguration in `data.php`
   - Bei Bedarf spezifische Domains eintragen

3. **JSON-Fehler**

   - Aktivieren Sie Debug-Modus: `?debug=true`
   - Prüfen Sie die Browser-Konsole auf Fehler

4. **Synchronisation funktioniert nicht**
   - Prüfen Sie die Netzwerk-Registerkarte in den Entwicklertools
   - Stellen Sie sicher, dass Auto-Sync aktiviert ist

## Logs

### Server-Logs (PHP)

- Bei Fehlern wird eine JSON-Antwort mit Fehlerbeschreibung gesendet
- Debug-Modus zeigt detaillierte PHP-Fehler

### Client-Logs (JavaScript)

- Alle Sync-Aktivitäten werden in der Browser-Konsole protokolliert
- Fehlgeschlagene Requests werden als Warnungen angezeigt
