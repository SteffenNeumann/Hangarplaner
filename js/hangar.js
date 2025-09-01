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

// Übernimmt ausgewählte Registrierung aus Query-Parametern (Fallback zu localStorage)
(function adoptSelectedAircraftFromQuery() {
	try {
		const params = new URLSearchParams(window.location.search);
		const reg = params.get("selectedAircraft");
		if (reg) {
			const trimmed = reg.trim();
			if (trimmed) {
				localStorage.setItem("selectedAircraft", trimmed);
				// Zeiten übernehmen, falls vorhanden
				const arr = params.get("arr");
				const dep = params.get("dep");
				if (arr) localStorage.setItem("selectedArrivalTime", arr);
				if (dep) localStorage.setItem("selectedDepartureTime", dep);
				// Optionaler Prompt-Flag
				if (params.has("prompt")) {
					localStorage.setItem("selectedAircraftPrompt", "true");
				}
				// URL bereinigen (auch bei file:// sicher)
				if (window.history && window.history.replaceState) {
					const cleanUrl = window.location.pathname + window.location.hash;
					window.history.replaceState({}, document.title, cleanUrl);
				}
				console.log(`🔗 Übernommen aus URL: selectedAircraft=${trimmed}`);
			}
		}
	} catch (e) {
		console.warn("adoptSelectedAircraftFromQuery Fehler:", e);
	}
})();

/**
 * Initialisiert die Anwendung in der richtigen Reihenfolge
 */
function initializeApp() {
	// console.log("Initialisiere HangarPlanner-Anwendung...");

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
				window.moduleStatus.ui = true;
				// console.log("UI-Modul initialisiert");
			}

			// 3. Event-Listener einrichten
			if (window.hangarEvents && window.hangarEvents.setupUIEventListeners) {
				window.hangarEvents.setupUIEventListeners();
				window.moduleStatus.events = true;
				// console.log("Event-Listener eingerichtet");
			}

			// 4. Gespeicherte Einstellungen laden
			if (
				window.hangarUI &&
				window.hangarUI.uiSettings &&
				window.hangarUI.uiSettings.load
			) {
				window.hangarUI.uiSettings.load();
				// console.log("UI-Einstellungen geladen");
			}

			// 5. Daten initialisieren
			if (window.hangarData) {
				// Letzten Status aus localStorage laden
				if (window.hangarData.loadCurrentStateFromLocalStorage) {
					window.hangarData.loadCurrentStateFromLocalStorage();
				}
				window.moduleStatus.data = true;
				// console.log("Daten-Modul initialisiert");
			}

			// Initialisieren des API-Provider-Selectors
			initializeApiProviderSelector();

			// 6. Initialisierung abgeschlossen
			// console.log("HangarPlanner-Anwendung erfolgreich initialisiert!");

			// Überprüfen, ob ein Flugzeug aus der Fleet Database ausgewählt wurde
			checkForSelectedAircraft();

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
			
			// Skip facade registration for overnight-flights since it's handled separately
			if (newProvider === "overnight-flights") {
				console.log(`🏨 [PROVIDER-SELECTOR] Overnight flights selected - bypassing API facade`);
				return; // Don't register with the facade
			}
			
			// For all other providers, register with the facade
			window.FlightDataAPI.setProvider(newProvider);
			console.log(`✅ [PROVIDER-SELECTOR] API provider changed to: ${newProvider}`);
		}
	});

	// console.log("API-Provider-Selektor initialisiert");
}

// Initialisiert die gesamte Anwendung
function initialize() {
	// console.log("Initialisiere HangarPlanner-Anwendung...");

	// Initialisiere UI - KORRIGIERT: Verwende hangarEvents.initializeUI
	if (window.hangarEvents && window.hangarEvents.initializeUI) {
		window.hangarEvents.initializeUI();
		// console.log("UI-Modul initialisiert");
	}

	// Ereignisbehandler einrichten - ENTFERNT: setupEventListeners existiert nicht mehr
	// Event-Handler werden jetzt von improved-event-manager.js verwaltet

	// Lade die UI-Einstellungen - KORRIGIERT: Verwende display-options System
	if (window.displayOptions) {
		window.displayOptions.load();
		// console.log("UI-Einstellungen über Display Options geladen");
	} else if (
		window.hangarUI &&
		window.hangarUI.uiSettings &&
		window.hangarUI.uiSettings.load
	) {
		window.hangarUI.uiSettings.load();
		// console.log("UI-Einstellungen über Legacy-System geladen");
	}

	// Initialisiere Datenmodul - ENTFERNT: loadStateFromLocalStorage existiert nicht mehr
	// Daten werden jetzt über dataCoordinator und server-sync verwaltet

	// Initialisiere API-Fassade - WICHTIG: Nach allen anderen APIs initialisieren
	console.log("Prüfe FlightDataAPI für Event-Handler-Setup...");
	if (window.FlightDataAPI) {
		console.log("✅ FlightDataAPI gefunden, starte Event-Handler-Setup");
		// Warten bis AmadeusAPI und AeroDataBoxAPI geladen sind
		setTimeout(() => {
			setupFlightDataEventHandlers();
			console.log("✅ API-Fassade final initialisiert und verbunden");
		}, 500);
	} else {
		console.warn(
			"⚠️ FlightDataAPI nicht sofort verfügbar, installiere Fallback-Mechanismus"
		);
		// Fallback: Regelmäßig prüfen bis FlightDataAPI verfügbar ist
		const checkInterval = setInterval(() => {
			if (window.FlightDataAPI) {
				console.log(
					"✅ FlightDataAPI nachträglich gefunden, initialisiere Event-Handler"
				);
				setupFlightDataEventHandlers();
				clearInterval(checkInterval);
			} else {
				console.log("⏳ Warte noch auf FlightDataAPI...");
			}
		}, 1000);

		// Nach 10 Sekunden aufhören zu prüfen
		setTimeout(() => {
			clearInterval(checkInterval);
			console.error(
				"❌ FlightDataAPI nach 10 Sekunden immer noch nicht verfügbar!"
			);
		}, 10000);
	}

	// Initialisiere APIs
	if (window.AeroDataBoxAPI) {
		window.AeroDataBoxAPI.init();
		// console.log("AeroDataBox API initialisiert");
	}

	if (window.Flightradar24API) {
		window.Flightradar24API.init();
		// console.log("Flightradar24 API initialisiert");
	}

	// console.log("HangarPlanner-Anwendung erfolgreich initialisiert!");
}

// Globale Verfügbarkeit
window.hangarInitialize = initialize;

// Zur zentralen Initialisierung hinzufügen
window.hangarInitQueue = window.hangarInitQueue || [];
window.hangarInitQueue.push(function () {
	console.log("🚀 Starte Hangar-Hauptinitialisierung...");
	initialize();
});

// SOFORTIGER FALLBACK für Update Data Button
document.addEventListener("DOMContentLoaded", function () {
	console.log("🔧 Installiere sofortigen Fallback für Update Data Button...");

	setTimeout(() => {
		const fetchFlightBtn = document.getElementById("fetchFlightData");
		if (fetchFlightBtn && !fetchFlightBtn.onclick) {
			console.log(
				"🆘 Button hat noch keinen Handler, installiere Notfall-Handler"
			);
			fetchFlightBtn.onclick = function (event) {
				event.preventDefault();
				console.log("🚨 NOTFALL-HANDLER: Update Data Button wurde geklickt!");
				console.log("FlightDataAPI verfügbar:", !!window.FlightDataAPI);
				console.log(
					"Setupfunktion verfügbar:",
					typeof setupFlightDataEventHandlers
				);

				// Versuche, die echte Funktion aufzurufen
				if (typeof setupFlightDataEventHandlers === "function") {
					console.log(
						"📞 Rufe setupFlightDataEventHandlers nachträglich auf..."
					);
					setupFlightDataEventHandlers();
				}
			};
		} else if (fetchFlightBtn) {
			console.log("✅ Button hat bereits einen Handler");
		} else {
			console.error("❌ Button 'fetchFlightData' nicht gefunden!");
		}
	}, 2000);
});

/**
 * Initialisiert das Project Name Feld mit automatischem Dateinamen
 * Format: YYYY_MM_DD_Hangarplan (ohne Uhrzeit für Project Settings)
 */
function initializeProjectName() {
	const projectNameInput = document.getElementById("projectName");
	if (projectNameInput) {
		// Nur setzen, wenn das Feld leer ist
		if (!projectNameInput.value.trim()) {
			if (typeof generateProjectSettingsName === "function") {
				projectNameInput.value = generateProjectSettingsName();
				console.log(
					"📝 Project Name automatisch gesetzt:",
					projectNameInput.value
				);
			} else if (
				window.hangarData &&
				typeof window.hangarData.generateProjectSettingsName === "function"
			) {
				projectNameInput.value =
					window.hangarData.generateProjectSettingsName();
				console.log(
					"📝 Project Name automatisch gesetzt (fallback):",
					projectNameInput.value
				);
			} else {
				// Manueller Fallback
				const now = new Date();
				const year = now.getFullYear();
				const month = String(now.getMonth() + 1).padStart(2, "0");
				const day = String(now.getDate()).padStart(2, "0");
				projectNameInput.value = `${year}_${month}_${day}_Hangarplan`;
				console.log("📝 Project Name manuell gesetzt:", projectNameInput.value);
			}
		}
	}
}

// Funktion zum Einrichten der Save/Load Event-Handler
function setupSaveLoadEventHandlers() {
	console.log("🔧 Richte Save/Load/Export Event-Handler ein...");

	// Project Name automatisch setzen, falls leer
	initializeProjectName();

	// Save Button Event-Handler
	const saveBtn = document.getElementById("saveBtn");
	if (saveBtn) {
		saveBtn.addEventListener("click", function (event) {
			event.preventDefault();
			console.log("💾 Save Button geklickt");

			try {
				// Verwende FileManager für Save mit Dialog
				if (
					window.fileManager &&
					typeof window.fileManager.saveProject === "function"
				) {
					// Projektstatus sammeln - verwende Dateiname mit Uhrzeit für Save
					const projectData = {
						metadata: {
							projectName: generateDefaultProjectName(), // Mit Uhrzeit für Save
							lastModified: new Date().toISOString(),
						},
						tilesData: collectTilesData(),
						settings: collectSettingsData(),
					};

					window.fileManager.saveProject(projectData);
				} else if (
					window.hangarData &&
					typeof window.hangarData.saveProjectToFile === "function"
				) {
					// Fallback auf hangarData
					window.hangarData.saveProjectToFile();
				} else {
					throw new Error("Keine Save-Funktion verfügbar");
				}
			} catch (error) {
				console.error("Fehler beim Speichern:", error);
				showNotification("Fehler beim Speichern: " + error.message, "error");
			}
		});
		console.log("✅ Save Button Event-Handler eingerichtet");
	} else {
		console.warn("❌ Save Button nicht gefunden");
	}

	// Load Button Event-Handler
	const loadBtn = document.getElementById("loadBtn");
	if (loadBtn) {
		loadBtn.addEventListener("click", function (event) {
			event.preventDefault();
			console.log("📂 Load Button geklickt");

			try {
				// Verwende FileManager für Load mit Dialog
				if (
					window.fileManager &&
					typeof window.fileManager.loadProject === "function"
				) {
					window.fileManager
						.loadProject()
						.then((projectData) => {
							if (projectData) {
								// Daten in die Anwendung laden
								if (
									window.dataCoordinator &&
									typeof window.dataCoordinator.loadProject === "function"
								) {
									window.dataCoordinator.loadProject(projectData, "file");
								} else if (typeof applyProjectData === "function") {
									// Verwende applyProjectData direkt
									applyProjectData(projectData);

									// Projektnamen im Eingabefeld setzen
									const projectNameInput =
										document.getElementById("projectName");
									if (projectNameInput && projectData.projectName) {
										projectNameInput.value = projectData.projectName;
									}

									showNotification("Projekt erfolgreich geladen", "success");
								} else {
									console.warn(
										"Keine Funktion zum Laden der Projektdaten gefunden"
									);
									showNotification(
										"Projekt geladen, aber Daten konnten nicht angewendet werden",
										"warning"
									);
								}
							}
						})
						.catch((error) => {
							if (error.name !== "AbortError") {
								console.error("Fehler beim Laden:", error);
								showNotification(
									"Fehler beim Laden: " + error.message,
									"error"
								);
							}
						});
				} else if (
					window.hangarData &&
					typeof window.hangarData.loadProjectFromFile === "function"
				) {
					// Fallback auf hangarData
					window.hangarData.loadProjectFromFile();
				} else {
					throw new Error("Keine Load-Funktion verfügbar");
				}
			} catch (error) {
				console.error("Fehler beim Laden:", error);
				showNotification("Fehler beim Laden: " + error.message, "error");
			}
		});
		console.log("✅ Load Button Event-Handler eingerichtet");
	} else {
		console.warn("❌ Load Button nicht gefunden");
	}

	// PDF Export Button Event-Handler
	const exportPdfBtn = document.getElementById("exportPdfBtn");
	if (exportPdfBtn) {
		exportPdfBtn.addEventListener("click", function (event) {
			event.preventDefault();
			console.log("📄 PDF Export Button geklickt");

			try {
				// Prüfe ob PDF Export-Funktion verfügbar ist
				if (
					window.hangarPDF &&
					typeof window.hangarPDF.exportToPDF === "function"
				) {
					window.hangarPDF.exportToPDF();
				} else if (typeof exportToPDF === "function") {
					// Fallback auf globale Funktion
					exportToPDF();
				} else {
					throw new Error("PDF Export-Funktion nicht verfügbar");
				}
			} catch (error) {
				console.error("Fehler beim PDF Export:", error);
				showNotification("Fehler beim PDF Export: " + error.message, "error");
			}
		});
		console.log("✅ PDF Export Button Event-Handler eingerichtet");
	} else {
		console.warn("❌ PDF Export Button nicht gefunden");
	}

	// Search Aircraft Button Event-Handler
	const btnSearch = document.getElementById("btnSearch");
	if (btnSearch) {
		btnSearch.addEventListener("click", function (event) {
			event.preventDefault();
			console.log("🔍 Search Aircraft Button geklickt");

			try {
				// Prüfe ob Search-Funktion verfügbar ist
				if (
					window.hangarEvents &&
					typeof window.hangarEvents.searchAircraft === "function"
				) {
					window.hangarEvents.searchAircraft();
				} else if (typeof searchAircraft === "function") {
					// Fallback auf globale Funktion
					searchAircraft();
				} else {
					throw new Error("Search Aircraft-Funktion nicht verfügbar");
				}
			} catch (error) {
				console.error("Fehler bei Aircraft Search:", error);
				showNotification(
					"Fehler bei Aircraft Search: " + error.message,
					"error"
				);
			}
		});
		console.log("✅ Search Aircraft Button Event-Handler eingerichtet");
	} else {
		console.warn("❌ Search Aircraft Button nicht gefunden");
	}

	// Search Aircraft Input Event-Handler (Enter-Taste)
	const searchAircraftInput = document.getElementById("searchAircraft");
	if (searchAircraftInput) {
		searchAircraftInput.addEventListener("keypress", function (event) {
			if (event.key === "Enter") {
				event.preventDefault();
				console.log("🔍 Enter-Taste im Search Aircraft Input gedrückt");

				// Gleiche Logik wie beim Button-Klick
				try {
					if (
						window.hangarEvents &&
						typeof window.hangarEvents.searchAircraft === "function"
					) {
						window.hangarEvents.searchAircraft();
					} else if (typeof searchAircraft === "function") {
						searchAircraft();
					} else {
						throw new Error("Search Aircraft-Funktion nicht verfügbar");
					}
				} catch (error) {
					console.error("Fehler bei Aircraft Search:", error);
					showNotification(
						"Fehler bei Aircraft Search: " + error.message,
						"error"
					);
				}
			}
		});
		console.log("✅ Search Aircraft Input Enter-Handler eingerichtet");
	} else {
		console.warn("❌ Search Aircraft Input nicht gefunden");
	}
}

// Funktion, um sicherzustellen, dass die API-Fassade korrekt verbunden ist
function setupFlightDataEventHandlers() {
	console.log("🔧 setupFlightDataEventHandlers aufgerufen");

	// WICHTIG: Zuerst den bestehenden Event-Handler vom fetchFlightBtn entfernen
	const fetchFlightBtn = document.getElementById("fetchFlightData");
	console.log("Button gefunden:", !!fetchFlightBtn);

	if (fetchFlightBtn) {
		console.log("✅ Update Data Button gefunden, installiere Event-Handler");

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
			console.log("*** UPDATE DATA BUTTON WURDE GEKLICKT ***");

			// Check API provider selection to determine behavior
				const apiProviderSelect = document.getElementById("apiProviderSelect");
				// Default to overnight processing when provider select is absent
				const selectedProvider = apiProviderSelect?.value || "overnight-flights";
				console.log(`🔍 Selected API Provider: ${selectedProvider}`);

			// Route to appropriate processing based on provider selection
			if (selectedProvider === "overnight-flights") {
				console.log("🏨 *** OVERNIGHT FLIGHTS PROCESSING MODE SELECTED ***");
				console.log("🔄 Bypassing API facade and using direct AeroDataBox overnight processing...");
				
				// Get airport and date parameters
				const airportCodeInput = document.getElementById("airportCodeInput");
				const currentDateInput = document.getElementById("currentDateInput");
				const nextDateInput = document.getElementById("nextDateInput");
				
				const airportCode = airportCodeInput?.value.trim().toUpperCase() || "MUC";
				const currentDate = currentDateInput?.value || new Date().toISOString().split("T")[0];
				// Compute next day strictly based on currentDate if provided; otherwise fallback to tomorrow from now
				const nextDate = (function(){
					if (nextDateInput?.value) return nextDateInput.value;
					if (currentDate) {
						const d = new Date(currentDate);
						// Handle potential timezone offset by using UTC components when available
						d.setUTCDate(d.getUTCDate() + 1);
						return d.toISOString().split("T")[0];
					}
					return new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split("T")[0];
				})();

				console.log(`🏨 Parameters: Airport=${airportCode}, StartDate=${currentDate}, EndDate=${nextDate}`);

				// Call the new correct overnight processing function DIRECTLY
				if (window.AeroDataBoxAPI && window.AeroDataBoxAPI.processOvernightFlightsCorrectly) {
					console.log("✅ AeroDataBoxAPI.processOvernightFlightsCorrectly found, calling...");
					try {
						const result = await window.AeroDataBoxAPI.processOvernightFlightsCorrectly(
							airportCode,
							currentDate,
							nextDate
						);

						console.log("📋 Overnight processing result:", result);

						if (result && result.success) {
							console.log("✅ Overnight processing completed successfully!");
							if (window.showNotification) {
								window.showNotification(
									`Overnight processing complete: ${result.overnightAircraft} aircraft found, ${result.tilesMatched} tiles updated`,
									"success"
								);
							}
						} else {
							console.error("❌ Overnight processing failed, result:", result);
							if (window.showNotification) {
								const errorMsg = result && result.error 
									? `Overnight processing failed: ${result.error}`
									: "Overnight processing failed. Check console for details.";
								window.showNotification(errorMsg, "error");
							}
						}
					} catch (error) {
						console.error("❌ Error during overnight processing:", error);
						if (window.showNotification) {
							window.showNotification(
								`❌ Overnight processing error: ${error.message}`,
								"error"
							);
						}
					}
				} else {
					console.error("❌ AeroDataBoxAPI.processOvernightFlightsCorrectly not available!");
					console.log("Available AeroDataBoxAPI methods:", window.AeroDataBoxAPI ? Object.keys(window.AeroDataBoxAPI) : "AeroDataBoxAPI not found");
					if (window.showNotification) {
						window.showNotification(
							"❌ Overnight processing function not available. Check console for details.",
							"error"
						);
					}
				}
				console.log("🏨 *** OVERNIGHT PROCESSING COMPLETE - EXITING EARLY ***");
				return; // Exit early for overnight processing
			}

			// DEFAULT BEHAVIOR: Individual aircraft processing (aerodatabox)
			console.log("🛫 Using standard individual aircraft processing...");

			// Sammle alle Aircraft IDs aus den Kacheln (primäre und sekundäre)
			const primaryTiles = document.querySelectorAll(
				'#hangarGrid .hangar-cell input[id^="aircraft-"]'
			);
			const secondaryTiles = document.querySelectorAll(
				'#secondaryHangarGrid .hangar-cell input[id^="aircraft-"]'
			);
			const allAircraftInputs = [...primaryTiles, ...secondaryTiles];

			// Sammle alle nicht-leeren Aircraft IDs
			const aircraftIds = [];
			allAircraftInputs.forEach((input) => {
				const value = input.value.trim();
				if (value) {
					aircraftIds.push({
						id: value,
						element: input,
						cellId: input.id.split("-")[1],
					});
				}
			});

			console.log(`Gefundene Aircraft IDs in Kacheln: ${aircraftIds.length}`);
			aircraftIds.forEach((aircraft) => {
				console.log(`- ${aircraft.id} (Kachel ${aircraft.cellId})`);
			});

			const currentDateInput = document.getElementById("currentDateInput");
			const nextDateInput = document.getElementById("nextDateInput");
			const airportCodeInput = document.getElementById("airportCodeInput");

			console.log("Eingabefelder gefunden:", {
				aircraftIds: aircraftIds.length,
				currentDateInput: !!currentDateInput,
				nextDateInput: !!nextDateInput,
				airportCodeInput: !!airportCodeInput,
			});

			const currentDate = currentDateInput?.value;
			const nextDate = nextDateInput?.value;
			const airportCode =
				airportCodeInput?.value?.trim().toUpperCase() || "MUC";

			if (aircraftIds.length === 0) {
				console.warn("❌ Keine Aircraft IDs in den Kacheln gefunden");
				alert("Bitte geben Sie mindestens eine Flugzeug-ID in eine Kachel ein");
				return;
			}

			// Verarbeite alle gefundenen Aircraft IDs
			for (const aircraft of aircraftIds) {
				console.log(
					`\n🛫 Verarbeite Aircraft ID: ${aircraft.id} (Kachel ${aircraft.cellId})`
				);

				console.log("Eingabewerte:", {
					aircraftId: aircraft.id,
					currentDate,
					nextDate,
					airportCode,
				});
				console.log(
					`API-Fassade wird verwendet für: ${aircraft.id}, Flughafen: ${airportCode}`
				);

				console.log("Prüfe FlightDataAPI Verfügbarkeit...");
				if (window.FlightDataAPI) {
					console.log("✅ FlightDataAPI ist verfügbar");
					try {
						// Zusätzliches Debug-Log für die Anfrage
						console.log("Anfrage-Parameter:", {
							aircraftId: aircraft.id,
							currentDate,
							nextDate,
							airportCode,
						});

						// API-Fassade aufrufen und Ergebnis speichern
						const result = await window.FlightDataAPI.updateAircraftData(
							aircraft.id,
							currentDate,
							nextDate
						);

						console.log(
							`API-Fassade Aufruf für ${aircraft.id} erfolgreich abgeschlossen`
						);
						console.log("Empfangene Daten:", result);

						// ✅ WICHTIG: Ergebnisse in die UI übertragen
						if (
							result &&
							window.HangarData &&
							typeof window.HangarData.updateAircraftFromFlightData ===
								"function"
						) {
							// Aktualisiere die UI-Kacheln mit den Flugdaten (async)
							await window.HangarData.updateAircraftFromFlightData(
								aircraft.id,
								result
							);
							console.log(
								`✅ UI-Kacheln für ${aircraft.id} erfolgreich aktualisiert`
							);
						} else if (result) {
							console.warn(
								"❌ HangarData.updateAircraftFromFlightData nicht verfügbar - UI wird nicht aktualisiert"
							);
						}

						// Optional: Überprüfen, ob die Daten zum gewünschten Flughafen gehören
						if (
							result &&
							(result.originCode === airportCode ||
								result.destCode === airportCode)
						) {
							console.log(`✅ Daten für Flughafen ${airportCode} gefunden.`);
						} else if (result) {
							console.warn(
								`⚠️ Daten enthalten nicht den gewünschten Flughafen ${airportCode}.`
							);
						}
					} catch (error) {
						console.error(
							`❌ Fehler beim API-Fassaden-Aufruf für ${aircraft.id}:`,
							error
						);
					}
				} else {
					console.error("❌ FlightDataAPI nicht verfügbar!");
				}
			}
		};

		console.log(
			"✅ Event-Handler für Update Data Button erfolgreich registriert"
		);
	} else {
		console.error("❌ Update Data Button nicht gefunden!");
	}

	// Event-Handler für den neuen Overnight Flights Button
	const processOvernightFlightsBtn = document.getElementById(
		"processOvernightFlightsBtn"
	);
	if (processOvernightFlightsBtn) {
		console.log(
			"✅ Process Overnight Flights Button gefunden, installiere Event-Handler"
		);

		// Event-Handler für Overnight Flight Processing
		processOvernightFlightsBtn.onclick = async function (event) {
			// Standardverhalten verhindern
			event.preventDefault();

			console.log("*** PROCESS OVERNIGHT FLIGHTS BUTTON WURDE GEKLICKT ***");

			// Button temporär deaktivieren und Text ändern
			processOvernightFlightsBtn.disabled = true;
			const originalText = processOvernightFlightsBtn.textContent;
			processOvernightFlightsBtn.textContent = "Processing...";

			// Status-Panel anzeigen und aktualisieren
			const statusPanel = document.getElementById("overnightFlightsStatus");
			const statusMessage = document.getElementById("overnightFlightsMessage");
			if (statusPanel) {
				statusPanel.style.display = "block";
				if (statusMessage) {
					statusMessage.textContent = "Starting overnight flights analysis...";
				}
			}

			try {
				// Hole Flughafen-Code
				const airportCodeInput = document.getElementById("airportCodeInput");
				const airportCode =
					airportCodeInput?.value.trim().toUpperCase() || "MUC";

				// Hole Datum
				const currentDateInput = document.getElementById("currentDateInput");
				const nextDateInput = document.getElementById("nextDateInput");
				const currentDate =
					currentDateInput?.value || new Date().toISOString().split("T")[0];
				const nextDate =
					nextDateInput?.value ||
					new Date(Date.now() + 24 * 60 * 60 * 1000)
						.toISOString()
						.split("T")[0];

				console.log(
					`Starte Overnight Flights Processing für ${airportCode} vom ${currentDate} bis ${nextDate}`
				);

				// Status aktualisieren
				if (statusMessage) {
					statusMessage.textContent = `Analyzing flights for ${airportCode} from ${currentDate} to ${nextDate}`;
				}
				// Use the new correct airport-first approach from AeroDataBoxAPI
				if (
					window.AeroDataBoxAPI &&
					window.AeroDataBoxAPI.processOvernightFlightsCorrectly
				) {
					console.log("🏢 Using correct airport-first overnight processing approach");
					
					// Call the new correct overnight processing function
					const result = await window.AeroDataBoxAPI.processOvernightFlightsCorrectly(
						airportCode,
						currentDate,
						nextDate
					);

					if (result && result.success) {
						console.log(
							"✅ Airport-first Overnight Flights Processing completed successfully"
						);

						// Status aktualisieren with detailed results
						if (statusMessage) {
							statusMessage.textContent = `Processing completed: ${result.overnightAircraft} overnight aircraft found, ${result.tilesMatched} tiles updated`;
						}

						// Show success notification with details
						if (window.showNotification) {
							window.showNotification(
								`Airport-first processing complete: ${result.overnightAircraft} overnight aircraft discovered from ${result.totalFlights} total flights at ${result.airport}`,
								"success"
							);
						}

						// Log detailed results for debugging
						console.log("📊 Processing Results:", {
							airport: result.airport,
							timeframe: result.timeframe,
							totalFlights: result.totalFlights,
							discoveredAircraft: result.discoveredAircraft,
							overnightAircraft: result.overnightAircraft,
							tilesMatched: result.tilesMatched,
							tilesCleared: result.tilesCleared
						});

					} else {
						console.error("❌ Airport-first Overnight Flights Processing failed");
						if (result && result.error) {
							console.error("Error details:", result.error);
						}

						// Status aktualisieren
						if (statusMessage) {
							statusMessage.textContent = result && result.error 
								? `❌ Processing failed: ${result.error}`
								: "❌ Processing failed - check console for details";
						}

						if (window.showNotification) {
							const errorMsg = result && result.error 
								? `Airport-first processing failed: ${result.error}`
								: "Airport-first processing failed. Check console for details.";
							window.showNotification(errorMsg, "error");
						}
					}
				} else {
					console.error(
						"❌ AeroDataBoxAPI or processOvernightFlightsCorrectly function not available!"
					);

					// Status aktualisieren
					if (statusMessage) {
						statusMessage.textContent =
							"❌ AeroDataBox API overnight processing not available";
					}

					if (window.showNotification) {
						window.showNotification(
							"Overnight Flight Processing not available. Please check if aerodatabox-api.js is loaded correctly.",
							"error"
						);
					}
				}
			} catch (error) {
				console.error("❌ Fehler beim Overnight Flights Processing:", error);

				// Status aktualisieren
				if (statusMessage) {
					statusMessage.textContent = `❌ Error: ${error.message}`;
				}

				if (window.showNotification) {
					window.showNotification(
						`Overnight Flight Processing error: ${error.message}`,
						"error"
					);
				}
			} finally {
				// Button wieder aktivieren
				processOvernightFlightsBtn.disabled = false;
				processOvernightFlightsBtn.textContent = originalText;

				// Status-Panel nach 5 Sekunden ausblenden
				setTimeout(() => {
					if (statusPanel) {
						statusPanel.style.display = "none";
					}
				}, 5000);
			}
		};

		console.log(
			"✅ Event-Handler für Process Overnight Flights Button erfolgreich registriert"
		);
	} else {
		console.error("❌ Process Overnight Flights Button nicht gefunden!");
	}

	// Event-Handler für API-Provider Dropdown zur Anzeige von Hilfetexten
	const apiProviderSelect = document.getElementById("apiProviderSelect");
	if (apiProviderSelect) {
		apiProviderSelect.addEventListener("change", function () {
			const statusPanel = document.getElementById("overnightFlightsStatus");
			const statusMessage = document.getElementById("overnightFlightsMessage");

			if (this.value === "overnight-flights") {
				// Zeige Hilfetext für Overnight Flights Processing
				if (statusPanel && statusMessage) {
					statusPanel.style.display = "block";
					statusMessage.textContent =
						"💡 Use 'Process Overnight Flights' button to analyze aircraft staying overnight";
				}
			} else {
				// Verstecke Panel bei anderen API-Optionen
				if (statusPanel) {
					statusPanel.style.display = "none";
				}
			}
		});
	}

	// Scheduled update controls (Time interval + Set active)
	const scheduledToggle = document.getElementById("scheduledUpdateToggle");
	const intervalInput = document.getElementById("updateIntervalInput");

	function getIntervalMs() {
		const minutes = parseInt(intervalInput?.value || "15", 10);
		if (isNaN(minutes) || minutes < 1) return 60 * 1000; // 1 min min
		return minutes * 60 * 1000;
	}

	function triggerOvernightUpdate() {
		const btn = document.getElementById("fetchFlightData");
		if (btn) {
			btn.click();
		}
	}

	function startScheduledUpdate() {
		stopScheduledUpdate();
		const ms = getIntervalMs();
		window.__overnightScheduleTimer = setInterval(triggerOvernightUpdate, ms);
		// Fire once immediately
		triggerOvernightUpdate();
		const status = document.getElementById("fetchStatus");
		if (status) {
			status.textContent = `Scheduled update active (every ${Math.round(ms/60000)} min)`;
		}
	}

	function stopScheduledUpdate() {
		if (window.__overnightScheduleTimer) {
			clearInterval(window.__overnightScheduleTimer);
			window.__overnightScheduleTimer = null;
		}
		const status = document.getElementById("fetchStatus");
		if (status) {
			status.textContent = "Ready to update overnight flights";
		}
	}

	if (scheduledToggle) {
		scheduledToggle.addEventListener("change", function () {
			if (this.checked) {
				startScheduledUpdate();
			} else {
				stopScheduledUpdate();
			}
		});
	}
	if (intervalInput) {
		intervalInput.addEventListener("change", function () {
			if (scheduledToggle?.checked) {
				startScheduledUpdate();
			}
		});
	}

// Wire Display submenu: Reset screen (confirm and clear all tile inputs except Hangar Position)
const resetScreenBtn = document.getElementById('resetScreenBtn');
if (resetScreenBtn) {
	resetScreenBtn.addEventListener('click', function(e){
		e.preventDefault();
		const ok = window.confirm('Reset screen?\n\nThis will:\n• clear all per-tile update timestamps\n• reset all tile inputs (Aircraft, Arr/Dep, Pos/Route, Notes, Tow, Status)\n• keep Hangar Position inputs unchanged');
		if (!ok) return;
		try {
			// 1) Clear all update badges and persisted meta
			if (window.LastUpdateBadges && typeof window.LastUpdateBadges.clearAll === 'function') {
				window.LastUpdateBadges.clearAll();
			}

			// 2) Reset inputs for all tiles (primary and secondary), except Hangar Position
			const tiles = document.querySelectorAll('#hangarGrid .hangar-cell, #secondaryHangarGrid .hangar-cell');
			tiles.forEach(tile => {
				// Clear aircraft id
				tile.querySelectorAll('input[id^="aircraft-"]').forEach(el => { el.value = ''; });
				// Clear times
				tile.querySelectorAll('input[id^="arrival-time-"]').forEach(el => { el.value = ''; });
				tile.querySelectorAll('input[id^="departure-time-"]').forEach(el => { el.value = ''; });
				// Clear route/position (Pos in info grid)
				tile.querySelectorAll('input[id^="position-"]').forEach(el => { el.value = ''; });
				// Notes
				tile.querySelectorAll('textarea[id^="notes-"]').forEach(el => { el.value = ''; });
				// Tow status -> neutral
				tile.querySelectorAll('select[id^="tow-status-"]').forEach(sel => {
					sel.value = 'neutral';
					if (window.updateTowStatusStyles) window.updateTowStatusStyles(sel);
				});
			});

			// 3) Reset tile status selectors and lights to neutral
			if (typeof resetAllTilesToNeutral === 'function') {
				resetAllTilesToNeutral();
			} else {
				// Fallback
				document.querySelectorAll('.status-selector').forEach(sel => {
					sel.value = 'neutral';
					if (window.updateStatusLight) window.updateStatusLight(sel);
				});
			}

			// 4) Inform user
			if (window.showNotification) window.showNotification('Screen reset completed', 'success');
		} catch (err) {
			console.warn('Reset screen failed:', err);
			if (window.showNotification) window.showNotification('Reset failed', 'error');
		}
	});
}

// Rehydrate badges from localStorage on load
	try {
		if (window.LastUpdateBadges && typeof window.LastUpdateBadges.reattachAll === 'function') {
			window.LastUpdateBadges.reattachAll();
		}
	} catch (e) { console.warn('Badge rehydrate failed:', e); }
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
			// console.log(`✅ Skript '${script.name}' erfolgreich geladen`);
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
	// console.log("Modul-Status:", window.moduleStatus);

	// DOM-Elemente überprüfen
	const criticalElements = [
		"hangarGrid",
		"secondaryHangarGrid",
		"modeToggle",
	];

	// console.log("Kritische DOM-Elemente:");
	criticalElements.forEach((id) => {
		const element = document.getElementById(id);
		// console.log(`${id}: ${element ? "Gefunden" : "FEHLT"}`);
	});

	console.groupEnd();
}

// Event-Listener für DOMContentLoaded hinzufügen
document.addEventListener("DOMContentLoaded", function () {
	// console.log("DOM vollständig geladen - starte Initialisierung...");

	// Helpers-Modul als geladen markieren, wenn verfügbar
	if (window.helpers || window.showNotification) {
		window.moduleStatus.helpers = true;
	}

	// Event-Handler für Save/Load-Buttons einrichten
	setupSaveLoadEventHandlers();

	// Project Name beim Start automatisch setzen
	setTimeout(() => {
		initializeProjectName();
	}, 500);

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
			// console.log(
			// 	`Alle kritischen Module nach ${attempts + 1} Versuchen verfügbar`
			// );
			initializeApp();
		} else {
			// console.log(
			// 	`Versuch ${attempts + 1}/${maxAttempts}: Warte auf Module...`
			// );
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

	// console.log(
	// 	"Status-Synchronisation zwischen fetchStatus und header-status eingerichtet"
	// );
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

/**
 * Überprüft, ob ein Flugzeug aus der Fleet Database ausgewählt wurde
 * und fügt es automatisch zur ersten freien Kachel hinzu
 */
async function checkForSelectedAircraft() {
	const selectedAircraft = localStorage.getItem("selectedAircraft");

	if (selectedAircraft) {
		console.log(`🛩️ Flugzeug aus Auswahl erkannt: ${selectedAircraft}`);
		const selectedArr = localStorage.getItem("selectedArrivalTime") || "";
		const selectedDep = localStorage.getItem("selectedDepartureTime") || "";

		// Hilfsfunktion: Position-Label einer Kachel ermitteln
		function getPositionLabelForTileId(id){
			const posElPrimary = document.getElementById(`hangar-position-${id}`);
			const posElAlt     = document.getElementById(`position-${id}`);
			const primaryVal   = (posElPrimary?.value || '').trim();
			const altVal       = (posElAlt?.value || '').trim();
			const primaryPh    = (posElPrimary?.getAttribute?.('placeholder') || '').trim();
			const altPh        = (posElAlt?.getAttribute?.('placeholder') || '').trim();

			// Primary tiles (1..12) may rely on placeholder labels like "1A" if no explicit value set.
			const isPrimary = Number.isFinite(id) && id >= 1 && id <= 12;

			if (primaryVal) return primaryVal;
			if (altVal) return altVal;

			if (isPrimary) {
				// Only for primary tiles, allow placeholder if meaningful (and not generic like "--").
				if (primaryPh) return primaryPh;
				if (altPh && altPh !== '--') return altPh;
			}

			// For secondary or missing labels, fall back to the numeric tile id
			return `#${id}`;
		}

		// Hilfsfunktion: alle freien (leeren) sichtbaren Kacheln sammeln (nur primär)
		function getFreeTilesWithLabels() {
			const list = [];
			const inputs = document.querySelectorAll('#hangarGrid .hangar-cell input[id^="aircraft-"], #secondaryHangarGrid .hangar-cell input[id^="aircraft-"]');
			inputs.forEach((inp) => {
				const idMatch = inp.id.match(/aircraft-(\d+)/);
				if (!idMatch) return;
				const cellId = parseInt(idMatch[1], 10);
				const cell = inp.closest('.hangar-cell');
				if (!cell) return;
				const style = window.getComputedStyle ? window.getComputedStyle(cell) : cell.style;
				// Robust visibility: hidden class, display/visibility, or no client rects
				const isHidden = cell.classList.contains('hidden') || style.display === 'none' || style.visibility === 'hidden' || cell.getClientRects().length === 0;
				const isEmpty = !inp.value || inp.value.trim() === '';
				if (!isHidden && isEmpty) {
					list.push({ id: cellId, label: getPositionLabelForTileId(cellId) });
				}
			});
			// Dedup by id (guard against unexpected DOM duplication)
			const byId = new Map();
			list.forEach(item => { if (!byId.has(item.id)) byId.set(item.id, item); });
			// Sort: primary (1..12) first, then secondary (>=101), by id
			return Array.from(byId.values()).sort((a,b)=>{
				const ap = a.id >= 101 ? 1 : 0;
				const bp = b.id >= 101 ? 1 : 0;
				if (ap !== bp) return ap - bp;
				return a.id - b.id;
			});
		}

		// Hilfsfunktion: ermittelt die Kachel-ID anhand des Positionslabels (z. B. "1B")
		function resolveTileIdByLabel(label){
			if (!label) return null;
			for (let i = 1; i <= 12; i++) {
				if (getPositionLabelForTileId(i) === label) return i;
			}
			return null;
		}

		function clearSelection() {
			localStorage.removeItem("selectedAircraft");
			localStorage.removeItem("selectedArrivalTime");
			localStorage.removeItem("selectedDepartureTime");
			localStorage.removeItem("selectedAircraftPrompt");
		}

		function finalizeInsert(tileId) {
			const aircraftInput = document.getElementById(`aircraft-${tileId}`);
			if (aircraftInput) {
				aircraftInput.value = selectedAircraft;
				// Zeiten setzen, falls vorhanden — konvertiere HH:mm/compact → ISO → kompakte Anzeige
				const h = window.helpers || {};
				if (selectedArr) {
					const arrEl = document.getElementById(`arrival-time-${tileId}`);
					if (arrEl) {
						let iso = '';
						if (h.isISODateTimeLocal && h.isISODateTimeLocal(selectedArr)) {
							iso = selectedArr;
						} else if (h.isHHmm && h.isHHmm(selectedArr) && h.getBaseDates && h.coerceHHmmToDateTimeLocalUtc) {
							const bases = h.getBaseDates();
							iso = h.coerceHHmmToDateTimeLocalUtc(selectedArr, (bases && bases.arrivalBase) || '');
						} else if (h.isCompactDateTime && h.isCompactDateTime(selectedArr) && h.parseCompactToISOUTC) {
							iso = h.parseCompactToISOUTC(selectedArr);
						}
						// Auf kompakte Anzeige setzen, falls ISO berechnet
						if (iso && h.formatISOToCompactUTC) {
							arrEl.value = h.formatISOToCompactUTC(iso);
							arrEl.dataset.iso = iso;
						} else {
							// Fallback: rohen Wert setzen
							arrEl.value = selectedArr;
						}
					}
				}
				if (selectedDep) {
					const depEl = document.getElementById(`departure-time-${tileId}`);
					if (depEl) {
						let iso = '';
						if (h.isISODateTimeLocal && h.isISODateTimeLocal(selectedDep)) {
							iso = selectedDep;
						} else if (h.isHHmm && h.isHHmm(selectedDep) && h.getBaseDates && h.coerceHHmmToDateTimeLocalUtc) {
							const bases = h.getBaseDates();
							iso = h.coerceHHmmToDateTimeLocalUtc(selectedDep, (bases && bases.departureBase) || '');
						} else if (h.isCompactDateTime && h.isCompactDateTime(selectedDep) && h.parseCompactToISOUTC) {
							iso = h.parseCompactToISOUTC(selectedDep);
						}
						if (iso && h.formatISOToCompactUTC) {
							depEl.value = h.formatISOToCompactUTC(iso);
							depEl.dataset.iso = iso;
						} else {
							depEl.value = selectedDep;
						}
					}
				}

				// Event auslösen für weitere Verarbeitung (z.B. Flugdaten abrufen)
				// Persist via event-manager/local storage (immediate + debounced)
				try {
					if (window.hangarEventManager) {
						if (typeof window.hangarEventManager.updateFieldInStorage === 'function') {
							window.hangarEventManager.updateFieldInStorage(`aircraft-${tileId}`, aircraftInput.value);
						}
						if (typeof window.hangarEventManager.debouncedFieldUpdate === 'function') {
							window.hangarEventManager.debouncedFieldUpdate(`aircraft-${tileId}`, aircraftInput.value, 50);
						}
					}
					// Fire input/blur to trigger any listeners hooked elsewhere
					aircraftInput.dispatchEvent(new Event('input', { bubbles: true }));
					aircraftInput.dispatchEvent(new Event('blur', { bubbles: true }));
				} catch (e) { /* noop */ }

				if (window.hangarEvents && window.hangarEvents.handleAircraftIdChange) {
					window.hangarEvents.handleAircraftIdChange(
						`aircraft-${tileId}`,
						selectedAircraft
					);
				}

				// Also persist times
				try {
					const arrId = `arrival-time-${tileId}`;
					const depId = `departure-time-${tileId}`;
					const arrEl = document.getElementById(arrId);
					const depEl = document.getElementById(depId);
					if (arrEl) {
						const val = arrEl.dataset?.iso || arrEl.value || '';
						if (window.hangarEventManager) {
							if (typeof window.hangarEventManager.updateFieldInStorage === 'function') {
								window.hangarEventManager.updateFieldInStorage(arrId, val);
							}
							if (typeof window.hangarEventManager.debouncedFieldUpdate === 'function') {
								window.hangarEventManager.debouncedFieldUpdate(arrId, val, 50);
							}
						}
						arrEl.dispatchEvent(new Event('input', { bubbles: true }));
						arrEl.dispatchEvent(new Event('blur', { bubbles: true }));
					}
					if (depEl) {
						const val = depEl.dataset?.iso || depEl.value || '';
						if (window.hangarEventManager) {
							if (typeof window.hangarEventManager.updateFieldInStorage === 'function') {
								window.hangarEventManager.updateFieldInStorage(depId, val);
							}
							if (typeof window.hangarEventManager.debouncedFieldUpdate === 'function') {
								window.hangarEventManager.debouncedFieldUpdate(depId, val, 50);
							}
						}
						depEl.dispatchEvent(new Event('input', { bubbles: true }));
						depEl.dispatchEvent(new Event('blur', { bubbles: true }));
					}
				} catch (e) { /* noop */ }

				// Optional: trigger a quick server sync if available and in master mode
				try {
					if (window.serverSync && window.serverSync.isMaster && typeof window.serverSync.manualSync === 'function') {
						setTimeout(() => window.serverSync.manualSync(), 200);
					}
				} catch (e) { /* noop */ }

				if (window.showNotification) {
					const timeInfo = (selectedArr || selectedDep) ? ` (Arr: ${selectedArr || '--'} | Dep: ${selectedDep || '--'})` : '';
					window.showNotification(`${selectedAircraft} → Kachel ${tileId}${timeInfo}`, 'success');
				}
				console.log(`✅ ${selectedAircraft} zu Kachel ${tileId} hinzugefügt (Arr: ${selectedArr}, Dep: ${selectedDep})`);
				// Create/update last-update badge for subpage insertion
				if (window.createOrUpdateLastUpdateBadge) {
					window.createOrUpdateLastUpdateBadge(tileId, 'subpage');
				}
			}
			clearSelection();
		}

		function showTileSelectionModal(freeTiles) {
			// Support both: array of numbers OR array of {id,label}
			const normalized = (freeTiles || []).map(item => {
				if (typeof item === 'number') {
					return { id: item, label: getPositionLabelForTileId(item) };
				}
				return { id: item.id, label: item.label || getPositionLabelForTileId(item.id) };
			}).sort((a,b)=>{
				const ap = a.id >= 101 ? 1 : 0;
				const bp = b.id >= 101 ? 1 : 0;
				if (ap !== bp) return ap - bp;
				return a.id - b.id;
			});

			// Overlay
			const overlay = document.createElement('div');
			overlay.id = 'tileSelectionOverlay';
			overlay.className = 'fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50';

			// Modal panel styled like submenu
			const modal = document.createElement('div');
			modal.className = 'bg-white rounded-lg p-5 w-full max-w-md border';
			modal.style.border = '1px solid var(--menu-border)';
			modal.style.color = 'var(--menu-text)';

			// Header
			const title = document.createElement('div');
			title.className = 'submenu-title';
			title.textContent = 'Kachel auswählen';

			const subtitle = document.createElement('div');
			subtitle.className = 'text-xs mb-4';
			subtitle.style.color = '#6b6b6b';
			subtitle.innerHTML = `<div><span class=\"font-semibold\">Reg:</span> ${selectedAircraft}</div>` +
				(selectedArr || selectedDep ? `<div><span class=\"font-semibold\">Arr:</span> ${selectedArr || '--'} &nbsp;&nbsp; <span class=\"font-semibold\">Dep:</span> ${selectedDep || '--'}</div>` : '');

			// Section label
			const sectionLabel = document.createElement('div');
			sectionLabel.className = 'section-label';
			sectionLabel.style.marginBottom = '8px';
			sectionLabel.textContent = normalized.length > 0 ? 'Freie Kacheln' : 'Keine freien Kacheln';

			// Grid of free tiles
			const grid = document.createElement('div');
			grid.className = 'grid grid-cols-4 gap-2 mb-4';
			if (normalized.length > 0) {
				normalized.forEach(({id, label}) => {
					const btn = document.createElement('button');
					btn.className = 'sidebar-btn sidebar-btn-primary';
					btn.style.minHeight = '32px';
					btn.style.padding = '0 10px';
					btn.style.fontSize = '12px';
					btn.dataset.tileId = String(id);
					btn.dataset.posLabel = label;
					btn.textContent = label || `#${id}`;
					btn.title = `Kachel #${id}${label ? ` • Position: ${label}` : ''}`;
					btn.addEventListener('click', (e) => {
						const target = e.currentTarget;
						const tid = parseInt(target.dataset.tileId, 10);
						finalizeInsert(tid);
						document.body.removeChild(overlay);
					});
					grid.appendChild(btn);
				});
			} else {
				const hint = document.createElement('div');
				hint.className = 'text-xs';
				hint.style.color = '#6b6b6b';
				hint.textContent = 'Bitte geben Sie eine Kachelnummer ein (1–12), diese wird überschrieben.';
				grid.appendChild(hint);
			}

			// Manual entry row
			const manualRow = document.createElement('div');
			manualRow.className = 'flex items-center gap-2 mb-4';
			const manualLabel = document.createElement('label');
			manualLabel.className = 'text-xs font-semibold';
			manualLabel.setAttribute('for','tileManualInput');
			manualLabel.textContent = 'Andere Kachel-ID';
			const manualInput = document.createElement('input');
			manualInput.id = 'tileManualInput';
			manualInput.type = 'number';
			manualInput.min = '1';
			manualInput.placeholder = 'z.B. 1 oder 101';
			manualInput.className = 'sidebar-form-control';
			manualInput.style.width = '110px';
			const manualBtn = document.createElement('button');
			manualBtn.className = 'sidebar-btn sidebar-btn-primary';
			manualBtn.style.minHeight = '32px';
			manualBtn.style.fontSize = '12px';
			manualBtn.textContent = 'Einfügen';
			manualBtn.addEventListener('click', () => {
				const v = parseInt((manualInput.value || '').trim(), 10);
				const exists = !isNaN(v) && !!document.getElementById(`aircraft-${v}`);
				if (exists) {
					finalizeInsert(v);
					document.body.removeChild(overlay);
				} else {
					if (window.showNotification) {
						window.showNotification('Bitte gültige vorhandene Kachel-ID eingeben (z.B. 1..12 oder 101..)', 'warning');
					}
				}
			});
			manualRow.appendChild(manualLabel);
			manualRow.appendChild(manualInput);
			manualRow.appendChild(manualBtn);

			// Footer
			const footer = document.createElement('div');
			footer.className = 'flex justify-end gap-2';
			const cancelBtn = document.createElement('button');
			cancelBtn.className = 'sidebar-btn sidebar-btn-secondary';
			cancelBtn.style.minHeight = '32px';
			cancelBtn.style.fontSize = '12px';
			cancelBtn.textContent = 'Abbrechen';
			cancelBtn.addEventListener('click', () => {
				document.body.removeChild(overlay);
				clearSelection();
			});
			footer.appendChild(cancelBtn);

			// Compose modal
			modal.appendChild(title);
			modal.appendChild(subtitle);
			modal.appendChild(sectionLabel);
			modal.appendChild(grid);
			modal.appendChild(manualRow);
			modal.appendChild(footer);

			overlay.appendChild(modal);
			document.body.appendChild(overlay);

			// Close behaviors
			overlay.addEventListener('click', (e) => {
				if (e.target === overlay) {
					document.body.removeChild(overlay);
					clearSelection();
				}
			});
			document.addEventListener('keydown', function escListener(ev){
				if (ev.key === 'Escape') {
					try { document.body.removeChild(overlay); } catch {}
					clearSelection();
					document.removeEventListener('keydown', escListener);
				}
			});
		}

		// Warte, bis die Tiles stabil befüllt sind (z. B. nach Server/Local-Load)
		await (async function waitForStableTiles(){
			const start = Date.now();
			let lastSnapshot = Array.from(document.querySelectorAll('#hangarGrid input[id^="aircraft-"]')).map(el => el.value || '');
			let stableSince = Date.now();
			const maxWait = 3500; // ms
			const stableWindow = 450; // ms ohne Änderungen
			return new Promise((resolve) => {
				const collectSnap = () => Array.from(document.querySelectorAll('#hangarGrid input[id^="aircraft-"], #secondaryHangarGrid input[id^="aircraft-"]')).map(el => el.value || '');
				const tick = () => {
					const applying = !!(window.isApplyingServerData || window.serverSync?.isApplyingServerData);
					const nowValues = collectSnap();
					const changed = nowValues.length !== lastSnapshot.length || nowValues.some((v, i) => v !== lastSnapshot[i]);
					if (changed) {
						lastSnapshot = nowValues;
						stableSince = Date.now();
					}
					const stableEnough = (Date.now() - stableSince) >= stableWindow;
					if (!applying && stableEnough) return resolve();
					if ((Date.now() - start) >= maxWait) return resolve();
					setTimeout(tick, 120);
				};
				tick();
			});
		})();

		// Zeige modalen Dialog im Projektstil (nachdem Tile-Werte stabil sind)
		const freeTiles = getFreeTilesWithLabels();
		showTileSelectionModal(freeTiles);
	}
}

// Lightweight local rehydration: apply values from localStorage (hangarPlannerData) into empty fields only
(function setupLocalRehydrate(){
	function rehydrateLocalFieldsIfEmpty(){
		try {
			const raw = localStorage.getItem('hangarPlannerData');
			if (!raw) return;
			const data = JSON.parse(raw);
			if (!data || typeof data !== 'object') return;
			const h = window.helpers || {};
			Object.keys(data).forEach(key => {
				if (!/^(aircraft|arrival-time|departure-time|position|hangar-position|notes|status|tow-status)-(\d+)$/.test(key)) return;
				const el = document.getElementById(key);
				if (!el) return;
				// Only fill if currently empty or neutral (for selects)
				const isSelect = el.tagName === 'SELECT';
				const current = (el.value || '').trim();
				const target = data[key] || '';
				if (isSelect) {
					if (!current || current === 'neutral') {
						el.value = target;
						if (key.startsWith('status-') && window.updateStatusLights) {
							const cellId = parseInt(key.replace('status-',''),10);
							if (!isNaN(cellId)) window.updateStatusLights(cellId);
						}
					}
				} else if (!current) {
					if (key.startsWith('arrival-time-') || key.startsWith('departure-time-')) {
						let iso = target;
						if (iso && h.formatISOToCompactUTC && h.isISODateTimeLocal && h.isISODateTimeLocal(iso)) {
							el.value = h.formatISOToCompactUTC(iso);
							el.dataset.iso = iso;
						} else {
							el.value = target;
						}
					} else {
						el.value = target;
					}
				}
			});
		} catch (e) {
			console.warn('Local rehydrate failed:', e);
		}
	}
	// Schedule after initial app setup so we don't override server-applied values; only empties are filled
	window.hangarInitQueue = window.hangarInitQueue || [];
	window.hangarInitQueue.push(function(){ setTimeout(rehydrateLocalFieldsIfEmpty, 2400); });
})();

/**
 * Findet die erste freie Kachel (ohne Aircraft ID)
 * @returns {number|null} Kachel-Nummer oder null wenn keine freie Kachel gefunden
 */
function findFirstEmptyTile() {
	// Primäre Kacheln überprüfen (1-12)
	for (let i = 1; i <= 12; i++) {
		const aircraftInput = document.getElementById(`aircraft-${i}`);
		if (
			aircraftInput &&
			(!aircraftInput.value || aircraftInput.value.trim() === "")
		) {
			return i;
		}
	}

	// Sekundäre Kacheln überprüfen (falls vorhanden)
	for (let i = 13; i <= 24; i++) {
		const aircraftInput = document.getElementById(`aircraft-${i}`);
		if (
			aircraftInput &&
			(!aircraftInput.value || aircraftInput.value.trim() === "")
		) {
			return i;
		}
	}

	return null; // Keine freie Kachel gefunden
}

// Automatisches Auslösen der Auswahlverarbeitung nach Navigation von Timetable/Fleet
// Führt checkForSelectedAircraft genau einmal aus, sobald die Kacheln bereit sind
(function setupSelectedAircraftAutostart() {
	// Nur aktiv werden, wenn es überhaupt eine Auswahl gibt
	if (!localStorage.getItem("selectedAircraft")) return;

	let ran = false;
	let attempts = 0;
	const maxAttempts = 25; // ~5s bei 200ms Intervall

	function tilesReady() {
		return document.querySelector(
			'#hangarGrid input[id^="aircraft-"], #secondaryHangarGrid input[id^="aircraft-"]'
		);
	}

	function runOnceWhenReady() {
		if (ran) return;
		if (!tilesReady()) {
			attempts++;
			if (attempts > maxAttempts) {
				// Als letzte Option trotzdem ausführen
				try {
					if (typeof checkForSelectedAircraft === "function") {
						checkForSelectedAircraft();
					}
				} catch (e) {
					console.error("checkForSelectedAircraft fehlgeschlagen", e);
				}
				ran = true;
				return;
			}
			setTimeout(runOnceWhenReady, 200);
			return;
		}
		ran = true;
		setTimeout(() => {
			try {
				if (typeof checkForSelectedAircraft === "function") {
					checkForSelectedAircraft();
				}
			} catch (e) {
				console.error("checkForSelectedAircraft fehlgeschlagen", e);
			}
		}, 50);
	}

	function schedule() {
		// Explizite Startverzögerung nach Seitenladen, damit Werte/Placeholders sicher gerendert sind
		setTimeout(runOnceWhenReady, 700);
	}

	// Also re-run when tile data has been applied from storage/server
	document.addEventListener("dataLoaded", () => {
		// Give the UI a brief moment to render values before detection
		setTimeout(runOnceWhenReady, 250);
	}, { once: true });

	// If secondary tiles are created dynamically, re-check afterwards
	document.addEventListener("secondaryTilesCreated", () => {
		setTimeout(runOnceWhenReady, 250);
	}, { once: true });

	if (document.readyState === "complete" || document.readyState === "interactive") {
		schedule();
	} else {
		document.addEventListener("DOMContentLoaded", schedule, { once: true });
	}

	window.addEventListener("load", () => setTimeout(runOnceWhenReady, 150));
	document.addEventListener("visibilitychange", () => {
		if (document.visibilityState === "visible") runOnceWhenReady();
	});
})();
