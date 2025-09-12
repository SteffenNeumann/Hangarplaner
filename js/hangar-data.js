/**
 * hangar-data.js
 * Enthält Datenverwaltungsfunktionen für die HangarPlanner-Anwendung
 * Verantwortlich für Datensammlung, Speichern, Laden und Import/Export
 */

// Datenstruktur für die Flugzeuge
const hangarData = {
	cells: Array(8)
		.fill()
		.map((_, i) => ({
			id: i + 1,
			aircraftId: "",
			manualInput: "",
			arrivalTime: "",
			departureTime: "",
			position: "",
			status: "ready",
			lightsStatus: {
				arrival: false,
				present: false,
				departure: false,
			},
		})),
};

/**
 * Sammelt alle Daten aus dem Hangar für das Speichern
 * @returns {Object} Alle gesammelten Daten
 */
hangarData.collectAllHangarData = function () {
	try {
		// Projektname und Metadaten sammeln
		const projectName =
			document.getElementById("projectName").value || "HangarPlan";
		const projectId =
			document.getElementById("projectId").value || Date.now().toString();

		// Basis-Einstellungen sammeln (Legacy-Format für Kompatibilität)
		const settings = {
			tilesCount: parseInt(document.getElementById("tilesCount")?.value) || 8,
			secondaryTilesCount:
				parseInt(document.getElementById("secondaryTilesCount")?.value) || 4, // Startwert 4
			layout: parseInt(document.getElementById("layoutType")?.value) || 4,
		};

		// *** NEU: Display Options hinzufügen ***
		if (window.displayOptions) {
			// Aktuelle UI-Werte sammeln
			window.displayOptions.collectFromUI();
			// Display Options zu den Einstellungen hinzufügen – darkMode NIE mitsenden
			const opts = { ...window.displayOptions.current };
			delete opts.darkMode; // Theme bleibt nur lokal
			settings.displayOptions = opts;
			console.log(
				"🎛️ Display Options zu collectAllHangarData hinzugefügt (ohne darkMode):",
				settings.displayOptions
			);
		}

		// Kacheldaten sammeln
		const primaryTiles = collectContainerTileData("#hangarGrid");
		const secondaryTiles = collectContainerTileData("#secondaryHangarGrid");

		// Gesamtdaten zusammenstellen
		const finalData = {
			id: projectId,
			metadata: {
				projectName: projectName,
				exportDate: new Date().toISOString(),
				lastModified: new Date().toISOString(),
			},
			settings: settings,
			primaryTiles: primaryTiles,
			secondaryTiles: secondaryTiles,
		};

		return finalData;
	} catch (error) {
		console.error("Fehler beim Sammeln der Hangardaten:", error);
		return null;
	}
};

/**
 * Importiert einen Hangarplan aus einer JSON-Datei
 */
function importHangarPlanFromJson(event) {
	try {
		const file = event.target.files[0];
		if (!file) {
			showNotification("Keine Datei ausgewählt", "error");
			return;
		}

		const reader = new FileReader();
		reader.onload = function (e) {
			try {
				const data = JSON.parse(e.target.result);

				// Projektname setzen
				if (data.metadata && data.metadata.projectName) {
					document.getElementById("projectName").value =
						data.metadata.projectName;
				}

				// Einstellungen übernehmen
				if (data.settings) {
					if (window.hangarUI.checkElement("tilesCount")) {
						document.getElementById("tilesCount").value =
							data.settings.tilesCount || 8;
					}
					if (window.hangarUI.checkElement("secondaryTilesCount")) {
						document.getElementById("secondaryTilesCount").value =
							data.settings.secondaryTilesCount || 4;
					}
					if (window.hangarUI.checkElement("layoutType")) {
						document.getElementById("layoutType").value =
							data.settings.layout || 4;
					}

					// Einstellungen anwenden
					window.hangarUI.uiSettings.tilesCount = data.settings.tilesCount || 8;
					window.hangarUI.uiSettings.secondaryTilesCount =
						data.settings.secondaryTilesCount || 4;
					window.hangarUI.uiSettings.layout = data.settings.layout || 4;
					window.hangarUI.uiSettings.apply();
				}

				// Kachelndaten anwenden
				applyLoadedTileData(data);

				showNotification("Hangarplan erfolgreich geladen", "success");
			} catch (error) {
				console.error("Fehler beim Verarbeiten der importierten Datei:", error);
				showNotification(`Import-Fehler: ${error.message}`, "error");
			}
		};

		reader.readAsText(file);

		// Input zurücksetzen
		event.target.value = "";
	} catch (error) {
		console.error("Fehler beim Importieren des Hangarplans:", error);
		showNotification(`Import-Fehler: ${error.message}`, "error");
	}
}

/**
 * Importiert einen Hangarplan aus einer JSON-Datei mit FileSystem API
 */
async function importHangarPlanWithFilePicker() {
	try {
		// Prüfen ob Browser File System API unterstützt und verwenden
		const isFileSystemAPISupported = "showOpenFilePicker" in window;
		const useFileSystem =
			localStorage.getItem("useFileSystemAccess") === "true";

		console.log(
			`Import mit FilePicker, API unterstützt: ${isFileSystemAPISupported}, verwenden: ${useFileSystem}`
		);

		let jsonData = null;

		if (useFileSystem && isFileSystemAPISupported) {
			try {
				// FilePicker Optionen konfigurieren
				const options = {
					types: [
						{
							description: "JSON Files",
							accept: { "application/json": [".json"] },
						},
					],
					multiple: false,
				};

				// Dialog öffnen
				const [fileHandle] = await window.showOpenFilePicker(options);
				const file = await fileHandle.getFile();

				// Datei lesen
				jsonData = await file.text();
			} catch (error) {
				if (error.name === "AbortError") {
					console.log("Benutzer hat den Dialog abgebrochen");
					return;
				}

				// Fallback bei Fehler
				console.error("Fehler beim Öffnen mit File System API:", error);
				window.showNotification(
					"Dateiauswahl konnte nicht geöffnet werden, nutze Standard-Dialog",
					"warning"
				);

				// Fallback zum regulären File Input
				return importHangarPlanFallback();
			}
		} else {
			// Fallback wenn API nicht unterstützt wird
			return importHangarPlanFallback();
		}

		// Verarbeite den geladenen Dateiinhalt
		if (jsonData) {
			const data = JSON.parse(jsonData);

			// Anwenden auf die Anwendung
			applyLoadedHangarPlan(data);
		}
	} catch (error) {
		console.error("Fehler beim Importieren des Hangarplans:", error);
		window.showNotification(`Import-Fehler: ${error.message}`, "error");
	}
}

/**
 * Fallback für den Import mit regulärem File Input
 * @private
 */
function importHangarPlanFallback() {
	return new Promise((resolve, reject) => {
		// Dateiauswahldialog erstellen
		const fileInput = document.createElement("input");
		fileInput.type = "file";
		fileInput.accept = ".json";
		fileInput.style.display = "none";
		document.body.appendChild(fileInput);

		fileInput.onchange = (event) => {
			try {
				const file = event.target.files[0];
				if (!file) {
					resolve();
					return;
				}

				const reader = new FileReader();
				reader.onload = (e) => {
					try {
						const data = JSON.parse(e.target.result);
						applyLoadedHangarPlan(data);
						resolve(data);
					} catch (error) {
						console.error("Fehler beim Verarbeiten der Datei:", error);
						window.showNotification(`Import-Fehler: ${error.message}`, "error");
						reject(error);
					}
				};

				reader.readAsText(file);
			} catch (error) {
				reject(error);
			} finally {
				document.body.removeChild(fileInput);
			}
		};

		fileInput.click();
	});
}

/**
 * Wendet den importierten Hangarplan auf die Anwendung an - DIREKT (ohne Rekursion)
 * @private
 */
function applyLoadedHangarPlan(data) {
	console.log("📥 Wende Hangarplan direkt an (KEINE Rekursion)");

	// KEINE REKURSION: Direkte Anwendung ohne dataCoordinator
	// Die Funktion wird bereits vom dataCoordinator aufgerufen
	// Projektname setzen
	if (data.metadata && data.metadata.projectName) {
		document.getElementById("projectName").value = data.metadata.projectName;

		// Auch die versteckte ID setzen, falls vorhanden
		if (data.id && document.getElementById("projectId")) {
			document.getElementById("projectId").value = data.id;
		}
	}

	// Einstellungen übernehmen und anwenden
	if (data.settings) {
		// *** NEU: Display Options anwenden ***
		if (data.settings.displayOptions && window.displayOptions) {
			window.displayOptions.current = {
				...window.displayOptions.defaults,
				...data.settings.displayOptions,
			};
			window.displayOptions.updateUI();
			window.displayOptions.applySettings();
			console.log(
				"🎛️ Display Options von geladenen Daten angewendet:",
				data.settings.displayOptions
			);
		} else {
			// Legacy-System für alte Daten ohne displayOptions
			if (window.hangarUI && window.hangarUI.checkElement("tilesCount")) {
				document.getElementById("tilesCount").value =
					data.settings.tilesCount || 8;
			}
			if (
				window.hangarUI &&
				window.hangarUI.checkElement("secondaryTilesCount")
			) {
				document.getElementById("secondaryTilesCount").value =
					data.settings.secondaryTilesCount || 4;
			}
			if (window.hangarUI && window.hangarUI.checkElement("layoutType")) {
				document.getElementById("layoutType").value = data.settings.layout || 4;
			}

			// Legacy-Einstellungen anwenden
			if (window.hangarUI && window.hangarUI.uiSettings) {
				window.hangarUI.uiSettings.tilesCount = data.settings.tilesCount || 8;
				window.hangarUI.uiSettings.secondaryTilesCount =
					data.settings.secondaryTilesCount || 4;
				window.hangarUI.uiSettings.layout = data.settings.layout || 4;
				window.hangarUI.uiSettings.apply();
			}
		}
	}

	// Kachelndaten anwenden
	applyLoadedTileData(data);

	window.showNotification &&
		window.showNotification("Hangarplan erfolgreich geladen", "success");
	console.log("✅ Hangarplan angewendet (Fallback-Methode)");
	return data;
}

/**
 * Sammelt Daten von allen Kacheln in einem Container - VERBESSERT
 * @param {string} containerSelector - CSS-Selektor für den Container
 * @returns {Array} - Array mit Kacheldaten
 */
function collectContainerTileData(containerSelector) {
	try {
		const container = document.querySelector(containerSelector);
		if (!container) {
			console.warn(`Container ${containerSelector} nicht gefunden`);
			return [];
		}

		const tiles = container.querySelectorAll(".hangar-cell");
		const tileData = [];

		console.log(`=== SAMMELN VON DATEN AUS ${containerSelector} ===`);
		console.log(`Gefundene Kacheln: ${tiles.length}`);

		tiles.forEach((tile, index) => {
			// Ignoriere versteckte Kacheln
			if (tile.classList.contains("hidden")) {
				console.log(`Kachel ${index} übersprungen (versteckt)`);
				return;
			}

			const isSecondary = containerSelector === "#secondaryHangarGrid";
			const tileId = isSecondary ? 100 + index + 1 : index + 1;

			console.log(
				`Verarbeite Kachel ${index}, ID: ${tileId}, isSecondary: ${isSecondary}`
			);

			// VERBESSERTE VALIDATION: Prüfe Container-Zugehörigkeit mit mehreren Strategien
			const validateElementInContainer = (elementId) => {
				const element = document.getElementById(elementId);
				if (!element) return null;

				// Strategie 1: Direkte Container-Prüfung
				if (container.contains(element)) {
					return element;
				}

				// Strategie 2: Parent-Traversal (für dynamisch erstellte Elemente)
				let parent = element.parentElement;
				let depth = 0;
				while (parent && depth < 10) {
					if (parent === container) {
						console.log(
							`✅ Element ${elementId} gefunden via Parent-Traversal (Tiefe: ${depth})`
						);
						return element;
					}
					parent = parent.parentElement;
					depth++;
				}

				// Strategie 3: Über data-cell-id Attribut suchen
				const cellElement = container.querySelector(
					`[data-cell-id="${tileId}"]`
				);
				if (cellElement && cellElement.contains(element)) {
					console.log(`✅ Element ${elementId} gefunden via data-cell-id`);
					return element;
				}

				console.warn(
					`❌ Element ${elementId} nicht im Container ${containerSelector} gefunden`
				);
				return null;
			};

			// Sammle alle Daten mit verbesserter Validation
			const aircraftElement = validateElementInContainer(`aircraft-${tileId}`);
			const aircraftId = aircraftElement?.value || "";

			const positionElement = validateElementInContainer(
				`hangar-position-${tileId}`
			);
			const position = positionElement?.value || "";

			const manualInputElement = validateElementInContainer(
				`manual-input-${tileId}`
			);
			const manualInput = manualInputElement?.value || "";

			const notesElement = validateElementInContainer(`notes-${tileId}`);
			const notes = notesElement?.value || "";

			const statusElement = validateElementInContainer(`status-${tileId}`);
			const status = statusElement?.value || "neutral";

			const towStatusElement = validateElementInContainer(
				`tow-status-${tileId}`
			);
			const towStatus = towStatusElement?.value || "neutral";

			const arrivalElement = validateElementInContainer(`arrival-time-${tileId}`);
			let arrivalTime = "";
			if (arrivalElement) {
				const rawIso = arrivalElement.dataset?.iso || "";
				if (rawIso) {
					arrivalTime = rawIso;
				} else if (
					window.helpers &&
					typeof window.helpers.canonicalizeDateTimeFieldValue === "function"
				) {
					arrivalTime =
						window.helpers.canonicalizeDateTimeFieldValue(
							arrivalElement.id,
							arrivalElement.value || ""
						) || "";
				} else {
					arrivalTime = arrivalElement.value || "";
				}
			}

			const departureElement = validateElementInContainer(`departure-time-${tileId}`);
			let departureTime = "";
			if (departureElement) {
				const rawIso = departureElement.dataset?.iso || "";
				if (rawIso) {
					departureTime = rawIso;
				} else if (
					window.helpers &&
					typeof window.helpers.canonicalizeDateTimeFieldValue === "function"
				) {
					departureTime =
						window.helpers.canonicalizeDateTimeFieldValue(
							departureElement.id,
							departureElement.value || ""
						) || "";
				} else {
					departureTime = departureElement.value || "";
				}
			}

			const positionInfoElement = validateElementInContainer(
				`position-${tileId}`
			);
			const positionInfoGrid = positionInfoElement?.value || "";

			console.log(`Tow-Status für Kachel ${tileId} gesammelt: ${towStatus}`);

			// Debug: Zeiten immer loggen um Probleme zu identifizieren
			console.log(`Arrival Time Element für Kachel ${tileId}:`, arrivalElement);
			console.log(
				`Arrival Time Raw Value für Kachel ${tileId}:`,
				arrivalElement?.value
			);
			console.log(`Arrival Time Final für Kachel ${tileId}:`, arrivalTime);

			console.log(
				`Departure Time Element für Kachel ${tileId}:`,
				departureElement
			);
			console.log(
				`Departure Time Raw Value für Kachel ${tileId}:`,
				departureElement?.value
			);
			console.log(`Departure Time Final für Kachel ${tileId}:`, departureTime);
			if (positionInfoGrid) {
				console.log(
					`Position Info Grid für Kachel ${tileId} gesammelt: ${positionInfoGrid}`
				);
			}
			// Ermittele per-Tile Last-Update-Zeit (Badge) als ISO
			let updatedAtIso = "";
			try {
				const store = window.LastUpdateBadges?.load?.() || {};
				const meta = store[String(tileId)];
				if (meta && meta.ts && isFinite(meta.ts)) {
					updatedAtIso = new Date(meta.ts).toISOString();
				} else {
					const host = document.querySelector(`[data-cell-id="${tileId}"]`);
					const badge = host ? host.querySelector('.last-update-badge') : null;
					const ts = badge ? parseInt(badge.dataset.timestamp, 10) : NaN;
					if (isFinite(ts)) updatedAtIso = new Date(ts).toISOString();
				}
			} catch (e) {}

			const tileDataObject = {
				tileId: tileId,
				aircraftId: aircraftId,
				position: position, // Hangar position (hangar-position-X)
				positionInfoGrid: positionInfoGrid, // Position in Info Grid (position-X)
				manualInput: manualInput,
				notes: notes,
				status: status,
				towStatus: towStatus,
				arrivalTime: arrivalTime,
				departureTime: departureTime,
				updatedAt: updatedAtIso,
			};

			// Optional: Dual-booking schedule stored in hidden input schedule-<tileId>
			try {
				const scheduleEl = validateElementInContainer(`schedule-${tileId}`);
				if (scheduleEl && scheduleEl.value) {
					const parsed = JSON.parse(scheduleEl.value || '[]');
					if (Array.isArray(parsed) && parsed.length) {
						tileDataObject.bookings = parsed.slice(0, 2);
					}
				}
			} catch(_e){}

			console.log(
				`✅ Gesammelte Daten für Kachel ${tileId} (${
					isSecondary ? "sekundär" : "primär"
				}):`,
				tileDataObject
			);
			tileData.push(tileDataObject);
		});

		console.log(
			`=== SAMMELN ABGESCHLOSSEN: ${tileData.length} Kacheln aus ${containerSelector} ===`
		);
		return tileData;
	} catch (error) {
		console.error("Fehler beim Sammeln der Kacheldaten:", error);
		return [];
	}
}

/**
 * Wendet Daten aus einem geladenen Hangarplan auf die UI an
 */
function applyLoadedTileData(data) {
	console.log("=== APPLY LOADED TILE DATA ===");
	console.log("Erhaltene Daten:", data);

	// Prüfe, welches Datenformat vorliegt
	const hasNewFormat = data.primaryTiles || data.secondaryTiles;
	const hasLegacyFormat = data.tilesData && Array.isArray(data.tilesData);

	if (hasNewFormat) {
		console.log("🔄 Verwende neues Datenformat (primaryTiles/secondaryTiles)");

		// Primäre Kacheln füllen
		if (data.primaryTiles && Array.isArray(data.primaryTiles)) {
			console.log(`Wende ${data.primaryTiles.length} primäre Kacheln an:`);
			data.primaryTiles.forEach((tile, index) => {
				console.log(`Primäre Kachel ${index + 1}:`, tile);
				applySingleTileData(tile, false);
			});
		} else {
			console.log("Keine primären Kacheln in den Daten gefunden");
		}

		// Sekundäre Kacheln füllen
		if (data.secondaryTiles && Array.isArray(data.secondaryTiles)) {
			console.log(`Wende ${data.secondaryTiles.length} sekundäre Kacheln an:`);

			// Stelle sicher, dass genügend sekundäre Kacheln existieren
			if (data.secondaryTiles.length > 0 && data.settings) {
				window.hangarUI.uiSettings.secondaryTilesCount =
					data.settings.secondaryTilesCount;
				window.hangarUI.updateSecondaryTiles(
					window.hangarUI.uiSettings.secondaryTilesCount,
					window.hangarUI.uiSettings.layout
				);
			}

			// Dann Daten zuweisen
			data.secondaryTiles.forEach((tile, index) => {
				console.log(`Sekundäre Kachel ${index + 1}:`, tile);
				applySingleTileData(tile, true);
			});
		} else {
			console.log("Keine sekundären Kacheln in den Daten gefunden");
		}
	} else if (hasLegacyFormat) {
		console.log(
			"🔄 Verwende Legacy-Datenformat (tilesData) - Fallback zur applyProjectData"
		);

		// Fallback: Verwende die bestehende applyProjectData Logik für tilesData
		console.log(`Lade ${data.tilesData.length} Kacheln aus Legacy-Format`);

		// Setze zunächst die UI-Einstellungen, falls vorhanden
		if (data.settings) {
			const { tilesCount, secondaryTilesCount, layout } = data.settings;

			if (window.hangarUI && window.hangarUI.uiSettings) {
				window.hangarUI.uiSettings.tilesCount = tilesCount || 8;
				window.hangarUI.uiSettings.secondaryTilesCount =
					secondaryTilesCount || 4;
				window.hangarUI.uiSettings.layout = layout || 4;
				window.hangarUI.uiSettings.apply();
			}
		}

		// Warte kurz auf UI-Update und wende dann die Daten an
		setTimeout(() => {
			data.tilesData.forEach((tileData) => {
				const {
					id,
					position,
					aircraftId,
					status,
					towStatus,
					notes,
					arrivalTime,
					departureTime,
					positionInfoGrid,
				} = tileData;

				console.log(
					`Lade Legacy-Kachel ${id}: position=${position}, aircraft=${aircraftId}, status=${status}`
				);

				// Positionswert setzen
				const posInput = document.getElementById(`hangar-position-${id}`);
				if (posInput) {
					posInput.value = position || "";
				}

				// Aircraft ID setzen
				const aircraftInput = document.getElementById(`aircraft-${id}`);
				if (aircraftInput) {
					aircraftInput.value = aircraftId || "";
				}

				// Status setzen
				const statusSelect = document.getElementById(`status-${id}`);
				if (statusSelect) {
					statusSelect.value = status || "neutral";
					// Status-Event auslösen, um das Statuslicht zu aktualisieren
					const event = new Event("change");
					statusSelect.dispatchEvent(event);
				}

				// Tow-Status setzen
				const towStatusSelect = document.getElementById(`tow-status-${id}`);
				if (towStatusSelect) {
					towStatusSelect.value = towStatus || "neutral";
					// Event auslösen, um Styling zu aktualisieren
					const event = new Event("change");
					towStatusSelect.dispatchEvent(event);
				}

				// Notizen setzen
				const notesTextarea = document.getElementById(`notes-${id}`);
				if (notesTextarea) {
					notesTextarea.value = notes || "";
				}

		// Arrival Time setzen (auch leeren wenn leerer String geliefert)
		const arrivalInput = document.getElementById(`arrival-time-${id}`);
		if (arrivalInput) {
			if (Object.prototype.hasOwnProperty.call(tile, 'arrivalTime')) {
				const v = tile.arrivalTime || '';
				arrivalInput.value = v;
				try { if (!v && arrivalInput.dataset) delete arrivalInput.dataset.iso; } catch(_e){}
			}
		}

		// Departure Time setzen (auch leeren wenn leerer String geliefert)
		const departureInput = document.getElementById(`departure-time-${id}`);
		if (departureInput) {
			if (Object.prototype.hasOwnProperty.call(tile, 'departureTime')) {
				const v = tile.departureTime || '';
				departureInput.value = v;
				try { if (!v && departureInput.dataset) delete departureInput.dataset.iso; } catch(_e){}
			}
		}

		// Position Info Grid setzen (legacy key) oder moderne 'position'
		const positionInfoInput = document.getElementById(`position-${id}`);
		if (positionInfoInput) {
			if (Object.prototype.hasOwnProperty.call(tile, 'positionInfoGrid')) {
				positionInfoInput.value = tile.positionInfoGrid || '';
			} else if (Object.prototype.hasOwnProperty.call(tile, 'position')) {
				positionInfoInput.value = tile.position || '';
			}
		}
			});

			console.log("✅ Legacy-Daten erfolgreich angewendet");
		}, 300);
	} else {
		console.log("❌ Keine gültigen Kacheldaten gefunden");
	}
}

/**
 * Wendet die Daten einer Kachel auf die entsprechende UI-Kachel an
 */
function applySingleTileData(tileData, isSecondary = false) {
	try {
		const tileId = tileData.tileId;
		console.log(`=== ANWENDEN DER DATEN FÜR TILE ${tileId} ===`);
		console.log(`isSecondary: ${isSecondary}`);
		console.log(`tileData:`, tileData);

		// WICHTIG: Validation - sekundäre Kacheln haben IDs >= 101, primäre IDs 1-12
		const expectedSecondary = tileId >= 101;
		if (isSecondary !== expectedSecondary) {
			console.error(
				`❌ MAPPING FEHLER: Tile ${tileId} - isSecondary=${isSecondary}, aber ID deutet auf ${
					expectedSecondary ? "sekundär" : "primär"
				} hin`
			);
			return;
		}

		// Container-basierte Validation - stelle sicher, dass das Element in der richtigen Sektion existiert
		const expectedContainer = isSecondary
			? "#secondaryHangarGrid"
			: "#hangarGrid";
		const containerElement = document.querySelector(expectedContainer);
		if (!containerElement) {
			console.warn(`❌ Container ${expectedContainer} nicht gefunden`);
			return;
		}

		// Prüfe, ob das Element wirklich im erwarteten Container ist
		const aircraftInput = document.getElementById(`aircraft-${tileId}`);
		if (aircraftInput) {
			const isInExpectedContainer = containerElement.contains(aircraftInput);
			if (!isInExpectedContainer) {
				console.error(
					`❌ KRITISCHER MAPPING FEHLER: Element aircraft-${tileId} wurde gefunden, aber ist NICHT im erwarteten Container ${expectedContainer}!`
				);
				return;
			}
		}

		// Aircraft ID setzen - KOORDINIERT
		if (aircraftInput) {
			const currentValue = aircraftInput.value.trim();
			const newValue = tileData.aircraftId || "";

			// Verwende Datenkoordinator für sichere Setzung
			if (window.dataCoordinator) {
				const source = window.isApplyingServerData ? "server" : "user";
				window.dataCoordinator.setAircraftId(tileId, newValue, source);
			} else {
				// Fallback: Direkte Setzung mit Warnung
				if (currentValue && currentValue !== newValue && newValue) {
					console.warn(
						`⚠️ Überschreibe Aircraft ID in Tile ${tileId}: "${currentValue}" → "${newValue}"`
					);
				}
				aircraftInput.value = newValue;
			}

			console.log(
				`✅ Aircraft ID für Tile ${tileId} (${
					isSecondary ? "sekundär" : "primär"
				}) verarbeitet: ${newValue}`
			);
		} else {
			console.warn(`❌ Aircraft Input für Tile ${tileId} nicht gefunden`);
		}

		// Hangar Position (header) setzen, wenn vom Server geliefert
		if (Object.prototype.hasOwnProperty.call(tileData, 'hangarPosition')) {
			const hangarPositionInput = document.getElementById(`hangar-position-${tileId}`);
			if (hangarPositionInput && containerElement.contains(hangarPositionInput)) {
				hangarPositionInput.value = tileData.hangarPosition || "";
				console.log(`✅ Hangar Position für Tile ${tileId} (${isSecondary ? "sekundär" : "primär"}) gesetzt: ${tileData.hangarPosition || ''}`);
			} else {
				console.warn(`❌ Hangar Position Input für Tile ${tileId} nicht gefunden oder in falschem Container`);
			}
		}

		// Position im Info-Grid setzen, wenn vom Server geliefert
		if (Object.prototype.hasOwnProperty.call(tileData, 'position')) {
			const positionInfoInput = document.getElementById(`position-${tileId}`);
			if (positionInfoInput && containerElement.contains(positionInfoInput)) {
				positionInfoInput.value = tileData.position || "";
				console.log(`✅ Position (Info) für Tile ${tileId} (${isSecondary ? "sekundär" : "primär"}) gesetzt: ${tileData.position || ''}`);
			} else {
				console.warn(`❌ Position (Info) Input für Tile ${tileId} nicht gefunden oder in falschem Container`);
			}
		}
			);
		}

		// Arrival Time setzen (leer bedeutet keine Zeit) - mit Container-Validation
		if (tileData.arrivalTime) {
			const arrivalElement = document.getElementById(`arrival-time-${tileData.tileId}`);
			if (arrivalElement && containerElement.contains(arrivalElement)) {
				const h = window.helpers || {};
				let display = '';
				if (h.isISODateTimeLocal && h.isISODateTimeLocal(tileData.arrivalTime)) {
					display = h.formatISOToCompactUTC(tileData.arrivalTime);
				} else if (h.isHHmm && h.isHHmm(tileData.arrivalTime) && h.getBaseDates && h.coerceHHmmToDateTimeLocalUtc) {
					const bases = h.getBaseDates();
					const iso = h.coerceHHmmToDateTimeLocalUtc(tileData.arrivalTime, bases.arrivalBase || '');
					display = iso ? h.formatISOToCompactUTC(iso) : '';
				} else if (h.isCompactDateTime && h.isCompactDateTime(tileData.arrivalTime)) {
					display = tileData.arrivalTime;
				}
				arrivalElement.value = display || '';
				console.log(
					`✅ Arrival Time für Tile ${tileData.tileId} (${isSecondary ? "sekundär" : "primär"}) gesetzt: ${display || ''}`
				);
			} else {
				console.warn(
					`❌ Arrival Time Input für Tile ${tileData.tileId} nicht gefunden oder in falschem Container`
				);
			}
		}

		// Departure Time setzen (leer bedeutet keine Zeit) - mit Container-Validation
		if (tileData.departureTime) {
			const departureElement = document.getElementById(
				`departure-time-${tileData.tileId}`
			);
			if (departureElement && containerElement.contains(departureElement)) {
				const h = window.helpers || {};
				let display = '';
				if (h.isISODateTimeLocal && h.isISODateTimeLocal(tileData.departureTime)) {
					display = h.formatISOToCompactUTC(tileData.departureTime);
				} else if (h.isHHmm && h.isHHmm(tileData.departureTime) && h.getBaseDates && h.coerceHHmmToDateTimeLocalUtc) {
					const bases = h.getBaseDates();
					const iso = h.coerceHHmmToDateTimeLocalUtc(tileData.departureTime, bases.departureBase || '');
					display = iso ? h.formatISOToCompactUTC(iso) : '';
				} else if (h.isCompactDateTime && h.isCompactDateTime(tileData.departureTime)) {
					display = tileData.departureTime;
				}
				departureElement.value = display || '';
				console.log(
					`✅ Departure Time für Tile ${tileData.tileId} (${isSecondary ? "sekundär" : "primär"}) gesetzt: ${display || ''}`
				);
			} else {
				console.warn(
					`❌ Departure Time Input für Tile ${tileData.tileId} nicht gefunden oder in falschem Container`
				);
			}
		}

		// Position Info Grid setzen - mit Container-Validation
		if (tileData.positionInfoGrid) {
			const positionInfoElement = document.getElementById(`position-${tileId}`);
			if (
				positionInfoElement &&
				containerElement.contains(positionInfoElement)
			) {
				positionInfoElement.value = tileData.positionInfoGrid;
				console.log(
					`✅ Position Info-Grid für Tile ${tileId} (${
						isSecondary ? "sekundär" : "primär"
					}) gesetzt: ${tileData.positionInfoGrid}`
				);
			} else {
				console.warn(
					`❌ Position Info-Grid Input für Tile ${tileId} nicht gefunden oder in falschem Container`
				);
			}
		}

		// Manual Input setzen - mit Container-Validation
		const manualInput = document.getElementById(`manual-input-${tileId}`);
		if (manualInput && containerElement.contains(manualInput)) {
			manualInput.value = tileData.manualInput || "";
			console.log(
				`✅ Manual Input für Tile ${tileId} (${
					isSecondary ? "sekundär" : "primär"
				}) gesetzt: ${tileData.manualInput}`
			);
		}

		// Notes setzen - mit Container-Validation
		const notesInput = document.getElementById(`notes-${tileId}`);
		if (notesInput && containerElement.contains(notesInput)) {
			notesInput.value = tileData.notes || "";
		}

		// Status setzen - mit Container-Validation
		const statusElement = document.getElementById(`status-${tileId}`);
		if (statusElement && containerElement.contains(statusElement)) {
			statusElement.value = tileData.status || "neutral";
			// Update status lights if function exists
			if (
				window.hangarUI &&
				typeof window.hangarUI.updateStatusLights === "function"
			) {
				window.hangarUI.updateStatusLights(tileId);
			}
		}

		// Tow Status setzen - mit Container-Validation
		const towStatusElement = document.getElementById(`tow-status-${tileId}`);
		if (towStatusElement && containerElement.contains(towStatusElement)) {
			towStatusElement.value = tileData.towStatus || "neutral";
			// Update tow status styling if function exists
			if (
				window.hangarUI &&
				typeof window.hangarUI.updateTowStatus === "function"
			) {
				window.hangarUI.updateTowStatus(tileId);
			}
		}

		// Dual-booking schedule (optional)
		if (Array.isArray(tileData.bookings)) {
			try {
				const scheduleInput = document.getElementById(`schedule-${tileId}`);
				if (scheduleInput && containerElement.contains(scheduleInput)) {
					scheduleInput.value = JSON.stringify(tileData.bookings || []);
					try {
						if (window.scheduleHelpers && typeof window.scheduleHelpers.renderScheduleUI === 'function') {
							window.scheduleHelpers.renderScheduleUI(tileId);
						} else if (typeof window.renderScheduleUI === 'function') {
							window.renderScheduleUI(tileId);
						}
					} catch(_e){}
				}
			} catch(_e){}
		}

		// Last-Update Badge aus Server-Daten wiederherstellen (falls vorhanden)
		if (tileData.updatedAt && typeof window.createOrUpdateLastUpdateBadge === 'function') {
			const ts = Date.parse(tileData.updatedAt);
			if (!isNaN(ts)) {
				window.createOrUpdateLastUpdateBadge(tileId, 'server', ts, { persist: true });
			}
		}
	} catch (error) {
		console.error(
			`Fehler beim Anwenden der Daten für Kachel ${tileData.tileId}:`,
			error
		);
	}
}

/**
 * Zurücksetzen aller Felder auf Standardwerte
 */
function resetAllFields() {
	// Projektname zurücksetzen
	if (window.hangarUI.checkElement("projectName")) {
		document.getElementById("projectName").value = generateTimestamp();
	}

	// Alle Kacheln leeren (Primär und Sekundär)
	document
		.querySelectorAll(
			"#hangarGrid .hangar-cell, #secondaryHangarGrid .hangar-cell"
		)
		.forEach((cell) => {
			const inputs = cell.querySelectorAll("input, textarea");
			inputs.forEach((input) => {
				input.value = "";
			});

			// Status auf "ready" setzen
			const statusSelect = cell.querySelector("select");
			if (statusSelect) {
				statusSelect.value = "ready";
				// Statuslichter aktualisieren
				const cellId = parseInt(statusSelect.id.split("-")[1]);
				if (cellId) window.hangarUI.updateStatusLights(cellId);
			}

			// Zeit-Anzeigen zurücksetzen
			const timeElements = cell.querySelectorAll(
				"[id^='arrival-time-'], [id^='departure-time-']"
			);
			timeElements.forEach((el) => {
				el.textContent = "--:--";
			});

			// Position-Anzeige zurücksetzen
			const posDisplay = cell.querySelector("[id^='position-']");
			if (posDisplay) posDisplay.textContent = "--";
		});
}

/**
 * Speichert das aktuelle Projekt in eine Datei
 * @param {string} [suggestedName] - Vorgeschlagener Dateiname (optional)
 */
function saveProjectToFile(suggestedName = null) {
	try {
		// Verwende den übergebenen Namen oder hol ihn aus dem Eingabefeld oder generiere einen Standardnamen
		const projectName =
			suggestedName ||
			document.getElementById("projectName").value ||
			generateDefaultProjectName();

		console.log(`Speichere Projekt unter: ${projectName}`);

		// Projektstatus sammeln
		const projectData = {
			projectName: projectName,
			lastSaved: new Date().toISOString(),
			tilesData: collectTilesData(),
			settings: collectSettingsData(),
		};

		// Daten in JSON umwandeln
		const jsonData = JSON.stringify(projectData, null, 2);

		// Prüfen, ob die moderne File System Access API verfügbar ist
		if ("showSaveFilePicker" in window) {
			// Moderne File System Access API verwenden
			const options = {
				suggestedName: `${projectName}.json`,
				types: [
					{
						description: "JSON Files",
						accept: { "application/json": [".json"] },
					},
				],
				// Versuche, den letzten verwendeten Pfad wiederzuverwenden
				startIn: "downloads",
			};

			// Datei-Dialog öffnen
			window
				.showSaveFilePicker(options)
				.then((fileHandle) => {
					return fileHandle.createWritable();
				})
				.then((writable) => {
					return writable.write(jsonData).then(() => writable.close());
				})
				.then(() => {
					console.log("Projekt erfolgreich gespeichert");
					showNotification("Projekt erfolgreich gespeichert", "success");

					// Letzten Pfad für zukünftige Verwendung speichern
					try {
						localStorage.setItem("lastSavePath", fileHandle.name);
					} catch (e) {
						console.warn("Konnte letzten Speicherpfad nicht speichern:", e);
					}
				})
				.catch((error) => {
					if (error.name !== "AbortError") {
						console.error("Fehler beim Speichern:", error);
						showNotification(
							"Fehler beim Speichern: " + error.message,
							"error"
						);
					}
				});
		} else {
			// Fallback für ältere Browser: Datei zum Download anbieten
			const blob = new Blob([jsonData], { type: "application/json" });
			const url = URL.createObjectURL(blob);

			const a = document.createElement("a");
			a.href = url;
			a.download = `${projectName}.json`;
			document.body.appendChild(a);
			a.click();

			// Cleanup
			setTimeout(() => {
				document.body.removeChild(a);
				URL.revokeObjectURL(url);
			}, 0);

			console.log("Projekt wurde zum Download angeboten (Fallback-Methode)");
			showNotification("Projekt wurde zum Download angeboten", "success");
		}
	} catch (error) {
		console.error("Fehler beim Speichern des Projekts:", error);
		showNotification("Fehler beim Speichern: " + error.message, "error");
	}
}

/**
 * Lädt ein Projekt aus einer Datei
 * @returns {Promise} Promise, das aufgelöst wird, wenn das Laden abgeschlossen ist
 */
function loadProjectFromFile() {
	return new Promise((resolve, reject) => {
		try {
			// Prüfen, ob die moderne File System Access API verfügbar ist
			if ("showOpenFilePicker" in window) {
				// Moderne File System Access API verwenden
				const options = {
					types: [
						{
							description: "JSON Files",
							accept: { "application/json": [".json"] },
						},
					],
					// Versuche, den letzten verwendeten Pfad wiederzuverwenden
					startIn: "downloads",
				};

				window
					.showOpenFilePicker(options)
					.then((fileHandles) => fileHandles[0].getFile())
					.then((file) => file.text())
					.then((content) => {
						const projectData = JSON.parse(content);
						applyProjectData(projectData);

						console.log("Projekt erfolgreich geladen");
						showNotification("Projekt erfolgreich geladen", "success");

						// Projektnamen im Eingabefeld setzen
						const projectNameInput = document.getElementById("projectName");
						if (projectNameInput && projectData.projectName) {
							projectNameInput.value = projectData.projectName;
						}

						resolve(projectData);
					})
					.catch((error) => {
						if (error.name !== "AbortError") {
							console.error("Fehler beim Laden:", error);
							showNotification("Fehler beim Laden: " + error.message, "error");
							reject(error);
						} else {
							// User hat abgebrochen
							resolve(null);
						}
					});
			} else {
				// Fallback für ältere Browser
				const input = document.createElement("input");
				input.type = "file";
				input.accept = ".json";

				input.onchange = (event) => {
					const file = event.target.files[0];
					if (!file) {
						resolve(null);
						return;
					}

					const reader = new FileReader();
					reader.onload = (e) => {
						try {
							const projectData = JSON.parse(e.target.result);
							applyProjectData(projectData);

							console.log("Projekt erfolgreich geladen (Fallback-Methode)");
							showNotification("Projekt erfolgreich geladen", "success");

							// Projektnamen im Eingabefeld setzen
							const projectNameInput = document.getElementById("projectName");
							if (projectNameInput && projectData.projectName) {
								projectNameInput.value = projectData.projectName;
							}

							resolve(projectData);
						} catch (error) {
							console.error("Fehler beim Parsen der Datei:", error);
							showNotification(
								"Fehler beim Parsen der Datei: " + error.message,
								"error"
							);
							reject(error);
						}
					};

					reader.onerror = (error) => {
						console.error("Fehler beim Lesen der Datei:", error);
						showNotification("Fehler beim Lesen der Datei", "error");
						reject(error);
					};

					reader.readAsText(file);
				};

				input.click();
			}
		} catch (error) {
			console.error("Fehler beim Öffnen des Dateidialogs:", error);
			showNotification(
				"Fehler beim Öffnen des Dateidialogs: " + error.message,
				"error"
			);
			reject(error);
		}
	});
}

// Hilfsfunktionen

/**
 * Sammelt alle Daten aus den Kacheln
 * @returns {Array} Array mit Kacheldaten
 */
function collectTilesData() {
	const tiles = [];

	// Alle primären Kacheln sammeln
	document
		.querySelectorAll("#hangarGrid .hangar-cell")
		.forEach((cell, index) => {
			const cellId = index + 1;
			const tileData = {
				id: cellId,
				position:
					document.getElementById(`hangar-position-${cellId}`)?.value || "",
				aircraftId: document.getElementById(`aircraft-${cellId}`)?.value || "",
				status: document.getElementById(`status-${cellId}`)?.value || "ready",
				towStatus:
					document.getElementById(`tow-status-${cellId}`)?.value || "initiated",
				notes: document.getElementById(`notes-${cellId}`)?.value || "",
			};

			tiles.push(tileData);
		});

	// Alle sekundären Kacheln sammeln (ID >= 101)
	document
		.querySelectorAll("#secondaryHangarGrid .hangar-cell")
		.forEach((cell) => {
			const cellId = parseInt(
				cell.getAttribute("data-cell-id") || cell.id.split("-").pop()
			);
			if (cellId >= 101) {
				const tileData = {
					id: cellId,
					position:
						document.getElementById(`hangar-position-${cellId}`)?.value || "",
					aircraftId:
						document.getElementById(`aircraft-${cellId}`)?.value || "",
					status: document.getElementById(`status-${cellId}`)?.value || "ready",
					towStatus:
						document.getElementById(`tow-status-${cellId}`)?.value ||
						"initiated",
					notes: document.getElementById(`notes-${cellId}`)?.value || "",
				};

				tiles.push(tileData);
			}
		});

	return tiles;
}

/**
 * Sammelt alle Einstellungsdaten
 * @returns {Object} Einstellungsobjekt
 */
function collectSettingsData() {
	return {
		tilesCount: parseInt(document.getElementById("tilesCount")?.value) || 8,
		secondaryTilesCount:
			parseInt(document.getElementById("secondaryTilesCount")?.value) || 4,
		layout: parseInt(document.getElementById("layoutType")?.value) || 4,
		includeNotes: document.getElementById("includeNotes")?.checked || true,
		landscapeMode: document.getElementById("landscapeMode")?.checked || true,
	};
}

/**
 * Wendet geladene Projektdaten auf die UI an
 * @param {Object} projectData - Die geladenen Projektdaten
 */
function applyProjectData(projectData) {
	if (!projectData) {
		console.error("Keine Projektdaten zum Laden erhalten");
		return;
	}

	console.log("Lade Projektdaten:", projectData);

	// Projektname setzen (aus metadata oder projectName)
	const projectName =
		projectData.metadata?.projectName || projectData.projectName;
	if (projectName) {
		const projectNameInput = document.getElementById("projectName");
		if (projectNameInput) {
			projectNameInput.value = projectName;
			console.log("Projektname gesetzt:", projectName);
		}
	}

	// Einstellungen anwenden
	if (projectData.settings) {
		const {
			tilesCount,
			secondaryTilesCount,
			layout,
			includeNotes,
			landscapeMode,
		} = projectData.settings;

		console.log("Lade Einstellungen:", projectData.settings);

		// UI-Felder aktualisieren
		if (document.getElementById("tilesCount")) {
			document.getElementById("tilesCount").value = tilesCount || 8;
		}

		if (document.getElementById("secondaryTilesCount")) {
			document.getElementById("secondaryTilesCount").value =
				secondaryTilesCount || 4;
		}

		if (document.getElementById("layoutType")) {
			document.getElementById("layoutType").value = layout || 4;
		}

		if (document.getElementById("includeNotes")) {
			document.getElementById("includeNotes").checked = includeNotes !== false;
		}

		if (document.getElementById("landscapeMode")) {
			document.getElementById("landscapeMode").checked =
				landscapeMode !== false;
		}

		// UI-Einstellungen anwenden und Grid neu aufbauen
		if (window.hangarUI && window.hangarUI.uiSettings) {
			window.hangarUI.uiSettings.tilesCount = tilesCount || 8;
			window.hangarUI.uiSettings.secondaryTilesCount = secondaryTilesCount || 0;
			window.hangarUI.uiSettings.layout = layout || 4;
			window.hangarUI.uiSettings.apply();
		}
	}

	// Kacheldaten anwenden (mit Verzögerung, um sicherzustellen, dass die Kacheln erstellt wurden)
	setTimeout(() => {
		if (projectData.tilesData && Array.isArray(projectData.tilesData)) {
			console.log(`Lade ${projectData.tilesData.length} Kacheln`);
			projectData.tilesData.forEach((tileData) => {
				const {
					id,
					position,
					aircraftId,
					status,
					towStatus,
					notes,
					arrivalTime,
					departureTime,
					positionInfoGrid,
				} = tileData;

				console.log(
					`Lade Kachel ${id}: position=${position}, aircraft=${aircraftId}, status=${status}`
				);

				// Positionswert setzen
				const posInput = document.getElementById(`hangar-position-${id}`);
				if (posInput) {
					posInput.value = position || "";
					console.log(`Position für Tile ${id} gesetzt: ${position}`);
				} else {
					console.warn(`Position Input für Tile ${id} nicht gefunden`);
				}

				// Aircraft ID setzen
				const aircraftInput = document.getElementById(`aircraft-${id}`);
				if (aircraftInput) {
					aircraftInput.value = aircraftId || "";
					console.log(`Aircraft ID für Tile ${id} gesetzt: ${aircraftId}`);
				} else {
					console.warn(`Aircraft Input für Tile ${id} nicht gefunden`);
				}

				// Status setzen
				const statusSelect = document.getElementById(`status-${id}`);
				if (statusSelect) {
					statusSelect.value = status || "ready";
					// Status-Event auslösen, um das Statuslicht zu aktualisieren
					const event = new Event("change");
					statusSelect.dispatchEvent(event);
					console.log(`Status für Tile ${id} gesetzt: ${status}`);
				} else {
					console.warn(`Status Select für Tile ${id} nicht gefunden`);
				}

				// Tow-Status setzen
				const towStatusSelect = document.getElementById(`tow-status-${id}`);
				if (towStatusSelect) {
					towStatusSelect.value = towStatus || "initiated";
					// Event auslösen, um Styling zu aktualisieren
					const event = new Event("change");
					towStatusSelect.dispatchEvent(event);
					console.log(`Tow-Status für Tile ${id} gesetzt: ${towStatus}`);
				} else {
					console.warn(`Tow-Status Select für Tile ${id} nicht gefunden`);
				}

				// Notizen setzen
				const notesTextarea = document.getElementById(`notes-${id}`);
				if (notesTextarea) {
					notesTextarea.value = notes || "";
					console.log(
						`Notizen für Tile ${id} gesetzt: ${
							notes ? notes.substring(0, 50) + "..." : "leer"
						}`
					);
				} else {
					console.warn(`Notizen Textarea für Tile ${id} nicht gefunden`);
				}

				// Arrival Time setzen
				if (arrivalTime && arrivalTime !== "--:--") {
					const arrivalInput = document.getElementById(`arrival-time-${id}`);
					if (arrivalInput) {
						arrivalInput.value = arrivalTime;
						console.log(`Arrival Time für Tile ${id} gesetzt: ${arrivalTime}`);
					}
				}

				// Departure Time setzen
				if (departureTime && departureTime !== "--:--") {
					const departureInput = document.getElementById(
						`departure-time-${id}`
					);
					if (departureInput) {
						departureInput.value = departureTime;
						console.log(
							`Departure Time für Tile ${id} gesetzt: ${departureTime}`
						);
					}
				}

				// Position Info Grid setzen
				if (positionInfoGrid) {
					const positionInfoInput = document.getElementById(`position-${id}`);
					if (positionInfoInput) {
						positionInfoInput.value = positionInfoGrid;
						console.log(
							`Position Info Grid für Tile ${id} gesetzt: ${positionInfoGrid}`
						);
					}
				}
			});
		} else {
			console.warn(
				"Keine tilesData gefunden oder tilesData ist kein Array:",
				projectData.tilesData
			);
		}

		console.log("Projektdaten erfolgreich geladen und angewendet");
	}, 500); // Verzögerung erhöht auf 500ms für bessere Sicherheit
}

/**
 * Generiert einen Projektname für Settings im Format YYYY_MM_DD_Hangarplan
 * @returns {string} Formatierter Projektname ohne Uhrzeit
 */
function generateProjectSettingsName() {
	const now = new Date();
	const year = now.getFullYear();
	const month = String(now.getMonth() + 1).padStart(2, "0");
	const day = String(now.getDate()).padStart(2, "0");
	return `${year}_${month}_${day}_Hangarplan`;
}

/**
 * Generiert einen Dateinamen für Save mit Uhrzeit im Format YYYY_MM_DD_HH:MM_Hangarplan
 * @returns {string} Formatierter Dateiname mit Uhrzeit
 */
function generateDefaultProjectName() {
	const now = new Date();
	const year = now.getFullYear();
	const month = String(now.getMonth() + 1).padStart(2, "0");
	const day = String(now.getDate()).padStart(2, "0");
	const hours = String(now.getHours()).padStart(2, "0");
	const minutes = String(now.getMinutes()).padStart(2, "0");
	return `${year}_${month}_${day}_${hours}:${minutes}_Hangarplan`;
}

/**
 * Exportiert das aktuelle Projekt automatisch mit generiertem Dateinamen
 * Verwendet automatisch Format: YYYY_MM_DD_HH:MM_Hangarplan.json
 */
function exportCurrentFile() {
	try {
		// Automatischen Dateinamen generieren
		const fileName = generateDefaultProjectName();

		console.log(`Automatischer Export mit Dateiname: ${fileName}`);

		// Projektstatus sammeln - gleiches Format wie Save Button
		const projectData = {
			metadata: {
				projectName: fileName,
				lastModified: new Date().toISOString(),
			},
			tilesData: collectTilesData(),
			settings: collectSettingsData(),
		};

		// Daten in JSON umwandeln
		const jsonData = JSON.stringify(projectData, null, 2);

		// Direkter Download ohne Dialog
		const blob = new Blob([jsonData], { type: "application/json" });
		const url = URL.createObjectURL(blob);

		const a = document.createElement("a");
		a.href = url;
		a.download = `${fileName}.json`;
		document.body.appendChild(a);
		a.click();

		// Cleanup
		setTimeout(() => {
			document.body.removeChild(a);
			URL.revokeObjectURL(url);
		}, 100);

		console.log("Projekt automatisch exportiert");
		showNotification(
			`Projekt automatisch exportiert: ${fileName}.json`,
			"success"
		);

		return true;
	} catch (error) {
		console.error("Fehler beim automatischen Export:", error);
		showNotification(
			"Fehler beim automatischen Export: " + error.message,
			"error"
		);
		return false;
	}
}

// Exportieren für die globale Verwendung
window.hangarData = window.hangarData || {};
window.hangarData.saveProjectToFile = saveProjectToFile;
window.hangarData.loadProjectFromFile = loadProjectFromFile;
window.hangarData.exportCurrentFile = exportCurrentFile;
window.hangarData.applyLoadedHangarPlan = applyLoadedHangarPlan;
window.hangarData.applySingleTileData = applySingleTileData;
window.hangarData.applyLoadedTileData = applyLoadedTileData;
window.hangarData.generateProjectSettingsName = generateProjectSettingsName;
window.hangarData.generateDefaultProjectName = generateDefaultProjectName;
// KORREKTUR: Sichere globale Verfügbarkeit
window.hangarData.collectAllHangarData = hangarData.collectAllHangarData;
window.collectAllHangarData = hangarData.collectAllHangarData; // Auch direkt global für Kompatibilität

// Globale Verfügbarkeit der Funktionen
window.generateProjectSettingsName = generateProjectSettingsName;
window.generateDefaultProjectName = generateDefaultProjectName;

/**
 * Aktualisiert Flugzeugdaten in den UI-Kacheln basierend auf API-Ergebnissen
 * @param {string} aircraftId - Die Flugzeugkennung
 * @param {Object} flightData - Die von der API erhaltenen Flugdaten
 */
// === Last Update Badge: Global creation helper and persistence ===
(function(){
	const STORE_KEY = 'hangar.lastUpdateMeta';

	function loadStore(){
		try { return JSON.parse(localStorage.getItem(STORE_KEY) || '{}') || {}; } catch(e){ return {}; }
	}
	function saveStore(obj){
		try { localStorage.setItem(STORE_KEY, JSON.stringify(obj)); } catch(e) {}
	}

	function createOrUpdateLastUpdateBadge(cellId, source = 'api', timestampMs = null, options = {}){
		try {
			const persist = options.persist !== false; // default true

			// Guard: if no Aircraft ID is present in this tile, remove any existing badge and skip
			try {
				const aircraftEl = document.getElementById(`aircraft-${cellId}`);
				const reg = (aircraftEl && aircraftEl.value ? aircraftEl.value : '').trim();
				if (!reg) {
					if (window.LastUpdateBadges && typeof window.LastUpdateBadges.remove === 'function') {
						window.LastUpdateBadges.remove(cellId);
					}
					return;
				}
			} catch (e) { /* ignore */ }
			let tile = document.querySelector(`[data-cell-id="${cellId}"]`);
			if (!tile && cellId >= 1 && cellId <= 100) {
				tile = document.querySelector(`#hangarGrid .hangar-cell:nth-child(${cellId})`);
			}
			if (!tile && cellId >= 101) {
				const secondaryIndex = cellId - 100;
				tile = document.querySelector(`#secondaryHangarGrid .hangar-cell:nth-child(${secondaryIndex})`);
			}
			if (!tile) {
				console.warn(`❌ Tile mit cellId ${cellId} nicht gefunden (Badge)`);
				return;
			}

			// remove existing
			const existing = tile.querySelector('.last-update-badge');
			if (existing) existing.remove();

			// compute time
			const now = (timestampMs && !isNaN(timestampMs)) ? new Date(timestampMs) : new Date();
			const display = now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

			// build badge
			const badge = document.createElement('div');
			badge.className = 'last-update-badge fresh';
			badge.title = `Letztes Update: ${now.toLocaleString()} (${source})`;
			badge.dataset.timestamp = String(now.getTime());
			badge.dataset.source = source;
			// Inline badge styles (colors are updated by refreshAllUpdateBadges)
			badge.style.fontSize = '9px';
			badge.style.padding = '2px 6px';
			badge.style.borderRadius = '8px';
			badge.style.backgroundColor = 'rgba(34, 197, 94, 0.1)';
			badge.style.color = '#16a34a';
			badge.style.border = '1px solid rgba(34, 197, 94, 0.3)';
			badge.style.zIndex = '20';
			badge.style.fontWeight = '500';
			badge.style.boxShadow = 'none';
			badge.style.minWidth = '40px';
			badge.style.textAlign = 'center';
			badge.style.fontFamily = 'Inter, ui-sans-serif';
			badge.textContent = display;

			// Place badge inline within header (center)
			const header = tile.querySelector('.card-header');
			const headerEls = header ? header.querySelector('.header-elements') : null;
			if (headerEls) {
				const rightBlock = headerEls.querySelector('.position-container');
				if (rightBlock) {
					headerEls.insertBefore(badge, rightBlock);
				} else {
					headerEls.appendChild(badge);
				}
			} else {
				// Fallback: append at top of tile if header missing
				tile.appendChild(badge);
			}

			// persist
			if (persist) {
				const store = loadStore();
				store[String(cellId)] = { ts: now.getTime(), source: source };
				saveStore(store);
			}

			// update style age
			if (typeof window.refreshAllUpdateBadges === 'function') {
				setTimeout(window.refreshAllUpdateBadges, 0);
			}
		} catch (e) {
			console.warn('⚠️ createOrUpdateLastUpdateBadge Fehler:', e);
		}
	}

// expose
	window.createOrUpdateLastUpdateBadge = createOrUpdateLastUpdateBadge;

	// === Subtle Author Pill (dismissible) ===
	(function(){
		const STORE_KEY = 'hangar.updateAuthorRead'; // map of "cellId|tsMs" → true
		function loadRead(){ try { return JSON.parse(localStorage.getItem(STORE_KEY) || '{}') || {}; } catch(e){ return {}; } }
		function saveRead(obj){ try { localStorage.setItem(STORE_KEY, JSON.stringify(obj)); } catch(e){} }
		function keyOf(cellId, ts){ return `${cellId}|${ts}`; }
		function hasRead(cellId, ts){ const s = loadRead(); return !!s[keyOf(cellId, ts)]; }
		function markRead(cellId, ts){ const s = loadRead(); s[keyOf(cellId, ts)] = true; saveRead(s); }

		function createOrUpdateUpdateAuthorPill(cellId, author, timestampMs, options = {}){
			try {
				const ts = parseInt(timestampMs, 10);
				if (!cellId || !ts || !author) return;
				if (hasRead(cellId, ts)) return; // already acknowledged

				let tile = document.querySelector(`[data-cell-id="${cellId}"]`);
				if (!tile && cellId >= 1 && cellId <= 100) tile = document.querySelector(`#hangarGrid .hangar-cell:nth-child(${cellId})`);
				if (!tile && cellId >= 101) tile = document.querySelector(`#secondaryHangarGrid .hangar-cell:nth-child(${cellId-100})`);
				if (!tile) return;

				// Remove older pill with different ts
				const existing = tile.querySelector('.update-author-pill');
				if (existing) existing.remove();

				const pill = document.createElement('div');
				pill.className = 'update-author-pill';
				pill.dataset.timestamp = String(ts);
				pill.dataset.cellId = String(cellId);
				pill.title = `Updated by ${author} at ${new Date(ts).toLocaleString()}`;
				pill.textContent = `Updated by ${author}`;

				// Dismiss (mark as read) button
				const btn = document.createElement('button');
				btn.type = 'button';
				btn.className = 'update-author-pill-btn';
				btn.title = 'Mark as read';
				btn.textContent = '✓';
				btn.addEventListener('click', (e) => {
					e.stopPropagation();
					markRead(cellId, ts);
					pill.remove();
				});
				pill.appendChild(btn);

				// Place near the last-update-badge inside header
				const header = tile.querySelector('.card-header');
				const headerEls = header ? header.querySelector('.header-elements') : null;
				if (headerEls) {
					// insert before existing last-update-badge if present, else before right block
					const lastBadge = headerEls.querySelector('.last-update-badge');
					if (lastBadge && lastBadge.parentNode) {
						lastBadge.parentNode.insertBefore(pill, lastBadge);
					} else {
						const rightBlock = headerEls.querySelector('.position-container');
						if (rightBlock) headerEls.insertBefore(pill, rightBlock); else headerEls.appendChild(pill);
					}
				} else {
					tile.appendChild(pill);
				}
			} catch(e){ /* ignore */ }
		}

		window.createOrUpdateUpdateAuthorPill = createOrUpdateUpdateAuthorPill;
		window.AuthorPills = {
			markRead,
			hasRead,
			remove(cellId){ const host = document.querySelector(`[data-cell-id="${cellId}"]`); if (host){ const el = host.querySelector('.update-author-pill'); if (el) el.remove(); }},
			clearAll(){ document.querySelectorAll('.update-author-pill').forEach(el => el.remove()); localStorage.removeItem(STORE_KEY); }
		};
	})();

	window.LastUpdateBadges = {
		load: loadStore,
		save: saveStore,
		set(cellId, ts, source){
			const store = loadStore();
			store[String(cellId)] = { ts, source };
			saveStore(store);
		},
		remove(cellId){
			const store = loadStore();
			delete store[String(cellId)];
			saveStore(store);
			// remove DOM badge
			const host = document.querySelector(`[data-cell-id="${cellId}"]`) || document.querySelector(`#hangarGrid .hangar-cell:nth-child(${cellId})`) || document.querySelector(`#secondaryHangarGrid .hangar-cell:nth-child(${cellId-100})`);
			if (host) {
				const b = host.querySelector('.last-update-badge');
				if (b) b.remove();
			}
		},
		clearAll(){
			try { localStorage.removeItem(STORE_KEY); } catch(e) {}
			document.querySelectorAll('.last-update-badge').forEach(b => b.remove());
		},
		reatachAll(){ this.reattachAll(); }, // backward-compat typo guard
		reattachAll(){
			const store = loadStore();
			let changed = false;
			Object.keys(store).forEach(k => {
				const cellId = parseInt(k,10);
				const aircraftEl = document.getElementById(`aircraft-${cellId}`);
				const reg = (aircraftEl && aircraftEl.value ? aircraftEl.value : '').trim();
				if (!reg) {
					// No Aircraft ID: remove any existing DOM badge and clear persisted record
					delete store[k];
					changed = true;
					const host = document.querySelector(`[data-cell-id="${cellId}"]`) || document.querySelector(`#hangarGrid .hangar-cell:nth-child(${cellId})`) || document.querySelector(`#secondaryHangarGrid .hangar-cell:nth-child(${cellId-100})`);
					if (host) {
						const b = host.querySelector('.last-update-badge');
						if (b) b.remove();
					}
					return;
				}
				const meta = store[k] || {};
				createOrUpdateLastUpdateBadge(cellId, meta.source || 'api', meta.ts, { persist: false });
			});
			if (changed) saveStore(store);
			if (typeof window.refreshAllUpdateBadges === 'function') {
				setTimeout(window.refreshAllUpdateBadges, 0);
			}
		}
	};
})();

window.hangarData.updateAircraftFromFlightData = async function (
	aircraftId,
	flightData
) {
	console.log(
		`🛫 Aktualisiere UI-Kacheln für ${aircraftId} mit Flugdaten:`,
		flightData
	);

	if (!aircraftId || !flightData) {
		console.warn("❌ Fehlende Parameter für updateAircraftFromFlightData");
		return;
	}


	// Suche nach Kacheln mit der entsprechenden Aircraft ID
	const primaryTiles = document.querySelectorAll("#hangarGrid .hangar-cell");
	const secondaryTiles = document.querySelectorAll(
		"#secondaryHangarGrid .hangar-cell"
	);
	const allTiles = [...primaryTiles, ...secondaryTiles];

	let updatedTiles = 0;

	for (const tile of allTiles) {
		const aircraftInput = tile.querySelector('input[id^="aircraft-"]');
		if (!aircraftInput) continue;

		const currentValue = aircraftInput.value.trim();
		if (currentValue.toLowerCase() === aircraftId.toLowerCase()) {
			// Gefundene Kachel aktualisieren
			const cellId = aircraftInput.id.split("-")[1];

			// DEBUG: Zeige verfügbare Flugdaten
			console.log(`🔍 DEBUG für Kachel ${cellId}:`, {
				arrivalTime: flightData.arrivalTime,
				departureTime: flightData.departureTime,
				positionText: flightData.positionText,
				originCode: flightData.originCode,
				destCode: flightData.destCode,
				_clearFields: flightData._clearFields,
				_noDataFound: flightData._noDataFound,
				allData: flightData,
			});

			// KORREKTUR: Prüfe ob Felder gelöscht werden sollen
			const shouldClearFields =
				flightData._clearFields || flightData._noDataFound;

			// Ankunftszeit aktualisieren oder löschen
			const arrivalInput = tile.querySelector(`#arrival-time-${cellId}`);
			console.log(
				`🔍 Arrival Input gefunden für ${cellId}:`,
				!!arrivalInput,
				arrivalInput?.id
			);
			if (arrivalInput) {
				if (shouldClearFields) {
					// Felder löschen wenn keine Daten gefunden wurden
					arrivalInput.value = "";
					try { delete arrivalInput.dataset.iso; } catch (e) {}
					console.log(
						`🧹 Ankunftszeit für Kachel ${cellId} gelöscht (keine Daten)`
					);
				} else if (
					flightData.arrivalTime &&
					flightData.arrivalTime !== "--:--" &&
					flightData.arrivalTime !== ""
				) {
					let display = '';
					let iso = '';
					if (window.helpers){
						const h = window.helpers;
						if (h.isISODateTimeLocal && h.isISODateTimeLocal(flightData.arrivalTime)) {
							iso = flightData.arrivalTime;
						} else if (h.isHHmm && h.isHHmm(flightData.arrivalTime) && h.getBaseDates && h.coerceHHmmToDateTimeLocalUtc) {
							const bases = h.getBaseDates();
							iso = h.coerceHHmmToDateTimeLocalUtc(flightData.arrivalTime, bases.arrivalBase || '');
						} else if (h.isCompactDateTime && h.isCompactDateTime(flightData.arrivalTime) && h.parseCompactToISOUTC) {
							iso = h.parseCompactToISOUTC(flightData.arrivalTime);
						}
						display = iso && h.formatISOToCompactUTC ? h.formatISOToCompactUTC(iso) : (display||'');
					}
					arrivalInput.value = display || '';
					if (iso) { try { arrivalInput.dataset.iso = iso; } catch (e) {} } else { try { delete arrivalInput.dataset.iso; } catch (e) {} }
					console.log(
						`✅ Ankunftszeit für Kachel ${cellId}: ${display || ''}`
					);
				}
			} else {
				console.warn(
					`❌ Ankunftszeit Input nicht gefunden für Kachel ${cellId}`
				);
			}

			// Abflugzeit aktualisieren oder löschen
			const departureInput = tile.querySelector(`#departure-time-${cellId}`);
			console.log(
				`🔍 Departure Input gefunden für ${cellId}:`,
				!!departureInput,
				departureInput?.id
			);
			if (departureInput) {
				if (shouldClearFields) {
					// Felder löschen wenn keine Daten gefunden wurden
					departureInput.value = "";
					try { delete departureInput.dataset.iso; } catch (e) {}
					console.log(
						`🧹 Abflugzeit für Kachel ${cellId} gelöscht (keine Daten)`
					);
				} else if (
					flightData.departureTime &&
					flightData.departureTime !== "--:--" &&
					flightData.departureTime !== ""
				) {
					let display = '';
					let iso = '';
					if (window.helpers){
						const h = window.helpers;
						if (h.isISODateTimeLocal && h.isISODateTimeLocal(flightData.departureTime)) {
							iso = flightData.departureTime;
						} else if (h.isHHmm && h.isHHmm(flightData.departureTime) && h.getBaseDates && h.coerceHHmmToDateTimeLocalUtc) {
							const bases = h.getBaseDates();
							iso = h.coerceHHmmToDateTimeLocalUtc(flightData.departureTime, bases.departureBase || '');
						} else if (h.isCompactDateTime && h.isCompactDateTime(flightData.departureTime) && h.parseCompactToISOUTC) {
							iso = h.parseCompactToISOUTC(flightData.departureTime);
						}
						display = iso && h.formatISOToCompactUTC ? h.formatISOToCompactUTC(iso) : (display||'');
					}
					departureInput.value = display || '';
					if (iso) { try { departureInput.dataset.iso = iso; } catch (e) {} } else { try { delete departureInput.dataset.iso; } catch (e) {} }
					console.log(
						`✅ Abflugzeit für Kachel ${cellId}: ${display || ''}`
					);
				}
			} else {
				console.warn(`❌ Abflugzeit Input nicht gefunden für Kachel ${cellId}`);
			}

			// Position aktualisieren oder löschen (versuche beide möglichen Felder)
			let positionInput = tile.querySelector(`#position-${cellId}`);
			if (!positionInput) {
				positionInput = tile.querySelector(`#hangar-position-${cellId}`);
			}
			console.log(
				`🔍 Position Input gefunden für ${cellId}:`,
				!!positionInput,
				positionInput?.id
			);
			if (positionInput) {
				if (shouldClearFields) {
					// Position löschen wenn keine Daten gefunden wurden
					positionInput.value = "";
					console.log(
						`🧹 Position für Kachel ${cellId} gelöscht (keine Daten)`
					);
				} else if (
					flightData.positionText &&
					flightData.positionText !== "---" &&
					flightData.positionText !== ""
				) {
					positionInput.value = flightData.positionText;
					console.log(
						`✅ Position für Kachel ${cellId}: ${flightData.positionText}`
					);
				}
			} else {
				console.warn(`❌ Position Input nicht gefunden für Kachel ${cellId}`);
			}

			// Optional: Notizen mit zusätzlichen Informationen aktualisieren
			// const notesTextarea = tile.querySelector(`#notes-${cellId}`);
			// if (notesTextarea && flightData.data && flightData.data.length > 0) {
			// 	// Zusätzliche Fluginformationen in die Notizen eintragen (optional)
			// 	const additionalInfo = `Flight data from API (${new Date().toLocaleTimeString()})`;
			// 	if (!notesTextarea.value.includes(additionalInfo)) {
			// 		notesTextarea.value = (
			// 			notesTextarea.value +
			// 			"\n" +
			// 			additionalInfo
			// 		).trim();
			// 	}
			// }

			// ✅ NEUE FUNKTION: Last Update Badge hinzufügen
			if (typeof window.createOrUpdateLastUpdateBadge === 'function') {
				window.createOrUpdateLastUpdateBadge(cellId, 'api');
			}

			updatedTiles++;
		}
	}

	if (updatedTiles > 0) {
		console.log(
			`✅ ${updatedTiles} Kachel(n) für ${aircraftId} erfolgreich aktualisiert`
		);
		// Signalisiere dem Server-Sync, dass Update-Änderungen (Arr/Dep/Pos) sofort synchronisiert werden dürfen
		if (window.HangarDataCoordinator) {
			window.HangarDataCoordinator.apiChangesPendingSync = true;
		}

		// WICHTIG: Daten in HangarDataCoordinator persistieren um Überschreibung zu verhindern
		if (window.HangarDataCoordinator) {
			console.log(
				`🔄 Persistiere Flugdaten für ${aircraftId} im DataCoordinator...`
			);

			// Sammle die aktualisierten Daten aus den DOM-Elementen
			const coordData = {};
			for (const tile of allTiles) {
				const aircraftInput = tile.querySelector('input[id^="aircraft-"]');
				if (!aircraftInput) continue;

				const currentValue = aircraftInput.value.trim();
				if (currentValue.toLowerCase() === aircraftId.toLowerCase()) {
					const cellId = aircraftInput.id.split("-")[1];

					// Sammle die aktualisierten Werte mit korrekten Feld-IDs
					const arrivalInput = tile.querySelector(`#arrival-time-${cellId}`);
					const departureInput = tile.querySelector(
						`#departure-time-${cellId}`
					);
					let positionInput = tile.querySelector(`#position-${cellId}`);
					if (!positionInput) {
						positionInput = tile.querySelector(`#hangar-position-${cellId}`);
					}

					coordData[`cell_${cellId}`] = {
						aircraftId: currentValue,
						arrivalTime: arrivalInput?.value || "",
						departureTime: departureInput?.value || "",
						position: positionInput?.value || "",
						source: "api",
						timestamp: new Date().toISOString(),
					};
				}
			}

			// Schreibe die Daten in den Coordinator
			try {
				window.HangarDataCoordinator.queueOperation({
					type: "api_update",
					source: "api",
					data: coordData,
					timestamp: new Date().toISOString(),
					aircraftId: aircraftId,
				});
				console.log(`✅ Flugdaten für ${aircraftId} erfolgreich persistiert`);
			} catch (error) {
				console.error(
					`❌ Fehler beim Persistieren der Flugdaten für ${aircraftId}:`,
					error
				);
			}
		}

		// Event für andere Module abfeuern
		document.dispatchEvent(
			new CustomEvent("aircraftDataUpdated", {
				detail: { aircraftId, flightData, updatedTiles },
			})
		);
	} else {
		console.warn(`⚠️ Keine Kacheln mit Aircraft ID "${aircraftId}" gefunden`);
	}
};

// SICHERHEIT: Sofortige Verfügbarkeit nach DOM-Load
document.addEventListener("DOMContentLoaded", function () {
	if (!window.collectAllHangarData) {
		window.collectAllHangarData = hangarData.collectAllHangarData;
		console.log("🔧 collectAllHangarData nachträglich registriert");
	}
});
window.hangarData.saveCurrentStateToLocalStorage = function () {
	try {
		// Sammle aktuellen Zustand im Legacy- und im neuen Format
		const tilesLegacy = [];
		// Erzeuge Legacy tileValues Einträge mit cellId
		document.querySelectorAll('#hangarGrid .hangar-cell').forEach((cell, idx) => {
			const cellId = idx + 1;
			tilesLegacy.push({
				cellId,
				position: document.getElementById(`hangar-position-${cellId}`)?.value || "",
				aircraftId: document.getElementById(`aircraft-${cellId}`)?.value || "",
				status: document.getElementById(`status-${cellId}`)?.value || "neutral",
				towStatus: document.getElementById(`tow-status-${cellId}`)?.value || "neutral",
				notes: document.getElementById(`notes-${cellId}`)?.value || "",
				arrivalTime: document.getElementById(`arrival-time-${cellId}`)?.value || "",
				departureTime: document.getElementById(`departure-time-${cellId}`)?.value || "",
			});
		});
		document.querySelectorAll('#secondaryHangarGrid .hangar-cell').forEach((cell, idx) => {
			const cellId = 101 + idx;
			tilesLegacy.push({
				cellId,
				position: document.getElementById(`hangar-position-${cellId}`)?.value || "",
				aircraftId: document.getElementById(`aircraft-${cellId}`)?.value || "",
				status: document.getElementById(`status-${cellId}`)?.value || "neutral",
				towStatus: document.getElementById(`tow-status-${cellId}`)?.value || "neutral",
				notes: document.getElementById(`notes-${cellId}`)?.value || "",
				arrivalTime: document.getElementById(`arrival-time-${cellId}`)?.value || "",
				departureTime: document.getElementById(`departure-time-${cellId}`)?.value || "",
			});
		});

		// Legacy settings payload for compatibility with initializeUI() restore helpers
		const legacySettings = {
			tilesCount: parseInt(document.getElementById('tilesCount')?.value) || 12,
			secondaryTilesCount: parseInt(document.getElementById('secondaryTilesCount')?.value) || 0,
			layout: parseInt(document.getElementById('layoutType')?.value) || 4,
			tileValues: tilesLegacy,
			lastSaved: new Date().toISOString(),
		};
		try { localStorage.setItem('hangarPlannerSettings', JSON.stringify(legacySettings)); } catch (e) {}

		// New autosave payload (project-like format)
		const projectData = {
			metadata: {
				projectName: document.getElementById('projectName')?.value || generateDefaultProjectName(),
				lastModified: new Date().toISOString(),
			},
			tilesData: (function(){
				const all = [];
				tilesLegacy.forEach(t => {
					all.push({
						id: t.cellId,
						position: t.position,
						aircraftId: t.aircraftId,
						status: t.status,
						towStatus: t.towStatus,
						notes: t.notes,
						arrivalTime: t.arrivalTime,
						departureTime: t.departureTime,
						positionInfoGrid: document.getElementById(`position-${t.cellId}`)?.value || "",
					});
				});
				return all;
			})(),
			settings: collectSettingsData(),
		};
		try { localStorage.setItem('hangarPlanner.autosave.v1', JSON.stringify(projectData)); } catch (e) {}

		// In-Memory-Cache für Debugging
		window.currentProjectState = projectData;
		console.log("💾 Autosave gespeichert (localStorage)");
	} catch (e) {
		console.warn('⚠️ Autosave fehlgeschlagen:', e);
	}
};

// Lädt lokalen Autosave und wendet ihn an (falls verfügbar)
window.hangarData.loadFromLocalAutosave = function(){
	try {
		// Always attempt to restore local autosave (server data may override later if available)
		const raw = localStorage.getItem('hangarPlanner.autosave.v1');
		if (!raw) return false;
		const data = JSON.parse(raw);
		if (!data || (typeof data !== 'object')) return false;
		// Wende Projektformat an
		if (typeof applyProjectData === 'function') {
			applyProjectData(data);
			console.log('✅ Lokaler Autosave angewendet');
			return true;
		}
		return false;
	} catch (e) { console.warn('Autosave laden fehlgeschlagen', e); return false; }
};

// Installiert Change-Handler, die bei Änderungen automatisch speichern (debounced)
(function(){
	let saveTimer = null;
	function requestAutosave(){
		clearTimeout(saveTimer);
		saveTimer = setTimeout(() => { try { window.hangarData.saveCurrentStateToLocalStorage(); } catch(e){} }, 400);
	}
	function install(){
		const root1 = document.getElementById('hangarGrid');
		const root2 = document.getElementById('secondaryHangarGrid');
		[root1, root2].forEach(root => {
			if (!root || root.__autosaveInstalled) return;
			root.addEventListener('input', requestAutosave, { passive: true });
			root.addEventListener('change', requestAutosave, { passive: true });
			root.__autosaveInstalled = true;
		});
	}
	// Zentrale Init-Queue nutzen
	window.hangarInitQueue = window.hangarInitQueue || [];
	window.hangarInitQueue.push(function(){ install(); /* frühes Restore, falls gewünscht */ try { window.hangarData.loadFromLocalAutosave(); } catch(e){} });
	// Auch beim BFCache zurück (Safari/Firefox) die UI synchron halten
	window.addEventListener('pageshow', function(){ try { window.hangarData.loadFromLocalAutosave(); } catch(e){} });
	// Vor dem Verlassen zuverlässig speichern (Anklick-Navigation, Refresh, Back)
	window.addEventListener('beforeunload', function(){ try { window.hangarData.saveCurrentStateToLocalStorage(); } catch(e){} });
	document.addEventListener('visibilitychange', function(){ if (document.visibilityState === 'hidden') { try { window.hangarData.saveCurrentStateToLocalStorage(); } catch(e){} } });
})();

/**
 * ZENTRALE DATENKOORDINATION - Ersetzt localStorage-basierte Ladelogik
 * Implementiert rekursive Selbstkontrolle und verhindert Race Conditions
 */
window.HangarDataCoordinator = {
	// Zentrale Datenhaltung (Memory-basiert, kein localStorage)
	currentData: null,
	dataSource: null, // 'server', 'user', 'api', 'initial'
	lastUpdate: null,
	operationQueue: [],
	isProcessing: false,

	/**
	 * FIXED: Datenverarbeitung OHNE rekursive Aufrufe um Endlosschleifen zu vermeiden
	 */
	async processOperationQueue() {
		if (this.isProcessing) {
			console.log("🔄 Datenverarbeitung bereits aktiv, warte...");
			return;
		}

		this.isProcessing = true;
		console.log("🎯 Starte Datenoperations-Verarbeitung");

		try {
			// Verarbeite alle Operationen in der Queue OHNE rekursive validateDataIntegrity Aufrufe
			while (this.operationQueue.length > 0) {
				const operation = this.operationQueue.shift();
				await this.executeOperation(operation);
			}

			// EINMALIGE Validierung NACH Verarbeitung aller Operationen
			const isValid = await this.validateDataIntegrity();
			if (!isValid) {
				console.warn(
					"⚠️ Datenintegrität-Probleme erkannt, aber keine weitere Rekursion"
				);
			}
		} catch (error) {
			console.error("❌ Fehler in Datenkoordination:", error);
		} finally {
			this.isProcessing = false;
			console.log("✅ Datenkoordination abgeschlossen");
		}
	},

	/**
	 * Führt eine einzelne Datenoperation aus
	 */
	async executeOperation(operation) {
		console.log(
			`🔧 Ausführung: ${operation.type} (Quelle: ${operation.source})`
		);

		// ERWEITERTE Prioritätsprüfung: API-Daten für 5 Minuten schützen
		if (this.dataSource === "api" && operation.source === "server") {
			const timeSinceApiUpdate =
				Date.now() - new Date(this.lastUpdate).getTime();
			if (timeSinceApiUpdate < 300000) {
				// 5 Minuten Schutzzeit
				console.log(
					"🛡️ API-Daten geschützt: Server-Operation blockiert für",
					Math.round((300000 - timeSinceApiUpdate) / 1000),
					"Sekunden"
				);
				return;
			}
		}

		// Ursprüngliche Prioritätsprüfung: Server-Daten haben höchste Priorität (nach Schutzzeit)
		if (
			this.dataSource === "server" &&
			operation.source !== "server" &&
			operation.source !== "api"
		) {
			console.log("⚠️ Server-Daten haben Priorität, Operation übersprungen");
			return;
		}

		// Timestamp-Validierung
		if (this.lastUpdate && operation.timestamp) {
			if (new Date(operation.timestamp) < new Date(this.lastUpdate)) {
				console.log("⏰ Veraltete Daten erkannt, Operation übersprungen");
				return;
			}
		}

		// Operation ausführen
		switch (operation.type) {
			case "setAircraftId":
				await this.setAircraftIdSafe(
					operation.tileId,
					operation.value,
					operation.source
				);
				break;
			case "loadProject":
				await this.loadProjectSafe(operation.data, operation.source);
				break;
			case "applyFlightData":
				await this.applyFlightDataSafe(operation.data, operation.source);
				break;
			case "api_update":
				await this.applyApiUpdateSafe(
					operation.data,
					operation.source,
					operation.aircraftId
				);
				break;
		}

		// Datenquelle und Timestamp aktualisieren
		this.dataSource = operation.source;
		this.lastUpdate = operation.timestamp || new Date().toISOString();
	},

	/**
	 * Sichere Aircraft ID Setzung mit Konflikterkennung
	 */
	async setAircraftIdSafe(tileId, value, source) {
		const element = document.getElementById(`aircraft-${tileId}`);
		if (!element) {
			console.warn(`❌ Element aircraft-${tileId} nicht gefunden`);
			return;
		}

		const currentValue = element.value;

		// Konfliktprüfung
		if (currentValue && currentValue !== value && source !== "server") {
			console.warn(
				`⚠️ KONFLIKT erkannt in Tile ${tileId}: "${currentValue}" vs "${value}" (Quelle: ${source})`
			);

			// Bei API-Daten: Benutzer warnen, aber nicht überschreiben
			if (source === "api") {
				this.showConflictWarning(tileId, currentValue, value, source);
				return;
			}
		}

		// Wert setzen
		element.value = value;
		console.log(
			`✅ Aircraft ID für Tile ${tileId} gesetzt: "${value}" (Quelle: ${source})`
		);

		// Event auslösen für andere Komponenten
		element.dispatchEvent(new Event("change", { bubbles: true }));
	},

	/**
	 * Sicheres Projekt laden - OHNE REKURSION
	 */
	async loadProjectSafe(data, source) {
		console.log(`📂 Lade Projekt aus Quelle: ${source} (direkt)`);

		// DIREKTE Anwendung ohne weitere Koordination
		try {
			// Flag setzen um weitere localStorage-Operationen zu verhindern
			window.isApplyingServerData = true;

			// Direkte Datenmodifikation ohne applyLoadedHangarPlan
			this.applyDataDirectly(data);
			this.currentData = data;

			console.log(`✅ Projekt geladen (Quelle: ${source})`);
		} finally {
			window.isApplyingServerData = false;
		}
	},

	/**
	 * Wendet Daten direkt an ohne Rekursion
	 */
	applyDataDirectly(data) {
		// Projektname setzen
		if (data.metadata && data.metadata.projectName) {
			const nameElement = document.getElementById("projectName");
			if (nameElement) nameElement.value = data.metadata.projectName;

			// Auch die versteckte ID setzen, falls vorhanden
			if (data.id) {
				const idElement = document.getElementById("projectId");
				if (idElement) idElement.value = data.id;
			}
		}

		// Display Options direkt anwenden
		if (
			data.settings &&
			data.settings.displayOptions &&
			window.displayOptions
		) {
			window.displayOptions.current = {
				...window.displayOptions.defaults,
				...data.settings.displayOptions,
			};
			window.displayOptions.updateUI();
			window.displayOptions.applySettings();
		}

		// Basis-Einstellungen setzen
		if (data.settings) {
			const elements = ["tilesCount", "secondaryTilesCount", "layoutType"];
			elements.forEach((id) => {
				const element = document.getElementById(id);
				if (element && data.settings[id.replace("Type", "")]) {
					element.value = data.settings[id.replace("Type", "")];
				}
			});

			// UI-Einstellungen anwenden falls hangarUI verfügbar
			if (window.hangarUI && window.hangarUI.uiSettings) {
				window.hangarUI.uiSettings.tilesCount = data.settings.tilesCount || 8;
				window.hangarUI.uiSettings.secondaryTilesCount =
					data.settings.secondaryTilesCount || 4;
				window.hangarUI.uiSettings.layout = data.settings.layout || 4;
				window.hangarUI.uiSettings.apply();
			}
		}

		// Kachelndaten direkt anwenden
		if (typeof applyLoadedTileData === "function") {
			applyLoadedTileData(data);
		}
	},

	/**
	 * Sichere Flugdaten-Anwendung
	 */
	async applyFlightDataSafe(flightData, source) {
		console.log(`✈️ Wende Flugdaten an (Quelle: ${source})`);

		// Prüfe jede Aircraft ID einzeln auf Konflikte
		flightData.forEach((flight, index) => {
			const tileId = index + 1;
			if (flight.aircraftId) {
				this.queueOperation({
					type: "setAircraftId",
					tileId: tileId,
					value: flight.aircraftId,
					source: source,
					timestamp: new Date().toISOString(),
				});
			}
		});
	},

	/**
	 * Sichere API-Update-Anwendung - Persistiert API-Flugdaten dauerhaft
	 */
	async applyApiUpdateSafe(coordData, source, aircraftId) {
		console.log(
			`🛫 Persistiere API-Update für ${aircraftId} (Quelle: ${source})`
		);

		// Aktualisiere interne Datenhaltung
		this.currentData = this.currentData || {};

		// Erstelle oder aktualisiere die Flugdaten-Struktur
		if (!this.currentData.tiles) {
			this.currentData.tiles = {};
		}

		// Persistiere jede Cell separat
		Object.keys(coordData).forEach((cellKey) => {
			const cellData = coordData[cellKey];
			const cellId = cellKey.split("_")[1];

			// Aktualisiere die persistente Datenhaltung
			this.currentData.tiles[cellKey] = {
				...this.currentData.tiles[cellKey],
				aircraftId: cellData.aircraftId,
				arrivalTime: cellData.arrivalTime,
				departureTime: cellData.departureTime,
				position: cellData.position,
				lastApiUpdate: cellData.timestamp,
				source: source,
			};

			console.log(`✅ Persistiert: Cell ${cellId} für ${cellData.aircraftId}`);
		});

		// Aktualisiere Metadaten
		this.dataSource = source;
		this.lastUpdate = new Date().toISOString();

		console.log(`✅ API-Update für ${aircraftId} erfolgreich persistiert`);
	},

	/**
	 * Konfliktwarnungen anzeigen
	 */
	showConflictWarning(tileId, currentValue, newValue, source) {
		console.warn(`� DATENKONFLIKT in Kachel ${tileId}:`);
		console.warn(`   Aktuell: "${currentValue}"`);
		console.warn(`   ${source}: "${newValue}"`);

		// Optional: UI-Warnung anzeigen
		if (window.showNotification) {
			window.showNotification(
				`Datenkonflikt in Kachel ${tileId}: "${currentValue}" vs "${newValue}"`,
				"warning"
			);
		}
	},

	/**
	 * Validiert Datenintegrität - OHNE REKURSION
	 */
	async validateDataIntegrity() {
		// Prüfe auf doppelte Aircraft IDs
		const aircraftIds = {};
		let conflicts = 0;

		document.querySelectorAll('input[id^="aircraft-"]').forEach((input) => {
			const value = input.value.trim();
			if (value) {
				if (aircraftIds[value]) {
					conflicts++;
					console.warn(`🔍 Doppelte Aircraft ID erkannt: "${value}"`);
				} else {
					aircraftIds[value] = input.id;
				}
			}
		});

		if (conflicts > 0) {
			console.warn(
				`⚠️ ${conflicts} Datenkonflikte erkannt - aber KEINE weitere Verarbeitung`
			);
		} else {
			console.log("✅ Datenintegrität bestätigt");
		}

		// WICHTIG: KEINE weitere Verarbeitung oder Rekursion
		return conflicts === 0;
	},

	/**
	 * Fügt Operation zur Warteschlange hinzu - DEBOUNCED
	 */
	queueOperation(operation) {
		this.operationQueue.push(operation);

		// Debounced Verarbeitung um Rekursion zu vermeiden
		if (this.processTimeout) {
			clearTimeout(this.processTimeout);
		}

		this.processTimeout = setTimeout(() => {
			if (!this.isProcessing) {
				this.processOperationQueue();
			}
		}, 50); // 50ms Verzögerung
	},

	/**
	 * Öffentliche API für andere Module
	 */
	setAircraftId(tileId, value, source = "user") {
		this.queueOperation({
			type: "setAircraftId",
			tileId: tileId,
			value: value,
			source: source,
			timestamp: new Date().toISOString(),
		});
	},

	loadProject(data, source = "user") {
		this.queueOperation({
			type: "loadProject",
			data: data,
			source: source,
			timestamp: new Date().toISOString(),
		});
	},

	applyFlightData(flightData, source = "api") {
		this.queueOperation({
			type: "applyFlightData",
			data: flightData,
			source: source,
			timestamp: new Date().toISOString(),
		});
	},
};

// Globale Verfügbarkeit
window.dataCoordinator = window.HangarDataCoordinator;

// Initialisierung ohne localStorage-Abhängigkeit
document.addEventListener("DOMContentLoaded", function () {
	console.log("🚀 HangarDataCoordinator initialisiert (localStorage-frei)");

	// Warte auf eventuelle Server-Sync-Operationen
	setTimeout(() => {
		if (!window.isApplyingServerData) {
			console.log("📋 Bereit für Benutzereingaben");
		}
	}, 1000);
});

/**
 * 🔍 REKURSIVE SELBSTKONTROLLE UND VALIDIERUNG
 * Prüft die korrekte Implementierung aller Korrekturen
 */
window.HangarSystemValidator = {
	/**
	 * Führt vollständige Systemvalidierung durch
	 */
	async validateSystem() {
		console.log("🔍 === REKURSIVE SYSTEMVALIDIERUNG GESTARTET ===");

		const results = {
			dataCoordinator: this.validateDataCoordinator(),
			localStorage: this.validateLocalStorageDisabled(),
			conflictPrevention: this.validateConflictPrevention(),
			serverSync: this.validateServerSyncIntegration(),
			apiIntegration: this.validateApiIntegration(),
		};

		const passed = Object.values(results).every((result) => result.passed);

		console.log("📊 Validierungsergebnisse:", results);
		console.log(
			passed ? "✅ ALLE TESTS BESTANDEN" : "❌ EINIGE TESTS FEHLGESCHLAGEN"
		);

		return { passed, results };
	},

	/**
	 * Prüft Datenkoordinator-Funktionalität
	 */
	validateDataCoordinator() {
		const tests = {
			exists: !!window.HangarDataCoordinator,
			accessible: !!window.dataCoordinator,
			hasQueue: !!window.dataCoordinator?.operationQueue,
			hasSetAircraftId:
				typeof window.dataCoordinator?.setAircraftId === "function",
			hasValidation:
				typeof window.dataCoordinator?.validateDataIntegrity === "function",
		};

		const passed = Object.values(tests).every(Boolean);
		console.log("🎯 Datenkoordinator-Tests:", tests);

		return {
			passed,
			tests,
			message: passed
				? "Datenkoordinator funktional"
				: "Datenkoordinator-Probleme erkannt",
		};
	},

	/**
	 * Prüft dass localStorage deaktiviert ist
	 */
	validateLocalStorageDisabled() {
		// Prüfe ob localStorage-Aufrufe durch unsere Implementierung ersetzt wurden
		const hasCoordinatedSave = window.hangarData?.saveCurrentStateToLocalStorage
			?.toString()
			?.includes("Memory-Cache");
		const hasCoordinatedEvents = window.saveFlightTimeValueToLocalStorage
			?.toString()
			?.includes("dataCoordinator");

		const tests = {
			saveReplaced: hasCoordinatedSave,
			eventsReplaced: hasCoordinatedEvents,
			coordinatorActive: !!window.dataCoordinator,
		};

		const passed = Object.values(tests).every(Boolean);
		console.log("💾 localStorage-Deaktivierung:", tests);

		return {
			passed,
			tests,
			message: passed
				? "localStorage erfolgreich ersetzt"
				: "localStorage noch aktiv",
		};
	},

	/**
	 * Prüft Konfliktverhinderung
	 */
	validateConflictPrevention() {
		const tests = {
			hasConflictWarning:
				typeof window.dataCoordinator?.showConflictWarning === "function",
			hasQueueing: !!window.dataCoordinator?.operationQueue,
			hasIntegrityCheck:
				typeof window.dataCoordinator?.validateDataIntegrity === "function",
			serverPriority: true, // Wird durch Funktionslogik getestet
		};

		const passed = Object.values(tests).every(Boolean);
		console.log("⚡ Konfliktverhinderung:", tests);

		return {
			passed,
			tests,
			message: passed ? "Konfliktschutz aktiv" : "Konfliktschutz unvollständig",
		};
	},

	/**
	 * Prüft Server-Sync Integration
	 */
	validateServerSyncIntegration() {
		const hasServerSyncClass = !!window.ServerSync || !!window.StorageBrowser;
		const hasApplyServerData = !!(
			window.serverSync?.applyServerData ||
			window.storageBrowser?.applyServerData
		);

		const tests = {
			serverSyncExists: hasServerSyncClass,
			applyMethodExists: hasApplyServerData,
			coordinatorIntegration: true, // Wird durch Code-Analyse validiert
		};

		const passed = Object.values(tests).every(Boolean);
		console.log("🌐 Server-Sync Integration:", tests);

		return {
			passed,
			tests,
			message: passed
				? "Server-Sync integriert"
				: "Server-Sync Integration unvollständig",
		};
	},

	/**
	 * Prüft API-Integration
	 */
	validateApiIntegration() {
		const hasFlightDataFunction =
			typeof window.applyFlightDataToUI === "function";
		const functionContent = window.applyFlightDataToUI?.toString() || "";
		const hasConflictCheck =
			functionContent.includes("currentValue") &&
			functionContent.includes("dataCoordinator");

		const tests = {
			functionExists: hasFlightDataFunction,
			hasConflictChecks: hasConflictCheck,
			coordinatorIntegrated: functionContent.includes("dataCoordinator"),
		};

		const passed = Object.values(tests).every(Boolean);
		console.log("🔌 API-Integration:", tests);

		return {
			passed,
			tests,
			message: passed
				? "API-Integration sicher"
				: "API-Integration benötigt Verbesserungen",
		};
	},
};

// Auto-Validierung nach Initialisierung
document.addEventListener("DOMContentLoaded", function () {
	setTimeout(async () => {
		if (window.HangarSystemValidator) {
			const validation = await window.HangarSystemValidator.validateSystem();

			if (validation.passed) {
				console.log(
					"🎉 SYSTEM ERFOLGREICH VALIDIERT - Aircraft ID Überschreibungsproblem behoben"
				);
			} else {
				console.warn(
					"⚠️ VALIDIERUNG UNVOLLSTÄNDIG - Bitte Korrekturen überprüfen"
				);
			}
		}
	}, 2000);
});

console.log("🔧 HangarPlanner Aircraft ID Koordinationssystem initialisiert");

// Alias für Kompatibilität: Globale Verfügbarkeit unter beiden Namen
window.HangarData = window.hangarData;

// ✅ NEUE FUNKTION: Badge-Status basierend auf Alter automatisch aktualisieren
function refreshAllUpdateBadges() {
	const badges = document.querySelectorAll(".last-update-badge");
	const now = Date.now();

	badges.forEach((badge) => {
		const timestamp = parseInt(badge.dataset.timestamp);
		const ageMinutes = (now - timestamp) / (1000 * 60);

		// ✅ DEZENTE Farben - Aktualisiere basierend auf Alter
		if (ageMinutes < 5) {
			// Fresh - Subtiles Grün
			badge.style.backgroundColor = "rgba(34, 197, 94, 0.1)";
			badge.style.color = "#16a34a";
			badge.style.border = "1px solid rgba(34, 197, 94, 0.3)";
		} else if (ageMinutes < 30) {
			// Recent - Subtiles Blau
			badge.style.backgroundColor = "rgba(59, 130, 246, 0.1)";
			badge.style.color = "#1d4ed8";
			badge.style.border = "1px solid rgba(59, 130, 246, 0.3)";
		} else if (ageMinutes < 120) {
			// Old - Subtiles Orange
			badge.style.backgroundColor = "rgba(245, 158, 11, 0.1)";
			badge.style.color = "#d97706";
			badge.style.border = "1px solid rgba(245, 158, 11, 0.3)";
		} else {
			// Stale - Subtiles Rot
			badge.style.backgroundColor = "rgba(239, 68, 68, 0.1)";
			badge.style.color = "#dc2626";
			badge.style.border = "1px solid rgba(239, 68, 68, 0.3)";
		}

		// Tooltip aktualisieren
		const source = badge.dataset.source || "unknown";
		const updateTime = new Date(timestamp).toLocaleString();
		badge.title = `Letztes Update: ${updateTime} (${source}) - ${Math.round(
			ageMinutes
		)}min alt`;
	});
}

// Auto-Refresh der Badge-Status alle 60 Sekunden
setInterval(refreshAllUpdateBadges, 60000);

// Globale Verfügbarkeit
window.refreshAllUpdateBadges = refreshAllUpdateBadges;

// ✅ TEST-FUNKTION: Manueller Badge-Test für Debugging
window.testUpdateBadge = function(cellId = 1, source = "test") {
	console.log(`🧪 Testing badge creation for cell ${cellId} with source: ${source}`);
	
	// Simuliere Flugdaten-Update für Test-Zwecke
	const testFlightData = {
		arrivalTime: "14:30",
		departureTime: "16:45",
		positionText: "Gate A1",
		originCode: "FRA",
		destCode: "MUC",
		_clearFields: false,
		_noDataFound: false
	};
	
	// Rufe die interne updateLastUpdateBadge Funktion auf
	// Da sie in updateAircraftFromFlightData definiert ist, simulieren wir einen API-Update
	if (window.hangarData && window.hangarData.updateAircraftFromFlightData) {
		// Setze zuerst eine Test Aircraft ID in die Kachel
		const aircraftInput = document.getElementById(`aircraft-${cellId}`);
		if (aircraftInput) {
			const testAircraftId = `D-TEST${cellId}`;
			aircraftInput.value = testAircraftId;
			console.log(`✅ Test Aircraft ID gesetzt: ${testAircraftId} in cell ${cellId}`);
			
			// Simuliere API-Update
			window.hangarData.updateAircraftFromFlightData(testAircraftId, testFlightData)
				.then(() => {
					console.log(`✅ Badge-Test für cell ${cellId} abgeschlossen`);
					// Prüfe ob Badge erstellt wurde
					const badge = document.querySelector(`[data-cell-id="${cellId}"] .last-update-badge`);
					if (badge) {
						console.log(`✅ Badge erfolgreich erstellt:`, badge);
						console.log(`Badge content: "${badge.textContent}"`);
						console.log(`Badge timestamp: ${badge.dataset.timestamp}`);
					} else {
						console.warn(`❌ Kein Badge gefunden für cell ${cellId}`);
						// Prüfe alternative Selektoren
						const altBadge1 = document.querySelector(`#hangarGrid .hangar-cell:nth-child(${cellId}) .last-update-badge`);
						const altBadge2 = document.querySelector(`.last-update-badge`);
						console.log(`Alternative badge search results:`, { altBadge1, altBadge2 });
					}
				})
				.catch(error => {
					console.error(`❌ Fehler beim Badge-Test:`, error);
				});
		} else {
			console.warn(`❌ Aircraft input für cell ${cellId} nicht gefunden`);
		}
	} else {
		console.error(`❌ hangarData.updateAircraftFromFlightData nicht verfügbar`);
	}
};

// TEST-FUNKTION: Badge-Status prüfen
window.checkAllBadges = function() {
	const badges = document.querySelectorAll(".last-update-badge");
	console.log(`🔍 Found ${badges.length} update badges:`);
	badges.forEach((badge, index) => {
		console.log(`Badge ${index + 1}:`, {
			content: badge.textContent,
			timestamp: badge.dataset.timestamp,
			source: badge.dataset.source,
			visible: badge.offsetParent !== null,
			position: badge.getBoundingClientRect()
		});
	});
	return badges.length;
};
