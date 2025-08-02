# Fleet Database - Aktuelle Problembehebung

## 🔍 Aktuelle Diagnose

Basierend auf den Debug-Ausgaben:

### ✅ **Was funktioniert:**

- API-Datenladung erfolgreich (35 CLH + 6 LHX Flugzeuge)
- Fleet Database Manager initialisiert korrekt
- Erste Synchronisation wird gestartet

### ❌ **Identifizierte Probleme:**

1. **JSON Parse Fehler im Server-Status**

   ```
   "error": "JSON.parse: unexpected character at line 1 column 1 of the JSON data"
   ```

2. **HTTP 405 Fehler bei POST-Request**
   ```
   "Erst-Synchronisation fehlgeschlagen: 405"
   ```

## 🛠️ **Sofortige Lösungsschritte**

### Schritt 1: PHP-Server starten

```bash
cd /Users/steffen/Documents/GitHub/Hangarplaner-1
php -S localhost:8000
```

### Schritt 2: Test-Seite verwenden

Öffnen Sie: `debug/fleet-php-test.html`

### Schritt 3: Basis-Tests durchführen

1. "PHP-Datei prüfen" klicken
2. "JSON-Datei prüfen" klicken
3. "Server-Status" klicken

### Schritt 4: Bei Problemen

1. JSON-Datei zurücksetzen klicken
2. POST Request testen

## 🔧 **Mögliche Ursachen und Lösungen**

### Problem 1: Webserver läuft nicht

**Symptom**: HTTP 405 oder Connection refused
**Lösung**:

```bash
# Im Projektverzeichnis ausführen:
php -S localhost:8000
```

### Problem 2: Beschädigte JSON-Datei

**Symptom**: JSON Parse Fehler
**Lösung**:

- Test-Seite öffnen
- "JSON-Datei zurücksetzen" klicken

### Problem 3: CORS-Probleme

**Symptom**: CORS policy errors
**Lösung**:

- Über lokalen Server aufrufen (http://localhost:8000/fleet-database.html)
- Nicht direkt file:// verwenden

### Problem 4: Pfad-Probleme

**Symptom**: 404 Fehler bei PHP-Aufrufen
**Lösung**:

- Sicherstellen dass fleet-database.php im sync/ Verzeichnis liegt
- Pfade in fleet-database-manager.js prüfen

## 📋 **Debug-Checkliste**

1. **Webserver läuft**

   - [ ] `php -S localhost:8000` gestartet
   - [ ] http://localhost:8000 erreichbar

2. **Dateien vorhanden**

   - [ ] `sync/fleet-database.php` existiert
   - [ ] `sync/fleet-database.json` existiert und ist gültig

3. **Pfade korrekt**

   - [ ] fleet-database.html über http:// aufrufen
   - [ ] Nicht über file:// verwenden

4. **PHP-Funktionalität**
   - [ ] `debug/fleet-php-test.html` durchlaufen
   - [ ] Alle Tests erfolgreich

## 🚀 **Nächste Schritte**

1. **Starten Sie den PHP-Server:**

   ```bash
   cd /Users/steffen/Documents/GitHub/Hangarplaner-1
   php -S localhost:8000
   ```

2. **Öffnen Sie den PHP-Test:**
   http://localhost:8000/debug/fleet-php-test.html

3. **Führen Sie alle Tests durch**

   - Dokumentieren Sie die Ergebnisse
   - Bei Fehlern: Debug-Ausgaben kopieren

4. **Testen Sie die Fleet Database:**
   http://localhost:8000/fleet-database.html

5. **Führen Sie debugFleetDatabase() aus**

## 📞 **Support-Informationen**

Bei weiteren Problemen benötigen wir:

1. **Ausgaben vom PHP-Test** (alle Tests)
2. **Browser-Konsole Ausgaben** von fleet-database.html
3. **Webserver-Ausgaben** (Terminal wo php -S läuft)
4. **Betriebssystem und Browser** Version

## 🔗 **Debug-Ressourcen**

- **PHP-Test**: `debug/fleet-php-test.html`
- **Detaillierter Test**: `debug/fleet-debug-detailed.html`
- **Fleet Database**: `fleet-database.html`
- **Server-Endpoint**: `sync/fleet-database.php`

## ⚡ **Schnelltest**

```bash
# 1. Server starten
cd /Users/steffen/Documents/GitHub/Hangarplaner-1
php -S localhost:8000

# 2. In neuem Terminal:
curl http://localhost:8000/sync/fleet-database.php?action=status

# Erwartete Ausgabe: JSON mit Fleet Database Status
```
