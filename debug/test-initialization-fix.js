/**
 * INITIALISIERUNGS-FIX VERIFIKATION
 * Testet die korrigierte initialize() Funktion
 */

function testInitializationFix() {
	console.log("🧪 INITIALISIERUNGS-FIX VERIFIKATION GESTARTET");
	console.log("=".repeat(50));

	// 1. Teste verfügbare Objekte und Methoden
	console.log("📋 1. VERFÜGBARKEITSTEST:");
	
	const tests = [
		{
			name: "window.hangarUI",
			available: !!window.hangarUI,
			required: true
		},
		{
			name: "window.hangarEvents",
			available: !!window.hangarEvents,
			required: true
		},
		{
			name: "window.hangarEvents.initializeUI",
			available: !!(window.hangarEvents && window.hangarEvents.initializeUI),
			required: true
		},
		{
			name: "window.hangarUI.initializeUI (sollte NICHT existieren)",
			available: !!(window.hangarUI && window.hangarUI.initializeUI),
			required: false // sollte false sein
		},
		{
			name: "window.displayOptions",
			available: !!window.displayOptions,
			required: false
		},
		{
			name: "window.hangarUI.uiSettings",
			available: !!(window.hangarUI && window.hangarUI.uiSettings),
			required: true
		},
		{
			name: "window.hangarUI.uiSettings.load",
			available: !!(window.hangarUI && window.hangarUI.uiSettings && window.hangarUI.uiSettings.load),
			required: true
		}
	];

	tests.forEach(test => {
		const status = test.available ? "✅" : "❌";
		const expectation = test.required ? "(erforderlich)" : "(optional)";
		console.log(`  ${status} ${test.name} ${expectation}`);
		
		if (test.required && !test.available) {
			console.warn(`    ⚠️ FEHLT: ${test.name} wird benötigt!`);
		}
		
		if (test.name.includes("sollte NICHT existieren") && test.available) {
			console.warn(`    ⚠️ PROBLEM: ${test.name} existiert immer noch!`);
		}
	});

	// 2. Teste die initialize() Funktion direkt
	console.log("\n📋 2. INITIALIZE-FUNKTIONS-TEST:");
	
	if (typeof window.hangarInitialize === "function") {
		console.log("✅ window.hangarInitialize verfügbar");
		
		// Backup der Console-Methoden für saubere Tests
		const originalError = console.error;
		const originalWarn = console.warn;
		
		let errors = [];
		let warnings = [];
		
		// Temporäre Console-Overrides um Fehler zu sammeln
		console.error = (...args) => {
			errors.push(args.join(" "));
			originalError(...args);
		};
		
		console.warn = (...args) => {
			warnings.push(args.join(" "));
			originalWarn(...args);
		};

		try {
			// Teste initialize() Funktion
			console.log("🧪 Führe initialize() aus...");
			window.hangarInitialize();
			
			setTimeout(() => {
				// Restore Console
				console.error = originalError;
				console.warn = originalWarn;
				
				// Ergebnisse auswerten
				console.log("\n📊 ERGEBNISSE:");
				console.log(`  - Fehler: ${errors.length}`);
				console.log(`  - Warnungen: ${warnings.length}`);
				
				if (errors.length > 0) {
					console.log("  ❌ FEHLER GEFUNDEN:");
					errors.forEach((error, index) => {
						console.log(`    ${index + 1}. ${error}`);
					});
				}
				
				if (warnings.length > 0) {
					console.log("  ⚠️ WARNUNGEN:");
					warnings.forEach((warning, index) => {
						console.log(`    ${index + 1}. ${warning}`);
					});
				}
				
				if (errors.length === 0) {
					console.log("✅ KEINE KRITISCHEN FEHLER - Fix erfolgreich!");
				} else {
					console.log("❌ NOCH FEHLER VORHANDEN - weitere Korrekturen nötig");
				}
			}, 1000);
			
		} catch (error) {
			console.error = originalError;
			console.warn = originalWarn;
			console.error("❌ Fehler beim Testen der initialize() Funktion:", error);
		}
		
	} else {
		console.log("❌ window.hangarInitialize nicht verfügbar");
	}

	// 3. Teste spezifische Methoden-Aufrufe
	console.log("\n📋 3. METHODEN-AUFRUF-TEST:");
	
	// Test hangarEvents.initializeUI
	if (window.hangarEvents && window.hangarEvents.initializeUI) {
		try {
			console.log("🧪 Teste hangarEvents.initializeUI()...");
			window.hangarEvents.initializeUI();
			console.log("✅ hangarEvents.initializeUI() erfolgreich ausgeführt");
		} catch (error) {
			console.error("❌ Fehler bei hangarEvents.initializeUI():", error);
		}
	}
	
	// Test displayOptions.load falls verfügbar
	if (window.displayOptions && window.displayOptions.load) {
		try {
			console.log("🧪 Teste displayOptions.load()...");
			window.displayOptions.load();
			console.log("✅ displayOptions.load() erfolgreich ausgeführt");
		} catch (error) {
			console.error("❌ Fehler bei displayOptions.load():", error);
		}
	}

	console.log("\n✅ INITIALISIERUNGS-FIX VERIFIKATION ABGESCHLOSSEN");
	return true;
}

/**
 * Detaillierte Objektstruktur-Analyse
 */
function analyzeObjectStructure() {
	console.log("🔍 OBJEKTSTRUKTUR-ANALYSE:");
	console.log("=".repeat(40));

	// Analysiere hangarUI
	if (window.hangarUI) {
		console.log("📦 window.hangarUI Methoden:");
		const hangarUIMethods = Object.getOwnPropertyNames(window.hangarUI)
			.filter(prop => typeof window.hangarUI[prop] === 'function');
		hangarUIMethods.forEach(method => {
			console.log(`  - ${method}()`);
		});
	}

	// Analysiere hangarEvents
	if (window.hangarEvents) {
		console.log("\n📦 window.hangarEvents Methoden:");
		const hangarEventsMethods = Object.getOwnPropertyNames(window.hangarEvents)
			.filter(prop => typeof window.hangarEvents[prop] === 'function');
		hangarEventsMethods.forEach(method => {
			console.log(`  - ${method}()`);
		});
	}

	// Analysiere displayOptions
	if (window.displayOptions) {
		console.log("\n📦 window.displayOptions Methoden:");
		const displayOptionsMethods = Object.getOwnPropertyNames(window.displayOptions)
			.filter(prop => typeof window.displayOptions[prop] === 'function');
		displayOptionsMethods.forEach(method => {
			console.log(`  - ${method}()`);
		});
	}
}

// Globale Verfügbarkeit
window.testInitializationFix = testInitializationFix;
window.analyzeObjectStructure = analyzeObjectStructure;

console.log("📋 Initialisierungs-Fix Test geladen. Führe testInitializationFix() aus zum Testen.");
