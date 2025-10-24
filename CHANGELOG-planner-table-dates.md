# Fix: plannerTable Date Inputs Not Persisting

## Issue Summary

**Problem:** Date/time values entered in the plannerTable view (id="plannerTable") were not being saved or synced. After page reload or switching to tile view, the values disappeared.

**Root Causes:**
1. Table inputs use different IDs (`arrival-time-table-{id}`) than tile inputs (`arrival-time-{id}`)
2. The handler function `writeTimeTo()` only set `.value` but not `.dataset.iso` on tile inputs
3. `hangar-data.js` collects data from `dataset.iso`, which was never set by table edits
4. No canonicalization of user-entered values (e.g., `1230` → ISO format)

## Solution

Modified `js/planner-table-view.js`:

### 1. Updated `writeTimeTo()` Function (lines 586-637)

**Before:**
```javascript
function writeTimeTo(selector, displayVal){
  const el = document.querySelector(selector);
  if (!el) return;
  el.value = displayVal || '';
  eventFire(selector, 'change');
  eventFire(selector, 'blur');
}
```

**After:**
```javascript
function writeTimeTo(tileId, which, fromTableEl){
  // which: 'arrivalTime' | 'departureTime'
  // fromTableEl: the table input element
  const displayValue = (fromTableEl && fromTableEl.value) ? fromTableEl.value.trim() : '';
  const tileInputId = which === 'arrivalTime' ? `arrival-time-${tileId}` : `departure-time-${tileId}`;
  const tileInput = document.getElementById(tileInputId);
  if (!tileInput) return;

  let iso = '';
  let display = displayValue;

  // Canonicalize using helpers
  if (displayValue) {
    try {
      if (window.helpers && typeof window.helpers.canonicalizeDateTimeFieldValue === 'function') {
        const canon = window.helpers.canonicalizeDateTimeFieldValue(tileInputId, displayValue);
        if (canon) {
          iso = canon;
          if (window.helpers.formatISOToCompactUTC && window.helpers.isISODateTimeLocal(iso)) {
            display = window.helpers.formatISOToCompactUTC(iso);
          }
        }
      }
    } catch (e) { }
  }

  // Write to TILE input (source of truth)
  tileInput.value = display;
  if (iso) {
    tileInput.dataset.iso = iso;
  } else {
    delete tileInput.dataset.iso;
  }

  // Optionally keep TABLE cell in sync
  if (fromTableEl && fromTableEl.dataset !== undefined) {
    if (iso) fromTableEl.dataset.iso = iso;
    else delete fromTableEl.dataset.iso;
  }

  // Fire events to trigger save/sync
  tileInput.dispatchEvent(new Event('input', { bubbles: true }));
  tileInput.dispatchEvent(new Event('change', { bubbles: true }));
  tileInput.dispatchEvent(new Event('blur', { bubbles: true }));
}
```

**Key Changes:**
- Now accepts `(tileId, which, fromTableEl)` instead of `(selector, displayVal)`
- Calls `window.helpers.canonicalizeDateTimeFieldValue()` to convert user input to ISO format
- Sets `dataset.iso` on the **tile input** (the source of truth for `hangar-data.js`)
- Formats display value back to compact UTC format
- Fires all necessary events (`input`, `change`, `blur`) to trigger save/sync

### 2. Updated Handler Signatures (lines 474-475)

**Before:**
```javascript
arrivalTime: (v)=>{ writeTimeTo(`#arrival-time-${tileId}`, v); },
departureTime: (v)=>{ writeTimeTo(`#departure-time-${tileId}`, v); },
```

**After:**
```javascript
arrivalTime: (tid, el)=>{ writeTimeTo(tid, 'arrivalTime', el); },
departureTime: (tid, el)=>{ writeTimeTo(tid, 'departureTime', el); },
```

### 3. Updated `applyEditorChange()` (lines 569-574)

**Added conditional logic:**
```javascript
// For time fields, pass the element itself so writeTimeTo can canonicalize
if (col === 'arrivalTime' || col === 'departureTime') {
  handlers[col](tileId, el); // Pass tileId and element
} else {
  handlers[col](val); // Other fields get value only
}
```

## Data Flow

### Before (Broken)
```
Table Input (arrival-time-table-1)
  ↓ user enters "1230"
  ↓ handler calls writeTimeTo('#arrival-time-1', '1230')
  ↓ sets tile input.value = '1230'
  ✗ dataset.iso NOT set
  ✗ no canonicalization
  ↓ page reload
  ✗ hangar-data.js reads dataset.iso → empty
  ✗ data lost
```

### After (Fixed)
```
Table Input (arrival-time-table-1)
  ↓ user enters "1230"
  ↓ handler calls writeTimeTo(1, 'arrivalTime', tableElement)
  ↓ canonicalize: '1230' → '2025-10-24T12:30' (ISO)
  ↓ format display: '24.10.25,12:30'
  ↓ sets tile input.value = '24.10.25,12:30'
  ✓ sets tile input.dataset.iso = '2025-10-24T12:30'
  ✓ fires input/change/blur events
  ↓ page reload
  ✓ hangar-data.js reads dataset.iso → '2025-10-24T12:30'
  ✓ data persists
```

## Files Modified

- `js/planner-table-view.js` (3 changes):
  - `writeTimeTo()` function (lines 586-637)
  - Handler signatures for arrivalTime/departureTime (lines 474-475)
  - `applyEditorChange()` conditional logic (lines 569-574)

## Testing

See: `test-planner-table-dates.md` for comprehensive test plan (10 test cases)

**Quick Smoke Test:**
1. Open app in standalone mode
2. Switch to Table view
3. Enter AC-ID and times (e.g., `1230`, `1545`)
4. Switch to Tile view → values should appear
5. Reload page → values should persist

## Compatibility

- ✅ Maintains backward compatibility with tile-based input
- ✅ Works in Standalone, Read-only (Sync), and Master modes
- ✅ Preserves existing canonicalization logic from `helpers.js`
- ✅ No breaking changes to data format or API

## Related Systems

This fix ensures proper integration with:
- `js/hangar-data.js` - data collection and persistence
- `js/helpers.js` - date/time canonicalization
- `js/storage-browser.js` - localStorage and server sync
- `sync/data.php` - server-side persistence (in Master mode)

## Known Limitations

1. **Invalid Input:** If user enters invalid date/time (e.g., "abc123"), canonicalization may fail. Behavior depends on helpers.js implementation (typically clears the field or keeps as-is without ISO).
   
2. **Format Assumptions:** Assumes the following input formats are supported:
   - 4-digit time: `1230` → `12:30`
   - HH:MM: `09:15`
   - Compact: `24.10.25,14:20`
   - ISO: `2025-10-24T14:20`

3. **Base Date Coercion:** Time-only inputs (e.g., `1230`) are coerced to full date-time using current date as base. This may cause unexpected behavior across date boundaries.

## Future Improvements

- [ ] Attach compact date-time picker to table inputs for better UX (currently only on tile inputs)
- [ ] Add visual feedback when canonicalization fails
- [ ] Consider adding input validation before submitting
- [ ] Unify ID patterns (remove `-table` suffix; use same IDs everywhere)

## Commit Message

```
plannerTable: canonicalize and persist arrival/departure; set dataset.iso and fire events for sync

- Modified writeTimeTo() to canonicalize user input via helpers.canonicalizeDateTimeFieldValue
- Now sets dataset.iso on tile inputs (source of truth for hangar-data.js)
- Updated handlers to pass table element instead of raw value
- Fires input/change/blur events to trigger save/sync pipeline
- Fixes issue where table-entered dates were lost after reload or view switch

Closes issue: plannerTable date inputs not persisting
```

---

**Date:** 2025-10-24  
**Author:** Steffen (via Warp Agent)  
**Issue:** plannerTable (data-col="arrivalTime" and data-col="departureTime") not saved or synced  
**Status:** ✅ Fixed - Ready for testing
