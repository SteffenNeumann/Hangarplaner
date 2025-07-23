/**
 * TEST-SCRIPT FÜR NEUE 3-STUFIGE SYNCHRONISATIONS-MODI
 * Tests für: Standalone, Sync, Master
 * Führe in Browser-Konsole aus: loadScript('/test-sync-modes.js'); testSyncModes();
 */

/**
 * Haupttest-Funktion für alle Sync-Modi
 */
function testSyncModes() {
	console.log("🧪 SYNC-MODI TEST GESTARTET");
	console.log("=" + "=".repeat(50));

	// 1. Test Infrastructure
	if (!testInfrastructure()) {
		console.error("❌ Infrastruktur-Test fehlgeschlagen");
		return false;
	}

	// 2. Test UI-Elemente
	if (!testUIElements()) {
		console.error("❌ UI-Elemente-Test fehlgeschlagen");
		return false;
	}

	// 3. Test Modi-Wechsel
	testModeTransitions();

	// 4. Test Anzeigen-Synchronisation
	testDisplaySynchronization();

	console.log("=" + "=".repeat(50));
	console.log("✅ SYNC-MODI TEST ABGESCHLOSSEN");
	return true;
}

/**
 * Test der grundlegenden Infrastruktur
 */
function testInfrastructure() {
	console.log("🔧 Teste Infrastruktur...");

	// SharingManager verfügbar?
	if (!window.sharingManager) {
		console.error("❌ SharingManager nicht verfügbar");
		return false;
	}

	// ServerSync verfügbar?
	if (!window.serverSync) {
		console.error("❌ ServerSync nicht verfügbar");
		return false;
	}

	// Neue Eigenschaften vorhanden?
	if (typeof window.sharingManager.syncMode === "undefined") {
		console.error("❌ syncMode-Eigenschaft fehlt");
		return false;
	}

	console.log("✅ Infrastruktur OK");
	console.log("  - SharingManager verfügbar");
	console.log("  - ServerSync verfügbar");
	console.log("  - Neue syncMode-Eigenschaft vorhanden");

	return true;
}

/**
 * Test der UI-Elemente
 */
function testUIElements() {
	console.log("🎨 Teste UI-Elemente...");

	// Toggle verfügbar?
	const toggle = document.getElementById("liveSyncToggle");
	if (!toggle) {
		console.error("❌ liveSyncToggle nicht gefunden");
		return false;
	}

	// Status-Button verfügbar?
	const statusBtn = document.getElementById("syncStatusBtn");
	if (!statusBtn) {
		console.error("❌ syncStatusBtn nicht gefunden");
		return false;
	}

	// Widget verfügbar?
	const widget = document.getElementById("sync-mode");
	if (!widget) {
		console.error("❌ sync-mode Widget nicht gefunden");
		return false;
	}

	console.log("✅ UI-Elemente OK");
	console.log("  - Toggle verfügbar:", toggle.id);
	console.log("  - Status-Button verfügbar:", statusBtn.id);
	console.log("  - Widget verfügbar:", widget.id);

	return true;
}

/**
 * Test der Modi-Übergänge
 */
function testModeTransitions() {
	console.log("🔄 Teste Modi-Übergänge...");

	const initialMode = window.sharingManager.syncMode;
	console.log("  Aktueller Modus:", initialMode);

	// Test 1: Standalone -> Sync
	console.log("  🧪 Test 1: Wechsel zu Sync-Modus...");
	window.sharingManager.enableSyncMode().then(() => {
		console.log("    ✅ Sync-Modus aktiviert");
		console.log("    - Modus:", window.sharingManager.syncMode);
		console.log("    - Server isSlave:", window.serverSync.isSlaveActive);

		// Test 2: Sync -> Master
		setTimeout(() => {
			console.log("  🧪 Test 2: Wechsel zu Master-Modus...");
			window.sharingManager.enableMasterMode().then(() => {
				console.log("    ✅ Master-Modus aktiviert");
				console.log("    - Modus:", window.sharingManager.syncMode);
				console.log("    - Server isMaster:", window.serverSync.isMaster);

				// Test 3: Master -> Standalone
				setTimeout(() => {
					console.log("  🧪 Test 3: Wechsel zu Standalone-Modus...");
					window.sharingManager.enableStandaloneMode().then(() => {
						console.log("    ✅ Standalone-Modus aktiviert");
						console.log("    - Modus:", window.sharingManager.syncMode);
						console.log(
							"    - Server Sync gestoppt:",
							!window.serverSync.isMaster && !window.serverSync.isSlaveActive
						);
					});
				}, 2000);
			});
		}, 2000);
	});
}

/**
 * Test der Anzeigen-Synchronisation zwischen Menü und Widget
 */
function testDisplaySynchronization() {
	console.log("🎯 Teste Anzeigen-Synchronisation...");

	const statusBtn = document.getElementById("syncStatusBtn");
	const widget = document.getElementById("sync-mode");

	if (!statusBtn || !widget) {
		console.error("❌ UI-Elemente nicht verfügbar für Anzeigen-Test");
		return;
	}

	// Test verschiedene Anzeigen
	const testStates = [
		{ status: "Standalone", active: false },
		{ status: "Sync", active: true },
		{ status: "Master", active: true },
	];

	testStates.forEach((state, index) => {
		setTimeout(() => {
			console.log(
				`  🧪 Teste Anzeige: ${state.status} (${
					state.active ? "aktiv" : "inaktiv"
				})`
			);

			window.sharingManager.updateAllSyncDisplays(state.status, state.active);

			setTimeout(() => {
				const menuText = statusBtn.textContent;
				const widgetText = widget.textContent;
				const widgetClasses = Array.from(widget.classList);

				console.log(`    Menü-Button: "${menuText}"`);
				console.log(
					`    Widget: "${widgetText}" (CSS: ${widgetClasses.join(", ")})`
				);

				// Prüfe Konsistenz
				if (state.active) {
					if (!menuText.includes(state.status) && state.status !== "Sync") {
						console.warn(
							`    ⚠️ Menü zeigt nicht erwarteten Status: ${state.status}`
						);
					}
					if (state.status === "Sync" && widgetText !== "Sync") {
						console.warn(`    ⚠️ Widget zeigt nicht "Sync" für Sync-Modus`);
					}
					if (state.status === "Master" && widgetText !== "Master") {
						console.warn(`    ⚠️ Widget zeigt nicht "Master" für Master-Modus`);
					}
				} else {
					if (widgetText !== "Standalone") {
						console.warn(
							`    ⚠️ Widget zeigt nicht "Standalone" für inaktiven Modus`
						);
					}
				}

				console.log(`    ✅ Anzeigen-Test ${index + 1} abgeschlossen`);
			}, 500);
		}, index * 3000);
	});
}

/**
 * Test der Cycling-Funktionalität
 */
function testModeCycling() {
	console.log("🔄 Teste Modus-Cycling...");

	// Starte im Standalone
	window.sharingManager.enableStandaloneMode().then(() => {
		console.log("  Start: Standalone");

		setTimeout(() => {
			// Cycle 1: Standalone -> Sync
			window.sharingManager.cycleSyncMode().then(() => {
				console.log("  Cycle 1: -> Sync");

				setTimeout(() => {
					// Cycle 2: Sync -> Master
					window.sharingManager.cycleSyncMode().then(() => {
						console.log("  Cycle 2: -> Master");

						setTimeout(() => {
							// Cycle 3: Master -> Standalone
							window.sharingManager.cycleSyncMode().then(() => {
								console.log("  Cycle 3: -> Standalone");
								console.log("  ✅ Cycling-Test abgeschlossen");
							});
						}, 1000);
					}, 1000);
				}, 1000);
			});
		}, 1000);
	});
}

/**
 * Vollständiger Funktionstest
 */
function testFullFunctionality() {
	console.log("🧪 VOLLSTÄNDIGER FUNKTIONSTEST");

	// 1. Infrastructure
	testSyncModes();

	// 2. Warte 10 Sekunden, dann teste Cycling
	setTimeout(() => {
		testModeCycling();
	}, 10000);

	// 3. Test Status-Dialog
	setTimeout(() => {
		console.log("📊 Teste Status-Dialog...");
		window.sharingManager.showSyncStatus();
	}, 15000);
}

/**
 * Quick Test für einzelne Modi
 */
function testMode(mode) {
	console.log(`🧪 SCHNELL-TEST: ${mode.toUpperCase()}-MODUS`);

	switch (mode.toLowerCase()) {
		case "standalone":
			window.sharingManager.enableStandaloneMode();
			break;
		case "sync":
			window.sharingManager.enableSyncMode();
			break;
		case "master":
			window.sharingManager.enableMasterMode();
			break;
		default:
			console.error("❌ Unbekannter Modus:", mode);
			return;
	}

	setTimeout(() => {
		console.log("Aktueller Status:");
		console.log("- syncMode:", window.sharingManager.syncMode);
		console.log(
			"- isLiveSyncEnabled:",
			window.sharingManager.isLiveSyncEnabled
		);
		console.log("- isMasterMode:", window.sharingManager.isMasterMode);

		const widget = document.getElementById("sync-mode");
		const statusBtn = document.getElementById("syncStatusBtn");

		if (widget) console.log("- Widget-Text:", widget.textContent);
		if (statusBtn) console.log("- Menü-Button:", statusBtn.textContent);
	}, 1000);
}

// Globale Test-Funktionen verfügbar machen
window.testSyncModes = testSyncModes;
window.testFullFunctionality = testFullFunctionality;
window.testMode = testMode;
window.testModeCycling = testModeCycling;

// Automatischer Test beim Laden (nach Verzögerung)
if (typeof window !== "undefined") {
	console.log("🔧 Sync-Modi Test-Funktionen geladen");
	console.log("Verfügbare Funktionen:");
	console.log("- testSyncModes()           → Basis-Funktionalitätstests");
	console.log("- testFullFunctionality()   → Vollständige Tests mit Timing");
	console.log("- testMode('standalone')    → Test einzelner Modus");
	console.log("- testMode('sync')          → Test einzelner Modus");
	console.log("- testMode('master')        → Test einzelner Modus");
	console.log("- testModeCycling()         → Test Modus-Wechsel");

	// Auto-Test nach 3 Sekunden
	setTimeout(() => {
		if (window.sharingManager && window.sharingManager.initialized) {
			console.log("🚀 Starte automatischen Basis-Test...");
			testSyncModes();
		}
	}, 3000);
}
