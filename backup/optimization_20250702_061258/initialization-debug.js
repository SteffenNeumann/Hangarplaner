/**
 * initialization-debug.js
 * Debug-Funktionen für die Überprüfung der korrekten Initialisierung
 */

window.initDebug = {
	/**
	 * Überprüft alle kritischen Initialisierungen
	 */
	checkAllInitializations() {
		console.log("🔍 VOLLSTÄNDIGE INITIALISIERUNGS-DIAGNOSE");
		console.log("==========================================");

		// 1. Display Options prüfen
		this.checkDisplayOptions();

		// 2. HangarUI prüfen
		this.checkHangarUI();

		// 3. Event-Handler prüfen
		this.checkEventHandlers();

		// 4. Fehlende Funktionen prüfen
		this.checkMissingFunctions();

		console.log("==========================================");
		console.log("✅ Initialisierungs-Diagnose abgeschlossen");
	},

	/**
	 * Prüft Display Options
	 */
	checkDisplayOptions() {
		console.log("\n📋 DISPLAY OPTIONS PRÜFUNG:");

		if (window.displayOptions) {
			console.log("✅ window.displayOptions verfügbar");
			console.log("📊 Aktuelle Werte:", window.displayOptions.current);
			console.log("📊 Standardwerte:", window.displayOptions.defaults);
		} else {
			console.error("❌ window.displayOptions NICHT verfügbar");
		}

		// UI-Elemente prüfen
		const displayElements = [
			"tilesCount",
			"secondaryTilesCount",
			"layoutType",
			"darkModeToggle",
			"viewModeToggle",
			"displayZoom",
		];

		displayElements.forEach((elementId) => {
			const element = document.getElementById(elementId);
			if (element) {
				console.log(`✅ ${elementId}: ${element.value || element.checked}`);
			} else {
				console.warn(`⚠️ ${elementId}: Element nicht gefunden`);
			}
		});
	},

	/**
	 * Prüft HangarUI
	 */
	checkHangarUI() {
		console.log("\n🎨 HANGAR UI PRÜFUNG:");

		if (window.hangarUI) {
			console.log("✅ window.hangarUI verfügbar");

			const requiredFunctions = [
				"initSectionLayout",
				"initializeSidebarAccordion",
			];

			requiredFunctions.forEach((funcName) => {
				if (typeof window.hangarUI[funcName] === "function") {
					console.log(`✅ ${funcName} verfügbar`);
				} else {
					console.error(`❌ ${funcName} NICHT verfügbar`);
				}
			});
		} else {
			console.error("❌ window.hangarUI NICHT verfügbar");
		}
	},

	/**
	 * Prüft Event-Handler
	 */
	checkEventHandlers() {
		console.log("\n🎯 EVENT-HANDLER PRÜFUNG:");

		// Display Options Event-Handler prüfen
		const buttons = ["updateTilesBtn", "updateSecondaryTilesBtn"];

		buttons.forEach((buttonId) => {
			const button = document.getElementById(buttonId);
			if (button) {
				const hasHandler = button.onclick !== null || button._listeners;
				console.log(
					`${hasHandler ? "✅" : "⚠️"} ${buttonId}: Event-Handler ${
						hasHandler ? "vorhanden" : "fehlt möglicherweise"
					}`
				);
			} else {
				console.warn(`⚠️ ${buttonId}: Button nicht gefunden`);
			}
		});
	},

	/**
	 * Prüft auf fehlende Funktionen
	 */
	checkMissingFunctions() {
		console.log("\n🔧 FEHLENDE FUNKTIONEN PRÜFUNG:");

		const requiredGlobalFunctions = [
			"saveFlightTimeValueToLocalStorage",
			"updateTiles",
			"updateSecondaryTiles",
			"showNotification",
		];

		requiredGlobalFunctions.forEach((funcName) => {
			if (typeof window[funcName] === "function") {
				console.log(`✅ ${funcName} verfügbar`);
			} else {
				console.warn(`⚠️ ${funcName} nicht verfügbar`);
			}
		});
	},

	/**
	 * Repariert häufige Initialisierungsprobleme
	 */
	async repairCommonIssues() {
		console.log("🔧 REPARIERE HÄUFIGE PROBLEME...");

		// 1. Display Options neu initialisieren falls nötig
		if (!window.displayOptions || !window.displayOptions.current) {
			console.log("🔄 Initialisiere Display Options neu...");
			if (window.displayOptions && window.displayOptions.init) {
				await window.displayOptions.init();
			}
		}

		// 2. Fehlende Update-Funktionen hinzufügen
		if (typeof window.updateTiles !== "function") {
			console.log("🔧 Erstelle updateTiles Funktion...");
			window.updateTiles = function (count) {
				if (window.hangarUI && window.hangarUI.uiSettings) {
					window.hangarUI.uiSettings.tilesCount = count;
					window.hangarUI.uiSettings.apply();
				}
			};
		}

		if (typeof window.updateSecondaryTiles !== "function") {
			console.log("🔧 Erstelle updateSecondaryTiles Funktion...");
			window.updateSecondaryTiles = function (count) {
				if (window.hangarUI && window.hangarUI.updateSecondaryTiles) {
					window.hangarUI.updateSecondaryTiles(
						count,
						window.hangarUI.uiSettings.layout
					);
				}
			};
		}

		if (typeof window.showNotification !== "function") {
			console.log("🔧 Erstelle showNotification Funktion...");
			window.showNotification = function (message, type = "info") {
				console.log(`${type.toUpperCase()}: ${message}`);
				// Hier könnte eine echte Notification-UI integriert werden
			};
		}

		console.log("✅ Reparaturen abgeschlossen");
	},

	/**
	 * Vollständiger Reset und Neuinitialisierung
	 */
	async fullReset() {
		console.log("🔄 VOLLSTÄNDIGER RESET...");

		// Repariere Probleme
		await this.repairCommonIssues();

		// Display Options neu initialisieren
		if (window.displayOptions) {
			await window.displayOptions.init();
		}

		// HangarUI neu initialisieren falls möglich
		if (window.hangarUI && window.hangarUI.initSectionLayout) {
			window.hangarUI.initSectionLayout();
		}

		console.log("✅ Vollständiger Reset abgeschlossen");
	},
};

// Automatische Diagnose nach DOM-Load
document.addEventListener("DOMContentLoaded", () => {
	setTimeout(() => {
		window.initDebug.checkAllInitializations();
	}, 2000); // 2 Sekunden warten, damit alle Scripts geladen sind
});

// Globale Hilfsfunktionen für die Konsole
window.diagnoseInit = () => window.initDebug.checkAllInitializations();
window.repairInit = () => window.initDebug.repairCommonIssues();
window.resetInit = () => window.initDebug.fullReset();
