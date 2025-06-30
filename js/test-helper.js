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
