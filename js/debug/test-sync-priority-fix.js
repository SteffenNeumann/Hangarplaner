/**
 * TEST-SCRIPT FÜR SYNC-PRIORITÄTS-FIX
 * Testet die korrigierte Synchronisationsreihenfolge
 */

function testSyncPriorityFix() {
	console.log("🧪 SYNC-PRIORITÄTS-FIX TEST GESTARTET");
	console.log("=".repeat(50));

	// 1. Teste verfügbare Komponenten
	console.log("📋 1. KOMPONENTEN-CHECK:");
	console.log("- SharingManager:", !!window.sharingManager);
	console.log("- ServerSync:", !!window.serverSync);
	console.log("- Read Toggle:", !!document.getElementById("readDataToggle"));
	console.log("- Write Toggle:", !!document.getElementById("writeDataToggle"));

	// 2. Teste aktuelle Modi-Implementierung
	console.log("\n📋 2. AKTUELLE MODI-ZUSTELLUNG:");
	if (window.sharingManager) {
		console.log("- Sync Mode:", window.sharingManager.syncMode);
		console.log("- Live Sync:", window.sharingManager.isLiveSyncEnabled);
		console.log("- Master Mode:", window.sharingManager.isMasterMode);
	}

	if (window.serverSync) {
		console.log("- Server isMaster:", window.serverSync.isMaster);
		console.log("- Server isSlaveActive:", window.serverSync.isSlaveActive);
		console.log("- Slave Interval:", !!window.serverSync.slaveCheckInterval);
		console.log("- Periodic Interval:", !!window.serverSync.serverSyncInterval);
	}

	// 3. Teste Dual-Toggle Synchronisation
	console.log("\n📋 3. DUAL-TOGGLE SYNC TEST:");
	testDualToggleSync();

	// 4. Teste Server-Load-Funktionalität
	console.log("\n📋 4. SERVER-LOAD TEST:");
	testServerLoadFunctionality();

	console.log("\n✅ SYNC-PRIORITÄTS-FIX TEST ABGESCHLOSSEN");
	return true;
}

/**
 * Testet die Dual-Toggle Synchronisation
 */
function testDualToggleSync() {
	const readToggle = document.getElementById("readDataToggle");
	const writeToggle = document.getElementById("writeDataToggle");

	if (!readToggle || !writeToggle) {
		console.log("❌ Dual-Toggles nicht gefunden");
		return;
	}

	// Teste verschiedene Kombinationen
	console.log("🧪 Teste Toggle-Kombinationen:");

	// Test 1: Beide AUS -> Standalone
	console.log("  Test 1: Beide AUS -> Standalone");
	readToggle.checked = false;
	writeToggle.checked = false;
	window.sharingManager?.updateSyncMode(false, false);
	setTimeout(() => {
		console.log(`    Ergebnis: ${window.sharingManager?.syncMode}`);
	}, 100);

	// Test 2: Nur Read -> Sync Mode
	setTimeout(() => {
		console.log("  Test 2: Nur Read -> Sync Mode");
		readToggle.checked = true;
		writeToggle.checked = false;
		window.sharingManager?.updateSyncMode(true, false);
		setTimeout(() => {
			console.log(`    Ergebnis: ${window.sharingManager?.syncMode}`);
			console.log(`    Slave aktiv: ${window.serverSync?.isSlaveActive}`);
		}, 100);
	}, 1000);

	// Test 3: Beide AN -> Master Mode
	setTimeout(() => {
		console.log("  Test 3: Beide AN -> Master Mode");
		readToggle.checked = true;
		writeToggle.checked = true;
		window.sharingManager?.updateSyncMode(true, true);
		setTimeout(() => {
			console.log(`    Ergebnis: ${window.sharingManager?.syncMode}`);
			console.log(`    Master aktiv: ${window.serverSync?.isMaster}`);
			console.log(`    Slave auch aktiv: ${window.serverSync?.isSlaveActive}`);
		}, 100);
	}, 2000);
}

/**
 * Testet die Server-Load-Funktionalität
 */
function testServerLoadFunctionality() {
	if (!window.sharingManager || !window.serverSync) {
		console.log("❌ Komponenten nicht verfügbar für Server-Load Test");
		return;
	}

	console.log("🧪 Teste loadServerDataImmediately Methode:");
	
	if (typeof window.sharingManager.loadServerDataImmediately === "function") {
		console.log("✅ loadServerDataImmediately Methode verfügbar");
		
		// Teste die Methode
		window.sharingManager.loadServerDataImmediately()
			.then(() => {
				console.log("✅ loadServerDataImmediately erfolgreich ausgeführt");
			})
			.catch((error) => {
				console.log("⚠️ loadServerDataImmediately Fehler:", error.message);
			});
	} else {
		console.log("❌ loadServerDataImmediately Methode nicht verfügbar");
	}

	console.log("🧪 Teste bidirektionalen Master-Modus:");
	if (window.serverSync.startMasterMode) {
		console.log("✅ startMasterMode Methode verfügbar");
		console.log("- Führe startMasterMode aus...");
		
		window.serverSync.startMasterMode();
		
		setTimeout(() => {
			console.log("- Master-Status:", window.serverSync.isMaster);
			console.log("- Slave-Status:", window.serverSync.isSlaveActive);
			console.log("- Slave-Intervall aktiv:", !!window.serverSync.slaveCheckInterval);
			console.log("- Periodic-Intervall aktiv:", !!window.serverSync.serverSyncInterval);
		}, 500);
	} else {
		console.log("❌ startMasterMode Methode nicht verfügbar");
	}
}

/**
 * Debug-Funktion: Zeigt detaillierten Sync-Status
 */
function debugSyncStatus() {
	console.log("🔍 DETAILLIERTER SYNC-STATUS:");
	console.log("=".repeat(40));

	// SharingManager Status
	if (window.sharingManager) {
		console.log("📱 SharingManager:");
		console.log("  - syncMode:", window.sharingManager.syncMode);
		console.log("  - isLiveSyncEnabled:", window.sharingManager.isLiveSyncEnabled);
		console.log("  - isMasterMode:", window.sharingManager.isMasterMode);
		console.log("  - initialized:", window.sharingManager.initialized);
	}

	// ServerSync Status
	if (window.serverSync) {
		console.log("🖥️ ServerSync:");
		console.log("  - isMaster:", window.serverSync.isMaster);
		console.log("  - isSlaveActive:", window.serverSync.isSlaveActive);
		console.log("  - serverSyncUrl:", window.serverSync.serverSyncUrl);
		console.log("  - slaveCheckInterval:", !!window.serverSync.slaveCheckInterval);
		console.log("  - serverSyncInterval:", !!window.serverSync.serverSyncInterval);
		console.log("  - lastServerTimestamp:", window.serverSync.lastServerTimestamp);
	}

	// UI Status
	const readToggle = document.getElementById("readDataToggle");
	const writeToggle = document.getElementById("writeDataToggle");
	const currentModeSpan = document.getElementById("currentSyncMode");
	
	console.log("🎨 UI Status:");
	console.log("  - Read Toggle:", readToggle?.checked);
	console.log("  - Write Toggle:", writeToggle?.checked);
	console.log("  - Mode Display:", currentModeSpan?.textContent);
}

/**
 * Hilfsfunktion: Simuliert Browser-Szenarien
 */
function simulateBrowserScenarios() {
	console.log("🧪 SIMULIERE BROWSER-SZENARIEN:");
	console.log("=".repeat(40));

	// Szenario 1: Browser 1 startet mit Write
	console.log("📱 Browser 1 Simulation (Write aktiviert):");
	const readToggle = document.getElementById("readDataToggle");
	const writeToggle = document.getElementById("writeDataToggle");
	
	if (readToggle && writeToggle && window.sharingManager) {
		readToggle.checked = false;
		writeToggle.checked = true;
		window.sharingManager.updateSyncMode(false, true);
		
		setTimeout(() => {
			console.log("  - Modus:", window.sharingManager.syncMode);
			console.log("  - Server Master:", window.serverSync?.isMaster);
			console.log("  - Server Slave:", window.serverSync?.isSlaveActive);
			
			// Szenario 2: Browser 2 startet mit Read (simuliert)
			console.log("\n📱 Browser 2 Simulation (Read aktiviert):");
			console.log("  - Würde in Sync-Modus wechseln");
			console.log("  - Würde sofort Server-Daten laden");
			console.log("  - Würde Server-Updates empfangen");
		}, 1000);
	}
}

// Globale Funktionen verfügbar machen
window.testSyncPriorityFix = testSyncPriorityFix;
window.debugSyncStatus = debugSyncStatus;
window.simulateBrowserScenarios = simulateBrowserScenarios;

console.log("📋 Sync-Priority-Fix Test geladen. Führe testSyncPriorityFix() aus zum Testen.");
