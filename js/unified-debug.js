/**
 * Unified Debug System
 * Konsolidierte Debug-Funktionen für HangarPlanner
 * Ersetzt: debug-helpers.js, initialization-debug.js, test-helper.js
 */

const UnifiedDebug = (() => {
	// Debug-Konfiguration
	const config = {
		enabled: true,
		logLevel: "info", // 'debug', 'info', 'warn', 'error'
		maxLogEntries: 100,
		autoCheck: false,
	};

	// Log-History für Debugging
	const logHistory = [];

	/**
	 * Zentrales Logging-System
	 */
	const logger = {
		debug: (message, data = null) => log("debug", message, data),
		info: (message, data = null) => log("info", message, data),
		warn: (message, data = null) => log("warn", message, data),
		error: (message, data = null) => log("error", message, data),
		group: (title) => console.group(title),
		groupEnd: () => console.groupEnd(),
	};

	const log = (level, message, data) => {
		if (!config.enabled) return;

		const logEntry = {
			timestamp: new Date().toISOString(),
			level,
			message,
			data,
		};

		// Log-History pflegen
		logHistory.push(logEntry);
		if (logHistory.length > config.maxLogEntries) {
			logHistory.shift();
		}

		// Console-Output
		const logMethod = console[level] || console.log;
		if (data) {
			logMethod(`[${level.toUpperCase()}] ${message}`, data);
		} else {
			logMethod(`[${level.toUpperCase()}] ${message}`);
		}
	};

	/**
	 * System-Diagnose Funktionen
	 */
	const diagnostics = {
		/**
		 * Vollständige System-Diagnose
		 */
		checkAll() {
			logger.info("🔍 VOLLSTÄNDIGE SYSTEM-DIAGNOSE GESTARTET");
			console.log("==========================================");

			const results = {
				initialization: this.checkInitialization(),
				sidebar: this.checkSidebar(),
				displayOptions: this.checkDisplayOptions(),
				hangarUI: this.checkHangarUI(),
				eventHandlers: this.checkEventHandlers(),
				apis: this.checkAPIs(),
				missing: this.checkMissingFunctions(),
			};

			console.log("==========================================");
			logger.info("✅ System-Diagnose abgeschlossen", results);
			return results;
		},

		/**
		 * Initialisierung prüfen
		 */
		checkInitialization() {
			logger.group("📋 INITIALISIERUNG");

			const checks = {
				hangar: !!window.hangar,
				hangarUI: !!window.hangarUI,
				displayOptions: !!window.displayOptions,
				improved_event_manager: !!window.improved_event_manager,
				dynamicAPILoader: !!window.DynamicAPILoader,
			};

			Object.entries(checks).forEach(([name, status]) => {
				logger.info(
					`${status ? "✅" : "❌"} ${name}: ${
						status ? "verfügbar" : "NICHT verfügbar"
					}`
				);
			});

			logger.groupEnd();
			return checks;
		},

		/**
		 * Sidebar-Status prüfen
		 */
		checkSidebar() {
			logger.group("🔧 SIDEBAR-STATUS");

			const body = document.body;
			const menuToggleBtn = document.getElementById("menuToggle");
			const sidebar = document.getElementById("sidebarMenu");
			const isSidebarCollapsed = body.classList.contains("sidebar-collapsed");

			const status = {
				isCollapsed: isSidebarCollapsed,
				buttonExists: !!menuToggleBtn,
				buttonText: menuToggleBtn?.textContent || null,
				sidebarExists: !!sidebar,
				sidebarWidth: sidebar?.offsetWidth || null,
				bodyClasses: body.className,
			};

			logger.info("Sidebar eingeklappt:", status.isCollapsed);
			logger.info(
				"Toggle-Button:",
				status.buttonExists ? "gefunden" : "NICHT gefunden"
			);
			logger.info(
				"Sidebar-Container:",
				status.sidebarExists ? "gefunden" : "NICHT gefunden"
			);

			logger.groupEnd();
			return status;
		},

		/**
		 * Display Options prüfen
		 */
		checkDisplayOptions() {
			logger.group("📊 DISPLAY OPTIONS");

			if (window.displayOptions) {
				logger.info("✅ displayOptions verfügbar");
				logger.info("Aktuelle Werte:", window.displayOptions.current);
				logger.info("Standardwerte:", window.displayOptions.defaults);

				const elements = [
					"tilesCount",
					"secondaryTilesCount",
					"layoutType",
					"darkModeToggle",
					"viewModeToggle",
				];

				const elementStatus = {};
				elements.forEach((id) => {
					const element = document.getElementById(id);
					elementStatus[id] = !!element;
					logger.info(
						`${element ? "✅" : "❌"} Element ${id}: ${
							element ? "gefunden" : "NICHT gefunden"
						}`
					);
				});

				logger.groupEnd();
				return { available: true, elements: elementStatus };
			} else {
				logger.error("❌ displayOptions NICHT verfügbar");
				logger.groupEnd();
				return { available: false };
			}
		},

		/**
		 * HangarUI prüfen
		 */
		checkHangarUI() {
			logger.group("🏗️ HANGAR UI");

			if (window.hangarUI) {
				const functions = [
					"initialize",
					"applyViewMode",
					"updateUI",
					"updateTileLayout",
				];

				const functionStatus = {};
				functions.forEach((funcName) => {
					const exists = typeof window.hangarUI[funcName] === "function";
					functionStatus[funcName] = exists;
					logger.info(
						`${exists ? "✅" : "❌"} Funktion ${funcName}: ${
							exists ? "verfügbar" : "NICHT verfügbar"
						}`
					);
				});

				logger.groupEnd();
				return { available: true, functions: functionStatus };
			} else {
				logger.error("❌ hangarUI NICHT verfügbar");
				logger.groupEnd();
				return { available: false };
			}
		},

		/**
		 * Event-Handler prüfen
		 */
		checkEventHandlers() {
			logger.group("🎯 EVENT-HANDLER");

			const handlers = {
				improved_event_manager: !!window.improved_event_manager,
				DOMContentLoaded: document.readyState === "complete",
				menuToggle: !!document.getElementById("menuToggle")?.onclick,
			};

			Object.entries(handlers).forEach(([name, status]) => {
				logger.info(
					`${status ? "✅" : "❌"} ${name}: ${status ? "aktiv" : "NICHT aktiv"}`
				);
			});

			logger.groupEnd();
			return handlers;
		},

		/**
		 * API-Status prüfen
		 */
		checkAPIs() {
			logger.group("🌐 API-STATUS");

			const apis = {
				dynamicLoader: !!window.DynamicAPILoader,
				aeroDataBox: !!window.AeroDataBoxAPI,
				amadeus: !!window.AmadeusAPI,
				openSky: !!window.OpenskyAPI,
				flightDataAPI: !!window.FlightDataAPI,
			};

			Object.entries(apis).forEach(([name, status]) => {
				logger.info(
					`${status ? "✅" : "❌"} ${name}: ${
						status ? "verfügbar" : "nicht geladen"
					}`
				);
			});

			logger.groupEnd();
			return apis;
		},

		/**
		 * Fehlende Funktionen identifizieren
		 */
		checkMissingFunctions() {
			logger.group("🔍 FEHLENDE FUNKTIONEN");

			const required = [
				"window.hangar",
				"window.hangarUI",
				"window.displayOptions",
				"window.improved_event_manager",
			];

			const missing = required.filter((path) => {
				const exists = path
					.split(".")
					.reduce((obj, prop) => obj?.[prop], window);
				return !exists;
			});

			if (missing.length === 0) {
				logger.info("✅ Alle erforderlichen Funktionen sind verfügbar");
			} else {
				missing.forEach((func) => {
					logger.warn(`❌ FEHLT: ${func}`);
				});
			}

			logger.groupEnd();
			return { missing, count: missing.length };
		},
	};

	/**
	 * Test-Funktionen
	 */
	const testing = {
		/**
		 * Ansichtsmodus testen
		 */
		toggleViewMode(isTable) {
			logger.info(`Teste Ansichtsmodus: ${isTable ? "Tabelle" : "Kachel"}`);

			// Verschiedene Zugriffswege testen
			const methods = [
				() => window.hangarUI?.applyViewMode?.(isTable),
				() => window.hangarUI?.uiSettings?.applyViewMode?.(isTable),
				() => window.uiSettings?.applyViewMode?.(isTable),
				() => this.fallbackViewMode(isTable),
			];

			for (let i = 0; i < methods.length; i++) {
				try {
					const result = methods[i]();
					if (result !== undefined) {
						logger.info(`✅ Methode ${i + 1} erfolgreich`);
						return true;
					}
				} catch (error) {
					logger.warn(`❌ Methode ${i + 1} fehlgeschlagen:`, error);
				}
			}

			logger.error("❌ Alle Methoden fehlgeschlagen");
			return false;
		},

		/**
		 * Fallback-Ansichtsmodus
		 */
		fallbackViewMode(isTable) {
			const body = document.body;
			if (isTable) {
				body.classList.add("table-view");
				document.documentElement.style.setProperty("--grid-gap", "8px");
			} else {
				body.classList.remove("table-view");
				document.documentElement.style.setProperty("--grid-gap", "16px");
			}
			logger.info("✅ Fallback-Ansichtsmodus angewendet");
			return true;
		},

		/**
		 * Storage-Test
		 */
		testStorage() {
			logger.group("💾 STORAGE-TEST");

			try {
				const testKey = "debug_test_" + Date.now();
				const testValue = { test: true, timestamp: Date.now() };

				localStorage.setItem(testKey, JSON.stringify(testValue));
				const retrieved = JSON.parse(localStorage.getItem(testKey));
				localStorage.removeItem(testKey);

				const success = retrieved.test === testValue.test;
				logger.info(
					`Storage-Test: ${success ? "✅ erfolgreich" : "❌ fehlgeschlagen"}`
				);

				logger.groupEnd();
				return success;
			} catch (error) {
				logger.error("❌ Storage-Test fehlgeschlagen:", error);
				logger.groupEnd();
				return false;
			}
		},
	};

	/**
	 * Performance-Monitoring
	 */
	const performance = {
		markers: new Map(),

		mark(name) {
			this.markers.set(name, performance.now());
			logger.debug(`⏱️ Performance-Marker gesetzt: ${name}`);
		},

		measure(name, startMark) {
			const endTime = performance.now();
			const startTime = this.markers.get(startMark);

			if (startTime) {
				const duration = endTime - startTime;
				logger.info(`⏱️ ${name}: ${duration.toFixed(2)}ms`);
				return duration;
			} else {
				logger.warn(`❌ Start-Marker '${startMark}' nicht gefunden`);
				return null;
			}
		},
	};

	/**
	 * Utility-Funktionen
	 */
	const utils = {
		/**
		 * Log-History exportieren
		 */
		exportLogs() {
			const logs = JSON.stringify(logHistory, null, 2);
			const blob = new Blob([logs], { type: "application/json" });
			const url = URL.createObjectURL(blob);

			const a = document.createElement("a");
			a.href = url;
			a.download = `hangar-debug-logs-${new Date()
				.toISOString()
				.slice(0, 19)}.json`;
			a.click();

			URL.revokeObjectURL(url);
			logger.info("📁 Debug-Logs exportiert");
		},

		/**
		 * System-Info sammeln
		 */
		getSystemInfo() {
			return {
				userAgent: navigator.userAgent,
				url: window.location.href,
				timestamp: new Date().toISOString(),
				viewport: {
					width: window.innerWidth,
					height: window.innerHeight,
				},
				localStorage: {
					available: !!window.localStorage,
					itemCount: localStorage.length,
				},
			};
		},

		/**
		 * Debug-Konfiguration setzen
		 */
		configure(options) {
			Object.assign(config, options);
			logger.info("🔧 Debug-Konfiguration aktualisiert", config);
		},
	};

	// Auto-Check beim Laden
	if (config.autoCheck) {
		setTimeout(() => diagnostics.checkAll(), 1000);
	}

	// Öffentliche API
	return {
		logger,
		diagnostics,
		testing,
		performance,
		utils,
		config,

		// Legacy-Kompatibilität
		checkSidebarStatus: diagnostics.checkSidebar,
		checkAllInitializations: diagnostics.checkAll,
		toggleViewMode: testing.toggleViewMode,
	};
})();

// Global verfügbar machen
window.UnifiedDebug = UnifiedDebug;
window.debugHelpers = UnifiedDebug; // Legacy-Kompatibilität
window.initDebug = UnifiedDebug; // Legacy-Kompatibilität

// Test-Funktionen global verfügbar machen
window.toggleViewMode = UnifiedDebug.testing.toggleViewMode;

console.log("🔧 Unified Debug System geladen");
