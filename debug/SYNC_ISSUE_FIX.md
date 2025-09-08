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

## Addendum: Strict Write-only mode (Read OFF)

### Summary
To support a true Write-only configuration (Read OFF, Write ON), the client now strictly gates server reads by the Read Data toggle:
- Startup initial load is skipped when Read is OFF
- In Master mode, periodic read-back is disabled when Read is OFF
- Manual Sync remains available in Write-only and performs POST-only syncs (no GET)
- Reset screen does not purge localStorage; it clears UI fields (including Arr/Dep dataset.iso) and suppresses local rehydrate for ~10s to avoid immediate repopulation

### Implementation
- storage-browser.js
  - Added `canReadFromServer()` to determine if reads are allowed
  - `initSync()` only loads from server at startup if `canReadFromServer()` is true
  - `startMasterMode()` enables the periodic read-back loop only when `canReadFromServer()` is true
- hangar-ui.js
  - Phase 4 initial load is skipped when Read is OFF
- hangar.js
  - Reset screen cancels pending local rehydrate and sets a short suppression window; clears Arr/Dep values and their `dataset.iso` attributes; resets Status/Tow to neutral; keeps Hangar Position

### Verification
1) Write-only (Read OFF, Write ON)
   - Load app: no GET to `sync/data.php`
   - Use Reset screen: tiles remain cleared after several seconds; no GETs fired
   - Edit tiles: POSTs with `X-Sync-Role: master` appear; no GETs
   - Manual Sync: sends POST-only
2) Regression check
   - Read-only (Read ON, Write OFF): still polls and loads; no POSTs
   - Master (Read ON, Write ON): reads+posts as before
   - Standalone (both OFF): no server traffic
