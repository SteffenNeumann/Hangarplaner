# Sync Mode – Full FAQ and Guide

This guide covers how Sync works in HangarPlaner: the three modes, headers and endpoints, conflict handling, presence, manual sync, and troubleshooting.

---

## Overview

HangarPlaner supports three synchronization modes:
- Standalone (Offline): local only; no server reads or writes after an initial best-effort load.
- Read-only (Sync): reads from server; local edits do not write to server.
- Read/Write (Master): writes to server and reads from server; multi-master supported.

Key properties:
- Multi-master: multiple Masters can write concurrently; last-write-wins per field with conflict prompts on the client.
- Client-side gating: write attempts are blocked client-side unless in Master.
- Server-enforced header: writes require the X-Sync-Role: master header and a session header.

---

## Quick Start

- Enable Sync (read-only): Read Data ON, Write Data OFF.
- Become Master: toggle Write Data ON (Read stays ON). Writes include required headers.
- Go Offline: turn both Read and Write OFF (Standalone). No server traffic; all changes remain local.
- Manual Sync: available in Master; triggers a write plus optional read-back.

Controls:
- Dual toggles (Read Data / Write Data), or a single select (Offline / Sync / Master), depending on your UI build.

---

## Behavior by Mode

### Standalone (Offline)
- One-time best-effort server load at startup, then local only.
- No periodic reads or writes.

### Read-only (Sync)
- Periodically fetches server updates.
- Local editing of aircraft tiles is disabled; display-only options save locally and show “Saved locally (read-only mode)”.
- Poll interval (default): ~3 seconds.

### Read/Write (Master)
- Periodic write checks (change-detection) and targeted writes on edits.
- Read-back is enabled for multi-master convergence.
- Typical intervals:
  - Write cadence: ~5 seconds (change-detected).
  - Read-back in Master: ~15 seconds (plus on-demand after writes; delayed if user is typing to avoid caret jumps).

Note: Intervals are subject to change; use window.debugSync() to inspect the current effective behavior.

---

## Server Contract (Headers & Endpoints)

Required headers for writes:
- X-Sync-Role: master
- X-Sync-Session: a stable client session id (provided by the client)
- Optional: X-Display-Name: friendly name for audit/presence cues

Endpoints:
- sync/data.php
  - GET ?action=load — load current data (JSON)
  - GET ?action=timestamp — returns { timestamp, size } for change detection
  - POST — write changes (full payload or fieldUpdates delta); requires headers above
- sync/presence.php
  - GET ?action=list — list currently active sessions (lastSeen within TTL)
  - POST — heartbeat/leave: { action: 'heartbeat'|'leave', sessionId, displayName?, role?, page? }

CORS: Dev CORS headers allow Content-Type, X-Sync-Role, X-Sync-Session, X-Display-Name.

---

## Client Gating Rules

- Writes only occur in Master mode. In other modes, write calls no-op with info-level feedback.
- Reads are enabled when Read Data is ON (or forced ON in Master for convergence). When Read is OFF at startup, the initial server load is skipped and periodic read-back is disabled.
- UI block in read-only: inputs in the aircraft tiles are disabled; an on-demand modal explains read-only mode.

---

## Data Shape and Delta Writes

Full payload shape (normalized):
- metadata: { timestamp, lastWriter?, lastWriterSession? }
- settings: { displayOptions?: object, ... }
- primaryTiles: [ { tileId, aircraftId, arrivalTime, departureTime, position, hangarPosition, status, towStatus, notes, updatedAt?, updatedBy? } ]
- secondaryTiles: same structure for tileId >= 100

Delta (fieldUpdates) payload:
- fieldUpdates: { 'aircraft-1': 'D-AIBL', 'status-1': 'ready', ... }
- preconditions: { 'fieldId': previousBaselineValue } for optimistic concurrency; the server returns 409 with conflict details when the precondition doesn’t match the current server value and differs from the posted value.

The client prefers fieldUpdates to avoid overwriting unrelated fields in a multi-master scenario.

---

## Conflict Handling (Multi-master)

- Client computes per-field preconditions from its last server baseline.
- On 409 from the server, the client queues conflicts and shows a prompt:
  - “User {displayName} updated {field} (Tile N). Accept server or Keep mine?”
- Accept server: apply the server value locally and update baselines.
- Keep mine: keep local value and POST a targeted fieldUpdates write; a short write-fence prevents echo overwrite.
- Fresh-edit window: defaults to ~10s; covers active inputs and recent edits.

---

## Presence and Master Takeover Policy

- Presence endpoint (sync/presence.php) records active sessions with role and displayName.
- Some builds pre-check presence to avoid taking Master when another Master is active. In the default configuration, the server does not enforce an exclusive lock; multi-master is allowed.
- Client always includes X-Sync-Session for correlation and last-writer auditing.

---

## Manual Sync

- Available in Master mode (button or programmatically via window.serverSync.manualSync()).
- Performs a write and then an optional read-back (if reading is enabled) to converge.
- Disabled in read-only or offline modes.

---

## Timing, Intervals, and Timeouts

Defaults (subject to change):
- Read-only polling: ~3s
- Master write cadence (change-detection): ~5s
- Master read-back cadence: ~15s
- Network timeouts: ~10s per read/write request

Use window.debugSync() for a live snapshot of the current timing and flags.

---

## Troubleshooting

- “403 Forbidden on POST”
  - Cause: Missing or invalid X-Sync-Role: master or X-Sync-Session headers.
  - Fix: Ensure Write Data is ON (Master mode). Verify headers are sent.
- “No changes are saved while in Sync mode”
  - Sync mode is read-only by design. Switch to Master to write.
- “Conflicts are shown after writing”
  - Another Master changed the same field. Choose “Accept server” or “Keep mine”.
- “The page doesn’t seem to load server data”
  - Make sure Read Data is ON. Check GET ?action=load responses and console logs.
- “My writes get overwritten immediately”
  - Ensure only one Master is actively editing the same field; check presence list and review conflict prompts.

---

## Verification Checklist

1) Read-only (Sync)
- Read ON, Write OFF
- Edit a tile: inputs are disabled; no POST should occur.
- GET ?action=load updates data periodically.

2) Read/Write (Master)
- Read ON, Write ON
- Edit a tile: a write occurs via fieldUpdates delta.
- Changes replicate to a read-only client after read-back.

3) Standalone (Offline)
- Read OFF, Write OFF
- Edits are local only; no network traffic.
- Optional initial load may occur on startup, then offline.

---

## Examples

Write (curl):
```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -H "X-Sync-Role: master" \
  -H "X-Sync-Session: YOUR_SESSION_ID" \
  -H "X-Display-Name: Alice" \
  --data '{"metadata": {"timestamp": 0}, "fieldUpdates": {"status-1": "ready"}}' \
  http://localhost:8000/sync/data.php
```

Read timestamp (curl):
```bash
curl "http://localhost:8000/sync/data.php?action=timestamp"
```

List presence (curl):
```bash
curl "http://localhost:8000/sync/presence.php?action=list"
```

---

## File roles and Git

- settings.seed.json (repo)
  - Purpose: seed/default project data checked into the repository.
  - Safe to commit.

- sync/data.json (server runtime)
  - Purpose: live, merged multi-user state that sync/data.php reads/writes at runtime.
  - Creation: file is created on the first successful Master-mode POST (with headers X-Sync-Role: master and X-Sync-Session). Before that, GET may return 404 and timestamp=0, which is expected.
  - Git: do not commit. It changes frequently, may contain session/user metadata, and will cause noisy diffs and conflicts.
  - Ignore: add sync/data.json to .gitignore. If already tracked, untrack with:
    - git rm --cached sync/data.json
    - git commit -m "chore: stop tracking runtime sync/data.json"

Why ignore sync/data.json?
- It’s runtime data, not source.
- Avoids merge conflicts and accidental overwrites of real server state.
- Keeps the repository clean and reproducible across environments.

---

## Console Helpers

- window.debugSync() — prints current sync URLs, flags, modes, and last server timestamp.
- window.serverSync.manualSync() — triggers a one-time write attempt (Master only).
- window.debugServerLock() — diagnostic read for server-side lock info (if present).

---
