/**
 * Flightradar24 API Integration - PHP PROXY VERSION 3.0
 * Verwendet ausschließlich PHP-Proxy für CORS-freie API-Aufrufe
 * Dokumentation: https://www.flightradar24.com/how-it-works
 */

const Flightradar24API = (() => {
	// API-Konfiguration für PHP-Proxy
	const config = {
		debugMode: true,
		rateLimitDelay: 3000, // 3 Sekunden zwischen Anfragen (erhöht von 1000ms)
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
					// FR24 Flight Summary API Datenextraktion
					let departureIata = "???";
					let arrivalIata = "???";

					// FR24 API Airport Codes (orig_iata, dest_iata)
					if (flight.orig_iata) {
						departureIata = flight.orig_iata;
					} else if (flight.orig_icao) {
						departureIata = flight.orig_icao;
					}

					if (flight.dest_iata) {
						arrivalIata = flight.dest_iata;
					} else if (flight.dest_icao) {
						arrivalIata = flight.dest_icao;
					}

					// FR24 API Zeiten (datetime_takeoff, datetime_landed)
					let departureTime = "--:--";
					let arrivalTime = "--:--";

					if (flight.datetime_takeoff) {
						const takeoffDate = new Date(flight.datetime_takeoff);
						departureTime = takeoffDate.toISOString().substring(11, 16);
					}

					if (flight.datetime_landed) {
						const landedDate = new Date(flight.datetime_landed);
						arrivalTime = landedDate.toISOString().substring(11, 16);
					}

					// FR24 API Flight Info (flight, callsign)
					let airlineName = "";
					let airlineIata = "";
					let airlineIcao = "";
					let flightNumber = "";
					let fullFlightNumber = "";

					if (flight.flight) {
						fullFlightNumber = flight.flight;
						if (fullFlightNumber.length > 2) {
							airlineIata = fullFlightNumber.slice(0, 2);
							flightNumber = fullFlightNumber.slice(2);
						}
					}

					if (flight.callsign) {
						fullFlightNumber = flight.callsign;
					}

					if (flight.operating_as) {
						airlineIcao = flight.operating_as;
					}

					// FR24 API Aircraft Info (type, reg)
					let aircraftType = flight.type || "Unknown";
					let registration = flight.reg || aircraftRegistration || "";

					// Datum
					let scheduledDepartureDate = date;
					if (flight.datetime_takeoff) {
						scheduledDepartureDate = flight.datetime_takeoff.substring(0, 10);
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
								_rawFlightData: flight, // Für Übernachtungslogik
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
								_rawFlightData: flight, // Für Übernachtungslogik
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
				// Verwende nur EINEN Endpunkt statt 3 gleichzeitige Anfragen
				const proxyUrl = `${config.proxyPath}?registration=${registration}&date=${date}&endpoint=flights`;

				if (config.debugMode) {
					console.log(`[FR24-PROXY] Verwende einzelnen Endpunkt: ${proxyUrl}`);
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
						throw new Error(`HTTP ${response.status}: ${errorText}`);
					}

					const responseText = await response.text();

					if (!responseText || responseText.trim() === "") {
						throw new Error("Leere Antwort vom PHP-Proxy");
					}

					let proxyResponse;
					try {
						proxyResponse = JSON.parse(responseText);
					} catch (jsonError) {
						throw new Error(`JSON-Parsing-Fehler: ${jsonError.message}`);
					}

					// Prüfe PHP-Proxy Response
					if (!proxyResponse.success) {
						throw new Error(`Proxy-Fehler: ${proxyResponse.error}`);
					}

					const data = proxyResponse.data;

					if (config.debugMode) {
						console.log(`[FR24-PROXY] Erfolgreiche Antwort:`, data);
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
						console.log(`[FR24-PROXY] ✅ ${flightsData.length} Flüge erhalten`);

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
							} else if (flight.datetime_takeoff) {
								flightDate = flight.datetime_takeoff.substring(0, 10);
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

						return convertToUnifiedFormat(filteredFlights, registration, date);
					} else {
						console.log(`[FR24-PROXY] Keine verwertbaren Flugdaten erhalten`);
						updateFetchStatus(
							`${registration}: Keine Flugdaten für ${date} verfügbar`
						);
						return { data: [] };
					}
				} catch (endpointError) {
					console.error(`[FR24-PROXY] Endpunkt-Fehler:`, endpointError);
					throw endpointError;
				}
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
	 * Hilfsfunktion: Extrahiert Zeit aus einem Flight Point (FR24 API kompatibel)
	 * @param {Object} flightPoint - Flight Point Objekt
	 * @returns {number} Zeit als Minuten seit Mitternacht
	 */
	const getTimeFromFlightPoint = (flightPoint) => {
		if (!flightPoint) return 0;

		// FR24 API: Versuche zuerst neue Datenstruktur mit timings
		const timings =
			flightPoint.departure?.timings || flightPoint.arrival?.timings;

		if (timings && timings.length > 0) {
			const timeStr = timings[0].value;
			const [hours, minutes] = timeStr.split(":").map(Number);
			return hours * 60 + minutes;
		}

		// FR24 API Fallback: Direkte Zeitextraktion aus Raw Data
		const rawData = flightPoint._rawFlightData;
		if (rawData) {
			let timeStr = null;

			if (flightPoint.departurePoint && rawData.datetime_takeoff) {
				const takeoffDate = new Date(rawData.datetime_takeoff);
				timeStr = takeoffDate.toISOString().substring(11, 16);
			} else if (flightPoint.arrivalPoint && rawData.datetime_landed) {
				const landedDate = new Date(rawData.datetime_landed);
				timeStr = landedDate.toISOString().substring(11, 16);
			}

			if (timeStr) {
				const [hours, minutes] = timeStr.split(":").map(Number);
				return hours * 60 + minutes;
			}
		}

		return 0;
	};

	/**
	 * Hilfsfunktion: Extrahiert Zeitstring aus einem Flight Point (FR24 API kompatibel)
	 * @param {Object} flightPoint - Flight Point Objekt
	 * @returns {string} Zeit als "HH:MM"
	 */
	const getTimeStringFromFlightPoint = (flightPoint) => {
		if (!flightPoint) return "--:--";

		// FR24 API: Versuche zuerst neue Datenstruktur mit timings
		const timings =
			flightPoint.departure?.timings || flightPoint.arrival?.timings;

		if (timings && timings.length > 0) {
			const timeStr = timings[0].value;
			return timeStr.substring(0, 5);
		}

		// FR24 API Fallback: Direkte Zeitextraktion aus Raw Data
		const rawData = flightPoint._rawFlightData;
		if (rawData) {
			if (flightPoint.departurePoint && rawData.datetime_takeoff) {
				const takeoffDate = new Date(rawData.datetime_takeoff);
				return takeoffDate.toISOString().substring(11, 16);
			} else if (flightPoint.arrivalPoint && rawData.datetime_landed) {
				const landedDate = new Date(rawData.datetime_landed);
				return landedDate.toISOString().substring(11, 16);
			}
		}

		return "--:--";
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
				console.log(`[FR24-PROXY] Prüfe Station: ${selectedAirport}`);
				console.log(
					`[FR24-PROXY] Datum 1: ${currentDate}, Datum 2: ${nextDate}`
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
					const matches =
						arrivalPoint && arrivalPoint.iataCode === selectedAirport;

					if (config.debugMode && matches) {
						console.log(
							`[FR24-PROXY] ✈️ Ankunft gefunden: ${
								flight.flightDesignator.fullFlightNumber
							} → ${selectedAirport} um ${getTimeStringFromFlightPoint(
								arrivalPoint
							)}`
						);
					}

					return matches;
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

			if (config.debugMode) {
				console.log(
					`[FR24-PROXY] ${currentDayFlightsToAirport.length} Ankünfte an ${selectedAirport} am ${currentDate}`
				);
			}

			let overnightArrival = null;
			let overnightDeparture = null;

			if (currentDayFlightsToAirport.length > 0) {
				const lastArrivalFlight = currentDayFlightsToAirport[0];
				const lastArrivalPoint = lastArrivalFlight.flightPoints.find(
					(p) => p.arrivalPoint
				);
				const arrivalTime = getTimeFromFlightPoint(lastArrivalPoint);
				const arrivalTimeStr = getTimeStringFromFlightPoint(lastArrivalPoint);

				if (config.debugMode) {
					console.log(
						`[FR24-PROXY] 🕐 Letzte Ankunft: ${lastArrivalFlight.flightDesignator.fullFlightNumber} um ${arrivalTimeStr}`
					);
				}

				// Prüfe: Gibt es weitere Abflüge am gleichen Tag NACH dieser Ankunft?
				const sameDayDeparturesAfterArrival = currentDayFlights.filter(
					(flight) => {
						const departurePoint = flight.flightPoints?.find(
							(p) => p.departurePoint
						);
						if (!departurePoint || departurePoint.iataCode !== selectedAirport)
							return false;

						const departureTime = getTimeFromFlightPoint(departurePoint);
						const isAfter = departureTime > arrivalTime;

						if (
							config.debugMode &&
							departurePoint.iataCode === selectedAirport
						) {
							const depTimeStr = getTimeStringFromFlightPoint(departurePoint);
							console.log(
								`[FR24-PROXY] 🛫 Abflug: ${flight.flightDesignator.fullFlightNumber} um ${depTimeStr} (nach ${arrivalTimeStr}? ${isAfter})`
							);
						}

						return isAfter;
					}
				);

				if (config.debugMode) {
					console.log(
						`[FR24-PROXY] ${sameDayDeparturesAfterArrival.length} weitere Abflüge nach letzter Ankunft`
					);
				}

				if (sameDayDeparturesAfterArrival.length === 0) {
					overnightArrival = lastArrivalFlight;
					console.log(`[FR24-PROXY] ✅ Übernachtung bestätigt!`);

					// Finde ersten Abflug am Tag 2
					const nextDayDeparturesFromAirport = nextDayFlights
						.filter((flight) => {
							const departurePoint = flight.flightPoints?.find(
								(p) => p.departurePoint
							);
							const matches =
								departurePoint && departurePoint.iataCode === selectedAirport;

							if (config.debugMode && matches) {
								console.log(
									`[FR24-PROXY] ✈️ Abflug am ${nextDate}: ${
										flight.flightDesignator.fullFlightNumber
									} von ${selectedAirport} um ${getTimeStringFromFlightPoint(
										departurePoint
									)}`
								);
							}

							return matches;
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
						const firstDepPoint = overnightDeparture.flightPoints.find(
							(p) => p.departurePoint
						);
						const firstDepTimeStr = getTimeStringFromFlightPoint(firstDepPoint);

						console.log(
							`[FR24-PROXY] ✅ Erster Abflug am ${nextDate} gefunden: ${overnightDeparture.flightDesignator.fullFlightNumber} um ${firstDepTimeStr}`
						);
					} else {
						console.log(
							`[FR24-PROXY] ❌ Kein Abflug am ${nextDate} von ${selectedAirport}`
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
