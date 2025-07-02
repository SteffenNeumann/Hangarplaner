/**
 * VEREINFACHTE SYNC-DIAGNOSE
 * Analysiert warum Arrival Time, Departure Time und Position nicht synchronisiert werden
 */

window.syncDiagnosis = {
	/**
	 * Führt eine schnelle Diagnose durch
	 */
	runQuickDiagnosis() {
		console.log("🔍 SYNC-DIAGNOSE STARTET");
		console.log("========================");

		// Test 1: Prüfe HTML-Struktur
		this.testHtmlStructure();

		// Test 2: Prüfe Event-Listener
		this.testEventListeners();

		// Test 3: Prüfe Datensammlung
		this.testDataCollection();

		// Test 4: Prüfe Datenanwendung
		this.testDataApplication();

		console.log("🔍 SYNC-DIAGNOSE BEENDET");
	},

	/**
	 * Testet die HTML-Struktur
	 */
	testHtmlStructure() {
		console.log("\n📋 HTML-STRUKTUR TEST");
		console.log("---------------------");

		const tileIds = [1, 2, 3]; // Teste die ersten 3 Tiles
		const fieldTypes = [
			{ prefix: "aircraft-", name: "Aircraft ID" },
			{ prefix: "arrival-time-", name: "Arrival Time" },
			{ prefix: "departure-time-", name: "Departure Time" },
			{ prefix: "position-", name: "Position Info Grid" },
			{ prefix: "hangar-position-", name: "Hangar Position" },
		];

		tileIds.forEach((tileId) => {
			console.log(`\nTile ${tileId}:`);
			fieldTypes.forEach((fieldType) => {
				const elementId = `${fieldType.prefix}${tileId}`;
				const element = document.getElementById(elementId);
				const status = element ? "✅" : "❌";
				console.log(`  ${status} ${fieldType.name}: ${elementId}`);
			});
		});
	},

	/**
	 * Testet Event-Listener
	 */
	testEventListeners() {
		console.log("\n🎯 EVENT-LISTENER TEST");
		console.log("----------------------");

		// Prüfe ob storage-browser Event-Listener gesetzt hat
		const fieldPrefixes = [
			"aircraft-",
			"arrival-time-",
			"departure-time-",
			"position-",
		];

		fieldPrefixes.forEach((prefix) => {
			const testElement = document.querySelector(`[id^="${prefix}"]`);
			if (testElement) {
				// Teste ob Event-Listener vorhanden sind
				const hasInputListener = testElement.oninput !== null;
				const hasChangeListener = testElement.onchange !== null;
				console.log(
					`  ${prefix}: Input=${hasInputListener ? "✅" : "❌"}, Change=${
						hasChangeListener ? "✅" : "❌"
					}`
				);
			} else {
				console.log(`  ${prefix}: Element nicht gefunden ❌`);
			}
		});
	},

	/**
	 * Testet Datensammlung
	 */
	testDataCollection() {
		console.log("\n📦 DATENSAMMLUNG TEST");
		console.log("---------------------");

		// Teste storage-browser Datensammlung
		if (
			window.storageBrowser &&
			typeof window.storageBrowser.collectSingleTileData === "function"
		) {
			const testTileId = 1;
			const collectedData =
				window.storageBrowser.collectSingleTileData(testTileId);

			console.log(`Gesammelte Daten für Tile ${testTileId}:`);
			console.log(`  Aircraft ID: "${collectedData.aircraftId}"`);
			console.log(`  Arrival Time: "${collectedData.arrivalTime}"`);
			console.log(`  Departure Time: "${collectedData.departureTime}"`);
			console.log(`  Position Info Grid: "${collectedData.positionInfoGrid}"`);
			console.log(`  Hangar Position: "${collectedData.position}"`);
		} else {
			console.log("❌ StorageBrowser.collectSingleTileData nicht verfügbar");
		}

		// Teste hangar-data Datensammlung
		if (
			window.hangarData &&
			typeof window.hangarData.collectHangarData === "function"
		) {
			console.log("\n✅ hangarData.collectHangarData verfügbar");
		} else {
			console.log("\n❌ hangarData.collectHangarData nicht verfügbar");
		}
	},

	/**
	 * Testet Datenanwendung
	 */
	testDataApplication() {
		console.log("\n🎨 DATENANWENDUNG TEST");
		console.log("----------------------");

		// Testdaten
		const testData = {
			tileId: 1,
			aircraftId: "D-TEST",
			arrivalTime: "14:30",
			departureTime: "16:45",
			positionInfoGrid: "Gate A1",
			position: "H1",
		};

		console.log("Teste Datenanwendung...");

		// Teste storage-browser Anwendung
		if (
			window.storageBrowser &&
			typeof window.storageBrowser.applySingleTileData === "function"
		) {
			console.log("✅ Wende Testdaten über storage-browser an...");
			window.storageBrowser.applySingleTileData(testData);

			// Prüfe ob Daten korrekt angewendet wurden
			setTimeout(() => {
				console.log("\nÜberprüfung nach Anwendung:");
				const aircraftElement = document.getElementById("aircraft-1");
				const arrivalElement = document.getElementById("arrival-time-1");
				const departureElement = document.getElementById("departure-time-1");
				const positionElement = document.getElementById("position-1");

				console.log(
					`  Aircraft: ${
						aircraftElement ? aircraftElement.value : "Element nicht gefunden"
					}`
				);
				console.log(
					`  Arrival: ${
						arrivalElement ? arrivalElement.value : "Element nicht gefunden"
					}`
				);
				console.log(
					`  Departure: ${
						departureElement ? departureElement.value : "Element nicht gefunden"
					}`
				);
				console.log(
					`  Position: ${
						positionElement ? positionElement.value : "Element nicht gefunden"
					}`
				);
			}, 100);
		} else {
			console.log("❌ StorageBrowser.applySingleTileData nicht verfügbar");
		}
	},

	/**
	 * Testet die Server-Synchronisation
	 */
	async testServerSync() {
		console.log("\n🌐 SERVER-SYNC TEST");
		console.log("-------------------");

		// Prüfe Auto-Sync Einstellung
		const autoSyncEnabled =
			localStorage.getItem("hangarplanner_auto_sync") === "true";
		console.log(`Auto-Sync aktiviert: ${autoSyncEnabled ? "✅" : "❌"}`);

		// Prüfe Server-URL
		if (window.storageBrowser && window.storageBrowser.serverSyncUrl) {
			console.log(`Server-URL: ${window.storageBrowser.serverSyncUrl} ✅`);
		} else {
			console.log("Server-URL nicht konfiguriert ❌");
		}

		// Teste Server-Verbindung
		try {
			if (
				window.storageBrowser &&
				typeof window.storageBrowser.saveCurrentProject === "function"
			) {
				console.log("Teste Server-Speicherung...");
				await window.storageBrowser.saveCurrentProject();
				console.log("Server-Speicherung erfolgreich ✅");
			}
		} catch (error) {
			console.log(`Server-Speicherung fehlgeschlagen ❌: ${error.message}`);
		}
	},

	/**
	 * Setzt Testwerte in alle verfügbaren Felder
	 */
	setTestValues() {
		console.log("\n🧪 SETZE TESTWERTE");
		console.log("------------------");

		const testValues = {
			"aircraft-1": "D-TEST1",
			"arrival-time-1": "14:30",
			"departure-time-1": "16:45",
			"position-1": "Gate A1",
			"hangar-position-1": "H1",
			"aircraft-2": "D-TEST2",
			"arrival-time-2": "15:15",
			"departure-time-2": "17:20",
			"position-2": "Gate B2",
			"hangar-position-2": "H2",
		};

		Object.entries(testValues).forEach(([elementId, value]) => {
			const element = document.getElementById(elementId);
			if (element) {
				element.value = value;
				// Event manuell auslösen
				element.dispatchEvent(new Event("input", { bubbles: true }));
				console.log(`✅ ${elementId}: "${value}"`);
			} else {
				console.log(`❌ ${elementId}: Element nicht gefunden`);
			}
		});

		console.log(
			"\nTestwerte gesetzt. Auto-Save sollte in 1-2 Sekunden ausgelöst werden."
		);
	},
};

// Einfache API für schnelle Tests
window.quickSync = {
	diagnose: () => window.syncDiagnosis.runQuickDiagnosis(),
	test: () => window.syncDiagnosis.setTestValues(),
	server: () => window.syncDiagnosis.testServerSync(),
	structure: () => window.syncDiagnosis.testHtmlStructure(),
	data: () => window.syncDiagnosis.testDataCollection(),
};

console.log("🔧 Sync-Diagnose geladen");
console.log(
	"📞 Verwende window.quickSync.diagnose() für vollständige Diagnose"
);
console.log("📞 Verwende window.quickSync.test() um Testwerte zu setzen");
console.log("📞 Verwende window.quickSync.server() für Server-Test");
