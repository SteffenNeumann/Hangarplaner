/**
 * TEST-SCRIPT FÜR MASTER-SLAVE SYNCHRONISIERUNG
 * Führe in Browser-Konsole aus: loadScript('/test-master-slave.js')
 */

function testMasterSlaveSync() {
	console.log("🧪 MASTER-SLAVE SYNC TEST GESTARTET");

	// 1. Teste ServerSync Instanz
	if (!window.serverSync) {
		console.error("❌ ServerSync nicht verfügbar");
		return false;
	}

	// 2. Teste Master-Slave Eigenschaften
	console.log("Master-Eigenschaften:", {
		isMaster: window.serverSync.isMaster,
		isSlaveActive: window.serverSync.isSlaveActive,
		lastServerTimestamp: window.serverSync.lastServerTimestamp,
	});

	// 3. Teste SharingManager
	if (!window.sharingManager) {
		console.error("❌ SharingManager nicht verfügbar");
		return false;
	}

	console.log("SharingManager-Eigenschaften:", {
		isLiveSyncEnabled: window.sharingManager.isLiveSyncEnabled,
		isMasterMode: window.sharingManager.isMasterMode,
	});

	// 4. NEUE TESTS: UI-Synchronisation
	testUISynchronization();

	// 5. Teste PHP Backend
	testBackendEndpoints();

	console.log("✅ Master-Slave Test abgeschlossen");
	return true;
}

/**
 * NEU: Teste UI-Synchronisation zwischen Widget und Menü
 */
function testUISynchronization() {
	console.log("🎯 Teste UI-Synchronisation...");

	const widgetElement = document.getElementById("sync-mode");
	const menuButton = document.getElementById("syncStatusBtn");

	if (!widgetElement) {
		console.error("❌ Widget-Element (#sync-mode) nicht gefunden");
		return false;
	}

	if (!menuButton) {
		console.error("❌ Menü-Button (#syncStatusBtn) nicht gefunden");
		return false;
	}

	console.log("📱 Aktuelle UI-Zustände:", {
		widget: {
			text: widgetElement.textContent,
			classes: Array.from(widgetElement.classList),
		},
		menu: {
			text: menuButton.textContent,
			classes: Array.from(menuButton.classList),
		},
	});

	// Teste zentrale Update-Funktion
	if (
		window.sharingManager &&
		typeof window.sharingManager.updateAllSyncDisplays === "function"
	) {
		console.log("✅ Zentrale Update-Funktion verfügbar");

		// Teste verschiedene Status
		console.log("🔄 Teste Status-Updates...");
		setTimeout(
			() => window.sharingManager.updateAllSyncDisplays("Master", true),
			500
		);
		setTimeout(
			() => window.sharingManager.updateAllSyncDisplays("Slave", true),
			1500
		);
		setTimeout(
			() => window.sharingManager.updateAllSyncDisplays("Standalone", false),
			2500
		);

		console.log("⏳ Status-Updates werden in 0.5s, 1.5s und 2.5s ausgeführt");
	} else {
		console.error("❌ Zentrale Update-Funktion nicht verfügbar");
		return false;
	}

	return true;
}

async function testBackendEndpoints() {
	console.log("🔍 Teste Backend-Endpoints...");

	const baseUrl = window.serverSync?.serverSyncUrl || "/sync/data.php";

	try {
		// Teste Timestamp-Endpoint
		const timestampResponse = await fetch(`${baseUrl}?action=timestamp`);
		const timestampData = await timestampResponse.json();
		console.log("📅 Timestamp-Endpoint:", timestampData);

		// Teste Standard-Endpoint
		const dataResponse = await fetch(baseUrl);
		if (dataResponse.ok) {
			const data = await dataResponse.json();
			console.log("📊 Standard-Endpoint erfolgreich");
		} else {
			console.log(
				"📭 Keine Server-Daten vorhanden (erwartet bei leerem Server)"
			);
		}
	} catch (error) {
		console.error("❌ Backend-Test Fehler:", error);
	}
}

// Automatischer Test beim Laden
if (typeof window !== "undefined") {
	console.log("🔧 Master-Slave Test-Funktionen geladen");
	console.log("Führe testMasterSlaveSync() aus, um zu testen");
}
