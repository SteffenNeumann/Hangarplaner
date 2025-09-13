# Date & Time Picker – FAQ

This guide explains how to use the HangarPlaner Date & Time picker for setting arrival and departure times, including range selections.

---

## Overview

- Compact inputs in tiles accept times in the format `dd.mm.yy,HH:mm`.
- Double‑click a tile’s Arr/Dep field to open the calendar picker.
- The picker supports two modes:
  - Single date/time
  - Range (start + end date, each with its own time)
- Works in both light and dark mode.

---

## Opening the picker

- Double‑click any Arr or Dep field inside a tile to open the picker next to it.
- You can also call a standalone demo (for testing) from the browser console:

```js path=null start=null
window.helpers.openRangePickerExample();
```

---

## Single date/time mode

1) Double‑click a tile’s Arr or Dep field.
2) Use the calendar to pick a day.
3) Adjust the time in the header time input (right side).
4) Press OK or hit Enter.

Result:
- The clicked input is filled with `dd.mm.yy,HH:mm` and stored internally as ISO for syncing.

---

## Range mode (start + end)

1) Open the picker (double‑click Arr or Dep).
2) Toggle the “Range” switch in the header controls.
   - The picker becomes wider and shows two time inputs in the header: Start and End time.
3) Click the start day, then click the end day.
4) Adjust the two times (Start, End) in the header if needed.
5) Press OK (or Enter).

Result:
- Both tile fields are filled automatically:
  - Arr = `startDate,StartTime`
  - Dep = `endDate,EndTime`
- The inputs also receive a hidden `dataset.iso` (ISO format) for saving/syncing.

Tip: If you opened the picker from a tile that doesn’t have both Arr and Dep fields, the picker will fall back to inserting a readable summary.

---

## Keyboard shortcuts

- Left/Right arrow: ±1 day
- Up/Down arrow: ±7 days
- PageUp/PageDown: previous/next month
- Enter: confirm
- Escape: close

---

## Closing the picker

- Press Escape, or click outside the picker.
- OK applies the selection to the tile and closes the picker.

---

## Applying values to tiles (what to expect)

- Single mode: the clicked field is filled.
- Range mode: both Arr and Dep fields of the same tile are filled (if the picker was opened from that tile).
- Values are displayed as `dd.mm.yy,HH:mm` but also stored in the input’s `dataset.iso` for consistency.

---

## Data formats

- Display format: `dd.mm.yy,HH:mm` (e.g., `14.09.25,09:00`)
- Internal storage: ISO local datetime: `YYYY-MM-DDTHH:mm` (e.g., `2025-09-14T09:00`)

The app converts as needed so you can type the compact format but still benefit from precise ISO under the hood.

---

## Troubleshooting

- “Nothing happens when I try to edit”
  - The app may be in Read-only (Sync) mode. Editing is disabled in read-only mode.
  - Switch to Read/Write (Master) mode to allow changes.
- “The picker doesn’t appear”
  - Make sure you double‑clicked an Arr/Dep field.
  - Perform a hard refresh (to ensure the latest scripts are loaded).
- “Range mode didn’t fill both fields”
  - Ensure you opened the picker from a tile field named like `arrival-time-<index>` or `departure-time-<index>` so the app can map to both fields of that tile.
- “The time I typed isn’t accepted”
  - Use `HH:mm` (24h) for time. For compact entry you can also type a 4-digit time (e.g., `0930`) then blur to auto-format.

---

## Advanced: Example for range mode (standalone)

Use this example to try the picker without a tile binding:

```js path=null start=null
// Opens a range picker (top-left), prefilled with a 4-day range
window.helpers.openRangePickerExample();
```

You’ll see the result in the browser console.

---

## Accessibility & UX notes

- Clear keyboard navigation and Enter to confirm.
- The current day and selected dates are visually highlighted.
- Range selections show a continuous highlight between start and end.
- The picker widens automatically in range mode so both time inputs are visible.

---

## Known limitations

- Overlapping ranges across multiple tiles are not merged automatically.
- Range mode assumes Arr ≤ Dep for a single tile; reversing is corrected by ordering.

---

## Changelog (feature highlights)

- Adds calendar month grid with arrow/PageUp/PageDown keyboard navigation.
- Adds range mode with Start/End times in the header.
- Adds ESC/click-outside to close and Enter to confirm.
- Automatically fills both Arr and Dep fields in range mode.
