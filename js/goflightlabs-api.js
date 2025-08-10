/**
 * GoFlightLabs API Integration - OPTIMIERT für Flight Data by Date
 * Spezialisiert auf das Abrufen von Flugdaten nach Flugzeugregistrierungen
 * Dokumentation: https://docs.goflightlabs.com/
 * SCHWERPUNKT: Flight Data by Date API (v2/flight) für Aircraft Registration Search
 */

const GoFlightLabsAPI = (() => {
	// API-Konfiguration
	const config = {
		name: "GoFlightLabs API",
		version: "2.0.0",
		baseUrl: "https://www.goflightlabs.com",
		apiKey:
			"eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJhdWQiOiI0IiwianRpIjoiMzJmMjI2MzQxMzBmMTIxNzAyOTg4Y2NlZmM1ZjJkZWE1MWVjOTIzZTk4MDYxNGY5MmUyMGJiMTA1YjAxNDg5ODVmNjMwYTI5MzIzMWIxMmQiLCJpYXQiOjE3NTQ4MDkwOTcsIm5iZiI6MTc1NDgwOTA5NywiZXhwIjoxNzg2MzQ1MDk3LCJzdWIiOiIyNTYyNCIsInNjb3BlcyI6W119.DzMYvJa5nnJ7qVsb0iRerfjQHhscmalgKcAnn6zCbWuwel-xmjGC_uvkQOdtI2mFi3wn3j_ovXXQ8iEvxu14cg",
		endpoints: {
			flight_by_date: "v2/flight", // PRIMÄR: Flight Data by Date (aircraft reg search)
			flights: "flights", // Real-time flights
			schedules: "advanced-flights-schedules", // Airport schedules
			historical: "historical", // Historical flights (airport-based)
			callsign: "flights-with-call-sign", // Flights with callsign
			future: "advanced-future-flights", // Future flights prediction
		},
		debugMode: true,
		rateLimitDelay: 1000, // 1 Sekunde zwischen Anfragen
		maxRetries: 3,
	};

	// Rate Limiting
	let lastApiCall = 0;
	let requestCount = 0;

	/**
	 * Initialisierung der API
	 */
	const init = (options = {}) => {
		if (options.debugMode !== undefined)
			config.debugMode = Boolean(options.debugMode);
		if (options.apiKey) config.apiKey = options.apiKey;

		if (config.debugMode) {
			console.log(`🚀 ${config.name} v${config.version} initialisiert`);
			console.log(`📡 Base URL: ${config.baseUrl}`);
			console.log(`🔑 API Key: ${config.apiKey ? "Gesetzt" : "NICHT gesetzt"}`);
		}
	};

	/**
	 * Rate Limiter für API-Aufrufe
	 */
	const rateLimiter = async (apiCall) => {
		const now = Date.now();
		const timeSinceLastCall = now - lastApiCall;

		if (timeSinceLastCall < config.rateLimitDelay) {
			const waitTime = config.rateLimitDelay - timeSinceLastCall;
			if (config.debugMode) {
				console.log(
					`⏱️ Rate Limiting: Warte ${waitTime}ms vor nächstem API-Aufruf`
				);
			}
			await new Promise((resolve) => setTimeout(resolve, waitTime));
		}

		lastApiCall = Date.now();
		requestCount++;

		if (config.debugMode) {
			console.log(`📊 API Request #${requestCount}`);
		}

		return apiCall();
	};

	/**
	 * Status-Updates in der UI
	 */
	const updateFetchStatus = (message, isError = false, statusDetails = {}) => {
		// Sidebar-Statusanzeige aktualisieren
		const fetchStatus = document.getElementById("fetchStatus");
		if (fetchStatus) {
			fetchStatus.textContent = message;
			fetchStatus.className = isError
				? "text-sm text-center text-status-red"
				: "text-sm text-center";
		}

		// Notification System verwenden
		if (window.showNotification) {
			const notificationType = isError ? "error" : "info";
			window.showNotification(message, notificationType);
		}

		// Konsole-Output
		if (config.debugMode) {
			const logMethod = isError ? console.error : console.log;
			logMethod(`[GoFlightLabs] ${message}`);
		}
	};

	/**
	 * HTTP-Request mit Retry-Logik über lokalen Proxy (OPTIMIERT)
	 */
	const makeRequest = async (endpoint, params = {}, retryCount = 0) => {
		try {
			// Verwende den optimierten Proxy
			const proxyUrl = "sync/goflightlabs-proxy.php";

			// Parameter für Proxy-Aufruf vorbereiten
			const queryParams = new URLSearchParams({
				endpoint: endpoint,
				...params,
			});

			const url = `${proxyUrl}?${queryParams}`;

			if (config.debugMode) {
				console.log(`🌐 GoFlightLabs Proxy Request: ${url}`);
				console.log(`📋 Endpoint: ${endpoint}, Params:`, params);
			}

			const response = await fetch(url, {
				method: "GET",
				headers: {
					Accept: "application/json",
					"Content-Type": "application/json",
					"User-Agent": "HangarPlanner/2.0 (GoFlightLabs Integration)",
				},
				cache: "no-cache",
			});

			if (!response.ok) {
				const errorText = await response.text();
				console.error(
					`🚫 GoFlightLabs Proxy Error (${response.status}):`,
					errorText
				);
				throw new Error(`HTTP ${response.status}: ${errorText}`);
			}

			// Response als JSON parsen
			const data = await response.json();

			if (config.debugMode) {
				console.log(`📥 GoFlightLabs Response:`, data);
			}

			// Prüfe auf API-Fehler
			if (data.error) {
				throw new Error(
					`GoFlightLabs API Error: ${data.error.message || data.error}`
				);
			}

			return data;
		} catch (error) {
			console.error(
				`❌ GoFlightLabs Request failed (Attempt ${retryCount + 1}/${
					config.maxRetries + 1
				}):`,
				error
			);

			// Retry-Logik
			if (retryCount < config.maxRetries) {
				const waitTime = (retryCount + 1) * 1000;
				console.log(`🔄 Retrying in ${waitTime}ms...`);
				await new Promise((resolve) => setTimeout(resolve, waitTime));
				return makeRequest(endpoint, params, retryCount + 1);
			}

			throw error;
		}
	};

	/**
	 * Datum formatieren (YYYY-MM-DD)
	 */
	const formatDate = (dateInput) => {
		const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
		return date.toISOString().split("T")[0];
	};

	/**
	 * Zeit formatieren (HH:MM)
	 */
	const formatTime = (timeString) => {
		if (!timeString) return "--:--";
		try {
			const date = new Date(timeString);
			return date.toISOString().substring(11, 16);
		} catch (error) {
			return "--:--";
		}
	};

	/**
	 * GoFlightLabs Daten zu einheitlichem Format konvertieren (OPTIMIERT für v2/flight)
	 */
	const convertToUnifiedFormat = (
		goFlightLabsData,
		aircraftRegistration,
		date
	) => {
		if (!goFlightLabsData || !goFlightLabsData.data) {
			return { data: [] };
		}

		const flightsArray = Array.isArray(goFlightLabsData.data)
			? goFlightLabsData.data
			: [goFlightLabsData.data];

		const formattedData = flightsArray
			.map((flight) => {
				try {
					// Flight Data by Date API Format (v2/flight)
					// Die API gibt vollständige Flugdaten mit departure/arrival Objekten zurück

					// Flughafen-Codes aus departure/arrival Objekten
					const departureIata = flight.departure?.airport?.iata || "???";
					const arrivalIata = flight.arrival?.airport?.iata || "???";

					// Zeiten formatieren (API gibt bereits lokale Zeiten)
					const departureTime = formatTime(
						flight.departure?.scheduledTime?.local
					);
					const arrivalTime = formatTime(flight.arrival?.scheduledTime?.local);

					// Airline-Informationen
					const airlineData = flight.airline || {};
					const airlineName = airlineData.name || "";
					const airlineIata = airlineData.iata || "";
					const airlineIcao = airlineData.icao || "";

					// Flugnummer
					const flightNumber = flight.number || "";

					// Aircraft-Informationen (v2/flight gibt diese direkt zurück)
					const aircraftType = flight.aircraft?.model || "Unknown";
					const registration = flight.aircraft?.reg || aircraftRegistration;

					// Datum aus scheduled time extrahieren oder fallback verwenden
					const scheduledDepartureDate = flight.departure?.scheduledTime?.local
						? new Date(flight.departure.scheduledTime.local)
								.toISOString()
								.substring(0, 10)
						: date;

					return {
						type: "DatedFlight",
						scheduledDepartureDate: scheduledDepartureDate,
						flightDesignator: {
							carrierCode: airlineIata,
							carrierName: airlineName,
							carrierIcao: airlineIcao,
							flightNumber: flightNumber,
							fullFlightNumber: flightNumber,
						},
						flightPoints: [
							{
								departurePoint: true,
								arrivalPoint: false,
								iataCode: departureIata,
								departure: {
									timings: [
										{
											qualifier: "STD",
											value: departureTime + ":00.000",
											isUtc: false, // GoFlightLabs gibt lokale Zeiten
										},
									],
								},
							},
							{
								departurePoint: false,
								arrivalPoint: true,
								iataCode: arrivalIata,
								arrival: {
									timings: [
										{
											qualifier: "STA",
											value: arrivalTime + ":00.000",
											isUtc: false, // GoFlightLabs gibt lokale Zeiten
										},
									],
								},
							},
						],
						legs: [
							{
								aircraftEquipment: {
									aircraftType: aircraftType,
								},
								aircraftRegistration: registration,
							},
						],
						_source: "goflightlabs",
						_apiVersion: "v2/flight",
						_rawFlightData: flight,
						_isUtc: false, // GoFlightLabs gibt lokale Zeiten
					};
				} catch (error) {
					console.error(
						"Fehler bei GoFlightLabs v2/flight Konvertierung:",
						error,
						flight
					);
					return null;
				}
			})
			.filter(Boolean);

		return {
			data: formattedData,
			_source: "goflightlabs",
			_apiVersion: "v2/flight",
			_totalFlights: formattedData.length,
		};
	};

	/**
	 * Flugdaten für eine Aircraft Registration abrufen (OPTIMIERT)
	 * Verwendet primär die Flight Data by Date API (v2/flight)
	 */
	const getAircraftFlights = async (aircraftRegistration, date) => {
		try {
			const registration = aircraftRegistration.trim().toUpperCase();
			const formattedDate = formatDate(date);

			updateFetchStatus(
				`GoFlightLabs: Suche Flüge für ${registration} am ${formattedDate}...`
			);

			return await rateLimiter(async () => {
				// Verwende Flight Data by Date API - EMPFOHLENE LÖSUNG
				const params = {
					search_by: "reg", // Suche nach Registrierung
					reg: registration, // Aircraft Registration
					date_from: formattedDate, // Start-Datum
					date_to: formattedDate, // End-Datum (gleicher Tag)
				};

				const response = await makeRequest("flight_by_date", params);

				const flightCount = response.data?.length || 0;
				updateFetchStatus(
					`GoFlightLabs: ${flightCount} Flüge für ${registration} am ${formattedDate} gefunden`
				);

				return convertToUnifiedFormat(response, registration, formattedDate);
			});
		} catch (error) {
			console.error(`GoFlightLabs Fehler für ${aircraftRegistration}:`, error);
			updateFetchStatus(`GoFlightLabs Fehler: ${error.message}`, true);
			return { data: [] };
		}
	};

	/**
	 * Live-Flugdaten abrufen
	 */
	const getLiveFlights = async (aircraftRegistration) => {
		try {
			const registration = aircraftRegistration.trim().toUpperCase();

			return await rateLimiter(async () => {
				const params = {
					aircraft_reg: registration,
				};

				const response = await makeRequest("flights", params);
				return convertToUnifiedFormat(
					response,
					registration,
					formatDate(new Date())
				);
			});
		} catch (error) {
			console.error(`GoFlightLabs Live-Daten Fehler:`, error);
			return { data: [] };
		}
	};

	/**
	 * Historische Flugdaten abrufen
	 */
	const getHistoricalFlights = async (
		aircraftRegistration,
		dateFrom,
		dateTo
	) => {
		try {
			const registration = aircraftRegistration.trim().toUpperCase();

			return await rateLimiter(async () => {
				const params = {
					aircraft_reg: registration,
					date_from: formatDate(dateFrom),
					date_to: formatDate(dateTo),
				};

				const response = await makeRequest("historical", params);
				return convertToUnifiedFormat(
					response,
					registration,
					formatDate(dateFrom)
				);
			});
		} catch (error) {
			console.error(`GoFlightLabs Historische Daten Fehler:`, error);
			return { data: [] };
		}
	};

	/**
	 * Aircraft-Daten für zwei Tage abrufen (Übernachtungslogik OPTIMIERT)
	 * Verwendet Flight Data by Date API für präzise Registrierungs-Suche
	 */
	const updateAircraftData = async (aircraftId, currentDate, nextDate) => {
		// Prüfung auf leere Aircraft ID
		if (!aircraftId || aircraftId.trim() === "") {
			updateFetchStatus("Keine Aircraft ID - Daten werden gelöscht", false);
			return {
				originCode: "",
				destCode: "",
				departureTime: "",
				arrivalTime: "",
				positionText: "",
				data: [],
				_isUtc: false,
				_noDataFound: true,
				_clearFields: true,
				_emptyAircraftId: true,
			};
		}

		const registration = aircraftId.trim().toUpperCase();

		// Standardwerte für Daten
		const today = formatDate(new Date());
		const tomorrow = formatDate(
			new Date(new Date().setDate(new Date().getDate() + 1))
		);

		currentDate = currentDate || today;
		nextDate = nextDate || tomorrow;

		console.log(
			`🛩️ GoFlightLabs: Suche Übernachtungsdaten für ${registration} - ${currentDate} zu ${nextDate}`
		);
		updateFetchStatus(
			`GoFlightLabs: Verarbeite ${registration} - Übernachtungslogik (v2/flight)...`
		);

		try {
			// Hole Flugdaten für beide Tage mit der optimierten API
			const [currentDayData, nextDayData] = await Promise.all([
				getAircraftFlightsByDate(registration, currentDate),
				getAircraftFlightsByDate(registration, nextDate),
			]);

			const currentDayFlights = currentDayData?.data || [];
			const nextDayFlights = nextDayData?.data || [];

			console.log(
				`📊 GoFlightLabs v2/flight: ${currentDayFlights.length} Flüge am ${currentDate}, ${nextDayFlights.length} Flüge am ${nextDate}`
			);

			// Hole aktuell gewählten Flughafen
			const selectedAirport =
				document.getElementById("airportCodeInput")?.value || "MUC";

			console.log(
				`🏨 === GOFLIGHTLABS v2/flight ÜBERNACHTUNGS-PRÜFUNG FÜR ${registration} ===`
			);
			console.log(`🏢 Gewählter Flughafen: ${selectedAirport}`);

			// Finde letzten Ankunftsflug am ersten Tag zum gewählten Flughafen
			const lastArrivalToday = currentDayFlights
				.filter((flight) => {
					const arrivalPoint = flight.flightPoints?.find((p) => p.arrivalPoint);
					return arrivalPoint && arrivalPoint.iataCode === selectedAirport;
				})
				.sort((a, b) => {
					const timeA =
						a.flightPoints.find((p) => p.arrivalPoint)?.arrival?.timings[0]
							?.value || "";
					const timeB =
						b.flightPoints.find((p) => p.arrivalPoint)?.arrival?.timings[0]
							?.value || "";
					return timeB.localeCompare(timeA); // Späteste zuerst
				})[0];

			// Finde ersten Abflug am zweiten Tag vom gewählten Flughafen
			const firstDepartureTomorrow = nextDayFlights
				.filter((flight) => {
					const departurePoint = flight.flightPoints?.find(
						(p) => p.departurePoint
					);
					return departurePoint && departurePoint.iataCode === selectedAirport;
				})
				.sort((a, b) => {
					const timeA =
						a.flightPoints.find((p) => p.departurePoint)?.departure?.timings[0]
							?.value || "";
					const timeB =
						b.flightPoints.find((p) => p.departurePoint)?.departure?.timings[0]
							?.value || "";
					return timeA.localeCompare(timeB); // Früheste zuerst
				})[0];

			// Debug-Ausgabe
			if (lastArrivalToday) {
				const arrPoint = lastArrivalToday.flightPoints.find(
					(p) => p.arrivalPoint
				);
				const depPoint = lastArrivalToday.flightPoints.find(
					(p) => p.departurePoint
				);
				console.log(
					`🛬 Letzte Ankunft am ${currentDate}: ${depPoint?.iataCode} → ${
						arrPoint?.iataCode
					} um ${arrPoint?.arrival?.timings[0]?.value?.substring(0, 5)}`
				);
			}

			if (firstDepartureTomorrow) {
				const depPoint = firstDepartureTomorrow.flightPoints.find(
					(p) => p.departurePoint
				);
				const arrPoint = firstDepartureTomorrow.flightPoints.find(
					(p) => p.arrivalPoint
				);
				console.log(
					`🛫 Erster Abflug am ${nextDate}: ${depPoint?.iataCode} → ${
						arrPoint?.iataCode
					} um ${depPoint?.departure?.timings[0]?.value?.substring(0, 5)}`
				);
			}

			console.log(
				`🏨 === ENDE GOFLIGHTLABS v2/flight ÜBERNACHTUNGS-PRÜFUNG ===`
			);

			// Wenn keine Übernachtung stattfindet
			if (!lastArrivalToday || !firstDepartureTomorrow) {
				let reason = "unbekannt";
				if (!lastArrivalToday && !firstDepartureTomorrow) {
					reason = "kein Ankunfts- und kein Abflugsflug";
				} else if (!lastArrivalToday) {
					reason = "kein Ankunftsflug am Vortag";
				} else {
					reason = "kein Abflugsflug am Folgetag";
				}

				updateFetchStatus(
					`${registration} übernachtet nicht in ${selectedAirport} (${reason})`,
					false
				);

				return {
					originCode: "",
					destCode: "",
					departureTime: "",
					arrivalTime: "",
					positionText: "",
					data: [],
					_noDataFound: true,
					_clearFields: true,
					_source: "goflightlabs",
					_apiVersion: "v2/flight",
				};
			}

			// Übernachtung bestätigt - Daten extrahieren
			const result = {
				originCode: "---",
				destCode: "---",
				departureTime: "--:--",
				arrivalTime: "--:--",
				positionText: "---",
				data: [lastArrivalToday, firstDepartureTomorrow],
				_isUtc: false, // GoFlightLabs v2/flight gibt lokale Zeiten
				_source: "goflightlabs",
				_apiVersion: "v2/flight",
				_hasOvernightStay: true,
			};

			// Ankunftsdaten extrahieren
			if (lastArrivalToday) {
				const arrivalPoint = lastArrivalToday.flightPoints.find(
					(p) => p.arrivalPoint
				);
				const departurePoint = lastArrivalToday.flightPoints.find(
					(p) => p.departurePoint
				);

				if (arrivalPoint) {
					result.destCode = arrivalPoint.iataCode || "---";
					const arrivalTimeStr = arrivalPoint.arrival?.timings[0]?.value;
					result.arrivalTime = arrivalTimeStr
						? arrivalTimeStr.substring(0, 5)
						: "--:--";
				}

				if (departurePoint) {
					result.originCode = departurePoint.iataCode || "---";
				}
			}

			// Abflugsdaten extrahieren
			if (firstDepartureTomorrow) {
				const departurePoint = firstDepartureTomorrow.flightPoints.find(
					(p) => p.departurePoint
				);

				if (departurePoint) {
					const departureTimeStr = departurePoint.departure?.timings[0]?.value;
					result.departureTime = departureTimeStr
						? departureTimeStr.substring(0, 5)
						: "--:--";
				}
			}

			// Positionstext für Übernachtung
			if (result.originCode !== "---" || result.destCode !== "---") {
				result.positionText = `🏨 ${result.originCode} → ${result.destCode}`;
			}

			updateFetchStatus(
				`${registration} übernachtet in ${selectedAirport}: ${result.positionText} (v2/flight)`,
				false
			);

			return result;
		} catch (error) {
			console.error(
				"GoFlightLabs v2/flight: Fehler bei Übernachtungslogik:",
				error
			);
			updateFetchStatus(
				`GoFlightLabs v2/flight Fehler: ${error.message}`,
				true
			);

			return {
				originCode: "",
				destCode: "",
				departureTime: "",
				arrivalTime: "",
				positionText: "",
				data: [],
				_noDataFound: true,
				_clearFields: true,
				_source: "goflightlabs",
				_apiVersion: "v2/flight",
				_error: error.message,
			};
		}
	};

	/**
	 * Hilfsfunktion: Flugdaten für spezifisches Datum abrufen
	 */
	const getAircraftFlightsByDate = async (registration, date) => {
		try {
			return await rateLimiter(async () => {
				const params = {
					search_by: "reg",
					reg: registration,
					date_from: date,
					date_to: date,
				};

				const response = await makeRequest("flight_by_date", params);
				return convertToUnifiedFormat(response, registration, date);
			});
		} catch (error) {
			console.error(
				`Fehler beim Abrufen von Flugdaten für ${registration} am ${date}:`,
				error
			);
			return { data: [] };
		}
	};

	/**
	 * Flughafen-Flüge abrufen
	 */
	const getAirportFlights = async (airportCode, startDateTime, endDateTime) => {
		try {
			const normalizedAirport = airportCode.trim().toUpperCase();

			return await rateLimiter(async () => {
				const params = {
					dep_iata: normalizedAirport,
					date_from: startDateTime.split("T")[0],
					date_to: endDateTime.split("T")[0],
				};

				const response = await makeRequest("schedules", params);
				return response;
			});
		} catch (error) {
			console.error(`GoFlightLabs Flughafen-Fehler für ${airportCode}:`, error);
			return { departures: [], arrivals: [] };
		}
	};

	/**
	 * API-Informationen abrufen
	 */
	const getAPIInfo = () => {
		return {
			name: config.name,
			version: config.version,
			features: [
				"Aircraft Registration Search (Direkt)",
				"Live Flugdaten",
				"Historische Flugdaten",
				"Schedule/Flugplan Daten",
				"Airport Routing",
				"Übernachtungslogik-Unterstützung",
			],
			endpoints: Object.keys(config.endpoints),
			rateLimit: "Standard Rate Limiting",
			pricing: "Ab $9.99/Monat für 10.000 Calls",
			_internal: {
				requestCount,
				lastApiCall: new Date(lastApiCall).toISOString(),
			},
		};
	};

	/**
	 * Debugging-Funktionen
	 */
	const testConnection = async () => {
		try {
			updateFetchStatus("GoFlightLabs: Teste Verbindung...");

			const testParams = {
				aircraft_reg: "D-AIBL",
				date: formatDate(new Date()),
			};

			const response = await makeRequest("schedules", testParams);

			const success = response && !response.error;
			updateFetchStatus(
				success
					? "GoFlightLabs: Verbindung erfolgreich!"
					: "GoFlightLabs: Verbindung fehlgeschlagen",
				!success
			);

			return {
				success,
				response,
				timestamp: new Date().toISOString(),
			};
		} catch (error) {
			updateFetchStatus(
				`GoFlightLabs: Verbindungsfehler - ${error.message}`,
				true
			);
			return {
				success: false,
				error: error.message,
				timestamp: new Date().toISOString(),
			};
		}
	};

	// Initialisierung beim Laden
	init();

	// Public API
	return {
		// Hauptfunktionen
		updateAircraftData,
		getAircraftFlights,
		getLiveFlights,
		getHistoricalFlights,
		getAirportFlights,

		// Utility-Funktionen
		getAPIInfo,
		testConnection,

		// Konfiguration
		setDebugMode: (enabled) => {
			config.debugMode = enabled;
			console.log(
				`GoFlightLabs Debug Mode: ${enabled ? "aktiviert" : "deaktiviert"}`
			);
		},

		// Internal für Debugging
		_internal: {
			config,
			makeRequest,
			formatDate,
			formatTime,
		},
	};
})();

// Globalen Namespace erstellen
window.GoFlightLabsAPI = GoFlightLabsAPI;

// Compatibility Layer - für bestehende API-Facade Integration
window.goFlightLabsAPI = GoFlightLabsAPI;

// Auto-Test bei Entwicklung
if (GoFlightLabsAPI._internal.config.debugMode) {
	console.log("🚀 GoFlightLabs API geladen und bereit");
	console.log("📋 API Info:", GoFlightLabsAPI.getAPIInfo());
}
