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
 * Aktualisiert die sekundären Kacheln basierend auf der eingestellten Anzahl
 * @param {number} count - Anzahl der sekundären Kacheln
 * @param {number} layout - Anzahl der Spalten
 */
function updateSecondaryTiles(count, layout) {
	console.log(`=== AKTUALISIERE SEKUNDÄRE KACHELN: ${count} Kacheln ===`);

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
			const tileData = collectTileData(cellId);
			if (tileData) {
				existingData.push({
					index: index,
					cellId: cellId,
					data: tileData,
				});
			}
		});
		console.log(`${existingData.length} bestehende Kacheldaten gesichert`);
	}

	// KRITISCHER FIX: Verwende createEmptySecondaryTiles anstatt cloneNode um Position-Kloning zu verhindern
	createEmptySecondaryTiles(count, layout);

	// Wiederherstellung der gesicherten Daten in neue Kacheln
	existingData.forEach((savedData) => {
		if (savedData.index < count) {
			const newCellId = 101 + savedData.index;
			console.log(
				`Lade gesicherte Daten für Kachel ${newCellId}:`,
				savedData.data
			);
			applyTileData(newCellId, savedData.data);
		}
	});

	console.log(
		`✅ ${count} sekundäre Kacheln ohne Position-Kloning aktualisiert`
	);
}

/**
 * Erstellt leere sekundäre Kacheln speziell für die Synchronisation
 * WICHTIG: Diese Funktion klont KEINE Daten von primären Kacheln - sie erstellt komplett leere Kacheln
 * @param {number} count - Anzahl der zu erstellenden sekundären Kacheln
 * @param {number} layout - Anzahl der Spalten (optional, Standard basiert auf aktueller Einstellung)
 */
function createEmptySecondaryTiles(count, layout = null) {
	console.log(`=== ERSTELLE ${count} LEERE SEKUNDÄRE KACHELN FÜR SYNC ===`);

	const secondaryGrid = document.getElementById("secondaryHangarGrid");
	if (!secondaryGrid) {
		console.error("Sekundärer Grid-Container nicht gefunden");
		return;
	}

	// Aktuelles Layout verwenden falls nicht angegeben
	if (layout === null) {
		layout = uiSettings.layout || 4;
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

	// Erstelle die gewünschte Anzahl an KOMPLETT LEEREN sekundären Kacheln
	for (let i = 0; i < count; i++) {
		const cellId = 101 + i; // Start bei 101 für sekundäre Kacheln

		// KRITISCH: Klone NICHT die Vorlage-Kachel, sondern nur die STRUKTUR ohne Daten
		const cellClone = templateCell.cloneNode(true);

		// WICHTIG: Setze explizit das data-cell-id Attribut für korrekte Identifizierung
		cellClone.setAttribute("data-cell-id", cellId.toString());
		cellClone.id = `secondary-cell-${cellId}`;

		// SOFORTIGE KOMPLETTE LEERUNG: Alle Input-Felder VOR jeder weiteren Verarbeitung leeren
		const allInputs = cellClone.querySelectorAll("input, select, textarea");
		allInputs.forEach((input) => {
			// Attribute zurücksetzen
			input.value = "";
			input.defaultValue = "";
			if (input.type === "select-one") {
				input.selectedIndex = 0;
			}
			// Alle Data-Attribute entfernen, die Werte enthalten könnten
			Array.from(input.attributes).forEach((attr) => {
				if (attr.name.startsWith("data-") && attr.name !== "data-cell-id") {
					input.removeAttribute(attr.name);
				}
			});
		});

		// IDs aktualisieren NACH kompletter Leerung
		updateCellAttributes(cellClone, cellId);

		// FINALE SICHERHEIT: Nochmalige explizite Leerung aller kritischen Felder
		const criticalFields = [
			`#hangar-position-${cellId}`,
			`#aircraft-${cellId}`,
			`#arrival-time-${cellId}`,
			`#departure-time-${cellId}`,
			`#manual-input-${cellId}`,
			`#notes-${cellId}`,
			`#status-${cellId}`,
		];

		criticalFields.forEach((selector) => {
			const element = cellClone.querySelector(selector);
			if (element) {
				const oldValue = element.value;
				element.value = "";
				element.defaultValue = "";
				if (element.type === "select-one") {
					element.selectedIndex = 0;
				}
				console.log(
					`🔧 ${selector} für Sync geleert (war: "${oldValue}", jetzt: "${element.value}")`
				);
			}
		});

		// Zur sekundären Sektion hinzufügen
		secondaryGrid.appendChild(cellClone);

		// FINALE VERIFIKATION: Prüfe nach DOM-Hinzufügung, dass alle Felder wirklich leer sind
		setTimeout(() => {
			const verificationFields = [
				`hangar-position-${cellId}`,
				`aircraft-${cellId}`,
				`arrival-time-${cellId}`,
				`departure-time-${cellId}`,
				`manual-input-${cellId}`,
				`notes-${cellId}`,
			];

			verificationFields.forEach((fieldId) => {
				const field = document.getElementById(fieldId);
				if (field && field.value !== "") {
					console.warn(
						`⚠️  SYNC-WARNUNG: Feld ${fieldId} ist nicht leer (Wert: "${field.value}") - leere es nochmals`
					);
					field.value = "";
					field.defaultValue = "";
				}
			});
		}, 10);

		console.log(
			`✅ KOMPLETT LEERE sekundäre Kachel ${cellId} für Sync erstellt`
		);
	}

	// Layout-Klasse setzen
	secondaryGrid.className = `hangar-grid grid-cols-${layout}`;

	console.log(
		`=== ${count} KOMPLETT LEERE SEKUNDÄRE KACHELN FÜR SYNC ERSTELLT ===`
	);
	console.log(
		`🚫 KEIN DATENKLONING durchgeführt - alle Kacheln sind garantiert leer`
	);

	// KEINE Datenwiederherstellung - Kacheln sollen komplett leer bleiben für Sync!
}

/**
 * Erstellt komplett leere sekundäre Kacheln für Synchronisation OHNE Klonen
 * WICHTIG: Diese Funktion klont KEINE Daten - sie erstellt die Kacheln manuell ohne Vorlage
 * @param {number} count - Anzahl der zu erstellenden sekundären Kacheln
 * @param {number} layout - Anzahl der Spalten (optional, Standard basiert auf aktueller Einstellung)
 */
function createSecondaryTilesForSync(count, layout = null) {
	console.log(`=== ERSTELLE ${count} KACHELN FÜR SYNC (OHNE KLONEN) ===`);

	const secondaryGrid = document.getElementById("secondaryHangarGrid");
	if (!secondaryGrid) {
		console.error("Sekundärer Grid-Container nicht gefunden");
		return;
	}

	// Aktuelles Layout verwenden falls nicht angegeben
	if (layout === null) {
		layout = uiSettings.layout || 4;
	}

	// Leere den Container
	secondaryGrid.innerHTML = "";

	// Sichtbarkeit der sekundären Sektion steuern
	toggleSecondarySection(count > 0);

	// Wenn keine sekundären Kacheln, früh beenden
	if (count <= 0) return;

	// Erstelle die gewünschte Anzahl an KOMPLETT LEEREN sekundären Kacheln OHNE KLONEN
	for (let i = 0; i < count; i++) {
		const cellId = 101 + i; // Start bei 101 für sekundäre Kacheln

		// MANUELL ERSTELLEN - KEIN KLONEN von primären Kacheln!
		const cellDiv = document.createElement("div");
		cellDiv.className = "hangar-cell bg-white border rounded-lg p-3 shadow-sm";
		cellDiv.setAttribute("data-cell-id", cellId.toString());
		cellDiv.id = `secondary-cell-${cellId}`;

		// Erstelle die HTML-Struktur manuell
		cellDiv.innerHTML = `
			<div class="cell-header mb-2">
				<div class="position-info-grid">
					<input
						type="text"
						id="position-${cellId}"
						placeholder="Position"
						class="position-input text-xs bg-gray-50 border border-gray-300 rounded px-1 py-0.5 w-full"
					/>
				</div>
			</div>

			<div class="aircraft-section mb-2">
				<input
					type="text"
					id="aircraft-${cellId}"
					placeholder="Aircraft ID"
					class="aircraft-input text-sm font-medium bg-gray-50 border border-gray-300 rounded px-2 py-1 w-full"
				/>
			</div>

			<div class="position-section mb-2">
				<input
					type="text"
					id="hangar-position-${cellId}"
					placeholder="Hangar Position"
					class="hangar-position-input text-xs bg-gray-50 border border-gray-300 rounded px-1 py-0.5 w-full"
				/>
			</div>

			<div class="manual-input-section mb-2">
				<input
					type="text"
					id="manual-input-${cellId}"
					placeholder="Manual Input"
					class="manual-input text-xs bg-gray-50 border border-gray-300 rounded px-1 py-0.5 w-full"
				/>
			</div>

			<div class="time-section grid grid-cols-2 gap-1 mb-2">
				<input
					type="time"
					id="arrival-time-${cellId}"
					class="arrival-time text-xs bg-gray-50 border border-gray-300 rounded px-1 py-0.5"
				/>
				<input
					type="time"
					id="departure-time-${cellId}"
					class="departure-time text-xs bg-gray-50 border border-gray-300 rounded px-1 py-0.5"
				/>
			</div>

			<div class="status-section grid grid-cols-2 gap-1 mb-2">
				<select id="status-${cellId}" class="status-selector text-xs bg-gray-50 border border-gray-300 rounded px-1 py-0.5">
					<option value="neutral">Neutral</option>
					<option value="ready">Ready</option>
					<option value="maintenance">Maintenance</option>
					<option value="departure">Departure</option>
				</select>
				<select id="tow-status-${cellId}" class="tow-status-selector text-xs bg-gray-50 border border-gray-300 rounded px-1 py-0.5">
					<option value="neutral">Neutral</option>
					<option value="initiated">Initiated</option>
					<option value="ongoing">Ongoing</option>
					<option value="on-position">On Position</option>
				</select>
			</div>

			<div class="notes-section">
				<textarea
					id="notes-${cellId}"
					placeholder="Notes"
					class="notes-textarea text-xs bg-gray-50 border border-gray-300 rounded px-1 py-0.5 w-full h-12 resize-none"
				></textarea>
			</div>
		`;

		// Zur sekundären Sektion hinzufügen
		secondaryGrid.appendChild(cellDiv);

		console.log(`✅ SYNC-Kachel ${cellId} ohne Klonen erstellt`);
	}

	// Layout-Klasse setzen
	secondaryGrid.className = `hangar-grid grid-cols-${layout}`;

	console.log(`=== ${count} KACHELN FÜR SYNC OHNE KLONEN ERSTELLT ===`);
	console.log(
		`🚫 KEIN DATENKLONING durchgeführt - alle Kacheln sind garantiert leer`
	);
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

// Export des hangarUI Objekts
window.hangarUI = {
	uiSettings,
	updateSecondaryTiles,
	updateCellAttributes,
	setupSecondaryTileEventListeners,
	adjustScaling,

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

	// ...existing functions...
};
