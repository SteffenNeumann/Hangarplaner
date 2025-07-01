/**
 * hangar-events.js
 * Enthält Event-Handler für die HangarPlanner-Anwendung
 * Verantwortlich für die Verarbeitung von Benutzerinteraktionen und UI-Events
 */

/**
 * Initialisiert alle Event-Listener für die UI-Elemente
 */
function setupUIEventListeners() {
	try {
		// Mode-Toggle für Ansichts-/Bearbeitungsmodus
		const modeToggle = document.getElementById("modeToggle");
		if (modeToggle) {
			modeToggle.addEventListener("change", toggleEditMode);
		}

		// DEPRECATED: Layout-Wechsel-Handler wird jetzt von display-options.js verwaltet
		/* OLD CODE
		const layoutType = document.getElementById("layoutType");
		if (layoutType) {
			layoutType.addEventListener("change", function () {
				window.hangarUI.uiSettings.layout = parseInt(this.value);
				window.hangarUI.uiSettings.apply();
			});
		}
		*/

		// DEPRECATED: Primary Tiles Update-Handler wird jetzt von display-options.js verwaltet
		/* OLD CODE
		const updateTilesBtn = document.getElementById("updateTilesBtn");
		if (updateTilesBtn) {
			updateTilesBtn.addEventListener("click", function () {
				const tilesCount = document.getElementById("tilesCount").value;
				window.hangarUI.uiSettings.tilesCount = parseInt(tilesCount);
				window.hangarUI.uiSettings.apply();

				// Nach dem Anwenden auch die Einstellungen im localStorage speichern
				try {
					if (
						window.hangarUI &&
						window.hangarUI.uiSettings &&
						typeof window.hangarUI.uiSettings.save === "function"
					) {
						window.hangarUI.uiSettings.save();
					} else {
						// Fallback: Direkt in localStorage speichern
						const settingsData = {
							tilesCount: parseInt(tilesCount) || 8,
							secondaryTilesCount:
								window.hangarUI.uiSettings.secondaryTilesCount || 0,
							layout: window.hangarUI.uiSettings.layout || 4,
							lastSaved: new Date().toISOString(),
						};
						localStorage.setItem(
							"hangarPlannerSettings",
							JSON.stringify(settingsData)
						);
					}
					console.log(
						"Primäre Kacheln aktualisiert und gespeichert:",
						tilesCount
					);
				} catch (error) {
					console.error("Fehler beim Speichern der Einstellungen:", error);
					// Trotz Fehler eine Erfolgsmeldung anzeigen, damit der Benutzer nicht verunsichert wird
					console.log(
						"Primäre Kacheln aktualisiert (ohne Speicherung):",
						tilesCount
					);
				}
			});
		}
		*/

		// DEPRECATED: Secondary Tiles Update-Handler wird jetzt von display-options.js verwaltet
		/* OLD CODE
		const updateSecondaryTilesBtn = document.getElementById(
			"updateSecondaryTilesBtn"
		);
		if (updateSecondaryTilesBtn) {
			updateSecondaryTilesBtn.addEventListener("click", function () {
				const secondaryTilesCount = document.getElementById(
					"secondaryTilesCount"
				).value;
				window.hangarUI.uiSettings.secondaryTilesCount =
					parseInt(secondaryTilesCount);
				window.hangarUI.uiSettings.apply();

				// Nach dem Anwenden auch die Einstellungen im localStorage speichern
				try {
					if (
						window.hangarUI &&
						window.hangarUI.uiSettings &&
						typeof window.hangarUI.uiSettings.save === "function"
					) {
						window.hangarUI.uiSettings.save();
					} else {
						// Fallback: Direkt in localStorage speichern
						const settingsData = {
							tilesCount: window.hangarUI.uiSettings.tilesCount || 8,
							secondaryTilesCount: parseInt(secondaryTilesCount) || 0,
							layout: window.hangarUI.uiSettings.layout || 4,
							lastSaved: new Date().toISOString(),
						};
						localStorage.setItem(
							"hangarPlannerSettings",
							JSON.stringify(settingsData)
						);
					}
					console.log(
						"Sekundäre Kacheln aktualisiert und gespeichert:",
						secondaryTilesCount
					);
				} catch (error) {
					console.error("Fehler beim Speichern der Einstellungen:", error);
					// Trotz Fehler eine Erfolgsmeldung anzeigen, damit der Benutzer nicht verunsichert wird
					console.log(
						"Sekundäre Kacheln aktualisiert (ohne Speicherung):",
						secondaryTilesCount
					);
				}
			});
		}
		*/

		// Menü-Toggle-Button
		const menuToggle = document.getElementById("menuToggle");
		if (menuToggle) {
			menuToggle.addEventListener("click", toggleSidebar);
		}

		// Speichern-Button - GEÄNDERT: Verbesserte Speicherfunktion
		const saveBtn = document.getElementById("saveBtn");
		if (saveBtn) {
			saveBtn.addEventListener("click", function () {
				// Den aktuellen Projektnamen aus dem Eingabefeld verwenden
				const projectName =
					document.getElementById("projectName").value ||
					generateDefaultProjectName();
				window.hangarData.saveProjectToFile(projectName);
			});
		}

		// Laden-Button - GEÄNDERT: Verbesserte Ladefunktion
		const loadBtn = document.getElementById("loadBtn");
		if (loadBtn) {
			loadBtn.addEventListener("click", function () {
				window.hangarData.loadProjectFromFile();
			});
		}

		// Einstellungen speichern/laden
		const saveSettingsBtn = document.getElementById("saveSettingsBtn");
		if (saveSettingsBtn) {
			saveSettingsBtn.addEventListener("click", function () {
				window.hangarUI.uiSettings.save(true);
			});
		}

		const loadSettingsBtn = document.getElementById("loadSettingsBtn");
		if (loadSettingsBtn) {
			loadSettingsBtn.addEventListener("click", function () {
				document.getElementById("settingsFileInput").click();
			});
		}

		// PDF-Export-Button
		const exportPdfBtn = document.getElementById("exportPdfBtn");
		if (exportPdfBtn) {
			exportPdfBtn.addEventListener("click", function () {
				window.hangarPDF.exportToPDF();
			});
		}

		// Flugzeug-Such-Button
		const btnSearch = document.getElementById("btnSearch");
		if (btnSearch) {
			btnSearch.addEventListener("click", function () {
				searchAircraft(); // Diese Funktion wird jetzt korrekt aufgerufen
			});
		}

		// Enter-Taste in Suchfeld - NAMENSKONFLIKT BEHOBEN durch Umbenennung der Variable
		const searchInputField = document.getElementById("searchAircraft");
		if (searchInputField) {
			searchInputField.addEventListener("keyup", function (event) {
				if (event.key === "Enter") {
					searchAircraft(); // Diese Funktion wird jetzt korrekt aufgerufen
				}
			});
		}

		// Flugdaten-Update-Button
		const fetchFlightData = document.getElementById("fetchFlightData");
		if (fetchFlightData) {
			fetchFlightData.addEventListener("click", function () {
				fetchAndUpdateFlightData();
			});
		}

		// Import-Handler für Dateien
		const jsonFileInput = document.getElementById("jsonFileInput");
		if (jsonFileInput) {
			jsonFileInput.addEventListener("change", function (event) {
				window.hangarData.importHangarPlanFromJson(event);
			});
		}

		const settingsFileInput = document.getElementById("settingsFileInput");
		if (settingsFileInput) {
			settingsFileInput.addEventListener("change", function (event) {
				importSettingsFromJson(event);
			});
		}

		// Load-Modal-Buttons
		const confirmLoad = document.getElementById("confirmLoad");
		if (confirmLoad) {
			confirmLoad.addEventListener("click", function () {
				loadProjectByName();
			});
		}

		const cancelLoad = document.getElementById("cancelLoad");
		if (cancelLoad) {
			cancelLoad.addEventListener("click", function () {
				hideLoadDialog();
			});
		}

		// Email-Modal-Button
		const emailOkBtn = document.getElementById("emailOkBtn");
		if (emailOkBtn) {
			emailOkBtn.addEventListener("click", function () {
				hideEmailSentModal();
			});
		}

		// Event-Listener für "Vor dem Verlassen der Seite"
		window.addEventListener("beforeunload", function () {
			// Aktuellen Zustand im LocalStorage sichern
			if (
				window.hangarData &&
				window.hangarData.saveCurrentStateToLocalStorage
			) {
				window.hangarData.saveCurrentStateToLocalStorage();
			}
		});

		// Status-Selektoren für primäre Kacheln initialisieren
		initializeStatusSelectors();

		// Event Listener für die Flugzeugsuche - DIESER TEIL WIRD ENTFERNT, DA REDUNDANT
		// Dieser Code versucht window.hangarUI.searchAircraft zu benutzen, was nicht existiert
		// und so zu den Fehlern führt. Wir verwenden stattdessen nur den obigen Code,
		// der unsere lokale searchAircraft()-Funktion direkt aufruft.

		// Event-Handler für den Flugdaten-Abruf Button - NEUE IMPLEMENTIERUNG
		const fetchButton = document.getElementById("fetchFlightData");
		if (fetchButton) {
			fetchButton.addEventListener("click", fetchAndUpdateFlightData);
			console.log("Event-Listener für Flugdaten-Abruf eingerichtet");
		} else {
			console.warn("Fetch-Button für Flugdaten nicht gefunden!");
		}

		// API-Provider Dropdown
		const apiProviderSelect = document.getElementById("apiProviderSelect");
		if (apiProviderSelect) {
			apiProviderSelect.addEventListener("change", function () {
				const selectedProvider = this.value;
				console.log(`API-Provider geändert zu: ${selectedProvider}`);

				// FlightDataAPI über API-Fassade ändern
				if (window.FlightDataAPI) {
					window.FlightDataAPI.setProvider(selectedProvider);
				} else if (window.AeroDataBoxAPI) {
					// Direkter Fallback auf AeroDataBoxAPI, falls API-Fassade nicht verfügbar
					window.AeroDataBoxAPI.setApiProvider(selectedProvider);
				}
			});

			// Initialen Wert setzen basierend auf aktuellem Provider
			if (window.FlightDataAPI) {
				const currentProvider = window.FlightDataAPI.getActiveProvider();
				apiProviderSelect.value = currentProvider;
				console.log(`API-Provider Dropdown auf ${currentProvider} gesetzt`);
			}

			console.log("API-Provider-Dropdown Event-Handler eingerichtet");
		}

		console.log("Alle Event-Listener erfolgreich eingerichtet");
		return true;
	} catch (error) {
		console.error("Fehler beim Einrichten der Event-Listener:", error);
		return false;
	}
}

/**
 * Generiert einen Standarddateinamen im Format yyyy_mm_dd Hangarplanner
 * @returns {string} Formatierter Dateiname
 */
function generateDefaultProjectName() {
	const now = new Date();
	const year = now.getFullYear();
	const month = String(now.getMonth() + 1).padStart(2, "0");
	const day = String(now.getDate()).padStart(2, "0");
	return `${year}_${month}_${day} Hangarplanner`;
}

/**
 * Initialisiert die Event-Listener für alle Status-Selektoren
 * und setzt den initialen Status
 */
function initializeStatusSelectors() {
	// Für alle Status-Selektoren (sowohl primär als auch sekundär)
	document.querySelectorAll('select[id^="status-"]').forEach((select) => {
		const cellId = parseInt(select.id.split("-")[1]);

		// Event-Listener für Statusänderungen
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
 * Lokale Hilfsfunktion für Statusaktualisierung (Fallback)
 * @param {number} cellId - ID der Kachel
 */
function updateStatusLights(cellId) {
	try {
		// Status-Auswahl finden
		const statusSelect = document.getElementById(`status-${cellId}`);
		if (!statusSelect) return;

		const selectedStatus = statusSelect.value;

		// Alle Statuslichter für diese Kachel finden
		const statusLights = document.querySelectorAll(
			`.status-light[data-cell="${cellId}"]`
		);

		// Alle Lichter zurücksetzen (dimmen)
		statusLights.forEach((light) => {
			light.classList.remove("active");
		});

		// Ausgewähltes Licht aktivieren
		const activeLight = document.querySelector(
			`.status-light[data-cell="${cellId}"][data-status="${selectedStatus}"]`
		);
		if (activeLight) {
			activeLight.classList.add("active");
		}
	} catch (error) {
		console.error(
			`Fehler beim Aktualisieren der Statuslichter für Kachel ${cellId}:`,
			error
		);
	}
}

/**
 * Verbesserte Initialisierungsfunktion für die UI
 */
function initializeUI() {
	try {
		console.log("Initialisiere UI...");

		// NEUER CODE: Standarddateinamen im Projektnamen-Eingabefeld setzen
		const projectNameInput = document.getElementById("projectName");
		if (
			projectNameInput &&
			(!projectNameInput.value || projectNameInput.value === "")
		) {
			const defaultName = generateDefaultProjectName();
			projectNameInput.value = defaultName;
			console.log(`Standarddateiname gesetzt: ${defaultName}`);
		}

		// WICHTIG: Zuerst die gespeicherten Einstellungen aus dem localStorage laden
		// und in die UI-Elemente einfügen, bevor irgendetwas anderes gemacht wird
		loadUISettingsFromLocalStorage();

		// Sicherstellen, dass die Section Layout-Initialisierung aufgerufen wird
		if (
			window.hangarUI &&
			typeof window.hangarUI.initSectionLayout === "function"
		) {
			window.hangarUI.initSectionLayout();
		}

		// WICHTIG: Event-Handler für primäre Kacheln sofort einrichten
		setupPrimaryTileEventListeners();

		// WICHTIG: Event-Handler für Flugzeiten-Eingabefelder einrichten
		setupFlightTimeEventListeners();

		// Sofortige Überprüfung und Anwendung der Displayoptionen
		setTimeout(() => {
			// Kachelanzahl aus dem UI lesen und anwenden
			const tilesCount = document.getElementById("tilesCount").value || 8;
			const secondaryTilesCount =
				document.getElementById("secondaryTilesCount").value || 0;
			const layout = document.getElementById("layoutType").value || 4;

			// In uiSettings setzen
			if (window.hangarUI && window.hangarUI.uiSettings) {
				window.hangarUI.uiSettings.tilesCount = parseInt(tilesCount);
				window.hangarUI.uiSettings.secondaryTilesCount =
					parseInt(secondaryTilesCount);
				window.hangarUI.uiSettings.layout = parseInt(layout);

				// Einstellungen anwenden
				window.hangarUI.uiSettings.apply();
			}

			// Status-Selektoren initialisieren
			initializeStatusSelectors();

			// Verzögerte Nachprüfung der Positionswerte für alle Kacheln
			setTimeout(() => {
				// Lade nochmal die Einstellungen aus dem LocalStorage mit hoher Priorität
				applyPositionValuesFromLocalStorage();
				applyFlightTimeValuesFromLocalStorage();

				// Event-Handler erneut einrichten, um sicherzustellen, dass sie aktiv sind
				setupPrimaryTileEventListeners();
				setupFlightTimeEventListeners();

				// Nochmals mit Verzögerung prüfen, ob alle Werte korrekt gesetzt sind
				setTimeout(() => {
					applyPositionValuesFromLocalStorage();
					applyFlightTimeValuesFromLocalStorage();
				}, 500);
			}, 300);

			console.log("Displayoptionen wurden initialisiert");
		}, 300);

		// Event-Listener für neu erstellte sekundäre Kacheln hinzufügen
		document.addEventListener("secondaryTilesCreated", (event) => {
			console.log(`Sekundäre Kacheln erstellt: ${event.detail.count}`);

			// Verzögerte Anwendung der Positionswerte auf sekundäre Kacheln
			setTimeout(() => {
				const savedSettingsJSON = localStorage.getItem("hangarPlannerSettings");
				if (!savedSettingsJSON) return;

				try {
					const settings = JSON.parse(savedSettingsJSON);
					if (!settings.tileValues || !Array.isArray(settings.tileValues))
						return;

					// Filtere nur die sekundären Kacheln (ID >= 101)
					const secondaryTileValues = settings.tileValues.filter(
						(tile) => tile.cellId >= 101
					);

					// Werte auf sekundäre Kacheln anwenden
					secondaryTileValues.forEach((tileValue) => {
						const posInput = document.getElementById(
							`hangar-position-${tileValue.cellId}`
						);
						if (posInput && tileValue.position) {
							// Bewahre den Wert nur auf, wenn er gesetzt ist
							if (tileValue.position.trim() !== "") {
								posInput.value = tileValue.position;
								console.log(
									`Event-Handler: Sekundäre Position für Kachel ${tileValue.cellId} gesetzt: ${tileValue.position}`
								);
							}
						}
					});

					// Spezielles Event-Handling für sofortiges Speichern bei Änderung
					document
						.querySelectorAll(
							'#secondaryHangarGrid input[id^="hangar-position-"]'
						)
						.forEach((input) => {
							const cellId = parseInt(input.id.split("-")[2]);

							// Alte Event-Handler entfernen
							input.removeEventListener("change", input._saveOnChangeHandler);

							// Neuen Handler für sofortiges Speichern bei Änderung hinzufügen
							input._saveOnChangeHandler = function () {
								console.log(
									`Sofortiges Speichern für sekundäre Kachel ${cellId}: ${this.value}`
								);
								const settings = JSON.parse(
									localStorage.getItem("hangarPlannerSettings") || "{}"
								);

								if (!settings.tileValues) settings.tileValues = [];

								const tileIndex = settings.tileValues.findIndex(
									(t) => t.cellId === cellId
								);
								if (tileIndex >= 0) {
									settings.tileValues[tileIndex].position = this.value;
								} else {
									settings.tileValues.push({
										cellId: cellId,
										position: this.value,
										manualInput: "",
									});
								}

								localStorage.setItem(
									"hangarPlannerSettings",
									JSON.stringify(settings)
								);
							};

							// Event-Handler für Änderungen hinzufügen
							input.addEventListener("change", input._saveOnChangeHandler);
						});
				} catch (error) {
					console.error(
						"Fehler beim Verarbeiten der sekundären Kachelwerte:",
						error
					);
				}
			}, 100); // Kurze Verzögerung, um sicherzustellen, dass alle DOM-Elemente bereit sind
		});

		// API Provider Dropdown initialisieren
		initializeApiProviderSelect();

		// Standardwerte für Datumseingaben setzen
		initializeDateInputs();

		return true;
	} catch (error) {
		console.error("Fehler bei der UI-Initialisierung:", error);
		return false;
	}
}

/**
 * Lädt die UI-Einstellungen aus dem LocalStorage und setzt sie in die entsprechenden UI-Elemente
 * Diese Funktion wird am Anfang der UI-Initialisierung aufgerufen, um sicherzustellen,
 * dass die gespeicherten Werte geladen werden, bevor irgendetwas anderes passiert.
 */
function loadUISettingsFromLocalStorage() {
	try {
		const savedSettingsJSON = localStorage.getItem("hangarPlannerSettings");
		if (!savedSettingsJSON) {
			console.log(
				"Keine gespeicherten Einstellungen gefunden, verwende Standardwerte"
			);
			return false;
		}

		const settings = JSON.parse(savedSettingsJSON);

		// Finde die UI-Eingabefelder
		const tilesCountInput = document.getElementById("tilesCount");
		const secondaryTilesCountInput = document.getElementById(
			"secondaryTilesCount"
		);
		const layoutTypeSelect = document.getElementById("layoutType");

		// Setze die Werte aus dem localStorage in die UI-Elemente
		if (tilesCountInput && settings.tilesCount !== undefined) {
			tilesCountInput.value = settings.tilesCount;
			console.log(
				"Primäre Kachelanzahl aus localStorage geladen:",
				settings.tilesCount
			);
		}

		if (
			secondaryTilesCountInput &&
			settings.secondaryTilesCount !== undefined
		) {
			secondaryTilesCountInput.value = settings.secondaryTilesCount;
			console.log(
				"Sekundäre Kachelanzahl aus localStorage geladen:",
				settings.secondaryTilesCount
			);
		}

		if (layoutTypeSelect && settings.layout !== undefined) {
			layoutTypeSelect.value = settings.layout;
			console.log("Layout-Typ aus localStorage geladen:", settings.layout);
		}

		console.log("UI-Einstellungen erfolgreich aus localStorage geladen");
		return true;
	} catch (error) {
		console.error(
			"Fehler beim Laden der UI-Einstellungen aus localStorage:",
			error
		);
		return false;
	}
}

/**
 * Initialisiert die Event-Handler für die Position-Eingabefelder der primären Kacheln
 * Diese Funktion stellt sicher, dass die Positionswerte korrekt im localStorage gespeichert werden
 */
function setupPrimaryTileEventListeners() {
	// Event-Listener für Position-Eingabefelder in primären Kacheln
	document
		.querySelectorAll('#hangarGrid input[id^="hangar-position-"]')
		.forEach((input) => {
			const cellId = parseInt(input.id.split("-")[2]);
			console.log(
				`Event-Handler für Position in primärer Kachel ${cellId} eingerichtet`
			);

			// Speichern des aktuellen Werts als Originalwert, um ungewollte Überschreibungen zu verhindern
			const currentValue = input.value;
			if (currentValue && currentValue.trim() !== "") {
				input.setAttribute("data-original-value", currentValue);
				console.log(
					`Originalwert für Kachel ${cellId} gesichert: ${currentValue}`
				);
			}

			// Alte Event-Handler entfernen, um doppelte Aufrufe zu vermeiden
			input.removeEventListener("blur", input._primarySaveHandler);
			input.removeEventListener("change", input._primarySaveHandler);

			// Neuen Handler für sofortiges Speichern bei Änderung hinzufügen
			input._primarySaveHandler = function () {
				const newValue = this.value;
				console.log(
					`Speichere Position für primäre Kachel ${cellId}: ${newValue}`
				);

				// Wert als Originalwert setzen, um zukünftige Überschreibungen zu verhindern
				if (newValue && newValue.trim() !== "") {
					this.setAttribute("data-original-value", newValue);
				}

				// Sofortiges Speichern im localStorage
				savePositionValueToLocalStorage(cellId, newValue);
			};

			// Event-Handler für Änderungen und Blur-Events hinzufügen
			input.addEventListener("blur", input._primarySaveHandler);
			input.addEventListener("change", input._primarySaveHandler);

			// Auslösen des Handlers, wenn der Wert bereits gesetzt ist
			if (currentValue && currentValue.trim() !== "") {
				savePositionValueToLocalStorage(cellId, currentValue);
			}
		});
}

/**
 * Speichert einen einzelnen Positionswert direkt im localStorage
 */
function savePositionValueToLocalStorage(cellId, value) {
	try {
		// Aktuelle Einstellungen aus localStorage holen
		const savedSettings = JSON.parse(
			localStorage.getItem("hangarPlannerSettings") || "{}"
		);

		if (!savedSettings.tileValues) savedSettings.tileValues = [];

		// Prüfen, ob bereits ein Eintrag für diese Kachel existiert
		const tileIndex = savedSettings.tileValues.findIndex(
			(t) => t.cellId === cellId
		);

		if (tileIndex >= 0) {
			// Nur aktualisieren, wenn der Wert sich geändert hat
			if (savedSettings.tileValues[tileIndex].position !== value) {
				console.log(`Position für Kachel ${cellId} aktualisiert: ${value}`);
				savedSettings.tileValues[tileIndex].position = value;
			}
		} else {
			// Neuen Eintrag erstellen
			console.log(
				`Neuen Positionseintrag für Kachel ${cellId} erstellt: ${value}`
			);
			savedSettings.tileValues.push({
				cellId: cellId,
				position: value,
				manualInput: "",
			});
		}

		// Aktualisierte Einstellungen zurück in localStorage schreiben
		localStorage.setItem(
			"hangarPlannerSettings",
			JSON.stringify(savedSettings)
		);

		// Auto-Save auslösen, wenn Server-Sync aktiviert ist
		if (
			localStorage.getItem("hangarplanner_auto_sync") === "true" &&
			window.storageBrowser
		) {
			// Kurze Verzögerung, um mehrere schnelle Änderungen zu gruppieren
			clearTimeout(window.storageBrowser.autoSaveTimeout);
			window.storageBrowser.autoSaveTimeout = setTimeout(() => {
				console.log("Auto-Save ausgelöst durch Position-Änderung");
				window.storageBrowser.saveCurrentProject();
			}, 1000);
		}

		return true;
	} catch (error) {
		console.error(
			`Fehler beim Speichern der Position für Kachel ${cellId}:`,
			error
		);
		return false;
	}
}

/**
 * Wendet die gespeicherten Positionswerte aus dem localStorage mit höherer Priorität an
 */
function applyPositionValuesFromLocalStorage() {
	try {
		const savedSettingsJSON = localStorage.getItem("hangarPlannerSettings");
		if (!savedSettingsJSON) return;

		const settings = JSON.parse(savedSettingsJSON);
		if (!settings.tileValues || !Array.isArray(settings.tileValues)) return;

		// Anwenden der gespeicherten Positionswerte auf primäre Kacheln
		settings.tileValues.forEach((tileValue) => {
			// Nur primäre Kacheln (ID < 101) verarbeiten
			if (tileValue.cellId < 101 && tileValue.position) {
				const posInput = document.getElementById(
					`hangar-position-${tileValue.cellId}`
				);

				if (posInput) {
					// Originalwert aus dem Attribut holen
					const originalValue = posInput.getAttribute("data-original-value");

					// Nur setzen wenn:
					// - kein Originalwert gesetzt ist ODER
					// - der aktuelle Wert leer ist ODER
					// - der gespeicherte Wert dem Originalwert entspricht
					if (
						!originalValue ||
						!posInput.value.trim() ||
						tileValue.position === originalValue
					) {
						console.log(
							`Setze Position für primäre Kachel ${tileValue.cellId} aus localStorage: ${tileValue.position}`
						);
						posInput.value = tileValue.position;

						// Aktuellen Wert als Original merken
						posInput.setAttribute("data-original-value", tileValue.position);
					} else {
						console.log(
							`Position für primäre Kachel ${tileValue.cellId} beibehalten: ${posInput.value} (gespeichert war: ${tileValue.position})`
						);
					}
				}
			}
		});
	} catch (error) {
		console.error(
			"Fehler beim Anwenden der Positionswerte aus localStorage:",
			error
		);
	}
}

/**
 * Wechselt zwischen Bearbeitungs- und Ansichtsmodus
 */
function toggleEditMode() {
	const isEditMode = document.getElementById("modeToggle").checked;

	if (isEditMode) {
		document.body.classList.add("edit-mode");
		document.body.classList.remove("view-mode");
	} else {
		document.body.classList.remove("edit-mode");
		document.body.classList.add("view-mode");
	}

	console.log(`Modus gewechselt zu: ${isEditMode ? "Bearbeiten" : "Ansicht"}`);
}

/**
 * Blendet das Seitenmenü ein/aus
 */
function toggleSidebar() {
	// Toggle der Sidebar-Collapsed-Klasse am Body-Element
	document.body.classList.toggle("sidebar-collapsed");

	// Referenz zum Sidebar-Menu und Toggle-Button
	const sidebarMenu = document.getElementById("sidebarMenu");
	const menuToggle = document.getElementById("menuToggle");

	// Anpassen des Toggle-Button-Textes je nach Sidebar-Status
	if (menuToggle) {
		// Wenn die Sidebar eingeklappt ist, zeigt der Button nach rechts (»)
		// Wenn die Sidebar ausgeklappt ist, zeigt der Button nach links («)
		const isCollapsed = document.body.classList.contains("sidebar-collapsed");
		menuToggle.textContent = isCollapsed ? "«" : "»";

		// Für bessere Barrierefreiheit
		menuToggle.setAttribute(
			"aria-label",
			isCollapsed ? "Öffne Seitenleiste" : "Schließe Seitenleiste"
		);
		menuToggle.setAttribute("aria-expanded", !isCollapsed);
	}

	// Skalierung neu berechnen nach Menü-Toggle mit ausreichender Verzögerung
	if (window.hangarUI && window.hangarUI.adjustScaling) {
		setTimeout(window.hangarUI.adjustScaling, 300);
	}

	// Speichern des aktuellen Sidebar-Zustands im localStorage
	localStorage.setItem(
		"sidebarCollapsed",
		document.body.classList.contains("sidebar-collapsed")
	);

	console.log(
		"Sidebar Toggle: " +
			(document.body.classList.contains("sidebar-collapsed")
				? "collapsed"
				: "expanded")
	);
}

/**
 * Initialisiert den Sidebar-Toggle-Button mit dem korrekten Anfangszustand
 */
function initializeSidebarToggle() {
	const menuToggle = document.getElementById("menuToggle");
	if (!menuToggle) {
		console.warn("Menu Toggle Button nicht gefunden");
		return;
	}

	// Laden des gespeicherten Sidebar-Zustands aus localStorage
	const savedState = localStorage.getItem("sidebarCollapsed");
	const isCollapsed = savedState === "true";

	// Initialen Zustand auf der Webseite setzen
	if (isCollapsed) {
		document.body.classList.add("sidebar-collapsed");
	} else {
		document.body.classList.remove("sidebar-collapsed");
	}

	// Korrekte Button-Beschriftung setzen
	menuToggle.textContent = isCollapsed ? "«" : "»";
	menuToggle.setAttribute(
		"aria-label",
		isCollapsed ? "Öffne Seitenleiste" : "Schließe Seitenleiste"
	);
	menuToggle.setAttribute("aria-expanded", !isCollapsed);

	// Click-Event-Handler hinzufügen
	menuToggle.addEventListener("click", toggleSidebar);

	console.log(
		"Sidebar-Toggle initialisiert, Status:",
		isCollapsed ? "eingeklappt" : "ausgeklappt"
	);
}

/**
 * Zeigt den Dialog zum Laden eines Projekts
 */
function showLoadDialog() {
	console.log("Lade-Dialog öffnen");

	// Direktes Laden mit dem FileManager
	window.hangarData.loadProjectFromFile().catch((error) => {
		// Nur Fehler loggen, wenn es kein AbortError ist
		if (error.name !== "AbortError") {
			console.error("Fehler beim Laden:", error);
			window.showNotification(
				`Laden fehlgeschlagen: ${error.message}`,
				"error"
			);
		}
	});
}

/**
 * Versteckt den Dialog zum Laden eines Projekts
 */
function hideLoadDialog() {
	const loadModal = document.getElementById("loadModal");
	if (loadModal) {
		loadModal.classList.add("hidden");
	}
}

/**
 * Versteckt den E-Mail-Erfolgsdialog
 */
function hideEmailSentModal() {
	const emailSentModal = document.getElementById("emailSentModal");
	if (emailSentModal) {
		emailSentModal.classList.add("hidden");
	}
}

/**
 * Lädt ein Projekt aus der Datenbank basierend auf dem Namen
 */
function loadProjectByName() {
	const loadProjectName = document.getElementById("loadProjectName").value;

	if (!loadProjectName) {
		showNotification("Bitte Projektnamen eingeben", "warning");
		return;
	}

	// Verstecke den Dialog
	hideLoadDialog();

	// Versuche das Projekt aus der Datenbank zu laden
	// (hier müsste eigentlich eine Datenbankabfrage erfolgen)
	showNotification(
		"Diese Funktion wurde durch einen modernen Projektmanager ersetzt.",
		"info"
	);
}

/**
 * Importiert Einstellungen aus einer JSON-Datei
 */
function importSettingsFromJson(event) {
	try {
		const file = event.target.files[0];
		if (!file) {
			showNotification("Keine Datei ausgewählt", "error");
			return;
		}

		const reader = new FileReader();
		reader.onload = function (e) {
			try {
				const settingsData = JSON.parse(e.target.result);

				// Einstellungen auf UI anwenden
				if (window.hangarUI && window.hangarUI.uiSettings) {
					window.hangarUI.uiSettings.tilesCount = settingsData.tilesCount || 8;
					window.hangarUI.uiSettings.secondaryTilesCount =
						settingsData.secondaryTilesCount || 0;
					window.hangarUI.uiSettings.layout = settingsData.layout || 4;

					// UI-Controls aktualisieren
					window.hangarUI.uiSettings.updateUIControls();

					// Kachelwerte anwenden, falls vorhanden
					if (
						settingsData.tileValues &&
						Array.isArray(settingsData.tileValues)
					) {
						window.hangarUI.uiSettings.applyTileValues(settingsData.tileValues);
					}

					// Einstellungen anwenden
					window.hangarUI.uiSettings.apply();

					showNotification("Einstellungen erfolgreich geladen", "success");
				}
			} catch (error) {
				console.error("Fehler beim Verarbeiten der Einstellungsdatei:", error);
				showNotification(`Einstellungen-Fehler: ${error.message}`, "error");
			}
		};

		reader.readAsText(file);

		// Input zurücksetzen
		event.target.value = "";
	} catch (error) {
		console.error("Fehler beim Importieren der Einstellungen:", error);
		showNotification(
			`Einstellungen-Import fehlgeschlagen: ${error.message}`,
			"error"
		);
	}
}

/**
 * Sucht nach einem Flugzeug in allen Kacheln
 * Mit verbessertem Teilstring-Matching und Groß-/Kleinschreibung wird ignoriert
 */
function searchAircraft() {
	console.log("Suchfunktion wird ausgeführt...");

	// Suchbegriff aus dem Eingabefeld holen
	const searchInputField = document.getElementById("searchAircraft");
	if (!searchInputField) {
		console.error("Suchfeld konnte nicht gefunden werden!");
		return;
	}

	const searchTerm = searchInputField.value.trim().toLowerCase();
	console.log(`Suche nach: "${searchTerm}"`);

	if (!searchTerm) {
		console.warn("Kein Suchbegriff eingegeben");
		showNotification("Bitte geben Sie einen Suchbegriff ein", "warning");
		return;
	}

	// Alle bestehenden Hervorhebungen zurücksetzen
	document.querySelectorAll(".hangar-cell").forEach((cell) => {
		cell.style.boxShadow = "";
	});

	let foundCount = 0;
	let firstFoundCell = null;
	let matchDetails = [];

	// Alle Kacheln durchsuchen mit detaillierter Protokollierung
	console.log("Durchsuche Kacheln...");
	document.querySelectorAll(".hangar-cell").forEach((cell, index) => {
		// Finde alle relevanten Felder in der Kachel
		const aircraftInput = cell.querySelector('input[id^="aircraft-"]');
		const manualInput = cell.querySelector('input[placeholder="Manual Input"]');
		const positionInput = cell.querySelector('input[id^="hangar-position-"]');

		// Texte extrahieren und normalisieren
		const aircraftText = aircraftInput ? aircraftInput.value.toLowerCase() : "";
		const manualText = manualInput ? manualInput.value.toLowerCase() : "";
		const positionText = positionInput ? positionInput.value.toLowerCase() : "";

		// Debugging: Zeige Inhalte der Felder
		console.log(`Kachel ${index + 1}:`, {
			aircraftText,
			manualText,
			positionText,
		});

		// Prüfen, ob der Suchbegriff in einem der Felder vorkommt
		let matched = false;
		let matchSource = "";

		if (aircraftText && aircraftText.includes(searchTerm)) {
			matched = true;
			matchSource = "Flugzeug-ID";
			console.log(
				`Treffer in Kachel ${index + 1} (Aircraft ID): ${aircraftText}`
			);
		}

		if (manualText && manualText.includes(searchTerm)) {
			matched = true;
			matchSource = matchSource
				? `${matchSource}, Manual Input`
				: "Manual Input";
			console.log(
				`Treffer in Kachel ${index + 1} (Manual Input): ${manualText}`
			);
		}

		if (positionText && positionText.includes(searchTerm)) {
			matched = true;
			matchSource = matchSource ? `${matchSource}, Position` : "Position";
			console.log(`Treffer in Kachel ${index + 1} (Position): ${positionText}`);
		}

		// Wenn Treffer gefunden, Kachel hervorheben
		if (matched) {
			// Einfache Hervorhebung nur mit Rahmen
			cell.classList.add("search-match-highlight");

			foundCount++;

			// Erste gefundene Kachel für Scrolling merken
			if (!firstFoundCell) {
				firstFoundCell = cell;
			}

			// Details zum Treffer für die Meldung sammeln
			matchDetails.push(matchSource);
		}
	});

	// CSS-Styles für die Hervorhebung hinzufügen, falls noch nicht vorhanden
	addSearchHighlightStyles();

	// Zum ersten Treffer scrollen, wenn vorhanden
	if (firstFoundCell) {
		console.log("Scrolle zur ersten Trefferkachel");
		firstFoundCell.scrollIntoView({ behavior: "smooth", block: "center" });
	}

	// Eindeutiges Set von Match-Quellen erstellen
	const uniqueMatchSources = [...new Set(matchDetails)].join(", ");

	// Rückmeldung über Suchergebnis
	if (foundCount > 0) {
		const message = `${foundCount} Treffer für "${searchTerm}" in ${uniqueMatchSources}`;
		console.log(message);

		// Nach 2 Sekunden automatisch zurücksetzen
		setTimeout(() => {
			// Alle Hervorhebungen zurücksetzen
			document.querySelectorAll(".search-match-highlight").forEach((cell) => {
				cell.classList.remove("search-match-highlight", "search-pulse");
			});
		}, 2000);

		// Zusätzlich Benachrichtigung zeigen wenn verfügbar
		if (typeof window.showNotification === "function") {
			window.showNotification(message, "success");
		} else if (typeof showNotification === "function") {
			showNotification(message, "success");
		}
	} else {
		const message = `Keine Ergebnisse für "${searchTerm}"`;
		console.log(message);

		// Bei keinen Ergebnissen trotzdem Benachrichtigung zeigen wenn verfügbar
		if (typeof window.showNotification === "function") {
			window.showNotification(message, "warning");
		} else if (typeof showNotification === "function") {
			showNotification(message, "warning");
		}
	}
}

/**
 * Fügt Styles für die Suchhervorhebung hinzu, falls noch nicht vorhanden
 */
function addSearchHighlightStyles() {
	if (!document.getElementById("search-highlight-styles")) {
		const styleEl = document.createElement("style");
		styleEl.id = "search-highlight-styles";
		styleEl.textContent = `
			.search-match-highlight {
				box-shadow: 0 0 0 2px #EF8354 !important;
			}
		`;
		document.head.appendChild(styleEl);
	}
}

/**
 * Initialisiert die API-Provider-Dropdown-Auswahl
 */
function initializeApiProviderSelect() {
	const apiProviderSelect = document.getElementById("apiProviderSelect");
	if (!apiProviderSelect) {
		console.warn("API Provider Select nicht gefunden");
		return;
	}

	// Aktuellen Provider laden
	let currentProvider = "aerodatabox"; // Standard-Provider

	// Provider aus FlightDataAPI holen, wenn verfügbar
	if (
		window.FlightDataAPI &&
		typeof window.FlightDataAPI.getActiveProvider === "function"
	) {
		currentProvider = window.FlightDataAPI.getActiveProvider();
	}
	// Alternativ aus AeroDataBoxAPI, falls abrufbar
	else if (
		window.AeroDataBoxAPI &&
		window.AeroDataBoxAPI.config &&
		window.AeroDataBoxAPI.config.activeProvider
	) {
		currentProvider = window.AeroDataBoxAPI.config.activeProvider;
	}

	// Dropdown auf aktuellen Provider setzen
	apiProviderSelect.value = currentProvider;

	console.log(
		`API-Provider-Dropdown initialisiert mit Wert: ${currentProvider}`
	);

	// Event-Handler für Änderungen
	apiProviderSelect.addEventListener("change", function () {
		const selectedProvider = this.value;
		console.log(`API-Provider wird geändert zu: ${selectedProvider}`);

		// FlightDataAPI über API-Fassade ändern
		if (window.FlightDataAPI) {
			window.FlightDataAPI.setProvider(selectedProvider);
		} else if (window.AeroDataBoxAPI) {
			// Direkter Fallback auf AeroDataBoxAPI
			window.AeroDataBoxAPI.setApiProvider(selectedProvider);
		}

		// Status aktualisieren
		const fetchStatus = document.getElementById("fetchStatus");
		if (fetchStatus) {
			fetchStatus.textContent = `API-Provider geändert zu: ${selectedProvider}`;
		}
	});
}

/**
 * Globale Hilfsfunktion für Benachrichtigungen
 * @param {string} message - Nachrichtentext
 * @param {string} type - Art der Nachricht (success, warning, error, info)
 */
function showNotification(message, type = "info") {
	// Direkte Implementierung ohne rekursiven Aufruf

	// Ausgabe in der Konsole
	console.log(`Benachrichtigung (${type}): ${message}`);

	// Bei Fehlern detailliertere Konsolenausgabe
	if (type === "error") {
		console.error(`Fehler: ${message}`);
	} else if (type === "warning") {
		console.warn(`Warnung: ${message}`);
	}

	// UI-Elemente aktualisieren, wenn vorhanden
	const fetchStatus = document.getElementById("fetchStatus");
	if (fetchStatus) {
		fetchStatus.textContent = message;
		fetchStatus.className =
			type === "error"
				? "text-sm text-center text-status-red"
				: type === "warning"
				? "text-sm text-center text-status-yellow"
				: "text-sm text-center";
	}
}

// Zur globalen Verfügbarkeit im window-Objekt registrieren
// WICHTIG: Direkter Verweis auf die Funktion ohne erneuten Aufruf
window.showNotification = showNotification;

/**
 * Ruft Flugdaten ab und aktualisiert die UI
 */
async function fetchAndUpdateFlightData() {
	const fetchStatus = document.getElementById("fetchStatus");

	try {
		if (fetchStatus) {
			fetchStatus.textContent = "Flugdaten werden abgerufen...";
		}

		// Werte aus den UI-Elementen lesen
		const currentDateInput = document.getElementById("currentDateInput");
		const nextDateInput = document.getElementById("nextDateInput");
		const airportCodeInput = document.getElementById("airportCodeInput");

		if (!currentDateInput || !nextDateInput || !airportCodeInput) {
			throw new Error("Erforderliche UI-Elemente nicht gefunden");
		}

		const currentDate = currentDateInput.value;
		const nextDate = nextDateInput.value;
		const airportCode = airportCodeInput.value.trim().toUpperCase();

		if (!currentDate || !nextDate || !airportCode) {
			throw new Error(
				"Bitte alle Felder ausfüllen: Datum, Folgetag und Flughafen"
			);
		}

		// Zeitfenster erstellen (20:00 am ersten Tag bis 08:00 am zweiten Tag)
		const startDateTime = `${currentDate}T20:00`;
		const endDateTime = `${nextDate}T08:00`;

		if (fetchStatus) {
			fetchStatus.textContent = `Suche Flüge von ${startDateTime} bis ${endDateTime} am Flughafen ${airportCode}...`;
		}

		// Neue API-Funktion verwenden
		if (
			window.AeroDataBoxAPI &&
			window.AeroDataBoxAPI.updateFlightDataForAllAircraft
		) {
			await window.AeroDataBoxAPI.updateFlightDataForAllAircraft(
				airportCode,
				startDateTime,
				endDateTime
			);

			// Erfolgreiche Aktualisierung
			showNotification("Flugdaten wurden erfolgreich aktualisiert", "success");

			// Status zurücksetzen
			setTimeout(() => {
				if (fetchStatus) {
					fetchStatus.textContent = "Bereit zum Abrufen von Flugdaten";
				}
			}, 3000);
		} else {
			throw new Error("AeroDataBox API nicht verfügbar");
		}
	} catch (error) {
		console.error("Fehler beim Abrufen der Flugdaten:", error);

		if (fetchStatus) {
			fetchStatus.textContent = `Fehler: ${error.message}`;
		}

		showNotification(
			`Fehler beim Abrufen der Flugdaten: ${error.message}`,
			"error"
		);

		// Fehlerstatus nach einer Weile zurücksetzen
		setTimeout(() => {
			if (fetchStatus) {
				fetchStatus.textContent = "Bereit zum Abrufen von Flugdaten";
			}
		}, 5000);
	}
}

/**
 * Handler für den "Flight Data Update" Button
 * Ruft die API auf, um Flugdaten zu erhalten
 */
function handleFlightDataFetch() {
	const searchAircraftInput = document.getElementById("searchAircraft");
	const aircraftId = searchAircraftInput.value.trim();

	// Wenn keine ID angegeben ist, alle Flugzeuge abfragen
	if (!aircraftId) {
		fetchAllAircraftData();
		return;
	}

	// Hervorhebung des Eingabefelds, wenn keine ID eingegeben wurde
	searchAircraftInput.classList.add("border-red-500");
	searchAircraftInput.classList.add("bg-red-50");
	setTimeout(() => {
		searchAircraftInput.classList.remove("border-red-500");
		searchAircraftInput.classList.remove("bg-red-50");
	}, 3000);

	// Flugdaten abrufen mit der aktuell ausgewählten API
	fetchFlightButtonHandler();
}

/**
 * Setzt alle Flugdatenfelder in den Kacheln zurück
 */
function resetAllFlightDataFields() {
	try {
		// Alle Kacheln finden
		const cells = document.querySelectorAll(".hangar-cell");
		console.log(`Setze Flugdaten in ${cells.length} Kacheln zurück...`);

		cells.forEach((cell) => {
			const cellId = cell.getAttribute("data-cell-id");
			if (!cellId) return;

			// Arrival Time zurücksetzen
			const arrivalTimeEl = document.getElementById(`arrival-time-${cellId}`);
			if (arrivalTimeEl) arrivalTimeEl.textContent = "--:--";

			// Departure Time zurücksetzen
			const departureTimeEl = document.getElementById(
				`departure-time-${cellId}`
			);
			if (departureTimeEl) departureTimeEl.textContent = "--:--";

			// Position zurücksetzen
			const positionEl = document.getElementById(`hangar-position-${cellId}`);
			if (positionEl) positionEl.value = "";
		});

		console.log("Alle Flugdatenfelder wurden zurückgesetzt");
		return true;
	} catch (error) {
		console.error("Fehler beim Zurücksetzen der Flugdatenfelder:", error);
		return false;
	}
}

/**
 * Event-Handler für den 'Flugdaten abrufen'-Button
 */
async function fetchFlightButtonHandler() {
	// Eingabewerte sammeln
	const currentDateInput = document.getElementById("currentDateInput");
	const nextDateInput = document.getElementById("nextDateInput");
	const airportCodeInput = document.getElementById("airportCodeInput");

	// Zuerst im dedizierten Suchfeld suchen
	let searchInput = document.getElementById("searchAircraft");
	let aircraftId = searchInput?.value?.trim();

	// Wenn keine ID im Suchfeld gefunden wurde, suche nach einer aktiv ausgewählten Kachel
	if (!aircraftId) {
		const selectedCell = document.querySelector(".hangar-cell.selected");
		if (selectedCell) {
			const cellId = selectedCell.getAttribute("data-cell-id");
			if (cellId) {
				const aircraftInput = document.getElementById(`aircraft-${cellId}`);
				if (aircraftInput && aircraftInput.value.trim()) {
					aircraftId = aircraftInput.value.trim();
					console.log(
						`Verwende Flugzeug-ID aus ausgewählter Kachel: ${aircraftId}`
					);
				}
			}
		}
	}

	// Prüfen ob alle erforderlichen Eingaben vorhanden sind
	if (!aircraftId) {
		showNotification("Bitte geben Sie eine Flugzeug-ID ein", "warning");
		return;
	}

	if (!airportCodeInput?.value) {
		showNotification(
			"Bitte geben Sie einen Flughafen (IATA-Code) ein",
			"warning"
		);
		return;
	}

	// Datumswerte holen
	const currentDate = currentDateInput?.value;
	const nextDate = nextDateInput?.value;

	// Debug-Ausgabe
	console.log(
		`[DEBUG] fetchFlightButtonHandler: Rufe API für ${aircraftId} mit Daten ${currentDate} und ${nextDate} auf`
	);

	try {
		// NEUER CODE: Zuerst alle Kacheln zurücksetzen
		resetAllFlightDataFields();

		// Status aktualisieren
		updateFetchStatus(
			`Rufe Flugdaten für ${aircraftId} ab (${currentDate}/${nextDate})...`
		);

		// API-Fassade für alle API-Aufrufe verwenden
		if (window.FlightDataAPI) {
			console.log(
				`[DEBUG] Starte API-Fassaden-Aufruf: updateAircraftData(${aircraftId}, ${currentDate}, ${nextDate})`
			);

			// WICHTIG: updateAircraftData verwenden, nicht getAircraftFlights!
			const result = await window.FlightDataAPI.updateAircraftData(
				aircraftId,
				currentDate || new Date().toISOString().split("T")[0],
				nextDate ||
					new Date(new Date().getTime() + 86400000).toISOString().split("T")[0]
			);

			console.log(
				`[DEBUG] API-Fassaden-Aufruf abgeschlossen, Ergebnis:`,
				result
			);

			if (result) {
				// NEUER CODE: Erfolgsbenachrichtigung mit UTC-Hinweis
				showNotification(
					`Flugdaten erfolgreich abgerufen: ${
						result.positionText || "keine Positionsdaten"
					} (UTC-Zeiten)`,
					"success"
				);
			}
		} else {
			console.error("API-Fassade nicht verfügbar");
			// Fallback auf direkte API-Aufrufe nur wenn nötig
			if (window.AeroDataBoxAPI) {
				await window.AeroDataBoxAPI.updateAircraftData(
					aircraftId,
					currentDate,
					nextDate
				);
			} else if (window.AmadeusAPI) {
				await window.AmadeusAPI.updateAircraftData(
					aircraftId,
					currentDate,
					nextDate
				);
			}
		}
	} catch (error) {
		console.error("Fehler beim Abrufen der Flugdaten:", error);
		showNotification(`Datenabruf fehlgeschlagen: ${error.message}`, "error");
	}
}

/**
 * Sammelt alle Flugzeug-IDs und ruft Flugdaten für alle ab
 */
function fetchAllAircraftData() {
	try {
		const currentDateInput = document.getElementById("currentDateInput");
		const nextDateInput = document.getElementById("nextDateInput");
		const airportCodeInput = document.getElementById("airportCodeInput");

		const currentDate = currentDateInput?.value || formatDate(new Date());
		const nextDate =
			nextDateInput?.value ||
			formatDate(new Date(new Date().getTime() + 86400000)); // +1 Tag
		const airportCode = airportCodeInput?.value?.trim().toUpperCase() || "FRA";

		// Status aktualisieren
		const fetchStatus = document.getElementById("fetchStatus");
		if (fetchStatus) {
			fetchStatus.innerHTML = `<span class="animate-pulse">🔍 Sammle alle Flugzeug-IDs...</span>`;
		}

		// Alle Flugzeug-IDs sammeln - CONTAINER-SPEZIFISCH
		// Primäre Kacheln (hangarGrid)
		const primaryAircraftInputs = document.querySelectorAll(
			'#hangarGrid input[id^="aircraft-"]'
		);
		// Sekundäre Kacheln (secondaryHangarGrid)
		const secondaryAircraftInputs = document.querySelectorAll(
			'#secondaryHangarGrid input[id^="aircraft-"]'
		);

		let aircraftIds = [];

		// Primäre Kacheln verarbeiten
		primaryAircraftInputs.forEach((input) => {
			const cellId = parseInt(input.id.split("-")[1]);
			// Container-Validation: Primäre Kacheln sollten IDs 1-12 haben
			if (cellId >= 101) {
				console.warn(`❌ Primäre Kachel mit sekundärer ID ${cellId} ignoriert`);
				return;
			}

			const id = input.value.trim();
			if (id && !aircraftIds.includes(id)) {
				aircraftIds.push(id);
				console.log(
					`✅ Aircraft ID aus PRIMÄRER Kachel ${cellId} gesammelt: ${id}`
				);
			}
		});

		// Sekundäre Kacheln verarbeiten
		secondaryAircraftInputs.forEach((input) => {
			const cellId = parseInt(input.id.split("-")[1]);
			// Container-Validation: Sekundäre Kacheln sollten IDs >= 101 haben
			if (cellId < 101) {
				console.warn(`❌ Sekundäre Kachel mit primärer ID ${cellId} ignoriert`);
				return;
			}

			const id = input.value.trim();
			if (id && !aircraftIds.includes(id)) {
				aircraftIds.push(id);
				console.log(
					`✅ Aircraft ID aus SEKUNDÄRER Kachel ${cellId} gesammelt: ${id}`
				);
			}
		});

		if (aircraftIds.length === 0) {
			if (fetchStatus) {
				fetchStatus.innerHTML = `⚠️ Keine Flugzeug-IDs gefunden! Bitte tragen Sie zuerst Flugzeugkennungen ein.`;
			}
			showNotification("Keine Flugzeug-IDs gefunden", "warning");
			return;
		}

		if (fetchStatus) {
			fetchStatus.innerHTML = `<span class="animate-pulse">🔄 Lade Flugdaten für ${aircraftIds.length} Flugzeuge...</span>`;
		}

		// Flugdaten für jedes Flugzeug abrufen und anwenden
		fetchAndApplyAllAircraftData(
			aircraftIds,
			currentDate,
			nextDate,
			airportCode
		);
	} catch (error) {
		console.error("Fehler beim Sammeln der Flugzeug-IDs:", error);
		showNotification(
			"Fehler beim Sammeln der Flugzeug-IDs: " + error.message,
			"error"
		);
		const fetchStatus = document.getElementById("fetchStatus");
		if (fetchStatus) {
			fetchStatus.innerHTML = `❌ Fehler: ${
				error.message || "Unbekannter Fehler"
			}`;
		}
	}
}

/**
 * Ruft Flugdaten für alle Flugzeug-IDs ab und wendet sie an
 * @param {string[]} aircraftIds - Liste der Flugzeug-IDs
 * @param {string} currentDate - Aktuelles Datum
 * @param {string} nextDate - Nächstes Datum
 * @param {string} airportCode - IATA-Flughafencode
 */
async function fetchAndApplyAllAircraftData(
	aircraftIds,
	currentDate,
	nextDate,
	airportCode
) {
	try {
		const fetchStatus = document.getElementById("fetchStatus");
		if (fetchStatus) {
			fetchStatus.innerHTML = `<span class="animate-pulse">🔄 Lade Daten für ${aircraftIds.length} Flugzeuge...</span>`;
		}

		// Status für bessere Benutzererfahrung
		let processed = 0;
		const total = aircraftIds.length;
		const results = {
			success: 0,
			failed: 0,
		};

		// API-Anfragen sequentiell durchführen, um die API nicht zu überlasten
		for (const aircraftId of aircraftIds) {
			try {
				processed++;
				if (fetchStatus) {
					fetchStatus.innerHTML = `<span class="animate-pulse">✈️ Verarbeite ${aircraftId} (${processed}/${total})...</span>`;
				}

				// API-Fassade verwenden, falls verfügbar
				let flightData;
				try {
					if (window.FlightDataAPI) {
						// VEREINFACHT: Immer updateAircraftData mit beiden Datumsparametern aufrufen
						console.log(
							`[DEBUG] Rufe updateAircraftData für ${aircraftId} mit beiden Daten auf: ${currentDate}, ${nextDate}`
						);
						flightData = await window.FlightDataAPI.updateAircraftData(
							aircraftId,
							currentDate,
							nextDate
						);
					} else if (window.AeroDataBoxAPI) {
						// Direkter Fallback auf AeroDataBoxAPI wenn nötig
						console.log(
							`[DEBUG] Rufe AeroDataBoxAPI.updateAircraftData direkt auf mit beiden Daten: ${currentDate}, ${nextDate}`
						);
						flightData = await window.AeroDataBoxAPI.updateAircraftData(
							aircraftId,
							currentDate,
							nextDate
						);
					} else {
						if (fetchStatus) {
							fetchStatus.innerHTML = "❌ Keine API für Flugdaten verfügbar";
						}
						results.failed++;
						continue;
					}
				} catch (apiError) {
					console.error(`API-Fehler bei ${aircraftId}:`, apiError);
					// Bei Fehler trotzdem fortfahren, aber als fehlgeschlagen markieren
					results.failed++;
					continue;
				}

				// Daten auf alle Kacheln anwenden, die diese Flugzeug-ID haben
				const updated = updateAllInstancesOfAircraft(
					aircraftId,
					flightData,
					airportCode
				);
				if (updated) {
					results.success++;
				} else {
					results.failed++;
				}

				// Kleine Pause zwischen den Anfragen für bessere API-Performance
				await new Promise((resolve) => setTimeout(resolve, 500));
			} catch (error) {
				console.error(`Fehler bei ${aircraftId}:`, error);
				results.failed++;
			}
		}

		// Abschlussmeldung
		if (fetchStatus) {
			fetchStatus.innerHTML = `✅ Flugdaten aktualisiert: ${results.success} erfolgreich, ${results.failed} fehlgeschlagen`;
		}

		// Erfolg nach kurzem Delay zurücksetzen
		setTimeout(() => {
			if (fetchStatus) {
				fetchStatus.textContent = "Bereit zum Abrufen von Flugdaten";
			}
		}, 8000);

		// Benachrichtigung anzeigen
		showNotification(
			`Flugdaten aktualisiert: ${results.success} erfolgreich, ${results.failed} fehlgeschlagen`,
			"success"
		);
	} catch (error) {
		console.error("Fehler bei der Verarbeitung aller Flugzeug-IDs:", error);
		const fetchStatus = document.getElementById("fetchStatus");
		if (fetchStatus) {
			fetchStatus.innerHTML = `❌ Fehler: ${
				error.message || "Unbekannter Fehler"
			}`;
		}
		showNotification(
			"Fehler bei der Aktualisierung der Flugdaten: " + error.message,
			"error"
		);
	}
}

/**
 * Aktualisiert alle Kacheln, die eine bestimmte Flugzeug-ID haben
 * @param {string} aircraftId - Die Flugzeug-ID
 * @param {object} flightData - Die abgerufenen Flugdaten
 * @param {string} preferredAirport - Bevorzugter Flughafen (IATA-Code)
 * @returns {boolean} - true, wenn mindestens eine Kachel aktualisiert wurde
 */
function updateAllInstancesOfAircraft(
	aircraftId,
	flightData,
	preferredAirport
) {
	try {
		// Alle Kacheln mit dieser Flugzeug-ID finden
		const cells = document.querySelectorAll(".hangar-cell");
		let found = false;

		cells.forEach((cell) => {
			const aircraftInput = cell.querySelector(".aircraft-id");
			if (aircraftInput && aircraftInput.value.trim() === aircraftId) {
				found = true;

				// Zellen-ID bestimmen
				const cellId = aircraftInput.id.split("-")[1];

				// Flugdaten extrahieren und anwenden
				applyFlightDataToCell(cellId, flightData, preferredAirport);

				// Logging hinzufügen, um die Anwendung der Daten zu überprüfen
				console.log(
					`Flugdaten für ${aircraftId} auf Kachel ${cellId} angewendet`
				);
			}
		});

		if (!found) {
			console.log(`Keine Kachel mit Aircraft ID ${aircraftId} gefunden.`);
		}

		return found;
	} catch (error) {
		console.error(
			`Fehler beim Aktualisieren der Kacheln für ${aircraftId}:`,
			error
		);
		return false;
	}
}

/**
 * Wendet Flugdaten auf eine Kachel an
 * @param {string} cellId - ID der Kachel
 * @param {object} flightData - Die abgerufenen Flugdaten
 * @param {string} preferredAirport - Bevorzugter Flughafen (IATA-Code)
 */
function applyFlightDataToCell(cellId, flightData, preferredAirport) {
	try {
		// Frühe Rückkehr, wenn keine Daten vorhanden sind
		if (!flightData || !flightData.data || flightData.data.length === 0) {
			console.log(
				`Keine Flugdaten für Kachel ${cellId} gefunden - keine UI-Aktualisierung`
			);
			return false;
		}

		// Flug finden, der zum bevorzugten Flughafen passt
		let flight = null;

		if (preferredAirport) {
			// Suche nach Flügen mit dem bevorzugten Flughafen
			flight = flightData.data.find((f) => {
				return (
					f.flightPoints &&
					f.flightPoints.some((point) => point.iataCode === preferredAirport)
				);
			});

			console.log(
				`Flug mit Flughafen ${preferredAirport} ${
					flight ? "gefunden" : "nicht gefunden"
				}`
			);
		}

		// Wenn kein passender Flug gefunden wurde, nehme den ersten
		if (!flight && flightData.data.length > 0) {
			flight = flightData.data[0];
			console.log(`Verwende ersten verfügbaren Flug`);
		}

		// Wenn kein Flug gefunden wurde oder keine gültigen FlightPoints hat, keine Änderungen vornehmen
		if (!flight || !flight.flightPoints || flight.flightPoints.length < 2) {
			console.log(`Keine verwendbaren Flugdaten für Kachel ${cellId}`);
			return false;
		}

		// Standard-Werte falls keine spezifischen Daten gefunden werden
		let departureTime = "--:--";
		let arrivalTime = "--:--";
		let originCode = "---";
		let destCode = "---";

		// Ankunftsdaten vom aktuellen Tag extrahieren
		const arrival = flight.flightPoints.find((point) => point.arrivalPoint);
		if (arrival) {
			destCode = arrival.iataCode || "---";
			if (
				arrival.arrival &&
				arrival.arrival.timings &&
				arrival.arrival.timings.length > 0
			) {
				const timeStr = arrival.arrival.timings[0].value;
				arrivalTime = timeStr.substring(0, 5);
			}
		}

		// Verbesserte Prüfung für Folgetags-Flüge
		// 1. Extrahiere Datumsangaben aus den Rohdaten und dem scheduledDepartureDate
		const currentDateString = flight._currentDateRequested || ""; // Datum des aktuellen Tages (Anfrage)
		const nextDateString = flight._nextDateRequested || ""; // Datum des Folgetages (Anfrage)
		const departureDateFromRaw =
			flight._rawFlightData?.departure?.scheduledTime?.local?.split("T")[0] ||
			"";

		// 2. Loggen für Debug-Zwecke
		console.log(`[Debug] Flug-Daten für ${cellId}:`, {
			flightId: flight.flightDesignator?.flightNumber,
			departureDateRaw: departureDateFromRaw,
			currentDate: currentDateString,
			nextDate: nextDateString,
			scheduledDepartureDate: flight.scheduledDepartureDate,
		});

		// 3. Verbesserte Prüfung: Ist es ein Folgetags-Flug?
		// Ein Flug ist ein Folgetags-Flug, wenn sein Abflugdatum dem nextDate entspricht
		const isNextDayFlight =
			departureDateFromRaw &&
			nextDateString &&
			departureDateFromRaw === nextDateString;

		// Abflugsdaten extrahieren - NUR wenn es sich um einen Flug am Folgetag handelt
		const departure = flight.flightPoints.find((point) => point.departurePoint);
		if (departure && isNextDayFlight) {
			originCode = departure.iataCode || "---";
			if (
				departure.departure &&
				departure.departure.timings &&
				departure.departure.timings.length > 0
			) {
				const timeStr = departure.departure.timings[0].value;
				departureTime = timeStr.substring(0, 5);
			}
		} else {
			// Wenn es kein Folgetags-Flug ist oder keine Abflugsdaten vorhanden sind,
			// dann keine Departure Time eintragen, nur die Route
			departureTime = "--:--";
			if (departure) {
				originCode = departure.iataCode || "---";
			}
		}

		// Überprüfen, ob der bevorzugte Flughafen enthalten ist
		if (preferredAirport) {
			const hasPreferredAirport =
				originCode === preferredAirport || destCode === preferredAirport;
			console.log(
				`Flug enthält bevorzugten Flughafen ${preferredAirport}: ${hasPreferredAirport}`
			);
		}

		// UI-Elemente aktualisieren
		const arrivalTimeEl = document.getElementById(`arrival-time-${cellId}`);
		const departureTimeEl = document.getElementById(`departure-time-${cellId}`);
		const positionEl = document.getElementById(`hangar-position-${cellId}`);

		// Zeiten mit UTC-Kennzeichnung eintragen, wenn sie gültig sind
		if (arrivalTimeEl && arrivalTime !== "--:--")
			arrivalTimeEl.textContent = arrivalTime + " UTC"; // GEÄNDERT: UTC-Kennzeichnung hinzugefügt

		// Departure Time nur eintragen, wenn es ein Folgetags-Flug ist, nun mit UTC-Kennzeichnung
		if (departureTimeEl) {
			if (isNextDayFlight && departureTime !== "--:--") {
				departureTimeEl.textContent = departureTime + " UTC"; // GEÄNDERT: UTC-Kennzeichnung hinzugefügt
			} else {
				departureTimeEl.textContent = "--:--";
			}
		}

		// Position nur eintragen, wenn mindestens ein Code gültig ist
		if (positionEl && originCode !== "---" && destCode !== "---") {
			positionEl.value = `${originCode}→${destCode}`;
		} else if (positionEl && (originCode !== "---" || destCode !== "---")) {
			// Wenn nur ein Code gültig ist, zeige nur diesen an
			positionEl.value = originCode !== "---" ? originCode : destCode;
		}

		// Flugzeiten automatisch im localStorage speichern
		const finalArrivalTime = arrivalTimeEl
			? arrivalTimeEl.textContent
			: "--:--";
		const finalDepartureTime = departureTimeEl
			? departureTimeEl.textContent
			: "--:--";
		saveFlightTimesToLocalStorage(cellId, finalArrivalTime, finalDepartureTime);

		console.log(
			`Kachel ${cellId} mit Flugdaten aktualisiert: ${originCode}→${destCode}, Abflug: ${departureTime}, Ankunft: ${arrivalTime}, Folgetags-Flug: ${isNextDayFlight}`
		);

		return true;
	} catch (error) {
		console.error(
			`Fehler beim Anwenden der Flugdaten auf Kachel ${cellId}:`,
			error
		);
		return false;
	}
}

/**
 * Speichert einen einzelnen Feldwert in localStorage
 * @param {number} cellId - Kachel-ID
 * @param {string} fieldType - Feldtyp (position, aircraft, arrivalTime, etc.)
 * @param {string} value - Zu speichernder Wert
 */
function saveFlightTimeValueToLocalStorage(cellId, fieldType, value) {
	try {
		// Sammle alle aktuellen Daten
		const currentData = collectAllHangarData();

		if (currentData && currentData.primaryTiles && currentData.secondaryTiles) {
			// Finde die entsprechende Kachel
			let targetTile = null;

			// Suche in primären Kacheln
			for (let tile of currentData.primaryTiles) {
				if (tile.tileId === cellId) {
					targetTile = tile;
					break;
				}
			}

			// Falls nicht gefunden, suche in sekundären Kacheln
			if (!targetTile) {
				for (let tile of currentData.secondaryTiles) {
					if (tile.tileId === cellId) {
						targetTile = tile;
						break;
					}
				}
			}

			if (targetTile) {
				// Aktualisiere den entsprechenden Feldwert
				switch (fieldType) {
					case "position":
						targetTile.position = value;
						break;
					case "aircraft":
						targetTile.aircraftId = value;
						break;
					case "arrivalTime":
						targetTile.arrivalTime = value;
						break;
					case "departureTime":
						targetTile.departureTime = value;
						break;
					case "notes":
						targetTile.notes = value;
						break;
					case "status":
						targetTile.status = value;
						break;
					default:
						console.warn(`Unbekannter Feldtyp: ${fieldType}`);
						return;
				}

				// Speichere in localStorage
				localStorage.setItem("hangarPlannerData", JSON.stringify(currentData));
				console.log(
					`💾 ${fieldType} für Kachel ${cellId} gespeichert: ${value}`
				);
			} else {
				console.warn(`Kachel ${cellId} nicht gefunden`);
			}
		} else {
			console.error("Keine gültigen Daten zum Aktualisieren gefunden");
		}
	} catch (error) {
		console.error(
			`Fehler beim Speichern von ${fieldType} für Kachel ${cellId}:`,
			error
		);
	}
}

// Alle kritischen Funktionen global verfügbar machen
window.saveFlightTimeValueToLocalStorage = saveFlightTimeValueToLocalStorage;
window.setupFlightTimeEventListeners = setupFlightTimeEventListeners;
window.setupUIEventListeners = setupUIEventListeners;
window.setupPrimaryTileEventListeners = setupPrimaryTileEventListeners;
window.initializeUI = initializeUI;
window.fetchAllAircraftData = fetchAllAircraftData;
window.fetchFlightButtonHandler = fetchFlightButtonHandler;
window.applyFlightDataToCell = applyFlightDataToCell;
window.updateAllInstancesOfAircraft = updateAllInstancesOfAircraft;

// HANGAR EVENTS OBJECT
window.hangarEvents = {
	setupFlightTimeEventListeners,
	setupUIEventListeners,
	setupPrimaryTileEventListeners,
	initializeUI,
	fetchAllAircraftData,
	fetchFlightButtonHandler,
	applyFlightDataToCell,
	updateAllInstancesOfAircraft,
	saveFlightTimeValueToLocalStorage,
};
