/**
 * AUTOMATISCHER KONFLIKT-RESOLVER
 * Analysiert und behebt alle identifizierten Probleme automatisch
 * Version: 1.0 - Umfassende Konfliktlösung
 */

console.log("🔍 Lade Konflikt-Resolver...");

class HangarConflictResolver {
	constructor() {
		this.conflicts = [];
		this.fixes = [];
		this.summary = {
			totalConflicts: 0,
			resolvedConflicts: 0,
			criticalIssues: 0,
		};
	}

	/**
	 * VOLLSTÄNDIGE DIAGNOSE ALLER KONFLIKTE
	 */
	async runFullDiagnosis() {
		console.log("🔍 STARTE UMFASSENDE KONFLIKTDIAGNOSE...");
		console.log("=====================================");

		this.conflicts = [];
		this.fixes = [];

		// 1. Event-Handler-Konflikte prüfen
		await this.checkEventHandlerConflicts();

		// 2. localStorage-Konflikte prüfen
		await this.checkLocalStorageConflicts();

		// 3. API-Aufrufs-Redundanzen prüfen
		await this.checkApiCallRedundancy();

		// 4. DOM-Manipulations-Konflikte prüfen
		await this.checkDomManipulationConflicts();

		// 5. Funktionsüberschneidungen prüfen
		await this.checkFunctionOverlaps();

		// Zusammenfassung generieren
		this.generateSummary();

		return this.conflicts;
	}

	async checkEventHandlerConflicts() {
		console.log("🎯 Prüfe Event-Handler-Konflikte...");

		const problematicElements = [];

		// Alle Input-Elemente prüfen
		document.querySelectorAll("input, textarea, select").forEach((element) => {
			const handlerCount = this.countEventHandlers(element);

			if (handlerCount.total > 3) {
				// Mehr als 3 Handler ist verdächtig
				problematicElements.push({
					element: element.id || element.tagName,
					handlers: handlerCount,
					severity: handlerCount.total > 6 ? "critical" : "warning",
				});
			}
		});

		if (problematicElements.length > 0) {
			this.conflicts.push({
				type: "EVENT_HANDLERS",
				severity: "high",
				description: "Mehrfach registrierte Event-Handler erkannt",
				affected: problematicElements,
				autoFixAvailable: true,
			});

			console.log(
				`❌ ${problematicElements.length} Elemente mit Event-Handler-Konflikten gefunden`
			);
		}
	}

	countEventHandlers(element) {
		const handlers = {
			blur: 0,
			input: 0,
			change: 0,
			click: 0,
			total: 0,
		};

		// Prüfe auf typische Handler-Eigenschaften
		Object.keys(element).forEach((key) => {
			if (
				key.includes("Handler") ||
				key.includes("_save") ||
				key.includes("_update")
			) {
				handlers.total++;

				if (key.includes("blur")) handlers.blur++;
				if (key.includes("input")) handlers.input++;
				if (key.includes("change")) handlers.change++;
				if (key.includes("click")) handlers.click++;
			}
		});

		return handlers;
	}

	async checkLocalStorageConflicts() {
		console.log("💾 Prüfe localStorage-Konflikte...");

		const conflictingModules = [];

		// Prüfe, welche Module auf localStorage zugreifen
		const modules = [
			{ name: "hangar-data.js", present: window.hangarData },
			{ name: "storage-browser.js", present: window.StorageBrowser },
			{ name: "event-manager.js", present: window.hangarEventManager },
			{ name: "hangar-ui.js", present: window.hangarUI },
		];

		const activeModules = modules.filter((m) => m.present);

		if (activeModules.length > 2) {
			this.conflicts.push({
				type: "LOCALSTORAGE_RACE",
				severity: "critical",
				description: "Mehrere Module greifen gleichzeitig auf localStorage zu",
				affected: activeModules.map((m) => m.name),
				autoFixAvailable: true,
			});

			console.log(
				`❌ ${activeModules.length} Module konkurrieren um localStorage-Zugriff`
			);
		}
	}

	async checkApiCallRedundancy() {
		console.log("🌐 Prüfe API-Aufruf-Redundanzen...");

		const apiModules = [];

		// Verfügbare API-Module prüfen
		if (window.AmadeusAPI) apiModules.push("AmadeusAPI");
		if (window.AeroDataBoxAPI) apiModules.push("AeroDataBoxAPI");
		if (window.OpenSkyAPI) apiModules.push("OpenSkyAPI");
		if (window.FlightDataAPI) apiModules.push("FlightDataAPI (Fassade)");

		if (apiModules.length > 2) {
			this.conflicts.push({
				type: "API_REDUNDANCY",
				severity: "medium",
				description: "Mehrere API-Module aktiv, potenzielle Doppelaufrufe",
				affected: apiModules,
				autoFixAvailable: true,
			});

			console.log(`⚠️ ${apiModules.length} API-Module gleichzeitig aktiv`);
		}
	}

	async checkDomManipulationConflicts() {
		console.log("🎨 Prüfe DOM-Manipulations-Konflikte...");

		// Prüfe auf mehrfache UI-Update-Funktionen
		const uiUpdateFunctions = [];

		if (window.hangarUI && window.hangarUI.refreshUI) {
			uiUpdateFunctions.push("hangarUI.refreshUI");
		}

		if (window.setupInputEventListeners) {
			uiUpdateFunctions.push("setupInputEventListeners");
		}

		if (window.updateUIElements) {
			uiUpdateFunctions.push("updateUIElements");
		}

		if (uiUpdateFunctions.length > 2) {
			this.conflicts.push({
				type: "DOM_CONFLICTS",
				severity: "medium",
				description: "Mehrere Funktionen manipulieren gleichzeitig das DOM",
				affected: uiUpdateFunctions,
				autoFixAvailable: false,
			});
		}
	}

	async checkFunctionOverlaps() {
		console.log("⚙️ Prüfe Funktionsüberschneidungen...");

		const duplicateFunctions = [];

		// Prüfe auf doppelte Initialisierungsfunktionen
		const initFunctions = [
			"initialize",
			"init",
			"initializeUI",
			"setupEventListeners",
		];

		initFunctions.forEach((funcName) => {
			const instances = this.countGlobalInstances(funcName);
			if (instances > 1) {
				duplicateFunctions.push({
					name: funcName,
					instances: instances,
				});
			}
		});

		if (duplicateFunctions.length > 0) {
			this.conflicts.push({
				type: "FUNCTION_DUPLICATES",
				severity: "low",
				description: "Doppelte Funktionsdefinitionen gefunden",
				affected: duplicateFunctions,
				autoFixAvailable: false,
			});
		}
	}

	countGlobalInstances(funcName) {
		let count = 0;

		// Globaler Namespace
		if (window[funcName]) count++;

		// In Modulen
		if (window.hangarUI && window.hangarUI[funcName]) count++;
		if (window.hangarData && window.hangarData[funcName]) count++;
		if (window.hangarEvents && window.hangarEvents[funcName]) count++;

		return count;
	}

	/**
	 * AUTOMATISCHE KONFLIKTBEHEBUNG
	 */
	async autoFixConflicts() {
		console.log("🛠️ STARTE AUTOMATISCHE KONFLIKTBEHEBUNG...");
		console.log("==========================================");

		for (const conflict of this.conflicts) {
			if (conflict.autoFixAvailable) {
				await this.fixConflict(conflict);
			}
		}

		this.summary.resolvedConflicts = this.fixes.length;

		console.log(`✅ ${this.fixes.length} Konflikte automatisch behoben`);

		return this.fixes;
	}

	async fixConflict(conflict) {
		switch (conflict.type) {
			case "EVENT_HANDLERS":
				await this.fixEventHandlers();
				break;

			case "LOCALSTORAGE_RACE":
				await this.fixLocalStorageRace();
				break;

			case "API_REDUNDANCY":
				await this.fixApiRedundancy();
				break;
		}
	}

	async fixEventHandlers() {
		console.log("🔧 Behebe Event-Handler-Konflikte...");

		// Alle problematischen Handler entfernen
		document.querySelectorAll("input, textarea, select").forEach((element) => {
			const handlerKeys = Object.keys(element).filter(
				(key) =>
					key.includes("Handler") ||
					key.includes("_save") ||
					key.includes("_update")
			);

			handlerKeys.forEach((key) => {
				if (typeof element[key] === "function") {
					element.removeEventListener("blur", element[key]);
					element.removeEventListener("input", element[key]);
					element.removeEventListener("change", element[key]);
					delete element[key];
				}
			});
		});

		// Improved Event Manager aktivieren
		if (window.hangarEventManager && window.hangarEventManager.init) {
			window.hangarEventManager.init();
		}

		this.fixes.push({
			type: "EVENT_HANDLERS",
			description: "Event-Handler bereinigt und zentralisiert",
			timestamp: new Date().toISOString(),
		});
	}

	async fixLocalStorageRace() {
		console.log("🔧 Behebe localStorage-Race-Conditions...");

		// Deaktiviere direkte localStorage-Zugriffe in anderen Modulen
		const conflictingMethods = [
			"window.hangarData.saveCurrentStateToLocalStorage",
			"window.hangarUI.saveUISettings",
		];

		conflictingMethods.forEach((methodPath) => {
			const parts = methodPath.split(".");
			let obj = window;

			for (let i = 1; i < parts.length - 1; i++) {
				if (obj[parts[i]]) {
					obj = obj[parts[i]];
				}
			}

			const methodName = parts[parts.length - 1];
			if (obj && obj[methodName]) {
				obj[`_original_${methodName}`] = obj[methodName];
				obj[methodName] = (...args) => {
					console.log(
						`🚫 Blockiert direkten localStorage-Zugriff: ${methodPath}`
					);
					console.log("ℹ️ Verwende stattdessen window.hangarEventManager");

					if (window.hangarEventManager) {
						return window.hangarEventManager.saveToStorage(
							"hangarPlannerSettings",
							args[0]
						);
					}
				};
			}
		});

		this.fixes.push({
			type: "LOCALSTORAGE_RACE",
			description: "localStorage-Zugriffe zentralisiert",
			timestamp: new Date().toISOString(),
		});
	}

	async fixApiRedundancy() {
		console.log("🔧 Behebe API-Redundanzen...");

		// Deaktiviere direkte API-Aufrufe
		const directApiMethods = ["updateAircraftData", "getAircraftFlights"];
		const apiModules = ["AmadeusAPI", "AeroDataBoxAPI", "OpenSkyAPI"];

		apiModules.forEach((moduleName) => {
			if (window[moduleName]) {
				directApiMethods.forEach((method) => {
					if (window[moduleName][method]) {
						window[moduleName][`_original_${method}`] =
							window[moduleName][method];
						window[moduleName][method] = (...args) => {
							console.log(
								`🚫 Direkte API-Aufrufe blockiert: ${moduleName}.${method}`
							);
							console.log("ℹ️ Verwende stattdessen window.FlightDataAPI");

							if (window.FlightDataAPI && window.FlightDataAPI[method]) {
								return window.FlightDataAPI[method](...args);
							}
						};
					}
				});
			}
		});

		this.fixes.push({
			type: "API_REDUNDANCY",
			description: "API-Aufrufe über zentrale Fassade kanalisiert",
			timestamp: new Date().toISOString(),
		});
	}

	/**
	 * KOMPLETTE ANALYSE MIT AUTO-FIX
	 */
	async runCompleteAnalysis() {
		await this.runFullDiagnosis();
		await this.autoFixConflicts();
		return this.getReport();
	}

	generateSummary() {
		this.summary.totalConflicts = this.conflicts.length;
		this.summary.criticalIssues = this.conflicts.filter(
			(c) => c.severity === "critical"
		).length;

		console.log("\n📊 KONFLIKT-ZUSAMMENFASSUNG:");
		console.log(`   Gesamt: ${this.summary.totalConflicts}`);
		console.log(`   Kritisch: ${this.summary.criticalIssues}`);
		console.log(`   Behoben: ${this.summary.resolvedConflicts}`);

		// Detaillierte Auflistung
		this.conflicts.forEach((conflict, index) => {
			const severity =
				conflict.severity === "critical"
					? "🚨"
					: conflict.severity === "high"
					? "⚠️"
					: conflict.severity === "medium"
					? "🟡"
					: "🔵";

			console.log(
				`${severity} ${index + 1}. ${conflict.type}: ${conflict.description}`
			);
		});
	}

	getReport() {
		return {
			conflicts: this.conflicts,
			fixes: this.fixes,
			summary: this.summary,
			timestamp: new Date().toISOString(),
		};
	}
}

// Globale Instanz erstellen
window.hangarConflictResolver = new HangarConflictResolver();

// Convenience-Funktionen
window.diagnoseConflicts = () =>
	window.hangarConflictResolver.runFullDiagnosis();
window.fixAllConflicts = () =>
	window.hangarConflictResolver.runCompleteAnalysis();
window.getConflictReport = () => window.hangarConflictResolver.getReport();

console.log("🚀 Hangar Conflict Resolver geladen");
console.log("📋 Verfügbare Funktionen:");
console.log("   - diagnoseConflicts() - Vollständige Diagnose");
console.log("   - fixAllConflicts() - Diagnose + Auto-Fix");
console.log("   - getConflictReport() - Detaillierter Report");
