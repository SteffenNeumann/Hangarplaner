# Display Options Migration - Von localStorage zu data.json

## Übersicht der Änderungen

Diese Migration verschiebt alle Display Options von localStorage in die zentrale `data.json` Datei, die über das `sync/data.php` Script verwaltet wird.

## ✅ Durchgeführte Änderungen

### 1. **data.json Struktur erweitert**

- Hinzugefügt: `settings.displayOptions` Sektion
- Standardwerte gesetzt:
  ```json
  {
  	"tilesCount": 8,
  	"secondaryTilesCount": 4,
  	"layout": 4,
  	"darkMode": false,
  	"viewMode": false,
  	"zoomLevel": 100
  }
  ```

### 2. **Neue JavaScript-Dateien erstellt**

#### `js/display-options.js`

- ✅ Vollständige Verwaltung der Display Options
- ✅ Lädt/speichert in `data.json` via `sync/data.php`
- ✅ Setzt alle Event-Listener für UI-Elemente
- ✅ Wendet Einstellungen automatisch an (Dark Mode, Zoom, etc.)

#### `js/localStorage-migration.js`

- ✅ Migriert bestehende localStorage-Daten automatisch
- ✅ Bereinigt veraltete localStorage-Einträge
- ✅ Warnt vor veralteten localStorage-Aufrufen (im Development-Modus)

### 3. **HTML-Anpassungen**

- ✅ Display Options Sektion als standardmäßig geöffnet markiert (`open` Klasse)
- ✅ Neue Scripts eingebunden
- ✅ Standardwerte in HTML entsprechen den Anforderungen

### 4. **Bestehende Dateien angepasst**

#### `js/hangar-ui.js`

- ✅ localStorage-Funktionen als DEPRECATED markiert
- ✅ Funktionen geben Warnungen aus und leiten auf neues System um

#### `js/hangar-events.js`

- ✅ Alte Event-Handler für Display Options auskommentiert
- ✅ Konflikte mit neuen Event-Handlern vermieden

## 🎯 Funktionsweise

### Beim Seitenaufruf:

1. `display-options.js` lädt Einstellungen von `sync/data.php`
2. Falls keine Daten vorhanden: Standardwerte werden verwendet
3. UI wird mit geladenen/Standard-Werten aktualisiert
4. Einstellungen werden sofort angewendet (Dark Mode, Zoom, etc.)

### Bei Änderungen:

1. Event-Listener in `display-options.js` erfassen Änderungen
2. Neue Werte werden gesammelt und validiert
3. Daten werden an `sync/data.php` gesendet
4. Bei Erfolg: Bestätigung angezeigt

### Migration:

1. `localStorage-migration.js` prüft bei jedem Seitenaufruf auf alte Daten
2. Falls vorhanden: Automatische Übertragung ins neue System
3. Alte localStorage-Einträge werden bereinigt
4. Warnungen bei veralteten Funktionsaufrufen

## 📂 Betroffene Dateien

### Neue Dateien:

- ✅ `js/display-options.js`
- ✅ `js/localStorage-migration.js`

### Geänderte Dateien:

- ✅ `data.json` - Erweiterte Struktur
- ✅ `index.html` - Script-Einbindungen, `open` Klasse
- ✅ `js/hangar-ui.js` - DEPRECATED-Markierungen
- ✅ `js/hangar-events.js` - Alte Event-Handler auskommentiert

### Unveränderte wichtige Dateien:

- ✅ `sync/data.php` - Funktioniert bereits perfekt
- ✅ CSS-Dateien - Keine Änderungen nötig
- ✅ Andere JS-Module - Bleiben unverändert

## 🔧 Standardwerte (wie gewünscht)

| Einstellung     | Standardwert | Beschreibung                   |
| --------------- | ------------ | ------------------------------ |
| Primary Tiles   | 8            | Anzahl der Hauptkacheln        |
| Secondary Tiles | 4            | Anzahl der Nebenkacheln        |
| Layout          | 4 Columns    | Spaltenlayout                  |
| Dark Mode       | Light        | Hell-Modus als Standard        |
| Ansicht         | Kachel       | Kachel-Ansicht (nicht Tabelle) |
| Display Zoom    | 100%         | Standard-Zoom-Level            |

## 🚀 Vorteile der neuen Lösung

1. **Zentrale Datenhaltung**: Alle Einstellungen in einer Datei
2. **Server-Synchronisation**: Daten bleiben über Sessions hinweg erhalten
3. **Keine localStorage-Konflikte**: Saubere Trennung der Speicherbereiche
4. **Automatische Migration**: Bestehende Nutzer verlieren keine Einstellungen
5. **Wartbarkeit**: Klarer Code ohne verstreute localStorage-Aufrufe
6. **Debugging**: Einfache Nachverfolgung von Einstellungsänderungen

## ⚡ Migration für Benutzer

- **Transparenz**: Migration erfolgt automatisch beim ersten Seitenaufruf
- **Keine Datenverluste**: Bestehende Einstellungen werden übertragen
- **Fallback**: Bei Fehlern werden Standardwerte verwendet
- **Performance**: Einmalige Migration, danach optimierte Ladezeiten

## 🛠️ Entwickler-Hinweise

### Neue Einstellungen hinzufügen:

1. Standardwert in `display-options.js` defaults hinzufügen
2. UI-Element in HTML hinzufügen
3. Event-Listener in `setupEventListeners()` ergänzen
4. Sammlung in `collectFromUI()` erweitern
5. Anwendung in `applySettings()` implementieren

### Debugging:

- Console-Logs zeigen alle Display Options-Aktivitäten
- Deprecated-Warnungen bei veralteten localStorage-Aufrufen
- Netzwerk-Tab zeigt sync/data.php Requests

---

**Status: ✅ KOMPLETT IMPLEMENTIERT**  
**Datum: 1. Juli 2025**  
**Kompatibilität: Vollständig rückwärtskompatibel**
