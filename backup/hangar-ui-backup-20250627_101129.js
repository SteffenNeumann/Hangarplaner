/**
 * hangar-ui.js
 * Enthält UI-bezogene Funktionen, Einstellungen und Rendering-Logik
 */

// UI-Einstellungen Modul
const uiSettings = {
	tilesCount: 8,
	secondaryTilesCount: 0,
	layout: 4,
	darkMode: false,
	zoomLevel: 100,
	tableView: false, // Neue Einstellung für die Tabellenansicht

	// Lädt Einstellungen aus dem LocalStorage (beibehalten)
	load: async function () {
		try {
			// Aus localStorage laden
			const savedSettingsJSON = localStorage.getItem("hangarPlannerSettings");
			if (savedSettingsJSON) {
				const settings = JSON.parse(savedSettingsJSON);
				this.layout = settings.layout || 4;
				this.darkMode = settings.darkMode || false;
				this.zoomLevel = settings.zoomLevel || 100;
				this.tableView = settings.tableView || false; // Neue Eigenschaft laden

				// UI-Elemente aktualisieren
				this.updateUIControls();

				// Dark Mode, Zoom und Tabellenansicht anwenden
				this.applyDarkMode(this.darkMode);
				this.applyZoomLevel(this.zoomLevel);
				this.applyViewMode(this.tableView); // Neue Funktion anwenden

				// Kachelwerte anwenden, falls vorhanden
				if (settings.tileValues && Array.isArray(settings.tileValues)) {
					this.applyTileValues(settings.tileValues);
				}

				console.log("Einstellungen aus LocalStorage geladen");
				return true;
			}
		} catch (error) {
			console.error(
				"Fehler beim Laden der Einstellungen aus LocalStorage:",
				error
			);
		}
		return false;
	},

	// Wendet die gespeicherten Kachelwerte auf die UI an
	applyTileValues: function (tileValues) {
		console.log(`Wende ${tileValues.length} gespeicherte Kachelwerte an...`);
		
		tileValues.forEach((tileValue) => {
			const cellId = tileValue.cellId;
			console.log(`Anwenden von Werten für Kachel ${cellId}:`, tileValue);
			
			// Position setzen
			const positionInput = document.getElementById(`hangar-position-${cellId}`);
			if (positionInput && tileValue.position) {
				positionInput.value = tileValue.position;
			}
			
			// Aircraft ID setzen
			const aircraftInput = document.getElementById(`aircraft-${cellId}`);
			if (aircraftInput && tileValue.aircraftId) {
				aircraftInput.value = tileValue.aircraftId;
			}
			
			// Manuelle Eingabe setzen
			const manualInput = document.getElementById(`manual-input-${cellId}`);
			if (manualInput && tileValue.manualInput) {
				manualInput.value = tileValue.manualInput;
			}
			
			// Zeit-Felder setzen
			const arrivalTimeInput = document.getElementById(`arrival-time-${cellId}`);
			if (arrivalTimeInput && tileValue.arrivalTime) {
				arrivalTimeInput.value = tileValue.arrivalTime;
			}
			
			const departureTimeInput = document.getElementById(`departure-time-${cellId}`);
			if (departureTimeInput && tileValue.departureTime) {
				departureTimeInput.value = tileValue.departureTime;
			}
			
			// Status setzen
			const statusSelect = document.getElementById(`status-${cellId}`);
			if (statusSelect && tileValue.status) {
				statusSelect.value = tileValue.status;
				// Status-Licht aktualisieren
				if (typeof updateStatusLights === 'function') {
					updateStatusLights(cellId);
				}
			}
			
			// Notizen setzen
			const notesTextarea = document.getElementById(`notes-${cellId}`);
			if (notesTextarea && tileValue.notes) {
				notesTextarea.value = tileValue.notes;
			}
		});
	},

	// Speichert Einstellungen in localStorage (beibehalten) und optional als Datei
	save: async function (exportToFile = false) {
		try {
			// Aktuelle Werte aus den Eingabefeldern holen
			if (checkElement("tilesCount")) {
				this.tilesCount =
					parseInt(document.getElementById("tilesCount").value) || 8;
			}
			if (checkElement("secondaryTilesCount")) {
				this.secondaryTilesCount =
					parseInt(document.getElementById("secondaryTilesCount").value) || 0;
			}
			if (checkElement("layoutType")) {
				this.layout =
					parseInt(document.getElementById("layoutType").value) || 4;
			}
			if (checkElement("darkModeToggle")) {
				this.darkMode = document.getElementById("darkModeToggle").checked;
			}
			if (checkElement("viewModeToggle")) {
				// Neue Eigenschaft auslesen
				this.tableView = document.getElementById("viewModeToggle").checked;
			}
			if (checkElement("displayZoom")) {
				this.zoomLevel =
					parseInt(document.getElementById("displayZoom").value) || 100;
			}

			// Alle Kacheln sammeln (primäre und sekundäre)
			const tileValues = [];

			// Sammle Daten von primären Kacheln
			this.collectTileValues("#hangarGrid", tileValues, 1);

			// Sammle Daten von sekundären Kacheln
			this.collectTileValues("#secondaryHangarGrid", tileValues, 101);

			// Einstellungsobjekt erstellen
			const settingsData = {
				tilesCount: this.tilesCount,
				secondaryTilesCount: this.secondaryTilesCount,
				layout: this.layout,
				darkMode: this.darkMode,
				zoomLevel: this.zoomLevel,
				tableView: this.tableView, // Neue Eigenschaft speichern
				tileValues: tileValues,
				lastSaved: new Date().toISOString(),
			};

			// Im LocalStorage speichern - mit Fallback-Methode
			try {
				// Zuerst versuchen, den vorgesehenen helpers.storageHelper zu verwenden
				if (
					window.helpers &&
					window.helpers.storageHelper &&
					typeof window.helpers.storageHelper.set === "function"
				) {
					window.helpers.storageHelper.set(
						"hangarPlannerSettings",
						settingsData
					);
				} else {
					// Fallback: Direkt localStorage verwenden
					localStorage.setItem(
						"hangarPlannerSettings",
						JSON.stringify(settingsData)
					);
				}
				console.log("Einstellungen im LocalStorage gespeichert");
			} catch (storageError) {
				console.error("Fehler beim Speichern im localStorage:", storageError);
			}

			// Optional als Datei exportieren wenn gewünscht
			if (exportToFile && window.fileManager) {
				const fileName = "HangarPlan_Settings";

				try {
					await window.fileManager.saveProject({
						metadata: {
							projectName: "HangarPlan_Settings",
							exportDate: new Date().toISOString(),
						},
						settings: settingsData,
					});

					showNotification("Einstellungen erfolgreich gespeichert!", "success");
				} catch (error) {
					if (error.name !== "AbortError") {
						console.error("Fehler beim Speichern der Einstellungen:", error);
						showNotification(
							`Fehler beim Speichern: ${error.message}`,
							"error"
						);
					}
				}
			}
			return true;
		} catch (error) {
			console.error("Fehler beim Speichern der Einstellungen:", error);
			showNotification(`Fehler beim Speichern: ${error.message}`, "error");
			return false;
		}
	},

	/**
	 * Sammelt Werte von Kacheln in einem bestimmten Container
	 * @param {string} containerSelector - CSS-Selektor für den Container
	 * @param {Array} tileValues - Array zum Sammeln der Werte
	 * @param {number} startIndex - Startindex für die Kachel-IDs
	 */
	collectTileValues: function (containerSelector, tileValues, startIndex) {
		try {
			const container = document.querySelector(containerSelector);
			if (!container) {
				console.warn(`Container ${containerSelector} nicht gefunden`);
				return;
			}

			const cells = container.querySelectorAll(".hangar-cell");
			cells.forEach((cell, index) => {
				if (cell.classList.contains("hidden")) return;

				const cellId = startIndex + index;

				// Position sammeln
				const positionInput = document.getElementById(
					`hangar-position-${cellId}`
				);
				const position = positionInput ? positionInput.value : "";

				// Aircraft ID sammeln
				const aircraftInput = document.getElementById(`aircraft-${cellId}`);
				const aircraftId = aircraftInput ? aircraftInput.value : "";

				// Manuelle Eingabe sammeln
				const manualInput = document.getElementById(`manual-input-${cellId}`);
				const manualInputValue = manualInput ? manualInput.value : "";

				// Status sammeln
				const statusSelect = document.getElementById(`status-${cellId}`);
				const status = statusSelect ? statusSelect.value : "ready";

				// Zeit-Felder sammeln
				const arrivalTimeInput = document.getElementById(`arrival-time-${cellId}`);
				const arrivalTime = arrivalTimeInput ? arrivalTimeInput.value : "";
				
				const departureTimeInput = document.getElementById(`departure-time-${cellId}`);
				const departureTime = departureTimeInput ? departureTimeInput.value : "";

				// Notizen sammeln
				const notesTextarea = document.getElementById(`notes-${cellId}`);
				const notes = notesTextarea ? notesTextarea.value : "";

				// Nur hinzufügen wenn mindestens ein Wert vorhanden ist
				if (
					position ||
					aircraftId ||
					manualInputValue ||
					arrivalTime ||
					departureTime ||
					notes ||
					status !== "ready"
				) {
					tileValues.push({
						cellId: cellId,
						position: position,
						aircraftId: aircraftId,
						manualInput: manualInputValue,
						arrivalTime: arrivalTime,
						departureTime: departureTime,
						status: status,
						notes: notes,
					});
				}
			});
		} catch (error) {
			console.error(
				`Fehler beim Sammeln der Kachelwerte für ${containerSelector}:`,
				error
			);
		}
	},

	// Wendet die Einstellungen auf die UI an
	apply: function () {
		try {
			// Grid-Layout für primäre Kacheln aktualisieren
			const hangarGrid = document.getElementById("hangarGrid");
			if (hangarGrid) {
				hangarGrid.className = `grid gap-[var(--grid-gap)]`;
				hangarGrid.style.gridTemplateColumns = `repeat(${this.layout}, minmax(var(--card-min-width), 1fr))`;
			} else {
				console.error("Element 'hangarGrid' nicht gefunden!");
			}

			// Kacheln ein-/ausblenden basierend auf der gewählten Anzahl
			const cells = document.querySelectorAll("#hangarGrid .hangar-cell");
			cells.forEach((cell, index) => {
				if (index < this.tilesCount) {
					cell.classList.remove("hidden");
				} else {
					cell.classList.add("hidden");
				}
			});

			// Sekundäre Kacheln aktualisieren
			updateSecondaryTiles(this.secondaryTilesCount, this.layout);

			// Dark Mode und Zoom anwenden
			this.applyDarkMode(this.darkMode);
			this.applyZoomLevel(this.zoomLevel);
			this.applyViewMode(this.tableView); // Neue Funktion anwenden

			// Skalierung nach Layoutänderung neu berechnen
			setTimeout(adjustScaling, 50);
			return true;
		} catch (error) {
			console.error("Fehler beim Anwenden der Einstellungen:", error);
			return false;
		}
	},

	// Aktualisiert die UI-Steuerelemente
	updateUIControls: function () {
		if (checkElement("tilesCount")) {
			document.getElementById("tilesCount").value = this.tilesCount;
		}
		if (checkElement("secondaryTilesCount")) {
			document.getElementById("secondaryTilesCount").value =
				this.secondaryTilesCount;
		}
		if (checkElement("layoutType")) {
			document.getElementById("layoutType").value = this.layout;
		}
		if (checkElement("darkModeToggle")) {
			document.getElementById("darkModeToggle").checked = this.darkMode;
		}
		if (checkElement("viewModeToggle")) {
			// Neues Element aktualisieren
			document.getElementById("viewModeToggle").checked = this.tableView;
		}
		if (checkElement("displayZoom")) {
			document.getElementById("displayZoom").value = this.zoomLevel;
			document.getElementById("zoomValue").textContent = `${this.zoomLevel}%`;
		}
	},

	// Dark Mode anwenden
	applyDarkMode: function (enabled) {
		const body = document.body;

		if (enabled) {
			body.classList.add("dark-mode");
		} else {
			body.classList.remove("dark-mode");
		}

		// Status speichern
		this.darkMode = enabled;

		// Benachrichtigung, wenn Debugmodus aktiv ist
		if (localStorage.getItem("debugMode") === "true") {
			console.log(`Dark Mode ${enabled ? "aktiviert" : "deaktiviert"}`);
		}
	},

	// Zoom-Level anwenden
	applyZoomLevel: function (level) {
		const contentContainer = document.querySelector(".content-container");
		if (!contentContainer) return;

		// Zoom-Wert zwischen 0.75 und 1.5 setzen
		const zoomFactor = level / 100;
		contentContainer.style.transformOrigin = "top left";
		contentContainer.style.transform = `scale(${zoomFactor})`;

		// Bei größeren Zoom-Werten muss der Container erweitert werden
		if (zoomFactor > 1) {
			contentContainer.style.width = `${100 / zoomFactor}%`;
		} else {
			contentContainer.style.width = "100%";
		}

		// Aktuellen Wert anzeigen
		if (checkElement("zoomValue")) {
			document.getElementById("zoomValue").textContent = `${level}%`;
		}

		// Status speichern
		this.zoomLevel = level;

		// Benachrichtigung, wenn Debugmodus aktiv ist
		if (localStorage.getItem("debugMode") === "true") {
			console.log(`Zoom-Level auf ${level}% gesetzt`);
		}

		// Skalierung nach Zoom-Änderung neu berechnen
		setTimeout(adjustScaling, 50);
	},

	// NEUE FUNKTION: Tabellenansicht umschalten
	applyViewMode: function (tableViewEnabled) {
		const body = document.body;

		if (tableViewEnabled) {
			body.classList.add("table-view");
		} else {
			body.classList.remove("table-view");
		}

		// Status speichern
		this.tableView = tableViewEnabled;

		// Layout nach Änderung des Anzeigemodus anpassen
		setTimeout(() => {
			adjustScaling();

			// Spezielle Anpassungen für Tabellenansicht
			if (tableViewEnabled) {
				// Für Tabellenansicht die Zeilen etwas enger setzen
				document.documentElement.style.setProperty("--grid-gap", "8px");
			} else {
				// Für Kachelansicht normale Abstände wiederherstellen
				document.documentElement.style.setProperty("--grid-gap", "16px");
			}
		}, 50);

		// Debug-Ausgabe
		if (localStorage.getItem("debugMode") === "true") {
			console.log(
				`Ansichtsmodus auf "${tableViewEnabled ? "Tabelle" : "Kachel"}" gesetzt`
			);
		}
	},

	// Wendet die gespeicherten Kachelwerte auf die UI an
	applyTileValues: function (tileValues) {
		console.log(`Wende ${tileValues.length} gespeicherte Kachelwerte an...`);
		
		tileValues.forEach((tileValue) => {
			const cellId = tileValue.cellId;
			console.log(`Anwenden von Werten für Kachel ${cellId}:`, tileValue);
			
			// Position setzen
			const positionInput = document.getElementById(`hangar-position-${cellId}`);
			if (positionInput && tileValue.position) {
				positionInput.value = tileValue.position;
			}
			
			// Aircraft ID setzen
			const aircraftInput = document.getElementById(`aircraft-${cellId}`);
			if (aircraftInput && tileValue.aircraftId) {
				aircraftInput.value = tileValue.aircraftId;
			}
			
			// Manuelle Eingabe setzen
			const manualInput = document.getElementById(`manual-input-${cellId}`);
			if (manualInput && tileValue.manualInput) {
				manualInput.value = tileValue.manualInput;
			}
			
			// Zeit-Felder setzen
			const arrivalTimeInput = document.getElementById(`arrival-time-${cellId}`);
			if (arrivalTimeInput && tileValue.arrivalTime) {
				arrivalTimeInput.value = tileValue.arrivalTime;
			}
			
			const departureTimeInput = document.getElementById(`departure-time-${cellId}`);
			if (departureTimeInput && tileValue.departureTime) {
				departureTimeInput.value = tileValue.departureTime;
			}
			
			// Status setzen
			const statusSelect = document.getElementById(`status-${cellId}`);
			if (statusSelect && tileValue.status) {
				statusSelect.value = tileValue.status;
				// Status-Licht aktualisieren
				if (typeof updateStatusLights === 'function') {
					updateStatusLights(cellId);
				}
			}
			
			// Notizen setzen
			const notesTextarea = document.getElementById(`notes-${cellId}`);
			if (notesTextarea && tileValue.notes) {
				notesTextarea.value = tileValue.notes;
			}
		});
	}
};

/**
 * Formatiert die Aircraft ID:
 * - Konvertiert zu Großbuchstaben
 * - Fügt nach dem ersten Buchstaben einen Bindestrich ein, falls nicht vorhanden
 *
 * @param {string} input - Die eingegebene Aircraft ID
 * @returns {string} - Die formatierte Aircraft ID
 */
function formatAircraftId(input) {
	if (!input) return input;

	// Zu Großbuchstaben konvertieren
	input = input.toUpperCase();

	// Prüfen, ob bereits ein Bindestrich vorhanden ist
	if (input.length > 1 && !input.includes("-")) {
		// Bindestrich nach dem ersten Buchstaben einfügen
		input = input.charAt(0) + "-" + input.substring(1);
	}

	return input;
}

/**
 * Fügt Event-Listener für die Formatierung der Aircraft ID zu allen entsprechenden Eingabefeldern hinzu
 */
function setupAircraftIdFormatting() {
	const aircraftIdInputs = document.querySelectorAll(".aircraft-id");

	aircraftIdInputs.forEach((input) => {
		// Format bei Eingabe anwenden
		input.addEventListener("input", function () {
			const formattedValue = formatAircraftId(this.value);
			// Nur aktualisieren, wenn sich der Wert tatsächlich geändert hat
			if (formattedValue !== this.value) {
				this.value = formattedValue;
			}
		});

		// Format beim Verlassen des Feldes anwenden (für den Fall, dass die Eingabe anders erfolgt)
		input.addEventListener("blur", function () {
			this.value = formatAircraftId(this.value);
		});
	});

	console.log(
		`Aircraft ID-Formatierung für ${aircraftIdInputs.length} Eingabefelder eingerichtet`
	);
}

/**
 * Aktualisiert die sekundären Kacheln basierend auf der eingestellten Anzahl
 * @param {number} count - Anzahl der sekundären Kacheln
 * @param {number} layout - Anzahl der Spalten
 */
function updateSecondaryTiles(count, layout) {
	const secondaryGrid = document.getElementById("secondaryHangarGrid");
	if (!secondaryGrid) {
		console.error("Sekundärer Grid-Container nicht gefunden");
		return;
	}

	// Speichere vorhandene Daten vor dem Leeren
	const existingData = [];
	if (secondaryGrid.children.length > 0) {
		console.log("Sichere bestehende sekundäre Kacheldaten vor Aktualisierung");
		secondaryGrid.querySelectorAll(".hangar-cell").forEach((cell, index) => {
			const cellId = 101 + index;
			const posInput = document.getElementById(`hangar-position-${cellId}`);
			const aircraftInput = document.getElementById(`aircraft-${cellId}`);
			const manualInput = document.getElementById(`manual-input-${cellId}`);

			if (posInput || aircraftInput || manualInput) {
				existingData.push({
					index: index,
					cellId: cellId,
					position: posInput ? posInput.value : "",
					aircraftId: aircraftInput ? aircraftInput.value : "",
					manualInput: manualInput ? manualInput.value : "",
				});
			}
		});
		console.log(`${existingData.length} bestehende Kacheldaten gesichert`);
	}

	// Leere den Container
	secondaryGrid.innerHTML = "";

	// Sichtbarkeit der sekundären Sektion steuern
	toggleSecondarySection(count > 0);

	// Wenn keine sekundären Kacheln, früh beenden
	if (count <= 0) return;

	// Template für sekundäre Kacheln basierend auf der ersten primären Kachel erstellen
	const templateCell = document.querySelector("#hangarGrid .hangar-cell");
	if (!templateCell) {
		console.error("Keine Vorlage für sekundäre Kacheln gefunden");
		return;
	}

	// Erstelle die gewünschte Anzahl an sekundären Kacheln
	for (let i = 0; i < count; i++) {
		const cellId = 101 + i; // Start bei 101 für sekundäre Kacheln

		// Klone die Vorlage-Kachel
		const cellClone = templateCell.cloneNode(true);

		// WICHTIG: Setze explizit das data-cell-id Attribut für korrekte Identifizierung
		cellClone.setAttribute("data-cell-id", cellId.toString());
		cellClone.id = `secondary-cell-${cellId}`;
		if (posInput) {
			posInput.id = `hangar-position-${cellId}`;
			posInput.value = ""; // Explizit leeres Feld für neue sekundäre Kacheln
		} else {
			console.warn(
				`Position-Input in Template für Kachel ${cellId} nicht gefunden`
			);
		}

		// Aircraft-ID Feld leeren
		const aircraftInput = cellClone.querySelector(".aircraft-id, input[id^='aircraft-']");
		if (aircraftInput) {
			aircraftInput.value = "";
			aircraftInput.id = `aircraft-${cellId}`;
		}

		// Zeit-Felder explizit leeren
		const arrivalTimeInput = cellClone.querySelector('input[id^="arrival-time-"]');
		if (arrivalTimeInput) {
			arrivalTimeInput.value = "";
			arrivalTimeInput.id = `arrival-time-${cellId}`;
		}

		const departureTimeInput = cellClone.querySelector('input[id^="departure-time-"]');
		if (departureTimeInput) {
			departureTimeInput.value = "";
			departureTimeInput.id = `departure-time-${cellId}`;
		}

		// Manual Input leeren
		const manualInput = cellClone.querySelector('input[placeholder="Manual Input"]');
		if (manualInput) {
			manualInput.value = "";
			manualInput.id = `manual-input-${cellId}`;
		}onst aircraftIdInputs = document.querySelectorAll(".aircraft-id");

		aircraftIdInputs.forEach((input) => {
			// Format bei Eingabe anwenden
			input.addEventListener("input", function () {
				const formattedValue = formatAircraftId(this.value);
				// Nur aktualisieren, wenn sich der Wert tatsächlich geändert hat
				if (formattedValue !== this.value) {
					this.value = formattedValue;
				}
			});

			// Format beim Verlassen des Feldes anwenden (für den Fall, dass die Eingabe anders erfolgt)
			input.addEventListener("blur", function () {
				this.value = formatAircraftId(this.value);
			});
		});

		console.log(
			`Aircraft ID-Formatierung für ${aircraftIdInputs.length} Eingabefelder eingerichtet`
		);
	},

	/**
	 * Aktualisiert die sekundären Kacheln basierend auf der eingestellten Anzahl
	 * @param {number} count - Anzahl der sekundären Kacheln
	 * @param {number} layout - Anzahl der Spalten
	 */
	function updateSecondaryTiles(count, layout) {
		const secondaryGrid = document.getElementById("secondaryHangarGrid");
		if (!secondaryGrid) {
			console.error("Sekundärer Grid-Container nicht gefunden");
			return;
		}

		// Speichere vorhandene Daten vor dem Leeren
		const existingData = [];
		if (secondaryGrid.children.length > 0) {
			console.log("Sichere bestehende sekundäre Kacheldaten vor Aktualisierung");
			secondaryGrid.querySelectorAll(".hangar-cell").forEach((cell, index) => {
				const cellId = 101 + index;
				const posInput = document.getElementById(`hangar-position-${cellId}`);
				const aircraftInput = document.getElementById(`aircraft-${cellId}`);
				const manualInput = document.getElementById(`manual-input-${cellId}`);

				if (posInput || aircraftInput || manualInput) {
					existingData.push({
						index: index,
						cellId: cellId,
						position: posInput ? posInput.value : "",
						aircraftId: aircraftInput ? aircraftInput.value : "",
						manualInput: manualInput ? manualInput.value : "",
					});
				}
			});
			console.log(`${existingData.length} bestehende Kacheldaten gesichert`);
		}

		// Leere den Container
		secondaryGrid.innerHTML = "";

		// Sichtbarkeit der sekundären Sektion steuern
		toggleSecondarySection(count > 0);

		// Wenn keine sekundären Kacheln, früh beenden
		if (count <= 0) return;

		// Template für sekundäre Kacheln basierend auf der ersten primären Kachel erstellen
		const templateCell = document.querySelector("#hangarGrid .hangar-cell");
		if (!templateCell) {
			console.error("Keine Vorlage für sekundäre Kacheln gefunden");
			return;
		}

		// Erstelle die gewünschte Anzahl an sekundären Kacheln
		for (let i = 0; i < count; i++) {
			const cellId = 101 + i; // Start bei 101 für sekundäre Kacheln

			// Klone die Vorlage-Kachel
			const cellClone = templateCell.cloneNode(true);

			// WICHTIG: Setze explizit das data-cell-id Attribut für korrekte Identifizierung
			cellClone.setAttribute("data-cell-id", cellId.toString());
			cellClone.id = `secondary-cell-${cellId}`;

			// Alle Event-Listener aus dem Clone entfernen, um Duplikate zu vermeiden
			const allInputs = cellClone.querySelectorAll("input, select, textarea");
			allInputs.forEach((input) => {
				const newInput = input.cloneNode(true);
				input.parentNode.replaceChild(newInput, input);
			});

			// Spezifische Anpassungen für sekundäre Kacheln
			// Position-Input finden oder ggf. erstellen
			const posInput = cellClone.querySelector('input[id^="hangar-position-"]');
			if (posInput) {
				posInput.id = `hangar-position-${cellId}`;
				posInput.value = ""; // Leeres Feld für neue sekundäre Kacheln
			} else {
				console.warn(
					`Position-Input in Template für Kachel ${cellId} nicht gefunden`
				);
			}

			// Aircraft-ID Feld leeren
			const aircraftInput = cellClone.querySelector(".aircraft-id");
			if (aircraftInput) {
				aircraftInput.value = "";
				aircraftInput.id = `aircraft-${cellId}`;
			}

			// IDs und andere Attribute aktualisieren
			updateCellAttributes(cellClone, cellId);

			// Füge die Kachel zum sekundären Grid hinzu
			secondaryGrid.appendChild(cellClone);
		}

		// Initialisiere Status-Handler für neue Kacheln
		setupSecondaryTileEventListeners();

		// Verzögertes Anwenden der gespeicherten Werte auf sekundäre Kacheln
		setTimeout(() => {
			// Gesicherte Daten wiederherstellen - ABER NICHT während einer Server-Synchronisation
			if (existingData.length > 0) {
				if (!window.isApplyingServerData) {
					console.log("Stelle gesicherte sekundäre Kacheldaten wieder her");
					existingData.forEach((data) => {
						// Nur wiederherstellen, wenn der Index noch gültig ist (im Bereich der neuen Anzahl)
						if (data.index < count) {
							const posInput = document.getElementById(
								`hangar-position-${data.cellId}`
							);
							const aircraftInput = document.getElementById(
								`aircraft-${data.cellId}`
							);
							const manualInput = document.getElementById(
								`manual-input-${data.cellId}`
							);

							if (posInput) posInput.value = data.position;
							if (aircraftInput) aircraftInput.value = data.aircraftId;
							if (manualInput) manualInput.value = data.manualInput;
							console.log(
								`Wiederhergestellt: Kachel ${data.cellId}, Position=${data.position}, Aircraft=${data.aircraftId}`
							);
						}
					});
				} else {
					console.log(
						"Wiederherstellung sekundärer Kacheldaten übersprungen: Server-Synchronisation läuft"
					);
				}
			}

			// CustomEvent auslösen, um andere Komponenten zu informieren
			const event = new CustomEvent("secondaryTilesCreated", {
				detail: { count: count },
			});
			document.dispatchEvent(event);

			// Sicherstellen, dass die aktualisierten sekundären Kacheleinstellungen gespeichert werden
			if (window.hangarUI && window.hangarUI.uiSettings) {
				window.hangarUI.uiSettings.secondaryTilesCount = count;

				// Speichern im localStorage verzögern, um alle DOM-Änderungen abzuwarten
				setTimeout(() => {
					window.hangarUI.uiSettings.save.call(window.hangarUI.uiSettings);
				}, 300);
			}
		}, 200);

		// Event-Listener für das Anwenden der Positionswerte nach dem Erstellen der Kacheln
		if (!window._secondaryTilesCreatedListenerAdded) {
			window._secondaryTilesCreatedListenerAdded = true;
			document.addEventListener("secondaryTilesCreated", function () {
				// Lade und setze die Positionswerte für sekundäre Kacheln
				if (typeof loadSecondaryTileValues === "function") {
					loadSecondaryTileValues();
				}

				// Nach dem Erstellen von sekundären Kacheln auch die Aircraft ID-Formatierung anwenden
				setupAircraftIdFormatting();
			});
		}
	},

	/**
	 * Lädt speziell die Positionswerte für sekundäre Kacheln
	 */
	function loadSecondaryTileValues() {
		// Nicht während einer Server-Synchronisation ausführen
		if (window.isApplyingServerData) {
			console.log(
				"loadSecondaryTileValues übersprungen: Server-Synchronisation läuft"
			);
			return;
		}

		const savedSettingsJSON = localStorage.getItem("hangarPlannerSettings");
		if (!savedSettingsJSON) return;

		try {
			const settings = JSON.parse(savedSettingsJSON);
			if (!settings.tileValues || !Array.isArray(settings.tileValues)) return;

			// Filtere nur die sekundären Kacheln (ID >= 101)
			const secondaryTileValues = settings.tileValues.filter(
				(tile) => tile.cellId >= 101
			);

			// Debug: Was wurde exakt gefunden?
			console.log(`Lade ${secondaryTileValues.length} sekundäre Kachelwerte:`);
			secondaryTileValues.forEach((tile) => {
				console.log(
					`  Kachel ${tile.cellId}: Position=${tile.position}, Aircraft=${tile.aircraftId}`
				);
			});

			// Vor dem Anwenden prüfen, ob sekundäre Kacheln existieren
			const secondaryGrid = document.getElementById("secondaryHangarGrid");
			if (!secondaryGrid || secondaryGrid.children.length === 0) {
				console.warn(
					"Sekundäres Grid nicht gefunden oder leer, kann Werte nicht anwenden"
				);
				return;
			}

			// Werte auf sekundäre Kacheln anwenden
			secondaryTileValues.forEach((tileValue) => {
				// Der Index für die sekundäre Kachel
				const secondaryIndex = tileValue.cellId - 101;

				// Prüfen ob der Index gültig ist (innerhalb der vorhandenen Kacheln)
				if (
					secondaryIndex >= secondaryGrid.children.length ||
					secondaryIndex < 0
				) {
					console.warn(
						`Kein Element für sekundären Index ${secondaryIndex} (ID: ${tileValue.cellId}) vorhanden`
					);
					return;
				}

				// Position-Eingabe finden und setzen
				const posInput = document.getElementById(
					`hangar-position-${tileValue.cellId}`
				);
				if (posInput && tileValue.position) {
					posInput.value = tileValue.position;
					console.log(
						`Sekundäre Position für Kachel ${tileValue.cellId} gesetzt: ${tileValue.position}`
					);
				}

				// Aircraft-ID setzen (falls vorhanden)
				const aircraftInput = document.getElementById(
					`aircraft-${tileValue.cellId}`
				);
				if (aircraftInput && tileValue.aircraftId) {
					aircraftInput.value = tileValue.aircraftId;
					console.log(
						`Sekundäre Aircraft-ID für Kachel ${tileValue.cellId} gesetzt: ${tileValue.aircraftId}`
					);
				}

				// Manuelle Eingabe setzen (falls vorhanden)
				const manualInput = document.getElementById(
					`manual-input-${tileValue.cellId}`
				);
				if (manualInput && tileValue.manualInput) {
					manualInput.value = tileValue.manualInput;
					console.log(
						`Sekundäre manuelle Eingabe für Kachel ${tileValue.cellId} gesetzt`
					);
				}

				// Zeit-Felder setzen (falls vorhanden)
				const arrivalTimeInput = document.getElementById(
					`arrival-time-${tileValue.cellId}`
				);
				if (arrivalTimeInput && tileValue.arrivalTime) {
					arrivalTimeInput.value = tileValue.arrivalTime;
					console.log(
						`Sekundäre Ankunftszeit für Kachel ${tileValue.cellId} gesetzt: ${tileValue.arrivalTime}`
					);
				}

				const departureTimeInput = document.getElementById(
					`departure-time-${tileValue.cellId}`
				);
				if (departureTimeInput && tileValue.departureTime) {
					departureTimeInput.value = tileValue.departureTime;
					console.log(
						`Sekundäre Abflugzeit für Kachel ${tileValue.cellId} gesetzt: ${tileValue.departureTime}`
					);
				}
			});
		} catch (error) {
			console.error("Fehler beim Laden der sekundären Kachelwerte:", error);
		}
	},

	/**
	 * Aktualisiert die Attribute einer Kachel
	 * @param {HTMLElement} cell - Die zu aktualisierende Kachel
	 * @param {number} cellId - ID für die Kachel
	 */
	function updateCellAttributes(cell, cellId) {
		// Wichtig: Explizit auch hier nochmal das data-cell-id Attribut setzen
		cell.setAttribute("data-cell-id", cellId.toString());

		// Aktualisiere ID-basierte Attribute in allen Unterelementen
		const elements = cell.querySelectorAll("[id]");
		elements.forEach((element) => {
			const oldId = element.id;
			const parts = oldId.split("-");
			const base = parts[0]; // z.B. 'aircraft', 'status', 'arrival', 'departure'

			// Spezielle Behandlung für Zeit-Felder (arrival-time-X, departure-time-X)
			if (
				parts.length >= 3 &&
				(base === "arrival" || base === "departure") &&
				parts[1] === "time"
			) {
				element.id = `${base}-time-${cellId}`;
				// Werte für sekundäre Kacheln zurücksetzen
				element.value = "";
				// Event-Listener für automatisches Speichern hinzufügen
				element.removeEventListener("change", element._timeChangeHandler);
				element._timeChangeHandler = function () {
					console.log(
						`Zeit in Kachel ${cellId} geändert: ${this.id} = ${this.value}`
					);
					if (typeof window.hangarUI.uiSettings.save === "function") {
						setTimeout(
							() =>
								window.hangarUI.uiSettings.save.call(window.hangarUI.uiSettings),
							100
						);
					}
				};
				element.addEventListener("change", element._timeChangeHandler);
			}
			// Normale ID-Aktualisierung für andere Elemente
			else {
				element.id = `${base}-${cellId}`;

				// Werte für sekundäre Kacheln zurücksetzen (außer Position, die separat behandelt wird)
				if (cellId >= 101 && element.tagName === "INPUT" && base !== "hangar") {
					element.value = "";
				}
			}

			// Wenn es ein Status-Select ist, setzen wir die Eventhandler neu
			if (base === "status") {
				// Sicherstellen, dass der neutrale Status ausgewählt ist für sekundäre Kacheln
				element.value = "neutral";
				// Status-Licht aktualisieren
				element.onchange = function () {
					updateStatusLights(cellId);
				};
				// Initial den Status setzen
				updateStatusLights(cellId);
			}

			// Wenn es ein Towing-Status-Select ist, auch hier neutralen Status setzen
			if (base === "tow-status") {
				// Sicherstellen, dass der neutrale Status ausgewählt ist
				element.value = "neutral";
				// Towing-Status-Styles aktualisieren
				updateTowStatusStyles(element);
			}
		});

		// Aktualisiere data-cell Attribute für Status-Lichter
		const statusLights = cell.querySelectorAll(".status-light");
		statusLights.forEach((light) => {
			light.setAttribute("data-cell", cellId);
		});

		// Verbesserte Suche nach dem Positionseingabefeld - wichtig für sekundäre Kacheln
		let positionInput = cell.querySelector('input[id^="hangar-position-"]');

		// Wenn mit der alten ID nichts gefunden wurde, versuchen wir es mit anderen Selektoren
		if (!positionInput) {
			// Suche nach dem ersten Textfeld in der Kachel
			const inputs = cell.querySelectorAll('input[type="text"]');
			for (const input of inputs) {
				// Wenn es nicht das Manual Input ist, dann ist es wahrscheinlich das Positionsfeld
				if (!input.placeholder || input.placeholder !== "Manual Input") {
					positionInput = input;
					break;
				}
			}

			// Falls immer noch nichts gefunden wurde, suche nach dem ersten Input im Header
			if (!positionInput) {
				const headerContainer = cell.querySelector(".bg-industrial-medium");
				if (headerContainer) {
					const positionContainer =
						headerContainer.querySelector(".flex.items-center");
					if (positionContainer) {
						positionInput = positionContainer.querySelector("input");
					}
				}
			}
		}

		// Position eingabefeld gefunden - konfigurieren
		if (positionInput) {
			// Standardklassen entfernen und neue zuweisen
			positionInput.classList.remove(
				...Array.from(positionInput.classList).filter((cls) => /^w-\d+/.test(cls))
			);
			positionInput.classList.add("w-16");

			// Explizite ID-Zuweisung und Event-Handler für Position
			positionInput.id = `hangar-position-${cellId}`;
			console.log(`ID für Position-Eingabe gesetzt: ${positionInput.id}`);

			// Alte Event-Listener entfernen, um doppelte Aufrufe zu vermeiden
			positionInput.removeEventListener("blur", positionInput._saveHandler);
			positionInput.removeEventListener("change", positionInput._saveHandler);

			// Event-Handler für automatisches Speichern
			positionInput._saveHandler = function () {
				console.log(`Position in Kachel ${cellId} geändert: ${this.value}`);
				// Speichern mit höherer Priorität
				if (typeof window.hangarUI.uiSettings.save === "function") {
					// Positionswert im localStorage speichern
					const savedSettingsJSON = localStorage.getItem("hangarPlannerSettings");
					if (savedSettingsJSON) {
						try {
							const settings = JSON.parse(savedSettingsJSON);
							if (settings.tileValues && Array.isArray(settings.tileValues)) {
								// Vorhandene Einträge aktualisieren oder neuen hinzufügen
								const existingTileIndex = settings.tileValues.findIndex(
									(t) => t.cellId === cellId
								);
								if (existingTileIndex >= 0) {
									settings.tileValues[existingTileIndex].position = this.value;
								} else {
									settings.tileValues.push({
										cellId: cellId,
										position: this.value,
										manualInput: "",
									});
								}

								// Aktualisierte Einstellungen im localStorage speichern
								const updatedSettingsData = JSON.stringify(settings);
								localStorage.setItem(
									"hangarPlannerSettings",
									updatedSettingsData
								);
								console.log(
									`Position für Kachel ${cellId} direkt im localStorage aktualisiert`
								);
							}
						} catch (e) {
							console.error(
								"Fehler beim direkten Aktualisieren der Position:",
								e
							);
						}
					}

					// Vollständiges Speichern mit allen Daten
					setTimeout(
						() =>
							window.hangarUI.uiSettings.save.call(window.hangarUI.uiSettings),
						50
					);
				}
			};

			// Event-Listener für sofortiges Speichern
			positionInput.addEventListener("blur", positionInput._saveHandler);
			positionInput.addEventListener("change", positionInput._saveHandler);
		} else {
			console.warn(
				`Kein Position-Eingabefeld in Kachel ${cellId} gefunden - versuche ein neues zu erstellen`
			);

			// Versuchen wir ein neues Positionsfeld zu erstellen
			const headerContainer = cell.querySelector(".bg-industrial-medium");
			if (headerContainer) {
				const positionContainer =
					headerContainer.querySelector(".flex.items-center") ||
					headerContainer.querySelector(".position-container");

				if (positionContainer) {
					positionInput = document.createElement("input");
					positionInput.id = `hangar-position-${cellId}`;
					positionInput.type = "text";
					positionInput.className = "w-16 position-field";
					positionInput.placeholder = "Position";

					positionContainer.appendChild(positionInput);

					// Event-Handler für automatisches Speichern
					positionInput.addEventListener("blur", function () {
						console.log(
							`Position in neuer Kachel ${cellId} geändert: ${this.value}`
						);
						if (typeof window.hangarUI.uiSettings.save === "function") {
							setTimeout(
								() =>
									window.hangarUI.uiSettings.save.call(
										window.hangarUI.uiSettings
									),
								100
							);
						}
					});

					console.log(`Neues Positionseingabefeld für Kachel ${cellId} erstellt`);
				}
			}
		}

		// Einheitliche Breite für Manual Input und eindeutige ID + Event-Handler
		const manualInput = cell.querySelector('input[placeholder="Manual Input"]');
		if (manualInput) {
			// Breite setzen
			manualInput.classList.remove(
				...Array.from(manualInput.classList).filter((cls) => /^w-\d+/.test(cls))
			);
			manualInput.classList.add("w-16");

			// Eindeutige ID setzen und sicherstellen, dass sie korrekt ist
			manualInput.id = `manual-input-${cellId}`;
			console.log(`ID für manuelle Eingabe gesetzt: ${manualInput.id}`);

			// Event-Handler für automatisches Speichern hinzufügen
			manualInput.addEventListener("blur", function () {
				console.log(
					`Manuelle Eingabe in Kachel ${cellId} geändert: ${this.value}`
				);
				// Automatisches Speichern auslösen
				if (typeof window.hangarUI.uiSettings.save === "function") {
					setTimeout(
						() =>
							window.hangarUI.uiSettings.save.call(window.hangarUI.uiSettings),
						100
					);
				}
			});
		}
	},

	/**
	 * Initialisiert Event-Listener für sekundäre Kacheln
	 */
	function setupSecondaryTileEventListeners() {
		// Status-Selects für sekundäre Kacheln finden und Eventhandler zuweisen
		document
			.querySelectorAll('#secondaryHangarGrid select[id^="status-"]')
			.forEach((select) => {
				const cellId = parseInt(select.id.split("-")[1]);
				select.onchange = function () {
					updateStatusLights(cellId);
				};

				// Initialen Status setzen
				updateStatusLights(cellId);
			});

		// Event-Listener für Position-Eingabefelder in sekundären Kacheln
		document
			.querySelectorAll('#secondaryHangarGrid input[id^="hangar-position-"]')
			.forEach((input) => {
				const cellId = parseInt(input.id.split("-")[2]);
				console.log(
					`Event-Handler für Position in sekundärer Kachel ${cellId} eingerichtet`
				);

				// Event-Handler für automatisches Speichern
				input.addEventListener("blur", function () {
					console.log(
						`Position in sekundärer Kachel ${cellId} geändert: ${this.value}`
					);
					if (typeof window.hangarUI.uiSettings.save === "function") {
						setTimeout(
							() =>
								window.hangarUI.uiSettings.save.call(window.hangarUI.uiSettings),
							100
						);
					}
				});
			});

		// Event-Listener für manuelle Eingabefelder in sekundären Kacheln
		document
			.querySelectorAll('#secondaryHangarGrid input[placeholder="Manual Input"]')
			.forEach((input) => {
				// ID zuweisen, falls noch nicht vorhanden
				const cellId = parseInt(
					input
						.closest(".hangar-cell")
						.querySelector('[id^="status-"]')
						.id.split("-")[1]
				);
				if (!input.id) input.id = `manual-input-${cellId}`;

				// Event-Handler für automatisches Speichern
				input.addEventListener("blur", function () {
					console.log(
						`Manuelle Eingabe in sekundärer Kachel ${cellId} geändert: ${this.value}`
					);
					if (typeof window.hangarUI.uiSettings.save === "function") {
						setTimeout(
							() =>
								window.hangarUI.uiSettings.save.call(window.hangarUI.uiSettings),
							100
						);
					}
				});
			});
	},

	/**
	 * Verbesserte Funktion zur dynamischen Anpassung der Grid-Abstände ohne Skalierung der Kacheln
	 */
	function adjustScaling() {
		try {
			const isSidebarCollapsed =
				document.body.classList.contains("sidebar-collapsed");
			const windowWidth = window.innerWidth;
			const sidebarWidth = isSidebarCollapsed ? 48 : 320; // Angepasst auf die neue feste Sidebar-Breite
			const availableWidth = windowWidth - sidebarWidth;

			// Content-Container Breite anpassen
			const contentContainer = document.querySelector(".content-container");
			if (contentContainer) {
				contentContainer.style.width = `${availableWidth}px`;
				contentContainer.style.maxWidth = `${availableWidth}px`;
			}

			// Konstante Sektionsabstände definieren (kein Skalierungsfaktor mehr)
			const sectionSpacing = 16; // Fester Wert für alle Sektionsabstände
			document.documentElement.style.setProperty(
				"--section-spacing",
				`${sectionSpacing}px`
			);
			document.documentElement.style.setProperty(
				"--fixed-section-spacing",
				`${sectionSpacing}px`
			);

			// Grid-Abstände - Immer auf 16px setzen für konsistentes Layout
			let gridGap = 16; // Konstanter Wert statt Berechnung für Konsistenz
			document.documentElement.style.setProperty("--grid-gap", `${gridGap}px`);

			// WICHTIG: Feste Kachelgrößen definieren - nicht mehr dynamisch
			const cardBaseWidth = 150; // Reduziert von 180
			const cardMinWidth = 150; // Reduziert von 180
			const cardMaxWidth = 250; // Reduziert von 280

			document.documentElement.style.setProperty(
				"--card-base-width",
				`${cardBaseWidth}px`
			);
			document.documentElement.style.setProperty(
				"--card-min-width",
				`${cardMinWidth}px`
			);

			// Grid-Layout dynamisch anpassen basierend auf verfügbarer Breite
			// Anzahl der Spalten reduzieren statt Kacheln zu verkleinern
			let layout = window.hangarUI.uiSettings.layout || 4;

			// Dynamische Spaltenanzahl basierend auf verfügbarer Breite
			// und Mindestgröße der Kacheln berechnen
			const maxColumns = Math.floor(
				(availableWidth - gridGap) / (cardMinWidth + gridGap)
			);
			layout = Math.min(layout, Math.max(1, maxColumns));

			const hangarGrid = document.getElementById("hangarGrid");
			const secondaryGrid = document.getElementById("secondaryHangarGrid");

			// Gemeinsame Eigenschaften für beide Grids mit verbesserter Zentrierung
			const gridConfig = {
				transform: "none",
				width: "100%",
				gridTemplateColumns: `repeat(${layout}, minmax(${cardMinWidth}px, auto))`, // auto statt fit-content für konsistenterer Breiten
				gap: `16px`, // Explizit 16px
				display: "grid",
				justifyContent: "center", // Wichtig: Explizite Zentrierung
				alignItems: "start", // Ausrichtung oben für gleichmäßiges Layout
				margin: "0 auto",
			};

			// Primären Grid konfigurieren
			if (hangarGrid) {
				Object.assign(hangarGrid.style, gridConfig);
			}

			// Sekundären Grid identisch konfigurieren
			if (secondaryGrid && secondaryGrid.style.display !== "none") {
				Object.assign(secondaryGrid.style, gridConfig);
			}

			// Direkte Kachelgrößen beibehalten mit festen Werten
			applyTileSizes(cardMinWidth, cardMaxWidth);

			// Verbesserte Behandlung des Section Dividers - konsistente Abstände
			const sectionDivider = document.querySelector(".section-divider");
			if (sectionDivider) {
				sectionDivider.style.margin = `${sectionSpacing}px 0`;
				sectionDivider.style.transform = "none";
			}

			// Konsistente Abstände für alle Sektionsbeschriftungen
			const sectionLabels = document.querySelectorAll(".section-label");
			sectionLabels.forEach((label) => {
				if (!label.classList.contains("section-label-first")) {
					label.style.marginTop = `${sectionSpacing}px`;
				}
				label.style.marginBottom = `${sectionSpacing}px`;
			});

			// Sekundäre Sektion mit gleichem Abstand
			const secondarySection = document.querySelector(
				".section-container:nth-of-type(2)"
			);
			if (secondarySection) {
				secondarySection.style.marginTop = `${sectionSpacing}px`;
			}

			// Nach dem Toggle-Zustand der Sidebar prüfen und visuell anpassen
			const menuToggleBtn = document.getElementById("menuToggle");
			if (menuToggleBtn) {
				if (isSidebarCollapsed) {
					menuToggleBtn.classList.add("rotated");
				} else {
					menuToggleBtn.classList.remove("rotated");
				}
			}

			// Manual Inputs anpassen (ohne Skalierung, nur responsives Layout)
			adjustManualInputWidths();
		} catch (error) {
			console.error("Fehler bei der Layout-Anpassung:", error);
		}
	},

	/**
	 * Wendet die Größenanpassungen direkt auf Kacheln an
	 * @param {number} minWidth - Minimale Breite für Kacheln
	 * @param {number} maxWidth - Maximale Breite für Kacheln
	 */
	function applyTileSizes(minWidth, maxWidth) {
		try {
			const cells = document.querySelectorAll(".hangar-cell");

			cells.forEach((cell) => {
				// Verbessertes Layout mit zentrierung
				cell.style.minWidth = `${minWidth}px`;
				cell.style.width = "auto"; // auto statt fit-content für Konsistenz
				cell.style.maxWidth = `${maxWidth}px`;
				cell.style.margin = "0 auto"; // Zentrierung in der Zelle
				cell.style.justifySelf = "center"; // Zusätzliche Grid-Zentrierung

				// Deutlich kompaktere Innenabstände
				const contentDiv = cell.querySelector("div.p-4");
				if (contentDiv) {
					contentDiv.style.padding = "0.4rem"; // Sehr kompakt (war 0.6rem)
				}

				// Kompaktere Schriftgrößen für Aircraft ID
				const aircraftId = cell.querySelector(".aircraft-id");
				if (aircraftId) {
					aircraftId.style.fontSize = "1.5rem"; // Etwas kleiner (war 1.2rem)
					aircraftId.style.fontWeight = "600"; // Etwas fettere Schrift
					aircraftId.style.padding = "0.25rem"; // Reduziert (war 0.4rem)
					aircraftId.style.marginBottom = "0.25rem"; // Reduziert (war 0.6rem)
					aircraftId.style.color = "#2d3142"; // Dunklere Farbe für besseren Kontrast
					aircraftId.style.borderBottom = "none"; // Entfernen der unteren Trennlinie
				}

				// Entfernen der Headertrennlinie
				const cardHeader = cell.querySelector(".card-header");
				if (cardHeader) {
					cardHeader.style.borderBottom = "none";
				}

				// Notizfeld Rahmen entfernen
				const textarea = cell.querySelector("textarea");
				if (textarea) {
					textarea.style.border = "1px solid transparent"; // Unsichtbarer Rahmen
				}

				// Verstärkter äußerer Rahmen
				cell.style.boxShadow =
					"8px 8px 12px rgba(166, 166, 185, 0.25), -8px -8px 12px rgba(255, 255, 255, 0.7)";
				cell.style.border = "1px solid rgba(150, 150, 180, 0.25)";

				// Reduziere auch die Größen von Labels und Values
				cell.querySelectorAll(".info-label, .info-value").forEach((el) => {
					el.style.fontSize = "0.8rem";
				});
			});
		} catch (error) {
			console.error("Fehler bei der Größenanpassung der Kacheln:", error);
		}
	},

	/**
	 * Steuert die Sichtbarkeit der sekundären Sektion
	 * @param {boolean} show - Ob die sekundäre Sektion angezeigt werden soll
	 */
	function toggleSecondarySection(show) {
		const secondarySection = document.querySelector(
			".section-container:nth-of-type(2)"
		);
		const sectionDivider = document.querySelector(".section-divider");

		if (secondarySection) {
			secondarySection.style.display = show ? "block" : "none";
		}

		if (sectionDivider) {
			sectionDivider.style.display = show ? "block" : "none";
		}

		console.log(`Sekundäre Sektion ${show ? "eingeblendet" : "ausgeblendet"}`);
	},

	/**
	 * Aktualisiert die Statuslichter basierend auf der ausgewählten Option
	 * @param {number} cellId - ID der Kachel
	 */
	function updateStatusLights(cellId) {
		try {
			// Status-Auswahl finden
			const statusSelect = document.getElementById(`status-${cellId}`);
			if (!statusSelect) return;

			const selectedStatus = statusSelect.value;

			// Statuslicht für diese Kachel finden
			const statusLight = document.querySelector(
				`.status-light[data-cell="${cellId}"]`
			);

			if (statusLight) {
				// Alle Status-Klassen entfernen
				statusLight.classList.remove(
					"status-neutral",
					"status-ready",
					"status-maintenance",
					"status-aog"
				);
				// Neue Status-Klasse hinzufügen
				statusLight.classList.add(`status-${selectedStatus}`);
				// Status-Attribut aktualisieren
				statusLight.setAttribute("data-status", selectedStatus);
			}
		} catch (error) {
			console.error(
				`Fehler beim Aktualisieren des Statuslichts für Kachel ${cellId}:`,
				error
			);
		}
	},

	/**
	 * Hilfsfunktion zur Überprüfung der Existenz von DOM-Elementen
	 * @param {string} elementId - ID des Elements
	 * @returns {boolean} - Ob das Element existiert
	 */
	function checkElement(elementId) {
		return document.getElementById(elementId) !== null;
	},

	/**
	 * Debug-Funktion für Konsolen-Ausgaben
	 * @param {string} message - Die auszugebende Nachricht
	 */
	function debug(message) {
		if (localStorage.getItem("debugMode") === "true") {
			console.log(`[DEBUG] ${message}`);
		}
	},

	/**
	 * Angepasste Funktion für die Breite der Manual Input Felder
	 */
	function adjustManualInputWidths() {
		try {
			const manualInputs = document.querySelectorAll(
				'input[placeholder="Manual Input"]'
			);
			const windowWidth = window.innerWidth;

			manualInputs.forEach((input) => {
				const headerContainer = input.closest(".bg-industrial-medium");
				const statusContainer =
					headerContainer.querySelector(".status-container");
				const positionContainer =
					headerContainer.querySelector(".flex.items-center");

				// Kleinere Breakpoint-Schwelle für frühere Umschaltung zum Stapellayout
				if (windowWidth < 1450) {
					// Bei kleinen Bildschirmen: Volle Breite unter den anderen Elementen
					headerContainer.style.flexDirection = "column";
					headerContainer.style.alignItems = "stretch";
					input.style.width = "100%";
					input.style.marginTop = "3px";
				} else {
					// Berechne verfügbaren Platz für manuelle Eingabe
					if (headerContainer && statusContainer && positionContainer) {
						const headerWidth = headerContainer.offsetWidth;
						const statusWidth = statusContainer.offsetWidth;
						const positionWidth = positionContainer.offsetWidth;

						// Weniger Platz für Padding reservieren
						const availableWidth = headerWidth - statusWidth - positionWidth - 20;
						input.style.width = `${Math.max(32, availableWidth)}px`;
						input.style.marginTop = "0";
					}
				}
			});
		} catch (error) {
			console.error("Fehler bei der Anpassung der Manual Inputs:", error);
		}
	},

	// Initialisiere die Akkordeon-Funktionalität für die Sidebar - Fehlerbehandlung verbessert
	function initializeSidebarAccordion() {
		const accordionHeaders = document.querySelectorAll(
			".sidebar-accordion-header"
		);

		if (accordionHeaders.length === 0) {
			console.warn("Keine Accordion-Header gefunden!");
			return;
		}

		accordionHeaders.forEach((header) => {
			header.addEventListener("click", function () {
				// Toggle für das aktuell geklickte Element
				this.classList.toggle("collapsed");
				const content = this.nextElementSibling;

				if (!content) {
					console.warn("Kein Content-Element gefunden für:", this);
					return;
				}

				if (this.classList.contains("collapsed")) {
					content.style.maxHeight = "0";
					content.style.padding = "0 16px";
					content.style.overflow = "hidden";
					const arrow = this.querySelector(".dropdown-arrow");
					if (arrow) arrow.style.transform = "rotate(-90deg)";
				} else {
					content.style.maxHeight = "1000px"; // Großer Wert für variable Inhalte
					content.style.padding = "16px";
					content.style.overflow = "visible";
					const arrow = this.querySelector(".dropdown-arrow");
					if (arrow) arrow.style.transform = "none";
				}
			});
		});

		console.log(`${accordionHeaders.length} Accordion-Header initialisiert`);
	},

	// Exportiere alle benötigten Funktionen und Module
	window.hangarUI = {
		uiSettings,
		updateSecondaryTiles,
		updateCellAttributes,
		setupSecondaryTileEventListeners,
		adjustScaling,
		applyTileSizes,
		toggleSecondarySection,
		updateStatusLights,
		checkElement,
		debug,
		adjustManualInputWidths,
		initSectionLayout: function () {
			const firstSectionLabel = document.querySelector(
				".section-label:first-of-type"
			);
			if (firstSectionLabel) {
				firstSectionLabel.classList.add("section-label-first");
			}

			// Initiale Anpassung der Skalierung vornehmen
			window.hangarUI.adjustScaling();

			// Event Listener für Resize hinzufügen
			window.addEventListener(
				"resize",
				debounce(function () {
					window.hangarUI.adjustScaling();
				}, 250)
			);

			// Timeout für verzögerte Anwendung der Skalierung nach vollständigem Rendering
			setTimeout(() => {
				window.hangarUI.adjustScaling();
				// Zweiten Aufruf für bessere Browser-Kompatibilität nach kurzem Delay
				setTimeout(() => window.hangarUI.adjustScaling(), 200);
			}, 100);

			// Sidebar-Toggle und Accordion initialisieren
			// Diese Zeile anpassen:
			// initializeSidebarToggle(); <- ENTFERNEN
			// Stattdessen verwenden wir die Funktion aus hangarEvents:
			if (window.hangarEvents && window.hangarEvents.initializeSidebarToggle) {
				window.hangarEvents.initializeSidebarToggle();
			}
			initializeSidebarAccordion();
		},
		initializeSidebarAccordion,
		// Füge die applyViewMode-Funktion direkt zum hangarUI-Objekt hinzu
		applyViewMode: function (tableViewEnabled) {
			return uiSettings.applyViewMode(tableViewEnabled);
		},
		// Füge auch die initializeDisplaySettings-Funktion direkt hinzu
		initializeDisplaySettings: function () {
			return initializeDisplaySettings();
		},
		// Direkte Funktion zum Umschalten der Ansicht - explizit exportiert
		toggleTableView: function (enable) {
			console.log("toggleTableView aufgerufen:", enable);

			// Ansichtsmodus direkt anwenden
			if (typeof uiSettings.applyViewMode === "function") {
				uiSettings.applyViewMode(enable);

				// Synchronisiere Toggle-Button
				const viewModeToggle = document.getElementById("viewModeToggle");
				if (viewModeToggle) viewModeToggle.checked = enable;

				// Speichere Einstellung
				if (typeof uiSettings.save === "function") {
					setTimeout(() => uiSettings.save(), 100);
				}

				return `Ansicht auf ${enable ? "Tabelle" : "Kachel"} umgeschaltet`;
			} else {
				console.error("uiSettings.applyViewMode ist nicht definiert!");
				return "Fehler: Funktion nicht gefunden";
			}
		},
		// Füge die formatAircraftId-Funktion als Teil des hangarUI-Objekts hinzu
		formatAircraftId: formatAircraftId,
		setupAircraftIdFormatting: setupAircraftIdFormatting,
	};

	/**
	 * Einfache Debounce-Funktion für Performance-Optimierung
	 */
	function debounce(func, wait) {
		let timeout;
		return function () {
			const context = this,
				args = arguments;
			clearTimeout(timeout);
			timeout = setTimeout(() => func.apply(context, args), wait);
		};
	}

	/**
	 * Sucht nach einem Flugzeug anhand der Aircraft ID und hebt die entsprechende Karte hervor
	 */
	function searchAircraft() {
		try {
			const searchTerm = document
				.getElementById("searchAircraft")
				.value.trim()
				.toLowerCase();
			if (!searchTerm) {
				// Bei leerem Suchbegriff alle Hervorhebungen zurücksetzen
				resetHighlighting();
				return;
			}

			const foundElement = findAircraftElement(searchTerm);
			if (foundElement) {
				highlightFoundElement(foundElement);
			} else {
				showNotFoundMessage(searchTerm);
			}
		} catch (error) {
			console.error("Fehler bei der Flugzeugsuche:", error);
		}
	}

	/**
	 * Findet das HTML-Element, das die gesuchte Aircraft ID enthält
	 * @param {string} searchTerm - Der Suchbegriff (lowercase)
	 * @returns {HTMLElement|null} - Das gefundene Element oder null
	 */
	function findAircraftElement(searchTerm) {
		// Zuerst im Hauptgrid suchen
		let found = searchInGrid("hangarGrid", searchTerm);

		// Wenn nicht gefunden, im sekundären Grid suchen
		if (!found) {
			found = searchInGrid("secondaryHangarGrid", searchTerm);
		}

		return found;
	}

	/**
	 * Durchsucht ein Grid nach einer Aircraft ID
	 * @param {string} gridId - Die ID des Grids
	 * @param {string} searchTerm - Der Suchbegriff (lowercase)
	 * @returns {HTMLElement|null} - Das gefundene Element oder null
	 */
	function searchInGrid(gridId, searchTerm) {
		const grid = document.getElementById(gridId);
		if (!grid) return null;

		const aircraftInputs = grid.querySelectorAll('input[id^="aircraft-"]');
		for (const input of aircraftInputs) {
			const value = input.value.toLowerCase();
			if (value.includes(searchTerm)) {
				return input.closest(".hangar-cell");
			}
		}

		return null;
	}

	/**
	 * Hebt das gefundene Element hervor
	 * @param {HTMLElement} element - Das hervorzuhebende Element
	 */
	function highlightFoundElement(element) {
		// Zuerst alle Hervorhebungen zurücksetzen
		resetHighlighting();

		// Element hervorheben
		element.classList.add("search-highlight");

		// Temporärer Stil für die Hervorhebung hinzufügen, falls noch nicht vorhanden
		addHighlightStyle();

		// Element ins Sichtfeld scrollen
		element.scrollIntoView({
			behavior: "smooth",
			block: "center",
		});

		// Blinkeffekt für bessere Sichtbarkeit
		let blinkCount = 0;
		const blinkInterval = setInterval(() => {
			element.classList.toggle("search-blink");
			blinkCount++;

			if (blinkCount >= 6) {
				// 3 volle Blinkzyklen
				clearInterval(blinkInterval);
				element.classList.remove("search-blink");
			}
		}, 300);

		// NEU: Nach 2 Sekunden automatisch die Hervorhebung zurücksetzen
		setTimeout(() => {
			// Blinkeffekt beenden, wenn er noch läuft
			clearInterval(blinkInterval);
			// Alle Hervorhebungen zurücksetzen
			resetHighlighting();
		}, 2000);
	}

	/**
	 * Fügt die CSS-Stile für die Suche hinzu, falls sie noch nicht existieren
	 */
	function addHighlightStyle() {
		if (!document.getElementById("search-highlight-style")) {
			const style = document.createElement("style");
			style.id = "search-highlight-style";
			style.textContent = `
            .search-highlight {
                box-shadow: 0 0 0 3px #FF7043, 8px 8px 12px rgba(166, 166, 185, 0.25),
                -8px -8px 12px rgba(255, 255, 255, 0.7) !important;
                z-index: 10;
                position: relative;
            }
            
            .search-blink {
                background-color: rgba(255, 112, 67, 0.1) !important;
            }
            
            .search-not-found {
                color: white;
                background-color: #EF4444;
                padding: 8px;
                border-radius: 4px;
                text-align: center;
                margin-top: 8px;
                animation: fadeOut 3s forwards;
                position: absolute;
                top: 0;
                left: 50%;
                transform: translateX(-50%);
                z-index: 100;
            }
            
            @keyframes fadeOut {
                0% { opacity: 1; }
                70% { opacity: 1; }
                100% { opacity: 0; visibility: hidden; }
            }
        `;
			document.head.appendChild(style);
		}
	}

	/**
	 * Setzt alle Such-Hervorhebungen zurück
	 */
	function resetHighlighting() {
		const highlightedElements = document.querySelectorAll(".search-highlight");
		highlightedElements.forEach((el) => {
			el.classList.remove("search-highlight", "search-blink");
		});

		// Auch alle "Nicht gefunden"-Meldungen entfernen
		const notFoundMessages = document.querySelectorAll(".search-not-found");
		notFoundMessages.forEach((el) => el.remove());
	}

	/**
	 * Zeigt eine "Nicht gefunden"-Meldung an
	 * @param {string} searchTerm - Der Suchbegriff
	 */
	function showNotFoundMessage(searchTerm) {
		const container = document.querySelector(".hangar-container");
		if (!container) return;

		const message = document.createElement("div");
		message.className = "search-not-found";
		message.textContent = `Aircraft "${searchTerm}" wurde nicht gefunden`;

		container.appendChild(message);

		// Nach Animation automatisch entfernen
		setTimeout(() => {
			if (message.parentNode) {
				message.parentNode.removeChild(message);
			}
		}, 3000);
	}

	// Hinzufügen dieser Funktion zur bestehenden Datei

	function initializeFlightDataSection() {
		// Finde die Sidebar-Accordion-Content für Flight Data
		const flightDataContent = document.querySelector(
			'.sidebar-accordion-header:has(.sidebar-section-title:contains("Flight Data"))'
		).nextElementSibling;

		if (flightDataContent) {
			// Finde den Button-Container und füge Datumswähler davor ein
			const updateButton = flightDataContent.querySelector("#fetchFlightData");
			const dateInputContainer = document.createElement("div");
			dateInputContainer.className = "flex flex-col space-y-2 mb-3";
			dateInputContainer.innerHTML = `
				<div>
					<label class="text-xs block mb-1">Tag (letzter Flug):</label>
					<input type="date" id="currentDateInput" class="w-full bg-industrial-dark text-white px-2 py-1 rounded form-control">
				</div>
				<div>
					<label class="text-xs block mb-1">Tag (erster Flug):</label>
					<input type="date" id="nextDateInput" class="w-full bg-industrial-dark text-white px-2 py-1 rounded form-control">
				</div>
			`;

			// Füge Container vor dem Button ein
			if (updateButton && updateButton.parentNode) {
				updateButton.parentNode.insertBefore(dateInputContainer, updateButton);
			}
		}
	}

	// Ursprüngliche initializeUI-Funktion
	function initializeUI() {
		// Bestehender Code...

		// Initalisiere den Flight Data-Bereich
		initializeFlightDataSection();

		// Formatierung für Aircraft IDs einrichten
		setupAircraftIdFormatting();
	}

	/**
	 * Setup event listeners für Dark Mode, Ansichtsmodus und Zoom-Einstellungen
	 * Mit vereinfachter direkter Verbindung zwischen Toggle und Funktion
	 */
	function initializeDisplaySettings() {
		const darkModeToggle = document.getElementById("darkModeToggle");
		const viewModeToggle = document.getElementById("viewModeToggle"); // Neuer Toggle
		const zoomSlider = document.getElementById("displayZoom");

		// Debug-Ausgabe für die Fehlersuche
		console.log("initializeDisplaySettings gestartet");
		console.log("viewModeToggle gefunden:", viewModeToggle ? "ja" : "nein");

		if (darkModeToggle) {
			// Beim Laden den korrekten Status setzen
			const savedSettings = storageHelper.get("hangarPlannerSettings", true);
			if (savedSettings && savedSettings.darkMode !== undefined) {
				darkModeToggle.checked = savedSettings.darkMode;
				window.hangarUI.uiSettings.applyDarkMode(savedSettings.darkMode);
			}

			// Event Listener für Änderungen
			darkModeToggle.addEventListener("change", function () {
				window.hangarUI.uiSettings.applyDarkMode(this.checked);
				window.hangarUI.uiSettings.save.call(window.hangarUI.uiSettings);
			});
		}

		// VEREINFACHT: Event Listener für den Ansichtsmodus-Toggle mit direktem Funktionsaufruf
		if (viewModeToggle) {
			console.log("Setze vereinfachten Event-Listener für viewModeToggle");

			// Event-Handler maximal vereinfachen - direkt die Funktion aufrufen
			viewModeToggle.addEventListener("change", function () {
				// Direkt die Ansichtsfunktion aufrufen
				uiSettings.applyViewMode(this.checked);

				// Speichern nach Änderung
				uiSettings.save();

				console.log(
					`Ansicht auf ${this.checked ? "Tabelle" : "Kachel"} umgeschaltet`
				);
			});

			// Initialer Zustand aus den gespeicherten Einstellungen anwenden
			const savedSettings = localStorage.getItem("hangarPlannerSettings");
			if (savedSettings) {
				try {
					const settings = JSON.parse(savedSettings);
					viewModeToggle.checked = settings.tableView || false;
				} catch (e) {
					console.error("Fehler beim Lesen der Tabellenansicht-Einstellung:", e);
				}
			}
		}

		if (zoomSlider) {
			// Beim Laden den korrekten Status setzen
			const savedSettings = helpers.storageHelper.get(
				"hangarPlannerSettings",
				true
			);
			if (savedSettings && savedSettings.zoomLevel !== undefined) {
				zoomSlider.value = savedSettings.zoomLevel;
				document.getElementById(
					"zoomValue"
				).textContent = `${savedSettings.zoomLevel}%`;
				window.hangarUI.uiSettings.applyZoomLevel(savedSettings.zoomLevel);
			}

			// Event Listener für Änderungen
			zoomSlider.addEventListener("input", function () {
				const zoomLevel = parseInt(this.value);
				document.getElementById("zoomValue").textContent = `${zoomLevel}%`;
				window.hangarUI.uiSettings.applyZoomLevel(zoomLevel);
			});

			// Speichern beim Loslassen des Sliders
			zoomSlider.addEventListener("change", function () {
				window.hangarUI.uiSettings.save.call(window.hangarUI.uiSettings);
			});
		}
	}

	// Füge initializeDisplaySettings zum DOMContentLoaded-Event hinzu
	document.addEventListener("DOMContentLoaded", function () {
		if (typeof initializeDisplaySettings === "function") {
			setTimeout(initializeDisplaySettings, 100);
		}

		// Aircraft ID-Formatierung beim Seitenaufbau einrichten
		setupAircraftIdFormatting();

		// Sicherstellen, dass die Formatierung auch nach Zeitverzögerung angewendet wird
		// (für dynamisch gerenderte Elemente)
		setTimeout(setupAircraftIdFormatting, 500);
	});

	/**
	 * Erstellt die sekundären Kacheln und fügt sie dem Grid hinzu
	 * @param {number} count - Anzahl der zu erstellenden sekundären Kacheln
	 */
	function createSecondaryTiles(count) {
		// ...existing code...

		// Nach Erstellung aller Kacheln, Grid-Layout basierend auf der Kachelanzahl anpassen
		adjustSecondaryGridLayout(count);

		// Dispatch Event, dass sekundäre Kacheln erstellt wurden
		document.dispatchEvent(
			new CustomEvent("secondaryTilesCreated", { detail: { count } })
		);
	}

	/**
	 * Passt das Grid-Layout der sekundären Kacheln basierend auf der Anzahl an
	 * @param {number} count - Anzahl der sekundären Kacheln
	 */
	function adjustSecondaryGridLayout(count) {
		const secondaryGrid = document.getElementById("secondaryHangarGrid");
		if (!secondaryGrid) return;

		// Entferne alle vorhandenen grid-cols Klassen
		secondaryGrid.classList.remove(
			"grid-cols-1",
			"grid-cols-2",
			"grid-cols-3",
			"grid-cols-4"
		);

		// Bestimme optimale Spaltenzahl basierend auf Kachelnanzahl
		let colCount;
		if (count === 1) {
			colCount = 1;
		} else if (count === 2) {
			colCount = 2;
		} else if (count === 3) {
			colCount = 3;
		} else {
			colCount = 4; // Standard für 4 oder mehr
		}

		// Füge die entsprechende grid-cols Klasse hinzu
		secondaryGrid.classList.add(`grid-cols-${colCount}`);

		// Wenn weniger als 4 Kacheln, zentriere sie
		if (count < 4) {
			secondaryGrid.classList.add("justify-items-center");

			// Bei 2 Kacheln extra Styling für korrekte Ausrichtung
			if (count === 2) {
				// Spezielle Behandlung für 2 Kacheln - stelle sicher, dass sie zentriert sind
				const gridItems = secondaryGrid.querySelectorAll(".hangar-cell");
				gridItems.forEach((item) => {
					item.style.gridColumnStart = "auto";
					item.style.justifySelf = "center";
				});
			}
		} else {
			secondaryGrid.classList.remove("justify-items-center");
		}

		console.log(
			`Sekundäres Grid auf ${colCount} Spalten angepasst für ${count} Kacheln`
		);
	}

	// Füge diese Funktion zum window.hangarUI Objekt hinzu
	if (typeof window.hangarUI === "undefined") {
		window.hangarUI = {};
	}

	// Exportiere die neuen Funktionen
	window.hangarUI.adjustSecondaryGridLayout = adjustSecondaryGridLayout;

	// In der Funktion updateTowStatusStyles
	function updateTowStatusStyles(select) {
		// Alle Styling-Klassen entfernen
		select.classList.remove(
			"tow-neutral",
			"tow-initiated",
			"tow-ongoing",
			"tow-on-position"
		);

		// Neue Styling-Klasse basierend auf dem Wert hinzufügen
		const value = select.value;
		select.classList.add(`tow-${value}`);

		// Hintergrundfarbe und Textfarbe direkt setzen
		if (value === "neutral") {
			select.style.backgroundColor = "white";
			select.style.color = "#333333";
		} else if (value === "initiated") {
			select.style.backgroundColor = "#FEF3C7"; // Hellgelb
			select.style.color = "#92400E";
		} else if (value === "ongoing") {
			select.style.backgroundColor = "#DBEAFE"; // Hellblau
			select.style.color = "#1E40AF";
		} else if (value === "on-position") {
			select.style.backgroundColor = "#D1FAE5"; // Hellgrün
			select.style.color = "#065F46";
		}
	}

	// Exportiere die updateTowStatusStyles-F