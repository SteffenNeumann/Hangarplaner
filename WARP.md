
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
- **Multi-Mode Sync**: Standalone, Master (write), Slave (read-only) modes
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

- Multi-master behavior
  - Multiple clients may be write-enabled at the same time
  - Server no longer enforces an exclusive master lock; writes require X-Sync-Role: master
  - Conflict policy: last write wins at the field/tile level, with periodic read-back to converge
  - Recommendation: keep Read ON for write-enabled clients to see other changes promptly
- Modes
  - Standalone: local only; no server reads or writes
  - Sync (read-only): reads from server; client edits do not write to server
  - Master (write-enabled): writes to server; multiple users can be write-enabled in parallel (multi-master)
  - Write-only (Master with Read OFF): writes to server; no server reads
- Client-side gating
  - Writes: All server writes are centralized through `window.serverSync.syncWithServer()`; header `X-Sync-Role: master` is sent only when Write is enabled
  - Reads: All server reads are gated by the Read Data toggle. When Read is OFF, the app skips initial server load at startup and disables periodic read-back, even in Master mode
  - Display options in read-only mode save locally only and show “Saved locally (read-only mode)”
- UI behavior in Sync (read-only)
  - Editing controls within `#hangarGrid` and `#secondaryHangarGrid` are temporarily disabled
  - No persistent banner. An on-demand modal hint appears when the user attempts to edit (inputs remain disabled)
  - A subtle status indicator remains (e.g., mode label and last-load time pill in header)
  - Mode toggles and navigation remain usable
- Write-only specifics
  - Startup: no GET requests to `sync/data.php` (initial server load is skipped)
  - No periodic reads: Master read-back loop is disabled when Read is OFF
  - Manual Sync: triggers a POST-only sync (no reads) because only `syncWithServer()` runs
  - Reset screen: clears UI values (Aircraft, Arr/Dep incl. dataset.iso, Pos/Route, Notes, Tow, Status) and keeps Hangar Position; does not purge localStorage; suppresses local rehydrate for ~10s to avoid repopulating just after reset
- Master (Read+Write) specifics
  - Manual Sync: POSTs changes and then immediately reads from the server to refresh local state (if Read is ON)
- Server endpoint
  - `sync/data.php` accepts GET/POST; client-side gating prevents writes in read-only and prevents reads in write-only

### Manual test checklist (Sync system)
1) Read-only mode (Sync)
   - Enable Read Data ON, Write Data OFF
   - Edit a tile field; expect no POST to `sync/data.php`
   - Server data not modified; UI shows read-only banner; inputs are disabled
2) Master mode (Read+Write)
   - Enable Read Data ON, Write Data ON
   - Edit a tile field; a write occurs via `serverSync.syncWithServer()`
   - Changes persist and replicate to a read-only client
3) Standalone
   - Disable both toggles; edits only affect local state; no server traffic
4) Write-only (Master with Read OFF)
   - Enable Read Data OFF, Write Data ON
   - Reset screen from Display menu; tiles stay cleared and are not repopulated
   - No GET requests to `sync/data.php` (at startup or after reset)
   - Edits trigger POST with `X-Sync-Role: master` (verify via network tab)
   - Manual Sync triggers POST-only (no GET)
