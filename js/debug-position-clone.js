/**
 * Debug-Script für Position-Klon-Problem
 * Dieses Script testet und validiert die Behebung des Position-Klon-Bugs
 */

// Teste das Position-Klon-Problem
function testPositionCloning() {
	console.log("=== TEST: Position-Klon-Problem ===");

	// 1. Setze eine Position in die erste primäre Tile
	const primaryPosition = document.getElementById("hangar-position-1");
	if (primaryPosition) {
		primaryPosition.value = "TEST-1A";
		console.log("✅ Primäre Position 1 gesetzt auf: TEST-1A");
	}

	// 2. Erstelle sekundäre Tiles
	if (window.hangarUI && window.hangarUI.updateSecondaryTiles) {
		console.log("Erstelle 4 sekundäre Tiles...");
		window.hangarUI.updateSecondaryTiles(4, 4);

		// 3. Prüfe ob sekundäre Tiles die Position geklont haben
		setTimeout(() => {
			let cloneDetected = false;
			for (let i = 101; i <= 104; i++) {
				const secondaryPosition = document.getElementById(
					`hangar-position-${i}`
				);
				if (secondaryPosition && secondaryPosition.value === "TEST-1A") {
					console.error(
						`❌ KLON ERKANNT: Sekundäre Tile ${i} hat Position "TEST-1A" geklont!`
					);
					cloneDetected = true;
				} else if (secondaryPosition) {
					console.log(
						`✅ Sekundäre Tile ${i} ist leer (Wert: "${secondaryPosition.value}")`
					);
				}
			}

			if (!cloneDetected) {
				console.log(
					"🎉 POSITION-KLON-BUG BEHOBEN! Alle sekundären Tiles sind leer."
				);
			}

			// Cleanup: Leere die Test-Position
			if (primaryPosition) {
				primaryPosition.value = "";
				console.log("🧹 Test-Position geleert");
			}
		}, 100);
	} else {
		console.error("❌ hangarUI.updateSecondaryTiles Funktion nicht verfügbar");
	}
}

// Teste das Synchronisations-Szenario
function testSyncScenario() {
	console.log("=== TEST: Synchronisations-Szenario ===");

	// Simuliere Server-Sync Daten mit verschiedenen Positionen
	const testSyncData = {
		primaryTiles: [
			{ tileId: 1, position: "A1", aircraftId: "D-ABCD" },
			{ tileId: 2, position: "A2", aircraftId: "D-EFGH" },
		],
		secondaryTiles: [
			{ tileId: 101, position: "B1", aircraftId: "D-IJKL" },
			{ tileId: 102, position: "B2", aircraftId: "D-MNOP" },
		],
	};

	console.log("Teste Sync-Datenübertragung...");

	// Wende Test-Daten an
	if (window.storageBrowser && window.storageBrowser.applyTilesData) {
		window.storageBrowser.applyTilesData(testSyncData);

		setTimeout(() => {
			// Validiere dass keine Daten zwischen Primary/Secondary vermischt wurden
			let crossContamination = false;

			// Prüfe primäre Tiles
			testSyncData.primaryTiles.forEach((primaryData) => {
				const posInput = document.getElementById(
					`hangar-position-${primaryData.tileId}`
				);
				if (posInput && posInput.value !== primaryData.position) {
					console.error(
						`❌ Primäre Tile ${primaryData.tileId}: Erwartet "${primaryData.position}", gefunden "${posInput.value}"`
					);
					crossContamination = true;
				} else if (posInput) {
					console.log(
						`✅ Primäre Tile ${primaryData.tileId}: Korrekte Position "${posInput.value}"`
					);
				}
			});

			// Prüfe sekundäre Tiles
			testSyncData.secondaryTiles.forEach((secondaryData) => {
				const posInput = document.getElementById(
					`hangar-position-${secondaryData.tileId}`
				);
				if (posInput && posInput.value !== secondaryData.position) {
					console.error(
						`❌ Sekundäre Tile ${secondaryData.tileId}: Erwartet "${secondaryData.position}", gefunden "${posInput.value}"`
					);
					crossContamination = true;
				} else if (posInput) {
					console.log(
						`✅ Sekundäre Tile ${secondaryData.tileId}: Korrekte Position "${posInput.value}"`
					);
				}
			});

			if (!crossContamination) {
				console.log(
					"🎉 SYNC-CONTAINER-MAPPING KORREKT! Keine Cross-Contamination erkannt."
				);
			}

			// Cleanup
			[...testSyncData.primaryTiles, ...testSyncData.secondaryTiles].forEach(
				(tile) => {
					const posInput = document.getElementById(
						`hangar-position-${tile.tileId}`
					);
					const aircraftInput = document.getElementById(
						`aircraft-${tile.tileId}`
					);
					if (posInput) posInput.value = "";
					if (aircraftInput) aircraftInput.value = "";
				}
			);
			console.log("🧹 Test-Daten geleert");
		}, 200);
	} else {
		console.error("❌ storageBrowser.applyTilesData Funktion nicht verfügbar");
	}
}

// Führe alle Tests aus
function runAllPositionTests() {
	console.log("🔧 STARTE POSITION-KLON-TESTS");
	testPositionCloning();

	setTimeout(() => {
		testSyncScenario();
	}, 1000);
}

// Mache Tests global verfügbar
window.debugPositionCloning = {
	testPositionCloning,
	testSyncScenario,
	runAllPositionTests,
};

console.log(
	"🔧 Position-Klon Debug-Funktionen geladen. Verwende: window.debugPositionCloning.runAllPositionTests()"
);
