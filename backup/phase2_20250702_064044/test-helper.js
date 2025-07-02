/**
 * Hilfsfunktionen zum Testen des Ansichtsmodus
 */

// Funktion zum manuellen Umschalten des Ansichtsmodus
function toggleViewMode(isTable) {
	console.log(
		"Manuelles Umschalten des Ansichtsmodus auf:",
		isTable ? "Tabelle" : "Kachel"
	);

	// Direkte Zugriffspfade testen
	if (window.hangarUI && typeof window.hangarUI.applyViewMode === "function") {
		console.log("Nutze window.hangarUI.applyViewMode");
		window.hangarUI.applyViewMode(isTable);
		return true;
	}

	if (
		window.hangarUI &&
		window.hangarUI.uiSettings &&
		typeof window.hangarUI.uiSettings.applyViewMode === "function"
	) {
		console.log("Nutze window.hangarUI.uiSettings.applyViewMode");
		window.hangarUI.uiSettings.applyViewMode(isTable);
		return true;
	}

	if (
		typeof uiSettings !== "undefined" &&
		typeof uiSettings.applyViewMode === "function"
	) {
		console.log("Nutze uiSettings.applyViewMode");
		uiSettings.applyViewMode(isTable);
		return true;
	}

	// Direkter CSS-Klassenansatz als Fallback
	const body = document.body;
	if (isTable) {
		body.classList.add("table-view");
	} else {
		body.classList.remove("table-view");
	}

	// Anpassung der Abstände
	if (isTable) {
		document.documentElement.style.setProperty("--grid-gap", "8px");
	} else {
		document.documentElement.style.setProperty("--grid-gap", "16px");
	}

	console.log("Fallback-Methode verwendet: CSS-Klassen direkt angewendet");

	// UI-Element aktualisieren
	const viewModeToggle = document.getElementById("viewModeToggle");
	if (viewModeToggle) {
		viewModeToggle.checked = isTable;
	}

	return "Fallback verwendet";
}

// In die globale window-Umgebung exportieren
window.toggleViewMode = toggleViewMode;

// Informationen zur Verwendung
console.log(
	"Test-Helfer geladen. Rufe toggleViewMode(true) oder toggleViewMode(false) in der Konsole auf."
);

/**
 * HANGAR PLANNER FUNKTIONS-VALIDIERUNG
 * Überprüft alle kritischen Funktionen und Module
 */
function validateHangarPlanner() {
	console.log("🔍 STARTE HANGAR PLANNER FUNKTIONS-VALIDIERUNG");
	console.log("=".repeat(60));

	// 1. KRITISCHE FUNKTIONEN PRÜFEN
	const criticalFunctions = [
		"setupFlightTimeEventListeners",
		"setupSecondaryTileEventListeners",
		"updateTiles",
		"updateSecondaryTiles",
		"initializeUI",
		"setupUIEventListeners",
	];

	console.log("\n📋 KRITISCHE FUNKTIONEN:");
	console.log("-".repeat(30));

	let functionsOK = true;
	criticalFunctions.forEach((funcName) => {
		const exists = typeof window[funcName] === "function";
		const hangarUIExists =
			window.hangarUI && typeof window.hangarUI[funcName] === "function";
		const hangarEventsExists =
			window.hangarEvents &&
			typeof window.hangarEvents[funcName] === "function";

		const isAvailable = exists || hangarUIExists || hangarEventsExists;
		if (!isAvailable) functionsOK = false;

		console.log(`${isAvailable ? "✅" : "❌"} ${funcName}:`);
		if (exists) console.log(`   - Global verfügbar`);
		if (hangarUIExists) console.log(`   - In hangarUI verfügbar`);
		if (hangarEventsExists) console.log(`   - In hangarEvents verfügbar`);
		if (!isAvailable) {
			console.log(`   - ❌ NICHT GEFUNDEN!`);
		}
	});

	// 2. MODULE PRÜFEN
	console.log("\n🏗️ MODULE:");
	console.log("-".repeat(30));

	const modules = [
		{ name: "hangarUI", obj: window.hangarUI },
		{ name: "hangarEvents", obj: window.hangarEvents },
		{ name: "hangarData", obj: window.hangarData },
		{ name: "helpers", obj: window.helpers },
	];

	let modulesOK = true;
	modules.forEach((module) => {
		const exists = !!module.obj;
		if (!exists) modulesOK = false;

		console.log(
			`${exists ? "✅" : "❌"} ${module.name}: ${exists ? "Geladen" : "FEHLT"}`
		);

		if (exists && typeof module.obj === "object") {
			const functions = Object.keys(module.obj).filter(
				(key) => typeof module.obj[key] === "function"
			);
			console.log(
				`   - Funktionen: ${functions.length} (${functions
					.slice(0, 3)
					.join(", ")}${functions.length > 3 ? "..." : ""})`
			);
		}
	});

	// 3. FINALE BEWERTUNG
	console.log("\n" + "=".repeat(60));
	console.log("📊 FINALE BEWERTUNG:");

	if (functionsOK && modulesOK) {
		console.log("🎉 ALLE KRITISCHEN KOMPONENTEN SIND VERFÜGBAR!");
		console.log("✅ HangarPlanner sollte vollständig funktionsfähig sein.");
		return true;
	} else {
		console.log(`❌ KRITISCHE PROBLEME GEFUNDEN!`);
		if (!functionsOK) console.log("   - Kritische Funktionen fehlen");
		if (!modulesOK) console.log("   - Kritische Module fehlen");
		return false;
	}
}

// Global verfügbar machen
window.validateHangarPlanner = validateHangarPlanner;
console.log("🔧 validateHangarPlanner() Funktion verfügbar");
