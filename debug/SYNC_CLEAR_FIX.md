# Sync Clear Propagation Fix

**Date:** 2025-10-07  
**Commit:** 8e871fd  
**Issue:** Empty field clears from Master not propagating to Read-only/Sync receivers

---

## Problem Identified

### Symptoms
When a user in **Master mode** cleared a field (manually or via trashcan), the **Read-only/Sync receivers** did not see the cleared state. The field remained populated on the receiver even though the Master had emptied it.

### Root Cause

**Location 1: Legacy Sync** (`js/storage-browser.legacy.js:207-209`)
```javascript
// Do not overwrite non-empty local value with empty incoming
var cur = ('value' in el) ? (el.value||'').trim() : (el.textContent||'').trim();
if ((val==null || String(val).trim()==='') && cur) return false;
```

**Location 2: Modern Sync** (`js/storage-browser.js:2084-2093`)
```javascript
// incoming is empty → clear if from other session or local field already empty
if (fromOtherSession || current.length === 0) {
    aircraftInput.value = '';
    // ... clear the field
} else {
    // SKIP clearing - this was only implemented for aircraftId
}
```

### Why It Was Added
This protection was originally added to:
- Prevent accidental data loss from incomplete server responses
- Guard against race conditions during initial sync
- Protect user data from being wiped by missing/corrupt server data

### The Problem
The protection couldn't distinguish between:
1. **Authoritative clears**: Master intentionally emptied the field → **Should apply**
2. **Missing data**: Server response incomplete/corrupted → **Should protect**

Result: All empty values were blocked if local field had content, breaking the fundamental sync expectation that Master's state is authoritative.

---

## Solution Implemented

### Key Insight
The server includes `updatedBySession` metadata in each tile, which identifies who made the last change. By comparing this with the local session ID, we can distinguish:

- **Authoritative clear**: `updatedBySession` is set AND different from local session → **Allow empty value**
- **Missing/corrupt data**: `updatedBySession` is missing or same as local session → **Protect local data**

### Changes Made

#### 1. Legacy Sync (`js/storage-browser.legacy.js`)

**Modified `setField` function:**
```javascript
// Get current session ID for comparison
var mySessionId = (typeof legacy.getSessionId === 'function') ? legacy.getSessionId() : '';

function setField(id, val, updatedBySession){
  // ... existing checks ...
  
  // Allow authoritative clears from other sessions to overwrite non-empty local values
  var cur = ('value' in el) ? (el.value||'').trim() : (el.textContent||'').trim();
  var fromOtherSession = !!(updatedBySession && mySessionId && updatedBySession !== mySessionId);
  
  // Do not overwrite non-empty local value with empty incoming 
  // UNLESS it's from another session (authoritative clear)
  if ((val==null || String(val).trim()==='') && cur && !fromOtherSession) return false;
  // ... rest of function ...
}
```

**Updated `applyTile` to pass session metadata:**
```javascript
var applyTile = function(t){
  var id = parseInt(t && t.tileId,10)||0; if (!id) return;
  var updatedBy = (t && t.updatedBySession) ? t.updatedBySession : '';
  if (t.aircraftId!=null) applied += setField('aircraft-'+id, t.aircraftId, updatedBy)?1:0;
  if (t.hangarPosition!=null) applied += setField('hangar-position-'+id, t.hangarPosition, updatedBy)?1:0;
  // ... all other fields ...
};
```

#### 2. Modern Sync (`js/storage-browser.js`)

**Updated field handlers to use same logic as `aircraftId`:**

Each field now follows this pattern:
```javascript
const fromOtherSession = !!(tileData.updatedBySession) &&
    (typeof this.getSessionId === 'function') &&
    (tileData.updatedBySession !== this.getSessionId());

if (!canApplyField(fid, inputElement)) {
    // skip while locally editing/fenced
} else if (newVal.length > 0 || fromOtherSession || oldValue.length === 0) {
    // Apply if:
    // - non-empty incoming, OR
    // - authoritative clear from other session, OR
    // - local already empty
    inputElement.value = newVal;
    // ... update storage and dispatch events ...
}
```

**Fields updated:**
- ✅ `aircraftId` (already had this logic)
- ✅ `hangarPosition`
- ✅ `position`
- ✅ `notes`
- ✅ `arrivalTime`
- ✅ `departureTime`
- ✅ `status` (uses neutral default, less affected)
- ✅ `towStatus` (uses neutral default, less affected)

---

## Protection Preserved

The fix maintains important safeguards:

### Still Protected Against:
1. **Incomplete server responses** without session metadata → local data kept
2. **Same-session echoes** (your own writes bouncing back) → no unnecessary clears
3. **Race conditions** during typing/editing → write fences still active
4. **Focused fields** → no caret jumps or interruptions
5. **Hard locks** from recent local edits → 15s protection window

### Now Allows:
1. **Authoritative clears** from other Master sessions → properly synced
2. **Manual deletions** via trashcan → visible to all receivers
3. **Intentional field emptying** → respected across all clients

---

## Testing Checklist

### Verify Clear Propagation
1. Open **two browsers/devices**
2. Set one to **Master**, other to **Read-only (Sync)**
3. In Master: populate fields in a tile
4. Confirm Sync receiver sees the populated fields
5. In Master: clear the fields (delete content or use trashcan)
6. **Expected:** Sync receiver should see empty fields within ~3 seconds
7. **Before fix:** Sync receiver kept old values
8. **After fix:** Sync receiver properly reflects cleared state ✅

### Verify Protection Still Works
1. Start with **empty server** (fresh data.json or missing updatedBySession)
2. Populate fields locally
3. Trigger a sync with incomplete/missing server data
4. **Expected:** Local data should be preserved (not wiped)
5. **Result:** Protection still active for non-authoritative updates ✅

### Multi-Master Test
1. Open **two Masters** simultaneously
2. Edit same field in both (back and forth)
3. **Expected:** 
   - Recent edits protected by write fences
   - After typing stops, last-write-wins
   - Clears from either Master propagate to both
4. **Result:** Multi-master conflict resolution unaffected ✅

---

## Server Requirements

The fix relies on the server including `updatedBySession` in tile metadata:

```json
{
  "primaryTiles": [
    {
      "tileId": 1,
      "aircraftId": "D-EABC",
      "status": "ready",
      "updatedAt": "2025-10-07T08:00:00Z",
      "updatedBy": "Alice",
      "updatedBySession": "abc123def"  // ← Required for authoritative clear detection
    }
  ]
}
```

**Current server implementation** (`sync/data.php`) already provides this:
- Line 353: `$serverPrimaryMap[$tid]['updatedBySession'] = $sessionId;`
- Line 433: `$serverSecondaryMap[$tid]['updatedBySession'] = $sessionId;`

---

## Backward Compatibility

### Older Servers (without updatedBySession)
- Falls back to previous behavior (empty values blocked)
- No errors or crashes
- Users should update server to get full fix

### Mixed Client Versions
- Old clients: ignore session check (empty blocked as before)
- New clients: check session when available
- No conflicts between versions

### Migration Path
1. Update server first (already done in current version)
2. Update clients (this fix)
3. Both old and new clients can coexist safely

---

## Related Documentation

- Original issue analysis: Session context discussion
- Multi-master design: `docs/SYNC-FUNCTION-DESIGN.md`
- Sync modes FAQ: `docs/SYNC-MODE-FAQ.md`
- Server implementation: `sync/data.php` lines 335-437

---

## Future Considerations

### Potential Enhancements
1. **Visual feedback** for authoritative clears in UI
2. **Audit trail** showing who cleared what field
3. **Undo mechanism** for accidental clears
4. **Conflict prompt** for simultaneous clear vs. edit

### Known Limitations
1. Status/towStatus fields use "neutral" default, so empty vs. neutral is ambiguous
2. Very rapid Master switches might have <1s window where clears race
3. Offline Master coming back online might have stale clears (resolved by timestamp)

---

## Commit Details

**Branch:** newversion  
**SHA:** 8e871fd  
**Files Changed:**
- `js/storage-browser.js` (modern implementation)
- `js/storage-browser.legacy.js` (fallback implementation)
- `gitinfo.json` (auto-updated)

**Lines Modified:** 71 insertions, 33 deletions

---

**Issue Status:** ✅ RESOLVED
