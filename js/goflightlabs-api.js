/**
 * GoFlightLabs API Integration
 * Spezialisiert auf das Abrufen von Flugdaten nach Flugzeugregistrierungen
 * Dokumentation: https://docs.goflightlabs.com/
 * Optimiert für Aircraft-spezifische Abfragen mit direkter Registrierungs-Suche
 */

const GoFlightLabsAPI = (() => {
	// API-Konfiguration
	const config = {
		name: "GoFlightLabs API",
		version: "1.0.0",
		baseUrl: "https://api.goflightlabs.com",
		apiKey:
			"eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJhdWQiOiI0IiwianRpIjoiYmRlMmNiYmIxMDMzNzAzMjFkYjIzNzdiNmExNzc0Y2QyMTFiMGY5Zjk3ZWRjMGRkYmNlM2U4YWRjM2UwNGE4ZWM1YTRlY2RmMTQ5M2IxNzMiLCJpYXQiOjE3NTQ3MjgwMzgsIm5iZiI6MTc1NDcyODAzOCwiZXhwIjoxNzg2MjY0MDM4LCJzdWIiOiIyNTYyNCIsInNjb3BlcyI6W119.nR5qYTMV-A9oZferXED_WNpcl8XSl82YMZa9ufaxWGQo_7-1tS6ZH8bUpMZgmxqWbsrHEBIExgHGyb-zZiLEIA",
		endpoints: {
			schedules: "/schedules",
			live: "/live",
			historical: "/historical",
			routes: "/routes",
			airports: "/airports",
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
	 * HTTP-Request mit Retry-Logik
	 */
	const makeRequest = async (endpoint, params = {}, retryCount = 0) => {
		try {
			// URL mit Parametern aufbauen
			const url = new URL(`${config.baseUrl}${endpoint}`);

			// API Key hinzufügen
			url.searchParams.append("access_key", config.apiKey);

			// Parameter hinzufügen
			Object.keys(params).forEach((key) => {
				if (params[key] !== null && params[key] !== undefined) {
					url.searchParams.append(key, params[key]);
				}
			});

			if (config.debugMode) {
				console.log(`🌐 GoFlightLabs Request: ${url.toString()}`);
			}

			const response = await fetch(url.toString(), {
				method: "GET",
				headers: {
					Accept: "application/json",
					"User-Agent": "HangarPlanner/1.0",
				},
			});

			if (!response.ok) {
				const errorText = await response.text();
				throw new Error(`HTTP ${response.status}: ${errorText}`);
			}

			const data = await response.json();

			// Prüfe auf API-Fehler
			if (data.error) {
				throw new Error(`API Error: ${data.error.message || data.error}`);
			}

			if (config.debugMode) {
				console.log(`✅ GoFlightLabs Response:`, data);
			}

			return data;
		} catch (error) {
			console.error(
				`❌ GoFlightLabs Request failed (Attempt ${retryCount + 1}):`,
				error
			);

			// Retry-Logik
			if (retryCount < config.maxRetries) {
				console.log(`🔄 Retrying in ${(retryCount + 1) * 1000}ms...`);
				await new Promise((resolve) =>
					setTimeout(resolve, (retryCount + 1) * 1000)
				);
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
	 * GoFlightLabs Daten zu einheitlichem Format konvertieren
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
					// Flughafen-Codes
					const departureIata = flight.departure?.iata || "???";
					const arrivalIata = flight.arrival?.iata || "???";

					// Zeiten formatieren
					const departureTime = formatTime(flight.departure?.scheduled);
					const arrivalTime = formatTime(flight.arrival?.scheduled);

					// Airline-Informationen
					const airlineData = flight.airline || {};
					const airlineName = airlineData.name || "";
					const airlineIata = airlineData.iata || "";
					const airlineIcao = airlineData.icao || "";

					// Flugnummer
					const flightNumber = flight.flight?.number || flight.number || "";

					// Aircraft-Informationen
					const aircraftType = flight.aircraft?.type || "Unknown";
					const registration =
						flight.aircraft?.registration || aircraftRegistration;

					// Datum
					const scheduledDepartureDate = flight.departure?.scheduled
						? new Date(flight.departure.scheduled)
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
											isUtc: true,
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
											isUtc: true,
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
						_rawFlightData: flight,
						_isUtc: true,
					};
				} catch (error) {
					console.error(
						"Fehler bei GoFlightLabs Konvertierung:",
						error,
						flight
					);
					return null;
				}
			})
			.filter(Boolean);

		return { data: formattedData };
	};

	/**
	 * Flugdaten für eine Aircraft Registration abrufen
	 */
	const getAircraftFlights = async (aircraftRegistration, date) => {
		try {
			const registration = aircraftRegistration.trim().toUpperCase();
			const formattedDate = formatDate(date);

			updateFetchStatus(
				`GoFlightLabs: Suche Flüge für ${registration} am ${formattedDate}...`
			);

			return await rateLimiter(async () => {
				// Verwende Schedule-Endpoint mit Aircraft Registration Parameter
				const params = {
					aircraft_reg: registration,
					date: formattedDate,
				};

				const response = await makeRequest(config.endpoints.schedules, params);

				updateFetchStatus(
					`GoFlightLabs: ${
						response.data?.length || 0
					} Flüge für ${registration} gefunden`
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

				const response = await makeRequest(config.endpoints.live, params);
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

				const response = await makeRequest(config.endpoints.historical, params);
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
	 * Aircraft-Daten für zwei Tage abrufen (Übernachtungslogik)
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
				_isUtc: true,
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
			`GoFlightLabs: Verarbeite ${registration} - Übernachtungslogik...`
		);

		try {
			// Hole Flugdaten für beide Tage
			const [currentDayData, nextDayData] = await Promise.all([
				getAircraftFlights(registration, currentDate),
				getAircraftFlights(registration, nextDate),
			]);

			const currentDayFlights = currentDayData?.data || [];
			const nextDayFlights = nextDayData?.data || [];

			console.log(
				`📊 GoFlightLabs: ${currentDayFlights.length} Flüge am ${currentDate}, ${nextDayFlights.length} Flüge am ${nextDate}`
			);

			// Hole aktuell gewählten Flughafen
			const selectedAirport =
				document.getElementById("airportCodeInput")?.value || "MUC";

			console.log(
				`🏨 === GOFLIGHTLABS ÜBERNACHTUNGS-PRÜFUNG FÜR ${registration} ===`
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

			console.log(`🏨 === ENDE GOFLIGHTLABS ÜBERNACHTUNGS-PRÜFUNG ===`);

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
				_isUtc: true,
				_source: "goflightlabs",
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
				`${registration} übernachtet in ${selectedAirport}: ${result.positionText}`,
				false
			);

			return result;
		} catch (error) {
			console.error("GoFlightLabs: Fehler bei Übernachtungslogik:", error);
			updateFetchStatus(`GoFlightLabs Fehler: ${error.message}`, true);

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
				_error: error.message,
			};
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

				const response = await makeRequest(config.endpoints.schedules, params);
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

			const response = await makeRequest(
				config.endpoints.schedules,
				testParams
			);

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
