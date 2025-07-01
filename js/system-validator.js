/**
 * system-validator.js
 * Rekursiver Validator für alle HangarPlanner Funktionen
 * Prüft auf Integrität, Konflikte und negative Beeinflussungen
 */

window.SystemValidator = {
    issues: [],
    warnings: [],
    results: {
        total: 0,
        passed: 0,
        failed: 0,
        warnings: 0
    },

    /**
     * Hauptvalidierungsfunktion - führt alle Tests durch
     */
    async runCompleteValidation() {
        console.log("🔍 === SYSTEM-VALIDIERUNG STARTET ===");
        this.resetResults();
        
        await this.validateStorageIntegrity();
        await this.validateFunctionConflicts();
        await this.validateDataConsistency();
        await this.validateServerSync();
        await this.validateEventManagement();
        await this.validateUIIntegrity();
        
        this.generateReport();
        return this.results;
    },

    /**
     * Setzt Ergebnisse zurück
     */
    resetResults() {
        this.issues = [];
        this.warnings = [];
        this.results = { total: 0, passed: 0, failed: 0, warnings: 0 };
    },

    /**
     * Validiert die Speicher-Integrität (localStorage vs Server)
     */
    async validateStorageIntegrity() {
        console.log("📦 Validiere Speicher-Integrität...");
        
        this.testFunction("localStorage Migration System", () => {
            if (!window.localStorageMigration) {
                throw new Error("localStorage Migration System nicht verfügbar");
            }
            
            // Prüfe deprecated localStorage usage
            const deprecatedKeys = ['hangarPlannerSettings', 'hangarPlannerData'];
            deprecatedKeys.forEach(key => {
                const value = localStorage.getItem(key);
                if (value) {
                    this.addWarning(`Veralteter localStorage Key gefunden: ${key}`);
                }
            });
            
            return true;
        });

        this.testFunction("Display Options System", () => {
            if (!window.displayOptions) {
                throw new Error("Display Options System nicht verfügbar");
            }
            
            // Prüfe ob aktuelle Werte gesetzt sind
            if (!window.displayOptions.current) {
                throw new Error("Display Options nicht initialisiert");
            }
            
            return true;
        });

        this.testFunction("Storage Browser System", () => {
            if (!window.storageBrowser) {
                this.addWarning("Storage Browser nicht verfügbar");
                return true;
            }
            
            // Prüfe auf Konflikte
            if (window.isApplyingServerData === undefined) {
                throw new Error("isApplyingServerData Flag nicht verfügbar");
            }
            
            return true;
        });
    },

    /**
     * Validiert Funktionskonflikte
     */
    async validateFunctionConflicts() {
        console.log("⚡ Validiere Funktionskonflikte...");
        
        this.testFunction("Function Collision Detection", () => {
            const criticalFunctions = [
                'collectAllHangarData',
                'saveFlightTimeValueToLocalStorage',
                'applyLoadedHangarPlan'
            ];
            
            criticalFunctions.forEach(funcName => {
                const func = window[funcName];
                if (typeof func !== 'function') {
                    throw new Error(`Kritische Funktion fehlt: ${funcName}`);
                }
                
                // Prüfe auf mehrfache Definitionen
                const funcStr = func.toString();
                if (funcStr.includes('Fallback')) {
                    this.addWarning(`Fallback-Implementierung aktiv für: ${funcName}`);
                }
            });
            
            return true;
        });

        this.testFunction("Event Manager Conflicts", () => {
            // Prüfe auf mehrfache Event-Manager
            const eventManagers = [
                window.eventManager,
                window.improvedEventManager,
                window.conflictResolver
            ].filter(Boolean);
            
            if (eventManagers.length > 1) {
                this.addWarning(`Mehrfache Event-Manager gefunden: ${eventManagers.length}`);
            }
            
            return true;
        });
    },

    /**
     * Validiert Datenkonsistenz
     */
    async validateDataConsistency() {
        console.log("📊 Validiere Datenkonsistenz...");
        
        this.testFunction("Data Collection Integrity", () => {
            try {
                const data = window.collectAllHangarData();
                
                if (!data) {
                    throw new Error("collectAllHangarData gibt null zurück");
                }
                
                // Prüfe Datenstruktur
                const requiredFields = ['id', 'metadata', 'settings'];
                requiredFields.forEach(field => {
                    if (!data[field]) {
                        throw new Error(`Pflichtfeld fehlt: ${field}`);
                    }
                });
                
                // Prüfe Metadaten
                if (!data.metadata.projectName) {
                    this.addWarning("Projektname nicht gesetzt");
                }
                
                return true;
            } catch (error) {
                throw new Error(`Data Collection Fehler: ${error.message}`);
            }
        });

        this.testFunction("Tiles Data Consistency", () => {
            // Prüfe primäre Kacheln
            const primaryGrid = document.getElementById('hangarGrid');
            if (!primaryGrid) {
                throw new Error("Primäres Hangar Grid nicht gefunden");
            }
            
            const tiles = primaryGrid.querySelectorAll('.hangar-cell');
            if (tiles.length === 0) {
                throw new Error("Keine Hangar-Kacheln gefunden");
            }
            
            // Prüfe Kachel-IDs auf Eindeutigkeit
            const ids = new Set();
            tiles.forEach(tile => {
                const aircraftInput = tile.querySelector('.aircraft-id');
                if (aircraftInput) {
                    const id = aircraftInput.id;
                    if (ids.has(id)) {
                        throw new Error(`Doppelte Kachel-ID gefunden: ${id}`);
                    }
                    ids.add(id);
                }
            });
            
            return true;
        });
    },

    /**
     * Validiert Server-Synchronisation
     */
    async validateServerSync() {
        console.log("🔄 Validiere Server-Synchronisation...");
        
        this.testFunction("Server Connection", async () => {
            try {
                const response = await fetch('sync/data.php', {
                    method: 'GET'
                });
                
                // Status 404 ist OK (keine Daten gespeichert)
                if (response.status !== 200 && response.status !== 404) {
                    throw new Error(`Server antwortet mit Status: ${response.status}`);
                }
                
                return true;
            } catch (error) {
                throw new Error(`Server nicht erreichbar: ${error.message}`);
            }
        });

        this.testFunction("Data Format Validation", async () => {
            try {
                const response = await fetch('sync/data.php');
                if (response.ok) {
                    const data = await response.json();
                    
                    // Prüfe Server-Datenformat
                    if (data && typeof data === 'object') {
                        if (!data.metadata) {
                            this.addWarning("Server-Daten haben keine Metadaten");
                        }
                        if (!data.settings) {
                            this.addWarning("Server-Daten haben keine Einstellungen");
                        }
                    }
                }
                return true;
            } catch (error) {
                // Kann fehlschlagen wenn keine Daten vorhanden
                this.addWarning(`Server-Datenformat prüfung fehlgeschlagen: ${error.message}`);
                return true;
            }
        });
    },

    /**
     * Validiert Event-Management
     */
    async validateEventManagement() {
        console.log("📡 Validiere Event-Management...");
        
        this.testFunction("Event Listener Registration", () => {
            const criticalButtons = [
                'saveBtn',
                'loadBtn', 
                'fetchFlightData',
                'exportPdfBtn'
            ];
            
            criticalButtons.forEach(buttonId => {
                const button = document.getElementById(buttonId);
                if (!button) {
                    this.addWarning(`Button nicht gefunden: ${buttonId}`);
                    return;
                }
                
                // Prüfe ob Event-Listener registriert sind
                const listeners = getEventListeners ? getEventListeners(button) : null;
                if (!listeners || !listeners.click) {
                    this.addWarning(`Keine Click-Listener für Button: ${buttonId}`);
                }
            });
            
            return true;
        });

        this.testFunction("Event Propagation", () => {
            // Teste Event-Bubbling und -Capturing
            const testEvent = new CustomEvent('testValidation', {
                detail: { test: true }
            });
            
            let eventReceived = false;
            const handler = () => { eventReceived = true; };
            
            document.addEventListener('testValidation', handler);
            document.dispatchEvent(testEvent);
            document.removeEventListener('testValidation', handler);
            
            if (!eventReceived) {
                throw new Error("Event-System funktioniert nicht korrekt");
            }
            
            return true;
        });
    },

    /**
     * Validiert UI-Integrität
     */
    async validateUIIntegrity() {
        console.log("🎨 Validiere UI-Integrität...");
        
        this.testFunction("Critical UI Elements", () => {
            const criticalElements = [
                'hangarGrid',
                'sidebarMenu',
                'projectName',
                'tilesCount',
                'secondaryTilesCount'
            ];
            
            criticalElements.forEach(elementId => {
                const element = document.getElementById(elementId);
                if (!element) {
                    throw new Error(`Kritisches UI-Element fehlt: ${elementId}`);
                }
            });
            
            return true;
        });

        this.testFunction("Form Validation", () => {
            // Prüfe Eingabefelder auf korrekte Validierung
            const numberInputs = document.querySelectorAll('input[type="number"]');
            numberInputs.forEach(input => {
                if (input.min && input.max) {
                    const value = parseInt(input.value);
                    const min = parseInt(input.min);
                    const max = parseInt(input.max);
                    
                    if (value < min || value > max) {
                        this.addWarning(`Eingabefeld ${input.id} außerhalb der Grenzen: ${value} (${min}-${max})`);
                    }
                }
            });
            
            return true;
        });
    },

    /**
     * Hilfsfunktion für Tests
     */
    testFunction(name, testFunc) {
        this.results.total++;
        
        try {
            const result = testFunc();
            if (result instanceof Promise) {
                return result.then(() => {
                    this.results.passed++;
                    console.log(`✅ ${name}`);
                }).catch(error => {
                    this.results.failed++;
                    this.issues.push(`${name}: ${error.message}`);
                    console.error(`❌ ${name}: ${error.message}`);
                });
            } else {
                this.results.passed++;
                console.log(`✅ ${name}`);
            }
        } catch (error) {
            this.results.failed++;
            this.issues.push(`${name}: ${error.message}`);
            console.error(`❌ ${name}: ${error.message}`);
        }
    },

    /**
     * Fügt Warnung hinzu
     */
    addWarning(message) {
        this.results.warnings++;
        this.warnings.push(message);
        console.warn(`⚠️ ${message}`);
    },

    /**
     * Erstellt Abschlussbericht
     */
    generateReport() {
        console.log("\n" + "=".repeat(50));
        console.log("📋 VALIDIERUNGSBERICHT");
        console.log("=".repeat(50));
        console.log(`📊 Gesamt Tests: ${this.results.total}`);
        console.log(`✅ Erfolgreich: ${this.results.passed}`);
        console.log(`❌ Fehlgeschlagen: ${this.results.failed}`);
        console.log(`⚠️ Warnungen: ${this.results.warnings}`);
        
        if (this.issues.length > 0) {
            console.log("\n🔴 KRITISCHE PROBLEME:");
            this.issues.forEach(issue => console.log(`  • ${issue}`));
        }
        
        if (this.warnings.length > 0) {
            console.log("\n🟡 WARNUNGEN:");
            this.warnings.forEach(warning => console.log(`  • ${warning}`));
        }
        
        const successRate = (this.results.passed / this.results.total * 100).toFixed(1);
        console.log(`\n🎯 Erfolgsrate: ${successRate}%`);
        
        if (this.results.failed === 0) {
            console.log("🎉 ALLE KRITISCHEN TESTS BESTANDEN!");
        } else {
            console.log("🚨 KRITISCHE PROBLEME GEFUNDEN!");
        }
        
        console.log("=".repeat(50));
    }
};

// Auto-Start bei Debug-Modus
if (window.location.search.includes('validate=true')) {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => {
            window.SystemValidator.runCompleteValidation();
        }, 2000);
    });
}
