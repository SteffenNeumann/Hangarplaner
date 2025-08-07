/**
 * Flightradar24 API Integration - PHP PROXY VERSION 3.0
 * Verwendet ausschließlich PHP-Proxy für CORS-freie API-Aufrufe
 * Dokumentation: https://www.flightradar24.com/how-it-works
 */

const Flightradar24API = (() => {
	// API-Konfiguration für PHP-Proxy
	const config = {
		debugMode: true,
		rateLimitDelay: 1000,
		// PHP-Proxy-Pfad (relativ zur Website)
		proxyPath: "sync/flightradar24-proxy.php",
	};

	// Tracking der letzten API-Anfrage für Rate Limiting
	let lastApiCall = 0;

	/**
	 * Initialisierungsfunktion für die API
	 * @param {Object} options - Konfigurationsoptionen
	 */
	const init = (options = {}) => {
		if (options.debugMode !== undefined)
			config.debugMode = Boolean(options.debugMode);
		if (options.proxyPath) config.proxyPath = options.proxyPath;

		if (config.debugMode) {
			console.log(
				`🚀 Flightradar24API PHP-PROXY VERSION 3.0 initialisiert - Verwendet ausschließlich PHP-Proxy`
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
					`[FR24-PROXY] Rate Limiting: Warte ${waitTime}ms vor nächstem API-Aufruf`
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
	 */
	const updateFetchStatus = (message, isError = false) => {
		const fetchStatus = document.getElementById("fetchStatus");
		if (fetchStatus) {
			fetchStatus.textContent = `[FR24-PROXY] ${message}`;
			fetchStatus.className = isError
				? "text-sm text-center text-status-red"
				: "text-sm text-center";
		}

		if (window.showNotification) {
			const notificationType = isError ? "error" : "info";
			window.showNotification(`[FR24-PROXY] ${message}`, notificationType);
		}

		if (config.debugMode) {
			isError
				? console.error(`[FR24-PROXY] ${message}`)
				: console.log(`[FR24-PROXY] ${message}`);
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
		const date = new Date(timestamp * 1000);
		return date.toISOString().substring(11, 16);
	};

	/**
	 * Konvertiert Native Flightradar24 API Daten in das einheitliche Format
	 * @param {Array} nativeData - Daten von der Native Flightradar24 API
	 * @param {string} aircraftRegistration - Flugzeugregistrierung
	 * @param {string} date - Abfragedatum
	 * @returns {Object} Vereinheitlichte Flugdaten
	 */
	const convertToUnifiedFormat = (nativeData, aircraftRegistration, date) => {
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
						_source: "flightradar24-proxy",
						_rawFlightData: flight,
						_isUtc: true,
					};
				} catch (error) {
					console.error(
						"[FR24-PROXY] Fehler bei der Konvertierung eines Fluges:",
						error,
						flight
					);
					return null;
				}
			})
			.filter(Boolean);

		if (config.debugMode && formattedData.length > 0) {
			console.log(
				`[FR24-PROXY] ✅ ${formattedData.length} Flüge erfolgreich konvertiert`
			);
			formattedData.forEach((flight, index) => {
				const depPoint = flight.flightPoints.find((p) => p.departurePoint);
				const arrPoint = flight.flightPoints.find((p) => p.arrivalPoint);
				console.log(
					`[FR24-PROXY] ${index + 1}. ${flight.scheduledDepartureDate}: ${
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
			const registration = aircraftRegistration.trim().toUpperCase();

			// Datum validieren
			const queryDate = new Date(date);
			const today = new Date();
			today.setHours(0, 0, 0, 0);

			if (
				queryDate > today.setFullYear(today.getFullYear() + 1) ||
				queryDate < today.setFullYear(today.getFullYear() - 2)
			) {
				if (config.debugMode) {
					console.log(
						`[FR24-PROXY] Datum ${date} außerhalb des gültigen Bereichs für ${registration}`
					);
				}
				updateFetchStatus(
					`Keine Daten verfügbar - Datum ${date} liegt außerhalb des gültigen Bereichs`,
					true
				);
				return { data: [] };
			}

			updateFetchStatus(`${registration} - PHP-Proxy-Anfrage läuft...`);

			return await rateLimiter(async () => {
				// PHP-Proxy Endpunkte (CORS-frei!)
				const proxyEndpoints = [
					`${config.proxyPath}?registration=${registration}&date=${date}&endpoint=history`,
					`${config.proxyPath}?registration=${registration}&date=${date}&endpoint=aircraft`,
					`${config.proxyPath}?registration=${registration}&date=${date}&endpoint=flights`,
				];

				let lastError = null;

				for (let i = 0; i < proxyEndpoints.length; i++) {
					const proxyUrl = proxyEndpoints[i];

					if (config.debugMode) {
						console.log(
							`[FR24-PROXY] Versuche Endpunkt ${i + 1}/3: ${proxyUrl}`
						);
					}

					try {
						const response = await fetch(proxyUrl, {
							method: "GET",
							headers: {
								"Content-Type": "application/json",
								Accept: "application/json",
							},
						});

						if (!response.ok) {
							const errorText = await response.text();
							lastError = `Endpunkt ${i + 1} fehlgeschlagen: ${
								response.status
							} ${response.statusText}. Details: ${errorText}`;
							console.warn(`[FR24-PROXY] ${lastError}`);
							continue;
						}

						const responseText = await response.text();

						if (!responseText || responseText.trim() === "") {
							console.warn(`[FR24-PROXY] Leere Antwort von Endpunkt ${i + 1}`);
							continue;
						}

						let proxyResponse;
						try {
							proxyResponse = JSON.parse(responseText);
						} catch (jsonError) {
							console.error(
								`[FR24-PROXY] JSON-Parsing-Fehler bei Endpunkt ${i + 1}:`,
								jsonError
							);
							continue;
						}

						// Prüfe PHP-Proxy Response
						if (!proxyResponse.success) {
							console.warn(`[FR24-PROXY] Proxy-Fehler: ${proxyResponse.error}`);
							continue;
						}

						const data = proxyResponse.data;

						if (config.debugMode) {
							console.log(`[FR24-PROXY] Antwort von Endpunkt ${i + 1}:`, data);
						}

						// Native FR24 API Datenstruktur verarbeiten
						let flightsData = null;

						if (data.flights && Array.isArray(data.flights)) {
							flightsData = data.flights;
						} else if (
							data.result &&
							data.result.flights &&
							Array.isArray(data.result.flights)
						) {
							flightsData = data.result.flights;
						} else if (Array.isArray(data)) {
							flightsData = data;
						} else if (data.data && Array.isArray(data.data)) {
							flightsData = data.data;
						}

						if (
							flightsData &&
							Array.isArray(flightsData) &&
							flightsData.length > 0
						) {
							console.log(
								`[FR24-PROXY] ✅ ${flightsData.length} Flüge von Endpunkt ${
									i + 1
								} erhalten`
							);

							// Filtere nach Datum
							let filteredFlights = flightsData.filter((flight) => {
								let flightDate = null;

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
									`[FR24-PROXY] ${filteredFlights.length} von ${flightsData.length} Flügen passen zum Datum ${date}`
								);
							}

							if (filteredFlights.length === 0 && flightsData.length > 0) {
								console.log(
									`[FR24-PROXY] Keine passenden Flüge für ${date}, verwende alle verfügbaren`
								);
								filteredFlights = flightsData.slice(0, 10);
							}

							updateFetchStatus(
								`${registration} erfolgreich: ${filteredFlights.length} Flüge gefunden`
							);

							return convertToUnifiedFormat(
								filteredFlights,
								registration,
								date
							);
						} else {
							console.log(
								`[FR24-PROXY] Keine verwertbaren Flugdaten in Endpunkt ${i + 1}`
							);
							continue;
						}
					} catch (endpointError) {
						lastError = `Fehler bei Endpunkt ${i + 1}: ${
							endpointError.message
						}`;
						console.error(`[FR24-PROXY] ${lastError}`);
						continue;
					}
				}

				throw new Error(
					`Alle PHP-Proxy Endpunkte fehlgeschlagen. Letzter Fehler: ${lastError}`
				);
			});
		} catch (error) {
			console.error(
				`[FR24-PROXY] Fehler bei API-Anfrage für ${aircraftRegistration}:`,
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

		const timeStr = timings[0].value;
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

		const timeStr = timings[0].value;
		return timeStr.substring(0, 5);
	};

	/**
	 * Erweiterte Funktion: Findet Übernachtungsflüge
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
					`\n[FR24-PROXY] 🏨 === ÜBERNACHTUNGS-PRÜFUNG FÜR ${aircraftId} ===`
				);
			}

			const [currentDayData, nextDayData] = await Promise.all([
				getAircraftFlights(aircraftId, currentDate),
				getAircraftFlights(aircraftId, nextDate),
			]);

			const currentDayFlights = currentDayData.data || [];
			const nextDayFlights = nextDayData.data || [];

			console.log(
				`[FR24-PROXY] Gefunden: ${currentDayFlights.length} Flüge am ${currentDate}, ${nextDayFlights.length} am ${nextDate}`
			);

			// Finde letzten Ankunftsflug am Tag 1 zum gewählten Flughafen
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

			let overnightArrival = null;
			let overnightDeparture = null;

			if (currentDayFlightsToAirport.length > 0) {
				const lastArrivalFlight = currentDayFlightsToAirport[0];
				const arrivalTime = getTimeFromFlightPoint(
					lastArrivalFlight.flightPoints.find((p) => p.arrivalPoint)
				);

				// Prüfe: Gibt es weitere Abflüge am gleichen Tag NACH dieser Ankunft?
				const sameDayDeparturesAfterArrival = currentDayFlights.filter(
					(flight) => {
						const departurePoint = flight.flightPoints?.find(
							(p) => p.departurePoint
						);
						if (!departurePoint || departurePoint.iataCode !== selectedAirport)
							return false;

						const departureTime = getTimeFromFlightPoint(departurePoint);
						return departureTime > arrivalTime;
					}
				);

				if (sameDayDeparturesAfterArrival.length === 0) {
					overnightArrival = lastArrivalFlight;
					console.log(`[FR24-PROXY] ✅ Übernachtung bestätigt!`);

					// Finde ersten Abflug am Tag 2
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
						console.log(
							`[FR24-PROXY] ✅ Erster Abflug am ${nextDate} gefunden`
						);
					}
				} else {
					console.log(
						`[FR24-PROXY] ❌ Keine Übernachtung - ${sameDayDeparturesAfterArrival.length} weitere Abflüge am ${currentDate}`
					);
				}
			} else {
				console.log(
					`[FR24-PROXY] ❌ Kein Ankunftsflug am ${currentDate} zum Flughafen ${selectedAirport}`
				);
			}

			console.log(`[FR24-PROXY] 🏨 === ENDE ÜBERNACHTUNGS-PRÜFUNG ===\n`);

			return {
				hasOvernightStay: !!(overnightArrival && overnightDeparture),
				lastArrival: overnightArrival,
				firstDeparture: overnightDeparture,
				allCurrentDayFlights: currentDayFlights,
				allNextDayFlights: nextDayFlights,
				_source: "flightradar24-proxy",
			};
		} catch (error) {
			console.error(
				`[FR24-PROXY] Fehler bei Übernachtungsabfrage für ${aircraftId}:`,
				error
			);
			return {
				hasOvernightStay: false,
				lastArrival: null,
				firstDeparture: null,
				allCurrentDayFlights: [],
				allNextDayFlights: [],
				_source: "flightradar24-proxy",
				_error: error.message,
			};
		}
	};

	// Öffentliche API
	return {
		init,
		getAircraftFlights,
		getOvernightFlights,
		formatDate,
		formatTimeFromTimestamp,
		convertToUnifiedFormat,
		getConfig: () => ({ ...config }),
		updateConfig: (newConfig) => Object.assign(config, newConfig),
		testAPI: async (registration = "D-AIBL", date = "2025-08-07") => {
			console.log(
				`[FR24-PROXY] 🧪 === API TEST FÜR ${registration} AM ${date} ===`
			);

			try {
				const result = await getAircraftFlights(registration, date);
				console.log(`[FR24-PROXY] 🧪 Test-Ergebnis:`, result);

				if (result.data && result.data.length > 0) {
					console.log(
						`[FR24-PROXY] 🧪 ✅ ${result.data.length} Flüge gefunden!`
					);
					result.data.forEach((flight, index) => {
						const dep = flight.flightPoints.find((p) => p.departurePoint);
						const arr = flight.flightPoints.find((p) => p.arrivalPoint);
						console.log(
							`[FR24-PROXY] 🧪 ${index + 1}. ${dep.iataCode} → ${
								arr.iataCode
							} (${flight.flightDesignator.fullFlightNumber})`
						);
					});
				} else {
					console.log(`[FR24-PROXY] 🧪 ❌ Keine Flüge gefunden`);
				}

				return result;
			} catch (error) {
				console.error(`[FR24-PROXY] 🧪 ❌ Test fehlgeschlagen:`, error);
				return { data: [], error: error.message };
			}
		},
		testRawAPI: async (registration = "D-AIBL") => {
			console.log(`[FR24-PROXY] 🔍 === RAW PROXY TEST FÜR ${registration} ===`);

			const endpoints = [
				`${config.proxyPath}?registration=${registration}&date=2025-08-07&endpoint=history`,
				`${config.proxyPath}?registration=${registration}&date=2025-08-07&endpoint=aircraft`,
				`${config.proxyPath}?registration=${registration}&date=2025-08-07&endpoint=flights`,
			];

			for (let i = 0; i < endpoints.length; i++) {
				const url = endpoints[i];
				console.log(`[FR24-PROXY] 🔍 Teste Endpunkt ${i + 1}: ${url}`);

				try {
					const response = await fetch(url);
					console.log(
						`[FR24-PROXY] 🔍 Status ${i + 1}: ${response.status} ${
							response.statusText
						}`
					);

					if (response.ok) {
						const text = await response.text();
						console.log(
							`[FR24-PROXY] 🔍 Response ${i + 1} (${text.length} chars):`,
							text.substring(0, 500)
						);

						try {
							const data = JSON.parse(text);
							console.log(`[FR24-PROXY] 🔍 Parsed ${i + 1}:`, data);

							if (data.success && data.data) {
								console.log(
									`[FR24-PROXY] 🔍 ✅ Endpunkt ${i + 1} erfolgreich!`
								);
							} else {
								console.log(
									`[FR24-PROXY] 🔍 ⚠️ Endpunkt ${i + 1}: ${
										data.error || "Keine Daten"
									}`
								);
							}
						} catch (e) {
							console.log(
								`[FR24-PROXY] 🔍 JSON Parse Error ${i + 1}:`,
								e.message
							);
						}
					}
				} catch (error) {
					console.error(`[FR24-PROXY] 🔍 Error ${i + 1}:`, error.message);
				}

				await new Promise((resolve) => setTimeout(resolve, 1000));
			}
		},
	};
})();

// Global verfügbar machen
if (typeof window !== "undefined") {
	window.Flightradar24API = Flightradar24API;
}

// Export für Module
if (typeof module !== "undefined" && module.exports) {
	module.exports = Flightradar24API;
}
