/**
 * TEST-SCRIPT FÜR SYNC-BUTTON STATUS ANZEIGE
 * Führe in Browser-Konsole aus: loadScript('/test-sync-button.js')
 */

function testSyncButtonDisplay() {
	console.log("🧪 SYNC-BUTTON DISPLAY TEST GESTARTET");

	// Test 1: Überprüfe ob Sharing Manager verfügbar ist
	if (!window.sharingManager) {
		console.error("❌ Sharing Manager nicht verfügbar");
		return;
	}

	const syncBtn = document.getElementById("syncStatusBtn");
	if (!syncBtn) {
		console.error("❌ Sync Status Button nicht gefunden");
		return;
	}

	console.log("✅ Initial Button Text:", syncBtn.textContent);

	// Test 2: Teste Master-Modus
	console.log("\n🔧 Teste Master-Modus...");
	window.sharingManager.updateSyncStatusDisplay("Master", true);
	console.log("📊 Master Text:", syncBtn.textContent);
	console.log("🏷️ Master Classes:", syncBtn.className);

	// Kurze Pause
	setTimeout(() => {
		// Test 3: Teste Slave-Modus
		console.log("\n🔧 Teste Slave-Modus...");
		window.sharingManager.updateSyncStatusDisplay("Slave", true);
		console.log("📊 Slave Text:", syncBtn.textContent);
		console.log("🏷️ Slave Classes:", syncBtn.className);

		setTimeout(() => {
			// Test 4: Teste deaktivierten Modus
			console.log("\n🔧 Teste deaktivierten Modus...");
			window.sharingManager.updateSyncStatusDisplay("Deaktiviert", false);
			console.log("📊 Deaktiviert Text:", syncBtn.textContent);
			console.log("🏷️ Deaktiviert Classes:", syncBtn.className);

			setTimeout(() => {
				// Test 5: Teste Status-Indikatoren mit Master-Modus
				console.log("\n🔧 Teste Status-Indikatoren mit Master...");
				window.sharingManager.updateSyncStatusDisplay("Master", true);

				setTimeout(() => {
					window.sharingManager.updateSyncStatusIndicator("warning");
					console.log("⚠️ Master + Warning:", syncBtn.textContent);
				}, 500);

				setTimeout(() => {
					window.sharingManager.updateSyncStatusIndicator("error");
					console.log("❌ Master + Error:", syncBtn.textContent);
				}, 1000);

				setTimeout(() => {
					window.sharingManager.updateSyncStatusIndicator("success");
					console.log("✅ Master + Success:", syncBtn.textContent);
				}, 1500);
			}, 1000);
		}, 1000);
	}, 1000);

	setTimeout(() => {
		console.log("\n✅ Sync-Button Display Test abgeschlossen");
	}, 5000);
}

// Test-Funktion für alle Status-Kombinationen
function testAllStatusCombinations() {
	console.log("🎯 TESTE ALLE STATUS-KOMBINATIONEN");

	const testCases = [
		{ mode: "Master", active: true, indicator: "success" },
		{ mode: "Master", active: true, indicator: "warning" },
		{ mode: "Master", active: true, indicator: "error" },
		{ mode: "Slave", active: true, indicator: "success" },
		{ mode: "Slave", active: true, indicator: "warning" },
		{ mode: "Slave", active: true, indicator: "error" },
		{ mode: "Deaktiviert", active: false, indicator: null },
	];

	const syncBtn = document.getElementById("syncStatusBtn");

	testCases.forEach((testCase, index) => {
		setTimeout(() => {
			console.log(
				`\n🧪 Test ${index + 1}: ${testCase.mode} ${
					testCase.indicator || "normal"
				}`
			);

			window.sharingManager.updateSyncStatusDisplay(
				testCase.mode,
				testCase.active
			);

			if (testCase.indicator) {
				setTimeout(() => {
					window.sharingManager.updateSyncStatusIndicator(testCase.indicator);
				}, 100);
			}

			setTimeout(() => {
				console.log(`📊 Result: "${syncBtn.textContent}"`);
				console.log(`🏷️ Classes: ${syncBtn.className}`);
			}, 200);
		}, index * 1500);
	});
}

// Lade Test-Funktionen
console.log("🔧 Sync-Button Test-Funktionen geladen");
console.log("Führe testSyncButtonDisplay() aus, um den Test zu starten");
console.log(
	"Führe testAllStatusCombinations() aus, um alle Kombinationen zu testen"
);
