const uiSettings = {
	// DEPRECATED: Diese Einstellungen werden jetzt von display-options.js verwaltet
	// und in data.json gespeichert statt localStorage
	tilesCount: 8,
	secondaryTilesCount: 0,
	layout: 4,
	darkMode: false,
	zoomLevel: 100,
	tableView: false, // Neue Einstellung für die Tabellenansicht

	// DEPRECATED: Lädt Einstellungen aus dem LocalStorage - wird durch display-options.js ersetzt
	load: async function () {
		console.warn(
			"⚠️ uiSettings.load() ist veraltet. Verwende window.displayOptions stattdessen."
		);
		return false;

		/* DEPRECATED - localStorage wird nicht mehr verwendet
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
		*/
	},

	// DEPRECATED: Speichert Einstellungen - wird durch display-options.js ersetzt
	save: async function (exportToFile = false) {
		console.warn(
			"⚠️ uiSettings.save() ist veraltet. Verwende window.displayOptions stattdessen."
		);
		return false;

		/* DEPRECATED - localStorage wird nicht mehr verwendet
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
		*/
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
				const arrivalTimeInput = document.getElementById(
					`arrival-time-${cellId}`
				);
				const arrivalTime = arrivalTimeInput ? arrivalTimeInput.value : "";

				const departureTimeInput = document.getElementById(
					`departure-time-${cellId}`
				);
				const departureTime = departureTimeInput
					? departureTimeInput.value
					: "";

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
			const positionInput = document.getElementById(
				`hangar-position-${cellId}`
			);
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
			const arrivalTimeInput = document.getElementById(
				`arrival-time-${cellId}`
			);
			if (arrivalTimeInput && tileValue.arrivalTime) {
				arrivalTimeInput.value = tileValue.arrivalTime;
			}

			const departureTimeInput = document.getElementById(
				`departure-time-${cellId}`
			);
			if (departureTimeInput && tileValue.departureTime) {
				departureTimeInput.value = tileValue.departureTime;
			}

			// Status setzen
			const statusSelect = document.getElementById(`status-${cellId}`);
			if (statusSelect && tileValue.status) {
				statusSelect.value = tileValue.status;
				// Status-Licht aktualisieren
				if (typeof updateStatusLights === "function") {
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

// Placeholder für restliche Funktionen - diese werden aus der originalen Datei übernommen

/**
 * Vereinfachte Aktualisierung der sekundären Kacheln - analog zu updateTiles
 * Verwendet das gleiche einfache Show/Hide-System wie primäre Kacheln
 * @param {number} count - Anzahl der sekundären Kacheln
 * @param {number} layout - Anzahl der Spalten
 * @param {boolean} preserveData - Wird ignoriert, da Daten automatisch erhalten bleiben
 */
function updateSecondaryTiles(count, layout, preserveData = true) {
	console.log(
		`🔧 Aktualisiere sekundäre Kacheln: ${count} (vereinfachtes System wie primäre Kacheln)`
	);

	const secondaryGrid = document.getElementById("secondaryHangarGrid");
	if (!secondaryGrid) {
		console.error("❌ Sekundärer Grid-Container nicht gefunden");
		return;
	}

	// Prüfe aktuelle Anzahl der Kacheln
	let currentTiles = secondaryGrid.querySelectorAll(".hangar-cell");
	const currentCount = currentTiles.length;

	console.log(`Aktuell ${currentCount} sekundäre Kacheln, Ziel: ${count}`);

	// Falls wir mehr Kacheln brauchen, erstelle sie (nur neue, niemals alle löschen)
	if (currentCount < count) {
		const tilesToCreate = count - currentCount;
		console.log(`📦 Erstelle ${tilesToCreate} neue sekundäre Kacheln`);

		for (let i = 0; i < tilesToCreate; i++) {
			const cellId = 101 + currentCount + i;
			createSingleSecondaryTile(cellId, secondaryGrid);
		}

		// Aktualisiere die Kachel-Liste
		currentTiles = secondaryGrid.querySelectorAll(".hangar-cell");
	}

	// Ein-/Ausblenden basierend auf count (GENAU wie bei primären Kacheln)
	currentTiles.forEach((tile, index) => {
		if (index < count) {
			tile.style.display = "";
			tile.style.visibility = "visible";
		} else {
			tile.style.display = "none";
			tile.style.visibility = "hidden";
		}
	});

	// Layout aktualisieren
	if (layout) {
		secondaryGrid.className = `grid grid-cols-${layout} gap-4`;
	}

	// Sichtbarkeit der sekundären Sektion
	toggleSecondarySection(count > 0);

	// UI-Eingabefeld aktualisieren
	const secondaryTilesCountInput = document.getElementById(
		"secondaryTilesCount"
	);
	if (
		secondaryTilesCountInput &&
		secondaryTilesCountInput.value !== count.toString()
	) {
		secondaryTilesCountInput.value = count;
	}

	console.log(
		`✅ ${count} sekundäre Kacheln aktiviert - Daten bleiben erhalten!`
	);
}

/**
 * Erstellt eine einzelne sekundäre Kachel - einfacher Ansatz ohne komplizierte Logik
 * @param {number} cellId - ID der neuen Kachel
 * @param {HTMLElement} container - Container für die Kachel
 */
function createSingleSecondaryTile(cellId, container) {
	console.log(`🎯 Erstelle einzelne sekundäre Kachel ${cellId}`);

	// Template für sekundäre Kacheln
	const templateCell = document.querySelector("#hangarGrid .hangar-cell");
	if (!templateCell) {
		console.error("❌ Keine Vorlage für sekundäre Kacheln gefunden");
		return;
	}

	// Einfaches Klonen der Struktur
	const cellClone = templateCell.cloneNode(true);

	// Basis-Eigenschaften setzen
	cellClone.setAttribute("data-cell-id", cellId.toString());
	cellClone.id = `secondary-cell-${cellId}`;

	// IDs in der geklonten Kachel aktualisieren
	updateCellAttributes(cellClone, cellId);

	// Alle Input-Felder leeren (für neue Kacheln)
	const allInputs = cellClone.querySelectorAll("input, select, textarea");
	allInputs.forEach((input) => {
		input.value = "";
		if (input.type === "select-one") {
			input.selectedIndex = 0;
		}
	});

	// Zur sekundären Sektion hinzufügen
	container.appendChild(cellClone);

	console.log(`✅ Sekundäre Kachel ${cellId} erstellt`);
}

function adjustScaling() {
	// Dynamische Skalierung der UI-Elemente basierend auf Bildschirmgröße
	const container = document.querySelector(".main-container");
	if (!container) return;

	const screenWidth = window.innerWidth;
	const baseWidth = 1920; // Basis-Breite für 100% Skalierung

	let scaleFactor = screenWidth / baseWidth;

	// Begrenze die Skalierung
	scaleFactor = Math.max(0.7, Math.min(1.2, scaleFactor));

	container.style.transform = `scale(${scaleFactor})`;
	container.style.transformOrigin = "top left";

	console.log(`UI-Skalierung angepasst: ${(scaleFactor * 100).toFixed(1)}%`);
}

function toggleSecondarySection(visible) {
	const secondarySection = document.getElementById("secondarySection");
	if (!secondarySection) {
		console.warn("Sekundäre Sektion nicht gefunden");
		return;
	}

	if (visible) {
		secondarySection.style.display = "block";
		secondarySection.classList.remove("hidden");
		console.log("Sekundäre Sektion angezeigt");
	} else {
		secondarySection.style.display = "none";
		secondarySection.classList.add("hidden");
		console.log("Sekundäre Sektion ausgeblendet");
	}
}

function updateStatusLights(cellId) {
	const statusSelect = document.getElementById(`status-${cellId}`);
	const statusLights = document.querySelectorAll(
		`[data-cell="${cellId}"] .status-light`
	);

	if (!statusSelect) {
		console.warn(`Status-Select für Kachel ${cellId} nicht gefunden`);
		return;
	}

	const status = statusSelect.value;

	statusLights.forEach((light) => {
		// Alle Status-Klassen entfernen
		light.classList.remove(
			"status-ready",
			"status-occupied",
			"status-maintenance",
			"status-blocked"
		);

		// Neue Status-Klasse hinzufügen
		if (status && status !== "neutral") {
			light.classList.add(`status-${status}`);
		}
	});

	// Auch das Parent-Element der Kachel aktualisieren
	const cell = document.querySelector(`[data-cell-id="${cellId}"]`);
	if (cell) {
		cell.classList.remove(
			"status-ready",
			"status-occupied",
			"status-maintenance",
			"status-blocked"
		);
		if (status && status !== "neutral") {
			cell.classList.add(`status-${status}`);
		}
	}

	console.log(`Status-Lights für Kachel ${cellId} auf "${status}" gesetzt`);
}

/**
 * Speichert die gesammelten Daten
 */
function saveCollectedData() {
	const tileValues = collectTileValues();
	if (typeof hangarData !== "undefined" && hangarData.saveTileData) {
		hangarData.saveTileData(tileValues);
		console.log("Kacheldaten gespeichert");
	} else {
		// Fallback: localStorage verwenden
		try {
			localStorage.setItem("hangarTileData", JSON.stringify(tileValues));
			console.log("Kacheldaten in localStorage gespeichert");
		} catch (error) {
			console.warn("Fehler beim Speichern in localStorage:", error);
		}
	}
}

function checkElement(id) {
	return document.getElementById(id) !== null;
}

/**
 * Aktualisiert die Attribute und IDs aller Elemente in einer Kachel
 * @param {HTMLElement} cellElement - Das Kachel-Element
 * @param {number} cellId - Die neue Kachel-ID
 */
function updateCellAttributes(cellElement, cellId) {
	console.log(`🔧 Aktualisiere Zell-Attribute für Kachel ${cellId}`);

	try {
		// Haupt-Container aktualisieren
		cellElement.setAttribute("data-cell-id", cellId);

		// Alle Input-, Select- und andere relevante Elemente finden und aktualisieren
		const elementsToUpdate = cellElement.querySelectorAll(
			"input, select, textarea, button, span[id], div[id], label[for]"
		);

		elementsToUpdate.forEach((element) => {
			// ID-Muster aktualisieren
			if (element.id) {
				// Mögliche ID-Muster:
				// aircraft-123 -> aircraft-{cellId}
				// hangar-position-123 -> hangar-position-{cellId}
				// arrival-time-123 -> arrival-time-{cellId}
				// departure-time-123 -> departure-time-{cellId}
				// status-123 -> status-{cellId}
				// notes-123 -> notes-{cellId}
				// manual-input-123 -> manual-input-{cellId}

				const idParts = element.id.split("-");
				if (idParts.length >= 2) {
					// Letzten Teil (alte ID) durch neue ID ersetzen
					idParts[idParts.length - 1] = cellId.toString();
					element.id = idParts.join("-");
				}
			}

			// Label-for-Attribute aktualisieren
			if (element.tagName === "LABEL" && element.hasAttribute("for")) {
				const forParts = element.getAttribute("for").split("-");
				if (forParts.length >= 2) {
					forParts[forParts.length - 1] = cellId.toString();
					element.setAttribute("for", forParts.join("-"));
				}
			}

			// Name-Attribute aktualisieren (falls vorhanden)
			if (element.name) {
				const nameParts = element.name.split("-");
				if (nameParts.length >= 2) {
					nameParts[nameParts.length - 1] = cellId.toString();
					element.name = nameParts.join("-");
				}
			}
		});

		// Status-Light-Container aktualisieren
		const statusLights = cellElement.querySelector(".status-lights");
		if (statusLights) {
			const lights = statusLights.querySelectorAll(".status-light");
			lights.forEach((light, index) => {
				const statuses = ["arrival", "present", "departure"];
				if (statuses[index]) {
					light.id = `light-${statuses[index]}-${cellId}`;
				}
			});
		}

		console.log(`✅ Zell-Attribute für Kachel ${cellId} aktualisiert`);
		return true;
	} catch (error) {
		console.error(
			`Fehler beim Aktualisieren der Zell-Attribute für Kachel ${cellId}:`,
			error
		);
		return false;
	}
}

/**
 * Sammelt Daten von einer einzelnen Kachel
 * @param {number} cellId - ID der Kachel
 * @returns {Object|null} Kacheldaten oder null
 */
function collectTileData(cellId) {
	try {
		console.log(`📊 Sammle Daten für Kachel ${cellId}`);

		// Bestimme ob es eine sekundäre Kachel ist (ID >= 101)
		const isSecondary = cellId >= 101;
		const expectedContainer = isSecondary
			? "#secondaryHangarGrid"
			: "#hangarGrid";
		const containerElement = document.querySelector(expectedContainer);

		if (!containerElement) {
			console.warn(
				`Container ${expectedContainer} nicht gefunden für Kachel ${cellId}`
			);
			return null;
		}

		// Sammle alle Daten aus der Kachel
		const aircraftElement = document.getElementById(`aircraft-${cellId}`);
		const aircraftId =
			aircraftElement && containerElement.contains(aircraftElement)
				? aircraftElement.value || ""
				: "";

		const positionElement = document.getElementById(
			`hangar-position-${cellId}`
		);
		const position =
			positionElement && containerElement.contains(positionElement)
				? positionElement.value || ""
				: "";

		const manualInputElement = document.getElementById(
			`manual-input-${cellId}`
		);
		const manualInput =
			manualInputElement && containerElement.contains(manualInputElement)
				? manualInputElement.value || ""
				: "";

		const notesElement = document.getElementById(`notes-${cellId}`);
		const notes =
			notesElement && containerElement.contains(notesElement)
				? notesElement.value || ""
				: "";

		const statusElement = document.getElementById(`status-${cellId}`);
		const status =
			statusElement && containerElement.contains(statusElement)
				? statusElement.value || "neutral"
				: "neutral";

		const arrivalElement = document.getElementById(`arrival-time-${cellId}`);
		const arrivalTime =
			arrivalElement && containerElement.contains(arrivalElement)
				? arrivalElement.value || ""
				: "";

		const departureElement = document.getElementById(
			`departure-time-${cellId}`
		);
		const departureTime =
			departureElement && containerElement.contains(departureElement)
				? departureElement.value || ""
				: "";

		const tileData = {
			tileId: cellId,
			aircraftId: aircraftId,
			position: position,
			manualInput: manualInput,
			notes: notes,
			status: status,
			arrivalTime: arrivalTime,
			departureTime: departureTime,
		};

		console.log(`✅ Daten für Kachel ${cellId} gesammelt:`, tileData);
		return tileData;
	} catch (error) {
		console.error(
			`❌ Fehler beim Sammeln der Daten für Kachel ${cellId}:`,
			error
		);
		return null;
	}
}

/**
 * Aktualisiert die Anzahl der sichtbaren primären Kacheln
 * @param {number} count - Anzahl der sichtbaren Kacheln
 */
function updateTiles(count) {
	console.log(`🔧 Aktualisiere primäre Kacheln: ${count}`);

	try {
		const grid = document.getElementById("hangarGrid");
		if (!grid) {
			console.error("❌ Primärer Grid nicht gefunden");
			return;
		}

		const tiles = grid.querySelectorAll(".hangar-cell");
		console.log(`Gefunden ${tiles.length} primäre Kacheln`);

		// Zeige/verstecke Kacheln basierend auf count
		tiles.forEach((tile, index) => {
			if (index < count) {
				tile.style.display = "";
				tile.style.visibility = "visible";
			} else {
				tile.style.display = "none";
				tile.style.visibility = "hidden";
			}
		});

		// Aktualisiere auch das UI-Eingabefeld
		const tilesCountInput = document.getElementById("tilesCount");
		if (tilesCountInput && tilesCountInput.value !== count.toString()) {
			tilesCountInput.value = count;
		}

		console.log(`✅ ${count} primäre Kacheln aktiviert`);

		// Event dispatchen für andere Module
		document.dispatchEvent(
			new CustomEvent("primaryTilesUpdated", {
				detail: { count },
			})
		);
	} catch (error) {
		console.error("❌ Fehler beim Aktualisieren der primären Kacheln:", error);
	}
}

// Export des hangarUI Objekts
window.hangarUI = {
	uiSettings,
	updateTiles,
	updateSecondaryTiles,
	updateCellAttributes,
	setupSecondaryTileEventListeners,
	adjustScaling,
	collectTileData,

	/**
	 * Initialisiert das Sektion-Layout
	 */
	initSectionLayout: function () {
		console.log("🔧 Initialisiere Sektion-Layout...");

		// Stelle sicher, dass alle erforderlichen Sektionen vorhanden sind
		const requiredSections = [
			"hangarGrid",
			"secondaryHangarGrid",
			"sidebarMenu",
		];

		let allFound = true;
		requiredSections.forEach((sectionId) => {
			const section = document.getElementById(sectionId);
			if (!section) {
				console.warn(`⚠️ Sektion ${sectionId} nicht gefunden`);
				allFound = false;
			} else {
				console.log(`✅ Sektion ${sectionId} gefunden`);
			}
		});

		if (allFound) {
			// Initiale UI-Einstellungen anwenden
			this.uiSettings.apply();
			console.log("✅ Sektion-Layout erfolgreich initialisiert");
		} else {
			console.error("❌ Nicht alle erforderlichen Sektionen gefunden");
		}
	},

	/**
	 * Initialisiert das Sidebar-Akkordeon
	 */
	initializeSidebarAccordion: function () {
		console.log("🔧 Initialisiere Sidebar-Akkordeon...");

		const accordionHeaders = document.querySelectorAll(
			".sidebar-accordion-header"
		);

		accordionHeaders.forEach((header) => {
			header.addEventListener("click", function () {
				const content = this.nextElementSibling;
				const arrow = this.querySelector(".dropdown-arrow");

				if (
					content &&
					content.classList.contains("sidebar-accordion-content")
				) {
					// Toggle open/close
					if (content.classList.contains("open")) {
						content.classList.remove("open");
						if (arrow) arrow.textContent = "▼";
					} else {
						content.classList.add("open");
						if (arrow) arrow.textContent = "▲";
					}
				}
			});
		});

		console.log(
			`✅ Sidebar-Akkordeon für ${accordionHeaders.length} Header initialisiert`
		);
	},

	/**
	 * Initialisiert Event-Listener für sekundäre Kacheln - VERBESSERT
	 */
	setupSecondaryTileEventListeners: function () {
		const secondaryContainer = document.getElementById("secondaryHangarGrid");
		if (!secondaryContainer) {
			console.warn("❌ Sekundärer Container nicht gefunden");
			return;
		}

		console.log("🔧 Richte Event-Handler für sekundäre Kacheln ein...");

		// ALLE relevanten Felder in sekundären Kacheln finden
		const relevantSelectors = [
			'input[id^="aircraft-"]',
			'input[id^="hangar-position-"]',
			'input[id^="position-"]',
			'input[id^="arrival-time-"]',
			'input[id^="departure-time-"]',
			'textarea[id^="notes-"]',
			'select[id^="status-"]',
			'select[id^="tow-status-"]',
		];

		let handlersRegistered = 0;

		relevantSelectors.forEach((selector) => {
			const elements = secondaryContainer.querySelectorAll(selector);

			elements.forEach((element) => {
				const cellId = this.extractCellIdFromElement(element);

				// Nur für sekundäre Kacheln (ID >= 101)
				if (cellId >= 101) {
					console.log(
						`🎯 Registriere Handler für sekundäres Element: ${element.id} (Kachel ${cellId})`
					);

					// Event-Handler über zentralen Event-Manager registrieren
					if (
						window.hangarEventManager &&
						window.hangarEventManager.safeAddEventListener
					) {
						// Input Event für Echtzeitänderungen
						window.hangarEventManager.safeAddEventListener(
							element,
							"input",
							(event) => {
								console.log(
									`📝 Sekundäres Input Event: ${event.target.id} = "${event.target.value}"`
								);
								window.hangarEventManager.debouncedFieldUpdate(
									event.target.id,
									event.target.value
								);
							},
							`secondary_input_${cellId}`
						);

						// Blur Event für finales Speichern
						window.hangarEventManager.safeAddEventListener(
							element,
							"blur",
							(event) => {
								console.log(
									`👁️ Sekundäres Blur Event: ${event.target.id} = "${event.target.value}"`
								);
								window.hangarEventManager.debouncedFieldUpdate(
									event.target.id,
									event.target.value,
									100
								);
							},
							`secondary_blur_${cellId}`
						);

						// Change Event für Dropdowns
						window.hangarEventManager.safeAddEventListener(
							element,
							"change",
							(event) => {
								console.log(
									`🔄 Sekundäres Change Event: ${event.target.id} = "${event.target.value}"`
								);

								// Spezielle Behandlung für Status-Felder
								if (event.target.id.startsWith("status-")) {
									updateStatusLights(cellId);
								}

								window.hangarEventManager.debouncedFieldUpdate(
									event.target.id,
									event.target.value,
									50
								);
							},
							`secondary_change_${cellId}`
						);

						handlersRegistered++;
					} else {
						console.warn(
							"⚠️ Event-Manager nicht verfügbar, verwende Fallback-Handler"
						);
						// Fallback: Direkte Event-Handler
						element.addEventListener("input", (event) => {
							console.log(
								`📝 Fallback Input: ${event.target.id} = "${event.target.value}"`
							);
						});
						element.addEventListener("blur", (event) => {
							console.log(
								`👁️ Fallback Blur: ${event.target.id} = "${event.target.value}"`
							);
						});
					}
				}
			});
		});

		console.log(
			`✅ ${handlersRegistered} Event-Handler für sekundäre Kacheln registriert`
		);
	},

	/**
	 * NEUE HILFSFUNKTION: Extrahiert Kachel-ID aus Element
	 */
	extractCellIdFromElement: function (element) {
		if (!element.id) return null;

		// Verschiedene ID-Patterns unterstützen
		const patterns = [
			/^aircraft-(\d+)$/,
			/^hangar-position-(\d+)$/,
			/^position-(\d+)$/,
			/^arrival-time-(\d+)$/,
			/^departure-time-(\d+)$/,
			/^notes-(\d+)$/,
			/^status-(\d+)$/,
			/^tow-status-(\d+)$/,
		];

		for (const pattern of patterns) {
			const match = element.id.match(pattern);
			if (match) {
				return parseInt(match[1]);
			}
		}

		return null;
	},

	// ...existing functions...
};

// Kritische Funktionen global verfügbar machen
window.updateTiles = updateTiles;
window.collectTileData = collectTileData;
window.updateCellAttributes = updateCellAttributes;
window.updateStatusLights = updateStatusLights;
window.setupSecondaryTileEventListeners =
	window.hangarUI.setupSecondaryTileEventListeners;

// NEUE INITIALISIERUNGS-KOORDINATION
// Stellt sicher, dass Event-Handler nach der vollständigen DOM-/UI-Initialisierung registriert werden
document.addEventListener("DOMContentLoaded", function () {
	console.log("🚀 === HANGARPLANNER INITIALISIERUNG GESTARTET ===");

	// Phase 1: Basis-UI laden (0ms)
	console.log("📋 Phase 1: Basis-UI wird geladen...");

	// Phase 2: Event-Manager initialisieren (1000ms)
	setTimeout(() => {
		console.log("🔧 Phase 2: Event-Manager wird initialisiert...");
		if (window.hangarEventManager && !window.hangarEventManager.initialized) {
			window.hangarEventManager.init();
		}
	}, 1000);

	// Phase 3: Sekundäre Event-Handler registrieren (2000ms)
	setTimeout(() => {
		console.log("🎯 Phase 3: Sekundäre Event-Handler werden registriert...");
		if (window.hangarUI && window.hangarUI.setupSecondaryTileEventListeners) {
			window.hangarUI.setupSecondaryTileEventListeners();
		}
	}, 2000);

	// Phase 4: Validierung und Status-Check (6000ms)
	setTimeout(() => {
		console.log("🔍 Phase 4: System-Validierung...");

		// Prüfe Event-Handler Status
		if (window.hangarEventManager) {
			const status = window.hangarEventManager.getStatus();
			console.log("📊 Event-Manager Status:", status);
		}

		// Prüfe Container-Zuordnungen
		const primaryContainer = document.getElementById("hangarGrid");
		const secondaryContainer = document.getElementById("secondaryHangarGrid");

		if (primaryContainer) {
			const primaryFields = primaryContainer.querySelectorAll(
				"input, select, textarea"
			);
			console.log(
				`✅ Primärer Container: ${primaryFields.length} Felder gefunden`
			);
		}

		if (secondaryContainer) {
			const secondaryFields = secondaryContainer.querySelectorAll(
				"input, select, textarea"
			);
			console.log(
				`✅ Sekundärer Container: ${secondaryFields.length} Felder gefunden`
			);
		}

		console.log("🎉 === HANGARPLANNER INITIALISIERUNG ABGESCHLOSSEN ===");
	}, 6000);
});
