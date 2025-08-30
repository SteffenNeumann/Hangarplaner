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


/**
 * Menu-Toggle Initialisierung
 */

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

				// NEUE FUNKTION: Aktualisiere auch die Timetable mit aktuellen API-Daten
				if (
					window.TimetableAPIManager &&
					typeof window.TimetableAPIManager.forceRefreshTimetable === "function"
				) {
					console.log("🕐 Starte Timetable-Aktualisierung nach Update Data...");
					window.TimetableAPIManager.forceRefreshTimetable()
						.then(() => {
							console.log("✅ Timetable erfolgreich aktualisiert");
						})
						.catch((error) => {
							console.error("❌ Fehler bei Timetable-Aktualisierung:", error);
						});
				} else {
					console.log("⚠️ TimetableAPIManager nicht verfügbar");
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
 * NEUE FUNKTION: Prüft und löscht Flugdaten wenn Aircraft ID geleert wird
 * @param {string} aircraftInputId - ID des Aircraft Input Feldes
 * @param {string} newValue - Neuer Wert des Aircraft Input Feldes
 */
// KORREKTUR: Debounce-Map für Aircraft ID Changes, um Aufhängen zu verhindern
const aircraftIdChangeDebounce = new Map();

function handleAircraftIdChange(aircraftInputId, newValue) {
	console.log(`🔄 Aircraft ID geändert: ${aircraftInputId} = "${newValue}"`);

	// KORREKTUR: Debounce-Logik, um mehrfache gleichzeitige Aufrufe zu verhindern
	const debounceKey = aircraftInputId;
	const now = Date.now();

	// Prüfe ob ein kürzlicher Aufruf für dasselbe Feld stattgefunden hat
	if (aircraftIdChangeDebounce.has(debounceKey)) {
		const lastCall = aircraftIdChangeDebounce.get(debounceKey);
		if (now - lastCall < 300) {
			// 300ms Debounce-Zeit
			console.log(
				`⏭️ Debounce: Überspringe wiederholten Aufruf für ${aircraftInputId}`
			);
			return;
		}
	}

	// Markiere diesen Aufruf
	aircraftIdChangeDebounce.set(debounceKey, now);

	// Extrahiere Cell ID aus der Input ID
	const cellId = aircraftInputId.replace("aircraft-", "");

	// KORREKTUR: Erweiterte Prüfung auf leere/ungültige Aircraft ID
	if (!newValue || newValue.trim() === "" || newValue.trim().length === 0) {
		console.log(
			`🧹 Aircraft ID für Kachel ${cellId} ist leer - lösche Flugdaten`
		);

		// Lösche Arrival Time
		const arrivalInput = document.getElementById(`arrival-time-${cellId}`);
		if (arrivalInput) {
			arrivalInput.value = "";
			console.log(`🧹 Ankunftszeit für Kachel ${cellId} gelöscht`);
		}

		// Lösche Departure Time
		const departureInput = document.getElementById(`departure-time-${cellId}`);
		if (departureInput) {
			departureInput.value = "";
			console.log(`🧹 Abflugzeit für Kachel ${cellId} gelöscht`);
		}

		// Lösche Position (beide möglichen Felder prüfen)
		const positionInput =
			document.getElementById(`position-${cellId}`) ||
			document.getElementById(`hangar-position-${cellId}`);
		if (positionInput) {
			positionInput.value = "";
			console.log(`🧹 Position für Kachel ${cellId} gelöscht`);
		}

		// KORREKTUR: Auch localStorage aktualisieren
		if (typeof saveFlightTimeValueToLocalStorage === "function") {
			saveFlightTimeValueToLocalStorage(cellId, "arrivalTime", "");
			saveFlightTimeValueToLocalStorage(cellId, "departureTime", "");
			saveFlightTimeValueToLocalStorage(cellId, "position", "");
			saveFlightTimeValueToLocalStorage(cellId, "aircraftId", "");
			console.log(`💾 localStorage für Kachel ${cellId} gelöscht`);
		}
	} else {
		// KORREKTUR: Bei gültiger Aircraft ID automatisch Flugdaten abrufen
		console.log(
			`✈️ Gültige Aircraft ID für Kachel ${cellId}: "${newValue.trim()}" - starte Datenabfrage`
		);

		// Automatisch Flugdaten abrufen wenn Aircraft ID eingegeben wird
		if (
			window.FlightDataAPI &&
			typeof window.FlightDataAPI.updateAircraftData === "function"
		) {
				// Debounced call für Datenabfrage
				setTimeout(() => {
					// Datum aus UI lesen, ansonsten intelligente Defaults setzen (heute und morgen)
					let currentDate = document.getElementById("currentDateInput")?.value;
					let nextDate = document.getElementById("nextDateInput")?.value;

					if (!currentDate || currentDate.trim() === "") {
						currentDate = new Date().toISOString().split("T")[0];
					}
					if (!nextDate || nextDate.trim() === "") {
						try {
							const base = new Date(currentDate);
							if (!isNaN(base.getTime())) {
								base.setDate(base.getDate() + 1);
								nextDate = base.toISOString().split("T")[0];
							} else {
								nextDate = new Date(Date.now() + 24 * 60 * 60 * 1000)
									.toISOString()
									.split("T")[0];
							}
						} catch (e) {
							nextDate = new Date(Date.now() + 24 * 60 * 60 * 1000)
								.toISOString()
								.split("T")[0];
						}
					}

					console.log(
						`📡 Starte API-Abfrage für Aircraft ID: ${newValue.trim()} (Zeitraum ${currentDate} → ${nextDate})`
					);
					window.FlightDataAPI.updateAircraftData(
						newValue.trim(),
						currentDate,
						nextDate
					)
						.then(async (flightData) => {
							console.log(
								`✅ Flugdaten erhalten für ${newValue.trim()}:`,
								flightData
							);

							// ✅ KORREKTUR: UI-Update nach erfolgreichem API-Aufruf
							if (
								flightData &&
								window.HangarData &&
								typeof window.HangarData.updateAircraftFromFlightData ===
									"function"
							) {
								try {
									await window.HangarData.updateAircraftFromFlightData(
										newValue.trim(),
										flightData
									);
									console.log(
										`✅ UI-Kacheln für ${newValue.trim()} erfolgreich aktualisiert`
									);

									// ✅ NEUE FUNKTION: Update-Badge für manuelle Eingabe setzen
									if (window.refreshAllUpdateBadges) {
										setTimeout(window.refreshAllUpdateBadges, 100);
									}
								} catch (updateError) {
									console.error(
										`❌ Fehler beim UI-Update für ${newValue.trim()}:`,
										updateError
									);
								}
							} else if (flightData) {
								console.warn(
									"❌ HangarData.updateAircraftFromFlightData nicht verfügbar - UI wird nicht aktualisiert"
								);
							}
						})
						.catch((error) => {
							console.error(
								`❌ Fehler beim Abrufen der Flugdaten für ${newValue.trim()}:`,
								error
							);
						});
				} else {
					console.warn("⚠️ Datum-Parameter fehlen für Flugdaten-Abfrage");
				}
			}, 500); // 500ms Verzögerung um Tippgeschwindigkeit abzuwarten
		} else {
			console.warn(
				"⚠️ FlightDataAPI nicht verfügbar für automatische Datenabfrage"
			);
		}

		// Speichere Aircraft ID in localStorage
		if (typeof saveFlightTimeValueToLocalStorage === "function") {
			saveFlightTimeValueToLocalStorage(cellId, "aircraftId", newValue.trim());
		}
	}
}

/**
 * Export für globale Verfügbarkeit
 */
window.hangarEvents = {
	initializeUI,
	initializeStatusSelectors,
	toggleEditMode,
	searchAircraft,
	fetchAndUpdateFlightData,
	saveFlightTimeValueToLocalStorage,
	applyPositionValuesFromLocalStorage,
	applyFlightTimeValuesFromLocalStorage,
	updateStatusLights,
	handleAircraftIdChange, // NEUE FUNKTION HINZUGEFÜGT
};

console.log("📦 hangar-events.js optimiert geladen (Business Logic only)");
