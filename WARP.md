
### Server-side write enforcement (header contract)
- Client must include the following header on write requests to sync/data.php:
  - X-Sync-Role: master
- The server rejects POSTs without this header (HTTP 403) with a JSON error. This guarantees that read-only clients cannot write even if a POST is attempted outside the central path.
- Client implementation: storage-browser.js adds this header only when isMaster === true.

Example (curl):
```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -H "X-Sync-Role: master" \
  --data '{"metadata": {"timestamp": 0}}' \
  http://localhost:8000/sync/data.php
```

### Debugging and verification
- Browser console helpers:
  - window.debugSync() → shows ServerSync flags and effective mode
  - window.testReadMode() → toggles client into read-only polling mode
- Network verification:
  - Read-only: make a change; no POST should appear. If you intentionally force a POST, expect 403.
  - Master: edits trigger POST with X-Sync-Role: master and succeed (200 OK).
- Server CORS headers permit the X-Sync-Role header for dev preflight requests.

# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Overview

HangarPlaner-1 is a web-based aircraft management application for tracking aircraft status, flight schedules, and hangar operations. The application is built as a client-side JavaScript app with no build process - files are served directly from the web server.

## Development Commands

### Running the Application
```bash
# Serve files via local web server (Python)
python3 -m http.server 8000
# OR using PHP
php -S localhost:8000
# OR using Node.js
npx serve .
```

The application runs entirely in the browser - open `index.html` or `fleet-database.html` directly in a web browser.

### Testing Flight Data APIs
```bash
# Test flight lookup functionality in browser console
testAviationstackAPI("D-AIBL")
testOvernightLogic("D-AIBL") 
checkAviationstackIntegration()
```

### Debugging Rate Limits and API Issues
```bash
# Check server-side logs (if using PHP backend)
tail -f sync/aviationstack_log.txt
tail -f sync/aviationstack_rate_limit.txt

# Test API endpoints directly
curl "https://aerodatabox.p.rapidapi.com/airlines/CLH/aircrafts?pageSize=50"
```

## High-Level Architecture

### Core Application Structure
- **Entry Points**: `index.html` (main hangar planner), `fleet-database.html` (fleet management)
- **No Build Process**: Pure HTML/CSS/JavaScript served directly
- **Module System**: Manual script loading with dependency management via `window.*` globals

### Key Architectural Components

#### 1. **Multi-API Flight Data System**
- **API Facade Pattern**: `js/api-facade.js` provides unified interface to multiple flight APIs
- **Supported APIs**: AeroDataBox, Aviationstack, GoFlightLabs, OpenSky, Amadeus
- **Rate Limiting**: Client-side rate limiting with server-side PHP proxy for CORS handling
- **Fallback Logic**: Automatic switching between APIs when one fails or reaches limits

#### 2. **Modular JavaScript Architecture** 
- **Event Manager**: `js/improved-event-manager.js` handles cross-module communication
- **Data Layer**: `js/hangar-data.js` manages application state and persistence
- **UI Layer**: `js/hangar-ui.js` handles display and user interactions
- **Initialization**: `js/hangar.js` orchestrates module loading and app startup

#### 3. **Synchronization System**
- **Multi-Mode Sync**: Standalone, Read-only (Sync), Read/Write (Master)
- **Local Storage**: Primary data persistence with automatic backup
- **Server Sync**: Optional sync via PHP backend in `sync/` directory
- **Conflict Resolution**: Manual merge workflows for concurrent edits

#### 4. **Aircraft Status Management**
- **12-Tile Grid**: Primary aircraft display with status lights (Ready/Maintenance/AOG)
- **Dynamic Expansion**: Secondary tiles can be added programmatically
- **Real-time Updates**: Status changes propagate across all views instantly
- **Timetable Integration**: Chronological flight schedule view with overnight logic

#### 5. **Flight Data Integration**
- **Registration-Based Search**: Primary lookup by aircraft registration (e.g., "D-AIBL")
- **Flight Number Fallback**: Secondary lookup by flight number with date ranges
- **Overnight Detection**: Automatic identification of aircraft staying overnight
- **Route Planning**: Arrival/departure time tracking with position management

### Critical Integration Points

#### API Provider Switching
The system dynamically switches between flight data providers based on availability and rate limits. Each provider has different capabilities:
- **AeroDataBox**: Best for fleet data, limited future flights
- **Aviationstack**: Optimal for overnight logic, 7-day future flights  
- **OpenSky**: Real-time positions, limited historical data
- **GoFlightLabs**: Alternative provider with different rate limits

#### Data Flow Pattern
1. **Input**: User enters aircraft registration or flight number
2. **API Selection**: Facade chooses appropriate provider based on request type
3. **Data Transformation**: Raw API responses normalized to common format
4. **UI Update**: Display components updated with flight information
5. **Persistence**: Changes saved to localStorage and optionally synced to server

#### Error Handling Strategy
- **Graceful Degradation**: APIs fail silently with fallback to alternative providers  
- **User Feedback**: Clear error messages for rate limits, network issues, invalid inputs
- **Debug Logging**: Comprehensive logging to browser console and server files
- **Recovery Mechanisms**: Automatic retry logic with exponential backoff

### Development Patterns

#### Module Dependencies
Modules depend on each other through global `window.*` objects. Critical loading order:
1. Helpers and utilities first
2. Core data structures  
3. API implementations
4. UI components
5. Event bindings and initialization

#### State Management
- **Single Source of Truth**: `hangar-data.js` manages all application state
- **Event-Driven Updates**: UI components subscribe to data change events
- **Persistence Layer**: Automatic save/load with conflict detection
- **Undo/Redo**: Limited undo capability for critical operations

#### CSS Architecture  
- **Utility-First**: Tailwind CSS for rapid UI development
- **Component Styles**: Custom CSS in `css/` directory for specialized components
- **Theme System**: Industrial design theme with consistent color palette
- **Responsive Design**: Mobile-first approach with desktop enhancements

## Common Development Tasks

### Adding a New Flight Data Provider
1. Create new API file in `js/` directory (e.g., `newapi-api.js`)
2. Implement standard interface methods (`searchByRegistration`, `searchByFlight`, etc.)
3. Add provider to `js/api-facade.js` provider registry
4. Update UI dropdown in `index.html` API provider selection
5. Add configuration/credentials as needed

### Extending Aircraft Status Options
1. Update status options in hangar tile HTML templates
2. Modify CSS classes in `css/hangarplanner-ui.css` for visual indicators
3. Update `js/hangar-data.js` status validation and persistence logic
4. Extend PDF export functionality in `js/hangar-pdf.js` if needed

### Debugging Flight Number Lookup Issues
Flight number lookups frequently fail due to API limitations and data mapping challenges:
1. Check browser console for API response logging
2. Verify date ranges are within API provider capabilities  
3. Test alternative providers if current one shows limitations
4. Manual verification against Flightradar24 web interface recommended
5. Consider fallback to registration-based search for better reliability

## Working with Rules

### Code Preservation
- Modify established patterns only with explicit approval
- Maintain architectural consistency across modules
- Follow existing naming conventions and directory structure
- Verify component existence before creating new entities

### Error Analysis Process  
1. Read all relevant data and get overview
2. Conduct detailed error analysis with API response inspection
3. Create step-by-step work structure
4. Work through systematically with validation at each step  
5. Check actions after each step for possible errors
6. Avoid creating new files unless absolutely necessary

### Documentation Standards
- Document all API integrations with rate limits and capabilities
- Maintain debug guides in `debug/` directory for complex issues
- Update user-facing documentation for feature changes
- Provide clear troubleshooting steps for common problems

### Sync policy and read-only enforcement

See also the user-facing guide: docs/SYNC-MODE-FAQ.md

- Multi-master behavior
  - Multiple clients may be write-enabled at the same time
  - Server does not enforce an exclusive master lock; writes require X-Sync-Role: master
  - Conflict policy: last write wins at the field/tile level, with periodic read-back to converge
  - Recommendation: keep Read ON for write-enabled clients to see other changes promptly
- Modes
  - Standalone: local only; no server reads or writes
  - Read-only (Sync): reads from server; client edits do not write to server
  - Read/Write (Master): writes to server and reads from server; multiple users can be write-enabled in parallel (multi-master)
- Client-side gating
  - Writes: All server writes are centralized through `window.serverSync.syncWithServer()`; header `X-Sync-Role: master` is sent only when in Master mode
  - Reads: All server reads are gated by the Read Data toggle. When Read is OFF, the app skips initial server load at startup and disables periodic read-back. Write-only mode is no longer supported.
  - Display options in read-only mode save locally only and show “Saved locally (read-only mode)”
- UI behavior in Read-only (Sync)
  - Editing controls within `#hangarGrid` and `#secondaryHangarGrid` are temporarily disabled
  - No persistent banner. An on-demand modal hint appears when the user attempts to edit (inputs remain disabled)
  - A subtle status indicator remains (e.g., mode label and last-load time pill in header)
  - Mode toggles and navigation remain usable
- Read/Write (Master) specifics
  - Presence-aware reads: by default the Master client only applies server updates when at least one other Master is online and the last server writer is a different session (configurable via `serverSync.requireOtherMastersForRead`)
  - Manual Sync: POSTs changes and may read back to refresh local state; read-back is skipped when gating rules disallow it
- Server endpoint
  - `sync/data.php` accepts GET/POST; client-side gating prevents writes in read-only

#### Sync Mode: Quick Start & Behavior
- Enable Sync (read-only): set Read Data ON and Write Data OFF.
- Behavior in Sync:
  - Inputs for hangar tiles are disabled to prevent accidental edits.
  - Display-only tweaks (e.g., layout and filter controls) still work and save locally only. The UI shows “Saved locally (read-only mode)”.
  - The app periodically fetches server data while Read is ON; a subtle status indicator shows the current mode and last-load time.
- Transitioning to Master (read/write): toggle Write Data ON (keep Read ON). Writes will include the required X-Sync-Role: master header.
- Transitioning to Standalone (offline): turn both Read and Write OFF. No server traffic occurs; all changes remain in localStorage.
- Startup gating: when Read is OFF at startup, the app skips initial server load and disables periodic read-back. Write-only mode is intentionally unsupported.
- Manual sync: issuing a manual sync posts local changes and may read back, subject to gating rules (implemented via `window.serverSync.syncWithServer()`).
- Debug helpers: `window.debugSync()` (shows flags/mode) and `window.testReadMode()` (toggles read-only polling for testing).

#### Conflict Resolution (per-field, multi-master)
- When two Masters edit the same field close in time, the client shows a modal:
  - "User {displayName} updated {field} (Tile N). Accept server or Keep mine?"
- Accept server: apply the server value locally and update baselines
- Keep mine: keep the local value and immediately POST a targeted `fieldUpdates` write for that field; a short write-fence prevents immediate echo overwrite
- Fresh-edit window defaults to 10s (`serverSync.conflictPromptWindowMs`) and covers active inputs and recently edited fields
- Visual aids: subtle author pill and last-update badge remain for awareness

### Manual test checklist (Sync system)
1) Read-only (Sync)
   - Enable Read Data ON, Write Data OFF
   - Edit a tile field; expect no POST to `sync/data.php`
   - Server data not modified; UI shows read-only banner; inputs are disabled
2) Read/Write (Master)
   - Enable Read Data ON, Write Data ON
   - Edit a tile field; a write occurs via `serverSync.syncWithServer()`
   - Changes persist and replicate to a read-only client
3) Standalone
   - Disable both toggles; edits only affect local state; no server traffic

## FAQ (Sync Mode and Data Flow)

- Q: What is “Sync mode”?
  - A: Sync mode is read-only collaboration: the client continuously reads from the server but does not write. It’s ideal for display stations or users who should not modify shared data.

- Q: How do I enable Sync mode?
  - A: Turn Read Data ON and Write Data OFF. Inputs for aircraft tiles become disabled, and a subtle status pill shows the mode and last-load time.

- Q: Why can’t I edit when Sync mode is ON?
  - A: Edit controls are intentionally disabled to enforce read-only behavior. Any display-only preferences save to localStorage and show “Saved locally (read-only mode)”.

- Q: How do I become a writer (Master)?
  - A: Toggle Write Data ON (keep Read ON). The client will include the header X-Sync-Role: master on POSTs to `sync/data.php`, which the server requires for writes.

- Q: Can multiple Masters write at the same time?
  - A: Yes. The system is multi-master. Conflicts are resolved at field level with a prompt offering “Accept server” or “Keep mine”. Last-write-wins semantics converge after short intervals.

- Q: My changes don’t show up on other devices—what should I check?
  - A: Ensure you are in Master mode (Write ON). Verify the Network tab shows POST requests to `sync/data.php` with X-Sync-Role: master and HTTP 200. Make sure other clients have Read ON to receive updates.

- Q: I see 403 Forbidden when saving—why?
  - A: The server rejects writes without X-Sync-Role: master. Turn Write ON (Master mode) or use the documented curl example with the header. In read-only Sync mode, POSTs are prevented by the client.

- Q: What does “Saved locally (read-only mode)” mean?
  - A: The change is stored only in the browser’s localStorage and will not be shared. Switch to Master (Write ON) to sync changes to the server.

- Q: How can I force a data refresh from the server?
  - A: Ensure Read is ON, then either trigger your app’s manual sync action (if available) or simply reload the page. For diagnostics, use `window.debugSync()` and watch GETs to `sync/data.php` in the Network panel.

- Q: Does the server enforce a single master lock?
  - A: No. There is no exclusive lock. Multi-master is supported; conflicts are handled client-side with prompts and short write-fences.

- Q: How do presence-aware reads work in Master mode?
  - A: By default, a Master applies server updates when at least one other Master is online and the last server writer is a different session (configurable via `serverSync.requireOtherMastersForRead`).

- Q: How do I work completely offline?
  - A: Turn both Read and Write OFF (Standalone). All changes are local; no requests are sent to the server.

- Q: Where are the endpoints and required headers documented?
  - A: See the “Server-side write enforcement (header contract)” section above and the provided curl example demonstrating X-Sync-Role: master.

- Q: How can I test Sync quickly with two clients?
  - A: Open the app in two browsers or devices. Set one to Master (Read ON, Write ON) and the other to Sync (Read ON, Write OFF). Edit on the Master and watch the other update without any POSTs.

---

## Authentication and Admin Approval (Email-based)

This section documents the lightweight authentication system with admin approval that lives under `sync/`.

### Overview
- Users self-register via `login.html` (Create Account tab).
- On registration, the server stores a pending user with an approval token and sends an admin email with an approval link.
- Admin clicks the approval link to activate the user; then the user can log in.
- An admin panel exists at `sync/admin.html` for listing and blocking/unblocking users after an admin session login.

### Configuration
Create `sync/config.php` (gitignored) with your real settings. A committed template exists at `sync/config.example.php`.

Example:
```php
<?php
return [
  'adminEmail' => 'you@example.com',       // recipient for approval emails
  'adminSecret' => 'STRONG_ADMIN_SECRET',  // used for admin_login
  'mailFrom'    => 'info@hangarplaner.de'  // From/Reply-To header for outgoing mail
];
```
Notes:
- If `sync/config.php` is missing, the server will try to load `sync/config.example.php` as a fallback (useful for dev). Override with a real `config.php` in production.
- `.gitignore` excludes `sync/config.php`, `sync/users.json`, `sync/mail_outbox.txt`.
- `.htaccess` in `sync/` blocks direct access to `users.json` and `mail_outbox.txt`. PHP files (like `auth.php`) are executed server-side.

### Running locally
- Serve the app (choose one):
  - `php -S localhost:8000` (recommended for PHP endpoints)
  - `python3 -m http.server 8000` (static only; PHP endpoints require a PHP server)
  - `npx serve .` (static only; PHP endpoints require a PHP server)
- Open `login.html` in your browser.

### End-to-end test flow
1) Registration
   - In `login.html`, open the Create Account tab and register.
   - Server writes `sync/users.json` and attempts to send an email to `adminEmail`.
   - If PHP `mail()` is unavailable or `adminEmail` is invalid, the message is appended to `sync/mail_outbox.txt`.
2) Approval
   - Check your mailbox or `sync/mail_outbox.txt` and open the `approve` link.
   - A confirmation page appears; the user is now approved.
3) Login
   - Return to `login.html` and sign in with the approved account.
4) Admin panel
   - Visit `sync/admin.html`.
   - Enter `adminSecret` from `sync/config.php` to log in as admin.
   - You can list users and block/unblock them.

### API endpoints (sync/auth.php)
- `POST action=register` — body: `{ email, password, displayName? }`
- `GET  action=approve&token=<token>` — approve user by token
- `POST action=login` — body: `{ email, password }`
- `POST action=logout`
- `GET  action=session` — returns current user session info
- Admin session:
  - `POST action=admin_login` — body: `{ secret }`
  - `POST action=admin_logout`
  - `GET  action=admin_list`
  - `POST action=admin_block` — body: `{ email }`
  - `POST action=admin_unblock` — body: `{ email }`

### Troubleshooting
- Emails not arriving: set a valid `mailFrom` and `adminEmail` in `sync/config.php`. On dev hosts without SMTP, check `sync/mail_outbox.txt` for the message content and approval link.
- Approval link host/URL: generated from the current request (`auth.php`). If behind a proxy, ensure `HTTP_HOST` is set correctly or access the link using the correct public hostname.
- Cannot log in after approval: verify the user has `approved=true` and not `blocked=true` in `sync/users.json`.
