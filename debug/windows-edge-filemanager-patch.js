/**
 * Windows/Edge Compatibility Patch for FileManager
 * 
 * This patch can be applied to enhance the FileManager for better
 * compatibility with Windows systems and Edge browser.
 * 
 * Apply this by either:
 * 1. Modifying js/fileManager.js directly
 * 2. Including this as a separate script after fileManager.js
 */

// Check if FileManager exists
if (typeof FileManager !== 'undefined' && window.FileManager) {
    console.log('🔧 Applying Windows/Edge compatibility patch to FileManager...');
    
    // Store original methods
    const originalConstructor = FileManager.prototype.constructor;
    const originalSaveProject = FileManager.prototype.saveProject;
    const originalLoadProject = FileManager.prototype.loadProject;
    const originalLoadFileFallback = FileManager.prototype.loadFileFallback;
    
    // Enhanced browser detection
    function getBrowserInfo() {
        const userAgent = navigator.userAgent;
        return {
            isEdge: /Edg\//.test(userAgent),
            isWindows: /Windows/.test(userAgent),
            isChrome: /Chrome/.test(userAgent) && !/Edg\//.test(userAgent),
            isFirefox: /Firefox/.test(userAgent),
            windowsVersion: /Windows NT ([\d.]+)/.exec(userAgent)?.[1] || 'Unknown'
        };
    }
    
    // Enhanced constructor with better compatibility detection
    FileManager.prototype.constructor = function() {
        // Call original constructor logic
        originalConstructor.call(this);
        
        const browserInfo = getBrowserInfo();
        
        // More conservative File System API detection
        const hasFileSystemAPI = "showSaveFilePicker" in window && "showOpenFilePicker" in window;
        
        // Check for Edge on Windows specific issues
        let shouldDisableAPI = false;
        
        // Disable for Edge on Windows by default (can be overridden)
        if (browserInfo.isEdge && browserInfo.isWindows) {
            const forceEnable = localStorage.getItem('hangar.forceFileSystemAPI') === 'true';
            if (!forceEnable) {
                shouldDisableAPI = true;
                console.log('🚨 Disabling File System API for Edge on Windows (use localStorage hangar.forceFileSystemAPI=true to override)');
            }
        }
        
        // Check for forced fallback
        const forceFallback = localStorage.getItem('hangar.forceFileSystemFallback') === 'true';
        if (forceFallback) {
            shouldDisableAPI = true;
            console.log('🚨 File System API disabled by user preference');
        }
        
        this.fileSystemSupported = hasFileSystemAPI && !shouldDisableAPI;
        this.browserInfo = browserInfo;
        
        // Enhanced timeout settings based on browser
        this.timeoutMs = browserInfo.isEdge ? 15000 : 10000;
        this.retryAttempts = browserInfo.isEdge ? 2 : 1;
        
        console.log(`🌐 Browser: ${browserInfo.isEdge ? 'Edge' : browserInfo.isChrome ? 'Chrome' : 'Other'}`);
        console.log(`💻 OS: ${browserInfo.isWindows ? `Windows ${browserInfo.windowsVersion}` : 'Other'}`);
        console.log(`📁 File System API: ${this.fileSystemSupported ? 'Enabled' : 'Disabled'}`);
        console.log(`⏱️ Timeout: ${this.timeoutMs}ms, Retries: ${this.retryAttempts}`);
    };
    
    // Enhanced save with better error handling and retries
    FileManager.prototype.saveProject = async function(projectData) {
        const startTime = performance.now();
        let attempt = 0;
        
        while (attempt < this.retryAttempts) {
            try {
                attempt++;
                console.log(`💾 Save attempt ${attempt}/${this.retryAttempts}`);
                
                // Validate data before processing
                if (!projectData || typeof projectData !== 'object') {
                    throw new Error('Invalid project data');
                }
                
                // Add enhanced metadata
                if (!projectData.metadata) projectData.metadata = {};
                projectData.metadata.lastModified = new Date().toISOString();
                projectData.metadata.platform = navigator.platform;
                projectData.metadata.userAgent = navigator.userAgent;
                projectData.metadata.saveAttempt = attempt;
                projectData.metadata.browserInfo = this.browserInfo;
                
                const fileName = `${projectData.metadata?.projectName || "HangarPlan"}.json`;
                
                if (this.fileSystemSupported) {
                    try {
                        console.log(`🎯 Using File System API (timeout: ${this.timeoutMs}ms)`);
                        
                        // Create JSON first to catch serialization errors early
                        let jsonString;
                        try {
                            jsonString = JSON.stringify(projectData, null, 2);
                            console.log(`📊 JSON size: ${jsonString.length} characters`);
                        } catch (jsonError) {
                            throw new Error(`JSON serialization failed: ${jsonError.message}`);
                        }
                        
                        // Show progress
                        if (window.showNotification) {
                            window.showNotification("Opening file dialog...", "info");
                        }
                        
                        // Add timeout for file dialog
                        const dialogPromise = this.openSaveDialog(fileName);
                        const timeoutPromise = new Promise((_, reject) => 
                            setTimeout(() => reject(new Error('Dialog timeout')), this.timeoutMs)
                        );
                        
                        const fileHandle = await Promise.race([dialogPromise, timeoutPromise]);
                        console.log('📁 File handle obtained');
                        
                        // Write with progress indication
                        if (window.showNotification) {
                            window.showNotification("Saving file...", "info");
                        }
                        
                        const writable = await fileHandle.createWritable();
                        await writable.write(jsonString);
                        await writable.close();
                        
                        const duration = performance.now() - startTime;
                        console.log(`✅ Save completed in ${duration.toFixed(2)}ms`);
                        
                        if (window.showNotification) {
                            window.showNotification(`Project saved successfully!`, "success");
                        }
                        return true;
                        
                    } catch (error) {
                        console.error(`❌ File System API error (attempt ${attempt}):`, error);
                        
                        // Handle specific error types
                        if (error.name === 'AbortError') {
                            if (window.showNotification) {
                                window.showNotification("Save cancelled by user", "info");
                            }
                            return false;
                        }
                        
                        // For other errors, try fallback on last attempt
                        if (attempt >= this.retryAttempts) {
                            console.log('🔄 Max attempts reached, falling back to download');
                            
                            if (error.name === 'SecurityError' || error.name === 'NotAllowedError') {
                                if (window.showNotification) {
                                    window.showNotification("Permission denied - using download instead", "warning");
                                }
                            } else if (error.message === 'Dialog timeout') {
                                if (window.showNotification) {
                                    window.showNotification("Dialog timeout - using download instead", "warning");
                                }
                            } else {
                                console.warn("Unexpected error, falling back:", error);
                                if (window.showNotification) {
                                    window.showNotification("File dialog failed - using download instead", "warning");
                                }
                            }
                            
                            // Fallback to download
                            const jsonString = JSON.stringify(projectData, null, 2);
                            this.downloadFile(jsonString, fileName);
                            if (window.showNotification) {
                                window.showNotification("File downloaded successfully", "success");
                            }
                            return true;
                        }
                        
                        // Wait before retry
                        if (attempt < this.retryAttempts) {
                            console.log(`⏳ Waiting 1s before retry...`);
                            await new Promise(resolve => setTimeout(resolve, 1000));
                        }
                    }
                } else {
                    // Direct fallback
                    console.log('📥 Using fallback download method');
                    const jsonString = JSON.stringify(projectData, null, 2);
                    this.downloadFile(jsonString, fileName);
                    if (window.showNotification) {
                        window.showNotification("File downloaded successfully", "success");
                    }
                    return true;
                }
            } catch (error) {
                console.error(`❌ Save failed (attempt ${attempt}):`, error);
                
                if (attempt >= this.retryAttempts) {
                    if (window.showNotification) {
                        window.showNotification(`Save failed: ${error.message}`, "error");
                    }
                    return false;
                }
                
                // Wait before retry
                console.log(`⏳ Waiting 2s before retry...`);
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }
        
        return false;
    };
    
    // Enhanced load with better error handling and retries
    FileManager.prototype.loadProject = async function() {
        let attempt = 0;
        
        while (attempt < this.retryAttempts) {
            try {
                attempt++;
                console.log(`📂 Load attempt ${attempt}/${this.retryAttempts}`);
                
                let jsonData = null;
                
                if (this.fileSystemSupported) {
                    try {
                        console.log(`🎯 Using File System API (timeout: ${this.timeoutMs}ms)`);
                        
                        if (window.showNotification) {
                            window.showNotification("Opening file dialog...", "info");
                        }
                        
                        // Add timeout for file dialog
                        const dialogPromise = this.openLoadDialog("json");
                        const timeoutPromise = new Promise((_, reject) => 
                            setTimeout(() => reject(new Error('Dialog timeout')), this.timeoutMs)
                        );
                        
                        const file = await Promise.race([dialogPromise, timeoutPromise]);
                        
                        // Validate file
                        if (!file) {
                            throw new Error('No file selected');
                        }
                        
                        // Relaxed file type checking for Windows
                        const isValidFile = file.name.toLowerCase().endsWith('.json') || 
                                          file.type === 'application/json' || 
                                          file.type === '' || // Windows sometimes doesn't set MIME type
                                          file.type.includes('json');
                        
                        if (!isValidFile) {
                            throw new Error(`Invalid file type. Expected JSON file, got: ${file.type || 'unknown'}`);
                        }
                        
                        console.log(`📄 Loading file: ${file.name}, size: ${file.size} bytes, type: ${file.type || 'unknown'}`);
                        
                        // Read with progress indication
                        if (window.showNotification) {
                            window.showNotification("Reading file...", "info");
                        }
                        
                        jsonData = await file.text();
                        
                        // Enhanced line ending normalization for Windows
                        const originalLength = jsonData.length;
                        jsonData = jsonData.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
                        
                        if (originalLength !== jsonData.length) {
                            console.log(`🔧 Normalized ${originalLength - jsonData.length} line ending characters`);
                        }
                        
                    } catch (error) {
                        console.error(`❌ File System API load error (attempt ${attempt}):`, error);
                        
                        if (error.name === 'AbortError') {
                            if (window.showNotification) {
                                window.showNotification("Load cancelled by user", "info");
                            }
                            return null;
                        }
                        
                        // For other errors, try fallback on last attempt
                        if (attempt >= this.retryAttempts) {
                            console.log('🔄 Max attempts reached, falling back to file input');
                            
                            if (error.message === 'Dialog timeout') {
                                if (window.showNotification) {
                                    window.showNotification("Dialog timeout - using file input instead", "warning");
                                }
                            } else {
                                if (window.showNotification) {
                                    window.showNotification("File dialog failed - using file input instead", "warning");
                                }
                            }
                            
                            return this.loadFileFallback();
                        }
                        
                        // Wait before retry
                        if (attempt < this.retryAttempts) {
                            console.log(`⏳ Waiting 1s before retry...`);
                            await new Promise(resolve => setTimeout(resolve, 1000));
                            continue; // Skip to next attempt
                        }
                    }
                } else {
                    console.log('📥 Using fallback file input method');
                    return this.loadFileFallback();
                }
                
                // Parse and validate JSON
                if (jsonData) {
                    try {
                        console.log(`🔍 Parsing JSON (${jsonData.length} characters)`);
                        
                        // Log JSON snippet for debugging
                        if (localStorage.getItem('hangar.fileDebug') === 'true') {
                            console.log('📋 First 200 characters:', jsonData.substring(0, 200));
                            console.log('📋 Last 200 characters:', jsonData.substring(Math.max(0, jsonData.length - 200)));
                        }
                        
                        const projectData = JSON.parse(jsonData);
                        
                        // Validate loaded data structure
                        if (!projectData || typeof projectData !== 'object') {
                            throw new Error('Invalid project data structure');
                        }
                        
                        // Log successful load
                        console.log('✅ Project data loaded successfully:', {
                            hasMetadata: !!projectData.metadata,
                            projectName: projectData.metadata?.projectName || 'Unknown',
                            primaryTiles: projectData.primaryTiles?.length || 0,
                            secondaryTiles: projectData.secondaryTiles?.length || 0
                        });
                        
                        if (window.showNotification) {
                            window.showNotification("Project loaded successfully!", "success");
                        }
                        return projectData;
                        
                    } catch (parseError) {
                        console.error('❌ JSON parse error:', parseError);
                        console.log('🔍 Problematic JSON snippet:', jsonData.substring(0, 200));
                        
                        if (attempt >= this.retryAttempts) {
                            throw new Error(`File format error: ${parseError.message}`);
                        }
                        
                        // Wait before retry
                        console.log(`⏳ Waiting 1s before retry...`);
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    }
                }
                
                return null;
                
            } catch (error) {
                console.error(`❌ Load failed (attempt ${attempt}):`, error);
                
                if (attempt >= this.retryAttempts) {
                    if (window.showNotification) {
                        window.showNotification(`Load failed: ${error.message}`, "error");
                    }
                    return null;
                }
                
                // Wait before retry
                console.log(`⏳ Waiting 2s before retry...`);
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }
        
        return null;
    };
    
    // Enhanced fallback with better Windows compatibility
    FileManager.prototype.loadFileFallback = function() {
        return new Promise((resolve, reject) => {
            console.log('📤 Using enhanced fallback file input');
            
            const fileInput = document.createElement("input");
            fileInput.type = "file";
            fileInput.accept = ".json,application/json"; // More explicit accept types
            fileInput.style.display = "none";
            fileInput.style.position = "absolute";
            fileInput.style.left = "-9999px";
            document.body.appendChild(fileInput);
            
            // Enhanced timeout for Windows
            const timeoutId = setTimeout(() => {
                console.warn('⏰ File input timeout');
                cleanup();
                resolve(null);
            }, 30000); // 30 second timeout for file selection
            
            const cleanup = () => {
                clearTimeout(timeoutId);
                if (fileInput && fileInput.parentNode) {
                    try {
                        document.body.removeChild(fileInput);
                    } catch (e) {
                        console.warn('Cleanup warning:', e);
                    }
                }
            };
            
            fileInput.onchange = async (event) => {
                try {
                    clearTimeout(timeoutId);
                    
                    const file = event.target.files?.[0];
                    if (!file) {
                        console.log('📭 No file selected');
                        cleanup();
                        resolve(null);
                        return;
                    }
                    
                    console.log(`📄 File selected: ${file.name}, size: ${file.size}, type: ${file.type}`);
                    
                    // Enhanced file validation for Windows
                    const isValidFile = file.name.toLowerCase().endsWith('.json') ||
                                      file.type === 'application/json' ||
                                      file.type === '' || // Windows often doesn't set MIME type
                                      file.type.includes('json');
                    
                    if (!isValidFile) {
                        const error = new Error(`Invalid file type. Expected JSON file, got: ${file.type || 'unknown'}`);
                        cleanup();
                        reject(error);
                        return;
                    }
                    
                    const reader = new FileReader();
                    
                    reader.onload = (e) => {
                        try {
                            let content = e.target.result;
                            
                            // Enhanced line ending normalization
                            const originalLength = content.length;
                            content = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
                            
                            if (originalLength !== content.length) {
                                console.log(`🔧 Normalized ${originalLength - content.length} line ending characters`);
                            }
                            
                            // Parse JSON
                            const projectData = JSON.parse(content);
                            
                            // Validate structure
                            if (!projectData || typeof projectData !== 'object') {
                                throw new Error('Invalid project data structure');
                            }
                            
                            console.log('✅ Fallback load successful');
                            
                            if (window.showNotification) {
                                window.showNotification("Project loaded successfully!", "success");
                            }
                            
                            cleanup();
                            resolve(projectData);
                            
                        } catch (error) {
                            console.error('❌ Fallback parse error:', error);
                            
                            if (window.showNotification) {
                                window.showNotification(`File format error: ${error.message}`, "error");
                            }
                            
                            cleanup();
                            reject(error);
                        }
                    };
                    
                    reader.onerror = (e) => {
                        const error = new Error("Failed to read file");
                        console.error('❌ FileReader error:', error);
                        
                        if (window.showNotification) {
                            window.showNotification("Failed to read file", "error");
                        }
                        
                        cleanup();
                        reject(error);
                    };
                    
                    // Use UTF-8 encoding explicitly for Windows compatibility
                    reader.readAsText(file, 'utf-8');
                    
                } catch (error) {
                    console.error('❌ Fallback error:', error);
                    cleanup();
                    reject(error);
                }
            };
            
            // Trigger file dialog
            try {
                fileInput.click();
            } catch (error) {
                console.error('❌ Failed to trigger file dialog:', error);
                cleanup();
                reject(error);
            }
        });
    };
    
    console.log('✅ Windows/Edge compatibility patch applied successfully');
    
    // Add global debug helpers
    window.debugFileManager = function() {
        const browserInfo = getBrowserInfo();
        console.log('🔍 FileManager Debug Info:', {
            browserInfo,
            fileSystemSupported: window.fileManager?.fileSystemSupported,
            hasFileManager: !!window.fileManager,
            timeoutMs: window.fileManager?.timeoutMs,
            retryAttempts: window.fileManager?.retryAttempts
        });
    };
    
    // Test function for Windows/Edge users
    window.testFileManagerCompatibility = async function() {
        console.log('🧪 Testing FileManager compatibility...');
        
        const browserInfo = getBrowserInfo();
        console.log('Browser info:', browserInfo);
        
        // Test data collection
        try {
            const testData = window.collectTilesData?.() || { test: true };
            console.log('✅ Data collection works');
        } catch (e) {
            console.error('❌ Data collection failed:', e);
        }
        
        // Test FileManager initialization
        if (window.fileManager) {
            console.log('✅ FileManager initialized');
            console.log('File System API support:', window.fileManager.fileSystemSupported);
        } else {
            console.error('❌ FileManager not found');
        }
        
        console.log('🧪 Compatibility test complete');
    };
    
} else {
    console.warn('⚠️ FileManager not found - patch not applied');
}