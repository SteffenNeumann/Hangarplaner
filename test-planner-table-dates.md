# Test Plan: plannerTable Date Input Fix

## What Was Fixed
- Table date inputs (`arrival-time-table-{id}` and `departure-time-table-{id}`) now properly canonicalize values
- Values are persisted to `dataset.iso` on tile inputs (the source of truth)
- Events are fired to trigger save/sync pipelines

## Prerequisites
```bash
# Start local server
php -S localhost:8000
# OR
python3 -m http.server 8000
```

Open: http://localhost:8000/index.html

---

## Test Suite

### Test 1: Table → Tile → Persistence (Basic)

**Setup:**
1. Open the app in Standalone mode (both Read and Write toggles OFF)
2. Switch to Table view (toggle Display mode)
3. Find an empty row (or clear one)

**Steps:**
1. In plannerTable, enter AC-ID: `D-ABCD`
2. In the same row, enter Arr (UTC): `1230` (4-digit time)
3. In the same row, enter Dep (UTC): `1545`
4. Switch to Planner (tile) view

**Expected:**
- Tile display shows:
  - Aircraft ID: `D-ABCD`
  - Arr: formatted as compact UTC (e.g., `24.10.25,12:30`)
  - Dep: formatted as compact UTC (e.g., `24.10.25,15:45`)

**Steps (continued):**
5. Reload the page (F5)
6. Switch to Table view

**Expected:**
- All values persist after reload
- Table shows same values as before reload

---

### Test 2: Tile → Table (Bidirectional)

**Setup:**
1. Start with empty tile

**Steps:**
1. In Planner (tile) view, enter:
   - Aircraft ID: `D-EFGH`
   - Double-click Arr field, enter `25.10.25,09:15`
   - Double-click Dep field, enter `25.10.25,18:30`
2. Switch to Table view

**Expected:**
- Table shows same values in corresponding row
- Values persist after reload

---

### Test 3: Compact Date Format

**Steps:**
1. In Table view, enter Arr: `24.10.25,14:20`
2. Switch to Tile view

**Expected:**
- Tile shows: `24.10.25,14:20`
- After reload: still shows `24.10.25,14:20`

---

### Test 4: Time-Only Format (HH:MM)

**Steps:**
1. In Table view, enter Arr: `0930`
2. In Table view, enter Dep: `17:45`

**Expected:**
- Values are coerced to full date-time using current base date
- After switching to Tile view and back: values remain
- After reload: values persist

---

### Test 5: Clear Values

**Steps:**
1. Find a row with existing Arr/Dep times
2. Clear the Arr field (delete all text)
3. Switch to Tile view
4. Reload page

**Expected:**
- Arr field is empty in tile view
- After reload: Arr field remains empty
- Dep field is unchanged

---

### Test 6: Invalid Input

**Steps:**
1. In Table view, enter Arr: `invalid text`
2. Switch to Tile view

**Expected:**
- Tile shows either:
  - Empty (if canonicalization fails completely), OR
  - The invalid text as-is (if helpers keep it)
- After reload: field behavior depends on helper logic (likely cleared or kept as-is)

---

### Test 7: Read-Only Mode (Sync)

**Setup:**
1. Toggle Read Data: ON
2. Toggle Write Data: OFF
3. Switch to Table view

**Steps:**
1. Try to edit any Arr/Dep field

**Expected:**
- Inputs are disabled (greyed out)
- No edits possible
- No POST requests in Network tab

---

### Test 8: Master Mode Sync

**Setup:**
1. Toggle Read Data: ON
2. Toggle Write Data: ON
3. Open Browser DevTools → Network tab
4. Switch to Table view

**Steps:**
1. Edit Arr field in table: `1030`
2. Wait 1-2 seconds (debounce)

**Expected:**
- POST request to `sync/data.php` appears in Network tab
- Request headers include: `X-Sync-Role: master`
- Response: HTTP 200 OK
- Server data should reflect the change (can verify with another client in Read-only mode)

---

### Test 9: Multiple Rows

**Steps:**
1. In Table view, fill 3 rows:
   - Row 1: AC-ID `D-A001`, Arr `0800`, Dep `1200`
   - Row 2: AC-ID `D-A002`, Arr `1300`, Dep `1700`
   - Row 3: AC-ID `D-A003`, Arr `24.10.25,20:00`, Dep `25.10.25,06:00`
2. Switch to Tile view (verify all 3)
3. Reload
4. Switch back to Table view

**Expected:**
- All 3 rows persist correctly
- Values match what was entered

---

### Test 10: Sort After Edit

**Steps:**
1. In Table view, enter Arr times for multiple rows (unsorted)
2. Click "Arr (UTC)" column header to sort
3. Reload page
4. Switch views

**Expected:**
- Sort persists (localStorage)
- All date values remain intact
- No data loss during sort

---

## Debug Tools

### Console Commands

```javascript
// Check sync mode
window.debugSync()

// Check tile input datasets
const tile1Arr = document.getElementById('arrival-time-1')
console.log('Tile 1 Arr:', tile1Arr.value, tile1Arr.dataset.iso)

const tile1Dep = document.getElementById('departure-time-1')
console.log('Tile 1 Dep:', tile1Dep.value, tile1Dep.dataset.iso)

// Check table input datasets
const table1Arr = document.getElementById('arrival-time-table-1')
console.log('Table 1 Arr:', table1Arr?.value, table1Arr?.dataset.iso)

// Manually trigger canonicalization
const testValue = '1430'
const canon = window.helpers.canonicalizeDateTimeFieldValue('arrival-time-1', testValue)
console.log('Canonicalized:', canon)
```

---

## Known Behaviors

1. **Empty/Cleared Fields**: When a date field is cleared, `dataset.iso` is deleted and the field value becomes empty string
2. **Invalid Input**: Depends on helper behavior; typically cleared or kept as-is without `dataset.iso`
3. **Format Preference**: App prefers compact format `dd.mm.yy,HH:MM` for display
4. **Time-Only Coercion**: `HH:MM` or `HHMM` is coerced to full date-time using current date as base

---

## Troubleshooting

### Symptom: Values don't persist after reload

**Check:**
```bash
# Open browser console
localStorage.getItem('hangar')
```
Verify the data structure includes `arrivalTime` and `departureTime` for your tiles.

**Verify:**
- `dataset.iso` is set on tile inputs (not just table inputs)
- Events (`input`, `change`, `blur`) are fired after edit

### Symptom: Table shows values but Tile doesn't (or vice versa)

**Check:**
- ID mismatches: table uses `arrival-time-table-{id}`, tile uses `arrival-time-{id}`
- The fix writes to TILE inputs (source of truth)
- Table cells should read from tile inputs when rendering

### Symptom: No server sync in Master mode

**Check:**
```javascript
window.serverSync.isMaster // should be true
window.sharingManager.syncMode // should be 'master'
```

**Verify:**
- Both Read and Write toggles are ON
- Network tab shows POST to `sync/data.php`
- Request includes header: `X-Sync-Role: master`

---

## Success Criteria

✅ All 10 tests pass  
✅ No console errors during normal operation  
✅ Values persist across page reloads  
✅ Tile ↔ Table bidirectional sync works  
✅ Read-only mode prevents edits  
✅ Master mode syncs to server with correct header  

---

## Regression Check

After confirming the fix works, verify these still work:

- [ ] Flight data API lookups still populate date fields correctly
- [ ] PDF export includes date/time values
- [ ] Timetable view shows correct times
- [ ] Overnight logic still works (if applicable)
- [ ] Date picker modal (double-click on tile inputs) still works
