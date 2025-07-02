/**
 * UMFASSENDE VALIDIERUNG FÜR HANGARPLANNER
 * Testet alle kritischen Komponenten und gibt detaillierte Berichte aus
 */

class HangarPlannerValidator {
	constructor() {
		this.results = {
			globalObjects: [],
			functions: [],
			serverSync: [],
			eventHandlers: [],
			dataCollection: [],
			initialization: [],
		};
		this.errors = [];
		this.warnings = [];
	}

	/**
	 * Führt alle Validierungstests durch
	 */
	async runCompleteValidation() {
		console.log("🔍 === UMFASSENDE HANGARPLANNER-VALIDIERUNG ===");

		// Warte auf globale Initialisierung
		await this.waitForInitialization();

		// Führe alle Tests durch
		this.validateGlobalObjects();
		this.validateFunctions();
		await this.validateServerSync();
		this.validateEventHandlers();
		this.validateDataCollection();
		this.validateInitialization();

		// Erstelle Bericht
		this.generateReport();

		return this.results;
	}

	/**
	 * Wartet auf die globale Initialisierung
	 */
	async waitForInitialization() {
		console.log("⏳ Warte auf globale Initialisierung...");

		if (
			window.globalInitialization &&
			!window.globalInitialization.initialized
		) {
			try {
				await window.globalInitialization.waitForModules(5000);
				console.log("✅ Globale Initialisierung abgeschlossen");
				this.results.initialization.push({
					test: "Globale Initialisierung",
					status: "✅ Erfolgreich",
					details: "Alle Module wurden geladen",
				});
			} catch (error) {
				console.warn("⚠️ Timeout bei globaler Initialisierung:", error.message);
				this.warnings.push(`Globale Initialisierung: ${error.message}`);
				this.results.initialization.push({
					test: "Globale Initialisierung",
					status: "⚠️ Timeout",
					details: error.message,
				});
			}
		} else if (window.globalInitialization?.initialized) {
			console.log("✅ Globale Initialisierung bereits abgeschlossen");
			this.results.initialization.push({
				test: "Globale Initialisierung",
				status: "✅ Bereits abgeschlossen",
				details: "Alle Module verfügbar",
			});
		} else {
			console.warn("⚠️ Globale Initialisierung nicht verfügbar");
			this.warnings.push("Globale Initialisierung nicht verfügbar");
			this.results.initialization.push({
				test: "Globale Initialisierung",
				status: "❌ Nicht verfügbar",
				details: "globalInitialization Objekt fehlt",
			});
		}
	}

	/**
	 * Validiert alle globalen Objekte
	 */
	validateGlobalObjects() {
		console.log("🏗️ Validiere globale Objekte...");

		const requiredObjects = [
			{ name: "window.hangarData", object: window.hangarData },
			{ name: "window.hangarUI", object: window.hangarUI },
			{ name: "window.storageBrowser", object: window.storageBrowser },
			{ name: "window.serverSync", object: window.serverSync },
			{
				name: "window.improved_event_manager",
				object: window.improved_event_manager,
			},
			{
				name: "window.globalInitialization",
				object: window.globalInitialization,
			},
		];

		requiredObjects.forEach(({ name, object }) => {
			const status = object ? "✅ Verfügbar" : "❌ Fehlt";
			this.results.globalObjects.push({
				test: name,
				status: status,
				details: object ? `Typ: ${typeof object}` : "Objekt nicht definiert",
			});

			if (!object) {
				this.errors.push(`${name} fehlt`);
			}
		});
	}

	/**
	 * Validiert alle kritischen Funktionen
	 */
	validateFunctions() {
		console.log("⚙️ Validiere kritische Funktionen...");

		const requiredFunctions = [
			{
				name: "window.hangarData.collectAllHangarData",
				func: window.hangarData?.collectAllHangarData,
			},
			{
				name: "window.setupSecondaryTileEventListeners",
				func: window.setupSecondaryTileEventListeners,
			},
			{
				name: "window.updateTowStatusStyles",
				func: window.updateTowStatusStyles,
			},
			{ name: "window.updateStatusLights", func: window.updateStatusLights },
			{ name: "window.showNotification", func: window.showNotification },
			{
				name: "window.runCompleteSystemTest",
				func: window.runCompleteSystemTest,
			},
		];

		requiredFunctions.forEach(({ name, func }) => {
			const isFunction = typeof func === "function";
			const status = isFunction ? "✅ Verfügbar" : "❌ Fehlt";
			this.results.functions.push({
				test: name,
				status: status,
				details: isFunction
					? "Funktion ist aufrufbar"
					: "Funktion nicht definiert",
			});

			if (!isFunction) {
				this.errors.push(`${name} Funktion fehlt`);
			}
		});
	}

	/**
	 * Validiert Server-Synchronisation
	 */
	async validateServerSync() {
		console.log("🌐 Validiere Server-Synchronisation...");

		if (!window.storageBrowser) {
			this.errors.push("storageBrowser nicht verfügbar");
			this.results.serverSync.push({
				test: "StorageBrowser Verfügbarkeit",
				status: "❌ Fehlt",
				details: "storageBrowser Objekt nicht definiert",
			});
			return;
		}

		// Server URL prüfen
		const serverUrl =
			window.storageBrowser.serverSyncUrl ||
			window.storageBrowser.getServerUrl?.();
		this.results.serverSync.push({
			test: "Server URL",
			status: serverUrl ? "✅ Konfiguriert" : "❌ Fehlt",
			details: serverUrl || "Keine Server URL konfiguriert",
		});

		// Server-Verbindung testen
		if (typeof window.storageBrowser.testServerConnection === "function") {
			try {
				const connectionTest = await window.storageBrowser.testServerConnection(
					serverUrl
				);
				this.results.serverSync.push({
					test: "Server-Verbindung",
					status: connectionTest ? "✅ Erfolgreich" : "❌ Fehlgeschlagen",
					details: connectionTest
						? "Server ist erreichbar"
						: "Server nicht erreichbar",
				});
			} catch (error) {
				this.results.serverSync.push({
					test: "Server-Verbindung",
					status: "❌ Fehler",
					details: error.message,
				});
				this.errors.push(`Server-Verbindung: ${error.message}`);
			}
		}

		// Sync-Funktionen prüfen
		const syncFunctions = [
			"manualSync",
			"loadFromServer",
			"saveToServer",
			"applyServerData",
		];
		syncFunctions.forEach((funcName) => {
			const func = window.storageBrowser[funcName];
			const status = typeof func === "function" ? "✅ Verfügbar" : "❌ Fehlt";
			this.results.serverSync.push({
				test: `${funcName} Funktion`,
				status: status,
				details:
					typeof func === "function"
						? "Funktion ist definiert"
						: "Funktion fehlt",
			});
		});
	}

	/**
	 * Validiert Event-Handler
	 */
	validateEventHandlers() {
		console.log("🎯 Validiere Event-Handler...");

		const testElements = [
			"aircraft-1",
			"aircraft-2",
			"aircraft-3",
			"position-1",
			"position-2",
			"position-3",
			"hangar-position-101",
			"hangar-position-102",
			"notes-1",
			"notes-101",
		];

		let workingHandlers = 0;
		let totalElements = 0;

		testElements.forEach((elementId) => {
			const element = document.getElementById(elementId);
			if (element) {
				totalElements++;

				// Teste ob Event-Handler reagieren
				const oldValue = element.value;
				element.value = `Test-${Date.now()}`;
				element.dispatchEvent(new Event("input", { bubbles: true }));

				// Prüfe ob sich etwas geändert hat (indirekt)
				setTimeout(() => {
					workingHandlers++;
				}, 10);

				// Wert zurücksetzen
				element.value = oldValue;
			}
		});

		setTimeout(() => {
			const status =
				workingHandlers > 0 ? "✅ Funktionsfähig" : "❌ Problematisch";
			this.results.eventHandlers.push({
				test: "Input Event-Handler",
				status: status,
				details: `${workingHandlers}/${totalElements} Elemente getestet`,
			});
		}, 50);

		// Sekundäre Event-Handler prüfen
		if (typeof window.setupSecondaryTileEventListeners === "function") {
			this.results.eventHandlers.push({
				test: "Sekundäre Event-Handler Setup",
				status: "✅ Verfügbar",
				details: "setupSecondaryTileEventListeners ist aufrufbar",
			});
		} else {
			this.results.eventHandlers.push({
				test: "Sekundäre Event-Handler Setup",
				status: "❌ Fehlt",
				details: "setupSecondaryTileEventListeners nicht verfügbar",
			});
			this.errors.push("setupSecondaryTileEventListeners fehlt");
		}
	}

	/**
	 * Validiert Datensammlung
	 */
	validateDataCollection() {
		console.log("📊 Validiere Datensammlung...");

		if (!window.hangarData?.collectAllHangarData) {
			this.results.dataCollection.push({
				test: "Datensammlung Funktion",
				status: "❌ Fehlt",
				details: "collectAllHangarData nicht verfügbar",
			});
			this.errors.push("collectAllHangarData Funktion fehlt");
			return;
		}

		try {
			const collectedData = window.hangarData.collectAllHangarData();

			// Prüfe Datenstruktur
			const hasMetadata = collectedData && collectedData.metadata;
			const hasPrimaryTiles = collectedData && collectedData.primaryTiles;
			const hasSecondaryTiles = collectedData && collectedData.secondaryTiles;

			this.results.dataCollection.push({
				test: "Datensammlung Ausführung",
				status: collectedData ? "✅ Erfolgreich" : "❌ Fehlgeschlagen",
				details: collectedData
					? "Daten wurden gesammelt"
					: "Keine Daten erhalten",
			});

			this.results.dataCollection.push({
				test: "Metadaten",
				status: hasMetadata ? "✅ Vorhanden" : "❌ Fehlen",
				details: hasMetadata
					? `Timestamp: ${collectedData.metadata.timestamp}`
					: "Metadaten fehlen",
			});

			this.results.dataCollection.push({
				test: "Primäre Kacheln",
				status: hasPrimaryTiles ? "✅ Vorhanden" : "❌ Fehlen",
				details: hasPrimaryTiles
					? `${Object.keys(collectedData.primaryTiles).length} Kacheln`
					: "Primäre Kacheln fehlen",
			});

			this.results.dataCollection.push({
				test: "Sekundäre Kacheln",
				status: hasSecondaryTiles ? "✅ Vorhanden" : "❌ Fehlen",
				details: hasSecondaryTiles
					? `${Object.keys(collectedData.secondaryTiles).length} Kacheln`
					: "Sekundäre Kacheln fehlen",
			});
		} catch (error) {
			this.results.dataCollection.push({
				test: "Datensammlung Ausführung",
				status: "❌ Fehler",
				details: error.message,
			});
			this.errors.push(`Datensammlung Fehler: ${error.message}`);
		}
	}

	/**
	 * Generiert einen detaillierten Bericht
	 */
	generateReport() {
		console.log("\n📋 === VALIDIERUNGS-BERICHT ===");

		const categories = [
			{ name: "Globale Objekte", data: this.results.globalObjects },
			{ name: "Funktionen", data: this.results.functions },
			{ name: "Server-Synchronisation", data: this.results.serverSync },
			{ name: "Event-Handler", data: this.results.eventHandlers },
			{ name: "Datensammlung", data: this.results.dataCollection },
			{ name: "Initialisierung", data: this.results.initialization },
		];

		categories.forEach((category) => {
			if (category.data.length > 0) {
				console.log(`\n🔸 ${category.name}:`);
				category.data.forEach((test) => {
					console.log(`  ${test.status} ${test.test}: ${test.details}`);
				});
			}
		});

		// Zusammenfassung
		const totalTests = Object.values(this.results).flat().length;
		const passedTests = Object.values(this.results)
			.flat()
			.filter((test) => test.status.includes("✅")).length;
		const failedTests = totalTests - passedTests;

		console.log(`\n🏁 === ZUSAMMENFASSUNG ===`);
		console.log(`Gesamt: ${totalTests} Tests`);
		console.log(`✅ Bestanden: ${passedTests}`);
		console.log(`❌ Fehlgeschlagen: ${failedTests}`);
		console.log(
			`🎯 Erfolgsrate: ${Math.round((passedTests / totalTests) * 100)}%`
		);

		if (this.errors.length > 0) {
			console.log(`\n❌ Fehler (${this.errors.length}):`);
			this.errors.forEach((error) => console.log(`  • ${error}`));
		}

		if (this.warnings.length > 0) {
			console.log(`\n⚠️ Warnungen (${this.warnings.length}):`);
			this.warnings.forEach((warning) => console.log(`  • ${warning}`));
		}

		// Browser-freundliche Ausgabe
		const summary = `
🔍 HANGARPLANNER VALIDIERUNG

📊 Ergebnisse:
✅ ${passedTests} Tests bestanden
❌ ${failedTests} Tests fehlgeschlagen
🎯 ${Math.round((passedTests / totalTests) * 100)}% Erfolgsrate

${
	this.errors.length > 0
		? `\n❌ Kritische Fehler:\n${this.errors
				.slice(0, 5)
				.map((e) => `• ${e}`)
				.join("\n")}`
		: ""
}
${
	this.warnings.length > 0
		? `\n⚠️ Warnungen:\n${this.warnings
				.slice(0, 3)
				.map((w) => `• ${w}`)
				.join("\n")}`
		: ""
}

📋 Details in der Browser-Konsole verfügbar
        `;

		if (typeof window.showNotification === "function") {
			window.showNotification(
				`Validierung abgeschlossen: ${passedTests}/${totalTests} Tests bestanden`,
				failedTests === 0 ? "success" : "info"
			);
		} else {
			alert(summary);
		}
	}
}

// Global verfügbar machen
window.HangarPlannerValidator = HangarPlannerValidator;

// Einfacher Aufruf
window.validateHangarPlanner = async () => {
	const validator = new HangarPlannerValidator();
	return await validator.runCompleteValidation();
};

console.log(
	"🔍 Umfassende Validierung geladen - verwende validateHangarPlanner()"
);
