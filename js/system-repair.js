/**
 * system-repair.js
 * Repariert kritische Probleme im HangarPlanner System
 * Behebt Konflikte zwischen localStorage und Server-Sync
 */

window.SystemRepair = {
    
    /**
     * Hauptreparaturfunktion
     */
    async repairSystem() {
        console.log("🔧 === SYSTEM-REPARATUR STARTET ===");
        
        await this.repairLocalStorageConflicts();
        await this.consolidateFunctionDefinitions();
        await this.cleanupDeprecatedData();
        await this.synchronizeStorageSystems();
        
        console.log("✅ === SYSTEM-REPARATUR ABGESCHLOSSEN ===");
    },

    /**
     * Repariert localStorage Konflikte
     */
    async repairLocalStorageConflicts() {
        console.log("📦 Repariere localStorage Konflikte...");
        
        // 1. Identifiziere doppelte Daten
        const deprecatedKeys = [
            'hangarPlannerSettings',
            'hangarPlannerData',
            'hangarTileData'
        ];
        
        const conflictData = {};
        
        deprecatedKeys.forEach(key => {
            const value = localStorage.getItem(key);
            if (value) {
                try {
                    conflictData[key] = JSON.parse(value);
                    console.log(`⚠️ Deprecated Key gefunden: ${key}`);
                } catch (e) {
                    console.warn(`❌ Ungültiges JSON in ${key}:`, e);
                }
            }
        });
        
        // 2. Migriere zu neuem System falls Data vorhanden
        if (Object.keys(conflictData).length > 0) {
            await this.migrateConflictData(conflictData);
        }
        
        // 3. Bereinige alte Keys
        deprecatedKeys.forEach(key => {
            if (localStorage.getItem(key)) {
                console.log(`🗑️ Entferne deprecated Key: ${key}`);
                localStorage.removeItem(key);
            }
        });
    },

    /**
     * Migriert konfliktbehaftete Daten
     */
    async migrateConflictData(conflictData) {
        console.log("🔄 Migriere konfliktbehaftete Daten...");
        
        try {
            // Sammle aktuelle Serverdaten
            let serverData = {};
            try {
                const response = await fetch('sync/data.php');
                if (response.ok) {
                    serverData = await response.json();
                }
            } catch (error) {
                console.warn("⚠️ Server nicht erreichbar, nur lokale Migration");
            }
            
            // Merge Daten intelligent
            const mergedData = this.intelligentMerge(serverData, conflictData);
            
            // Speichere konsolidierte Daten
            if (window.displayOptions) {
                if (mergedData.settings && mergedData.settings.displayOptions) {
                    window.displayOptions.current = {
                        ...window.displayOptions.defaults,
                        ...mergedData.settings.displayOptions
                    };
                    await window.displayOptions.saveToServer();
                }
            }
            
            console.log("✅ Daten erfolgreich migriert");
            
        } catch (error) {
            console.error("❌ Fehler bei der Datenmigration:", error);
        }
    },

    /**
     * Intelligenter Merge von Datenquellen
     */
    intelligentMerge(serverData, conflictData) {
        const merged = JSON.parse(JSON.stringify(serverData)); // Deep copy
        
        // Merge deprecated hangarPlannerSettings
        if (conflictData.hangarPlannerSettings) {
            if (!merged.settings) merged.settings = {};
            if (!merged.settings.displayOptions) merged.settings.displayOptions = {};
            
            const oldSettings = conflictData.hangarPlannerSettings;
            merged.settings.displayOptions = {
                ...merged.settings.displayOptions,
                tilesCount: oldSettings.tilesCount || 8,
                secondaryTilesCount: oldSettings.secondaryTilesCount || 4,
                layout: oldSettings.layout || 4,
                darkMode: oldSettings.darkMode || false,
                viewMode: oldSettings.tableView || false,
                zoomLevel: oldSettings.zoomLevel || 100
            };
        }
        
        // Merge deprecated hangarPlannerData
        if (conflictData.hangarPlannerData) {
            const oldData = conflictData.hangarPlannerData;
            
            if (oldData.metadata) {
                merged.metadata = { ...merged.metadata, ...oldData.metadata };
            }
            
            if (oldData.settings) {
                merged.settings = { ...merged.settings, ...oldData.settings };
            }
            
            if (oldData.primaryTiles || oldData.tiles) {
                merged.primaryTiles = oldData.primaryTiles || oldData.tiles || [];
            }
            
            if (oldData.secondaryTiles) {
                merged.secondaryTiles = oldData.secondaryTiles;
            }
        }
        
        // Aktualisiere Metadaten
        merged.metadata = {
            ...merged.metadata,
            migratedAt: new Date().toISOString(),
            lastModified: new Date().toISOString()
        };
        
        return merged;
    },

    /**
     * Konsolidiert mehrfache Funktionsdefinitionen
     */
    async consolidateFunctionDefinitions() {
        console.log("⚡ Konsolidiere Funktionsdefinitionen...");
        
        // 1. collectAllHangarData konsolidieren
        this.consolidateCollectAllHangarData();
        
        // 2. saveFlightTimeValueToLocalStorage konsolidieren
        this.consolidateSaveFlightTimeValue();
        
        // 3. Event Manager konsolidieren
        this.consolidateEventManagers();
    },

    /**
     * Konsolidiert collectAllHangarData Funktion
     */
    consolidateCollectAllHangarData() {
        // Verwende hangar-data.js Implementation als Master
        if (window.hangarData && typeof window.hangarData.collectAllHangarData === 'function') {
            window.collectAllHangarData = window.hangarData.collectAllHangarData;
            console.log("✅ collectAllHangarData: hangar-data.js als Master gesetzt");
        } else if (typeof window.collectAllHangarData === 'function') {
            console.log("ℹ️ collectAllHangarData: Bestehende Implementierung beibehalten");
        } else {
            // Fallback erstellen
            window.collectAllHangarData = this.createFallbackCollectFunction();
            console.log("🔧 collectAllHangarData: Fallback-Implementierung erstellt");
        }
    },

    /**
     * Erstellt Fallback für collectAllHangarData
     */
    createFallbackCollectFunction() {
        return function() {
            console.log("🔧 Fallback collectAllHangarData ausgeführt");
            
            const projectName = document.getElementById("projectName")?.value || "HangarPlan";
            const projectId = document.getElementById("projectId")?.value || Date.now().toString();
            
            return {
                id: projectId,
                metadata: {
                    projectName: projectName,
                    exportDate: new Date().toISOString(),
                    lastModified: new Date().toISOString(),
                    source: "SystemRepair-Fallback"
                },
                settings: {
                    tilesCount: parseInt(document.getElementById("tilesCount")?.value) || 8,
                    secondaryTilesCount: parseInt(document.getElementById("secondaryTilesCount")?.value) || 0,
                    layout: parseInt(document.getElementById("layoutType")?.value) || 4
                },
                primaryTiles: [],
                secondaryTiles: []
            };
        };
    },

    /**
     * Konsolidiert saveFlightTimeValueToLocalStorage
     */
    consolidateSaveFlightTimeValue() {
        // Prüfe auf mehrfache Definitionen
        const implementations = [];
        
        if (window.hangarEvents && typeof window.hangarEvents.saveFlightTimeValueToLocalStorage === 'function') {
            implementations.push('hangar-events');
        }
        
        if (typeof window.saveFlightTimeValueToLocalStorage === 'function' && 
            !window.saveFlightTimeValueToLocalStorage.toString().includes('Fallback')) {
            implementations.push('global');
        }
        
        if (implementations.length > 1) {
            console.log(`⚠️ Mehrfache Implementierungen von saveFlightTimeValueToLocalStorage: ${implementations.join(', ')}`);
            // Verwende hangar-events als Master
            if (window.hangarEvents && typeof window.hangarEvents.saveFlightTimeValueToLocalStorage === 'function') {
                window.saveFlightTimeValueToLocalStorage = window.hangarEvents.saveFlightTimeValueToLocalStorage;
                console.log("✅ saveFlightTimeValueToLocalStorage: hangar-events als Master gesetzt");
            }
        }
    },

    /**
     * Konsolidiert Event Manager
     */
    consolidateEventManagers() {
        const managers = [];
        
        if (window.eventManager) managers.push('eventManager');
        if (window.improvedEventManager) managers.push('improvedEventManager');
        if (window.hangarEventManager) managers.push('hangarEventManager');
        
        if (managers.length > 1) {
            console.log(`⚠️ Mehrfache Event Manager gefunden: ${managers.join(', ')}`);
            console.log("ℹ️ Verwende hangarEventManager als primären Manager");
            
            // Setze primären Event Manager
            if (window.hangarEventManager) {
                window.primaryEventManager = window.hangarEventManager;
            } else if (window.improvedEventManager) {
                window.primaryEventManager = window.improvedEventManager;
            } else {
                window.primaryEventManager = window.eventManager;
            }
        }
    },

    /**
     * Bereinigt deprecated Daten
     */
    async cleanupDeprecatedData() {
        console.log("🧹 Bereinige deprecated Daten...");
        
        // Entferne deprecated localStorage Keys (nach Migration)
        const keysToClean = [
            'hangarPlannerSettings',
            'hangarPlannerData', 
            'hangarTileData'
        ];
        
        keysToClean.forEach(key => {
            if (localStorage.getItem(key)) {
                localStorage.removeItem(key);
                console.log(`🗑️ Bereinigt: ${key}`);
            }
        });
        
        // Bereinige duplicate Event Listener (falls möglich)
        this.cleanupEventListeners();
    },

    /**
     * Bereinigt Event Listener
     */
    cleanupEventListeners() {
        console.log("🎯 Bereinige Event Listener...");
        
        // Identifiziere Buttons mit möglichen mehrfachen Listenern
        const criticalButtons = [
            'saveBtn',
            'loadBtn',
            'fetchFlightData',
            'exportPdfBtn'
        ];
        
        criticalButtons.forEach(buttonId => {
            const button = document.getElementById(buttonId);
            if (button) {
                // Klone Element um alle Event Listener zu entfernen
                const newButton = button.cloneNode(true);
                button.parentNode.replaceChild(newButton, button);
                console.log(`🔄 Event Listener für ${buttonId} zurückgesetzt`);
            }
        });
    },

    /**
     * Synchronisiert Storage-Systeme
     */
    async synchronizeStorageSystems() {
        console.log("🔄 Synchronisiere Storage-Systeme...");
        
        try {
            // 1. Prüfe aktuellen Zustand
            const localData = this.collectLocalData();
            const serverData = await this.fetchServerData();
            
            // 2. Bestimme aktuellste Version
            const latestData = this.determineLatestVersion(localData, serverData);
            
            // 3. Synchronisiere beide Systeme
            if (latestData) {
                await this.syncToServer(latestData);
                this.syncToLocal(latestData);
                console.log("✅ Storage-Systeme synchronisiert");
            }
            
        } catch (error) {
            console.error("❌ Fehler bei Storage-Synchronisation:", error);
        }
    },

    /**
     * Sammelt lokale Daten
     */
    collectLocalData() {
        try {
            if (typeof window.collectAllHangarData === 'function') {
                return window.collectAllHangarData();
            }
        } catch (error) {
            console.warn("⚠️ Fehler beim Sammeln lokaler Daten:", error);
        }
        return null;
    },

    /**
     * Holt Server-Daten
     */
    async fetchServerData() {
        try {
            const response = await fetch('sync/data.php');
            if (response.ok) {
                return await response.json();
            }
        } catch (error) {
            console.warn("⚠️ Fehler beim Laden der Server-Daten:", error);
        }
        return null;
    },

    /**
     * Bestimmt die aktuellste Version
     */
    determineLatestVersion(localData, serverData) {
        if (!localData && !serverData) return null;
        if (!localData) return serverData;
        if (!serverData) return localData;
        
        // Vergleiche Timestamps
        const localTime = localData.metadata?.lastModified || localData.metadata?.exportDate || "1970-01-01";
        const serverTime = serverData.metadata?.lastModified || serverData.metadata?.timestamp || "1970-01-01";
        
        return new Date(localTime) > new Date(serverTime) ? localData : serverData;
    },

    /**
     * Sync zu Server
     */
    async syncToServer(data) {
        if (window.displayOptions && typeof window.displayOptions.saveToServer === 'function') {
            await window.displayOptions.saveToServer();
        }
    },

    /**
     * Sync zu Local
     */
    syncToLocal(data) {
        if (window.displayOptions) {
            window.displayOptions.current = {
                ...window.displayOptions.defaults,
                ...(data.settings?.displayOptions || {})
            };
            window.displayOptions.updateUI();
        }
    }
};

// Auto-Start bei Bedarf
if (window.location.search.includes('repair=true')) {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => {
            window.SystemRepair.repairSystem();
        }, 3000);
    });
}
