# Fleet Database - HangarPlanner Erweiterung

## Übersicht

Die Fleet Database ist eine neue Unterseite des HangarPlanners, die es ermöglicht, die Flotten von CLH (Lufthansa CityLine) und LHX (Lufthansa Private Jet) über die AeroDataBox API abzurufen und tabellarisch darzustellen.

## Features

### 1. Datenquellen

- **CLH (Lufthansa CityLine)**: Regionale Flugzeuge der Lufthansa-Gruppe
- **LHX (Lufthansa Private Jet)**: Private Jets und Business Aviation

### 2. Funktionalitäten

- **Laden der Flottendaten**: Automatischer Abruf über AeroDataBox API
- **Filteroptionen**:
  - Airline-Filter (CLH/LHX/Alle)
  - Flugzeugtyp-Filter (dynamisch basierend auf geladenen Daten)
  - Suchfunktion (Registrierung, Typ, Modell)
- **Sortierung**: Klickbare Spaltenköpfe für alle Datenfelder
- **Export**: CSV-Export der gefilterten Daten
- **Integration**: Direkter Transfer von Flugzeugen zum HangarPlanner

### 3. Dargestellte Informationen

- Airline (mit Farbkodierung)
- Registrierung (Aircraft ID)
- Flugzeugtyp
- Modell
- Baujahr
- Triebwerke
- Aktionen (Details anzeigen, In HangarPlanner verwenden)

## Technische Implementierung

### Dateien

- `fleet-database.html` - Hauptseite der Fleet Database
- `js/fleet-database.js` - JavaScript-Funktionalität
- `css/fleet-database.css` - Spezifische Styles

### API-Integration

Die Fleet Database nutzt die AeroDataBox API über RapidAPI:

```javascript
// Beispiel API-Aufruf für CLH
const url =
	"https://aerodatabox.p.rapidapi.com/airlines/CLH/aircrafts?pageSize=50&pageOffset=0&withRegistrations=true";
```

### Rate Limiting

- 1.5 Sekunden Verzögerung zwischen API-Aufrufen
- Verhindert Überlastung der API

## Navigation

### Zugang zur Fleet Database

1. Öffnen Sie den HangarPlanner (index.html)
2. Klicken Sie auf das Menü-Symbol (») in der oberen rechten Ecke
3. Navigieren Sie zum Abschnitt "Fleet Database"
4. Klicken Sie auf "Fleet Database öffnen"

### Rückkehr zum HangarPlanner

- Klicken Sie auf "Zurück zum HangarPlanner" in der oberen linken Ecke der Fleet Database

## Verwendung

### 1. Daten laden

1. Klicken Sie auf "Daten laden"
2. Die API ruft automatisch die Flotten von CLH und LHX ab
3. Die Daten werden in der Tabelle angezeigt

### 2. Filtern und Suchen

- **Airline-Filter**: Wählen Sie CLH, LHX oder "Alle Airlines"
- **Flugzeugtyp-Filter**: Filtern Sie nach spezifischen Flugzeugtypen
- **Suchfeld**: Geben Sie Registrierung oder Flugzeugtyp ein

### 3. Sortierung

- Klicken Sie auf beliebige Spaltenüberschriften zum Sortieren
- Erneutes Klicken kehrt die Sortierrichtung um

### 4. Export

- Klicken Sie auf "Export" für CSV-Download der aktuell gefilterten Daten

### 5. Flugzeug im HangarPlanner verwenden

1. Klicken Sie auf das Plus-Symbol (➕) neben einem Flugzeug
2. Bestätigen Sie die Weiterleitung
3. Das Flugzeug wird automatisch in die erste freie Kachel des HangarPlanners eingefügt

## Design

Die Fleet Database folgt dem bestehenden HangarPlanner-Design:

- Industrielle Farbgebung (grau/orange)
- Konsistente Typografie und Spacing
- Responsive Design für verschiedene Bildschirmgrößen
- Wiederverwendung von UI-Komponenten (Wetter-Widget, Info-Widget)

## Fehlerbehebung

### Häufige Probleme

1. **API-Fehler**: Überprüfen Sie die Internetverbindung
2. **Keine Daten**: Warten Sie kurz und versuchen Sie erneut (Rate Limiting)
3. **Leere Tabelle**: Vergewissern Sie sich, dass die Filter nicht zu restriktiv sind

### Debug-Informationen

Öffnen Sie die Browser-Entwicklertools (F12) für detaillierte Logs:

- API-Aufrufe werden in der Konsole protokolliert
- Fehler werden mit spezifischen Fehlermeldungen angezeigt

## Erweiterungsmöglichkeiten

### Zukünftige Features

- Weitere Airlines hinzufügen
- Detailansicht für einzelne Flugzeuge
- Flughistorie und -statistiken
- Wartungshistorie und -status
- Flottenverfügbarkeit in Echtzeit

### API-Erweiterungen

- Integration weiterer Datenquellen
- Historische Flottendaten
- Technische Spezifikationen
- Aktuelle Standorte

## Support

Bei Problemen oder Fragen zur Fleet Database:

1. Überprüfen Sie die Browser-Konsole auf Fehlermeldungen
2. Stellen Sie sicher, dass alle JavaScript-Dateien geladen wurden
3. Prüfen Sie die Netzwerkverbindung für API-Aufrufe
