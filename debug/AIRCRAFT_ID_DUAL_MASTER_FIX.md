# Aircraft ID Flip-Back Fix in Dual Master Mode

**Date:** 2025-10-09  
**Issue:** Aircraft ID values flip back to original value when second Master user attempts to change them  
**File Modified:** `js/storage-browser.js`

## Problem Description

In dual Master mode (two or more users with Master permissions editing simultaneously), when:
1. Master User 1 sets an aircraft ID (e.g., "HB-ABC")
2. Master User 2 attempts to change the same aircraft ID to a different value (e.g., "HB-XYZ")
3. The value would flip back to "HB-ABC" after Master User 2's change

### Root Cause

The issue was caused by the **write fence mechanism** that prevents oscillation in multi-master scenarios:

1. When Master User 1 edits aircraft-# field, a 20-second write fence is created locally
2. The fence is stored in `this._pendingWrites[fieldId]` with timestamp
3. When Master User 2's update arrives from the server, the `canApplyField()` function checks:
   - Line 2031: `if (this._isWriteFenceActive(fid)) return false;`
4. If Master User 1's local write fence is still active (within 20 seconds), it **rejects** the incoming value from Master User 2
5. This causes the value to "flip back" to Master User 1's original value

**Key insight:** The write fence is **session-local** but was blocking updates from **other Masters** who have authority to write.

## Solution

The fix implements special handling for aircraft ID fields in dual Master scenarios:

### Changes Made

#### 1. Updated `canApplyField()` function (lines 2009-2043)

**Added parameter:**
```javascript
const canApplyField = (fid, el, fromOtherSession = false) => {
```

**Added dual Master detection:**
```javascript
// DUAL MASTER FIX: For aircraft ID fields, skip write fence check if update from another Master
const isAircraftField = /^aircraft-\d+$/.test(fid);
const isDualMasterUpdate = isAircraftField && fromOtherSession && this._isMasterMode && this._isMasterMode();
if (!isDualMasterUpdate) {
    // Skip when a write fence is active for this field (except for aircraft ID from other Master)
    if (typeof this._isWriteFenceActive === 'function' && this._isWriteFenceActive(fid)) return false;
    if (recentlyEdited(fid)) return false;
}
```

**Logic:**
- Detect if field is an aircraft ID field (`aircraft-1`, `aircraft-2`, etc.)
- Check if update is from another session (`fromOtherSession = true`)
- Check if we're in Master mode
- If all conditions met → **bypass** write fence and recent edit checks
- Otherwise → **enforce** write fence protection (normal behavior)

#### 2. Updated aircraft ID application logic (lines 2051-2097)

**Pass fromOtherSession flag:**
```javascript
if (!canApplyField(fid, aircraftInput, fromOtherSession)) {
    // skip while locally editing/fenced (but not if update from other Master)
```

**Clear local write fence when accepting other Master's update:**
```javascript
// DUAL MASTER FIX: Clear local write fence for this field if applied from another Master
if (fromOtherSession && this._pendingWrites && this._pendingWrites[fid]) {
    delete this._pendingWrites[fid];
    console.log(`🧹 Cleared local write fence for ${fid} (accepted other Master's update)`);
}
```

**Enhanced logging:**
```javascript
console.log(`✈️ Aircraft ID gesetzt: ${tileId} = ${current} → ${incoming}${fromOtherSession ? ' (von anderem Master)' : ''}`);
```

## How It Works Now

### Scenario: Dual Master Aircraft ID Change

1. **Master User 1** sets aircraft-1 to "HB-ABC"
   - Write fence created locally for `aircraft-1` (20 seconds)
   - Value synced to server

2. **Master User 2** changes aircraft-1 to "HB-XYZ"
   - Value synced to server
   - Server timestamp updates

3. **Master User 1** receives update from server
   - `fromOtherSession = true` (different session ID)
   - `isAircraftField = true` (`aircraft-1` matches pattern)
   - `isDualMasterUpdate = true` (all conditions met)
   - **Write fence bypassed** for this update
   - Local write fence **cleared** for `aircraft-1`
   - Value updated to "HB-XYZ"
   - ✅ **No flip-back!**

## Protection Maintained

The fix maintains important protections:

### ✅ Still Protected:
- **Active typing**: User actively editing the field → update blocked
- **Hard locks**: `window.__fieldApplyLockUntil` still enforced
- **Focused fields**: Element with focus not overwritten (prevents caret jump)
- **Non-aircraft fields**: Other fields still use full write fence protection
- **Single Master**: No change in single Master behavior

### ✅ New Behavior:
- **Dual Master aircraft ID**: Updates from other Master bypass write fence
- **Last-write-wins**: The most recent Master's update persists
- **Auto-convergence**: Both Masters converge to the same value

## Testing Recommendations

### Test Case 1: Sequential Aircraft ID Changes
1. Master User 1: Set aircraft-1 to "HB-AAA"
2. Master User 2: Change aircraft-1 to "HB-BBB"
3. **Expected:** Both see "HB-BBB", no flip-back

### Test Case 2: Rapid Concurrent Changes
1. Master User 1: Set aircraft-1 to "HB-CCC"
2. Master User 2: Simultaneously set aircraft-1 to "HB-DDD"
3. **Expected:** Last write wins, both converge to same value

### Test Case 3: Other Fields Not Affected
1. Master User 1: Edit notes-1 field
2. Master User 2: Edit notes-1 field
3. **Expected:** Write fences still protect, no unintended overwrites

### Test Case 4: Active Typing Protection
1. Master User 1: Start typing in aircraft-1 field
2. Master User 2: Change aircraft-1 value
3. **Expected:** Master User 1's typing not interrupted

## Debug/Monitoring

Look for these console logs:

```
✈️ Aircraft ID gesetzt: 1 = HB-ABC → HB-XYZ (von anderem Master)
🧹 Cleared local write fence for aircraft-1 (accepted other Master's update)
```

These indicate the dual Master fix is working correctly.

## Files Modified

- `js/storage-browser.js`
  - Lines 2009-2043: `canApplyField()` function
  - Lines 2051-2097: Aircraft ID field application logic

## Related Configuration

- Write fence duration: `_writeFenceMs = 20000` (20 seconds) - line 30
- Session comparison: `getSessionId()` function
- Master mode check: `_isMasterMode()` function - lines 568-574

## Regression Risk: LOW

- Changes are isolated to aircraft ID field only
- Only affects dual Master mode (rare scenario)
- All existing protections maintained for other fields
- No changes to single Master or Sync mode behavior

## Future Considerations

If similar issues occur with other fields, the same pattern can be applied:
1. Add field pattern detection (e.g., `isNotesField`, `isPositionField`)
2. Update `canApplyField()` to handle that field type
3. Clear local write fence when accepting update from another Master
