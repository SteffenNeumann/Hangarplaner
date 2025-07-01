/**
 * hangar.js
 * Hauptdatei für die HangarPlanner-Anwendung
 * Verwaltet die Initialisierung und Orchestrierung der verschiedenen Module
 */

// Globaler Status zum Tracking der initialisierten Module
window.moduleStatus = {
	helpers: false,
	ui: false,
	data: false,
	events: false,
	pdf: false,
};

/**
 * Initialisiert die Anwendung in der richtigen Reihenfolge
 */
function initializeApp() {
	console.log("Initialisiere HangarPlanner-Anwendung...");

	// Starten mit einer Verzögerung, um sicherzustellen dass DOM vollständig geladen ist
	setTimeout(() => {
		try {
			// 1. Überprüfen, ob alle benötigten Skripte geladen wurden
			if (!checkRequiredScripts()) {
				console.error("Nicht alle erforderlichen Skripte wurden geladen!");
				return;
			}

			// 2. UI initialisieren
			if (window.hangarUI) {
				window.hangarUI.initSectionLayout();
				// Statt der UI-Funktion die neue Events-Funktion verwenden
				if (
					window.hangarEvents &&
					window.hangarEvents.initializeSidebarToggle
				) {
					window.hangarEvents.initializeSidebarToggle();
				}
				window.hangarUI.initializeSidebarAccordion(); // Neue Methode zum Initialisieren des Akkordeons
				window.moduleStatus.ui = true;
				console.log("UI-Modul initialisiert");
			}

			// 3. Event-Listener einrichten
			if (window.hangarEvents && window.hangarEvents.setupUIEventListeners) {
				window.hangarEvents.setupUIEventListeners();
				window.moduleStatus.events = true;
				console.log("Event-Listener eingerichtet");
			}

			// 4. Gespeicherte Einstellungen laden
			if (
				window.hangarUI &&
				window.hangarUI.uiSettings &&
				window.hangarUI.uiSettings.load
			) {
				window.hangarUI.uiSettings.load();
				console.log("UI-Einstellungen geladen");
			}

			// 5. Daten initialisieren
			if (window.hangarData) {
				// Letzten Status aus localStorage laden
				if (window.hangarData.loadCurrentStateFromLocalStorage) {
					window.hangarData.loadCurrentStateFromLocalStorage();
				}
				window.moduleStatus.data = true;
				console.log("Daten-Modul initialisiert");
			}

			// Initialisieren des API-Provider-Selectors
			initializeApiProviderSelector();

			// 6. Initialisierung abgeschlossen
			console.log("HangarPlanner-Anwendung erfolgreich initialisiert!");

			// Benachrichtigung anzeigen, wenn alle Module geladen sind
			if (allModulesLoaded()) {
				if (window.showNotification) {
					window.showNotification(
						"Hangar Planner erfolgreich geladen",
						"success"
					);
				}
			}

			// Sicherstellen, dass alle Kacheln den neutralen Status haben
			resetAllTilesToNeutral();
		} catch (error) {
			console.error("Fehler bei der Initialisierung:", error);

			// Detaillierte Fehleranalyse
			analyzeError(error);
		}
	}, 300);
}

/**
 * Initialisiert den API-Provider-Selektor
 */
function initializeApiProviderSelector() {
	const apiProviderSelect = document.getElementById("apiProviderSelect");
	if (!apiProviderSelect) return;

	// Aktuellen Provider aus der API-Fassade laden
	if (window.FlightDataAPI) {
		const currentProvider = window.FlightDataAPI.getActiveProvider();
		apiProviderSelect.value = currentProvider;
	}

	// Event-Listener für Änderungen
	apiProviderSelect.addEventListener("change", function () {
		if (window.FlightDataAPI) {
			const newProvider = this.value;
			window.FlightDataAPI.setProvider(newProvider);
			console.log(`API-Provider geändert auf: ${newProvider}`);
		}
	});

	console.log("API-Provider-Selektor initialisiert");
}

// Initialisiert die gesamte Anwendung
function initialize() {
	console.log("Initialisiere HangarPlanner-Anwendung...");

	// Initialisiere UI
	if (window.hangarUI) {
		window.hangarUI.initializeUI();
		console.log("UI-Modul initialisiert");
	}

	// Ereignisbehandler einrichten
	if (window.hangarEvents) {
		window.hangarEvents.setupEventListeners();
		console.log("Event-Listener eingerichtet");
	}

	// Lade die UI-Einstellungen aus dem localStorage
	if (window.hangarUI) {
		window.hangarUI.loadUISettings();
		console.log("UI-Einstellungen geladen");
	}

	// Initialisiere Datenmodul
	if (window.hangarData) {
		window.hangarData.loadStateFromLocalStorage();
		console.log("Daten-Modul initialisiert");
	}

	// Initialisiere API-Fassade - WICHTIG: Nach allen anderen APIs initialisieren
	if (window.FlightDataAPI) {
		// Warten bis AmadeusAPI und AeroDataBoxAPI geladen sind
		setTimeout(() => {
			setupFlightDataEventHandlers();
			console.log("API-Fassade final initialisiert und verbunden");
		}, 500);
	}

	// Initialisiere APIs
	if (window.AeroDataBoxAPI) {
		window.AeroDataBoxAPI.init();
		console.log("AeroDataBox API initialisiert");
	}

	console.log("HangarPlanner-Anwendung erfolgreich initialisiert!");
}

// Funktion, um sicherzustellen, dass die API-Fassade korrekt verbunden ist
function setupFlightDataEventHandlers() {
	// WICHTIG: Zuerst den bestehenden Event-Handler vom fetchFlightBtn entfernen
	const fetchFlightBtn = document.getElementById("fetchFlightData");
	if (fetchFlightBtn) {
		// Alle bestehenden Event-Handler entfernen
		const oldClone = fetchFlightBtn.cloneNode(true);
		fetchFlightBtn.parentNode.replaceChild(oldClone, fetchFlightBtn);

		// Referenz auf den neuen Button holen
		const newFetchFlightBtn = document.getElementById("fetchFlightData");

		// Direkten Event-Handler setzen, der explizit die API-Fassade nutzt
		newFetchFlightBtn.onclick = async function (event) {
			// Standardverhalten verhindern
			event.preventDefault();

			// Debug-Log
			console.log("*** API-FASSADE WIRD DIREKT AUFGERUFEN ***");

			const searchInput = document.getElementById("searchAircraft");
			const currentDateInput = document.getElementById("currentDateInput");
			const nextDateInput = document.getElementById("nextDateInput");
			const airportCodeInput = document.getElementById("airportCodeInput");

			const aircraftId = searchInput?.value?.trim();
			const currentDate = currentDateInput?.value;
			const nextDate = nextDateInput?.value;
			const airportCode =
				airportCodeInput?.value?.trim().toUpperCase() || "MUC";

			if (!aircraftId) {
				alert("Bitte geben Sie eine Flugzeug-ID ein");
				return;
			}

			console.log(
				`API-Fassade wird verwendet für: ${aircraftId}, Flughafen: ${airportCode}`
			);

			if (window.FlightDataAPI) {
				try {
					// Zusätzliches Debug-Log für die Anfrage
					console.log("Anfrage-Parameter:", {
						aircraftId,
						currentDate,
						nextDate,
						airportCode,
					});

					// API-Fassade aufrufen und Ergebnis speichern
					const result = await window.FlightDataAPI.updateAircraftData(
						aircraftId,
						currentDate,
						nextDate
					);

					console.log("API-Fassade Aufruf erfolgreich abgeschlossen");
					console.log("Empfangene Daten:", result);

					// Optional: Überprüfen, ob die Daten zum gewünschten Flughafen gehören
					if (
						result &&
						(result.originCode === airportCode ||
							result.destCode === airportCode)
					) {
						console.log(`Daten für Flughafen ${airportCode} gefunden.`);
					} else if (result) {
						console.warn(
							`Daten enthalten nicht den gewünschten Flughafen ${airportCode}.`
						);
					}
				} catch (error) {
					console.error("Fehler beim API-Fassaden-Aufruf:", error);
				}
			} else {
				console.error("FlightDataAPI nicht verfügbar!");
			}
		};

		console.log(
			"Fetch-Button mit API-Fassade neu verbunden (alle anderen Handler entfernt)"
		);
	}
}

/**
 * Setzt den neutralen Status für alle Kacheln
 */
function resetAllTilesToNeutral() {
	// Status-Selektoren auf neutral setzen und aktualisieren
	document.querySelectorAll(".status-selector").forEach((select) => {
		select.value = "neutral";
		const cellId = parseInt(select.id.split("-")[1]);
		updateStatusLights(cellId);
	});

	// Towing-Status-Selektoren auf neutral setzen und aktualisieren
	document.querySelectorAll(".tow-status-selector").forEach((select) => {
		select.value = "neutral";
		updateTowStatusStyles(select);
	});
}

/**
 * Prüft, ob alle erforderlichen Skripte geladen wurden
 */
function checkRequiredScripts() {
	const requiredScripts = [
		{ name: "helpers", obj: window.helpers || window.showNotification },
		{ name: "hangarUI", obj: window.hangarUI },
		{ name: "hangarData", obj: window.hangarData },
		{
			name: "hangarEvents",
			obj: window.hangarEvents || window.setupUIEventListeners,
		},
	];

	let allLoaded = true;
	requiredScripts.forEach((script) => {
		if (!script.obj) {
			console.error(`Benötigtes Skript '${script.name}' wurde nicht geladen!`);
			allLoaded = false;
		} else {
			console.log(`✅ Skript '${script.name}' erfolgreich geladen`);
		}
	});

	return allLoaded;
}

/**
 * Prüft, ob alle Module erfolgreich initialisiert wurden
 */
function allModulesLoaded() {
	return (
		window.moduleStatus.helpers &&
		window.moduleStatus.ui &&
		window.moduleStatus.data &&
		window.moduleStatus.events
	);
}

/**
 * Analysiert Fehler genauer für besseres Debugging
 */
function analyzeError(error) {
	console.group("Fehleranalyse");
	console.error("Fehlermeldung:", error.message);
	console.error("Stack Trace:", error.stack);

	// Überprüfen, welche Module verfügbar sind
	console.log("Modul-Status:", window.moduleStatus);

	// DOM-Elemente überprüfen
	const criticalElements = [
		"hangarGrid",
		"secondaryHangarGrid",
		"modeToggle",
		"menuToggle",
	];

	console.log("Kritische DOM-Elemente:");
	criticalElements.forEach((id) => {
		const element = document.getElementById(id);
		console.log(`${id}: ${element ? "Gefunden" : "FEHLT"}`);
	});

	console.groupEnd();
}

// Event-Listener für DOMContentLoaded hinzufügen
document.addEventListener("DOMContentLoaded", function () {
	console.log("DOM vollständig geladen - starte Initialisierung...");

	// Helpers-Modul als geladen markieren, wenn verfügbar
	if (window.helpers || window.showNotification) {
		window.moduleStatus.helpers = true;
	}

	// Warten bis alle Skripte geladen sind mit mehreren Versuchen
	function attemptInitialization(attempts = 0) {
		const maxAttempts = 10;
		const delay = 200;

		if (attempts >= maxAttempts) {
			console.warn("Maximale Anzahl von Initialisierungsversuchen erreicht");
			initializeApp(); // Versuche trotzdem zu starten
			return;
		}

		// Prüfe kritische Module
		const criticalModulesReady =
			window.hangarUI !== undefined &&
			window.hangarData !== undefined &&
			(window.hangarEvents !== undefined ||
				window.setupUIEventListeners !== undefined);

		if (criticalModulesReady) {
			console.log(
				`Alle kritischen Module nach ${attempts + 1} Versuchen verfügbar`
			);
			initializeApp();
		} else {
			console.log(
				`Versuch ${attempts + 1}/${maxAttempts}: Warte auf Module...`
			);
			setTimeout(() => attemptInitialization(attempts + 1), delay);
		}
	}

	// Starte erste Überprüfung mit Verzögerung
	setTimeout(() => attemptInitialization(), 100);
});

/**
 * Synchronisiert den fetchStatus im Sidebar mit dem header-status im Header
 * Wird als MutationObserver implementiert, um alle Änderungen zu erfassen
 */
function setupStatusSync() {
	const fetchStatus = document.getElementById("fetchStatus");
	const headerStatus = document.getElementById("header-status");

	if (!fetchStatus || !headerStatus) {
		console.warn(
			"Status-Elemente nicht gefunden, Synchronisation nicht möglich"
		);
		return;
	}

	// Initiale Synchronisation
	headerStatus.textContent = fetchStatus.textContent || "Bereit";
	// Wichtig: Sowohl title als auch data-tooltip Attribute synchronisieren
	headerStatus.title = fetchStatus.textContent || "Bereit";
	headerStatus.setAttribute(
		"data-tooltip",
		fetchStatus.textContent || "Status-Informationen werden hier angezeigt"
	);

	// Status-Klassen übertragen
	if (fetchStatus.classList.contains("success")) {
		headerStatus.className = "success";
	} else if (fetchStatus.classList.contains("error")) {
		headerStatus.className = "error";
	} else if (fetchStatus.classList.contains("warning")) {
		headerStatus.className = "warning";
	}

	// MutationObserver für automatische Synchronisation einrichten
	const observer = new MutationObserver((mutations) => {
		mutations.forEach((mutation) => {
			if (mutation.type === "childList" || mutation.type === "characterData") {
				const newText = fetchStatus.textContent || "Bereit";
				headerStatus.textContent = newText;
				headerStatus.title = newText; // Tooltip-Inhalt aktualisieren
				headerStatus.setAttribute("data-tooltip", newText); // Zusätzliches Tooltip-Attribut aktualisieren
			} else if (
				mutation.type === "attributes" &&
				mutation.attributeName === "class"
			) {
				// Status-Klassen übernehmen
				headerStatus.className = "";
				if (fetchStatus.classList.contains("success")) {
					headerStatus.className = "success";
				} else if (fetchStatus.classList.contains("error")) {
					headerStatus.className = "error";
				} else if (fetchStatus.classList.contains("warning")) {
					headerStatus.className = "warning";
				}
			}
		});
	});

	// Beobachte Änderungen an Text und Attributen
	observer.observe(fetchStatus, {
		childList: true,
		characterData: true,
		subtree: true,
		attributes: true,
		attributeFilter: ["class"],
	});

	console.log(
		"Status-Synchronisation zwischen fetchStatus und header-status eingerichtet"
	);
}

// Führe die Statussynchornisation nach dem initialen Laden aus
document.addEventListener("DOMContentLoaded", function () {
	// Zuerst die App normal initialisieren lassen
	// ...existing code...

	// Dann nach kurzer Verzögerung den Status-Sync einrichten
	setTimeout(() => {
		setupStatusSync();
	}, 500);
});

// Alternativ: Auch beim Laden/Speichern von Projekten den Status aktualisieren
document.addEventListener("projectLoaded", function () {
	setTimeout(() => {
		const headerStatus = document.getElementById("header-status");
		if (headerStatus) {
			const statusText = "Projekt geladen";
			headerStatus.textContent = statusText;
			headerStatus.title = statusText; // Tooltip-Inhalt aktualisieren
			headerStatus.setAttribute("data-tooltip", statusText); // Zusätzliches Tooltip-Attribut aktualisieren
			headerStatus.className = "success";
			// Nach 3 Sekunden zurücksetzen
			setTimeout(() => {
				const resetText = "Bereit";
				headerStatus.textContent = resetText;
				headerStatus.title = resetText; // Tooltip-Inhalt aktualisieren
				headerStatus.className = "";
			}, 3000);
		}
	}, 100);
});

document.addEventListener("projectSaved", function () {
	setTimeout(() => {
		const headerStatus = document.getElementById("header-status");
		if (headerStatus) {
			const statusText = "Projekt gespeichert";
			headerStatus.textContent = statusText;
			headerStatus.title = statusText; // Tooltip-Inhalt aktualisieren
			headerStatus.setAttribute("data-tooltip", statusText); // Zusätzliches Tooltip-Attribut aktualisieren
			headerStatus.className = "success";
			// Nach 3 Sekunden zurücksetzen
			setTimeout(() => {
				const resetText = "Bereit";
				headerStatus.textContent = resetText;
				headerStatus.title = resetText; // Tooltip-Inhalt aktualisieren
				headerStatus.className = "";
			}, 3000);
		}
	}, 100);
});
