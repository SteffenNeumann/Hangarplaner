/**
 * Debug-Konsole für Hangar Planner Display Options
 * Kann über window.displayOptionsDebug aufgerufen werden
 */

window.displayOptionsDebug = {
	/**
	 * Zeigt den aktuellen Status aller relevanten Systeme
	 */
	status() {
		console.log("🔍 === DISPLAY OPTIONS DEBUG STATUS ===");

		// Display Options System
		console.log("\n📊 Display Options System:");
		if (window.displayOptions) {
			console.log("✅ window.displayOptions verfügbar");
			console.log("Aktuelle Werte:", window.displayOptions.current);
			console.log("Default Werte:", window.displayOptions.defaults);
		} else {
			console.log("❌ window.displayOptions NICHT verfügbar");
		}

		// Server Sync System
		console.log("\n🔄 Server Sync System:");
		if (window.serverSync) {
			console.log("✅ window.serverSync verfügbar");
			console.log("Server URL:", window.serverSync.serverSyncUrl);
			console.log("Sync aktiv:", !!window.serverSync.serverSyncInterval);
		} else {
			console.log("❌ window.serverSync NICHT verfügbar");
		}

		// UI Elemente
		console.log("\n🎛️ UI Elemente Status:");
		const elements = {
			tilesCount: document.getElementById("tilesCount"),
			secondaryTilesCount: document.getElementById("secondaryTilesCount"),
			layoutType: document.getElementById("layoutType"),
			darkModeToggle: document.getElementById("darkModeToggle"),
			viewModeToggle: document.getElementById("viewModeToggle"),
			displayZoom: document.getElementById("displayZoom"),
			updateTilesBtn: document.getElementById("updateTilesBtn"),
			updateSecondaryTilesBtn: document.getElementById(
				"updateSecondaryTilesBtn"
			),
		};

		Object.entries(elements).forEach(([name, element]) => {
			if (element) {
				const value =
					element.type === "checkbox" ? element.checked : element.value;
				console.log(`✅ ${name}: ${value} (${element.tagName})`);
			} else {
				console.log(`❌ ${name}: NICHT gefunden`);
			}
		});

		// localStorage Prüfung
		console.log("\n💾 LocalStorage:");
		try {
			const displayOptions = localStorage.getItem("displayOptions");
			const hangarSettings = localStorage.getItem("hangarPlannerSettings");
			console.log(
				"displayOptions:",
				displayOptions ? JSON.parse(displayOptions) : "NICHT vorhanden"
			);
			console.log(
				"hangarPlannerSettings:",
				hangarSettings ? JSON.parse(hangarSettings) : "NICHT vorhanden"
			);
		} catch (error) {
			console.log("❌ localStorage Fehler:", error);
		}

		console.log("\n🔍 === DEBUG STATUS ENDE ===");
	},

	/**
	 * Testet das Speichern und Laden
	 */
	async testSaveLoad() {
		console.log("🧪 === SAVE/LOAD TEST START ===");

		if (!window.displayOptions) {
			console.log("❌ Display Options nicht verfügbar");
			return;
		}

		// Aktuelle Werte sichern
		const original = { ...window.displayOptions.current };
		console.log("Original:", original);

		// Test-Werte setzen
		const testValues = {
			tilesCount: 7,
			secondaryTilesCount: 3,
			layout: 2,
			darkMode: !original.darkMode,
			viewMode: !original.viewMode,
			zoomLevel: 125,
		};

		try {
			// Test-Werte anwenden
			window.displayOptions.current = { ...testValues };
			window.displayOptions.updateUI();
			console.log("✅ Test-Werte gesetzt:", testValues);

			// Speichern
			const saveSuccess = await window.displayOptions.saveToServer();
			console.log(
				"Speichern:",
				saveSuccess ? "✅ Erfolgreich" : "❌ Fehlgeschlagen"
			);

			// Kurz warten
			await new Promise((resolve) => setTimeout(resolve, 500));

			// Originale Werte setzen (simuliert Neustart)
			window.displayOptions.current = { ...original };

			// Laden
			const loadSuccess = await window.displayOptions.load();
			console.log(
				"Laden:",
				loadSuccess ? "✅ Erfolgreich" : "❌ Fehlgeschlagen"
			);

			if (loadSuccess) {
				// Vergleiche geladene Werte
				const loaded = window.displayOptions.current;
				console.log("Geladen:", loaded);

				const isCorrect = Object.keys(testValues).every(
					(key) => loaded[key] === testValues[key]
				);

				console.log("Werte korrekt:", isCorrect ? "✅ JA" : "❌ NEIN");

				if (!isCorrect) {
					Object.keys(testValues).forEach((key) => {
						if (loaded[key] !== testValues[key]) {
							console.log(
								`❌ ${key}: Erwartet ${testValues[key]}, erhalten ${loaded[key]}`
							);
						}
					});
				}
			}
		} catch (error) {
			console.error("❌ Test Fehler:", error);
		} finally {
			// Originale Werte wiederherstellen
			window.displayOptions.current = { ...original };
			window.displayOptions.updateUI();
			console.log("🔄 Originale Werte wiederhergestellt");
		}

		console.log("🧪 === SAVE/LOAD TEST ENDE ===");
	},

	/**
	 * Repariert häufige Probleme
	 */
	repair() {
		console.log("🔧 === DISPLAY OPTIONS REPARATUR ===");

		if (window.displayOptions) {
			// Event-Handler neu setzen
			window.displayOptions.setupEventHandlers();
			console.log("✅ Event-Handler neu gesetzt");

			// UI forciert aktualisieren
			window.displayOptions.updateUI();
			window.displayOptions.applySettings();
			console.log("✅ UI forciert aktualisiert");

			// Critical Functions sicherstellen
			if (window.emergencyRepair) {
				window.emergencyRepair.ensureCriticalFunctions();
				console.log("✅ Critical Functions überprüft");
			}
		} else {
			console.log("❌ Display Options nicht verfügbar für Reparatur");
		}

		console.log("🔧 === REPARATUR ABGESCHLOSSEN ===");
	},

	/**
	 * Löscht alle gespeicherten Einstellungen (VORSICHT!)
	 */
	reset() {
		const confirm = window.confirm(
			"WARNUNG: Alle Display Options Einstellungen werden gelöscht!\n\nFortfahren?"
		);
		if (!confirm) return;

		console.log("🗑️ === DISPLAY OPTIONS RESET ===");

		// localStorage löschen
		localStorage.removeItem("displayOptions");
		localStorage.removeItem("hangarPlannerSettings");

		// Defaults setzen
		if (window.displayOptions) {
			window.displayOptions.current = { ...window.displayOptions.defaults };
			window.displayOptions.updateUI();
			window.displayOptions.applySettings();
		}

		console.log("✅ Display Options zurückgesetzt");
	},
};

// Hilfe-Funktion
window.displayOptionsHelp = function () {
	console.log(`
🔧 DISPLAY OPTIONS DEBUG HILFE

Verfügbare Befehle:
- window.displayOptionsDebug.status()     → Zeigt aktuellen Status
- window.displayOptionsDebug.testSaveLoad() → Testet Speichern/Laden
- window.displayOptionsDebug.repair()     → Repariert häufige Probleme
- window.displayOptionsDebug.reset()      → Setzt alle Einstellungen zurück (VORSICHT!)

Für Hilfe: window.displayOptionsHelp()
    `);
};

console.log(
	"🔧 Display Options Debug-Konsole geladen. Verwende window.displayOptionsHelp() für Hilfe."
);
