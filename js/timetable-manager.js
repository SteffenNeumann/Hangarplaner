/**
 * Timetable Manager - Chronologische Übersicht aller Flugzeuge
 * Sammelt Daten aus allen Kacheln und zeigt sie in Tabellenform an
 */
const TimetableManager = (() => {
	let timetableData = [];
	let currentFilter = "all";
	let currentSort = "arrival";

	/**
	 * Initialisiert die Timetable
	 */
	const init = () => {
		console.log("🕐 TimetableManager wird initialisiert...");

		// Event Listeners für Toolbar
		document
			.getElementById("timetableFilter")
			?.addEventListener("change", (e) => {
				currentFilter = e.target.value;
				renderTimetable();
			});

		document
			.getElementById("timetableSort")
			?.addEventListener("change", (e) => {
				currentSort = e.target.value;
				renderTimetable();
			});

		document
			.getElementById("refreshTimetable")
			?.addEventListener("click", () => {
				collectAndUpdateTimetable();
			});

		// Initiale Datensammlung
		collectAndUpdateTimetable();

		console.log("✅ TimetableManager initialisiert");
	};

	/**
	 * Sammelt Daten aus allen Kacheln und aktualisiert die Timetable
	 */
	const collectAndUpdateTimetable = () => {
		console.log("🔄 Sammle Daten aus allen Kacheln...");

		timetableData = [];

		// Durchlaufe alle Kacheln (1-12 und dynamische)
		for (let i = 1; i <= 12; i++) {
			const cellData = extractDataFromCell(i);
			if (cellData) {
				timetableData.push(cellData);
			}
		}

		// Sammle auch Daten aus dynamischen Kacheln
		const dynamicGrid = document.getElementById("secondaryHangarGrid");
		if (dynamicGrid) {
			const dynamicCells = dynamicGrid.querySelectorAll(".hangar-cell");
			dynamicCells.forEach((cell, index) => {
				const cellNumber = 13 + index; // Fortlaufende Nummerierung
				const cellData = extractDataFromDynamicCell(cell, cellNumber);
				if (cellData) {
					timetableData.push(cellData);
				}
			});
		}

		console.log(`📊 ${timetableData.length} Flugdaten gesammelt`);
		renderTimetable();
	};

	/**
	 * Extrahiert Flugdaten aus einer Kachel
	 * @param {number} cellNumber - Kachelnummer
	 * @returns {Object|null} Flugdaten oder null
	 */
	const extractDataFromCell = (cellNumber) => {
		const aircraftInput = document.getElementById(`aircraft-id-${cellNumber}`);
		const departureTimeEl = document.querySelector(
			`#cell-${cellNumber} .departure-time`
		);
		const arrivalTimeEl = document.querySelector(
			`#cell-${cellNumber} .arrival-time`
		);
		const fromAirportEl = document.querySelector(
			`#cell-${cellNumber} .from-airport`
		);
		const toAirportEl = document.querySelector(
			`#cell-${cellNumber} .to-airport`
		);
		const statusLight = document.querySelector(
			`#cell-${cellNumber} .status-light`
		);
		const notesEl = document.getElementById(`notes-${cellNumber}`);

		if (!aircraftInput || !aircraftInput.value.trim()) {
			return null; // Keine Aircraft ID
		}

		const aircraftId = aircraftInput.value.trim();
		const departureTime = departureTimeEl?.textContent?.trim() || "--:--";
		const arrivalTime = arrivalTimeEl?.textContent?.trim() || "--:--";
		const fromAirport = fromAirportEl?.textContent?.trim() || "---";
		const toAirport = toAirportEl?.textContent?.trim() || "---";
		const notes = notesEl?.value?.trim() || "";

		// Status aus dem Statuslicht ermitteln
		let status = "inactive";
		let isOvernight = false;

		if (statusLight) {
			if (statusLight.classList.contains("status-green")) {
				status = "active";
			} else if (statusLight.classList.contains("status-yellow")) {
				status = "active";
			} else if (statusLight.classList.contains("status-red")) {
				status = "error";
			}
		}

		// Prüfe auf Übernachtung (🏨 Symbol in Route oder spezielle Kennzeichnung)
		const positionEl = document.querySelector(
			`#cell-${cellNumber} .position-text`
		);
		const positionText = positionEl?.textContent?.trim() || "";

		if (positionText.includes("🏨")) {
			isOvernight = true;
			status = "overnight";
		}

		return {
			position: cellNumber,
			aircraftId,
			status,
			isOvernight,
			fromAirport,
			toAirport,
			arrivalTime,
			departureTime,
			route: positionText,
			notes,
			// Für Sortierung - konvertiere Zeiten zu vergleichbaren Werten
			arrivalTimeSort: convertTimeToMinutes(arrivalTime),
			departureTimeSort: convertTimeToMinutes(departureTime),
		};
	};

	/**
	 * Extrahiert Daten aus einer dynamischen Kachel
	 * @param {Element} cell - Kachel-Element
	 * @param {number} cellNumber - Kachelnummer
	 * @returns {Object|null} Flugdaten oder null
	 */
	const extractDataFromDynamicCell = (cell, cellNumber) => {
		// Ähnliche Logik wie extractDataFromCell, aber für dynamische Kacheln
		const aircraftInput = cell.querySelector('input[id*="aircraft-id"]');

		if (!aircraftInput || !aircraftInput.value.trim()) {
			return null;
		}

		// Implementierung für dynamische Kacheln
		// (Details abhängig von der spezifischen Struktur der dynamischen Kacheln)
		return {
			position: cellNumber,
			aircraftId: aircraftInput.value.trim(),
			status: "active",
			isOvernight: false,
			fromAirport: "---",
			toAirport: "---",
			arrivalTime: "--:--",
			departureTime: "--:--",
			route: "",
			notes: "",
			arrivalTimeSort: 0,
			departureTimeSort: 0,
		};
	};

	/**
	 * Konvertiert Zeit im Format HH:MM zu Minuten für Sortierung
	 * @param {string} timeStr - Zeit als String
	 * @returns {number} Minuten seit Mitternacht
	 */
	const convertTimeToMinutes = (timeStr) => {
		if (!timeStr || timeStr === "--:--" || timeStr === "---") {
			return 9999; // Hoher Wert für leere Zeiten (ans Ende sortieren)
		}

		const match = timeStr.match(/(\d{1,2}):(\d{2})/);
		if (!match) {
			return 9999;
		}

		const hours = parseInt(match[1], 10);
		const minutes = parseInt(match[2], 10);
		return hours * 60 + minutes;
	};

	/**
	 * Filtert die Timetable-Daten basierend auf dem aktuellen Filter
	 * @param {Array} data - Rohdaten
	 * @returns {Array} Gefilterte Daten
	 */
	const filterData = (data) => {
		switch (currentFilter) {
			case "overnight":
				return data.filter((item) => item.isOvernight);
			case "active":
				return data.filter(
					(item) => item.status === "active" || item.status === "overnight"
				);
			case "all":
			default:
				return data;
		}
	};

	/**
	 * Sortiert die Timetable-Daten basierend auf der aktuellen Sortierung
	 * @param {Array} data - Zu sortierende Daten
	 * @returns {Array} Sortierte Daten
	 */
	const sortData = (data) => {
		return data.sort((a, b) => {
			switch (currentSort) {
				case "departure":
					return a.departureTimeSort - b.departureTimeSort;
				case "aircraft":
					return a.aircraftId.localeCompare(b.aircraftId);
				case "position":
					return a.position - b.position;
				case "arrival":
				default:
					return a.arrivalTimeSort - b.arrivalTimeSort;
			}
		});
	};

	/**
	 * Rendert die Timetable
	 */
	const renderTimetable = () => {
		const tbody = document.getElementById("timetableBody");
		const emptyState = document.getElementById("timetableEmpty");
		const countEl = document.getElementById("timetableCount");

		if (!tbody) return;

		// Daten filtern und sortieren
		let filteredData = filterData(timetableData);
		filteredData = sortData(filteredData);

		// Counter aktualisieren
		if (countEl) {
			countEl.textContent = `${filteredData.length} Einträge`;
		}

		// Leeren Zustand anzeigen/verstecken
		if (filteredData.length === 0) {
			tbody.innerHTML = "";
			if (emptyState) {
				emptyState.classList.remove("hidden");
			}
			return;
		} else {
			if (emptyState) {
				emptyState.classList.add("hidden");
			}
		}

		// Tabellenzeilen generieren
		tbody.innerHTML = filteredData.map((item) => createTableRow(item)).join("");
	};

	/**
	 * Erstellt eine Tabellenzeile für einen Timetable-Eintrag
	 * @param {Object} item - Flugdaten
	 * @returns {string} HTML für die Tabellenzeile
	 */
	const createTableRow = (item) => {
		const statusClass = getStatusClass(item.status);
		const statusText = getStatusText(item.status);

		return `
			<tr onclick="TimetableManager.scrollToCell(${item.position})" class="cursor-pointer hover:bg-gray-50">
				<td class="timetable-position">${item.position}</td>
				<td class="timetable-aircraft">${item.aircraftId}</td>
				<td>
					<span class="timetable-status ${statusClass}">${statusText}</span>
				</td>
				<td>
					<span class="timetable-airport">${item.fromAirport}</span>
				</td>
				<td>
					<span class="timetable-airport">${item.toAirport}</span>
				</td>
				<td class="timetable-time">${item.arrivalTime}</td>
				<td class="timetable-time">${item.departureTime}</td>
				<td class="timetable-route">
					<span class="timetable-airport">${item.fromAirport}</span>
					<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8l4 4m0 0l-4 4m4-4H3"></path>
					</svg>
					<span class="timetable-airport">${item.toAirport}</span>
				</td>
				<td class="timetable-notes" title="${item.notes}">${item.notes}</td>
			</tr>
		`;
	};

	/**
	 * Ermittelt die CSS-Klasse für einen Status
	 * @param {string} status - Status
	 * @returns {string} CSS-Klasse
	 */
	const getStatusClass = (status) => {
		switch (status) {
			case "overnight":
				return "overnight";
			case "active":
				return "active";
			case "error":
				return "error";
			case "inactive":
			default:
				return "inactive";
		}
	};

	/**
	 * Ermittelt den Anzeige-Text für einen Status
	 * @param {string} status - Status
	 * @returns {string} Anzeige-Text
	 */
	const getStatusText = (status) => {
		switch (status) {
			case "overnight":
				return "Übernachtung";
			case "active":
				return "Aktiv";
			case "error":
				return "Fehler";
			case "inactive":
			default:
				return "Inaktiv";
		}
	};

	/**
	 * Scrollt zu einer spezifischen Kachel
	 * @param {number} cellNumber - Kachelnummer
	 */
	const scrollToCell = (cellNumber) => {
		const cell = document.getElementById(`cell-${cellNumber}`);
		if (cell) {
			cell.scrollIntoView({ behavior: "smooth", block: "center" });
			// Kurze Hervorhebung
			cell.style.transition = "all 0.3s";
			cell.style.transform = "scale(1.05)";
			cell.style.boxShadow = "0 0 20px rgba(59, 130, 246, 0.5)";

			setTimeout(() => {
				cell.style.transform = "";
				cell.style.boxShadow = "";
			}, 1000);
		}
	};

	/**
	 * Externe API - wird von anderen Komponenten aufgerufen
	 */
	const updateFromCell = (cellNumber) => {
		// Wird aufgerufen wenn eine Kachel aktualisiert wird
		setTimeout(() => {
			collectAndUpdateTimetable();
		}, 100); // Kurze Verzögerung um DOM-Updates abzuwarten
	};

	// Public API
	return {
		init,
		collectAndUpdateTimetable,
		updateFromCell,
		scrollToCell,
		refreshTimetable: collectAndUpdateTimetable,
	};
})();

// Globalen Namespace verfügbar machen
window.TimetableManager = TimetableManager;

// Auto-Initialisierung
document.addEventListener("DOMContentLoaded", () => {
	if (document.getElementById("timetableTable")) {
		TimetableManager.init();
	}
});

console.log("📊 TimetableManager geladen");
