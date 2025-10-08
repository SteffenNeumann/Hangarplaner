# HangarPlaner Synchronization System — Design & Operation

Version: 2025-10-08 (Updated)

This document describes the HangarPlaner synchronization system in detail for future reference and backup. It covers the client and server components, data flow, conflict management (multi‑master), presence-based locking, data formats, tunable parameters, and test procedures.

**Recent Updates (2025-10-08):**
- Added detailed presence-based collaborative locking system
- Documented visual field lock indicators ("editing pills")
- Enhanced empty field propagation mechanism with `updatedBySession` checks
- Clarified multi-master convergence strategy (dual-cycle sync)
- Updated polling intervals and fence configurations


## 1) Modes

The app supports three sync modes:
- Offline (Standalone):
  - Local-only. Optional single best-effort server load on startup.
  - No periodic reads/writes.
- Sync (Read-only):
  - Periodic reads from the server to apply updates.
  - Local tile editing is disabled in the UI.
- Master (Read/Write):
  - Periodic change-detected writes to the server and periodic read-backs.
  - Fully supports multi-master (multiple Master users writing concurrently).

Mode selection is coordinated by SharingManager (UI) and ServerSync (engine).


## 2) Client Components

### 2.1 SharingManager (js/sharing-manager.js)
- Orchestrates the mode transitions and UI:
  - `enableStandaloneMode()`
  - `enableSyncMode()`
  - `enableMasterMode()`
- Updates UI to reflect read-only vs editable state (`applyReadOnlyUIState`).
- Triggers manual sync in Master mode.
- Emits `syncModeChanged` events used by header widgets and Change Log.

### 2.2 ServerSync (js/storage-browser.js)
Core synchronization engine:
- Endpoints
  - `getServerUrl()` returns sync/data.php for the current origin.
- Initialization & roles
  - `initSync()` configures server URL and performs initial read only if reading is enabled.
  - `startSlaveMode()` polling reads (~3s default).
  - `startMasterMode()` periodic writes (~5s default) plus read-back polling (~15s).
- Data operations
  - `collectCurrentData()` gathers current tiles/settings.
  - Baseline maps `_baselinePrimary`, `_baselineSecondary` updated via `_updateBaselineFromServerData()`.
  - Delta computation `_computeFieldUpdates(currentData)` derives per-field changes vs. baselines.
  - `syncWithServer()` posts either `fieldUpdates` (preferred) or (now) skips when no deltas are present (multi-master safe).
  - `syncFieldUpdates(fieldUpdates)` posts per-field deltas immediately, with preconditions derived from baselines.
  - Manual sync uses the same delta-only path; full‑payload fallback is removed in multi‑master.
  - `loadFromServer()` retrieves current data; `applyServerData()` applies changes to the UI safely.
- Multi-master protections
  - Write fences: `_pendingWrites` + `_writeFenceMs` (currently 20s) prevent server-echo while typing.
  - Self-echo skip: ignore snapshots authored by this session (metadata.lastWriterSession).
  - Apply guards: do not apply server values to focused/recently edited fields; support a short hard-lock window per field (see below).
  - Read/write throttling while typing: skip periodic writes and delay read-back when `isUserTypingRecently()` is true (applies to slave polling as well).
  - Optional presence gating: `requireOtherMastersForRead = false` by default (can be enabled to read/apply only if other Masters are online).
- Conflict handling (409)
  - On 409, if the user edited the conflicting field recently, we re-post a targeted `fieldUpdates` with server-supplied `serverValue` as the precondition (keep local); otherwise accept server and read-back. This applies to both periodic writes and targeted writes.
  - After a successful keep‑local targeted retry, local baselines are updated for the exact fields kept to prevent repeated 409s for the same delta (no re‑post loop).
- No full-payload fallback in multi-master
  - We no longer post full payloads when there are no deltas; we skip the POST to avoid overwriting unrelated fields.
  - Manual full‑payload fallbacks are disabled; manual sync also uses delta‑only writes with preconditions.

### 2.3 Improved Event Manager (js/improved-event-manager.js)
- Centralizes input/change handlers for tile fields.
- Debounces local storage writes and aggregates server writes.
- Aggregated server writes now route through `serverSync.syncFieldUpdates()` (with preconditions) to avoid blind posts.
- Typing detection:
  - `TYPING_DEBOUNCE_MS = 5000` for free text (notes, aircraft, positions).
  - `isUserTypingRecently(windowMs)` used by ServerSync to throttle writes/reads.
- Recent local edits tracking: `lastLocalEdit[fieldId] = { value, editedAt }`.
- Early write fences: mark `_markPendingWrite(fieldId)` on input/change.
- Hard-lock window: after local `change` we set `window.__fieldApplyLockUntil[fieldId] = now + 15000` (15s). During this window, server values for that field are not applied to the UI, preventing flip-backs.


## 3) Server Components

### 3.1 Sync Endpoint (sync/data.php)
- CORS permits `X-Sync-Role`, `X-Sync-Session`, `X-Display-Name` for dev.
- GET `?action=load` — returns persisted JSON data.
- GET `?action=timestamp` — returns server timestamp for cheap change detection.
- POST
  - Requires `X-Sync-Role: master` and a stable `X-Sync-Session`.
  - Merges settings shallowly; deep-merges `settings.displayOptions`.
  - Tile-level merge: updates only changed fields.
  - Stamps each tile with `updatedAt`, `updatedBy`, `updatedBySession`.
  - Conflict handling:
    - When `fieldUpdates` are posted with `preconditions`, the server compares `preconditions[field]` to current server value. If server value differs from both the client’s expected value and the posted new value, it returns HTTP 409 with a conflicts list.
- Multi-master policy
  - No exclusive master lock; multi-master is allowed. The endpoint merges inbound changes and annotates last writer session.

### 3.2 Presence Endpoint (sync/presence.php)
- GET `?action=list` — lists active sessions with role, display name, and field locks.
- POST `heartbeat/leave` — updates presence info with:
  - `sessionId`: Stable client session identifier
  - `displayName`: User-provided name for display
  - `role`: Current sync mode ('master', 'sync', 'standalone')
  - `page`: Current page context ('planner', 'database', etc.)
  - `locks`: Object mapping fieldIds to lock expiration timestamps
  - `locksReplace`: Boolean to replace (true) or merge (false) locks
- Response format:
  ```json
  {
    "users": [
      {
        "sessionId": "abc123",
        "displayName": "Alice",
        "role": "master",
        "page": "planner",
        "lastSeen": 1696747200000,
        "locks": {
          "aircraft-1": 1696747215000,
          "notes-1": 1696747218000
        }
      }
    ]
  }
  ```


## 4) Data Model (JSON)

```json
{
  "metadata": {
    "timestamp": 1690000000000,
    "lastWriter": "Alice",
    "lastWriterSession": "abc123"
  },
  "settings": {
    "displayOptions": { "tilesCount": 8, "layout": 4, "...": "..." }
  },
  "primaryTiles": [
    {
      "tileId": 1,
      "aircraftId": "D-AIBL",
      "arrivalTime": "2025-09-20T08:00",
      "departureTime": "2025-09-20T15:00",
      "hangarPosition": "1A",
      "position": "", // info-grid route pos
      "status": "ready",
      "towStatus": "neutral",
      "notes": "...",
      "updatedAt": "2025-09-20T07:45:12Z",
      "updatedBy": "Alice",
      "updatedBySession": "abc123"
    }
  ],
  "secondaryTiles": [ /* same shape for tileId >= 100 */ ]
}
```

Per-field ‘fieldUpdates’ payload example:
```json
{
  "metadata": { "timestamp": 1690000000000 },
  "fieldUpdates": {
    "status-1": "ready",
    "notes-1": "Fuelled"
  },
  "preconditions": {
    "status-1": "aog",
    "notes-1": ""
  }
}
```

Field id mapping:
- `aircraft-<id>` → `aircraftId`
- `arrival-time-<id>` → `arrivalTime`
- `departure-time-<id>` → `departureTime`
- `hangar-position-<id>` → `hangarPosition`
- `position-<id>` → `position`
- `status-<id>` → `status`
- `tow-status-<id>` → `towStatus`
- `notes-<id>` → `notes`


## 5) Conflict Management (Multi‑master)

We combine server-side preconditions with client-side protections to avoid oscillation and keep user intent.

Server-side
- 409 conflicts are returned with a conflicts list containing `tileId`, `field`, `fieldId`, `serverValue`, and `updatedBySession`.

Client-side
1) Write fences
   - Field-level fence TTL = 20s.
   - Marked immediately on input/change, preventing echo overwrites.
2) Apply guards
   - Skip applying server values to a field if:
     - The field is focused, or
     - A write fence is active, or
     - The field was edited recently, or
     - A 15s hard-lock is active (set on local change).
3) Typing-aware throttling
   - Aggregated writes wait for typing to settle and skip periodic writes if typing continues.
   - Read-back polling also defers while typing is ongoing to avoid flip-backs.
4) Delta-only writes
   - We do not send full payloads when there are no deltas (prevents trample). Manual sync also uses delta-only.
5) 409 handling
   - If the user edited a conflicting field recently, we retry a targeted write for just that field using the server’s current value as the new precondition (keep local).
   - Otherwise we accept the server value and read-back.
   - After a successful keep-local retry, baselines are updated for those fields to prevent repeated 409s for the same delta.

Outcome
- Recent user edits are preserved locally and then re‑asserted on the server without "flip-backs".
- When both users stop, the system converges to the last write.


## 5.1) Presence-Based Collaborative Locking (2025-10-08)

To further reduce edit collisions in multi-master scenarios, the system implements real-time field-level locking with visual feedback.

### Mechanism

1. **Lock Collection** (`_collectLocalLocks()`)
   - Tracks active field being edited via `window.__lastActiveFieldId`
   - Reads lock expiration times from `window.__fieldApplyLockUntil`
   - Returns map of currently locked fields: `{ 'aircraft-1': timestampMs }`

2. **Presence Heartbeat** (`_sendPresenceHeartbeat()`)
   - Frequency: Every 20 seconds
   - Payload includes:
     - Session ID and display name
     - Current role (master/sync/standalone)
     - Active field locks with expiration timestamps
   - Server stores and broadcasts this information

3. **Remote Lock Refresh** (`_refreshRemoteLocksFromPresence()`)
   - Frequency: Every 500ms (responsive UI updates)
   - Fetches list of all active users from presence endpoint
   - Aggregates field locks from other sessions
   - Stores in `_remoteLocks`: `{ fieldId: { until, sessionId, displayName } }`

4. **Visual Indicators** (`_createOrUpdateEditingLockPill()`)
   - Creates "editing pill" overlays for locked fields
   - Format: `"Alice editing • 3m"`
   - Styling for remote users:
     - Background: `rgba(244, 158, 12, 0.25)` (amber tint)
     - Border: `2px solid rgba(244, 158, 12, 0.8)`
     - Box shadow: `0 0 12px rgba(244, 158, 12, 0.5)`
   - Pills auto-expire when lock timestamp passes

5. **Write Enforcement** (in `syncWithServer()` and `syncFieldUpdates()`)
   - Before POST, filters out locked fields:
     ```javascript
     Object.keys(fieldUpdates).forEach(fieldId => {
       const lockInfo = this._remoteLocks[fieldId];
       if (lockInfo && lockInfo.until > now) {
         delete fieldUpdates[fieldId]; // Skip
         showNotification(`Field locked by ${lockInfo.displayName}`, 'warning');
       }
     });
     ```
   - Prevents overwriting fields actively edited by others

### Benefits
- **Real-time conflict prevention**: Users see who's editing what before attempting changes
- **Graceful degradation**: If presence service unavailable, falls back to standard conflict resolution
- **Non-blocking**: Warnings instead of errors; users can wait and retry
- **Auto-expiration**: Stale locks don't permanently block fields

### Configuration
- Heartbeat interval: 20s (configurable in `_startPresenceHeartbeat()`)
- Lock refresh interval: 500ms (configurable in `_startPresenceRefreshPoller()`)
- Lock duration: Tied to `window.__fieldApplyLockUntil` (15s default hard-lock window)


## 5.2) Empty Field Propagation (Fixed 2025-10-07)

**Problem:** When a Master user cleared a field (e.g., delete aircraft ID or use trashcan), Sync (read-only) clients did not see the cleared state. The field remained populated.

**Root Cause:** Protective logic prevented empty server values from overwriting non-empty local values, designed to guard against incomplete server responses or race conditions.

**Solution:** Use `updatedBySession` metadata to distinguish:
- **Authoritative clear**: `updatedBySession` present and different from local session → Allow empty value
- **Missing/corrupt data**: `updatedBySession` absent or same → Protect local value

### Implementation

In `applyServerData()` / `applyTileData()`, for each field:

```javascript
const fromOtherSession = !!(tileData.updatedBySession) &&
    (typeof this.getSessionId === 'function') &&
    (tileData.updatedBySession !== this.getSessionId());

const newVal = (tileData.aircraftId || '').trim();
const oldValue = (inputElement.value || '').trim();

if (!canApplyField(fieldId, inputElement)) {
  // Skip while locally editing/fenced
} else if (newVal.length > 0 || fromOtherSession || oldValue.length === 0) {
  // Apply if:
  // - non-empty incoming value, OR
  // - authoritative clear from another session, OR
  // - local field already empty (safe overwrite)
  inputElement.value = newVal;
  // ... update storage and dispatch events
}
```

### Server Requirements

The server (`sync/data.php`) must include `updatedBySession` in tile metadata:

```json
{
  "tileId": 1,
  "aircraftId": "",
  "status": "neutral",
  "updatedAt": "2025-10-07T08:00:00Z",
  "updatedBy": "Alice",
  "updatedBySession": "abc123"  // Required for authoritative clear detection
}
```

### Impact
- ✅ Intentional field deletions now sync correctly across all clients
- ✅ Protection against incomplete/corrupt data remains active
- ✅ Backward compatible: Falls back to previous behavior if `updatedBySession` absent
- ✅ Applies to all field types: aircraftId, positions, times, notes, status, towStatus


## 6) Change Log (Planner Panel)

- The Planner Change Log reflects foreign (other users’) updates only:
  - Filters entries by `updatedBySession !== mySession` (or name fallback).
  - Builds per-field diffs against a session baseline (stored in `sessionStorage`), so the link targets the exact field (e.g., `status-1`).
  - Groups multiple field changes by (timestamp, tile, user) and shows per-field sublinks.


## 7) Timings & Tunables

### Core Sync Intervals
- Periodic read (Sync mode): **3s** — timestamp polling via `slaveCheckForUpdates()`
- Periodic write (Master mode): **5s** — delta POST via `syncWithServer()` (change-detected)
- Read-back (Master mode): **3s** — dual-cycle polling for multi-master convergence

### Anti-Oscillation Protections
- `_writeFenceMs`: **20000ms (20s)** — write fence TTL per field
- Hard-lock per-field apply window: **15000ms (15s)** after local `change` event
- Conflict retry window: **15000ms (15s)** — keep local edits on 409 conflict
- Typing debounce: **5000ms (5s)** for free text fields (notes, aircraft, positions)

### Presence & Locking
- Presence heartbeat interval: **20000ms (20s)** — broadcasts role, name, locks
- Lock refresh interval: **500ms** — polls for remote user locks
- Lock duration: Inherited from hard-lock window (**15s** default)

### Timeouts & Watchdogs
- Fetch timeout: **10000ms (10s)** via AbortController
- Load watchdog: **15000ms (15s)** recovery timer for hung operations

### Flags & Gating
- `requireOtherMastersForRead`: **false** (default) — If true, Master applies updates only when other Masters online (presence-gated)

### Tuning Guidelines
**Increase responsiveness:**
- Decrease polling intervals (3s → 1s) for faster updates
- Decrease lock refresh (500ms → 250ms) for more responsive pills
- Risk: Higher network traffic and server load

**Reduce oscillation:**
- Increase write fence (20s → 30s) for longer local-edit protection
- Increase hard-lock (15s → 20s) for more stable typing experience
- Risk: Slower convergence, stale lock indicators

**Balance (current defaults):**
- Write fence 20s + Hard-lock 15s provides ~35s total protection window
- 3s/5s polling intervals balance freshness with bandwidth
- 500ms lock refresh keeps UI responsive without excess requests


## 8) Testing Procedures

1) Basic modes
   - Offline → no network traffic; optional initial load only.
   - Sync → periodic reads; UI disabled; attempts to edit show read-only.
   - Master → edits write; read-back converges changes.

2) Multi-master conflict
   - Open two sessions in Master mode.
   - Edit the same field back‑and‑forth (e.g., `status-1`).
   - Expect: no mid‑typing flip backs; eventual convergence after users stop.

3) Change Log
   - Confirm per-field links jump to the exact UI control and filter out own session.


## 9) Troubleshooting

- “My typing gets overwritten immediately”
  - Check `_writeFenceMs` and hard-lock windows; ensure aggregated writes aren’t bypassing `syncFieldUpdates`.
- “Changes from others don’t show up”
  - Ensure `applyServerData` guards aren’t permanently locking fields (locks auto-clear after window).
- “409 conflicts appear often”
  - This is expected under heavy multi‑master churn; the client auto-resolves by keeping recent local edits and retrying.
  - If the same 409 repeats, verify baselines update after keep‑local retries (the client now updates baselines automatically to avoid re-post loops).


## 10) Future Enhancements

- Optional conflict prompt UI on 409 (Accept server / Keep mine) when desired.
- Visual indicator for per-field lock/fence to aid operator awareness.
- Make per-field lock window adaptive based on churn rate.


## 11) Summary of Current Defaults (as of 2025-10-08)

### Core Features
- **Multi-master enabled**: No exclusive server lock; multiple Masters can write concurrently
- **Delta-only writes**: Field-level updates only; full payload writes disabled
- **Presence-based locking**: Real-time visual indicators for fields being edited by others
- **Empty field propagation**: Authoritative clears sync correctly via `updatedBySession` check
- **Dual-cycle convergence**: Master reads back at 3s + writes at 5s for eventual consistency

### Protection Mechanisms
- **Write fences**: 20s TTL per field; marked on input/change
- **Hard locks**: 15s apply window after local `change` event
- **Typing throttling**: Skips writes/reads while user actively typing
- **409 conflict resolution**: Auto-retry keeps recent local (15s window); otherwise accept server
- **Baseline tracking**: Prevents re-post loops after successful conflict resolution

### Presence & Collaboration
- **Heartbeat interval**: 20s (broadcasts session, role, locks)
- **Lock refresh**: 500ms (responsive visual feedback)
- **Lock enforcement**: Filters locked fields before POST
- **Visual pills**: Amber-tinted overlays show "User editing • Xm"

### Intervals & Timeouts
- **Sync mode polling**: 3s timestamp check + conditional load
- **Master mode write**: 5s change-detected delta POST
- **Master mode read**: 3s read-back polling
- **Fetch timeout**: 10s via AbortController
- **Watchdog recovery**: 15s for hung operations

### Flags & Options
- `requireOtherMastersForRead`: **false** (disabled by default)
- `TYPING_DEBOUNCE_MS`: **5000ms** (5s for free text)
- Conflict retry window: **15000ms** (15s keep-local protection)

### Server Requirements
- Must stamp tiles with `updatedAt`, `updatedBy`, `updatedBySession`
- Must support precondition validation and return 409 on conflict
- Must handle `fieldUpdates` with partial tile merges
- Presence endpoint must track sessions with locks

---

**Document Status**: ✅ Current as of 2025-10-08  
**See also**: `SYNC-CODE-REVIEW.md` for detailed code analysis  
**See also**: `SYNC-MODE-FAQ.md` for end-user guidance
