# Undo/Redo Functionality Test Plan

## Overview
This document describes how to test the newly implemented Undo/Redo functionality in HangarPlanner.

## Feature Location
- **Menu**: Project submenu (left sidebar)
- **Section**: History (after Aircraft Search)
- **Buttons**: Undo and Redo buttons
- **Keyboard Shortcuts**: 
  - Undo: `Ctrl+Z` (Windows/Linux) or `Cmd+Z` (macOS)
  - Redo: `Ctrl+Y` or `Ctrl+Shift+Z` (Windows/Linux) or `Cmd+Y` or `Cmd+Shift+Z` (macOS)

## What Is Tracked
The undo/redo system tracks changes to the following tile fields:
- Aircraft ID (`aircraft-{cellId}`)
- Arrival Time (`arrival-time-{cellId}`)
- Departure Time (`departure-time-{cellId}`)
- Position/Route (`position-{cellId}`)
- Hangar Position (`hangar-position-{cellId}`)
- Status (`status-{cellId}`)
- Tow Status (`tow-status-{cellId}`)
- Notes (`notes-{cellId}`)

## History Stack
- **Maximum**: 5 undo states
- **Persistence**: Saved to `localStorage` under key `hangarHistory`
- **Behavior**: New changes clear redo stack

## Test Cases

### 1. Basic Undo/Redo
**Steps:**
1. Open the app and navigate to the Planner tab
2. Edit any tile field (e.g., change Aircraft ID)
3. Wait 300ms (debounce delay)
4. Open Project menu → History section
5. Click "Undo" button
6. Verify the change is reverted
7. Click "Redo" button
8. Verify the change is restored

**Expected Result:** Changes undo and redo correctly

### 2. Keyboard Shortcuts
**Steps:**
1. Make a change to any tile field
2. Press `Ctrl+Z` (or `Cmd+Z` on Mac)
3. Verify undo occurs
4. Press `Ctrl+Y` (or `Cmd+Y` on Mac)
5. Verify redo occurs

**Expected Result:** Keyboard shortcuts work as expected

### 3. Button State Management
**Steps:**
1. Observe Undo/Redo buttons are disabled initially
2. Make a change to a tile
3. Verify Undo button becomes enabled
4. Click Undo
5. Verify Redo button becomes enabled
6. Make another change
7. Verify Redo button becomes disabled (redo stack cleared)

**Expected Result:** Button states update correctly

### 4. Multiple Changes
**Steps:**
1. Make 5 different changes to various tiles
2. Click Undo 5 times
3. Verify all changes are undone in reverse order
4. Click Redo 5 times
5. Verify all changes are restored in forward order

**Expected Result:** All changes tracked and restored correctly

### 5. History Stack Limit
**Steps:**
1. Make 10 different changes to tiles
2. Click Undo repeatedly
3. Verify only the last 5 changes can be undone

**Expected Result:** Only 5 states are retained (oldest dropped)

### 6. Read-Only Mode (Sync)
**Steps:**
1. Switch to Sync mode (Read-only) via Sync menu
2. Open Project menu → History section
3. Verify Undo/Redo buttons are disabled
4. Try keyboard shortcuts
5. Verify no undo/redo occurs in read-only mode

**Expected Result:** Undo/redo disabled in Sync (read-only) mode

### 7. Master Mode Sync
**Steps:**
1. Switch to Master mode (Read+Write)
2. Make a change to a tile
3. Click Undo
4. Verify change is reverted locally
5. Check browser Network tab for POST to `sync/data.php`
6. Verify server sync was triggered

**Expected Result:** Undo/redo syncs to server in Master mode

### 8. Offline Mode
**Steps:**
1. Switch to Offline mode
2. Make changes and test undo/redo
3. Verify no server sync attempts
4. Verify functionality works locally

**Expected Result:** Undo/redo works offline without server sync

### 9. Persistence Across Reload
**Steps:**
1. Make several changes
2. Click Undo once
3. Reload the page
4. Open Project menu → History section
5. Click Undo again
6. Verify previous history is restored

**Expected Result:** History persists across page reloads

### 10. All Tracked Fields
**Steps:**
For each field type, make a change and undo it:
- Aircraft ID
- Arrival Time (use datetime picker)
- Departure Time (use datetime picker)
- Position
- Hangar Position
- Status (dropdown)
- Tow Status (dropdown)
- Notes

**Expected Result:** All field types are correctly tracked and restored

## Console Debug Commands

Open browser console and use these commands for debugging:

```javascript
// Check if History Manager is loaded
console.log('History Manager:', window.HistoryManager);

// Check current history state
if (window.HistoryManager) {
  const mgr = new window.HistoryManager();
  console.log('Undo stack:', mgr.undoStack.length);
  console.log('Redo stack:', mgr.redoStack.length);
}

// Manually trigger undo
if (window.HistoryManager) {
  new window.HistoryManager().undo();
}

// Manually trigger redo
if (window.HistoryManager) {
  new window.HistoryManager().redo();
}

// Clear history
if (window.HistoryManager) {
  new window.HistoryManager().clearHistory();
}

// Check localStorage
console.log('History in storage:', localStorage.getItem('hangarHistory'));
```

## Known Issues/Limitations

1. **Debounce Delay**: Changes are captured 300ms after the last input. Fast edits might be batched.
2. **Stack Size**: Only last 5 states are retained. Older changes are dropped.
3. **Read-Only Protection**: Undo/redo automatically disabled in Sync (read-only) mode.
4. **Field Coverage**: Only tile-level fields are tracked. Project metadata (name, settings) are not tracked.

## Success Criteria

- ✅ Undo/Redo buttons appear in Project menu
- ✅ Keyboard shortcuts work (Ctrl/Cmd+Z, Ctrl/Cmd+Y)
- ✅ All 8 tile field types are tracked
- ✅ Maximum 5 states retained
- ✅ Button states update correctly
- ✅ History persists across reloads
- ✅ Disabled in read-only mode
- ✅ Syncs to server in Master mode
- ✅ Works offline

## Troubleshooting

### Buttons Stay Disabled
- Check console for initialization errors
- Verify `js/history-manager.js` is loaded
- Make sure at least one change has been made

### Keyboard Shortcuts Don't Work
- Check if input/textarea has focus (shortcuts work globally except in text fields)
- Verify browser isn't capturing the shortcut
- Check console for errors

### Changes Not Tracked
- Wait 300ms after making a change (debounce delay)
- Check if field ID matches tracked patterns
- Verify not in read-only mode

### Server Sync Not Working
- Verify in Master mode (not Offline or Sync)
- Check Network tab for POST requests
- Verify `window.serverSync.isMaster` is true
