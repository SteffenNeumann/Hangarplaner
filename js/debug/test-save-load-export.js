/**
 * Test-Script zur Verifikation der Save/Load/Export-Funktionalität
 * Führt automatische Tests der FileManager-Funktionen durch
 */

console.log("🧪 Starte Save/Load/Export-Funktionalitäts-Tests...");

// Test-Utilities
function testLog(testName, result, details = "") {
	const status = result ? "✅" : "❌";
	console.log(`${status} ${testName}${details ? ": " + details : ""}`);
	return result;
}

function runTests() {
	console.group("📋 FileManager Tests");

	// Test 1: FileManager Instanz verfügbar
	testLog("FileManager Instanz", !!window.fileManager);

	// Test 2: FileManager Methoden verfügbar
	if (window.fileManager) {
		testLog(
			"saveProject Methode",
			typeof window.fileManager.saveProject === "function"
		);
		testLog(
			"loadProject Methode",
			typeof window.fileManager.loadProject === "function"
		);
		testLog(
			"exportCurrentFile Methode",
			typeof window.fileManager.exportCurrentFile === "function"
		);
		testLog("File System API Support", window.fileManager.fileSystemSupported);
	}

	console.groupEnd();

	console.group("📋 HangarData Tests");

	// Test 3: HangarData Funktionen verfügbar
	if (window.hangarData) {
		testLog(
			"saveProjectToFile Methode",
			typeof window.hangarData.saveProjectToFile === "function"
		);
		testLog(
			"loadProjectFromFile Methode",
			typeof window.hangarData.loadProjectFromFile === "function"
		);
		testLog(
			"exportCurrentFile Methode",
			typeof window.hangarData.exportCurrentFile === "function"
		);
	}

	// Test 4: Hilfsfunktionen verfügbar
	testLog("collectTilesData Funktion", typeof collectTilesData === "function");
	testLog(
		"collectSettingsData Funktion",
		typeof collectSettingsData === "function"
	);
	testLog("applyProjectData Funktion", typeof applyProjectData === "function");
	testLog(
		"generateDefaultProjectName Funktion",
		typeof generateDefaultProjectName === "function"
	);

	console.groupEnd();

	console.group("📋 UI Element Tests");

	// Test 5: UI-Elemente verfügbar
	testLog("Save Button", !!document.getElementById("saveBtn"));
	testLog("Load Button", !!document.getElementById("loadBtn"));
	testLog("Export Button", !!document.getElementById("exportBtn"));
	testLog("Project Name Input", !!document.getElementById("projectName"));

	console.groupEnd();

	console.group("📋 Funktionalitäts-Tests");

	// Test 6: Dateiname-Generierung
	if (typeof generateDefaultProjectName === "function") {
		try {
			const fileName = generateDefaultProjectName();
			const isValidFormat = /^\d{4}_\d{2}_\d{2}_\d{2}:\d{2}_Hangarplan$/.test(
				fileName
			);
			testLog("Dateiname Format", isValidFormat, fileName);
		} catch (error) {
			testLog("Dateiname Generierung", false, error.message);
		}
	}

	// Test 7: Datensammlung
	if (typeof collectTilesData === "function") {
		try {
			const tilesData = collectTilesData();
			testLog(
				"Tiles Datensammlung",
				Array.isArray(tilesData) || typeof tilesData === "object"
			);
		} catch (error) {
			testLog("Tiles Datensammlung", false, error.message);
		}
	}

	if (typeof collectSettingsData === "function") {
		try {
			const settingsData = collectSettingsData();
			testLog("Settings Datensammlung", typeof settingsData === "object");
		} catch (error) {
			testLog("Settings Datensammlung", false, error.message);
		}
	}

	console.groupEnd();

	// Test 8: Browser-Kompatibilität
	console.group("📋 Browser-Kompatibilität");
	testLog(
		"File System Access API",
		"showSaveFilePicker" in window && "showOpenFilePicker" in window
	);
	testLog("Blob Support", typeof Blob !== "undefined");
	testLog(
		"URL.createObjectURL Support",
		typeof URL !== "undefined" && typeof URL.createObjectURL === "function"
	);
	console.groupEnd();

	console.log("🎯 Test-Zusammenfassung abgeschlossen");
	return true;
}

// Test-Funktion für Export mit Mock-Daten
function testExportFunction() {
	console.log("🧪 Teste Export-Funktion mit Mock-Daten...");

	const mockProjectData = {
		metadata: {
			projectName: "Test_Export",
			lastModified: new Date().toISOString(),
		},
		tilesData: [{ id: "A1", aircraft: "D-TEST", status: "occupied" }],
		settings: { testMode: true },
	};

	if (
		window.hangarData &&
		typeof window.hangarData.exportCurrentFile === "function"
	) {
		try {
			// Überschreibe temporär collectTilesData und collectSettingsData für Test
			const originalCollectTiles = window.collectTilesData;
			const originalCollectSettings = window.collectSettingsData;

			window.collectTilesData = () => mockProjectData.tilesData;
			window.collectSettingsData = () => mockProjectData.settings;

			const result = window.hangarData.exportCurrentFile();

			// Wiederherstellen
			window.collectTilesData = originalCollectTiles;
			window.collectSettingsData = originalCollectSettings;

			testLog("Export-Test", result);
			return result;
		} catch (error) {
			testLog("Export-Test", false, error.message);
			return false;
		}
	} else {
		testLog("Export-Test", false, "Export-Funktion nicht verfügbar");
		return false;
	}
}

// Event-Handler für manuelle Tests
function setupTestButtons() {
	console.log("🎮 Richte Test-Buttons ein...");

	// Test-Export Button hinzufügen (falls gewünscht)
	const testExportBtn = document.createElement("button");
	testExportBtn.textContent = "🧪 Test Export";
	testExportBtn.style.cssText = `
        position: fixed;
        top: 10px;
        right: 10px;
        z-index: 10000;
        padding: 8px 12px;
        background: #10b981;
        color: white;
        border: none;
        border-radius: 4px;
        font-size: 12px;
        cursor: pointer;
    `;
	testExportBtn.onclick = testExportFunction;

	// Nur in Development-Mode anzeigen (wenn console sichtbar)
	if (
		window.location.hostname === "localhost" ||
		window.location.hostname.includes("127.0.0.1")
	) {
		document.body.appendChild(testExportBtn);
	}
}

// Tests beim Laden der Seite ausführen
document.addEventListener("DOMContentLoaded", function () {
	setTimeout(() => {
		runTests();
		setupTestButtons();
	}, 2000); // Warten bis alle Module geladen sind
});

// Tests auch zur zentralen Initialisierung hinzufügen
if (window.hangarInitQueue) {
	window.hangarInitQueue.push(function () {
		setTimeout(runTests, 500);
	});
}

console.log("✅ Test-Script geladen");
