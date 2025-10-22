# Fleet Database Synchronization

## Overview
The Fleet Database caches aircraft data from the AeroDataBox API to minimize API calls and stay within monthly quota limits.

## Data Storage Location

### Server-Side
**File:** `sync/fleet-database.json`

This JSON file stores:
- Aircraft fleet data for all configured airlines (CLH, LHX)
- Metadata (last sync timestamp, total aircraft count)
- Individual aircraft details (registration, type, manufacturing year, etc.)

**File Structure:**
```json
{
  "fleetDatabase": {
    "version": "1.0.0",
    "lastUpdate": 1729490000000,
    "airlines": {
      "CLH": {
        "code": "CLH",
        "name": "Lufthansa CityLine",
        "color": "#0066CC",
        "aircrafts": [...],
        "lastSync": 1729490000000,
        "totalCount": 50
      },
      "LHX": {...}
    },
    "metadata": {
      "created": 1729400000000,
      "lastModified": 1729490000000,
      "totalAircrafts": 75,
      "syncStatus": "synced",
      "apiCalls": 5,
      "lastApiSync": 1729490000000
    }
  }
}
```

### Backend API
**Endpoint:** `sync/fleet-database.php`

Supports:
- `GET` - Load existing fleet data
- `POST` - Sync/update fleet data
- `PUT` - Add or update individual aircraft
- `DELETE` - Remove aircraft or airlines
- `GET ?action=status` - Check database status

## Sync Strategy

### Sync Interval: 4 Weeks (28 Days)

API synchronization occurs **only once every 4 weeks** to conserve the monthly AeroDataBox API quota.

```javascript
const syncInterval = 28 * 24 * 60 * 60 * 1000; // 28 days in milliseconds
```

### Sync Behavior

#### When Cached Data Exists (Typical Flow)
1. **Load cached data** from `sync/fleet-database.json`
2. **Check last sync timestamp** (`stats.lastApiSync`)
3. **If sync needed** (>28 days):
   - Attempt API call to `loadAllFleetDataFromAPI()`
   - **If 429 rate limit error**:
     - Set `window.FleetDatabase.apiQuotaExceeded = true`
     - Skip sync, keep cached data
     - Show user warning: _"⚠️ AeroDataBox API quota exceeded. Showing cached fleet data (may not be up-to-date)."_
   - **If API succeeds**:
     - Perform differential sync (only changes)
     - Update `sync/fleet-database.json`
     - Update local cache
4. **If sync not needed** (<28 days):
   - Use cached data from server
   - Skip API call entirely

#### First Load (No Cached Data)
1. Attempt to load from AeroDataBox API
2. **If 429 rate limit error**:
   - Show error: _"⚠️ AeroDataBox API quota exceeded. Unable to load initial fleet data. Please try again later."_
   - Display empty state
3. **If API succeeds**:
   - Perform initial sync (full data load)
   - Save to `sync/fleet-database.json`
   - Cache locally

## 429 Rate Limit Handling

### Detection Points
1. **`loadSinglePage()`** - HTTP 429 detected in XHR response
2. **`loadSimpleAirlineFleet()`** - Catches 429 errors, returns partial data
3. **`loadAllFleetDataFromAPI()`** - Returns empty `{ airlines: {} }` on 429
4. **`loadFleetData()`** - Checks for 429 flag and empty API response

### Graceful Degradation
- **No exceptions thrown** - errors handled gracefully
- **Cached data preserved** - never overwritten with empty API data
- **User notifications** - clear warning messages via `updateStatus()`
- **Logging** - All 429 events logged with `[FleetDB]` prefix for filtering

### Recovery
The system automatically recovers on the next quota reset (monthly). Simply reload the page after the quota resets.

## API Quota Conservation

### Current Limits (AeroDataBox BASIC tier)
- **Monthly quota**: Limited requests per month
- **Current behavior**: Once per 4 weeks = ~1 sync per month
- **Safety margin**: Leaves room for testing and other API calls

### Optimization Strategies
1. **Long sync intervals** (28 days)
2. **Differential sync** (only changes after first load)
3. **Server-side caching** (multiple users share cached data)
4. **429 fallback** (graceful degradation on quota exceeded)

## User-Facing Behavior

### Normal Operation (Within Quota)
- Data syncs automatically every 4 weeks
- Users see up-to-date aircraft information
- No visible warnings or errors

### Quota Exceeded (429 Error)
- **With cached data**: Shows last synced data with warning banner
- **Without cached data**: Shows error message, empty table
- **User action**: Wait for quota reset (monthly)

### Status Messages
- ✅ _"75 aircraft successfully loaded"_ - Normal load
- ⚠️ _"AeroDataBox API quota exceeded. Showing cached fleet data (may not be up-to-date)."_ - Quota exceeded with fallback
- ❌ _"AeroDataBox API quota exceeded. Unable to load initial fleet data. Please try again later."_ - Quota exceeded on first load

## Debug & Monitoring

### Console Logging
All sync events are logged with `[FleetDB]` prefix for easy filtering:

```javascript
// Examples
console.warn("[FleetDB] AeroDataBox 429 rate limit for CLH. Falling back to cached data.")
console.warn("[FleetDB] 429 fallback active. Skipping API sync and keeping cached data.")
console.log("⏭️ API-Synchronisation übersprungen (letzte Sync < 4 Wochen)")
```

### Debug Helpers
```javascript
// Check quota status
console.log(window.FleetDatabase.apiQuotaExceeded); // true if quota exceeded

// Check manager status
window.fleetDatabaseManager.getStatistics();
```

### Manual Sync (Development Only)
To force a sync before 28 days:
1. Open browser console
2. Modify the last sync timestamp in server data
3. Reload page

## File Locations

| Component | Path | Purpose |
|-----------|------|---------|
| Server Data | `sync/fleet-database.json` | Persistent storage of fleet data |
| Backend API | `sync/fleet-database.php` | REST API for data operations |
| Manager Class | `js/fleet-database-manager.js` | Client-side data manager |
| UI Component | `js/fleet-database.js` | User interface and display logic |
| HTML Page | `fleet-database.html` | Fleet database viewer page |

## Maintenance

### Clearing Cached Data
To force a complete re-sync:
1. Delete `sync/fleet-database.json` on server
2. Reload the fleet database page
3. New data will be fetched from API (if quota available)

### Monitoring API Usage
Check `sync/fleet-database.json` metadata:
```json
"metadata": {
  "apiCalls": 5,        // Total API calls made
  "lastApiSync": 17294... // Timestamp of last sync
}
```

### Adjusting Sync Interval
Edit `js/fleet-database.js`:
```javascript
const syncInterval = 28 * 24 * 60 * 60 * 1000; // Change 28 to desired days
```

## Best Practices

1. **Respect API Limits**: Current 28-day interval is conservative
2. **Monitor Logs**: Watch for `[FleetDB]` warnings indicating quota issues
3. **Test Carefully**: Use development environments to avoid production quota drain
4. **Cache First**: Always load from server cache before attempting API sync
5. **User Communication**: Clear messaging when quota exceeded helps user understanding

---

**Last Updated:** 2025-10-21  
**Version:** 1.0
