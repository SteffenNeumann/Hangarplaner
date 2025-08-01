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
				// Statt der UI-Funktion die neue Events-Funktion verwenden
				if (
					window.hangarEvents &&
					window.hangarEvents.initializeSidebarToggle
				) {
					window.hangarEvents.initializeSidebarToggle();
				}
				// Accordion wird jetzt direkt über onclick-Attribute gesteuert
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
			window.FlightDataAPI.setProvider(newProvider);
			// console.log(`API-Provider geändert auf: ${newProvider}`);
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
	} else if (window.hangarUI && window.hangarUI.uiSettings && window.hangarUI.uiSettings.load) {
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
		"menuToggle",
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
function checkForSelectedAircraft() {
	const selectedAircraft = localStorage.getItem('selectedAircraft');
	
	if (selectedAircraft) {
		console.log(`🛩️ Flugzeug aus Fleet Database erkannt: ${selectedAircraft}`);
		
		// Erste freie Kachel finden
		const firstEmptyTile = findFirstEmptyTile();
		
		if (firstEmptyTile) {
			// Aircraft ID in die erste freie Kachel eintragen
			const aircraftInput = document.getElementById(`aircraft-${firstEmptyTile}`);
			if (aircraftInput) {
				aircraftInput.value = selectedAircraft;
				
				// Benachrichtigung anzeigen
				if (window.showNotification) {
					window.showNotification(
						`${selectedAircraft} wurde zu Kachel ${firstEmptyTile} hinzugefügt`,
						'success'
					);
				}
				
				// Event auslösen für weitere Verarbeitung (z.B. Flugdaten abrufen)
				if (window.hangarEvents && window.hangarEvents.handleAircraftIdChange) {
					window.hangarEvents.handleAircraftIdChange(`aircraft-${firstEmptyTile}`, selectedAircraft);
				}
				
				console.log(`✅ ${selectedAircraft} zu Kachel ${firstEmptyTile} hinzugefügt`);
			}
		} else {
			// Keine freie Kachel gefunden
			if (window.showNotification) {
				window.showNotification(
					`${selectedAircraft} aus Fleet Database: Keine freie Kachel verfügbar`,
					'warning'
				);
			}
			console.warn(`⚠️ Keine freie Kachel für ${selectedAircraft} gefunden`);
		}
		
		// selectedAircraft aus localStorage entfernen
		localStorage.removeItem('selectedAircraft');
	}
}

/**
 * Findet die erste freie Kachel (ohne Aircraft ID)
 * @returns {number|null} Kachel-Nummer oder null wenn keine freie Kachel gefunden
 */
function findFirstEmptyTile() {
	// Primäre Kacheln überprüfen (1-12)
	for (let i = 1; i <= 12; i++) {
		const aircraftInput = document.getElementById(`aircraft-${i}`);
		if (aircraftInput && (!aircraftInput.value || aircraftInput.value.trim() === '')) {
			return i;
		}
	}
	
	// Sekundäre Kacheln überprüfen (falls vorhanden)
	for (let i = 13; i <= 24; i++) {
		const aircraftInput = document.getElementById(`aircraft-${i}`);
		if (aircraftInput && (!aircraftInput.value || aircraftInput.value.trim() === '')) {
			return i;
		}
	}
	
	return null; // Keine freie Kachel gefunden
}
