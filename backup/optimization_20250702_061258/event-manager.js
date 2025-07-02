/**
 * ZENTRALER EVENT-MANAGER FÜR SYNCHRONISATION
 * Löst das Problem mit doppelten Event-Listenern zwischen hangar-data.js und storage-browser.js
 */

// Globaler Event-Manager
window.hangarEventManager = {
	initialized: false,
	autoSaveTimeout: null,

	/**
	 * Initialisiert die Event-Listener einmalig
	 */
	init() {
		if (this.initialized) {
			console.log("⚠️  Event-Manager bereits initialisiert");
			return;
		}

		console.log("🔧 Initialisiere zentralen Event-Manager...");

		// Event-Listener für alle relevanten Felder
		this.setupEventListeners();

		this.initialized = true;
		console.log("✅ Zentraler Event-Manager initialisiert");
	},

	/**
	 * Richtet Event-Listener für alle synchronisationsrelevanten Felder ein
	 */
	setupEventListeners() {
		// Input-Event für Text-Felder
		document.addEventListener("input", (event) => {
			const target = event.target;

			// Prüfe ob es ein synchronisationsrelevantes Feld ist
			if (this.isRelevantField(target)) {
				this.handleFieldChange(target, "input");
			}
		});

		// Change-Event für Select-Felder
		document.addEventListener("change", (event) => {
			const target = event.target;

			// Prüfe ob es ein synchronisationsrelevantes Feld ist
			if (this.isRelevantField(target)) {
				this.handleFieldChange(target, "change");
			}
		});

		console.log(
			"📋 Event-Listener für alle Synchronisationsfelder registriert"
		);
	},

	/**
	 * Prüft ob ein Element synchronisationsrelevant ist
	 */
	isRelevantField(element) {
		if (!element || !element.id) return false;

		const relevantPrefixes = [
			"aircraft-",
			"arrival-time-",
			"departure-time-",
			"position-",
			"hangar-position-",
			"manual-input-",
			"notes-",
			"status-",
			"tow-status-",
		];

		return relevantPrefixes.some((prefix) => element.id.startsWith(prefix));
	},

	/**
	 * Behandelt Änderungen in relevanten Feldern
	 */
	handleFieldChange(element, eventType) {
		// Verhindere Speichern während Server-Anwendung
		if (window.isApplyingServerData) {
			console.log(
				"🚫 Auto-Save übersprungen (Server-Anwendung läuft):",
				element.id
			);
			return;
		}

		// Container-Validation: Prüfe, ob das Element im richtigen Container ist
		const elementId = element.id;
		const tileIdMatch = elementId.match(/-(\d+)$/);

		if (tileIdMatch) {
			const tileId = parseInt(tileIdMatch[1]);
			const isSecondaryExpected = tileId >= 101;

			// Finde heraus, in welchem Container das Element tatsächlich ist
			const primaryContainer = document.querySelector("#hangarGrid");
			const secondaryContainer = document.querySelector("#secondaryHangarGrid");

			const isInPrimary =
				primaryContainer && primaryContainer.contains(element);
			const isInSecondary =
				secondaryContainer && secondaryContainer.contains(element);

			// Validation: Element muss im richtigen Container sein
			if (isSecondaryExpected && !isInSecondary) {
				console.error(
					`❌ CONTAINER MAPPING FEHLER: Element ${elementId} (sekundär erwartet) ist NICHT im sekundären Container!`
				);
				return;
			}

			if (!isSecondaryExpected && !isInPrimary) {
				console.error(
					`❌ CONTAINER MAPPING FEHLER: Element ${elementId} (primär erwartet) ist NICHT im primären Container!`
				);
				return;
			}

			console.log(
				`✅ Container-Validation OK: ${elementId} ist im richtigen Container (${
					isSecondaryExpected ? "sekundär" : "primär"
				})`
			);
		}

		console.log(
			`🔄 Feld geändert (${eventType}):`,
			element.id,
			"=>",
			element.value
		);

		// Auto-Save auslösen, falls aktiviert
		if (localStorage.getItem("hangarplanner_auto_sync") === "true") {
			this.triggerAutoSave(element.id, eventType);
		}

		// LocalStorage sofort aktualisieren für kritische Felder
		this.updateLocalStorageForField(element);
	},

	/**
	 * Löst Auto-Save mit Verzögerung aus
	 */
	triggerAutoSave(fieldId, eventType) {
		clearTimeout(this.autoSaveTimeout);

		// Unterschiedliche Verzögerungen je nach Event-Typ
		const delay = eventType === "change" ? 100 : 1000;

		this.autoSaveTimeout = setTimeout(() => {
			if (
				window.storageBrowser &&
				typeof window.storageBrowser.saveCurrentProject === "function"
			) {
				console.log(`💾 Auto-Save ausgelöst durch ${eventType}:`, fieldId);
				window.storageBrowser.saveCurrentProject();
			} else {
				console.warn("❌ storageBrowser.saveCurrentProject nicht verfügbar");
			}
		}, delay);
	},

	/**
	 * Aktualisiert localStorage für ein einzelnes Feld
	 */
	updateLocalStorageForField(element) {
		// Extrahiere Tile-ID aus der Element-ID
		const match = element.id.match(/(\w+)-(\d+)$/);
		if (!match) return;

		const [, fieldType, tileId] = match;
		const tileIdNum = parseInt(tileId);

		// Aktualisiere entsprechende localStorage-Daten
		try {
			const settings = JSON.parse(
				localStorage.getItem("hangarPlannerSettings") || "{}"
			);

			// Initialisiere Arrays falls nötig
			if (!settings.tileValues) settings.tileValues = [];
			if (!settings.flightTimes) settings.flightTimes = [];

			// Finde oder erstelle Tile-Eintrag
			let tileData = settings.tileValues.find((t) => t.cellId === tileIdNum);
			if (!tileData) {
				tileData = { cellId: tileIdNum };
				settings.tileValues.push(tileData);
			}

			let flightTimeData = settings.flightTimes.find(
				(t) => t.cellId === tileIdNum
			);
			if (!flightTimeData) {
				flightTimeData = { cellId: tileIdNum };
				settings.flightTimes.push(flightTimeData);
			}

			// Aktualisiere entsprechendes Feld
			switch (fieldType) {
				case "aircraft":
					tileData.aircraftId = element.value;
					break;
				case "arrival-time":
					flightTimeData.arrival = element.value;
					break;
				case "departure-time":
					flightTimeData.departure = element.value;
					break;
				case "position":
					flightTimeData.position = element.value;
					break;
				case "hangar-position":
					tileData.position = element.value;
					break;
				case "manual-input":
					tileData.manualInput = element.value;
					break;
				case "notes":
					tileData.notes = element.value;
					break;
				case "status":
					tileData.status = element.value;
					break;
				case "tow-status":
					tileData.towStatus = element.value;
					break;
			}

			// Speichere zurück zu localStorage
			localStorage.setItem("hangarPlannerSettings", JSON.stringify(settings));

			console.log(
				`📝 LocalStorage aktualisiert für ${fieldType}-${tileId}:`,
				element.value
			);
		} catch (error) {
			console.error("❌ Fehler beim Aktualisieren des localStorage:", error);
		}
	},

	/**
	 * Manueller Test der Event-Manager-Funktionalität
	 */
	test() {
		console.log("🧪 TESTE EVENT-MANAGER");
		console.log("======================");

		// Teste Feld-Erkennung
		const testFields = [
			"aircraft-1",
			"arrival-time-1",
			"departure-time-1",
			"position-1",
		];

		testFields.forEach((fieldId) => {
			const element = document.getElementById(fieldId);
			if (element) {
				const isRelevant = this.isRelevantField(element);
				console.log(
					`${isRelevant ? "✅" : "❌"} ${fieldId}: relevant=${isRelevant}`
				);
			} else {
				console.log(`❌ ${fieldId}: Element nicht gefunden`);
			}
		});

		// Teste Event-Simulation
		const aircraftField = document.getElementById("aircraft-1");
		if (aircraftField) {
			console.log("\n🎯 Simuliere Änderung in aircraft-1...");
			aircraftField.value = "D-TEST";
			aircraftField.dispatchEvent(new Event("input", { bubbles: true }));
		}
	},
};

// Auto-Initialisierung nach DOM-Laden
document.addEventListener("DOMContentLoaded", () => {
	// Kurze Verzögerung, damit andere Module geladen sind
	setTimeout(() => {
		window.hangarEventManager.init();
	}, 1000);
});

console.log("🔧 Zentraler Event-Manager geladen");
console.log("📞 Verwende window.hangarEventManager.test() zum Testen");
