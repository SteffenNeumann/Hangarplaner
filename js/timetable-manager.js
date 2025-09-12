/**
 * Timetable Manager - Chronologische Übersicht aller Flugzeuge
 * Sammelt Daten aus allen Kacheln und zeigt sie in Tabellenform an
 */
const TimetableManager = (() => {
	let timetableData = [];
	let currentFilter = "all";
	let currentSort = "arrival";

	// Airline-Mapping: IATA-Code zu vollständigem Namen
	const airlineMapping = {
		LH: "Lufthansa",
		CL: "CityLine",
		VL: "CityAirlines",
		DE: "Condor",
		EW: "Eurowings",
		X3: "TUIfly",
		BA: "British Airways",
		AF: "Air France",
		KL: "KLM",
		UA: "United Airlines",
		DL: "Delta Air Lines",
		AA: "American Airlines",
		LX: "Swiss",
		OS: "Austrian Airlines",
		AZ: "ITA Airways",
		IB: "Iberia",
		KM: "Air Malta", // Ergänzt basierend auf API-Beispiel
		SN: "Brussels Airlines",
		TP: "TAP Air Portugal",
		FR: "Ryanair",
		U2: "easyJet",
		W6: "Wizz Air",
		VY: "Vueling",
	};

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

		// Sammle Daten aus den Haupt-Kacheln (im hangarGrid)
		const mainGrid = document.getElementById("hangarGrid");
		if (mainGrid) {
			const mainCells = mainGrid.querySelectorAll(".hangar-cell");
			mainCells.forEach((cell, index) => {
				const cellNumber = index + 1; // 1-basierte Nummerierung
				const cellData = extractDataFromCell(cell, cellNumber);
				if (cellData) {
					timetableData.push(cellData);
				}
				// Also include schedule bookings (dual bookings) if present
				try {
					const schedEl = cell.querySelector(`#schedule-${cellNumber}`);
					if (schedEl && schedEl.value) {
						const parsed = JSON.parse(schedEl.value || '[]');
						if (Array.isArray(parsed)) {
							parsed.slice(0,2).forEach((b) => {
								if (!b) return;
								const arr = (b.arr||'').trim();
								const dep = (b.dep||'').trim();
								const entry = {
									cellNumber,
									aircraftId: (b.reg||'').trim() || cellData?.aircraftId || '',
									departureTime: dep || "--:--",
									arrivalTime: arr || "--:--",
									fromAirport: "---",
									toAirport: "---",
									notes: "",
									status: "active",
									airline: "---",
									isOvernight: false,
									arrivalTimeSort: convertTimeToMinutes(arr),
									departureTimeSort: convertTimeToMinutes(dep),
								};
								timetableData.push(entry);
							});
						}
					}
				} catch(_e){}
			});
		}

		// Sammle auch Daten aus dynamischen Kacheln
		const dynamicGrid = document.getElementById("secondaryHangarGrid");
		if (dynamicGrid) {
			const dynamicCells = dynamicGrid.querySelectorAll(".hangar-cell");
			dynamicCells.forEach((cell, index) => {
				const cellNumber = 13 + index; // Fortlaufende Nummerierung
				const cellData = extractDataFromCell(cell, cellNumber);
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
	 * @param {HTMLElement} cell - Das Kachel-DOM-Element
	 * @param {number} cellNumber - Kachelnummer für Identifikation
	 * @returns {Object|null} Flugdaten oder null
	 */
	const extractDataFromCell = (cell, cellNumber) => {
		if (!cell) return null;

		const aircraftInput = cell.querySelector(`#aircraft-${cellNumber}`);
		const departureTimeEl = cell.querySelector(`#departure-time-${cellNumber}`);
		const arrivalTimeEl = cell.querySelector(`#arrival-time-${cellNumber}`);
		const fromAirportEl = cell.querySelector(".from-airport");
		const toAirportEl = cell.querySelector(".to-airport");
		const statusLight = cell.querySelector(".status-light");
		const notesEl = cell.querySelector(`#notes-${cellNumber}`);

		if (!aircraftInput || !aircraftInput.value.trim()) {
			return null; // Keine Aircraft ID
		}

		const aircraftId = aircraftInput.value.trim();
		const departureTime = departureTimeEl?.value?.trim() || "--:--";
		const arrivalTime = arrivalTimeEl?.value?.trim() || "--:--";
		const fromAirport = fromAirportEl?.textContent?.trim() || "---";
		const toAirport = toAirportEl?.textContent?.trim() || "---";
		const notes = notesEl?.value?.trim() || "";

		// Status aus dem Statuslicht ermitteln
		let status = "inactive";
		let isOvernight = false;
		let airline = "---";

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
		const positionEl = cell.querySelector(".position-text");
		const positionText = positionEl?.textContent?.trim() || "";

		if (positionText.includes("🏨")) {
			isOvernight = true;
			status = "overnight";
		}

		// Airline aus gespeicherten API-Daten extrahieren (PRIORITÄT 1)
		// Zuerst: Prüfe data-airline Attribut (von API gesetzt)
		const storedAirline = cell.getAttribute("data-airline");
		if (storedAirline && storedAirline !== "---") {
			// Prüfe ob es ein IATA-Code ist und konvertiere zu Vollname
			if (airlineMapping[storedAirline]) {
				airline = airlineMapping[storedAirline];
			} else {
				airline = storedAirline; // Verwende direkt (bereits Vollname)
			}

			console.log(`✈️ Airline aus API-Daten: ${airline} (${storedAirline})`);
		}

		// PRIORITÄT 2: Prüfe data-flight-number Attribut
		if (airline === "---") {
			const storedFlightNumber = cell.getAttribute("data-flight-number");
			if (storedFlightNumber) {
				const flightMatch = storedFlightNumber.match(/^([A-Z]{2})/);
				if (flightMatch) {
					const airlineCode = flightMatch[1];
					airline = airlineMapping[airlineCode] || airlineCode;
					console.log(
						`✈️ Airline aus Flight Number: ${airline} (${airlineCode})`
					);
				}
			}
		}

		// Fallback: Airline aus Flight Number extrahieren (nur wenn nicht bereits gefunden)
		if (airline === "---") {
			// Suche nach Flight Number in verschiedenen möglichen Elementen
			const flightNumberEl = cell.querySelector(
				`[class*="flight-number"], .route-info, .position-text`
			);

			if (flightNumberEl) {
				const text = flightNumberEl.textContent || "";
				// Suche nach Fluggesellschaftscode (2 Buchstaben gefolgt von Zahlen)
				const flightMatch = text.match(/([A-Z]{2})[\s]*\d+/);
				if (flightMatch) {
					const airlineCode = flightMatch[1];
					airline = airlineMapping[airlineCode] || airlineCode;
				}
			}
		}

		// Weitere Fallback-Suche in Notes und Position Text
		if (airline === "---") {
			const allText = (positionText + " " + notes).toUpperCase();
			for (const [code, name] of Object.entries(airlineMapping)) {
				if (allText.includes(code)) {
					airline = name;
					break;
				}
			}
		}

		const flightData = {
			cellNumber,
			aircraftId,
			departureTime,
			arrivalTime,
			fromAirport,
			toAirport,
			notes,
			status,
			airline,
			isOvernight,
			// Für Sortierung - konvertiere Zeiten zu vergleichbaren Werten
			arrivalTimeSort: convertTimeToMinutes(arrivalTime),
			departureTimeSort: convertTimeToMinutes(departureTime),
		};

		console.log(`✅ Daten aus Kachel ${cellNumber} extrahiert:`, flightData);
		return flightData;
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

		// Versuche auch hier Airline-Daten zu extrahieren
		let airline = "---";

		// Prüfe data-airline Attribut (von API gesetzt)
		const storedAirline = cell.getAttribute("data-airline");
		if (storedAirline && storedAirline !== "---") {
			// Prüfe ob es ein IATA-Code ist und konvertiere zu Vollname
			if (airlineMapping[storedAirline]) {
				airline = airlineMapping[storedAirline];
			} else {
				airline = storedAirline; // Verwende direkt (bereits Vollname)
			}
		}

		// PRIORITÄT 2: Prüfe data-flight-number Attribut für dynamische Kacheln
		if (airline === "---") {
			const storedFlightNumber = cell.getAttribute("data-flight-number");
			if (storedFlightNumber) {
				const flightMatch = storedFlightNumber.match(/^([A-Z]{2})/);
				if (flightMatch) {
					const airlineCode = flightMatch[1];
					airline = airlineMapping[airlineCode] || airlineCode;
				}
			}
		}

		// Implementierung für dynamische Kacheln - erweiterte Datenextraktion
		return {
			cellNumber,
			aircraftId: aircraftInput.value.trim(),
			status: "active",
			isOvernight: false,
			airline: airline,
			fromAirport: "---",
			toAirport: "---",
			arrivalTime: "--:--",
			departureTime: "--:--",
			notes: "",
			// Für Sortierung - konvertiere Zeiten zu vergleichbaren Werten
			arrivalTimeSort: convertTimeToMinutes("--:--"),
			departureTimeSort: convertTimeToMinutes("--:--"),
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
				// Prüfe ob Filter eine Airline ist
				const isAirlineFilter =
					Object.values(airlineMapping).includes(currentFilter) ||
					Object.keys(airlineMapping).includes(currentFilter);

				if (isAirlineFilter) {
					return data.filter((item) => {
						return (
							item.airline === currentFilter ||
							Object.keys(airlineMapping).find(
								(key) =>
									airlineMapping[key] === currentFilter &&
									item.airline === airlineMapping[key]
							)
						);
					});
				}

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
					return a.cellNumber - b.cellNumber;
				case "airline":
					return a.airline.localeCompare(b.airline);
				case "arrival":
				default:
					return a.arrivalTimeSort - b.arrivalTimeSort;
			}
		});
	};

	/**
	 * Aktualisiert die Filter-Optionen basierend auf verfügbaren Airlines
	 */
	const updateFilterOptions = () => {
		const filterSelect = document.getElementById("timetableFilter");
		if (!filterSelect) return;

		// Sammle alle einzigartigen Airlines aus den Daten
		const airlines = [
			...new Set(
				timetableData
					.map((item) => item.airline)
					.filter((airline) => airline !== "---")
			),
		];

		// Lösche alle Optionen außer den Standard-Optionen
		const options = filterSelect.querySelectorAll("option");
		options.forEach((option) => {
			if (!["all", "overnight", "active"].includes(option.value)) {
				option.remove();
			}
		});

		// Füge Airline-Optionen hinzu
		airlines.sort().forEach((airline) => {
			const option = document.createElement("option");
			option.value = airline;
			option.textContent = `Airline: ${airline}`;
			filterSelect.appendChild(option);
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

		// Filter-Optionen aktualisieren
		updateFilterOptions();

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

		return `
			<tr onclick="TimetableManager.scrollToCell(${item.cellNumber})" class="cursor-pointer hover:bg-gray-50">
				<td class="timetable-position">${item.cellNumber}</td>
				<td class="timetable-aircraft">${item.aircraftId}</td>
				<td>
					<span class="timetable-airline">${item.airline}</span>
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
