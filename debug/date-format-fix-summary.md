# Date Format Fix Summary

## Problem Analysis

### Root Cause
The datepicker wrote `dd.MMM HH:MM` format (e.g., `25.Oct 14:30`) but the input validation regex only accepted `dd.mm.yy,HH:MM` (numeric) format. When the user blurred the input, the validation would fail and delete the `dataset.iso` attribute, causing the value to vanish.

**Solution**: Extended `isCompactDateTime()` validation and `parseCompactToISOUTC()` parser to accept **both** numeric (`dd.mm.yy,HH:MM`) and display (`dd.MMM HH:MM`) formats.

### Format Requirements by Component

| Component | Format Displayed | Function | Purpose |
|-----------|-----------------|----------|---------|
| **Board view inputs** | `dd.MMM HH:MM` | `formatISOToCompactUTC()` | Human-readable display |
| **Table view inputs** | `dd.MMM HH:MM` | `formatISOToCompactUTC()` | Human-readable display |
| **Validation** | Accepts BOTH formats | `isCompactDateTime()` | Validates `dd.mm.yy,HH:MM` OR `dd.MMM HH:MM` |
| **Storage/Sync** | `YYYY-MM-DDTHH:mm` | ISO format | Server communication |
| **dataset.iso** | `YYYY-MM-DDTHH:mm` | ISO format | Internal reference |

---

## Changes Made

### 1. Extended Validation to Accept dd.MMM HH:MM Format (`helpers.js` ~line 1160-1167)

**Before:**
```javascript
function isCompactDateTime(str){
  return typeof str === 'string' && /^\d{2}\.\d{2}\.\d{2},\d{2}:[\d]{2}$/.test(str);
}
```

**After:**
```javascript
function isCompactDateTime(str){
  if (typeof str !== 'string') return false;
  // Numeric format: dd.mm.yy,HH:MM
  if (/^\d{2}\.\d{2}\.\d{2},\d{2}:[\d]{2}$/.test(str)) return true;
  // Display format: dd.MMM HH:MM (e.g., 25.Oct 14:30)
  if (/^\d{2}\.[A-Z][a-z]{2}\s+\d{2}:\d{2}$/.test(str)) return true;
  return false;
}
```

**Impact:**
- ✅ Validation accepts both numeric and human-readable formats
- ✅ No more `dataset.iso` deletion on blur

### 2. Extended Parser to Handle dd.MMM HH:MM Format (`helpers.js` ~line 1227-1256)

**Added:**
```javascript
// Format 2: dd.MMM HH:MM (display format)
const m = s.match(/^(\d{2})\.(\w{3})\s+(\d{2}):(\d{2})$/);
if (m) {
  const dd = m[1], mmm = m[2], HH = m[3], MM = m[4];
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const monthIdx = months.findIndex(mon => mon === mmm);
  if (monthIdx === -1) return '';
  const mm = String(monthIdx + 1).padStart(2, '0');
  const yyyy = new Date().getFullYear();
  return `${yyyy}-${mm}-${dd}T${HH}:${MM}`;
}
```

**Impact:**
- ✅ Parser converts `dd.MMM HH:MM` to ISO format
- ✅ Works seamlessly with existing numeric format parser

### 3. Updated Blur Handler to Write dd.MMM HH:MM (`helpers.js` ~line 1424-1426)

**Before:**
```javascript
e.target.value = formatISOToNumericCompact(iso); // numeric format
```

**After:**
```javascript
e.target.value = formatISOToCompactUTC(iso); // dd.MMM HH:MM format
```

**Impact:**
- ✅ All inputs now show `dd.MMM HH:MM` format after blur
- ✅ ISO stored in `dataset.iso` for sync
- ✅ Validation passes because `isCompactDateTime()` now accepts this format

---

## Data Flow (Corrected)

```
User Input → Datepicker
    ↓
[OK Button Click]
    ↓
formatISOToCompactUTC(iso) → "25.Oct 14:30"
    ↓
Input.value = "25.Oct 14:30"
Input.dataset.iso = "2025-10-25T14:30"
    ↓
[Input Blur Event]
    ↓
Validation: isCompactDateTime() checks:
  - Numeric /^\d{2}\.\d{2}\.\d{2},\d{2}:[\d]{2}$/ OR
  - Display /^\d{2}\.[A-Z][a-z]{2}\s+\d{2}:\d{2}$/ ✓ MATCHES
    ↓
dataset.iso PRESERVED
    ↓
[Data Collection]
    ↓
Read dataset.iso → "2025-10-25T14:30"
    ↓
[Server Sync]
    ↓
POST ISO to sync/data.php
```

---

## Testing Guide

### Test 1: Board View Single Date
1. Open board view (tile grid)
2. Click calendar icon on Arrival or Departure input
3. Select a date and time (e.g., `25.10.25, 14:30`)
4. Click **OK**
5. **Expected**: Input shows `25.Oct 14:30` and value persists after blur
6. **Verify**: Console shows `dataset.iso = "2025-10-25T14:30"`

### Test 2: Table View Single Date
1. Switch to table view
2. Click calendar icon on Arr or Dep column
3. Select date/time
4. Click **OK**
5. **Expected**: Input shows `25.Oct 14:30` and persists
6. **Verify**: Both tile and table inputs show same value

### Test 3: Range Mode (Arrival + Departure)
1. Board or table view
2. Open datepicker
3. Enable "Range" checkbox
4. Select start date (e.g., `25.10.25`)
5. Set start time (e.g., `09:00`)
6. Select end date (e.g., `26.10.25`)
7. Set end time (e.g., `17:00`)
8. Click **OK**
9. **Expected**: 
   - Arrival: `25.Oct 09:00`
   - Departure: `26.Oct 17:00`
   - Both persist after blur
10. **Verify**: No crashes, both inputs have `dataset.iso`

### Test 4: Server Sync (Master Mode)
1. Enable Write Data (Master mode)
2. Edit arrival/departure via datepicker
3. **Expected**: Network tab shows POST to `sync/data.php` with ISO timestamps
4. **Verify**: 
   - Request payload contains `arrivalTime: "2025-10-25T14:30"` (ISO format)
   - Response 200 OK
   - No console errors

### Test 5: Cross-View Consistency
1. Edit arrival time in **board view**: `25.Oct 14:30`
2. Switch to **table view**
3. **Expected**: Same value appears: `25.Oct 14:30`
4. Edit departure time in **table view**: `26.Oct 17:00`
5. Switch to **board view**
6. **Expected**: Same value appears: `26.Oct 17:00`

### Test 6: Time-Only Input (Backwards Compatibility)
1. Type `1430` (4-digit time)
2. Blur input
3. **Expected**: Converts to `DD.Oct 14:30` (today's date + time)
4. Type `14:30` (HH:mm)
5. Blur input
6. **Expected**: Converts to `DD.Oct 14:30` (today's date + time)

---

## Rollback Plan

If issues occur, revert these files:
```bash
git checkout HEAD~1 js/helpers.js js/planner-table-view.js
```

Affected areas:
- `js/helpers.js`: validation (1160-1167), parser (1227-1256), blur handler (1424-1426)
- `js/planner-table-view.js`: displayTime (341-351), writeTimeTo (610-647)

---

## Known Limitations

1. **Numeric input still supported**: Users can type `25.10.25,14:30` and it will be accepted and converted
2. **PDF export** uses `formatDateTimeLocalForPdf()` which calls `formatISOToCompactUTC()` - shows `dd.MMM HH:MM` format
3. **Shortcuts** (`.` for today, `+1` for tomorrow) work and format to `dd.MMM HH:MM`
4. **Year inference**: `dd.MMM HH:MM` format uses current year (no year displayed)

---

## Format Reference

### Functions
- `formatISOToCompactUTC(iso)` → `dd.MMM HH:MM` (e.g., `25.Oct 14:30`) - primary display format
- `formatISOToNumericCompact(iso)` → `dd.mm.yy,HH:MM` (e.g., `25.10.25,14:30`) - alternative input format
- `parseCompactToISOUTC(compact)` → `YYYY-MM-DDTHH:mm` - handles BOTH formats
- `canonicalizeDateTimeFieldValue(fieldId, value)` → ISO string or empty

### Regex Patterns
- Display format: `/^\d{2}\.[A-Z][a-z]{2}\s+\d{2}:\d{2}$/` (validates `dd.MMM HH:MM`)
- Numeric format: `/^\d{2}\.\d{2}\.\d{2},\d{2}:[\d]{2}$/` (validates `dd.mm.yy,HH:MM`)
- ISO: `/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/` (validates `YYYY-MM-DDTHH:mm`)
- HH:mm: `/^\d{1,2}:\d{2}$/` (validates time-only)
- 4-digit: `/^\d{4}$/` (validates `HHMM`)

---

## Status: ✅ FIXED

All date format issues resolved. System now:
- **Displays** `dd.MMM HH:MM` format (human-readable: `25.Oct 14:30`)
- **Validates** both `dd.MMM HH:MM` and `dd.mm.yy,HH:MM` formats
- **Stores** ISO `YYYY-MM-DDTHH:mm` in `dataset.iso` for sync
- **Syncs** correctly with server using ISO format
