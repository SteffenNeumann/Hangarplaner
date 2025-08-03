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
			console.log(
				"⚠️ Timetable DOM-Elemente nicht gefunden - retry in 2 Sekunden"
			);
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
				console.log(
					`🔍 API-Funktionen: ${Object.keys(window.AeroDataBoxAPI).join(", ")}`
				);
				// Erste Aktualisierung starten - mit mehr Verzögerung
				setTimeout(() => this.refreshTimetable(), 2000);
				return;
			}

			if (attempts >= maxAttempts) {
				console.log(
					"⚠️ AeroDataBox API nach 20 Sekunden nicht verfügbar - Timetable bleibt leer"
				);
				console.log(
					`🔍 Aktueller Zustand: window.AeroDataBoxAPI = ${typeof window.AeroDataBoxAPI}`
				);
				if (window.AeroDataBoxAPI) {
					console.log(
						`🔍 Verfügbare Funktionen: ${Object.keys(
							window.AeroDataBoxAPI
						).join(", ")}`
					);
				}
				this.showError(
					"AeroDataBox API nicht verfügbar. Versuchen Sie später erneut."
				);
				return;
			}

			// Debug-Ausgabe alle 5 Versuche
			if (attempts % 5 === 0) {
				console.log(
					`⏳ Versuch ${attempts}/${maxAttempts} - API noch nicht verfügbar`
				);
			}

			// Versuche alle 500ms
			setTimeout(checkAPI, 500);
		};

		checkAPI();
	}

	/**
	 * Aktualisiert die Timetable-Daten basierend auf Fleet Database und individuellen API-Abfragen
	 */
	async refreshTimetable() {
		if (this.isLoading) {
			console.log("🔄 Timetable wird bereits aktualisiert...");
			return;
		}

		this.isLoading = true;
		this.updateLoadingState(true);

		try {
			console.log(
				"🔄 Refreshing Timetable via Fleet Database + individuelle API-Abfragen..."
			);

			// Hole aktuelle Datum-Einstellungen aus der UI
			const currentDateInput = document.getElementById("currentDateInput");
			const nextDateInput = document.getElementById("nextDateInput");
			const airportCodeInput = document.getElementById("airportCodeInput");

			const today = new Date().toISOString().split("T")[0];
			const tomorrow = new Date(new Date().setDate(new Date().getDate() + 1))
				.toISOString()
				.split("T")[0];

			const currentDate = currentDateInput?.value || today;
			const nextDate = nextDateInput?.value || tomorrow;
			const airportCode =
				airportCodeInput?.value?.trim().toUpperCase() || "MUC";

			console.log(`📅 Abfragezeitraum: ${currentDate} → ${nextDate}`);
			console.log(`🏢 Zielstation: ${airportCode}`);

			// Prüfe Fleet Database Manager Verfügbarkeit
			if (!window.fleetDatabaseManager) {
				throw new Error("Fleet Database Manager nicht verfügbar");
			}

			// Warte auf Fleet Database Initialisierung
			await window.fleetDatabaseManager.waitForInitialization();

			// Hole alle Fleet Database Daten
			const fleetData = window.fleetDatabaseManager.getAllAircrafts();

			if (!fleetData || fleetData.length === 0) {
				console.log(
					"⚠️ Keine Fleet Database Daten verfügbar - lade zuerst Fleet Daten"
				);
				this.showError(
					"Keine Fleet Database Daten verfügbar. Bitte laden Sie zuerst die Fleet Database."
				);
				return;
			}

			console.log(
				`✈️ ${fleetData.length} Flugzeuge in Fleet Database gefunden`
			);

			// Prüfe AeroDataBox API Verfügbarkeit
			if (!window.AeroDataBoxAPI) {
				throw new Error("AeroDataBox API nicht verfügbar");
			}

			// Erstelle Liste aller Aircraft Registrations
			const aircraftRegistrations = fleetData
				.map((aircraft) => aircraft.registration)
				.filter(Boolean);
			console.log(
				`📋 ${aircraftRegistrations.length} Aircraft Registrations für API-Abfragen`
			);

			// Führe individuelle API-Abfragen für jede Aircraft Registration durch
			this.overnightFlights = await this.queryIndividualAircraftFlights(
				aircraftRegistrations,
				currentDate,
				nextDate,
				airportCode
			);

			console.log(
				`✅ ${this.overnightFlights.length} Übernachtungsflüge identifiziert`
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
	 * Führt effiziente API-Abfragen für Aircraft Übernachtungen durch
	 * VEREINFACHT: Nur heutiger Tag, letzte Ankunft = Übernachtung
	 * @param {Array} aircraftRegistrations - Array mit Aircraft Registrations
	 * @param {string} currentDate - Heutiges Datum (YYYY-MM-DD)
	 * @param {string} nextDate - Folgetag (YYYY-MM-DD) - wird ignoriert
	 * @param {string} airportCode - Zielflughafen (z.B. "MUC")
	 * @returns {Promise<Array>} Array mit Übernachtungsflügen
	 */
	async queryIndividualAircraftFlights(
		aircraftRegistrations,
		currentDate,
		nextDate,
		airportCode
	) {
		const overnightFlights = [];
		const rateLimitDelay = 2000; // 2 Sekunden zwischen API-Calls (weniger aggressiv)
		const batchSize = 5; // Verarbeite nur 5 Aircraft parallel

		// Filtere Aircraft - nur die ersten 20 um API-Kosten zu sparen
		const limitedRegistrations = aircraftRegistrations.slice(0, 20);

		console.log(
			`🚀 VEREINFACHTE API-Abfrage: ${limitedRegistrations.length} Aircraft für ${currentDate} in ${airportCode}`
		);
		console.log(
			`💰 Geschätzte API-Calls: ${limitedRegistrations.length} für Tag 1 + bis zu ${limitedRegistrations.length} für Folgetag-Vervollständigung`
		);

		// Verarbeite in kleineren Batches
		for (let i = 0; i < limitedRegistrations.length; i += batchSize) {
			const batch = limitedRegistrations.slice(i, i + batchSize);

			console.log(
				`📦 Verarbeite Batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(
					limitedRegistrations.length / batchSize
				)}: ${batch.join(", ")}`
			);

			// Batch parallel verarbeiten
			const batchPromises = batch.map(async (registration, index) => {
				try {
					// Status-Update
					this.updateStatus(
						`Batch ${Math.floor(i / batchSize) + 1}: ${registration}...`
					);

					console.log(`� API-Abfrage: ${registration} am ${currentDate}`);

					// NUR HEUTE: Eine API-Abfrage pro Aircraft
					const todayFlights = await this.fetchAircraftFlights(
						registration,
						currentDate
					);

					// VEREINFACHTE LOGIK: Analysiere nur heutigen Tag
					const overnightData = this.analyzeSimpleOvernight(
						registration,
						todayFlights,
						currentDate,
						airportCode
					);

					if (overnightData) {
						console.log(`✅ Übernachtung identifiziert: ${registration}`);
						return overnightData;
					}

					return null;
				} catch (error) {
					console.error(`❌ Fehler bei ${registration}:`, error);
					return null;
				}
			});

			// Warte auf Batch-Completion
			const batchResults = await Promise.all(batchPromises);

			// Sammle Ergebnisse
			batchResults.forEach((result) => {
				if (result) {
					overnightFlights.push(result);
				}
			});

			// Rate Limiting zwischen Batches (nicht zwischen einzelnen Aircraft)
			if (i + batchSize < limitedRegistrations.length) {
				console.log(`⏳ Warte ${rateLimitDelay / 1000}s vor nächstem Batch...`);
				await new Promise((resolve) => setTimeout(resolve, rateLimitDelay));
			}
		}

		console.log(
			`🏁 VEREINFACHTE Abfrage abgeschlossen: ${overnightFlights.length} Übernachtungen von ${limitedRegistrations.length} Aircraft`
		);
		console.log(`💰 API-Calls verwendet: ${limitedRegistrations.length}`);

		// VERBESSERUNG: Für alle gefundenen Übernachtungs-Aircraft den Folgetag abfragen
		if (overnightFlights.length > 0) {
			console.log(
				`🔄 Erweitere Übernachtungsdaten mit Folgetag-Informationen...`
			);
			await this.enhanceOvernightFlightsWithNextDay(
				overnightFlights,
				nextDate,
				airportCode
			);
		}

		return overnightFlights;
	}

	/**
	 * Erweitert Übernachtungsdaten mit Folgetag-Informationen
	 * @param {Array} overnightFlights - Array mit gefundenen Übernachtungsflügen
	 * @param {string} nextDate - Folgetag (YYYY-MM-DD)
	 * @param {string} airportCode - Zielflughafen
	 */
	async enhanceOvernightFlightsWithNextDay(
		overnightFlights,
		nextDate,
		airportCode
	) {
		const rateLimitDelay = 1500; // Etwas schneller da weniger Aircraft

		console.log(
			`🌅 Erweitere ${overnightFlights.length} Übernachtungen mit Folgetag-Daten für ${nextDate}`
		);

		for (let i = 0; i < overnightFlights.length; i++) {
			const flight = overnightFlights[i];
			const registration = flight.registration;

			try {
				console.log(`📅 Folgetag-Abfrage: ${registration} am ${nextDate}`);

				// Hole Flugdaten für den Folgetag
				const nextDayFlights = await this.fetchAircraftFlights(
					registration,
					nextDate
				);

				if (nextDayFlights && nextDayFlights.length > 0) {
					// Finde ersten Abflug von der aktuellen Station
					const departuresFromStation = nextDayFlights.filter(
						(nextFlight) =>
							nextFlight.departure?.airport?.iata === airportCode ||
							nextFlight.departure?.airport?.icao === airportCode
					);

					console.log(
						`🔍 DEBUG ${registration}: ${departuresFromStation.length} Abflüge von ${airportCode} am ${nextDate}`
					);

					if (departuresFromStation.length > 0) {
						// Sortiere nach Zeit - nehme den frühesten Abflug
						const firstDeparture = departuresFromStation.sort(
							(a, b) =>
								new Date(a.departure?.scheduledTime?.utc || 0) -
								new Date(b.departure?.scheduledTime?.utc || 0)
						)[0];

						// Aktualisiere die Übernachtungsdaten
						flight.departure = {
							from: airportCode,
							to:
								firstDeparture.arrival?.airport?.iata ||
								firstDeparture.arrival?.airport?.icao ||
								"---",
							time: this.formatTime(
								firstDeparture.departure?.scheduledTime?.utc
							),
							date: nextDate,
							flightNumber: firstDeparture.number || "",
						};

						// Aktualisiere Route
						flight.route = `${flight.arrival.from} → ${flight.departure.to}`;

						// Berechne Übernachtungsdauer
						if (flight.arrival.time && flight.departure.time) {
							flight.overnightDuration = this.calculateOvernightDuration(
								flight.arrival.date + "T" + flight.arrival.time + ":00Z",
								flight.departure.date + "T" + flight.departure.time + ":00Z"
							);
						}

						console.log(
							`✅ ${registration}: Folgetag-Daten ergänzt - Abflug ${flight.departure.time} nach ${flight.departure.to}`
						);
					} else {
						console.log(
							`⚠️ ${registration}: Kein Abflug von ${airportCode} am ${nextDate} gefunden`
						);
					}
				} else {
					console.log(`⚠️ ${registration}: Keine Flugdaten für ${nextDate}`);
				}

				// Rate Limiting zwischen Abfragen
				if (i < overnightFlights.length - 1) {
					await new Promise((resolve) => setTimeout(resolve, rateLimitDelay));
				}
			} catch (error) {
				console.error(
					`❌ Fehler bei Folgetag-Abfrage für ${registration}:`,
					error
				);
				// Setze Fehlerstatus aber fahre fort
				flight.departure.time = "Error";
				flight.departure.flightNumber = "API Error";
			}
		}

		console.log(
			`🏁 Folgetag-Erweiterung abgeschlossen: ${overnightFlights.length} Aircraft aktualisiert`
		);
	}

	/**
	 * VEREINFACHTE Übernachtungsanalyse - nur heutiger Tag
	 * @param {string} registration - Aircraft Registration
	 * @param {Array} todayFlights - Flüge von heute
	 * @param {string} currentDate - Heutiges Datum
	 * @param {string} airportCode - Zielflughafen
	 * @returns {Object|null} Übernachtungsdaten oder null
	 */
	analyzeSimpleOvernight(registration, todayFlights, currentDate, airportCode) {
		if (!todayFlights || todayFlights.length === 0) {
			console.log(`⚠️ ${registration}: Keine Flugdaten für ${currentDate}`);
			return null;
		}

		console.log(
			`🔍 DEBUG ${registration}: Analysiere ${todayFlights.length} Flüge für ${currentDate}`
		);

		// Finde ALLE Ankünfte in der Zielstation heute
		const arrivalsToday = todayFlights.filter(
			(flight) =>
				flight.arrival?.airport?.iata === airportCode ||
				flight.arrival?.airport?.icao === airportCode
		);

		console.log(
			`🔍 DEBUG ${registration}: ${arrivalsToday.length} Ankünfte in ${airportCode} gefunden`
		);
		arrivalsToday.forEach((flight) => {
			console.log(
				`   📥 Ankunft: ${flight.arrival?.scheduledTime?.utc} ${flight.number} von ${flight.departure?.airport?.iata}`
			);
		});

		if (arrivalsToday.length === 0) {
			console.log(`❌ ${registration}: Keine Ankünfte in ${airportCode}`);
			return null; // Keine Ankünfte in Zielstation
		}

		// Finde ALLE Abflüge von der Zielstation heute
		const departuresFromStation = todayFlights.filter(
			(flight) =>
				flight.departure?.airport?.iata === airportCode ||
				flight.departure?.airport?.icao === airportCode
		);

		console.log(
			`🔍 DEBUG ${registration}: ${departuresFromStation.length} Abflüge von ${airportCode} gefunden`
		);
		departuresFromStation.forEach((flight) => {
			console.log(
				`   📤 Abflug: ${flight.departure?.scheduledTime?.utc} ${flight.number} nach ${flight.arrival?.airport?.iata}`
			);
		});

		// Sortiere Ankünfte nach Zeit (letzte zuerst) - KORRIGIERT: Kopiere Array zuerst
		const sortedArrivals = [...arrivalsToday].sort((a, b) => {
			const timeA = a.arrival?.scheduledTime?.utc;
			const timeB = b.arrival?.scheduledTime?.utc;

			// Robuste Null/Undefined-Behandlung
			if (!timeA && !timeB) return 0;
			if (!timeA) return 1; // A nach hinten
			if (!timeB) return -1; // B nach hinten

			return new Date(timeB) - new Date(timeA); // Neueste zuerst
		});

		const lastArrival = sortedArrivals[0];

		if (!lastArrival || !lastArrival.arrival?.scheduledTime?.utc) {
			console.log(
				`⚠️ Keine gültige letzte Ankunft für ${registration} in ${airportCode}`
			);
			return null;
		}

		// VEREINFACHTE REGEL:
		// Hat Aircraft heute Ankunft in Station UND keine Abflüge danach? → Übernachtung
		const lastArrivalTime = new Date(lastArrival.arrival.scheduledTime.utc);

		console.log(
			`🔍 DEBUG ${registration}: Letzte Ankunft in ${airportCode}: ${lastArrival.arrival.scheduledTime.utc} (${lastArrival.number})`
		);

		// Prüfe ob es Abflüge NACH der letzten Ankunft gibt
		const departuresAfterArrival = departuresFromStation.filter((flight) => {
			const depTime = new Date(flight.departure?.scheduledTime?.utc);
			const isAfterArrival = depTime > lastArrivalTime;

			if (isAfterArrival) {
				console.log(
					`🔍 DEBUG ${registration}: Abflug NACH letzter Ankunft gefunden: ${flight.departure.scheduledTime.utc} (${flight.number})`
				);
			}

			return isAfterArrival;
		});

		console.log(
			`🔍 DEBUG ${registration}: ${departuresAfterArrival.length} Abflüge nach letzter Ankunft`
		);

		// ÜBERNACHTUNG = Letzte Ankunft in Station + keine weiteren Abflüge heute
		if (departuresAfterArrival.length === 0) {
			console.log(
				`🌙 ÜBERNACHTUNG BESTÄTIGT: ${registration} übernachtet in ${airportCode}`
			);
			console.log(
				`   ✅ Letzte Ankunft: ${lastArrival.arrival.scheduledTime.utc} ${lastArrival.number}`
			);
			console.log(`   ✅ Keine weiteren Abflüge heute gefunden`);

			return {
				registration: registration,
				aircraftType: lastArrival.aircraft?.model || "Unknown",
				airline: {
					name: lastArrival.airline?.name || "",
					iata: lastArrival.airline?.iata || "",
					icao: lastArrival.airline?.icao || "",
				},
				arrival: {
					from:
						lastArrival.departure?.airport?.iata ||
						lastArrival.departure?.airport?.icao ||
						"",
					to: airportCode,
					time: this.formatTime(lastArrival.arrival?.scheduledTime?.utc),
					date: currentDate,
					flightNumber: lastArrival.number || "",
				},
				departure: {
					from: airportCode,
					to: "---", // Unbekannt da nur heute analysiert
					time: "---", // Unbekannt da nur heute analysiert
					date: "---",
					flightNumber: "---",
				},
				route: `${
					lastArrival.departure?.airport?.iata || "---"
				} → ${airportCode} (overnight)`,
				overnightDuration: "tbd", // Wird morgen bestimmt
				position: "--",
			};
		} else {
			console.log(
				`❌ KEINE ÜBERNACHTUNG: ${registration} in ${airportCode} - ${departuresAfterArrival.length} Abflüge nach letzter Ankunft`
			);
		}

		return null; // Keine Übernachtung
	}

	/**
	 * Holt Flugdaten für eine Aircraft Registration an einem bestimmten Tag
	 * @param {string} registration - Aircraft Registration (z.B. "D-ACNP")
	 * @param {string} date - Datum (YYYY-MM-DD)
	 * @returns {Promise<Array>} Array mit Flugdaten
	 */
	async fetchAircraftFlights(registration, date) {
		try {
			const apiUrl = `https://aerodatabox.p.rapidapi.com/flights/reg/${registration}/${date}?withAircraftImage=false&withLocation=false&dateLocalRole=Both`;

			const response = await fetch(apiUrl, {
				method: "GET",
				headers: {
					"x-rapidapi-key":
						"b76afbf516mshf864818d919de86p10475ejsna65b718a8602",
					"x-rapidapi-host": "aerodatabox.p.rapidapi.com",
				},
			});

			if (!response.ok) {
				throw new Error(
					`API-Fehler: ${response.status} ${response.statusText}`
				);
			}

			const data = await response.json();

			// Stelle sicher, dass wir ein Array zurückgeben
			return Array.isArray(data) ? data : data ? [data] : [];
		} catch (error) {
			console.error(
				`❌ API-Abfrage für ${registration} am ${date} fehlgeschlagen:`,
				error
			);
			return [];
		}
	}

	/**
	 * Analysiert ob Aircraft einen Übernachtungsflug hat
	 * @param {string} registration - Aircraft Registration
	 * @param {Array} day1Flights - Flüge Tag 1
	 * @param {Array} day2Flights - Flüge Tag 2
	 * @param {string} currentDate - Aktuelles Datum
	 * @param {string} nextDate - Folgetag
	 * @param {string} airportCode - Zielflughafen
	 * @returns {Object|null} Übernachtungsdaten oder null
	 */
	analyzeOvernightFlight(
		registration,
		day1Flights,
		day2Flights,
		currentDate,
		nextDate,
		airportCode
	) {
		// Finde letzte Ankunft am Tag 1 in airportCode
		const day1Arrivals = day1Flights.filter(
			(flight) =>
				flight.arrival?.airport?.iata === airportCode ||
				flight.arrival?.airport?.icao === airportCode
		);

		// Finde ersten Abflug am Tag 2 von airportCode
		const day2Departures = day2Flights.filter(
			(flight) =>
				flight.departure?.airport?.iata === airportCode ||
				flight.departure?.airport?.icao === airportCode
		);

		// Sortiere Ankünfte Tag 1 nach Zeit (letzte zuerst)
		const lastArrival = day1Arrivals.sort(
			(a, b) =>
				new Date(b.arrival?.scheduledTime?.utc || 0) -
				new Date(a.arrival?.scheduledTime?.utc || 0)
		)[0];

		// Sortiere Abflüge Tag 2 nach Zeit (erste zuerst)
		const firstDeparture = day2Departures.sort(
			(a, b) =>
				new Date(a.departure?.scheduledTime?.utc || 0) -
				new Date(b.departure?.scheduledTime?.utc || 0)
		)[0];

		// Prüfe ob Übernachtung vorliegt
		if (lastArrival && firstDeparture) {
			// Prüfe ob es weitere Abflüge am Tag 1 nach der letzten Ankunft gibt
			const arrivalTime = new Date(lastArrival.arrival?.scheduledTime?.utc);
			const laterDepartures = day1Flights.filter((flight) => {
				const depTime = new Date(flight.departure?.scheduledTime?.utc);
				return (
					depTime > arrivalTime &&
					(flight.departure?.airport?.iata === airportCode ||
						flight.departure?.airport?.icao === airportCode)
				);
			});

			// Übernachtung nur wenn keine weiteren Abflüge am Tag 1
			if (laterDepartures.length === 0) {
				console.log(`🌙 Übernachtung bestätigt für ${registration}:`);
				console.log(
					`   Ankunft: ${lastArrival.arrival?.scheduledTime?.utc} ${lastArrival.number}`
				);
				console.log(
					`   Abflug:  ${firstDeparture.departure?.scheduledTime?.utc} ${firstDeparture.number}`
				);

				return {
					registration: registration,
					aircraftType:
						lastArrival.aircraft?.model ||
						firstDeparture.aircraft?.model ||
						"Unknown",
					airline: {
						name:
							lastArrival.airline?.name || firstDeparture.airline?.name || "",
						iata:
							lastArrival.airline?.iata || firstDeparture.airline?.iata || "",
						icao:
							lastArrival.airline?.icao || firstDeparture.airline?.icao || "",
					},
					arrival: {
						from:
							lastArrival.departure?.airport?.iata ||
							lastArrival.departure?.airport?.icao ||
							"",
						to: airportCode,
						time: this.formatTime(lastArrival.arrival?.scheduledTime?.utc),
						date: currentDate,
						flightNumber: lastArrival.number || "",
					},
					departure: {
						from: airportCode,
						to:
							firstDeparture.arrival?.airport?.iata ||
							firstDeparture.arrival?.airport?.icao ||
							"",
						time: this.formatTime(firstDeparture.departure?.scheduledTime?.utc),
						date: nextDate,
						flightNumber: firstDeparture.number || "",
					},
					route: `${lastArrival.departure?.airport?.iata || ""} → ${
						firstDeparture.arrival?.airport?.iata || ""
					}`,
					overnightDuration: this.calculateOvernightDuration(
						lastArrival.arrival?.scheduledTime?.utc,
						firstDeparture.departure?.scheduledTime?.utc
					),
					position: "--", // Position wird später gesetzt oder über andere Logik ermittelt
				};
			}
		}

		return null;
	}

	/**
	 * Formatiert ISO-Zeit zu HH:MM
	 * @param {string} isoTime - ISO Zeitstring
	 * @returns {string} Formatierte Zeit
	 */
	formatTime(isoTime) {
		if (!isoTime) return "--:--";
		try {
			return isoTime.substring(11, 16); // Extrahiere HH:MM aus ISO-String
		} catch (error) {
			return "--:--";
		}
	}

	/**
	 * Berechnet Übernachtungsdauer zwischen zwei Zeiten
	 * @param {string} arrivalTime - Ankunftszeit (ISO oder kombiniert)
	 * @param {string} departureTime - Abflugzeit (ISO oder kombiniert)
	 * @returns {string} Formatierte Dauer
	 */
	calculateOvernightDuration(arrivalTime, departureTime) {
		try {
			// Flexibles Parsing für verschiedene Zeitformate
			let arrival, departure;

			if (arrivalTime.includes("T")) {
				// ISO Format: 2025-08-03T14:30:00Z
				arrival = new Date(arrivalTime);
			} else {
				// Legacy format fallback
				arrival = new Date(arrivalTime);
			}

			if (departureTime.includes("T")) {
				// ISO Format: 2025-08-04T08:15:00Z
				departure = new Date(departureTime);
			} else {
				// Legacy format fallback
				departure = new Date(departureTime);
			}

			if (isNaN(arrival.getTime()) || isNaN(departure.getTime())) {
				console.log(
					`⚠️ Ungültige Zeiten für Dauer-Berechnung: ${arrivalTime} → ${departureTime}`
				);
				return "n/a";
			}

			const diffMs = departure - arrival;
			const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
			const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

			// Verhindere negative Dauern
			if (diffHours < 0) {
				return "n/a";
			}

			return `${diffHours}h ${diffMinutes}m`;
		} catch (error) {
			console.error("Fehler bei Dauer-Berechnung:", error);
			return "n/a";
		}
	}

	/**
	 * Hilfsfunktion für Status-Updates während der Verarbeitung
	 * @param {string} message - Status-Nachricht
	 */
	updateStatus(message) {
		console.log(`📊 ${message}`);

		// Optional: Update UI status element
		const statusElement = document.getElementById("fetchStatus");
		if (statusElement) {
			statusElement.textContent = message;
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

		// KORRIGIERT: Verwende echte Airline-Daten aus der API-Antwort
		let airline = "---";
		let airlineDisplay = "---";

		// DEBUG: Zeige verfügbare Airline-Daten
		console.log(`🔍 DEBUG Flight Airline Data:`, flight.airline);

		// Priorität 1: Verwende echte Airline-Daten aus der JSON-API-Antwort
		if (flight.airline) {
			if (flight.airline.name) {
				// Vollständiger Airline-Name verfügbar - verwende diesen
				airline = flight.airline.name;
				airlineDisplay = flight.airline.name;
				console.log(`✈️ Airline aus API-Name: ${airlineDisplay}`);
			} else if (flight.airline.iata) {
				// Nur IATA-Code verfügbar - konvertiere zu Vollname falls möglich
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
					KM: "Air Malta",
					SN: "Brussels Airlines",
					TP: "TAP Air Portugal",
					FR: "Ryanair",
					U2: "easyJet",
					W6: "Wizz Air",
					VY: "Vueling",
				};

				airline = flight.airline.iata;
				airlineDisplay =
					airlineMapping[flight.airline.iata] || flight.airline.iata;
				console.log(
					`✈️ Airline aus API-IATA: ${airlineDisplay} (${flight.airline.iata})`
				);
			}
		}

		// Fallback: Extrahiere aus Flight Number (nur wenn keine API-Daten vorhanden)
		if (airline === "---") {
			const flightNumber =
				flight.arrival?.flightNumber || flight.departure?.flightNumber || "";
			if (flightNumber) {
				const match = flightNumber.match(/([A-Z]{2})\d+/);
				if (match) {
					const airlineCode = match[1];
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
						KM: "Air Malta",
						SN: "Brussels Airlines",
						TP: "TAP Air Portugal",
						FR: "Ryanair",
						U2: "easyJet",
						W6: "Wizz Air",
						VY: "Vueling",
					};
					airline = airlineCode;
					airlineDisplay = airlineMapping[airlineCode] || airlineCode;
					console.log(
						`✈️ Airline aus Flight Number Fallback: ${airlineDisplay} (${airlineCode})`
					);
				}
			}
		}

		console.log(`🏷️ Final Airline Display: ${airlineDisplay}`);

		return `
			<tr class="hover:bg-gray-50 transition-colors duration-150">
				<td class="px-4 py-3 text-sm text-gray-900 font-medium">${position}</td>
				<td class="px-4 py-3 text-sm text-gray-900 font-medium">${
					flight.registration
				}</td>
				<td class="px-4 py-3">
					<span class="timetable-airline" style="font-weight: 500; color: #2563eb; background-color: #eff6ff; padding: 2px 6px; border-radius: 4px; font-size: 0.875rem;">
						${airlineDisplay}
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

// Debug-Funktion für Fleet Database-basierte Timetable
window.debugFleetTimetable = async function () {
	console.log("🧪 === DEBUG: Fleet Database-basierte Timetable ===");

	try {
		// Prüfe Fleet Database Manager
		if (!window.fleetDatabaseManager) {
			console.error("❌ Fleet Database Manager nicht verfügbar");
			return;
		}

		// Warte auf Initialisierung
		await window.fleetDatabaseManager.waitForInitialization();

		// Hole Fleet Daten
		const aircrafts = window.fleetDatabaseManager.getAllAircrafts();
		console.log(`📋 ${aircrafts.length} Aircraft Registrations verfügbar`);

		// Zeige erste 5 Registrations
		const sample = aircrafts.slice(0, 5).map((a) => a.registration);
		console.log("🔍 Beispiel-Registrations:", sample);

		// Teste Timetable Manager
		if (window.TimetableAPIManager) {
			console.log("🕐 Starte Fleet Database-basierte Timetable-Erstellung...");
			await window.TimetableAPIManager.forceRefreshTimetable();
			console.log("✅ Timetable-Test abgeschlossen");
		} else {
			console.error("❌ TimetableAPIManager nicht verfügbar");
		}
	} catch (error) {
		console.error("❌ Fehler beim Fleet Timetable Debug:", error);
	}
};

// Debug-Funktion für Fleet Database-basierte Timetable
window.debugFleetTimetable = async function () {
	console.log("🧪 === DEBUG: Fleet Database-basierte Timetable ===");

	try {
		// Prüfe Fleet Database Manager
		if (!window.fleetDatabaseManager) {
			console.error("❌ Fleet Database Manager nicht verfügbar");
			return;
		}

		// Warte auf Initialisierung
		await window.fleetDatabaseManager.waitForInitialization();

		// Hole Fleet Daten
		const aircrafts = window.fleetDatabaseManager.getAllAircrafts();
		console.log(`📋 ${aircrafts.length} Aircraft Registrations verfügbar`);

		// Zeige erste 5 Registrations
		const sample = aircrafts.slice(0, 5).map((a) => a.registration);
		console.log("🔍 Beispiel-Registrations:", sample);

		// Teste Timetable Manager
		if (window.TimetableAPIManager) {
			console.log("🕐 Starte Fleet Database-basierte Timetable-Erstellung...");
			await window.TimetableAPIManager.forceRefreshTimetable();
			console.log("✅ Timetable-Test abgeschlossen");
		} else {
			console.error("❌ TimetableAPIManager nicht verfügbar");
		}
	} catch (error) {
		console.error("❌ Fehler beim Fleet Timetable Debug:", error);
	}
};

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
console.log("🛠️ Debug-Funktion verfügbar: debugFleetTimetable()");
console.log("🛠️ Debug-Funktion verfügbar: debugFleetTimetable()");
