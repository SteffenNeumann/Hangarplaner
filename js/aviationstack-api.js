/**
 * Aviationstack API Integration
 * AKTUELL: Free-Plan Modus mit Flughafen-basierter Suche
 * UPGRADE: Basic-Plan ($10/Monat) für volle Aircraft-Registrierung-Funktionalität
 *
 * Free-Plan Features:
 * - Flughafen-basierte Suche (dep_iata, arr_iata)
 * - Standard /flights endpoint
 * - 500 Requests/Monat
 *
 * Basic-Plan Features (bei zukünftigem Upgrade):
 * - Aircraft registration search (aircraft_iata parameter) ✅
 * - Dedicated /flightsFuture endpoint für zukünftige Flüge ✅
 * - Bis zu 7 Tage im Voraus ✅
 * - 5.000 Requests/Monat ✅
 * - Perfekte Übernachtungslogik ✅
 *
 * Erstellt: August 2025
 */

class AviationstackAPI {
	constructor() {
		this.name = "Aviationstack API";
		this.version = "1.0.0";
		this.baseUrl = "sync/aviationstack-proxy.php";
		this.rateLimit = {
			requestsPerMinute: 100,
			requests: [],
			lastReset: Date.now(),
		};

		// Plan-Konfiguration (einfaches Upgrade durch Änderung auf 'basic')
		this.plan = "free"; // 'free' oder 'basic'
		this.features = {
			aircraftSearch: this.plan === "basic", // aircraft_iata Parameter
			futureEndpoint: this.plan === "basic", // /flightsFuture endpoint
			fullAircraftData: this.plan === "basic", // Vollständige aircraft Daten
		};

		console.log(
			`✅ Aviationstack API initialisiert (${this.plan.toUpperCase()}-Plan)`
		);
		if (this.plan === "free") {
			console.log(
				`💡 Upgrade auf Basic-Plan ($10/Monat) für volle Funktionalität verfügbar`
			);
		}
	}

	/**
	 * Rate Limiting prüfen
	 */
	checkRateLimit() {
		const now = Date.now();
		const oneMinuteAgo = now - 60000;

		// Alte Requests entfernen
		this.rateLimit.requests = this.rateLimit.requests.filter(
			(time) => time > oneMinuteAgo
		);

		if (this.rateLimit.requests.length >= this.rateLimit.requestsPerMinute) {
			throw new Error(
				`Rate limit exceeded: ${this.rateLimit.requestsPerMinute} requests per minute`
			);
		}

		this.rateLimit.requests.push(now);
		return true;
	}

	/**
	 * Generische API-Anfrage
	 */
	async makeRequest(endpoint, params = {}) {
		try {
			this.checkRateLimit();

			const queryParams = new URLSearchParams({
				endpoint: endpoint,
				...params,
			});

			const url = `${this.baseUrl}?${queryParams}`;

			console.log(`🌐 Aviationstack API Request: ${endpoint}`, params);

			const response = await fetch(url, {
				method: "GET",
				headers: {
					Accept: "application/json",
					"Content-Type": "application/json",
				},
			});

			if (!response.ok) {
				throw new Error(`HTTP ${response.status}: ${response.statusText}`);
			}

			const data = await response.json();

			if (data.error) {
				throw new Error(`API Error: ${data.error.message || data.error}`);
			}

			console.log(`✅ Aviationstack API Response:`, data);
			return data;
		} catch (error) {
			console.error("❌ Aviationstack API Fehler:", error);
			throw error;
		}
	}

	/**
	 * Zukünftige Flüge abrufen (Flughafen-basiert - Free Plan kompatibel)
	 */
	async getFutureFlights(aircraftRegistration, options = {}) {
		try {
			console.log(
				`⚠️ HINWEIS: Free-Plan unterstützt keine Aircraft-Registrierung-Suche`
			);
			console.log(`🔄 Verwende Flughafen-basierte Suche stattdessen`);

			// Free-Plan: Verwende Flughafen-Parameter statt aircraft_iata
			const params = {};

			// Optionale Parameter hinzufügen
			if (options.flight_date) {
				params.flight_date = options.flight_date;
			}

			if (options.dep_iata) {
				params.dep_iata = options.dep_iata.toUpperCase();
			} else if (options.arr_iata) {
				params.arr_iata = options.arr_iata.toUpperCase();
			} else {
				// Fallback: Standard-Flughafen verwenden
				params.dep_iata = "MUC"; // München als Standard
			}

			if (options.limit) {
				params.limit = Math.min(options.limit, 100); // Max 100 per request
			}

			// Verwende Standard-Endpoint da flightsFuture eventuell auch kostenpflichtig ist
			const response = await this.makeRequest("flights", params);

			if (!response.data || response.data.length === 0) {
				console.log(`⚠️ Keine Flüge für die angegebenen Parameter gefunden`);
				return [];
			}

			// Filtere nach Aircraft-Registrierung falls verfügbar (wird meist null sein)
			let filteredFlights = response.data;
			if (aircraftRegistration && aircraftRegistration !== "") {
				filteredFlights = response.data.filter((flight) => {
					return (
						flight.aircraft &&
						flight.aircraft.registration &&
						flight.aircraft.registration.toUpperCase() ===
							aircraftRegistration.toUpperCase()
					);
				});

				if (filteredFlights.length === 0) {
					console.log(
						`⚠️ Keine Flüge für Aircraft ${aircraftRegistration} gefunden (Free-Plan Limitation)`
					);
					// Gib alle Flüge zurück für Kontext
					console.log(`🔄 Zeige alle Flüge für den Flughafen`);
					filteredFlights = response.data;
				}
			}

			return this.formatFlightData(filteredFlights);
		} catch (error) {
			console.error(`❌ Fehler beim Abrufen von Flügen:`, error);
			throw error;
		}
	}

	/**
	 * Aktuelle/historische Flüge abrufen (Flughafen-basiert - Free Plan kompatibel)
	 */
	async getCurrentFlights(aircraftRegistration, options = {}) {
		try {
			console.log(
				`⚠️ HINWEIS: Free-Plan unterstützt keine Aircraft-Registrierung-Suche`
			);
			console.log(`🔄 Verwende Flughafen-basierte Suche stattdessen`);

			// Free-Plan: Verwende Flughafen-Parameter statt aircraft_iata
			const params = {};

			// Optionale Parameter hinzufügen
			if (options.flight_date) {
				params.flight_date = options.flight_date;
			}

			if (options.dep_iata) {
				params.dep_iata = options.dep_iata.toUpperCase();
			} else if (options.arr_iata) {
				params.arr_iata = options.arr_iata.toUpperCase();
			} else {
				// Fallback: Standard-Flughafen verwenden
				params.dep_iata = "MUC"; // München als Standard
			}

			if (options.flight_status) {
				params.flight_status = options.flight_status; // active, scheduled, landed, cancelled, etc.
			}

			const response = await this.makeRequest("flights", params);

			if (!response.data || response.data.length === 0) {
				console.log(`⚠️ Keine Flüge für die angegebenen Parameter gefunden`);
				return [];
			}

			// Filtere nach Aircraft-Registrierung falls verfügbar (wird meist null sein)
			let filteredFlights = response.data;
			if (aircraftRegistration && aircraftRegistration !== "") {
				filteredFlights = response.data.filter((flight) => {
					return (
						flight.aircraft &&
						flight.aircraft.registration &&
						flight.aircraft.registration.toUpperCase() ===
							aircraftRegistration.toUpperCase()
					);
				});

				if (filteredFlights.length === 0) {
					console.log(
						`⚠️ Keine Flüge für Aircraft ${aircraftRegistration} gefunden (Free-Plan Limitation)`
					);
					// Gib alle Flüge zurück für Kontext
					console.log(`🔄 Zeige alle Flüge für den Flughafen`);
					filteredFlights = response.data;
				}
			}

			return this.formatFlightData(filteredFlights);
		} catch (error) {
			console.error(`❌ Fehler beim Abrufen von Flügen:`, error);
			throw error;
		}
	}

	/**
	 * Flughafen-Flüge abrufen
	 */
	async getAirportFlights(airportCode, options = {}) {
		try {
			const params = {};

			if (options.type === "departure" || !options.type) {
				params.dep_iata = airportCode.toUpperCase();
			} else if (options.type === "arrival") {
				params.arr_iata = airportCode.toUpperCase();
			}

			if (options.flight_date) {
				params.flight_date = options.flight_date;
			}

			if (options.airline_iata) {
				params.airline_iata = options.airline_iata.toUpperCase();
			}

			const endpoint = options.future ? "flightsFuture" : "flights";
			const response = await this.makeRequest(endpoint, params);

			if (!response.data || response.data.length === 0) {
				console.log(`⚠️ Keine Flüge für Flughafen ${airportCode} gefunden`);
				return [];
			}

			return this.formatFlightData(response.data);
		} catch (error) {
			console.error(
				`❌ Fehler beim Abrufen der Flughafen-Flüge für ${airportCode}:`,
				error
			);
			throw error;
		}
	}

	/**
	 * Übernachtungslogik: Flüge für heute und morgen (Free-Plan angepasst)
	 */
	async getOvernightFlights(aircraftRegistration, airportCode = "MUC") {
		try {
			console.log(
				`🌙 Übernachtungslogik für ${aircraftRegistration} am Flughafen ${airportCode} gestartet`
			);
			console.log(
				`⚠️ HINWEIS: Free-Plan arbeitet flughafen-basiert, nicht flugzeug-spezifisch`
			);

			const today = new Date();
			const tomorrow = new Date(today);
			tomorrow.setDate(tomorrow.getDate() + 1);

			const todayStr = today.toISOString().split("T")[0];
			const tomorrowStr = tomorrow.toISOString().split("T")[0];

			const results = {
				aircraft: aircraftRegistration,
				airport: airportCode,
				today: [],
				tomorrow: [],
				overnight: false,
				freePlanNote: "Flughafen-basierte Suche (Free-Plan Limitation)",
			};

			// Heutige Flüge vom Flughafen (Abflüge)
			try {
				const todayFlights = await this.getCurrentFlights(
					aircraftRegistration,
					{
						flight_date: todayStr,
						dep_iata: airportCode,
					}
				);
				results.today = todayFlights;
				console.log(
					`✅ ${todayFlights.length} Flüge heute von ${airportCode} gefunden`
				);
			} catch (error) {
				console.warn(
					`⚠️ Keine heutigen Flüge von ${airportCode}:`,
					error.message
				);
			}

			// Morgige Flüge vom Flughafen (Abflüge)
			try {
				const tomorrowFlights = await this.getFutureFlights(
					aircraftRegistration,
					{
						flight_date: tomorrowStr,
						dep_iata: airportCode,
					}
				);
				results.tomorrow = tomorrowFlights;
				console.log(
					`✅ ${tomorrowFlights.length} Flüge morgen von ${airportCode} gefunden`
				);
			} catch (error) {
				console.warn(
					`⚠️ Keine morgigen Flüge von ${airportCode}:`,
					error.message
				);
			}

			// Alternative: Auch Ankünfte prüfen falls keine Abflüge
			if (results.today.length === 0) {
				try {
					console.log(`🔄 Prüfe Ankünfte für heute am ${airportCode}`);
					const todayArrivals = await this.getCurrentFlights(
						aircraftRegistration,
						{
							flight_date: todayStr,
							arr_iata: airportCode,
						}
					);
					results.today = todayArrivals;
					console.log(
						`✅ ${todayArrivals.length} Ankünfte heute am ${airportCode} gefunden`
					);
				} catch (error) {
					console.warn(
						`⚠️ Keine heutigen Ankünfte am ${airportCode}:`,
						error.message
					);
				}
			}

			if (results.tomorrow.length === 0) {
				try {
					console.log(`🔄 Prüfe Ankünfte für morgen am ${airportCode}`);
					const tomorrowArrivals = await this.getFutureFlights(
						aircraftRegistration,
						{
							flight_date: tomorrowStr,
							arr_iata: airportCode,
						}
					);
					results.tomorrow = tomorrowArrivals;
					console.log(
						`✅ ${tomorrowArrivals.length} Ankünfte morgen am ${airportCode} gefunden`
					);
				} catch (error) {
					console.warn(
						`⚠️ Keine morgigen Ankünfte am ${airportCode}:`,
						error.message
					);
				}
			}

			// Übernachtungslogik prüfen
			if (results.today.length > 0 && results.tomorrow.length > 0) {
				results.overnight = true;
				console.log(
					`✅ Flugaktivität an beiden Tagen am ${airportCode} erkannt`
				);

				// Versuche das gewünschte Flugzeug zu finden
				const aircraftTodayFlights = results.today.filter(
					(f) =>
						f.aircraft &&
						f.aircraft.registration &&
						f.aircraft.registration.toUpperCase() ===
							aircraftRegistration.toUpperCase()
				);

				const aircraftTomorrowFlights = results.tomorrow.filter(
					(f) =>
						f.aircraft &&
						f.aircraft.registration &&
						f.aircraft.registration.toUpperCase() ===
							aircraftRegistration.toUpperCase()
				);

				if (
					aircraftTodayFlights.length > 0 ||
					aircraftTomorrowFlights.length > 0
				) {
					console.log(
						`🎯 Spezifisches Flugzeug ${aircraftRegistration} gefunden!`
					);
					results.aircraftSpecific = true;
					results.aircraftTodayFlights = aircraftTodayFlights;
					results.aircraftTomorrowFlights = aircraftTomorrowFlights;
				} else {
					console.log(
						`⚠️ Spezifisches Flugzeug ${aircraftRegistration} nicht gefunden (Free-Plan Limitation)`
					);
					results.aircraftSpecific = false;
				}
			}

			return results;
		} catch (error) {
			console.error(
				`❌ Fehler bei Übernachtungslogik für ${aircraftRegistration}:`,
				error
			);
			throw error;
		}
	}

	/**
	 * Flugdaten in einheitliches Format konvertieren
	 */
	formatFlightData(rawFlights) {
		return rawFlights.map((flight) => {
			const formatted = {
				// Basis-Flugdaten
				flight_number: flight.flight?.number || "N/A",
				flight_iata: flight.flight?.iata || "N/A",
				flight_icao: flight.flight?.icao || "N/A",

				// Flugzeug-Informationen
				aircraft: {
					registration: flight.aircraft?.registration || "N/A",
					iata: flight.aircraft?.iata || "N/A",
					icao: flight.aircraft?.icao || "N/A",
				},

				// Airline-Informationen
				airline: {
					name: flight.airline?.name || "N/A",
					iata: flight.airline?.iata || "N/A",
					icao: flight.airline?.icao || "N/A",
				},

				// Abflug-Informationen
				departure: {
					airport: flight.departure?.airport || "N/A",
					iata: flight.departure?.iata || "N/A",
					icao: flight.departure?.icao || "N/A",
					scheduled: flight.departure?.scheduled || null,
					estimated: flight.departure?.estimated || null,
					actual: flight.departure?.actual || null,
					terminal: flight.departure?.terminal || null,
					gate: flight.departure?.gate || null,
				},

				// Ankunft-Informationen
				arrival: {
					airport: flight.arrival?.airport || "N/A",
					iata: flight.arrival?.iata || "N/A",
					icao: flight.arrival?.icao || "N/A",
					scheduled: flight.arrival?.scheduled || null,
					estimated: flight.arrival?.estimated || null,
					actual: flight.arrival?.actual || null,
					terminal: flight.arrival?.terminal || null,
					gate: flight.arrival?.gate || null,
				},

				// Status und Zeiten
				flight_status: flight.flight_status || "unknown",
				flight_date: flight.flight_date || null,

				// Routen-String für UI
				route: `${flight.departure?.iata || "N/A"} → ${
					flight.arrival?.iata || "N/A"
				}`,

				// Original-Daten für erweiterte Nutzung
				_raw: flight,
			};

			return formatted;
		});
	}

	/**
	 * API-Test-Funktion (Free-Plan angepasst)
	 */
	async testAPI(aircraftRegistration = "D-AIBL") {
		try {
			console.log(`🧪 Teste Aviationstack API (Free-Plan) mit Flughafen MUC`);
			console.log(
				`⚠️ Aircraft-Registrierung ${aircraftRegistration} wird gesucht, aber Free-Plan Limitations beachten`
			);

			const today = new Date();
			const todayStr = today.toISOString().split("T")[0];

			// Test mit Flughafen-Parametern
			const currentFlights = await this.getCurrentFlights(
				aircraftRegistration,
				{
					flight_date: todayStr,
					dep_iata: "MUC",
					limit: 5,
				}
			);

			console.log(
				`✅ API-Test erfolgreich: ${currentFlights.length} Flüge von MUC gefunden`
			);

			// Prüfe ob das gewünschte Flugzeug dabei ist
			const aircraftFlights = currentFlights.filter(
				(flight) =>
					flight.aircraft &&
					flight.aircraft.registration &&
					flight.aircraft.registration.toUpperCase() ===
						aircraftRegistration.toUpperCase()
			);

			return {
				success: true,
				api: "Aviationstack (Free Plan)",
				aircraft: aircraftRegistration,
				totalFlights: currentFlights.length,
				aircraftSpecificFlights: aircraftFlights.length,
				aircraftFound: aircraftFlights.length > 0,
				freePlanNote: "Aircraft registration ist im Free-Plan meist null",
				data: currentFlights.slice(0, 3), // Erste 3 Flüge
			};
		} catch (error) {
			console.error("❌ API-Test fehlgeschlagen:", error);
			return {
				success: false,
				api: "Aviationstack (Free Plan)",
				error: error.message,
			};
		}
	}

	/**
	 * API-Status und Informationen
	 */
	getAPIInfo() {
		return {
			name: this.name,
			version: this.version,
			features: [
				"Zukünftige Flugdaten (bis 7 Tage)",
				"Aircraft registration search",
				"Übernachtungslogik-Unterstützung",
				"Rate limiting (100/min)",
				"CORS-Proxy-Lösung",
			],
			endpoints: [
				"flights - Aktuelle/historische Flüge",
				"flightsFuture - Zukünftige Flüge",
				"airports - Flughafen-Informationen",
				"airlines - Airline-Informationen",
			],
			rateLimit: this.rateLimit.requestsPerMinute + " requests/minute",
		};
	}
}

// Global verfügbar machen
window.AviationstackAPI = AviationstackAPI;

// Auto-Initialisierung
if (typeof window !== "undefined") {
	window.aviationstackAPI = new AviationstackAPI();
	console.log(
		"🌟 Aviationstack API global initialisiert als window.aviationstackAPI"
	);
}

// Export für Module
if (typeof module !== "undefined" && module.exports) {
	module.exports = AviationstackAPI;
}
