/**
 * Timetable API Integration für HangarPlanner
 * Verbindet die AeroDataBox API direkt mit der Timetable-Anzeige
 * Ersetzt das tile-basierte System mit direkter API-Anbindung
 */

// Globale Timetable-Manager Klasse
class TimetableAPIManager {
	constructor() {
		this.overnightFlights = [];
		this.currentSort = "arrival";
		this.currentFilter = "all";
		this.isLoading = false;

		// DOM-Elemente
		this.timetableBody = null;
		this.timetableEmpty = null;
		this.timetableCount = null;
		this.refreshButton = null;
		this.filterSelect = null;
		this.sortSelect = null;

		this.init();
	}

	/**
	 * Initialisiert die Timetable-Manager
	 */
	init() {
		console.log("🕐 Initialisiere Timetable API Integration...");

		// Warte bis DOM geladen ist
		if (document.readyState === "loading") {
			document.addEventListener("DOMContentLoaded", () =>
				this.setupEventListeners()
			);
		} else {
			this.setupEventListeners();
		}
	}

	/**
	 * Setup Event Listeners
	 */
	setupEventListeners() {
		// DOM-Elemente referenzieren
		this.timetableBody = document.getElementById("timetableBody");
		this.timetableEmpty = document.getElementById("timetableEmpty");
		this.timetableCount = document.getElementById("timetableCount");
		this.refreshButton = document.getElementById("refreshTimetable");
		this.filterSelect = document.getElementById("timetableFilter");
		this.sortSelect = document.getElementById("timetableSort");

		if (!this.timetableBody) {
			console.log("⚠️ Timetable DOM-Elemente nicht gefunden - retry in 2 Sekunden");
			// Retry nach 2 Sekunden falls DOM noch nicht bereit
			setTimeout(() => this.setupEventListeners(), 2000);
			return;
		}

		console.log("✅ Timetable DOM-Elemente gefunden");

		// Event Listeners hinzufügen
		if (this.refreshButton) {
			this.refreshButton.addEventListener("click", () => {
				console.log("🔄 Manueller Refresh-Button geklickt");
				this.refreshTimetable();
			});
		}

		if (this.filterSelect) {
			this.filterSelect.addEventListener("change", (e) => {
				this.currentFilter = e.target.value;
				this.renderTimetable();
			});
		}

		if (this.sortSelect) {
			this.sortSelect.addEventListener("change", (e) => {
				this.currentSort = e.target.value;
				this.renderTimetable();
			});
		}

		console.log("✅ Timetable Event Listeners eingerichtet");

		// Verzögerte erste Aktualisierung - warte auf API-Verfügbarkeit
		this.waitForAPIAndRefresh();
	}

	/**
	 * Wartet auf API-Verfügbarkeit und startet dann die erste Aktualisierung
	 */
	async waitForAPIAndRefresh() {
		console.log("⏳ Warte auf AeroDataBox API-Verfügbarkeit...");

		let attempts = 0;
		const maxAttempts = 40; // 40 Versuche = 20 Sekunden (mehr Zeit)

		const checkAPI = () => {
			attempts++;

			// Erweiterte Prüfung der API-Verfügbarkeit
			if (
				typeof window.AeroDataBoxAPI !== "undefined" &&
				window.AeroDataBoxAPI &&
				typeof window.AeroDataBoxAPI.generateOvernightTimetable === "function"
			) {
				console.log(`✅ AeroDataBox API verfügbar nach ${attempts} Versuchen`);
				console.log(`🔍 API-Funktionen: ${Object.keys(window.AeroDataBoxAPI).join(', ')}`);
				// Erste Aktualisierung starten - mit mehr Verzögerung
				setTimeout(() => this.refreshTimetable(), 2000);
				return;
			}

			if (attempts >= maxAttempts) {
				console.log(
					"⚠️ AeroDataBox API nach 20 Sekunden nicht verfügbar - Timetable bleibt leer"
				);
				console.log(`🔍 Aktueller Zustand: window.AeroDataBoxAPI = ${typeof window.AeroDataBoxAPI}`);
				if (window.AeroDataBoxAPI) {
					console.log(`🔍 Verfügbare Funktionen: ${Object.keys(window.AeroDataBoxAPI).join(', ')}`);
				}
				this.showError(
					"AeroDataBox API nicht verfügbar. Versuchen Sie später erneut."
				);
				return;
			}

			// Debug-Ausgabe alle 5 Versuche
			if (attempts % 5 === 0) {
				console.log(`⏳ Versuch ${attempts}/${maxAttempts} - API noch nicht verfügbar`);
			}

			// Versuche alle 500ms
			setTimeout(checkAPI, 500);
		};

		checkAPI();
	}

	/**
	 * Aktualisiert die Timetable-Daten über die AeroDataBox API
	 */
	async refreshTimetable() {
		if (this.isLoading) {
			console.log("🔄 Timetable wird bereits aktualisiert...");
			return;
		}

		this.isLoading = true;
		this.updateLoadingState(true);

		try {
			console.log("🔄 Refreshing Timetable via AeroDataBox API...");

			// Erweiterte Prüfung der API-Verfügbarkeit
			if (typeof window.AeroDataBoxAPI === "undefined") {
				throw new Error(
					"AeroDataBox API nicht geladen - window.AeroDataBoxAPI ist undefined"
				);
			}

			if (!window.AeroDataBoxAPI) {
				throw new Error("AeroDataBox API ist null oder undefined");
			}

			if (
				typeof window.AeroDataBoxAPI.generateOvernightTimetable !== "function"
			) {
				throw new Error("generateOvernightTimetable Funktion nicht verfügbar");
			}

			console.log("✅ API-Verfügbarkeit bestätigt, starte Datenabfrage...");

			// Rufe die neue generateOvernightTimetable Funktion auf
			this.overnightFlights =
				await window.AeroDataBoxAPI.generateOvernightTimetable();

			console.log(
				`✅ ${this.overnightFlights.length} Übernachtungsflüge erhalten`
			);

			// Rendere die Timetable
			this.renderTimetable();
		} catch (error) {
			console.error("❌ Fehler beim Aktualisieren der Timetable:", error);
			this.showError(`Fehler beim Laden der Timetable: ${error.message}`);
		} finally {
			this.isLoading = false;
			this.updateLoadingState(false);
		}
	}

	/**
	 * Öffentliche Methode für externe Aufrufe (z.B. von Update Data Button)
	 * Startet vollständige Timetable-Aktualisierung unabhängig von anderen Datenquellen
	 */
	async forceRefreshTimetable() {
		console.log(
			"🚀 Force Refresh Timetable - vollständige API-Abfrage gestartet"
		);

		// Reset der aktuellen Daten um sicherzustellen, dass neue API-Daten geholt werden
		this.overnightFlights = [];

		// Direkte API-Abfrage ausführen
		return await this.refreshTimetable();
	}

	/**
	 * Rendert die Timetable basierend auf aktuellen Daten, Filtern und Sortierung
	 */
	renderTimetable() {
		if (!this.timetableBody) return;

		// Filtere Daten
		let filteredData = this.filterData(this.overnightFlights);

		// Sortiere Daten
		filteredData = this.sortData(filteredData);

		// Update Count
		this.updateCount(filteredData.length);

		// Zeige leeren Zustand wenn keine Daten
		if (filteredData.length === 0) {
			this.showEmptyState();
			return;
		}

		// Verstecke leeren Zustand
		this.hideEmptyState();

		// Erstelle HTML für jede Zeile
		const rows = filteredData
			.map((flight) => this.createTableRow(flight))
			.join("");

		// Update DOM
		this.timetableBody.innerHTML = rows;

		console.log(`📊 Timetable gerendert: ${filteredData.length} Einträge`);
	}

	/**
	 * Filtert die Daten basierend auf dem aktuellen Filter
	 */
	filterData(data) {
		switch (this.currentFilter) {
			case "overnight":
				// Alle Daten sind bereits Übernachtungen
				return data;
			case "active":
				// Nur aktive Flugzeuge (könnte mit Position oder anderen Kriterien definiert werden)
				return data.filter(
					(flight) => flight.position && flight.position !== "--"
				);
			case "all":
			default:
				return data;
		}
	}

	/**
	 * Sortiert die Daten basierend auf der aktuellen Sortierung
	 */
	sortData(data) {
		const sortedData = [...data];

		switch (this.currentSort) {
			case "arrival":
				return sortedData.sort((a, b) => {
					const timeA = this.timeToMinutes(a.arrival.time);
					const timeB = this.timeToMinutes(b.arrival.time);
					return timeA - timeB;
				});
			case "departure":
				return sortedData.sort((a, b) => {
					const timeA = this.timeToMinutes(a.departure.time);
					const timeB = this.timeToMinutes(b.departure.time);
					return timeA - timeB;
				});
			case "aircraft":
				return sortedData.sort((a, b) =>
					a.registration.localeCompare(b.registration)
				);
			case "position":
				return sortedData.sort((a, b) => {
					const posA = a.position || "ZZZ";
					const posB = b.position || "ZZZ";
					return posA.localeCompare(posB);
				});
			default:
				return sortedData;
		}
	}

	/**
	 * Erstellt eine HTML-Tabellenzeile für einen Flug
	 */
	createTableRow(flight) {
		const position = flight.position || "--";
		const statusClass = this.getStatusClass(flight.status || "unknown");
		const statusText = this.getStatusText(flight.status || "unknown");

		return `
			<tr class="hover:bg-gray-50 transition-colors duration-150">
				<td class="px-4 py-3 text-sm text-gray-900 font-medium">${position}</td>
				<td class="px-4 py-3 text-sm text-gray-900 font-medium">${
					flight.registration
				}</td>
				<td class="px-4 py-3">
					<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusClass}">
						${statusText}
					</span>
				</td>
				<td class="px-4 py-3 text-sm text-gray-500">${flight.arrival.from}</td>
				<td class="px-4 py-3 text-sm text-gray-500">${flight.departure.to}</td>
				<td class="px-4 py-3 text-sm text-gray-900">
					<div class="flex flex-col">
						<span class="font-medium">${flight.arrival.time}</span>
						<span class="text-xs text-gray-500">${flight.arrival.flightNumber}</span>
					</div>
				</td>
				<td class="px-4 py-3 text-sm text-gray-900">
					<div class="flex flex-col">
						<span class="font-medium">${flight.departure.time}</span>
						<span class="text-xs text-gray-500">${flight.departure.flightNumber}</span>
					</div>
				</td>
				<td class="px-4 py-3 text-sm text-gray-500">
					<div class="flex flex-col">
						<span>${flight.route}</span>
						<span class="text-xs text-gray-400">${flight.aircraftType}</span>
					</div>
				</td>
				<td class="px-4 py-3 text-sm text-gray-500">
					<span class="text-xs">${flight.overnightDuration || "--"}</span>
				</td>
			</tr>
		`;
	}

	/**
	 * Hilfsfunktion: Zeit zu Minuten konvertieren
	 */
	timeToMinutes(timeStr) {
		if (!timeStr || timeStr === "--:--") return 9999;
		const match = timeStr.match(/(\d{1,2}):(\d{2})/);
		if (!match) return 9999;
		return parseInt(match[1]) * 60 + parseInt(match[2]);
	}

	/**
	 * Bestimmt die CSS-Klasse für einen Status
	 */
	getStatusClass(status) {
		switch (status.toLowerCase()) {
			case "arrived":
			case "on-ground":
				return "bg-green-100 text-green-800";
			case "scheduled":
			case "expected":
				return "bg-blue-100 text-blue-800";
			case "delayed":
				return "bg-yellow-100 text-yellow-800";
			case "cancelled":
				return "bg-red-100 text-red-800";
			default:
				return "bg-gray-100 text-gray-800";
		}
	}

	/**
	 * Bestimmt den Anzeigetext für einen Status
	 */
	getStatusText(status) {
		switch (status.toLowerCase()) {
			case "arrived":
				return "Angekommen";
			case "on-ground":
				return "Am Boden";
			case "scheduled":
				return "Geplant";
			case "expected":
				return "Erwartet";
			case "delayed":
				return "Verspätet";
			case "cancelled":
				return "Storniert";
			default:
				return "Übernachtung";
		}
	}

	/**
	 * Aktualisiert die Anzahl-Anzeige
	 */
	updateCount(count) {
		if (this.timetableCount) {
			this.timetableCount.textContent = `${count} Einträge`;
		}
	}

	/**
	 * Zeigt den leeren Zustand an
	 */
	showEmptyState() {
		if (this.timetableEmpty) {
			this.timetableEmpty.classList.remove("hidden");
		}
		if (this.timetableBody) {
			this.timetableBody.innerHTML = "";
		}
	}

	/**
	 * Versteckt den leeren Zustand
	 */
	hideEmptyState() {
		if (this.timetableEmpty) {
			this.timetableEmpty.classList.add("hidden");
		}
	}

	/**
	 * Aktualisiert den Loading-Zustand
	 */
	updateLoadingState(isLoading) {
		if (this.refreshButton) {
			if (isLoading) {
				this.refreshButton.disabled = true;
				this.refreshButton.innerHTML = `
					<svg class="animate-spin w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
					</svg>
					Lädt...
				`;
			} else {
				this.refreshButton.disabled = false;
				this.refreshButton.innerHTML = `
					<svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
					</svg>
					Aktualisieren
				`;
			}
		}
	}

	/**
	 * Zeigt eine Fehlermeldung an
	 */
	showError(message) {
		console.error("❌ Timetable Error:", message);

		if (this.timetableBody) {
			this.timetableBody.innerHTML = `
				<tr>
					<td colspan="9" class="px-4 py-8 text-center">
						<div class="text-red-500">
							<svg class="mx-auto h-8 w-8 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 19.5c-.77.833.192 2.5 1.732 2.5z"></path>
							</svg>
							<p class="font-medium">${message}</p>
						</div>
					</td>
				</tr>
			`;
		}

		this.updateCount(0);
	}
}

// Globale Instanz erstellen - aber erst nach DOM-Bereitschaft
let TimetableAPIManagerInstance = null;

// Warte auf DOM und andere Scripts
function initializeTimetableManager() {
	if (TimetableAPIManagerInstance) {
		console.log("⚠️ TimetableAPIManager bereits initialisiert");
		return;
	}

	console.log("🚀 Initialisiere TimetableAPIManager...");
	TimetableAPIManagerInstance = new TimetableAPIManager();
	window.TimetableAPIManager = TimetableAPIManagerInstance;
}

// Initialisierung nach DOM-Bereitschaft und Script-Laden
if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", () => {
		// Zusätzliche Verzögerung um sicherzustellen, dass alle Scripts geladen sind
		setTimeout(initializeTimetableManager, 500);
	});
} else {
	// DOM bereits bereit
	setTimeout(initializeTimetableManager, 500);
}

console.log("✅ Timetable API Integration geladen");
