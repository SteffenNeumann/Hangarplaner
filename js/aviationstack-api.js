/**
 * Aviationstack API Integration
 * Implementierung für zukünftige Flugdaten mit Flugzeugregistrierung-Suche
 * Optimal für Übernachtungslogik mit future flight data
 *
 * API Features:
 * - Dedicated /flightsFuture endpoint für zukünftige Flüge
 * - Aircraft registration search (aircraft_iata parameter)
 * - Bis zu 7 Tage im Voraus
 * - Sehr kostengünstig ($10-50/Monat)
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

		console.log("✅ Aviationstack API initialisiert");
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
	 * Zukünftige Flüge abrufen (Hauptfunktion für Übernachtungslogik)
	 */
	async getFutureFlights(aircraftRegistration, options = {}) {
		try {
			const params = {
				aircraft_iata: aircraftRegistration.toUpperCase(),
			};

			// Optionale Parameter hinzufügen
			if (options.flight_date) {
				params.flight_date = options.flight_date;
			}

			if (options.dep_iata) {
				params.dep_iata = options.dep_iata.toUpperCase();
			}

			if (options.arr_iata) {
				params.arr_iata = options.arr_iata.toUpperCase();
			}

			if (options.limit) {
				params.limit = Math.min(options.limit, 100); // Max 100 per request
			}

			const response = await this.makeRequest("flightsFuture", params);

			if (!response.data || response.data.length === 0) {
				console.log(
					`⚠️ Keine zukünftigen Flüge für ${aircraftRegistration} gefunden`
				);
				return [];
			}

			return this.formatFlightData(response.data);
		} catch (error) {
			console.error(
				`❌ Fehler beim Abrufen zukünftiger Flüge für ${aircraftRegistration}:`,
				error
			);
			throw error;
		}
	}

	/**
	 * Aktuelle/historische Flüge abrufen
	 */
	async getCurrentFlights(aircraftRegistration, options = {}) {
		try {
			const params = {
				aircraft_iata: aircraftRegistration.toUpperCase(),
			};

			// Optionale Parameter hinzufügen
			if (options.flight_date) {
				params.flight_date = options.flight_date;
			}

			if (options.flight_status) {
				params.flight_status = options.flight_status; // active, scheduled, landed, cancelled, etc.
			}

			const response = await this.makeRequest("flights", params);

			if (!response.data || response.data.length === 0) {
				console.log(
					`⚠️ Keine aktuellen Flüge für ${aircraftRegistration} gefunden`
				);
				return [];
			}

			return this.formatFlightData(response.data);
		} catch (error) {
			console.error(
				`❌ Fehler beim Abrufen aktueller Flüge für ${aircraftRegistration}:`,
				error
			);
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
	 * Übernachtungslogik: Flüge für heute und morgen
	 */
	async getOvernightFlights(aircraftRegistration, airportCode = null) {
		try {
			console.log(
				`🌙 Übernachtungslogik für ${aircraftRegistration} gestartet`
			);

			const today = new Date();
			const tomorrow = new Date(today);
			tomorrow.setDate(tomorrow.getDate() + 1);

			const todayStr = today.toISOString().split("T")[0];
			const tomorrowStr = tomorrow.toISOString().split("T")[0];

			const results = {
				aircraft: aircraftRegistration,
				today: [],
				tomorrow: [],
				overnight: false,
			};

			// Heutige Flüge (letzter Flug)
			try {
				const todayFlights = await this.getCurrentFlights(
					aircraftRegistration,
					{
						flight_date: todayStr,
					}
				);
				results.today = todayFlights;
			} catch (error) {
				console.warn(
					`⚠️ Keine heutigen Flüge für ${aircraftRegistration}:`,
					error.message
				);
			}

			// Morgige Flüge (erster Flug)
			try {
				const tomorrowFlights = await this.getFutureFlights(
					aircraftRegistration,
					{
						flight_date: tomorrowStr,
					}
				);
				results.tomorrow = tomorrowFlights;
			} catch (error) {
				console.warn(
					`⚠️ Keine morgigen Flüge für ${aircraftRegistration}:`,
					error.message
				);
			}

			// Übernachtungslogik prüfen
			if (results.today.length > 0 && results.tomorrow.length > 0) {
				const lastToday = results.today[results.today.length - 1];
				const firstTomorrow = results.tomorrow[0];

				if (lastToday && firstTomorrow) {
					results.overnight = true;
					results.lastArrival = lastToday.arrival;
					results.nextDeparture = firstTomorrow.departure;

					console.log(`✅ Übernachtung erkannt: ${aircraftRegistration}`);
					console.log(
						`   Letzter Flug heute: ${lastToday.arrival?.airport} um ${lastToday.arrival?.scheduled}`
					);
					console.log(
						`   Erster Flug morgen: ${firstTomorrow.departure?.airport} um ${firstTomorrow.departure?.scheduled}`
					);
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
	 * API-Test-Funktion
	 */
	async testAPI(aircraftRegistration = "D-AIBL") {
		try {
			console.log(`🧪 Teste Aviationstack API mit ${aircraftRegistration}`);

			const tomorrow = new Date();
			tomorrow.setDate(tomorrow.getDate() + 1);
			const tomorrowStr = tomorrow.toISOString().split("T")[0];

			// Test zukünftige Flüge
			const futureFlights = await this.getFutureFlights(aircraftRegistration, {
				flight_date: tomorrowStr,
				limit: 5,
			});

			console.log(
				`✅ API-Test erfolgreich: ${futureFlights.length} zukünftige Flüge gefunden`
			);

			return {
				success: true,
				api: "Aviationstack",
				aircraft: aircraftRegistration,
				futureFlights: futureFlights.length,
				data: futureFlights.slice(0, 3), // Erste 3 Flüge
			};
		} catch (error) {
			console.error("❌ API-Test fehlgeschlagen:", error);
			return {
				success: false,
				api: "Aviationstack",
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
