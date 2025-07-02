/**
 * System Maintenance Hub
 * Konsolidiert: conflict-resolver.js, system-repair.js, sync-diagnosis.js
 * Vereinfachte und optimierte System-Wartung für HangarPlanner
 */

const SystemMaintenance = (() => {
	// Maintenance-Konfiguration
	const config = {
		autoRepair: false,
		logLevel: 'info',
		maxRetries: 3,
		repairTimeout: 30000
	};

	// Maintenance-Status
	let maintenanceRunning = false;
	let lastDiagnosis = null;

	/**
	 * Vollständige System-Diagnose
	 */
	const diagnose = async () => {
		console.log("🔍 SYSTEM-DIAGNOSE STARTET");
		console.log("===========================");

		const diagnosis = {
			timestamp: new Date().toISOString(),
			conflicts: [],
			repairs: [],
			issues: {
				critical: [],
				warning: [],
				info: []
			},
			performance: {}
		};

		try {
			// 1. HTML-Struktur prüfen
			diagnosis.htmlStructure = await checkHtmlStructure();
			
			// 2. Event-Handler prüfen
			diagnosis.eventHandlers = await checkEventHandlers();
			
			// 3. Storage-Konflikte prüfen
			diagnosis.storage = await checkStorageConflicts();
			
			// 4. API-Status prüfen
			diagnosis.apis = await checkAPIStatus();
			
			// 5. Performance prüfen
			diagnosis.performance = await checkPerformance();

			// Zusammenfassung
			diagnosis.summary = generateSummary(diagnosis);
			
			lastDiagnosis = diagnosis;
			console.log("✅ System-Diagnose abgeschlossen");
			
			return diagnosis;
		} catch (error) {
			console.error("❌ Fehler bei System-Diagnose:", error);
			return { error: error.message, timestamp: new Date().toISOString() };
		}
	};

	/**
	 * HTML-Struktur prüfen
	 */
	const checkHtmlStructure = async () => {
		const structure = {
			tiles: { valid: 0, invalid: 0, details: {} },
			elements: { found: 0, missing: 0, details: {} }
		};

		// Kritische Elemente prüfen
		const criticalElements = [
			'menuToggle', 'sidebarMenu', 'hangarGrid',
			'tilesCount', 'secondaryTilesCount', 'layoutType',
			'darkModeToggle', 'viewModeToggle'
		];

		criticalElements.forEach(id => {
			const element = document.getElementById(id);
			if (element) {
				structure.elements.found++;
				structure.elements.details[id] = 'found';
			} else {
				structure.elements.missing++;
				structure.elements.details[id] = 'missing';
			}
		});

		// Tiles prüfen (erste 5)
		for (let i = 1; i <= 5; i++) {
			const tileValid = checkTile(i);
			if (tileValid.valid) {
				structure.tiles.valid++;
			} else {
				structure.tiles.invalid++;
			}
			structure.tiles.details[`tile_${i}`] = tileValid;
		}

		return structure;
	};

	/**
	 * Einzelne Tile prüfen
	 */
	const checkTile = (tileId) => {
		const elements = [
			`aircraft-${tileId}`,
			`arrival-time-${tileId}`,
			`departure-time-${tileId}`,
			`position-${tileId}`
		];

		const tileStatus = {
			valid: true,
			elements: {},
			missingCount: 0
		};

		elements.forEach(elementId => {
			const element = document.getElementById(elementId);
			tileStatus.elements[elementId] = !!element;
			if (!element) {
				tileStatus.valid = false;
				tileStatus.missingCount++;
			}
		});

		return tileStatus;
	};

	/**
	 * Event-Handler prüfen
	 */
	const checkEventHandlers = async () => {
		const handlers = {
			improved_event_manager: !!window.improved_event_manager,
			menuToggle: checkElementHandler('menuToggle'),
			documentReady: document.readyState === 'complete',
			duplicates: findDuplicateHandlers()
		};

		return handlers;
	};

	/**
	 * Element-Handler prüfen
	 */
	const checkElementHandler = (elementId) => {
		const element = document.getElementById(elementId);
		if (!element) return false;

		// Event-Listener prüfen (vereinfacht)
		return !!(element.onclick || element.addEventListener);
	};

	/**
	 * Doppelte Handler finden (vereinfacht)
	 */
	const findDuplicateHandlers = () => {
		// Vereinfachte Prüfung auf häufige Konflikte
		const conflicts = [];
		
		// Menü-Toggle-Konflikte prüfen
		const menuToggle = document.getElementById('menuToggle');
		if (menuToggle && menuToggle.onclick) {
			conflicts.push('menuToggle_onclick');
		}

		return conflicts;
	};

	/**
	 * Storage-Konflikte prüfen
	 */
	const checkStorageConflicts = async () => {
		const storage = {
			localStorage: { available: false, conflicts: [], items: 0 },
			deprecated: { found: [], count: 0 },
			integrity: { valid: true, errors: [] }
		};

		try {
			// localStorage Verfügbarkeit
			storage.localStorage.available = !!window.localStorage;
			if (storage.localStorage.available) {
				storage.localStorage.items = localStorage.length;
			}

			// Deprecated Keys suchen
			const deprecatedKeys = [
				'hangarPlannerSettings',
				'hangarPlannerData', 
				'hangarTileData'
			];

			deprecatedKeys.forEach(key => {
				if (localStorage.getItem(key)) {
					storage.deprecated.found.push(key);
					storage.deprecated.count++;
				}
			});

			// Datenintegrität prüfen
			storage.integrity = checkDataIntegrity();

		} catch (error) {
			storage.integrity.valid = false;
			storage.integrity.errors.push(error.message);
		}

		return storage;
	};

	/**
	 * Datenintegrität prüfen
	 */
	const checkDataIntegrity = () => {
		const integrity = { valid: true, errors: [], tested: 0 };

		try {
			// HangarPlanner-spezifische Daten prüfen
			const keys = ['hangar_data', 'display_options'];
			
			keys.forEach(key => {
				const value = localStorage.getItem(key);
				if (value) {
					try {
						JSON.parse(value);
						integrity.tested++;
					} catch (error) {
						integrity.valid = false;
						integrity.errors.push(`Invalid JSON in ${key}: ${error.message}`);
					}
				}
			});
		} catch (error) {
			integrity.valid = false;
			integrity.errors.push(`Integrity check failed: ${error.message}`);
		}

		return integrity;
	};

	/**
	 * API-Status prüfen
	 */
	const checkAPIStatus = async () => {
		const apis = {
			dynamicLoader: !!window.DynamicAPILoader,
			flightDataAPI: !!window.FlightDataAPI,
			loaded: {
				aeroDataBox: !!window.AeroDataBoxAPI,
				amadeus: !!window.AmadeusAPI,
				openSky: !!window.OpenskyAPI
			},
			availability: {}
		};

		// Dynamic Loader Status
		if (apis.dynamicLoader) {
			apis.availability = {
				available: window.DynamicAPILoader.getAvailableModules(),
				loaded: window.DynamicAPILoader.getLoadedModules()
			};
		}

		return apis;
	};

	/**
	 * Performance prüfen
	 */
	const checkPerformance = async () => {
		const perf = {
			loadTime: performance.now(),
			memory: {},
			scripts: 0,
			stylesheets: 0
		};

		// Memory-Info (wenn verfügbar)
		if (performance.memory) {
			perf.memory = {
				used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024),
				total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024),
				limit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024)
			};
		}

		// Ressourcen zählen
		perf.scripts = document.querySelectorAll('script').length;
		perf.stylesheets = document.querySelectorAll('link[rel="stylesheet"]').length;

		return perf;
	};

	/**
	 * Zusammenfassung generieren
	 */
	const generateSummary = (diagnosis) => {
		const summary = {
			overall: 'good',
			issues: 0,
			recommendations: []
		};

		// HTML-Struktur bewerten
		if (diagnosis.htmlStructure.elements.missing > 0) {
			summary.issues++;
			summary.recommendations.push(`${diagnosis.htmlStructure.elements.missing} kritische HTML-Elemente fehlen`);
		}

		// Storage bewerten
		if (diagnosis.storage.deprecated.count > 0) {
			summary.issues++;
			summary.recommendations.push(`${diagnosis.storage.deprecated.count} veraltete Storage-Keys gefunden`);
		}

		// Event-Handler bewerten
		if (diagnosis.eventHandlers.duplicates.length > 0) {
			summary.issues++;
			summary.recommendations.push(`${diagnosis.eventHandlers.duplicates.length} Event-Handler-Konflikte`);
		}

		// Gesamtbewertung
		if (summary.issues === 0) {
			summary.overall = 'excellent';
		} else if (summary.issues <= 2) {
			summary.overall = 'good';
		} else if (summary.issues <= 5) {
			summary.overall = 'fair';
		} else {
			summary.overall = 'poor';
		}

		return summary;
	};

	/**
	 * Automatische Reparatur
	 */
	const repair = async (targetIssues = null) => {
		if (maintenanceRunning) {
			console.warn("⚠️ Wartung läuft bereits");
			return false;
		}

		maintenanceRunning = true;
		console.log("🔧 SYSTEM-REPARATUR STARTET");

		try {
			// Aktuelle Diagnose abrufen
			if (!lastDiagnosis) {
				lastDiagnosis = await diagnose();
			}

			const repairs = {
				deprecated: await cleanupDeprecatedData(),
				integrity: await repairDataIntegrity(),
				handlers: await fixEventHandlers()
			};

			console.log("✅ System-Reparatur abgeschlossen", repairs);
			return repairs;

		} catch (error) {
			console.error("❌ Fehler bei System-Reparatur:", error);
			return { error: error.message };
		} finally {
			maintenanceRunning = false;
		}
	};

	/**
	 * Veraltete Daten bereinigen
	 */
	const cleanupDeprecatedData = async () => {
		const deprecated = ['hangarPlannerSettings', 'hangarPlannerData', 'hangarTileData'];
		const cleaned = [];

		deprecated.forEach(key => {
			if (localStorage.getItem(key)) {
				localStorage.removeItem(key);
				cleaned.push(key);
			}
		});

		return { cleaned, count: cleaned.length };
	};

	/**
	 * Datenintegrität reparieren
	 */
	const repairDataIntegrity = async () => {
		const repaired = [];

		// Kritische Daten prüfen und reparieren
		const criticalKeys = ['hangar_data', 'display_options'];

		criticalKeys.forEach(key => {
			const value = localStorage.getItem(key);
			if (value) {
				try {
					JSON.parse(value);
				} catch (error) {
					// Ungültige Daten entfernen
					localStorage.removeItem(key);
					repaired.push({ key, action: 'removed', reason: 'invalid_json' });
				}
			}
		});

		return { repaired, count: repaired.length };
	};

	/**
	 * Event-Handler reparieren
	 */
	const fixEventHandlers = async () => {
		const fixes = [];

		// Menü-Toggle prüfen und reparieren
		const menuToggle = document.getElementById('menuToggle');
		if (menuToggle && !menuToggle.onclick) {
			// Nur loggen, nicht reparieren (zu riskant)
			fixes.push({ element: 'menuToggle', action: 'needs_attention' });
		}

		return { fixes, count: fixes.length };
	};

	/**
	 * Schnelle Systemprüfung
	 */
	const quickCheck = () => {
		const issues = [];

		// Kritische Elemente prüfen
		if (!document.getElementById('hangarGrid')) {
			issues.push('Hangar-Grid fehlt');
		}

		if (!window.hangarUI) {
			issues.push('HangarUI nicht geladen');
		}

		if (!window.improved_event_manager) {
			issues.push('Event-Manager nicht geladen');
		}

		console.log(`🔍 Schnellprüfung: ${issues.length === 0 ? '✅ Alles OK' : `❌ ${issues.length} Probleme`}`);
		
		if (issues.length > 0) {
			console.log("Probleme:", issues);
		}

		return { healthy: issues.length === 0, issues };
	};

	// Öffentliche API
	return {
		diagnose,
		repair,
		quickCheck,
		config,
		
		// Getter für Status
		get isRunning() { return maintenanceRunning; },
		get lastDiagnosis() { return lastDiagnosis; },
		
		// Legacy-Kompatibilität
		runFullDiagnosis: diagnose,
		repairSystem: repair,
		runQuickDiagnosis: quickCheck
	};
})();

// Global verfügbar machen
window.SystemMaintenance = SystemMaintenance;

// Legacy-Kompatibilität
window.HangarConflictResolver = {
	runFullDiagnosis: SystemMaintenance.diagnose
};
window.SystemRepair = {
	repairSystem: SystemMaintenance.repair
};
window.syncDiagnosis = {
	runQuickDiagnosis: SystemMaintenance.quickCheck
};

console.log("🔧 System Maintenance Hub geladen");
