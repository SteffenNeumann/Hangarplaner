# Save & Load Debugging Guide for Windows/Edge Systems

## Overview
The Hangarplaner-1 project uses multiple mechanisms for saving and loading project files, with automatic fallbacks for different browser capabilities. This guide helps diagnose and fix issues that occur specifically on Windows systems or when using Microsoft Edge browser.

## Architecture Overview

### Save & Load System Components

1. **Primary System**: `js/fileManager.js` - Modern File System Access API
2. **Fallback System**: `js/hangar-data.js` - Traditional file input/download
3. **UI Integration**: `js/hangar.js` - Event handlers and coordination
4. **Data Collection**: Multiple modules collect project data

### File System Access API Support

| Browser | Version | Windows Support | Notes |
|---------|---------|----------------|--------|
| Chrome | 86+ | ✅ Full | Best support |
| Edge | 88+ | ✅ Full | Should work like Chrome |
| Firefox | ❌ None | ❌ None | Uses fallback only |
| Safari | ❌ None | ❌ None | Uses fallback only |

## Common Issues on Windows/Edge

### 1. File System Access API Detection Issues

**Problem**: Edge may report API support but fail to execute properly.

**Symptoms**:
- "File System Access API wird nicht unterstützt" errors
- Dialog doesn't appear
- Silent failures during save/load

**Debug Steps**:
```javascript
// In browser console:
console.log('showSaveFilePicker' in window);
console.log('showOpenFilePicker' in window);
console.log(window.fileManager?.fileSystemSupported);
```

**Potential Fix**: Force fallback mode for Edge
```javascript
// In js/fileManager.js constructor, add Edge detection:
const isEdge = /Edg\//.test(navigator.userAgent);
this.fileSystemSupported = 
    ("showSaveFilePicker" in window && "showOpenFilePicker" in window) && !isEdge;
```

### 2. File Dialog Permission Issues

**Problem**: Windows security settings may block file system access.

**Symptoms**:
- "NotAllowedError" or "SecurityError" exceptions
- Dialog appears but immediately closes
- "User aborted" messages when user didn't cancel

**Debug Steps**:
```javascript
// Add to saveProject/loadProject try-catch blocks:
catch (error) {
    console.error('Full error details:', {
        name: error.name,
        message: error.message,
        code: error.code,
        stack: error.stack
    });
    
    // Check specific error types
    if (error.name === 'SecurityError') {
        console.log('Security restriction - may need HTTPS or different origin');
    }
    if (error.name === 'NotAllowedError') {
        console.log('Permission denied - check Windows security settings');
    }
}
```

### 3. JSON Parsing Issues

**Problem**: Windows line endings or encoding issues causing JSON parse failures.

**Symptoms**:
- "Unexpected token" errors during load
- "Invalid JSON" messages
- Corrupted special characters

**Debug Steps**:
```javascript
// Before JSON.parse, log raw content:
console.log('Raw file content:', jsonData);
console.log('Content length:', jsonData.length);
console.log('First 100 chars:', jsonData.substring(0, 100));
console.log('Last 100 chars:', jsonData.substring(jsonData.length - 100));
```

**Potential Fix**: Normalize line endings and encoding
```javascript
// In loadProject and loadFileFallback functions:
jsonData = jsonData.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
// Also ensure UTF-8 encoding in FileReader
reader.readAsText(file, 'utf-8');
```

### 4. Timing and Race Condition Issues

**Problem**: Edge may have different timing for async operations.

**Symptoms**:
- Intermittent failures
- Functions working on retry but not first attempt
- Missing UI updates after load

**Debug Steps**:
```javascript
// Add timing logs:
console.time('save-operation');
// ... save logic ...
console.timeEnd('save-operation');

// Check for race conditions:
console.log('DOM ready state:', document.readyState);
console.log('FileManager initialized:', !!window.fileManager);
console.log('Required functions available:', {
    collectTilesData: typeof collectTilesData,
    applyProjectData: typeof applyProjectData
});
```

### 5. Memory and Large File Issues

**Problem**: Windows/Edge may have different memory limits for file operations.

**Symptoms**:
- Failures with large project files
- Browser crashes during save/load
- "Out of memory" errors

**Debug Steps**:
```javascript
// Check file size and memory usage:
if (file) {
    console.log('File size:', file.size, 'bytes');
    console.log('Available memory:', performance.memory?.usedJSHeapSize);
}

// Monitor during JSON operations:
const beforeSize = JSON.stringify(projectData).length;
console.log('JSON size:', beforeSize, 'characters');
```

## Enhanced Error Handling Implementation

### Improved FileManager Constructor
```javascript
constructor() {
    // Enhanced browser detection
    const userAgent = navigator.userAgent;
    const isEdge = /Edg\//.test(userAgent);
    const isWindows = /Windows/.test(userAgent);
    
    // Conservative API detection for Windows/Edge
    this.fileSystemSupported = 
        ("showSaveFilePicker" in window && "showOpenFilePicker" in window) &&
        !(isEdge && isWindows); // Disable for Edge on Windows initially
    
    console.log(`Browser: ${isEdge ? 'Edge' : 'Other'}, OS: ${isWindows ? 'Windows' : 'Other'}`);
    console.log(`File System API: ${this.fileSystemSupported ? 'Enabled' : 'Disabled'}`);
}
```

### Robust Save Function
```javascript
async saveProject(projectData) {
    try {
        const startTime = performance.now();
        
        // Validate data before processing
        if (!projectData || typeof projectData !== 'object') {
            throw new Error('Invalid project data');
        }
        
        // Add metadata with Windows-safe timestamps
        if (!projectData.metadata) projectData.metadata = {};
        projectData.metadata.lastModified = new Date().toISOString();
        projectData.metadata.platform = navigator.platform;
        projectData.metadata.userAgent = navigator.userAgent;
        
        const fileName = `${projectData.metadata?.projectName || "HangarPlan"}.json`;
        
        if (this.fileSystemSupported) {
            try {
                // Add timeout for file dialog
                const dialogPromise = this.openSaveDialog(fileName);
                const timeoutPromise = new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Dialog timeout')), 10000)
                );
                
                const fileHandle = await Promise.race([dialogPromise, timeoutPromise]);
                
                // Create JSON with error handling
                let jsonString;
                try {
                    jsonString = JSON.stringify(projectData, null, 2);
                } catch (jsonError) {
                    throw new Error(`JSON serialization failed: ${jsonError.message}`);
                }
                
                // Write with progress indication
                window.showNotification("Saving file...", "info");
                const writable = await fileHandle.createWritable();
                await writable.write(jsonString);
                await writable.close();
                
                const duration = performance.now() - startTime;
                console.log(`Save completed in ${duration.toFixed(2)}ms`);
                
                window.showNotification(`Project saved successfully!`, "success");
                return true;
                
            } catch (error) {
                console.error('File System API error:', error);
                
                // Specific error handling
                if (error.name === 'AbortError') {
                    window.showNotification("Save cancelled", "info");
                    return false;
                } else if (error.name === 'SecurityError' || error.name === 'NotAllowedError') {
                    window.showNotification("Permission denied - trying fallback method", "warning");
                    // Fall through to fallback
                } else if (error.message === 'Dialog timeout') {
                    window.showNotification("Dialog timeout - trying fallback method", "warning");
                    // Fall through to fallback
                } else {
                    // For other errors, still try fallback
                    console.warn("Unexpected error, falling back:", error);
                }
                
                // Fallback to download
                const jsonString = JSON.stringify(projectData, null, 2);
                this.downloadFile(jsonString, fileName);
                window.showNotification("File downloaded (fallback method)", "success");
                return true;
            }
        } else {
            // Direct fallback
            const jsonString = JSON.stringify(projectData, null, 2);
            this.downloadFile(jsonString, fileName);
            window.showNotification("File downloaded", "success");
            return true;
        }
    } catch (error) {
        console.error('Save failed:', error);
        window.showNotification(`Save failed: ${error.message}`, "error");
        return false;
    }
}
```

### Robust Load Function
```javascript
async loadProject() {
    try {
        let jsonData = null;
        
        if (this.fileSystemSupported) {
            try {
                // Add timeout for file dialog
                const dialogPromise = this.openLoadDialog("json");
                const timeoutPromise = new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Dialog timeout')), 10000)
                );
                
                const file = await Promise.race([dialogPromise, timeoutPromise]);
                
                // Validate file
                if (!file || file.type !== 'application/json') {
                    if (file && !file.type.includes('json')) {
                        throw new Error(`Invalid file type: ${file.type}. Please select a JSON file.`);
                    }
                }
                
                console.log(`Loading file: ${file.name}, size: ${file.size} bytes`);
                
                // Read with progress indication
                window.showNotification("Reading file...", "info");
                jsonData = await file.text();
                
                // Normalize line endings for Windows
                jsonData = jsonData.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
                
            } catch (error) {
                if (error.name === 'AbortError') {
                    window.showNotification("Load cancelled", "info");
                    return null;
                } else if (error.message === 'Dialog timeout') {
                    window.showNotification("Dialog timeout - trying fallback method", "warning");
                    return this.loadFileFallback();
                } else {
                    console.error('File System API load error:', error);
                    window.showNotification("File dialog failed - trying fallback method", "warning");
                    return this.loadFileFallback();
                }
            }
        } else {
            return this.loadFileFallback();
        }
        
        // Parse and validate JSON
        if (jsonData) {
            try {
                const projectData = JSON.parse(jsonData);
                
                // Validate loaded data structure
                if (!projectData || typeof projectData !== 'object') {
                    throw new Error('Invalid project data structure');
                }
                
                window.showNotification("Project loaded successfully!", "success");
                return projectData;
                
            } catch (parseError) {
                console.error('JSON parse error:', parseError);
                console.log('Problematic JSON snippet:', jsonData.substring(0, 200));
                throw new Error(`File format error: ${parseError.message}`);
            }
        }
        
        return null;
    } catch (error) {
        console.error('Load failed:', error);
        window.showNotification(`Load failed: ${error.message}`, "error");
        return null;
    }
}
```

## Testing and Debugging Steps

### 1. Console Testing Commands

Run these in the browser console to test functionality:

```javascript
// Test browser capabilities
console.log('Browser support check:', {
    fileSystemAPI: 'showSaveFilePicker' in window,
    fileReader: 'FileReader' in window,
    download: 'download' in document.createElement('a'),
    userAgent: navigator.userAgent
});

// Test FileManager initialization
if (window.fileManager) {
    console.log('FileManager status:', {
        supported: window.fileManager.fileSystemSupported,
        fixedStorage: !!window.fileManager.fixedStorageDir,
        emulation: window.fileManager.useLocalStorageEmulation
    });
} else {
    console.error('FileManager not initialized');
}

// Test data collection
try {
    const testData = collectTilesData();
    console.log('Data collection works:', !!testData);
} catch (e) {
    console.error('Data collection failed:', e);
}

// Force fallback mode for testing
if (window.fileManager) {
    window.fileManager.fileSystemSupported = false;
    console.log('Forced fallback mode');
}
```

### 2. Enable Debugging Mode

Add this to localStorage to enable verbose logging:
```javascript
localStorage.setItem('hangar.debug', 'true');
localStorage.setItem('hangar.fileDebug', 'true');
```

### 3. Manual Testing Checklist

**For Windows/Edge Users:**

1. ✅ Open browser developer tools (F12)
2. ✅ Go to Console tab
3. ✅ Try saving a small project
4. ✅ Check for any error messages
5. ✅ If save fails, check if download works
6. ✅ Try loading the downloaded file
7. ✅ Test with different file sizes
8. ✅ Test with special characters in project names

### 4. Report Template

When reporting issues, include this information:

```javascript
// Run this in console and copy the output:
console.log('System Information:', {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    language: navigator.language,
    cookieEnabled: navigator.cookieEnabled,
    onLine: navigator.onLine,
    windowsVersion: /Windows NT ([\d.]+)/.exec(navigator.userAgent)?.[1] || 'Unknown'
});

console.log('File System Support:', {
    showSaveFilePicker: 'showSaveFilePicker' in window,
    showOpenFilePicker: 'showOpenFilePicker' in window,
    FileReader: 'FileReader' in window,
    download: 'download' in document.createElement('a')
});

console.log('Current Settings:', {
    fileManagerSupported: window.fileManager?.fileSystemSupported,
    useEmulation: window.fileManager?.useLocalStorageEmulation,
    fixedStorage: !!window.fileManager?.fixedStorageDir
});
```

## Quick Fixes for Common Issues

### Force Fallback Mode
If File System API causes issues, disable it:
```javascript
// Add to localStorage
localStorage.setItem('hangar.forceFileSystemFallback', 'true');

// Or modify js/fileManager.js line 10:
this.fileSystemSupported = false; // Force disable
```

### Enable CORS and HTTPS
For local development on Windows:
```bash
# Use HTTPS server instead of HTTP
npx http-server . --ssl --cert path/to/cert.pem --key path/to/key.pem -p 8443

# Or use built-in PHP server with HTTPS (requires OpenSSL)
php -S localhost:8443 -t . 
```

### Browser-Specific Workarounds
```javascript
// In js/fileManager.js, add browser-specific handling:
const browserWorkarounds = {
    edge: {
        timeoutMs: 15000, // Longer timeout for Edge
        retryAttempts: 2,
        forceDownload: false
    },
    chrome: {
        timeoutMs: 5000,
        retryAttempts: 1,
        forceDownload: false
    }
};
```

## Prevention Strategies

1. **Always provide fallbacks** - Never rely solely on modern APIs
2. **Validate early and often** - Check data integrity at every step
3. **User feedback** - Always inform users what's happening
4. **Graceful degradation** - Maintain functionality even when features fail
5. **Platform testing** - Test on actual Windows/Edge combinations

## Recovery Procedures

If save/load is completely broken:

1. **Emergency export**: Use browser's "Save Page As" on the application
2. **LocalStorage backup**: Export data from localStorage
3. **Manual data collection**: Copy data from input fields
4. **Server sync**: Use the sync functionality if available

```javascript
// Emergency data extraction:
const emergencyData = {
    tiles: Array.from(document.querySelectorAll('.hangar-cell')).map(tile => ({
        id: tile.dataset.cellId,
        aircraft: tile.querySelector('[id^="aircraft-"]')?.value || '',
        position: tile.querySelector('[id^="hangar-position-"]')?.value || '',
        notes: tile.querySelector('[id^="notes-"]')?.value || ''
    })),
    settings: {
        projectName: document.getElementById('projectName')?.value || ''
    },
    timestamp: new Date().toISOString()
};

console.log('Emergency data:', JSON.stringify(emergencyData, null, 2));
```

This debug guide should help identify and resolve most Save & Load issues on Windows/Edge systems.