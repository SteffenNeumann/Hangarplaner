/**
 * Enhanced Validation Script für Phase 3
 * Prüft Dynamic API Loading, Unified Debug System und System Maintenance
 */

const phase3Validation = {
	async runAllTests() {
		console.log("🔍 PHASE 3 VALIDIERUNG STARTET");
		console.log("================================");

		const results = {
			dynamicAPIs: await this.testDynamicAPILoading(),
			unifiedDebug: await this.testUnifiedDebugSystem(),
			systemMaintenance: await this.testSystemMaintenance(),
			legacy: await this.testLegacyCompatibility(),
			performance: await this.testPerformanceImpact()
		};

		// Zusammenfassung
		const summary = this.generateSummary(results);
		console.log("📊 PHASE 3 VALIDIERUNG ZUSAMMENFASSUNG:", summary);

		return { results, summary };
	},

	/**
	 * Dynamic API Loading testen
	 */
	async testDynamicAPILoading() {
		console.log("\n🌐 DYNAMIC API LOADING TEST");
		console.log("----------------------------");

		const tests = {
			loaderExists: !!window.DynamicAPILoader,
			loadPrimary: false,
			loadMultiple: false,
			fallback: false
		};

		if (tests.loaderExists) {
			console.log("✅ DynamicAPILoader verfügbar");

			try {
				// Primäre API laden
				const primaryAPI = await window.DynamicAPILoader.loadPrimaryAPI();
				tests.loadPrimary = !!primaryAPI;
				console.log(`${tests.loadPrimary ? '✅' : '❌'} Primäre API geladen`);

				// Mehrere APIs laden
				const modules = await window.DynamicAPILoader.loadModules(['AeroDataBoxAPI']);
				tests.loadMultiple = Object.keys(modules).length > 0;
				console.log(`${tests.loadMultiple ? '✅' : '❌'} Multi-Loading funktioniert`);

				// Verfügbare Module prüfen
				const available = window.DynamicAPILoader.getAvailableModules();
				console.log("📋 Verfügbare Module:", available);

			} catch (error) {
				console.warn("⚠️ Dynamic Loading Fehler:", error);
			}
		} else {
			console.error("❌ DynamicAPILoader NICHT verfügbar");
		}

		return tests;
	},

	/**
	 * Unified Debug System testen
	 */
	async testUnifiedDebugSystem() {
		console.log("\n🔧 UNIFIED DEBUG SYSTEM TEST");
		console.log("------------------------------");

		const tests = {
			unifiedExists: !!window.UnifiedDebug,
			legacyCompat: false,
			diagnostics: false,
			testing: false,
			performance: false
		};

		if (tests.unifiedExists) {
			console.log("✅ UnifiedDebug verfügbar");

			// Legacy-Kompatibilität
			tests.legacyCompat = !!(window.debugHelpers && window.initDebug);
			console.log(`${tests.legacyCompat ? '✅' : '❌'} Legacy-Kompatibilität`);

			try {
				// Diagnostics testen
				const diagnosis = await window.UnifiedDebug.diagnostics.checkAll();
				tests.diagnostics = !!diagnosis;
				console.log(`${tests.diagnostics ? '✅' : '❌'} Diagnostics funktionieren`);

				// Testing-Funktionen
				tests.testing = typeof window.UnifiedDebug.testing.toggleViewMode === 'function';
				console.log(`${tests.testing ? '✅' : '❌'} Testing-Funktionen verfügbar`);

				// Performance-Monitoring
				window.UnifiedDebug.performance.mark('test');
				tests.performance = window.UnifiedDebug.performance.markers.has('test');
				console.log(`${tests.performance ? '✅' : '❌'} Performance-Monitoring funktioniert`);

			} catch (error) {
				console.warn("⚠️ UnifiedDebug Fehler:", error);
			}
		} else {
			console.error("❌ UnifiedDebug NICHT verfügbar");
		}

		return tests;
	},

	/**
	 * System Maintenance testen
	 */
	async testSystemMaintenance() {
		console.log("\n🔧 SYSTEM MAINTENANCE TEST");
		console.log("---------------------------");

		const tests = {
			maintenanceExists: !!window.SystemMaintenance,
			quickCheck: false,
			diagnosis: false,
			legacyCompat: false
		};

		if (tests.maintenanceExists) {
			console.log("✅ SystemMaintenance verfügbar");

			try {
				// Quick Check
				const quickResult = window.SystemMaintenance.quickCheck();
				tests.quickCheck = !!quickResult;
				console.log(`${tests.quickCheck ? '✅' : '❌'} Quick Check funktioniert`);

				// Vollständige Diagnose
				const fullDiagnosis = await window.SystemMaintenance.diagnose();
				tests.diagnosis = !!fullDiagnosis;
				console.log(`${tests.diagnosis ? '✅' : '❌'} Vollständige Diagnose funktioniert`);

				// Legacy-Kompatibilität
				tests.legacyCompat = !!(window.HangarConflictResolver && 
										window.SystemRepair && 
										window.syncDiagnosis);
				console.log(`${tests.legacyCompat ? '✅' : '❌'} Legacy-Kompatibilität`);

			} catch (error) {
				console.warn("⚠️ SystemMaintenance Fehler:", error);
			}
		} else {
			console.error("❌ SystemMaintenance NICHT verfügbar");
		}

		return tests;
	},

	/**
	 * Legacy-Kompatibilität testen
	 */
	async testLegacyCompatibility() {
		console.log("\n🔄 LEGACY-KOMPATIBILITÄT TEST");
		console.log("------------------------------");

		const legacyFunctions = [
			{ name: 'debugHelpers.checkSidebarStatus', path: 'window.debugHelpers.checkSidebarStatus' },
			{ name: 'initDebug.checkAllInitializations', path: 'window.initDebug.checkAllInitializations' },
			{ name: 'toggleViewMode', path: 'window.toggleViewMode' },
			{ name: 'HangarConflictResolver.runFullDiagnosis', path: 'window.HangarConflictResolver.runFullDiagnosis' },
			{ name: 'SystemRepair.repairSystem', path: 'window.SystemRepair.repairSystem' },
			{ name: 'syncDiagnosis.runQuickDiagnosis', path: 'window.syncDiagnosis.runQuickDiagnosis' }
		];

		const tests = {};

		legacyFunctions.forEach(func => {
			const exists = func.path.split('.').reduce((obj, prop) => obj?.[prop], window);
			tests[func.name] = typeof exists === 'function';
			console.log(`${tests[func.name] ? '✅' : '❌'} ${func.name}`);
		});

		return tests;
	},

	/**
	 * Performance-Impact testen
	 */
	async testPerformanceImpact() {
		console.log("\n⚡ PERFORMANCE-IMPACT TEST");
		console.log("---------------------------");

		const performance = {
			loadTime: window.performance.now(),
			scripts: document.querySelectorAll('script').length,
			memory: null
		};

		// Memory-Info (wenn verfügbar)
		if (window.performance.memory) {
			performance.memory = {
				used: Math.round(window.performance.memory.usedJSHeapSize / 1024 / 1024),
				total: Math.round(window.performance.memory.totalJSHeapSize / 1024 / 1024)
			};
		}

		console.log("📊 Performance-Daten:", performance);

		// Vergleich mit erwarteten Werten
		const tests = {
			scriptsReduced: performance.scripts < 30, // Sollte reduziert sein
			loadTimeAcceptable: performance.loadTime < 5000, // Unter 5 Sekunden
			memoryEfficient: !performance.memory || performance.memory.used < 50 // Unter 50MB
		};

		console.log(`${tests.scriptsReduced ? '✅' : '❌'} Script-Anzahl reduziert: ${performance.scripts}`);
		console.log(`${tests.loadTimeAcceptable ? '✅' : '❌'} Ladezeit akzeptabel: ${performance.loadTime.toFixed(2)}ms`);
		console.log(`${tests.memoryEfficient ? '✅' : '❌'} Memory-Verbrauch effizient`);

		return { ...tests, metrics: performance };
	},

	/**
	 * Zusammenfassung generieren
	 */
	generateSummary(results) {
		const allTests = Object.values(results).reduce((acc, category) => {
			Object.values(category).forEach(test => {
				if (typeof test === 'boolean') {
					acc.total++;
					if (test) acc.passed++;
				}
			});
			return acc;
		}, { total: 0, passed: 0 });

		const successRate = Math.round((allTests.passed / allTests.total) * 100);

		return {
			totalTests: allTests.total,
			passedTests: allTests.passed,
			successRate: successRate,
			status: successRate >= 90 ? 'EXCELLENT' : 
					successRate >= 75 ? 'GOOD' : 
					successRate >= 50 ? 'FAIR' : 'POOR'
		};
	}
};

// Tests automatisch ausführen
if (document.readyState === 'complete') {
	setTimeout(() => phase3Validation.runAllTests(), 1000);
} else {
	window.addEventListener('load', () => {
		setTimeout(() => phase3Validation.runAllTests(), 1000);
	});
}

// Global verfügbar machen
window.phase3Validation = phase3Validation;
