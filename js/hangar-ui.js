const uiSettings = {
	// DEPRECATED: Diese Einstellungen werden jetzt von display-options.js verwaltet
	// und in data.json gespeichert statt localStorage
	tilesCount: 12,
	secondaryTilesCount: 4,
	layout: 6,
	darkMode: false,
	zoomLevel: 100,
	tableView: false, // Neue Einstellung für die Tabellenansicht

	// MIGRATED: Lädt Einstellungen über das neue display-options System
	load: async function () {
		// Migration zum neuen System
		if (window.displayOptions) {
			console.log("✅ Verwende neues Display Options System");
			return await window.displayOptions.load();
		} else {
			console.warn(
				"⚠️ Display Options System nicht verfügbar, verwende Fallback"
			);
			return false;
		}

		/* DEPRECATED - localStorage wird nicht mehr verwendet
		try {
			// Aus localStorage laden
			const savedSettingsJSON = localStorage.getItem("hangarPlannerSettings");
			if (savedSettingsJSON) {
			const settings = JSON.parse(savedSettingsJSON);
			this.layout = settings.layout || 6;
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

				// console.log("Einstellungen aus LocalStorage geladen");
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
					parseInt(document.getElementById("layoutType").value) || 6;
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
				// console.log("Einstellungen im LocalStorage gespeichert");
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

			// Hangar Position sammeln (header field hangar-position-#)
			const hangarPositionInput = document.getElementById(
				`hangar-position-${cellId}`
			);
			const hangarPosition = hangarPositionInput ? hangarPositionInput.value : "";

			// Route/Arrival Position sammeln (info grid position-#)
			const routePositionInput = document.getElementById(
				`position-${cellId}`
			);
			const routePosition = routePositionInput ? routePositionInput.value : "";

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
				let arrivalTime = arrivalTimeInput ? arrivalTimeInput.value : "";
				if (window.helpers && window.helpers.canonicalizeDateTimeFieldValue) {
					arrivalTime = window.helpers.canonicalizeDateTimeFieldValue(`arrival-time-${cellId}`, arrivalTime) || "";
				}

				const departureTimeInput = document.getElementById(
					`departure-time-${cellId}`
				);
				let departureTime = departureTimeInput ? departureTimeInput.value : "";
				if (window.helpers && window.helpers.canonicalizeDateTimeFieldValue) {
					departureTime = window.helpers.canonicalizeDateTimeFieldValue(`departure-time-${cellId}`, departureTime) || "";
				}

				// Notizen sammeln
				const notesTextarea = document.getElementById(`notes-${cellId}`);
				const notes = notesTextarea ? notesTextarea.value : "";

			// Nur hinzufügen wenn mindestens ein Wert vorhanden ist
			if (
				hangarPosition ||
				routePosition ||
				aircraftId ||
				manualInputValue ||
				arrivalTime ||
				departureTime ||
				notes ||
				status !== "ready"
			) {
				tileValues.push({
					cellId: cellId,
					hangarPosition: hangarPosition,
					position: routePosition, // Info grid route/arrival position
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
				hangarGrid.style.gridTemplateColumns = `repeat(${this.layout}, var(--board-tile-size))`;
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
			// console.log(`Dark Mode ${enabled ? "aktiviert" : "deaktiviert"}`);
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
			// console.log(`Zoom-Level auf ${level}% gesetzt`);
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
			// console.log(
			//	`Ansichtsmodus auf "${tableViewEnabled ? "Tabelle" : "Kachel"}" gesetzt`
			// );
		}
	},

	// Wendet die gespeicherten Kachelwerte auf die UI an
	applyTileValues: function (tileValues) {
		// console.log(`Wende ${tileValues.length} gespeicherte Kachelwerte an...`);

		tileValues.forEach((tileValue) => {
			const cellId = tileValue.cellId;
			// console.log(`Anwenden von Werten für Kachel ${cellId}:`, tileValue);

		// Hangar Position setzen (header field)
		const hangarPositionInput = document.getElementById(
			`hangar-position-${cellId}`
		);
		if (hangarPositionInput && tileValue.hangarPosition) {
			hangarPositionInput.value = tileValue.hangarPosition;
		}

		// Route/Arrival Position setzen (info grid field)
		const routePositionInput = document.getElementById(
			`position-${cellId}`
		);
		if (routePositionInput && tileValue.position) {
			routePositionInput.value = tileValue.position;
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
				const h = window.helpers || {};
				let display = tileValue.arrivalTime;
				if (h.isISODateTimeLocal && h.isISODateTimeLocal(tileValue.arrivalTime)) {
					display = h.formatISOToCompactUTC(tileValue.arrivalTime);
				} else if (h.isHHmm && h.isHHmm(tileValue.arrivalTime) && h.getBaseDates && h.coerceHHmmToDateTimeLocalUtc) {
					const bases = h.getBaseDates();
					const iso = h.coerceHHmmToDateTimeLocalUtc(tileValue.arrivalTime, bases.arrivalBase || '');
					display = iso ? h.formatISOToCompactUTC(iso) : '';
				}
				arrivalTimeInput.value = display || '';
			}

			const departureTimeInput = document.getElementById(
				`departure-time-${cellId}`
			);
			if (departureTimeInput && tileValue.departureTime) {
				const h = window.helpers || {};
				let display = tileValue.departureTime;
				if (h.isISODateTimeLocal && h.isISODateTimeLocal(tileValue.departureTime)) {
					display = h.formatISOToCompactUTC(tileValue.departureTime);
				} else if (h.isHHmm && h.isHHmm(tileValue.departureTime) && h.getBaseDates && h.coerceHHmmToDateTimeLocalUtc) {
					const bases = h.getBaseDates();
					const iso = h.coerceHHmmToDateTimeLocalUtc(tileValue.departureTime, bases.departureBase || '');
					display = iso ? h.formatISOToCompactUTC(iso) : '';
				}
				departureTimeInput.value = display || '';
			}

			// Status setzen
			const statusSelect = document.getElementById(`status-${cellId}`);
if (statusSelect && tileValue.status) {
				statusSelect.value = tileValue.status;
				// Status-Licht aktualisieren - verwende die globale updateStatusLight Funktion
				if (typeof updateStatusLight === "function") {
					updateStatusLight(statusSelect);
				} else if (typeof updateStatusLightByCellId === "function") {
					updateStatusLightByCellId(cellId);
				}
				// Apply class-based styling for the selector itself
				try { if (typeof updateStatusSelectorStyles === 'function') updateStatusSelectorStyles(statusSelect); } catch(_) {}
			}

			// Notizen setzen
			const notesTextarea = document.getElementById(`notes-${cellId}`);
			if (notesTextarea && tileValue.notes) {
				notesTextarea.value = tileValue.notes;
			}
		});

		// Nach dem Anwenden aller Werte: Event auslösen für Status-Lichter-Update
		setTimeout(() => {
			const dataLoadedEvent = new CustomEvent("dataLoaded", {
				detail: {
					tilesUpdated: tileValues.length,
					timestamp: new Date().toISOString(),
				},
			});
			document.dispatchEvent(dataLoadedEvent);
		}, 100);
	},
};


// Placeholder für restliche Funktionen - diese werden aus der originalen Datei übernommen

/**
 * Vereinfachte Aktualisierung der sekundären Kacheln - analog zu updateTiles
 * Verwendet das gleiche einfache Show/Hide-System wie primäre Kacheln
 * @param {number} count - Anzahl der sekundären Kacheln
 * @param {number} layout - Anzahl der Spalten
 * @param {boolean} preserveData - Wird ignoriert, da Daten automatisch erhalten bleiben
 */
function updateSecondaryTiles(count, layout, preserveData = true) {
	// console.log(
	//	`🔧 Aktualisiere sekundäre Kacheln: ${count} (vereinfachtes System wie primäre Kacheln)`
	// );

	const secondaryGrid = document.getElementById("secondaryHangarGrid");
	if (!secondaryGrid) {
		console.error("❌ Sekundärer Grid-Container nicht gefunden");
		return;
	}

	// Prüfe aktuelle Anzahl der Kacheln
	let currentTiles = secondaryGrid.querySelectorAll(".hangar-cell");
	const currentCount = currentTiles.length;

	// console.log(`Aktuell ${currentCount} sekundäre Kacheln, Ziel: ${count}`);

	// Falls wir mehr Kacheln brauchen, erstelle sie (nur neue, niemals alle löschen)
	if (currentCount < count) {
		const tilesToCreate = count - currentCount;
		// console.log(`📦 Erstelle ${tilesToCreate} neue sekundäre Kacheln`);

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
		// Fix column width to a constant tile size
		secondaryGrid.style.gridTemplateColumns = `repeat(${layout}, minmax(240px, 1fr))`;
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

	// console.log(
	//	`✅ ${count} sekundäre Kacheln aktiviert - Daten bleiben erhalten!`
	// );

	// Event feuern für andere Systeme
	const event = new CustomEvent("secondaryTilesCreated", {
		detail: {
			count: count,
			cellIds: Array.from(currentTiles)
				.slice(0, count)
				.map((tile, index) => 101 + index),
		},
	});
	document.dispatchEvent(event);
}

/**
 * Erstellt eine einzelne sekundäre Kachel - einfacher Ansatz ohne komplizierte Logik
 * @param {number} cellId - ID der neuen Kachel
 * @param {HTMLElement} container - Container für die Kachel
 */
function createSingleSecondaryTile(cellId, container) {
	// console.log(`🎯 Erstelle einzelne sekundäre Kachel ${cellId}`);

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

	// WICHTIG: Event-Listener für die neue Kachel hinzufügen
	setupEventListenersForTile(cellClone, cellId);

	// console.log(`✅ Sekundäre Kachel ${cellId} erstellt`);
}

/**
 * Fügt Event-Listener für eine spezifische Kachel hinzu
 * @param {HTMLElement} tileElement - Das Kachel-Element
 * @param {number} cellId - Die Kachel-ID
 */
function setupEventListenersForTile(tileElement, cellId) {
	// Status-Selector Event-Listener (vereinfacht - nutzt globale updateStatusLight Funktion)
	const statusSelector = tileElement.querySelector(`#status-${cellId}`);
	if (
		statusSelector &&
		!statusSelector.hasAttribute("data-status-listener-added")
	) {
		statusSelector.addEventListener("change", function () {
			// Nutze die globale updateStatusLight Funktion aus index.html
			if (typeof updateStatusLight === "function") {
				updateStatusLight(this);
			}
		});
		statusSelector.setAttribute("data-status-listener-added", "true");

		// Initial Status setzen (nach DOM-Update)
		setTimeout(() => {
			if (typeof updateStatusLight === "function") {
				updateStatusLight(statusSelector);
			}
		}, 50);
	}

	// Aircraft ID Formatierung und Change-Handler
	const aircraftInput = tileElement.querySelector(`#aircraft-${cellId}`);
	if (aircraftInput && !aircraftInput.hasAttribute("data-listener-added")) {
		aircraftInput.addEventListener("input", function (e) {
			try {
				// Live-typing normalization: uppercase and add hyphen after first letter
				let raw = this.value || '';
				let clean = raw.replace(/-/g, '').toUpperCase();
				let out = clean.length > 1 ? (clean.charAt(0) + '-' + clean.slice(1)) : clean;
				if (out !== this.value) {
					this.value = out;
				}
			} catch(_) {}
		});
		const onAircraftBlur = function (e) {
			try {
				if (!e || !e.target || typeof e.target.value !== 'string') return;
				const prev = (e.target.value || '').toString();
				let formatted = '';
				if (typeof window.safeFormatAircraftId === 'function') {
					formatted = window.safeFormatAircraftId(e.target) || '';
				} else if (typeof formatAircraftId === 'function') {
					formatted = formatAircraftId(e.target) || '';
				}
				// Guard: if formatter produced empty but user had content, keep a sane fallback
				if (formatted.trim().length === 0 && prev.trim().length > 0) {
					// Minimal fallback: uppercase and keep hyphen if present
					e.target.value = prev.trim().toUpperCase();
				} else if (formatted.trim().length > 0) {
					e.target.value = formatted;
				}
			} catch(_e) {}
			// KORREKTUR: Aircraft ID Change Handler NUR bei blur - API-Aufruf erst nach vollständiger Eingabe
			if (
				window.hangarEvents &&
				typeof window.hangarEvents.handleAircraftIdChange === "function"
			) {
				window.hangarEvents.handleAircraftIdChange(
					e.target.id,
					e.target.value
				);
			}
			// Ensure immediate server flush via Event Manager even if other handlers are missed
			try {
				if (window.hangarEventManager && typeof window.hangarEventManager.debouncedFieldUpdate === 'function'){
					window.hangarEventManager.debouncedFieldUpdate(e.target.id, e.target.value, 150, { flushDelayMs: 0, source: 'blur' });
				}
			} catch(_e){}
		};
		aircraftInput.addEventListener("blur", onAircraftBlur);
		// Also handle focusout (fires reliably on Tab navigation)
		aircraftInput.addEventListener("focusout", onAircraftBlur);
		// As an additional safety, detect Tab key and trigger processing right away
		aircraftInput.addEventListener('keydown', function(ev){ if (ev.key === 'Tab') { try { onAircraftBlur({ target: ev.currentTarget }); } catch(_){} } });
		
		// Mark this aircraft input as wired to avoid duplicate listeners
		aircraftInput.setAttribute("data-listener-added", "true");
		// Fix: declare and guard towSelector for this tile
		const towSelector = tileElement.querySelector(`#tow-status-${cellId}`);
		if (towSelector && !towSelector.hasAttribute("data-listener-added")) {
			towSelector.addEventListener("change", function () {
				if (typeof updateTowStatusStyles === "function") {
					updateTowStatusStyles(this);
				}
			});
			towSelector.setAttribute("data-listener-added", "true");

			// Initial Towing Status setzen
			if (typeof updateTowStatusStyles === "function") {
				updateTowStatusStyles(towSelector);
			}
		}
	}
}
function adjustScaling() {
	// Dynamische Skalierung der UI-Elemente basierend auf Bildschirmgröße
	const container = document.querySelector(".main-container");
	if (!container) return;

	const screenWidth = window.innerWidth;
	const baseWidth = 1920; // Basis-Breite für 100% Skalierung

	let scaleFactor = screenWidth / baseWidth;
	
		// Begrenze die Skalierung (no upscaling above 1)
	scaleFactor = Math.max(0.7, Math.min(1, scaleFactor));

	container.style.transform = `scale(${scaleFactor})`;
	container.style.transformOrigin = "top left";

	// console.log(`UI-Skalierung angepasst: ${(scaleFactor * 100).toFixed(1)}%`);
}

function toggleSecondarySection(visible) {
	const secondarySection =
		document.querySelector(".section-container:nth-child(3)") ||
		document.getElementById("secondarySection") ||
		document.querySelector("[id*='secondary']");

	if (!secondarySection) {
		// Weniger aufdringliche Warnung
		//console.warn("Sekundäre Sektion nicht gefunden");
		return;
	}

	if (visible) {
		secondarySection.style.display = "block";
		secondarySection.classList.remove("hidden");
		//		// console.log("Sekundäre Sektion angezeigt");
	} else {
		secondarySection.style.display = "none";
		secondarySection.classList.add("hidden");
		//		// console.log("Sekundäre Sektion ausgeblendet");
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

	// console.log(`Status-Lights für Kachel ${cellId} auf "${status}" gesetzt`);
}

/**
 * Speichert die gesammelten Daten
 */
function saveCollectedData() {
	const tileValues = collectTileValues();
	if (typeof hangarData !== "undefined" && hangarData.saveTileData) {
		hangarData.saveTileData(tileValues);
		// console.log("Kacheldaten gespeichert");
	} else {
		// Fallback: localStorage verwenden
		try {
			localStorage.setItem("hangarTileData", JSON.stringify(tileValues));
			// console.log("Kacheldaten in localStorage gespeichert");
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
	// console.log(`🔧 Aktualisiere Zell-Attribute für Kachel ${cellId}`);

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

			// WICHTIG: data-cell Attribut für Status-Lichter aktualisieren
			if (element.classList.contains("status-light")) {
				element.setAttribute("data-cell", cellId.toString());
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

		// console.log(`✅ Zell-Attribute für Kachel ${cellId} aktualisiert`);
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
		// console.log(`📊 Sammle Daten für Kachel ${cellId}`);

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

		// Header Hangar Position (hangar-position-#)
		const hangarPosEl = document.getElementById(`hangar-position-${cellId}`);
		const hangarPosition =
			hangarPosEl && containerElement.contains(hangarPosEl)
				? hangarPosEl.value || ""
				: "";
		// Info grid route Position (position-#)
		const infoPosEl = document.getElementById(`position-${cellId}`);
		const position =
			infoPosEl && containerElement.contains(infoPosEl)
				? infoPosEl.value || ""
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
		let arrivalTime =
			arrivalElement && containerElement.contains(arrivalElement)
				? arrivalElement.value || ""
				: "";
		if (window.helpers && window.helpers.canonicalizeDateTimeFieldValue) {
			arrivalTime = window.helpers.canonicalizeDateTimeFieldValue(`arrival-time-${cellId}`, arrivalTime) || '';
		}

		const departureElement = document.getElementById(
			`departure-time-${cellId}`
		);
		let departureTime =
			departureElement && containerElement.contains(departureElement)
				? departureElement.value || ""
				: "";
		if (window.helpers && window.helpers.canonicalizeDateTimeFieldValue) {
			departureTime = window.helpers.canonicalizeDateTimeFieldValue(`departure-time-${cellId}`, departureTime) || '';
		}

	const tileData = {
		tileId: cellId,
		aircraftId: aircraftId,
		hangarPosition: hangarPosition, // Header hangar position
		position: position, // Info grid route position
		manualInput: manualInput,
		notes: notes,
		status: status,
		arrivalTime: arrivalTime,
		departureTime: departureTime,
	};

		// console.log(`✅ Daten für Kachel ${cellId} gesammelt:`, tileData);
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
	// console.log(`🔧 Aktualisiere primäre Kacheln: ${count}`);

	try {
		const grid = document.getElementById("hangarGrid");
		if (!grid) {
			console.error("❌ Primärer Grid nicht gefunden");
			return;
		}

		const tiles = grid.querySelectorAll(".hangar-cell");
		// console.log(`Gefunden ${tiles.length} primäre Kacheln`);

		// Zeige/verstecke Kacheln basierend auf count
		tiles.forEach((tile, index) => {
			if (index < count) {
				// Wichtig: hidden-Klasse entfernen, sonst bleibt display:none aus der Initialisierung
				tile.classList.remove("hidden");
				tile.style.display = "";
				tile.style.visibility = "visible";
			} else {
				// Konsistent zur Initialisierung: hidden hinzufügen
				tile.classList.add("hidden");
				tile.style.display = "none";
				tile.style.visibility = "hidden";
			}
		});

		// Aktualisiere auch das UI-Eingabefeld
		const tilesCountInput = document.getElementById("tilesCount");
		if (tilesCountInput && tilesCountInput.value !== count.toString()) {
			tilesCountInput.value = count;
		}

		// console.log(`✅ ${count} primäre Kacheln aktiviert`);

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
	adjustScaling,
	collectTileData,
	checkElement, // Fehlende Funktion hinzugefügt
	setupEventListenersForTile, // Neue Funktion hinzugefügt

	/**
	 * Initialisiert das Sektion-Layout
	 */
	initSectionLayout: function () {
		// console.log("🔧 Initialisiere Sektion-Layout...");

		// Stelle sicher, dass alle erforderlichen Sektionen vorhanden sind
const requiredSections = [
			"hangarGrid",
			"secondaryHangarGrid",
		];

		let allFound = true;
		requiredSections.forEach((sectionId) => {
			const section = document.getElementById(sectionId);
			if (!section) {
				console.warn(`⚠️ Sektion ${sectionId} nicht gefunden`);
				allFound = false;
			} else {
				// console.log(`✅ Sektion ${sectionId} gefunden`);
			}
		});

		if (allFound) {
			// Initiale UI-Einstellungen anwenden
			this.uiSettings.apply();
			// console.log("✅ Sektion-Layout erfolgreich initialisiert");
		} else {
			console.error("❌ Nicht alle erforderlichen Sektionen gefunden");
		}
	},


	/**
	 * Initialisiert Event-Listener für sekundäre Kacheln - VOLLSTÄNDIG ÜBERARBEITET
	 */
setupSecondaryTileEventListeners: function () {
		const secondaryContainer = document.getElementById("secondaryHangarGrid");
		if (!secondaryContainer) {
			console.warn("❌ Sekundärer Container nicht gefunden");
			return false;
		}

		// Ensure Event Manager is ready before scanning and wiring handlers
		if (!window.hangarEventManager || !window.hangarEventManager.safeAddEventListener) {
			try {
				// Demote noise to debug and log only once per session
				if (!window.__emSecondaryWarnedOnce) {
					console.debug("⏳ Event-Manager noch nicht bereit – retry after init (sekundäre Kacheln)");
					window.__emSecondaryWarnedOnce = true;
				}
				// Avoid stacking multiple retries
				if (!window.__emSecondaryRetryScheduled) {
					window.__emSecondaryRetryScheduled = true;
					document.addEventListener('eventManagerReady', () => {
						try {
							window.__emSecondaryRetryScheduled = false;
							if (window.hangarUI && window.hangarUI.setupSecondaryTileEventListeners) {
								window.hangarUI.setupSecondaryTileEventListeners();
							}
						} catch(_e) { window.__emSecondaryRetryScheduled = false; }
					}, { once: true });
					// Reduced timeout for faster retry, but still allow Event Manager to initialize
					window.__emSecondaryRetryId = setTimeout(() => {
						try {
							window.__emSecondaryRetryScheduled = false;
							if (window.hangarUI && window.hangarUI.setupSecondaryTileEventListeners) {
								window.hangarUI.setupSecondaryTileEventListeners();
							}
						} catch(_e) { 
							console.warn("⚠️ Retry für secondary tiles setup fehlgeschlagen:", _e);
							window.__emSecondaryRetryScheduled = false; 
						}
					}, 300); // Reduced from 400ms to 300ms
				}
			} catch(_e){}
			return false;
		}

		// console.log("🔧 Richte Event-Handler für sekundäre Kacheln ein...");

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
		const processedIds = new Set(); // Verhindert Duplikate

		relevantSelectors.forEach((selector) => {
			const elements = secondaryContainer.querySelectorAll(selector);
			// console.log(
			//	`🔍 Gefunden ${elements.length} Elemente für Selector: ${selector}`
			// );

			elements.forEach((element) => {
				if (processedIds.has(element.id)) {
					// console.log(`⏭️ Element bereits verarbeitet: ${element.id}`);
					return;
				}

				const cellId = this.extractCellIdFromElement(element);

				// Prüfung: Nur sekundäre Kacheln (ID >= 101) UND Element muss im sekundären Container sein
				if (cellId >= 101 && secondaryContainer.contains(element)) {
					// console.log(
					//	`🎯 Registriere Handler für sekundäres Element: ${element.id} (Kachel ${cellId})`
					// );

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
                            // Do not live-sync notes while typing; handle on blur instead
                            if (event.target.id && event.target.id.startsWith('notes-')) return;
                            window.hangarEventManager.debouncedFieldUpdate(
                                event.target.id,
                                event.target.value
                            );
							},
							`secondary_input_${cellId}_${element.id}`
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
							`secondary_blur_${cellId}_${element.id}`
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
							`secondary_change_${cellId}_${element.id}`
						);

						handlersRegistered++;
						processedIds.add(element.id);
					} else {
						console.warn(
							"⚠️ Event-Manager nicht verfügbar, versuche verzögert zu registrieren:",
							element.id
						);
						// Try once when Event Manager becomes ready
						try {
							document.addEventListener('eventManagerReady', () => {
								try { if (window.hangarUI && window.hangarUI.setupSecondaryTileEventListeners) window.hangarUI.setupSecondaryTileEventListeners(); } catch(_e){}
							}, { once: true });
						} catch(_e){}
						// Also schedule a short retry
						setTimeout(() => {
							try { if (window.hangarUI && window.hangarUI.setupSecondaryTileEventListeners) window.hangarUI.setupSecondaryTileEventListeners(); } catch(_e){}
						}, 400);
						// Fallback: Direkte Event-Handler (as last resort)
						element.addEventListener("input", (event) => {
							console.log(
								`📝 Fallback Input: ${event.target.id} = "${event.target.value}"`
							);
							// Versuche localStorage-Update
							if (window.storageBrowser && window.storageBrowser.save) {
								const fieldData = {};
								fieldData[event.target.id] = event.target.value;
								window.storageBrowser.save(fieldData);
							}
						});
						element.addEventListener("blur", (event) => {
							console.log(
								`👁️ Fallback Blur: ${event.target.id} = "${event.target.value}"`
							);
						});
						handlersRegistered++;
						processedIds.add(element.id);
					}
				} else if (cellId < 101) {
					console.log(
						`⏭️ Element ${element.id} gehört zu primären Kacheln (ID: ${cellId})`
					);
				} else {
					console.log(
						`⏭️ Element ${element.id} nicht im sekundären Container oder ungültige ID`
					);
				}
			});
		});

		// console.log(
		//	`✅ ${handlersRegistered} Event-Handler für sekundäre Kacheln registriert`
		// );

		return handlersRegistered > 0;
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

// Status-Lichter-Funktionen global verfügbar machen
if (typeof updateAllStatusLights !== "undefined") {
	window.updateAllStatusLights = updateAllStatusLights;
}
if (typeof updateStatusLightByCellId !== "undefined") {
	window.updateStatusLightByCellId = updateStatusLightByCellId;
}

// setupSecondaryTileEventListeners als globale Funktion
window.setupSecondaryTileEventListeners = function () {
	if (window.hangarUI && window.hangarUI.setupSecondaryTileEventListeners) {
		return window.hangarUI.setupSecondaryTileEventListeners();
	} else {
		console.warn(
			"❌ hangarUI.setupSecondaryTileEventListeners nicht verfügbar"
		);
		return false;
	}
};

// VERBESSERTE INITIALISIERUNGS-KOORDINATION
// Stellt sicher, dass Event-Handler nach der vollständigen DOM-/UI-Initialisierung registriert werden
document.addEventListener("DOMContentLoaded", function () {
	// console.log("🚀 === HANGARPLANNER INITIALISIERUNG GESTARTET ===");

	// Phase 1: Basis-UI laden (0ms)
	// console.log("📋 Phase 1: Basis-UI wird geladen...");

	// Phase 2: Event-Manager initialisieren (1000ms)
	setTimeout(() => {
		// console.log("🔧 Phase 2: Event-Manager wird initialisiert...");
		if (window.hangarEventManager && !window.hangarEventManager.initialized) {
			window.hangarEventManager.init();
		}
	}, 1000);

	// Phase 3: Sekundäre Event-Handler registrieren (2000ms)
	setTimeout(() => {
		// console.log("🎯 Phase 3: Sekundäre Event-Handler werden registriert...");

		// Prüfe ob sekundäre Kacheln existieren
		const secondaryContainer = document.getElementById("secondaryHangarGrid");
		if (secondaryContainer && secondaryContainer.children.length > 0) {
			// console.log(
			//	`🔍 ${secondaryContainer.children.length} sekundäre Kacheln gefunden`
			// );

			if (window.setupSecondaryTileEventListeners) {
				const result = window.setupSecondaryTileEventListeners();
				// console.log("✅ setupSecondaryTileEventListeners (global):", result);
			} else if (
				window.hangarUI &&
				window.hangarUI.setupSecondaryTileEventListeners
			) {
				const result = window.hangarUI.setupSecondaryTileEventListeners();
				// console.log("✅ setupSecondaryTileEventListeners (hangarUI):", result);
			} else {
				console.warn("❌ setupSecondaryTileEventListeners nicht verfügbar");
			}
		} else {
			// console.log(
			//	"ℹ️ Keine sekundären Kacheln gefunden, überspringe Handler-Registrierung"
			// );
		}
	}, 2000);

	// Phase 4: Server-Sync einrichten (3000ms)
	setTimeout(() => {
		// console.log("🌐 Phase 4: Server-Sync wird eingerichtet...");
		if (!window.storageBrowser) return;
		try {
			// Gate initial server load by Read toggle
			const readOn = (window.serverSync && typeof window.serverSync.canReadFromServer === 'function')
				? window.serverSync.canReadFromServer()
				: !!document.getElementById('readDataToggle')?.checked;
			if (!readOn) {
				// Skip initial read when Read is off (Standalone or Write-only)
				// console.log("⏭️ Phase 4: Read OFF – überspringe initialen Server-Load");
				return;
			}
		} catch (e) { /* noop */ }

		// Versuche Server-Daten zu laden (Read enabled)
		window.storageBrowser
			.loadFromServer()
			.then((serverData) => {
				if (serverData) {
					// console.log("📥 Server-Daten verfügbar, wende an...");
					window.storageBrowser.applyServerData(serverData);
				} else {
					// console.log(
					//	"ℹ️ Keine Server-Daten verfügbar, verwende lokale Daten"
					// );
				}
			})
			.catch((error) => {
				console.warn("⚠️ Fehler beim Laden der Server-Daten:", error);
			});
	}, 3000);

	// Phase 5: Validierung und Status-Check (5000ms)
	setTimeout(() => {
		// console.log("🔍 Phase 5: System-Validierung...");

		// Prüfe Event-Handler Status
		if (window.hangarEventManager) {
			const status = window.hangarEventManager.getStatus();
			// console.log("📊 Event-Manager Status:", status);
		}

		// Prüfe Container-Zuordnungen
		const primaryContainer = document.getElementById("hangarGrid");
		const secondaryContainer = document.getElementById("secondaryHangarGrid");

		if (primaryContainer) {
			const primaryFields = primaryContainer.querySelectorAll(
				"input, select, textarea"
			);
			// console.log(
			//	`✅ Primärer Container: ${primaryFields.length} Felder gefunden`
			// );
		}

		if (secondaryContainer) {
			const secondaryFields = secondaryContainer.querySelectorAll(
				"input, select, textarea"
			);
			// console.log(
			//	`✅ Sekundärer Container: ${secondaryFields.length} Felder gefunden`
			// );

			// Prüfe explizit sekundäre IDs
			const secondaryIDs = [];
			secondaryFields.forEach((field) => {
				if (field.id) {
					const cellId = window.hangarUI
						? window.hangarUI.extractCellIdFromElement(field)
						: parseInt(field.id.match(/\d+$/)?.[0] || 0);
					if (cellId >= 101) {
						secondaryIDs.push(field.id);
					}
				}
			});
			// console.log(
			//	`🎯 Sekundäre IDs gefunden: ${secondaryIDs.length}`,
			//	secondaryIDs
			// );
		}

		// WICHTIG: Finale Status-Lichter-Aktualisierung nach vollständiger Initialisierung
		if (typeof updateAllStatusLights === "function") {
			// console.log('🔄 Finale Status-Lichter-Aktualisierung...');
			updateAllStatusLights();
		}

		// console.log("🎉 === HANGARPLANNER INITIALISIERUNG ABGESCHLOSSEN ===");
	}, 5000);
});
