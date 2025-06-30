/**
 * HOTFIX FÜR EVENT-HANDLER-KONFLIKTE
 * Behebt kritische Event-Handler-Mehrfachregistrierung sofort
 * Version: 1.0 - Sofortige Stabilisierung
 */

console.log("🚀 Event-Handler-Hotfix wird geladen...");

// Globale Verfolgung für bereinigte Handler
window.cleanedHandlers = new Set();

/**
 * Hauptfunktion zur sofortigen Bereinigung von Event-Handler-Duplikaten
 */
function fixEventHandlerConflicts() {
	console.log("🔧 HOTFIX: Bereinige Event-Handler-Konflikte...");

	// 1. ENTFERNE ALLE PROBLEMATISCHEN HANDLER
	const problematicPrefixes = [
		"_saveHandler",
		"_primarySaveHandler",
		"_saveOnChangeHandler",
		"_positionSaveHandler",
		"_unifiedHandler",
	];

	document.querySelectorAll("input, textarea, select").forEach((element) => {
		problematicPrefixes.forEach((prefix) => {
			if (element[prefix]) {
				// Entferne alle Event-Types
				["blur", "change", "input"].forEach((eventType) => {
					element.removeEventListener(eventType, element[prefix]);
				});
				delete element[prefix];
			}
		});
	});

	console.log("🧹 Problematische Handler entfernt");

	// 2. VEREINHEITLICHTE HANDLER EINRICHTEN
	setupUnifiedHandlers();

	console.log("✅ Event-Handler-Hotfix abgeschlossen");
}

/**
 * Richtet vereinheitlichte Handler für alle relevanten Felder ein
 */
function setupUnifiedHandlers() {
	// Debounced Handler für Performance
	const unifiedHandler = debounce(function (event) {
		const element = event.target;
		const value = element.value;
		const id = element.id;

		console.log(`💾 Unified Save: ${id} = "${value}"`);

		// Direkt speichern ohne Konflikte
		saveFieldDirectly(id, value);
	}, 300);

	// Alle relevanten Felder finden
	const selectors = [
		'input[id^="aircraft-"]',
		'input[id^="arrival-time-"]',
		'input[id^="departure-time-"]',
		'input[id^="position-"]',
		'input[id^="hangar-position-"]',
		'textarea[id^="notes-"]',
		'select[id^="status-"]',
		'select[id^="tow-status-"]',
	];

	selectors.forEach((selector) => {
		document.querySelectorAll(selector).forEach((element) => {
			// Verhindere doppelte Handler
			if (window.cleanedHandlers.has(element.id)) {
				return;
			}

			// Sichere Handler-Registrierung
			element.removeEventListener("blur", unifiedHandler);
			element.removeEventListener("input", unifiedHandler);

			element.addEventListener("blur", unifiedHandler);
			element.addEventListener("input", unifiedHandler);

			// Als bereinigt markieren
			window.cleanedHandlers.add(element.id);
		});
	});

	console.log("✅ Vereinheitlichte Handler eingerichtet");
}

/**
 * Speichert Feldwerte direkt ohne localStorage-Konflikte
 */
function saveFieldDirectly(fieldId, value) {
	try {
		// Bestehende Daten laden
		const existing = JSON.parse(
			localStorage.getItem("hangarPlannerData") || "{}"
		);

		// Feld aktualisieren
		existing[fieldId] = value;
		existing.lastModified = new Date().toISOString();

		// Speichern
		localStorage.setItem("hangarPlannerData", JSON.stringify(existing));
	} catch (error) {
		console.warn("Speicherfehler für", fieldId, ":", error);
	}
}

/**
 * Debounce-Hilfsfunktion
 */
function debounce(func, wait) {
	let timeout;
	return function executedFunction(...args) {
		const later = () => {
			clearTimeout(timeout);
			func(...args);
		};
		clearTimeout(timeout);
		timeout = setTimeout(later, wait);
	};
}

// Sofortige Ausführung bei DOM-Load
if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", fixEventHandlerConflicts);
} else {
	fixEventHandlerConflicts();
}

// Globale Funktion für manuellen Aufruf
window.fixEventHandlerConflicts = fixEventHandlerConflicts;

console.log(
	"🚀 Event-Handler-Hotfix geladen - verwende fixEventHandlerConflicts() zum manuellen Ausführen"
);
