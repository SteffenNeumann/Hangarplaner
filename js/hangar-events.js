/**
 * hangar-events.js - OPTIMIERTE VERSION
 * Enthält nur Business-Logic und UI-State-Management
 * Event-Handler werden von improved-event-manager.js verwaltet
 * Reduziert von 2083 → ~600 Zeilen
 */

/**
 * Business Logic Funktionen (behalten)
 */

/**
 * Initialisiert alle Status-Selektoren
 */
function initializeStatusSelectors() {
	// Für alle Status-Selektoren (sowohl primär als auch sekundär)
	document.querySelectorAll('select[id^="status-"]').forEach((select) => {
		const cellId = parseInt(select.id.split("-")[1]);

		// Business Logic für Status-Änderungen (Event-Handler via improved-event-manager)
		select.onchange = function () {
			if (
				window.hangarUI &&
				typeof window.hangarUI.updateStatusLights === "function"
			) {
				window.hangarUI.updateStatusLights(cellId);
			} else {
				updateStatusLights(cellId);
			}
		};

		// Initialen Status setzen
		if (
			window.hangarUI &&
			typeof window.hangarUI.updateStatusLights === "function"
		) {
			window.hangarUI.updateStatusLights(cellId);
		} else {
			updateStatusLights(cellId);
		}
	});

	console.log("Status-Selektoren initialisiert");
}

/**
 * Verbesserte Initialisierungsfunktion für die UI
 */
async function initializeUI() {
	console.log("Initialisiere UI...");

	try {
		// *** MIGRATION: Verwende das neue display-options System ***
		// Alte hangarPlannerSettings werden an das neue System weitergeleitet
		let useDisplayOptions = false;

		// Prüfe ob display-options verfügbar ist
		if (window.displayOptions) {
			useDisplayOptions = true;

			// WICHTIG: Nicht laden während Server-Sync aktiv ist
			if (!window.isApplyingServerData && !window.isLoadingServerData) {
				// Lade Einstellungen über das neue System
				const loaded = await window.displayOptions.load();

				if (loaded) {
					console.log(
						"✅ Einstellungen über Display Options System geladen:",
						window.displayOptions.current
					);
				} else {
					console.log("📋 Display Options System: Standardwerte verwendet");
				}
			} else {
				console.log(
					"⏸️ Server-Sync aktiv, verwende aktuelle Display Options Werte"
				);
			}

			// Status-Selektoren initialisieren
			initializeStatusSelectors();
			// Menu-Toggle initialisieren
			initializeMenuToggle();

			// Position-Werte und Flugzeit-Werte anwenden
			setTimeout(() => {
				applyPositionValuesFromLocalStorage();
				applyFlightTimeValuesFromLocalStorage();
			}, 500);
		}

		// Fallback: Altes System nur wenn display-options nicht verfügbar
		if (!useDisplayOptions) {
			console.warn(
				"⚠️ Display Options nicht verfügbar, verwende Legacy-System"
			);

			// UI-Einstellungen laden (Legacy)
			const savedSettings = JSON.parse(
				localStorage.getItem("hangarPlannerSettings") || "{}"
			);

			if (savedSettings) {
				const {
					tilesCount = 8,
					secondaryTilesCount = 4,
					layout = 4,
				} = savedSettings;

				console.log("Geladene Einstellungen (Legacy):", {
					tilesCount,
					secondaryTilesCount,
					layout,
				});

				// UI-Einstellungen anwenden falls verfügbar
				if (window.hangarUI && window.hangarUI.uiSettings) {
					window.hangarUI.uiSettings.tilesCount = parseInt(tilesCount);
					window.hangarUI.uiSettings.secondaryTilesCount =
						parseInt(secondaryTilesCount);
					window.hangarUI.uiSettings.layout = parseInt(layout);
					window.hangarUI.uiSettings.apply();
				}

				// Status-Selektoren initialisieren
				initializeStatusSelectors();

				// Menu-Toggle initialisieren
				initializeMenuToggle();

				// Position-Werte und Flugzeit-Werte anwenden
				setTimeout(() => {
					applyPositionValuesFromLocalStorage();
					applyFlightTimeValuesFromLocalStorage();
				}, 500);
			}
		}

		console.log("UI-Initialisierung abgeschlossen");
	} catch (error) {
		console.error("Fehler bei UI-Initialisierung:", error);
	}
}

/**
 * Lädt Position-Werte aus localStorage und wendet sie an
 */
function applyPositionValuesFromLocalStorage() {
	try {
		const savedData = JSON.parse(
			localStorage.getItem("hangarPlannerSettings") || "{}"
		);

		if (savedData.tileValues) {
			savedData.tileValues.forEach((tileValue) => {
				if (tileValue.position && tileValue.position.trim() !== "") {
					const posInput = document.getElementById(
						`hangar-position-${tileValue.cellId}`
					);
					if (posInput) {
						posInput.value = tileValue.position;
						console.log(
							`Position für Kachel ${tileValue.cellId} gesetzt: ${tileValue.position}`
						);
					}
				}
			});
		}
	} catch (error) {
		console.error("Fehler beim Laden der Position-Werte:", error);
	}
}

/**
 * Lädt Flugzeit-Werte aus localStorage und wendet sie an
 */
function applyFlightTimeValuesFromLocalStorage() {
	try {
		const savedData = JSON.parse(
			localStorage.getItem("hangarPlannerSettings") || "{}"
		);

		if (savedData.tileValues) {
			savedData.tileValues.forEach((tileValue) => {
				if (tileValue.cellId) {
					// Arrival Time
					if (tileValue.arrivalTime) {
						const arrInput = document.getElementById(
							`arrival-time-${tileValue.cellId}`
						);
						if (arrInput) {
							arrInput.value = tileValue.arrivalTime;
						}
					}

					// Departure Time
					if (tileValue.departureTime) {
						const depInput = document.getElementById(
							`departure-time-${tileValue.cellId}`
						);
						if (depInput) {
							depInput.value = tileValue.departureTime;
						}
					}

					// Aircraft ID
					if (tileValue.aircraftId) {
						const aircraftInput = document.getElementById(
							`aircraft-${tileValue.cellId}`
						);
						if (aircraftInput) {
							aircraftInput.value = tileValue.aircraftId;
						}
					}

					// Notes
					if (tileValue.notes) {
						const notesInput = document.getElementById(
							`notes-${tileValue.cellId}`
						);
						if (notesInput) {
							notesInput.value = tileValue.notes;
						}
					}
				}
			});

			console.log("Flugzeit-Werte aus localStorage angewendet");
		}
	} catch (error) {
		console.error("Fehler beim Laden der Flugzeit-Werte:", error);
	}
}

/**
 * Business Logic für Flugdaten-Updates - KOORDINIERT
 */
function saveFlightTimeValueToLocalStorage(cellId, field, value) {
	// NEUE LOGIK: Verwende Datenkoordinator statt localStorage
	if (window.dataCoordinator && field === "aircraftId") {
		window.dataCoordinator.setAircraftId(cellId, value, "api");
		return;
	}

	// DEPRECATED: localStorage-Speicherung deaktiviert zur Konfliktvermeidung
	console.log(
		`📝 Feld-Update protokolliert: ${field} für Kachel ${cellId} = "${value}"`
	);

	// Optional: In-Memory-Cache für Debugging
	if (!window.flightDataCache) {
		window.flightDataCache = {};
	}

	if (!window.flightDataCache[cellId]) {
		window.flightDataCache[cellId] = {};
	}

	window.flightDataCache[cellId][field] = {
		value: value,
		timestamp: new Date().toISOString(),
		source: "api",
	};

	console.log(
		`💾 In-Memory Cache aktualisiert für Kachel ${cellId}:`,
		window.flightDataCache[cellId]
	);
}

/**
 * Toggle-Funktionen (Business Logic)
 */
function toggleEditMode() {
	const body = document.body;
	const modeToggle = document.getElementById("modeToggle");

	if (modeToggle && modeToggle.checked) {
		// Edit-Modus aktivieren
		body.classList.add("edit-mode");
		body.classList.remove("view-mode");
		console.log("✏️ Edit-Modus aktiviert");
	} else {
		// View-Modus aktivieren
		body.classList.remove("edit-mode");
		body.classList.add("view-mode");
		console.log("👁️ View-Modus aktiviert");
	}
}

function toggleSidebar() {
	const sidebar = document.getElementById("sidebarMenu");
	const body = document.body;
	const menuToggle = document.getElementById("menuToggle");

	if (sidebar) {
		body.classList.toggle("sidebar-collapsed");

		// Toggle-Button Text aktualisieren
		const isSidebarCollapsed = body.classList.contains("sidebar-collapsed");
		if (menuToggle) {
			menuToggle.textContent = isSidebarCollapsed ? "«" : "»";
		}

		console.log("Sidebar umgeschaltet");
	}
}

/**
 * Menu-Toggle Initialisierung
 */
function initializeMenuToggle() {
	const menuToggle = document.getElementById("menuToggle");

	if (menuToggle) {
		// Event-Listener hinzufügen
		menuToggle.addEventListener("click", toggleSidebar);

		// Initialer Zustand setzen
		const isSidebarCollapsed =
			document.body.classList.contains("sidebar-collapsed");
		menuToggle.textContent = isSidebarCollapsed ? "«" : "»";

		console.log("Menu-Toggle initialisiert");
	} else {
		console.warn("Menu-Toggle Element nicht gefunden");
	}
}

/**
 * Search-Funktionalität (Business Logic)
 */
function searchAircraft() {
	const searchInput = document.getElementById("searchAircraft");
	if (!searchInput || !searchInput.value.trim()) {
		console.warn("Keine Suchbegriff eingegeben");
		return;
	}

	const searchTerm = searchInput.value.trim().toUpperCase();
	console.log(`Suche nach Flugzeug: ${searchTerm}`);

	// Suche in allen Kacheln
	const aircraftInputs = document.querySelectorAll('input[id^="aircraft-"]');
	let found = false;

	aircraftInputs.forEach((input) => {
		if (input.value.toUpperCase().includes(searchTerm)) {
			// Gefunden - highlighten
			input.style.backgroundColor = "#ffeb3b";
			input.scrollIntoView({ behavior: "smooth", block: "center" });
			found = true;

			// Highlight nach 3 Sekunden entfernen
			setTimeout(() => {
				input.style.backgroundColor = "";
			}, 3000);
		}
	});

	if (!found) {
		console.log(`Flugzeug "${searchTerm}" nicht gefunden`);
		// Optional: Notification anzeigen
		if (window.showNotification) {
			window.showNotification(
				`Flugzeug "${searchTerm}" nicht gefunden`,
				"warning"
			);
		}
	} else {
		console.log(`Flugzeug "${searchTerm}" gefunden und hervorgehoben`);
	}
}

/**
 * Flight Data Business Logic
 */
function fetchAndUpdateFlightData() {
	console.log("Flugdaten-Abruf gestartet...");

	// Sammle Input-Parameter
	const currentDate = document.getElementById("currentDateInput")?.value;
	const nextDate = document.getElementById("nextDateInput")?.value;
	const airportCode = document.getElementById("airportCodeInput")?.value;
	const apiProvider = document.getElementById("apiProviderSelect")?.value;

	if (!currentDate || !nextDate || !airportCode) {
		console.warn("Unvollständige Parameter für Flugdaten-Abruf");
		return;
	}

	// Verwende API-Facade falls verfügbar
	if (
		window.FlightDataAPI &&
		typeof window.FlightDataAPI.fetchFlightData === "function"
	) {
		const params = {
			currentDate,
			nextDate,
			airportCode,
			provider: apiProvider,
		};

		window.FlightDataAPI.fetchFlightData(params)
			.then((data) => {
				console.log("Flugdaten erhalten:", data);
				// Apply data to UI
				if (data && data.length > 0) {
					applyFlightDataToUI(data);
				}
			})
			.catch((error) => {
				console.error("Flugdaten-Abruf fehlgeschlagen:", error);
			});
	} else {
		console.warn("FlightDataAPI nicht verfügbar");
	}
}

function applyFlightDataToUI(flightData) {
	console.log("✈️ Wende Flugdaten auf UI an:", flightData.length, "Flüge");

	// NEUE LOGIK: Verwende Datenkoordinator für sichere Anwendung
	if (window.dataCoordinator) {
		window.dataCoordinator.applyFlightData(flightData, "api");
		return;
	}

	// Fallback: Direkte Anwendung mit Warnungen
	flightData.forEach((flight, index) => {
		const cellId = index + 1; // Einfache Zuordnung zu Kacheln

		if (cellId <= 12) {
			// Nur auf verfügbare Kacheln anwenden

			// Aircraft ID - MIT KONFLIKTPRÜFUNG
			const aircraftInput = document.getElementById(`aircraft-${cellId}`);
			if (aircraftInput && flight.aircraftId) {
				const currentValue = aircraftInput.value.trim();

				// Warnung bei Überschreibung bestehender Daten
				if (currentValue && currentValue !== flight.aircraftId) {
					console.warn(
						`⚠️ API überschreibt Aircraft ID in Kachel ${cellId}: "${currentValue}" → "${flight.aircraftId}"`
					);

					// Optional: Benutzerbestätigung anfordern
					if (window.showNotification) {
						window.showNotification(
							`API-Daten überschreiben Aircraft ID in Kachel ${cellId}`,
							"warning"
						);
					}
				}

				aircraftInput.value = flight.aircraftId;
				saveFlightTimeValueToLocalStorage(
					cellId,
					"aircraftId",
					flight.aircraftId
				);

				console.log(
					`✅ Aircraft ID für Kachel ${cellId} von API gesetzt: ${flight.aircraftId}`
				);
			}

			// Arrival Time
			const arrivalInput = document.getElementById(`arrival-time-${cellId}`);
			if (arrivalInput && flight.arrivalTime) {
				arrivalInput.value = flight.arrivalTime;
				saveFlightTimeValueToLocalStorage(
					cellId,
					"arrivalTime",
					flight.arrivalTime
				);
			}

			// Departure Time
			const departureInput = document.getElementById(
				`departure-time-${cellId}`
			);
			if (departureInput && flight.departureTime) {
				departureInput.value = flight.departureTime;
				saveFlightTimeValueToLocalStorage(
					cellId,
					"departureTime",
					flight.departureTime
				);
			}
		}
	});

	console.log(
		"✅ Flugdaten erfolgreich auf UI angewendet (mit Konfliktschutz)"
	);
}

/**
 * Sidebar-Toggle Initialisierung (nur Business Logic)
 */
function initializeSidebarToggle() {
	const body = document.body;
	const menuToggle = document.getElementById("menuToggle");

	// Initialer Zustand
	const isSidebarCollapsed = body.classList.contains("sidebar-collapsed");
	if (menuToggle) {
		menuToggle.textContent = isSidebarCollapsed ? "»" : "»";
	}

	console.log("Sidebar-Toggle initialisiert");
}

/**
 * NEUE FUNKTION: Prüft und löscht Flugdaten wenn Aircraft ID geleert wird
 * @param {string} aircraftInputId - ID des Aircraft Input Feldes
 * @param {string} newValue - Neuer Wert des Aircraft Input Feldes
 */
function handleAircraftIdChange(aircraftInputId, newValue) {
	console.log(`🔄 Aircraft ID geändert: ${aircraftInputId} = "${newValue}"`);
	
	// Extrahiere Cell ID aus der Input ID
	const cellId = aircraftInputId.replace("aircraft-", "");
	
	// Wenn Aircraft ID leer oder nur Whitespace ist, lösche alle zugehörigen Flugdaten
	if (!newValue || newValue.trim() === "") {
		console.log(`🧹 Aircraft ID für Kachel ${cellId} ist leer - lösche Flugdaten`);
		
		// Lösche Arrival Time
		const arrivalInput = document.getElementById(`arrival-time-${cellId}`);
		if (arrivalInput && arrivalInput.value) {
			arrivalInput.value = "";
			console.log(`🧹 Ankunftszeit für Kachel ${cellId} gelöscht`);
		}
		
		// Lösche Departure Time  
		const departureInput = document.getElementById(`departure-time-${cellId}`);
		if (departureInput && departureInput.value) {
			departureInput.value = "";
			console.log(`🧹 Abflugzeit für Kachel ${cellId} gelöscht`);
		}
		
		// Lösche Position (beide möglichen Felder prüfen)
		const positionInput = document.getElementById(`position-${cellId}`) || 
		                     document.getElementById(`hangar-position-${cellId}`);
		if (positionInput && positionInput.value) {
			positionInput.value = "";
			console.log(`🧹 Position für Kachel ${cellId} gelöscht`);
		}
		
		// Optional: Speichere die gelöschten Werte in localStorage
		if (typeof saveFlightTimeValueToLocalStorage === "function") {
			saveFlightTimeValueToLocalStorage(cellId, "arrivalTime", "");
			saveFlightTimeValueToLocalStorage(cellId, "departureTime", "");
			saveFlightTimeValueToLocalStorage(cellId, "position", "");
			saveFlightTimeValueToLocalStorage(cellId, "aircraftId", "");
		}
	}
}

/**
 * Export für globale Verfügbarkeit
 */
window.hangarEvents = {
	initializeUI,
	initializeStatusSelectors,
	initializeMenuToggle,
	initializeSidebarToggle,
	toggleEditMode,
	toggleSidebar,
	searchAircraft,
	fetchAndUpdateFlightData,
	saveFlightTimeValueToLocalStorage,
	applyPositionValuesFromLocalStorage,
	applyFlightTimeValuesFromLocalStorage,
	updateStatusLights,
	handleAircraftIdChange, // NEUE FUNKTION HINZUGEFÜGT
};

console.log("📦 hangar-events.js optimiert geladen (Business Logic only)");
