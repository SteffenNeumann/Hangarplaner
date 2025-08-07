/**
 * Flightradar24 API Integration
 * Spezialisiert auf das Abrufen von Flugdaten nach Flugzeugregistrierungen
 * Dokumentation: https://www.flightradar24.com/how-it-works
 */

const Flightradar24API = (() => {
	// API-Konfiguration für Flightradar24 (Hybrid: Native API + RapidAPI Fallback)
	const config = {
		// Native API (primär, aber CORS-beschränkt)
		nativeApiUrl: "https://fr24api.flightradar24.com",
		nativeApiToken:
			"01988313-fa93-7159-9a43-872a2a31e88b|Kt9JoOnJRS6R1QMUmiu9gFmYh9PSh7rD1tLqgeNZ58450385",

		// RapidAPI als Fallback (CORS-freundlich)
		rapidApiUrl: "https://flightradar24-com.p.rapidapi.com",
		rapidApiKey: "b76afbf516mshf864818d919de86p10475ejsna65b718a8602",
		rapidApiHost: "flightradar24-com.p.rapidapi.com",

		// CORS-Proxy als Alternative
		corsProxy: "https://cors-anywhere.herokuapp.com/",

		// API-Endpunkte
		nativeEndpoints: {
			aircraft: "/v1/aircraft",
			flights: "/v1/flights",
			history: "/v1/history",
		},
		rapidEndpoints: {
			aircraft: "/aircraft",
			flights: "/flights",
			search: "/search",
		},

		debugMode: true,
		rateLimitDelay: 1000,

		// Automatische API-Auswahl
		preferNativeApi: false, // Auf false setzen wegen CORS
		useCorsProxy: false, // Optional: CORS-Proxy verwenden
	};

	// Tracking der letzten API-Anfrage für Rate Limiting
	let lastApiCall = 0;

	/**
	 * Initialisierungsfunktion für die API
	 * @param {Object} options - Konfigurationsoptionen
	 */
	const init = (options = {}) => {
		// Nur die notwendigen Optionen übernehmen
		if (options.debugMode !== undefined)
			config.debugMode = Boolean(options.debugMode);
		if (options.nativeApiToken) config.nativeApiToken = options.nativeApiToken;
		if (options.rapidApiKey) config.rapidApiKey = options.rapidApiKey;
		if (options.preferNativeApi !== undefined)
			config.preferNativeApi = Boolean(options.preferNativeApi);
		if (options.useCorsProxy !== undefined)
			config.useCorsProxy = Boolean(options.useCorsProxy);

		if (config.debugMode) {
			console.log(
				`Flightradar24API initialisiert: ${
					config.preferNativeApi ? "Native API bevorzugt" : "RapidAPI bevorzugt"
				} (CORS-Proxy: ${config.useCorsProxy ? "aktiviert" : "deaktiviert"})`
			);
		}
	};

	/**
	 * Ratenbegrenzer für API-Aufrufe
	 * @param {Function} apiCall - Die auszuführende API-Funktion
	 * @returns {Promise} Ergebnis der API-Anfrage
	 */
	const rateLimiter = async (apiCall) => {
		const now = Date.now();
		const timeSinceLastCall = now - lastApiCall;

		if (timeSinceLastCall < config.rateLimitDelay) {
			const waitTime = config.rateLimitDelay - timeSinceLastCall;
			if (config.debugMode) {
				console.log(
					`[FR24] Rate Limiting: Warte ${waitTime}ms vor nächstem API-Aufruf`
				);
			}
			await new Promise((resolve) => setTimeout(resolve, waitTime));
		}

		lastApiCall = Date.now();
		return apiCall();
	};

	/**
	 * Aktualisiert die Statusanzeige in der UI
	 * @param {string} message - Anzuzeigende Nachricht
	 * @param {boolean} isError - Ob es sich um eine Fehlermeldung handelt
	 * @param {Object} statusDetails - Zusätzliche Details für die visuelle Anzeige
	 */
	const updateFetchStatus = (message, isError = false, statusDetails = {}) => {
		// Bestehende Sidebar-Statusanzeige aktualisieren
		const fetchStatus = document.getElementById("fetchStatus");
		if (fetchStatus) {
			fetchStatus.textContent = `[FR24] ${message}`;
			fetchStatus.className = isError
				? "text-sm text-center text-status-red"
				: "text-sm text-center";
		}

		// Verwende window.showNotification für Status-Updates
		if (window.showNotification) {
			const notificationType = isError ? "error" : "info";
			window.showNotification(`[FR24] ${message}`, notificationType);
		}

		// Auch in der Konsole loggen
		if (config.debugMode) {
			isError
				? console.error(`[FR24] ${message}`)
				: console.log(`[FR24] ${message}`);
		}
	};

	/**
	 * Formatiert ein Datum im Format YYYY-MM-DD
	 * @param {Date|string} dateInput - Datum als Objekt oder String
	 * @returns {string} Formatiertes Datum
	 */
	const formatDate = (dateInput) => {
		const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
		return date.toISOString().split("T")[0];
	};

	/**
	 * Konvertiert einen Unix-Timestamp in HH:MM Format
	 * @param {number} timestamp - Unix-Timestamp
	 * @returns {string} Zeit im Format HH:MM
	 */
	const formatTimeFromTimestamp = (timestamp) => {
		if (!timestamp) return "--:--";
		const date = new Date(timestamp * 1000); // Flightradar24 verwendet Unix-Timestamps
		return date.toISOString().substring(11, 16); // HH:MM aus UTC
	};

	/**
	 * Konvertiert Flightradar24 API Daten in das einheitliche Format
	 * @param {Array|Object} fr24Data - Daten von der Flightradar24 API
	 * @param {string} aircraftRegistration - Flugzeugregistrierung
	 * @param {string} date - Abfragedatum
	 * @returns {Object} Vereinheitlichte Flugdaten
	 */
	const convertToUnifiedFormat = (fr24Data, aircraftRegistration, date) => {
		// Wenn keine Daten vorhanden sind oder ein leeres Array zurückgegeben wurde
		if (!fr24Data || (Array.isArray(fr24Data) && fr24Data.length === 0)) {
			return { data: [] };
		}

		// Sicherstellen, dass wir mit einem Array arbeiten
		let flightsArray = [];

		// Flightradar24 hat oft eine andere Datenstruktur - ERWEITERT
		if (fr24Data.result && Array.isArray(fr24Data.result.response.data)) {
			flightsArray = fr24Data.result.response.data;
		} else if (fr24Data.data && Array.isArray(fr24Data.data)) {
			flightsArray = fr24Data.data;
		} else if (Array.isArray(fr24Data)) {
			flightsArray = fr24Data;
		} else {
			flightsArray = [fr24Data];
		}

		const formattedData = flightsArray
			.map((flight) => {
				try {
					// ERWEITERTE Datenextraktion für verschiedene Flightradar24-Formate

					// Flughafen-Codes - verschiedene Feldstrukturen
					let departureIata = "???";
					let arrivalIata = "???";

					// Format 1: airport.origin/destination
					if (flight.airport?.origin?.code?.iata)
						departureIata = flight.airport.origin.code.iata;
					else if (flight.airport?.origin?.iata)
						departureIata = flight.airport.origin.iata;
					// Format 2: origin/destination direkt
					else if (flight.origin?.iata) departureIata = flight.origin.iata;
					else if (flight.origin) departureIata = flight.origin;
					// Format 3: departure/arrival
					else if (flight.departure?.airport?.iata)
						departureIata = flight.departure.airport.iata;
					else if (flight.departure?.iata)
						departureIata = flight.departure.iata;
					// Format 4: von/nach
					else if (flight.from?.iata) departureIata = flight.from.iata;
					else if (flight.from) departureIata = flight.from;

					// Ankunftsflughafen
					if (flight.airport?.destination?.code?.iata)
						arrivalIata = flight.airport.destination.code.iata;
					else if (flight.airport?.destination?.iata)
						arrivalIata = flight.airport.destination.iata;
					else if (flight.destination?.iata)
						arrivalIata = flight.destination.iata;
					else if (flight.destination) arrivalIata = flight.destination;
					else if (flight.arrival?.airport?.iata)
						arrivalIata = flight.arrival.airport.iata;
					else if (flight.arrival?.iata) arrivalIata = flight.arrival.iata;
					else if (flight.to?.iata) arrivalIata = flight.to.iata;
					else if (flight.to) arrivalIata = flight.to;

					// ERWEITERTE Zeitextraktion für verschiedene Formate
					let departureTime = "--:--";
					let arrivalTime = "--:--";

					// Abflugzeit - verschiedene Feldstrukturen
					if (flight.time?.scheduled?.departure) {
						departureTime = formatTimeFromTimestamp(
							flight.time.scheduled.departure
						);
					} else if (flight.departure_time) {
						departureTime = formatTimeFromTimestamp(flight.departure_time);
					} else if (flight.std) {
						departureTime = formatTimeFromTimestamp(flight.std);
					} else if (flight.scheduledTimeUtc) {
						departureTime = flight.scheduledTimeUtc.substring(11, 16);
					} else if (flight.departure?.scheduledTime) {
						departureTime = formatTimeFromTimestamp(
							flight.departure.scheduledTime
						);
					} else if (flight.scheduled?.departure) {
						departureTime = formatTimeFromTimestamp(flight.scheduled.departure);
					}

					// Ankunftszeit
					if (flight.time?.scheduled?.arrival) {
						arrivalTime = formatTimeFromTimestamp(
							flight.time.scheduled.arrival
						);
					} else if (flight.arrival_time) {
						arrivalTime = formatTimeFromTimestamp(flight.arrival_time);
					} else if (flight.sta) {
						arrivalTime = formatTimeFromTimestamp(flight.sta);
					} else if (flight.arrival?.scheduledTime) {
						arrivalTime = formatTimeFromTimestamp(flight.arrival.scheduledTime);
					} else if (flight.scheduled?.arrival) {
						arrivalTime = formatTimeFromTimestamp(flight.scheduled.arrival);
					}

					// ERWEITERTE Fluggesellschafts- und Flugnummernextraktion
					let airlineName = "";
					let airlineIata = "";
					let airlineIcao = "";
					let flightNumber = "";
					let fullFlightNumber = "";

					// Airline-Daten
					if (flight.airline) {
						airlineName = flight.airline.name || flight.airline_name || "";
						airlineIata = flight.airline.iata || flight.airline_iata || "";
						airlineIcao = flight.airline.icao || flight.airline_icao || "";
					} else {
						airlineName = flight.airline_name || flight.carrierName || "";
						airlineIata = flight.airline_iata || flight.carrierCode || "";
						airlineIcao = flight.airline_icao || flight.carrierIcao || "";
					}

					// Flugnummer
					if (flight.flight) {
						fullFlightNumber = flight.flight;
						if (fullFlightNumber.length > 2) {
							if (!airlineIata) airlineIata = fullFlightNumber.slice(0, 2);
							flightNumber = fullFlightNumber.slice(2);
						}
					} else {
						fullFlightNumber = flight.callsign || flight.flightNumber || "";
						flightNumber = flight.flight_number || "";
					}

					// Flugzeugtyp und Registrierung - ERWEITERT
					let aircraftType = "Unknown";
					let registration = aircraftRegistration || "";

					if (flight.aircraft) {
						aircraftType =
							flight.aircraft.model ||
							flight.aircraft.type ||
							flight.aircraft_model ||
							"Unknown";
						registration =
							flight.aircraft.registration ||
							flight.aircraft.reg ||
							registration;
					} else {
						aircraftType =
							flight.aircraft_type ||
							flight.aircraftModel ||
							flight.model ||
							"Unknown";
						registration = flight.registration || flight.reg || registration;
					}

					// Abflugdatum bestimmen - ERWEITERT
					let scheduledDepartureDate = date;
					if (flight.time?.scheduled?.departure) {
						scheduledDepartureDate = new Date(
							flight.time.scheduled.departure * 1000
						)
							.toISOString()
							.substring(0, 10);
					} else if (flight.departure_time) {
						scheduledDepartureDate = new Date(flight.departure_time * 1000)
							.toISOString()
							.substring(0, 10);
					} else if (flight.std) {
						scheduledDepartureDate = new Date(flight.std * 1000)
							.toISOString()
							.substring(0, 10);
					} else if (flight.scheduledTimeUtc) {
						scheduledDepartureDate = flight.scheduledTimeUtc.substring(0, 10);
					} else if (flight.date) {
						scheduledDepartureDate = flight.date;
					}

					return {
						type: "DatedFlight",
						scheduledDepartureDate: scheduledDepartureDate,
						flightDesignator: {
							carrierCode: airlineIata,
							carrierName: airlineName,
							carrierIcao: airlineIcao,
							flightNumber: flightNumber,
							fullFlightNumber: fullFlightNumber,
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
											isUtc: true, // Markierung für UTC-Zeit
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
											isUtc: true, // Markierung für UTC-Zeit
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
						_source: "flightradar24",
						_rawFlightData: flight,
						_isUtc: true, // Flag zur Kennzeichnung, dass Zeiten in UTC sind
					};
				} catch (error) {
					console.error(
						"[FR24] Fehler bei der Konvertierung eines Flightradar24-Fluges:",
						error,
						flight
					);
					return null;
				}
			})
			.filter(Boolean); // Entferne null-Werte

		if (config.debugMode && formattedData.length > 0) {
			console.log(
				`[FR24] ✅ ${formattedData.length} Flüge erfolgreich konvertiert`
			);
			formattedData.forEach((flight, index) => {
				const depPoint = flight.flightPoints.find((p) => p.departurePoint);
				const arrPoint = flight.flightPoints.find((p) => p.arrivalPoint);
				console.log(
					`[FR24] ${index + 1}. ${flight.scheduledDepartureDate}: ${
						depPoint.iataCode
					} → ${arrPoint.iataCode} (${
						flight.flightDesignator.fullFlightNumber
					})`
				);
			});
		}

		return { data: formattedData };
	};

	/**
	 * Konvertiert Native Flightradar24 API Daten in das einheitliche Format
	 * @param {Array} nativeData - Daten von der Native Flightradar24 API
	 * @param {string} aircraftRegistration - Flugzeugregistrierung
	 * @param {string} date - Abfragedatum
	 * @returns {Object} Vereinheitlichte Flugdaten
	 */
	const convertToUnifiedFormatNative = (
		nativeData,
		aircraftRegistration,
		date
	) => {
		if (!nativeData || (Array.isArray(nativeData) && nativeData.length === 0)) {
			return { data: [] };
		}

		const flightsArray = Array.isArray(nativeData) ? nativeData : [nativeData];

		const formattedData = flightsArray
			.map((flight) => {
				try {
					// Native API Datenextraktion
					let departureIata = "???";
					let arrivalIata = "???";

					// Native API Airport Codes
					if (flight.departure && flight.departure.airport) {
						departureIata =
							flight.departure.airport.iata ||
							flight.departure.airport.code ||
							"???";
					} else if (flight.origin) {
						departureIata =
							flight.origin.iata || flight.origin.code || flight.origin;
					}

					if (flight.arrival && flight.arrival.airport) {
						arrivalIata =
							flight.arrival.airport.iata ||
							flight.arrival.airport.code ||
							"???";
					} else if (flight.destination) {
						arrivalIata =
							flight.destination.iata ||
							flight.destination.code ||
							flight.destination;
					}

					// Native API Zeiten
					let departureTime = "--:--";
					let arrivalTime = "--:--";

					if (flight.departure && flight.departure.scheduled_time) {
						departureTime = formatTimeFromTimestamp(
							flight.departure.scheduled_time
						);
					} else if (flight.scheduled_departure) {
						departureTime = formatTimeFromTimestamp(flight.scheduled_departure);
					}

					if (flight.arrival && flight.arrival.scheduled_time) {
						arrivalTime = formatTimeFromTimestamp(
							flight.arrival.scheduled_time
						);
					} else if (flight.scheduled_arrival) {
						arrivalTime = formatTimeFromTimestamp(flight.scheduled_arrival);
					}

					// Native API Airline/Flight Info
					let airlineName = "";
					let airlineIata = "";
					let airlineIcao = "";
					let flightNumber = "";
					let fullFlightNumber = "";

					if (flight.airline) {
						airlineName = flight.airline.name || "";
						airlineIata = flight.airline.iata || "";
						airlineIcao = flight.airline.icao || "";
					}

					if (flight.flight_number) {
						fullFlightNumber = flight.flight_number;
						if (fullFlightNumber.length > 2) {
							if (!airlineIata) airlineIata = fullFlightNumber.slice(0, 2);
							flightNumber = fullFlightNumber.slice(2);
						}
					} else if (flight.callsign) {
						fullFlightNumber = flight.callsign;
					}

					// Native API Aircraft Info
					let aircraftType = "Unknown";
					let registration = aircraftRegistration || "";

					if (flight.aircraft) {
						aircraftType =
							flight.aircraft.type || flight.aircraft.model || "Unknown";
						registration = flight.aircraft.registration || registration;
					}

					// Datum
					let scheduledDepartureDate = date;
					if (flight.departure && flight.departure.scheduled_time) {
						scheduledDepartureDate = new Date(
							flight.departure.scheduled_time * 1000
						)
							.toISOString()
							.substring(0, 10);
					} else if (flight.scheduled_departure) {
						scheduledDepartureDate = new Date(flight.scheduled_departure * 1000)
							.toISOString()
							.substring(0, 10);
					} else if (flight.date) {
						scheduledDepartureDate = flight.date;
					}

					return {
						type: "DatedFlight",
						scheduledDepartureDate: scheduledDepartureDate,
						flightDesignator: {
							carrierCode: airlineIata,
							carrierName: airlineName,
							carrierIcao: airlineIcao,
							flightNumber: flightNumber,
							fullFlightNumber: fullFlightNumber,
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
						_source: "flightradar24-native",
						_rawFlightData: flight,
						_isUtc: true,
					};
				} catch (error) {
					console.error(
						"[FR24] Fehler bei der Konvertierung eines Native API Fluges:",
						error,
						flight
					);
					return null;
				}
			})
			.filter(Boolean);

		if (config.debugMode && formattedData.length > 0) {
			console.log(
				`[FR24] ✅ ${formattedData.length} Native API Flüge erfolgreich konvertiert`
			);
			formattedData.forEach((flight, index) => {
				const depPoint = flight.flightPoints.find((p) => p.departurePoint);
				const arrPoint = flight.flightPoints.find((p) => p.arrivalPoint);
				console.log(
					`[FR24] ${index + 1}. ${flight.scheduledDepartureDate}: ${
						depPoint.iataCode
					} → ${arrPoint.iataCode} (${
						flight.flightDesignator.fullFlightNumber
					})`
				);
			});
		}

		return { data: formattedData };
	};

	/**
	 * Macht die API-Anfrage für ein bestimmtes Flugzeug über PHP-Proxy
	 * @param {string} aircraftRegistration - Flugzeugregistrierung (z.B. "D-AIBL")
	 * @param {string} date - Datum im Format YYYY-MM-DD
	 * @returns {Promise<Object>} Flugdaten
	 */
	const getAircraftFlights = async (aircraftRegistration, date) => {
		try {
			// Registrierung normalisieren
			const registration = aircraftRegistration.trim().toUpperCase();

			// Prüfen, ob das Datum in der Zukunft liegt
			const queryDate = new Date(date);
			const today = new Date();
			today.setHours(0, 0, 0, 0);

			if (
				queryDate > today.setFullYear(today.getFullYear() + 1) ||
				queryDate < today.setFullYear(today.getFullYear() - 2)
			) {
				if (config.debugMode) {
					console.log(
						`[FR24] Datum ${date} ist weit in der Zukunft oder Vergangenheit, keine Daten für ${registration} verfügbar`
					);
				}
				updateFetchStatus(
					`Keine Daten verfügbar - Datum ${date} liegt außerhalb des gültigen Bereichs`,
					true
				);
				return { data: [] };
			}

			updateFetchStatus(
				`Verarbeite ${registration} - API-Anfrage über PHP-Proxy läuft...`
			);

			return await rateLimiter(async () => {
				// PHP-Proxy Endpunkte (CORS-freundlich)
				const proxyEndpoints = [
					// Endpunkt 1: History API über Proxy
					`sync/flightradar24-proxy.php?registration=${registration}&date=${date}&endpoint=history`,
					// Endpunkt 2: Aircraft API über Proxy
					`sync/flightradar24-proxy.php?registration=${registration}&date=${date}&endpoint=aircraft`,
					// Endpunkt 3: Flights API über Proxy
					`sync/flightradar24-proxy.php?registration=${registration}&date=${date}&endpoint=flights`,
				];

				let lastError = null;

				for (let i = 0; i < proxyEndpoints.length; i++) {
					const proxyUrl = proxyEndpoints[i];

					if (config.debugMode) {
						console.log(
							`[FR24] Versuche PHP-Proxy Endpunkt ${i + 1}/3: ${proxyUrl}`
						);
					}

					try {
						// Einfacher GET-Request über PHP-Proxy (löst CORS-Problem)
						const options = {
							method: "GET",
							headers: {
								"Content-Type": "application/json",
								Accept: "application/json",
							},
						};

						const response = await fetch(proxyUrl, options);

						if (!response.ok) {
							const errorText = await response.text();
							lastError = `PHP-Proxy Endpunkt ${i + 1} fehlgeschlagen: ${
								response.status
							} ${response.statusText}. Details: ${errorText}`;
							console.warn(`[FR24] ${lastError}`);
							continue;
						}

						const responseText = await response.text();

						if (!responseText || responseText.trim() === "") {
							console.warn(
								`[FR24] Leere Antwort von PHP-Proxy Endpunkt ${
									i + 1
								} für ${registration}`
							);
							continue;
						}

						let proxyResponse;
						try {
							proxyResponse = JSON.parse(responseText);
						} catch (jsonError) {
							console.error(
								`[FR24] JSON-Parsing-Fehler bei PHP-Proxy Endpunkt ${
									i + 1
								} für ${registration}:`,
								jsonError
							);
							continue;
						}

						// Prüfe PHP-Proxy Response
						if (!proxyResponse.success) {
							console.warn(`[FR24] PHP-Proxy Fehler: ${proxyResponse.error}`);
							continue;
						}

						const data = proxyResponse.data;

						if (config.debugMode) {
							console.log(
								`[FR24] PHP-Proxy Antwort von Endpunkt ${
									i + 1
								} für ${registration}:`,
								data
							);
						}

						// Native FR24 API Datenstruktur verarbeiten
						let flightsData = null;

						// Format 1: Native API Standard Format
						if (data.flights && Array.isArray(data.flights)) {
							flightsData = data.flights;
						}
						// Format 2: History API Format
						else if (
							data.result &&
							data.result.flights &&
							Array.isArray(data.result.flights)
						) {
							flightsData = data.result.flights;
						}
						// Format 3: Direct Array Response
						else if (Array.isArray(data)) {
							flightsData = data;
						}
						// Format 4: Data Container
						else if (data.data && Array.isArray(data.data)) {
							flightsData = data.data;
						}

						if (
							flightsData &&
							Array.isArray(flightsData) &&
							flightsData.length > 0
						) {
							console.log(
								`[FR24] ✅ Erfolgreich ${
									flightsData.length
								} Flüge von PHP-Proxy Endpunkt ${i + 1} erhalten`
							);

							// Filtere nach Datum (Native API sollte bereits gefiltert haben)
							let filteredFlights = flightsData.filter((flight) => {
								let flightDate = null;

								// Native API Datumsfelder
								if (flight.departure && flight.departure.scheduled_time) {
									flightDate = new Date(flight.departure.scheduled_time * 1000)
										.toISOString()
										.substring(0, 10);
								} else if (flight.scheduled_departure) {
									flightDate = new Date(flight.scheduled_departure * 1000)
										.toISOString()
										.substring(0, 10);
								} else if (flight.date) {
									flightDate = flight.date;
								}

								return flightDate === date;
							});

							if (config.debugMode) {
								console.log(
									`[FR24] ${filteredFlights.length} von ${flightsData.length} Flügen passen zum Datum ${date}`
								);
							}

							if (filteredFlights.length === 0 && flightsData.length > 0) {
								console.log(
									`[FR24] Keine Flüge für das Datum ${date} gefunden, verwende alle verfügbaren Flüge für Analyse`
								);
								filteredFlights = flightsData.slice(0, 10);
							}

							updateFetchStatus(
								`PHP-Proxy Flightradar24 Abfrage für ${registration} erfolgreich: ${filteredFlights.length} Flüge gefunden`
							);

							return convertToUnifiedFormatNative(
								filteredFlights,
								registration,
								date
							);
						} else {
							console.log(
								`[FR24] Keine verwertbaren Flugdaten in PHP-Proxy Endpunkt ${
									i + 1
								} gefunden`
							);
							continue;
						}
					} catch (endpointError) {
						lastError = `Fehler bei PHP-Proxy Endpunkt ${i + 1}: ${
							endpointError.message
						}`;
						console.error(`[FR24] ${lastError}`);
						continue;
					}
				}

				throw new Error(
					`Alle PHP-Proxy Endpunkte fehlgeschlagen. Letzter Fehler: ${lastError}`
				);
			});
		} catch (error) {
			console.error(
				`[FR24] Fehler bei PHP-Proxy API-Anfrage für ${aircraftRegistration}:`,
				error
			);
			updateFetchStatus(
				`Fehler: ${aircraftRegistration} - ${error.message}`,
				true
			);

			return { data: [] };
		}
	};

	/**
	 * Hilfsfunktion: Extrahiert Zeit aus einem Flight Point
	 * @param {Object} flightPoint - Flight Point Objekt
	 * @returns {number} Zeit als Minuten seit Mitternacht
	 */
	const getTimeFromFlightPoint = (flightPoint) => {
		if (!flightPoint) return 0;

		const timings =
			flightPoint.departure?.timings || flightPoint.arrival?.timings;
		if (!timings || !timings.length) return 0;

		const timeStr = timings[0].value; // Format: "HH:MM:00.000"
		const [hours, minutes] = timeStr.split(":").map(Number);
		return hours * 60 + minutes;
	};

	/**
	 * Hilfsfunktion: Extrahiert Zeitstring aus einem Flight Point
	 * @param {Object} flightPoint - Flight Point Objekt
	 * @returns {string} Zeit als "HH:MM"
	 */
	const getTimeStringFromFlightPoint = (flightPoint) => {
		if (!flightPoint) return "--:--";

		const timings =
			flightPoint.departure?.timings || flightPoint.arrival?.timings;
		if (!timings || !timings.length) return "--:--";

		const timeStr = timings[0].value; // Format: "HH:MM:00.000"
		return timeStr.substring(0, 5); // Nur "HH:MM"
	};

	/**
	 * Erweiterte Funktion: Findet Übernachtungsflüge (letzter Ankunfts- und erster Abflug)
	 * @param {string} aircraftId - Flugzeugregistrierung
	 * @param {string} selectedAirport - IATA-Code des ausgewählten Flughafens
	 * @param {string} currentDate - Aktuelles Datum (YYYY-MM-DD)
	 * @param {string} nextDate - Folgetag (YYYY-MM-DD)
	 * @returns {Promise<Object>} Übernachtungsflugdaten
	 */
	const getOvernightFlights = async (
		aircraftId,
		selectedAirport,
		currentDate,
		nextDate
	) => {
		try {
			if (config.debugMode) {
				console.log(
					`\n[FR24] 🏨 === ÜBERNACHTUNGS-PRÜFUNG FÜR ${aircraftId} (Flightradar24) ===`
				);
			}

			// Hole Flugdaten für beide Tage
			const [currentDayData, nextDayData] = await Promise.all([
				getAircraftFlights(aircraftId, currentDate),
				getAircraftFlights(aircraftId, nextDate),
			]);

			const currentDayFlights = currentDayData.data || [];
			const nextDayFlights = nextDayData.data || [];

			console.log(
				`[FR24] [ERGEBNISSE] Gefunden: ${currentDayFlights.length} Flüge am ${currentDate} und ${nextDayFlights.length} Flüge am ${nextDate}`
			);

			// Schritt 1: Finde alle Flüge für beide Tage und sortiere sie chronologisch
			const allFlights = [...currentDayFlights, ...nextDayFlights];

			// Sortiere alle Flüge nach Datum und Zeit
			allFlights.sort((a, b) => {
				const dateA = a.scheduledDepartureDate || currentDate;
				const dateB = b.scheduledDepartureDate || currentDate;

				if (dateA !== dateB) {
					return dateA.localeCompare(dateB);
				}

				// Gleicher Tag - sortiere nach Abflugzeit
				const timeA = getTimeFromFlightPoint(
					a.flightPoints?.find((p) => p.departurePoint)
				);
				const timeB = getTimeFromFlightPoint(
					b.flightPoints?.find((p) => p.departurePoint)
				);
				return timeA - timeB;
			});

			console.log(
				`[FR24] 📋 Alle Flüge für ${aircraftId} (${allFlights.length} Flüge gefunden):`
			);
			if (config.debugMode) {
				allFlights.forEach((flight, index) => {
					const depPoint = flight.flightPoints?.find((p) => p.departurePoint);
					const arrPoint = flight.flightPoints?.find((p) => p.arrivalPoint);
					const depTime = getTimeStringFromFlightPoint(depPoint);
					const arrTime = getTimeStringFromFlightPoint(arrPoint);
					const flightDate = flight.scheduledDepartureDate || currentDate;
					console.log(
						`[FR24] ${index + 1}. ${flightDate}: ${
							depPoint?.iataCode || "???"
						} (${depTime}) → ${arrPoint?.iataCode || "???"} (${arrTime})`
					);
				});
			}

			// Schritt 2: Finde den letzten Flug von Tag 1, der am gewählten Flughafen landet
			let overnightArrival = null;
			let overnightDeparture = null;

			// Suche letzten Ankunftsflug am Tag 1 zum gewählten Flughafen
			const currentDayFlightsToAirport = currentDayFlights
				.filter((flight) => {
					const arrivalPoint = flight.flightPoints?.find((p) => p.arrivalPoint);
					return arrivalPoint && arrivalPoint.iataCode === selectedAirport;
				})
				.sort((a, b) => {
					const timeA = getTimeFromFlightPoint(
						a.flightPoints.find((p) => p.arrivalPoint)
					);
					const timeB = getTimeFromFlightPoint(
						b.flightPoints.find((p) => p.arrivalPoint)
					);
					return timeB - timeA; // Späteste zuerst
				});

			if (currentDayFlightsToAirport.length > 0) {
				const lastArrivalFlight = currentDayFlightsToAirport[0];

				// Prüfe: Gibt es noch einen Abflug vom gewählten Flughafen am gleichen Tag NACH dieser Ankunft?
				const arrivalTime = getTimeFromFlightPoint(
					lastArrivalFlight.flightPoints.find((p) => p.arrivalPoint)
				);

				const sameDayDeparturesAfterArrival = currentDayFlights.filter(
					(flight) => {
						const departurePoint = flight.flightPoints?.find(
							(p) => p.departurePoint
						);
						if (!departurePoint || departurePoint.iataCode !== selectedAirport)
							return false;

						const departureTime = getTimeFromFlightPoint(departurePoint);
						return departureTime > arrivalTime; // Abflug NACH der Ankunft
					}
				);

				if (sameDayDeparturesAfterArrival.length === 0) {
					// Keine weiteren Abflüge am gleichen Tag - Flugzeug verbleibt über Nacht!
					overnightArrival = lastArrivalFlight;
					console.log(
						`[FR24] ✅ Übernachtung bestätigt! Letzter Flug am ${currentDate}:`
					);
					const arrPoint = overnightArrival.flightPoints.find(
						(p) => p.arrivalPoint
					);
					const depPoint = overnightArrival.flightPoints.find(
						(p) => p.departurePoint
					);
					console.log(
						`[FR24]    ${depPoint?.iataCode || "???"} → ${
							arrPoint?.iataCode || "???"
						} um ${getTimeStringFromFlightPoint(arrPoint)}`
					);
				} else {
					console.log(
						`[FR24] ❌ Keine Übernachtung - ${sameDayDeparturesAfterArrival.length} weitere Abflüge am ${currentDate} gefunden`
					);
				}
			} else {
				console.log(
					`[FR24] ❌ Kein Ankunftsflug am ${currentDate} zum Flughafen ${selectedAirport} gefunden`
				);
			}

			// Schritt 3: Finde den ersten Abflug am Tag 2 vom gewählten Flughafen (nur wenn Übernachtung bestätigt)
			if (overnightArrival) {
				const nextDayDeparturesFromAirport = nextDayFlights
					.filter((flight) => {
						const departurePoint = flight.flightPoints?.find(
							(p) => p.departurePoint
						);
						return (
							departurePoint && departurePoint.iataCode === selectedAirport
						);
					})
					.sort((a, b) => {
						const timeA = getTimeFromFlightPoint(
							a.flightPoints.find((p) => p.departurePoint)
						);
						const timeB = getTimeFromFlightPoint(
							b.flightPoints.find((p) => p.departurePoint)
						);
						return timeA - timeB; // Früheste zuerst
					});

				if (nextDayDeparturesFromAirport.length > 0) {
					overnightDeparture = nextDayDeparturesFromAirport[0];
					console.log(`[FR24] ✅ Erster Abflug am ${nextDate} gefunden:`);
					const depPoint = overnightDeparture.flightPoints.find(
						(p) => p.departurePoint
					);
					const arrPoint = overnightDeparture.flightPoints.find(
						(p) => p.arrivalPoint
					);
					console.log(
						`[FR24]    ${depPoint?.iataCode || "???"} → ${
							arrPoint?.iataCode || "???"
						} um ${getTimeStringFromFlightPoint(depPoint)}`
					);
				} else {
					console.log(
						`[FR24] ⚠️ Kein Abflug am ${nextDate} vom Flughafen ${selectedAirport} gefunden`
					);
				}
			}

			console.log(
				`[FR24] 🏨 === ENDE ÜBERNACHTUNGS-PRÜFUNG (Flightradar24) ===\n`
			);

			// Die relevanten Flüge für Übernachtung
			const lastArrival = overnightArrival;
			const firstDeparture = overnightDeparture;

			// Rückgabe der Ergebnisse
			return {
				hasOvernightStay: !!(lastArrival && firstDeparture),
				lastArrival: lastArrival,
				firstDeparture: firstDeparture,
				allCurrentDayFlights: currentDayFlights,
				allNextDayFlights: nextDayFlights,
				_source: "flightradar24",
			};
		} catch (error) {
			console.error(
				`[FR24] Fehler bei Übernachtungsabfrage für ${aircraftId}:`,
				error
			);
			return {
				hasOvernightStay: false,
				lastArrival: null,
				firstDeparture: null,
				allCurrentDayFlights: [],
				allNextDayFlights: [],
				_source: "flightradar24",
				_error: error.message,
			};
		}
	};

	// Öffentliche API
	return {
		init,
		getAircraftFlights,
		getOvernightFlights,
		// Hilfsfunktionen für externe Nutzung
		formatDate,
		formatTimeFromTimestamp,
		convertToUnifiedFormat,
		convertToUnifiedFormatNative, // Neue Native-Konvertierung
		// Konfiguration für Debugging
		getConfig: () => ({ ...config }),
		updateConfig: (newConfig) => Object.assign(config, newConfig),
		// DEBUG-Funktion für direktes Testen
		testAPI: async (registration = "D-AIBL", date = "2025-08-05") => {
			console.log(
				`[FR24] 🧪 === NATIVE API DEBUG TEST FÜR ${registration} AM ${date} ===`
			);

			try {
				const result = await getAircraftFlights(registration, date);
				console.log(`[FR24] 🧪 Native Test-Ergebnis:`, result);

				if (result.data && result.data.length > 0) {
					console.log(
						`[FR24] 🧪 ✅ ${result.data.length} Native Flüge gefunden!`
					);
					result.data.forEach((flight, index) => {
						const dep = flight.flightPoints.find((p) => p.departurePoint);
						const arr = flight.flightPoints.find((p) => p.arrivalPoint);
						console.log(
							`[FR24] 🧪 ${index + 1}. ${dep.iataCode} → ${arr.iataCode} (${
								flight.flightDesignator.fullFlightNumber
							})`
						);
					});
				} else {
					console.log(`[FR24] 🧪 ❌ Keine Native Flüge gefunden`);
				}

				return result;
			} catch (error) {
				console.error(`[FR24] 🧪 ❌ Native Test fehlgeschlagen:`, error);
				return { data: [], error: error.message };
			}
		},
		// Direkte API-Endpunkt-Tests für PHP-Proxy
		testRawAPI: async (registration = "D-AIBL") => {
			console.log(`[FR24] 🔍 === PHP-PROXY TEST FÜR ${registration} ===`);

			const endpoints = [
				`sync/flightradar24-proxy.php?registration=${registration}&date=2025-08-07&endpoint=history`,
				`sync/flightradar24-proxy.php?registration=${registration}&date=2025-08-07&endpoint=aircraft`,
				`sync/flightradar24-proxy.php?registration=${registration}&date=2025-08-07&endpoint=flights`,
			];

			for (let i = 0; i < endpoints.length; i++) {
				const url = endpoints[i];
				console.log(`[FR24] 🔍 Teste PHP-Proxy Endpunkt ${i + 1}: ${url}`);

				try {
					const response = await fetch(url);
					console.log(
						`[FR24] 🔍 Status ${i + 1}: ${response.status} ${
							response.statusText
						}`
					);

					if (response.ok) {
						const text = await response.text();
						console.log(
							`[FR24] 🔍 PHP-Proxy Response ${i + 1} (${text.length} chars):`,
							text.substring(0, 500)
						);

						try {
							const data = JSON.parse(text);
							console.log(`[FR24] 🔍 PHP-Proxy Parsed ${i + 1}:`, data);

							if (data.success && data.data) {
								console.log(`[FR24] 🔍 ✅ Endpunkt ${i + 1} erfolgreich!`);
							} else {
								console.log(
									`[FR24] 🔍 ⚠️ Endpunkt ${i + 1}: ${
										data.error || "Keine Daten"
									}`
								);
							}
						} catch (e) {
							console.log(`[FR24] 🔍 JSON Parse Error ${i + 1}:`, e.message);
						}
					}
				} catch (error) {
					console.error(`[FR24] 🔍 PHP-Proxy Error ${i + 1}:`, error.message);
				}

				await new Promise((resolve) => setTimeout(resolve, 1000));
			}
		},
	};
})();

// Global verfügbar machen, falls benötigt
if (typeof window !== "undefined") {
	window.Flightradar24API = Flightradar24API;
}

// Export für Module
if (typeof module !== "undefined" && module.exports) {
	module.exports = Flightradar24API;
}
