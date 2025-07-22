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

	// 4. Teste PHP Backend
	testBackendEndpoints();

	console.log("✅ Master-Slave Test abgeschlossen");
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
