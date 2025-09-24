# HangarPlaner Synchronization System — Design & Operation

Version: 2025-09-20

This document describes the HangarPlaner synchronization system in detail for future reference and backup. It covers the client and server components, data flow, conflict management (multi‑master), data formats, tunable parameters, and test procedures.


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
- GET `?action=list` — lists active sessions with role and display name.
- POST `heartbeat/leave` — updates presence info (optional for read gating).


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
- Recent user edits are preserved locally and then re‑asserted on the server without “flip-backs”.
- When both users stop, the system converges to the last write.


## 6) Change Log (Planner Panel)

- The Planner Change Log reflects foreign (other users’) updates only:
  - Filters entries by `updatedBySession !== mySession` (or name fallback).
  - Builds per-field diffs against a session baseline (stored in `sessionStorage`), so the link targets the exact field (e.g., `status-1`).
  - Groups multiple field changes by (timestamp, tile, user) and shows per-field sublinks.


## 7) Timings & Tunables

- `_writeFenceMs`: 20000 (20s) — write fence TTL per field.
- Hard-lock per-field apply window: 15000 (15s) after local `change`.
- Typing debounce: 5000 (5s) for free text fields.
- Periodic read (Slave): ~3s; write (Master): ~5s; read-back (Master): ~15s (subject to skip/delay while typing).
- `requireOtherMastersForRead`: default false. If set true, Master applies tile updates only when another Master is online (presence‑gated).

Adjusting these controls the tradeoff between responsiveness and anti-oscillation.


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


## 11) Summary of Current Defaults (as of 2025-09-20)

- Multi-master enabled. No exclusive server lock.
- Delta-only writes; full payload writes are disabled in multi‑master.
- Write fences: 20s TTL; marked on input/change.
- Hard lock on field after local change: 15s.
- Typing-aware throttling for writes and read-backs.
- 409 auto-retry keeps recent local for exact fields; otherwise accept server.
- Presence gating for Master read is available but off by default.
