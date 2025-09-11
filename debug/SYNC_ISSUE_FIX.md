# Sync Issue Fix - Receiver Not Getting Updates

## Problem Identified

Die Sender-Logs zeigten, dass die Datensammlung perfekt funktionierte, aber die Empfänger erhielten keine Updates. Das Hauptproblem lag in der fehlenden Integration zwischen dem Sharing Manager und dem Server-Sync System.

## Root Cause

1. **Missing Project ID in Server Requests**: Das `storage-browser.js` System verwendete immer die Standard-Server-URL ohne Project-ID Parameter
2. **No Communication Between Systems**: Der Sharing Manager speicherte die Project-ID lokal, aber das Server-Sync System wusste nichts davon
3. **URL Generation Issue**: Sowohl normale als auch geteilte Projekte verwendeten dieselbe `data.json` Datei auf dem Server

## Fixed Issues

### 1. Server URL with Project ID

**File**: `js/storage-browser.js`

- **New Function**: `getServerUrl()` - Generiert die korrekte Server-URL mit Project-ID Parameter
- **Modified**: `syncWithServer()` - Verwendet jetzt `getServerUrl()` statt direkte URL
- **Modified**: `loadFromServer()` - Verwendet jetzt `getServerUrl()` für Datenabfrage

### 2. Improved Shared Project Loading

**File**: `js/sharing-manager.js`

- **Enhanced**: `loadSharedProject()` - Bessere Behandlung von leeren Server-Daten
- **Fixed**: Syntax-Fehler in der Shared Project Loading Logik

### 3. Enhanced Debug Information

**File**: `js/storage-browser.js`

- **Enhanced**: `debugSyncStatus()` - Zeigt jetzt Project-ID und effektive Server-URL

## Technical Details

### Server-Side Support

Der Server (`sync/data.php`) unterstützte bereits Project-IDs:

```php
$projectId = isset($_GET['project']) ? $_GET['project'] : null;
if ($projectId && preg_match('/^[a-zA-Z0-9_]+$/', $projectId)) {
    $dataFile = __DIR__ . '/shared_' . $projectId . '.json';
} else {
    $dataFile = __DIR__ . '/data.json';
}
```

### Client-Side Integration

Neue URL-Generierung berücksichtigt Project-ID:

```javascript
getServerUrl() {
    let url = this.serverSyncUrl;
    const projectId = window.sharingManager?.currentProjectId;
    if (projectId) {
        const separator = url.includes('?') ? '&' : '?';
        url = `${url}${separator}project=${encodeURIComponent(projectId)}`;
    }
    return url;
}
```

## Testing Instructions

### For Sender (Data Creator):

1. Öffne die Anwendung
2. Aktiviere "Live Synchronization" in der Sidebar
3. Kopiere die generierte Share URL
4. Fülle einige Kacheln mit Daten aus
5. Prüfe Console-Logs: "✅ Server-Sync erfolgreich (Project: [ID])"

### For Receiver (Data Consumer):

1. Öffne die Share URL in einem neuen Browser/Tab
2. Das System sollte automatisch:
   - Live Sync aktivieren
   - Die Project-ID aus der URL extrahieren
   - Daten vom projektspezifischen Server-Endpunkt laden
3. Prüfe Console-Logs: "✅ Daten vom Server geladen (Project: [ID])"

### Debug Commands:

```javascript
// Debug current sync status
window.debugSync();

// Check sharing manager status
window.sharingManager.showSyncStatus();

// Manual sync test
window.serverSync.manualSync();
```

## Expected Behavior After Fix

### Normal Sync (ohne Project-ID):

- URL: `https://hangarplanner.de/sync/data.php`
- Datei: `sync/data.json`

### Shared Sync (mit Project-ID):

- URL: `https://hangarplanner.de/sync/data.php?project=HangarPlan_1720094534789_abc123def`
- Datei: `sync/shared_HangarPlan_1720094534789_abc123def.json`

## Verification Points

1. **Sender Side**: Console should show project-specific sync messages
2. **Receiver Side**: Should automatically load shared project data
3. **Real-time Updates**: Changes on sender should appear on receiver within 30-120 seconds
4. **Bidirectional Sync**: Both users can edit and see each other's changes

## Rollback Plan

If issues occur, previous version can be restored by:

1. Removing `getServerUrl()` function
2. Reverting `syncWithServer()` and `loadFromServer()` to use `this.serverSyncUrl` directly
3. System will fall back to normal sync behavior

## Performance Impact

- Minimal: Only adds URL parameter processing
- No additional network requests
- Same caching and optimization strategies apply

---

## Addendum: Mode policy update (no write-only mode)

### Summary
The application now supports exactly three sync modes:
- Standalone: local only; no server reads or writes
- Read-only (Sync): reads from server; client edits do not write to server
- Read/Write (Master): writes to server and reads from server; multi-master supported

Write-only (Read OFF, Write ON) is no longer a supported mode. When Write is enabled, Read should also be enabled to ensure proper convergence and visibility of changes across clients.

### Implementation notes
- Client-side gating remains in place:
  - `initSync()` only loads from server at startup if reads are allowed
  - In Master mode, periodic read-back runs only when reads are enabled
- Server-side write enforcement remains unchanged (`X-Sync-Role: master` and session headers required)

### Verification
1) Read-only (Sync)
   - Enable Read ON, Write OFF
   - Edit a tile field; expect no POST to `sync/data.php`
   - UI prevents edits and shows read-only state
2) Read/Write (Master)
   - Enable Read ON, Write ON
   - Edit a tile field; a write occurs via `serverSync.syncWithServer()`
   - Changes persist and appear on a read-only client
3) Standalone
   - Disable both toggles; edits only affect local state; no server traffic
