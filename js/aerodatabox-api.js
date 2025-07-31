/**
 * AeroDataBox API Integration
 * Spezialisiert auf das Abrufen von Flugdaten nach Flugzeugregistrierungen
 * Dokumentation: https://www.aerodatabox.com/docs/api
 */

const AeroDataBoxAPI = (() => {
	// Vereinfachte API-Konfiguration - nur AeroDataBox
	const config = {
		baseUrl: "https://aerodatabox.p.rapidapi.com",
		flightsEndpoint: "/flights",
		statusEndpoint: "/status",
		rapidApiHost: "aerodatabox.p.rapidapi.com",
		rapidApiKey: "b76afbf516mshf864818d919de86p10475ejsna65b718a8602", // Neuer RapidAPI Key
		debugMode: true, // Debug-Modus für zusätzliche Konsolenausgaben
		rateLimitDelay: 1200, // 1.2 Sekunden Verzögerung zwischen API-Anfragen
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
		if (options.rapidApiKey) config.rapidApiKey = options.rapidApiKey;

		if (config.debugMode) {
			console.log(
				`AeroDataBoxAPI initialisiert: nur AeroDataBox API aktiviert`
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
					`Rate Limiting: Warte ${waitTime}ms vor nächstem API-Aufruf`
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
			fetchStatus.textContent = message;
			fetchStatus.className = isError
				? "text-sm text-center text-status-red"
				: "text-sm text-center";
		}

		// Verwende window.showNotification für Status-Updates
		if (window.showNotification) {
			const notificationType = isError ? "error" : "info";
			window.showNotification(message, notificationType);
		}

		// Auch in der Konsole loggen
		if (config.debugMode) {
			isError ? console.error(message) : console.log(message);
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
	 * Konvertiert AeroDataBox API Daten in das einheitliche Format
	 * @param {Array|Object} aeroDataBoxData - Daten von der AeroDataBox API
	 * @param {string} aircraftRegistration - Flugzeugregistrierung
	 * @param {string} date - Abfragedatum
	 * @returns {Object} Vereinheitlichte Flugdaten
	 */
	const convertToUnifiedFormat = (
		aeroDataBoxData,
		aircraftRegistration,
		date
	) => {
		// Wenn keine Daten vorhanden sind oder ein leeres Array zurückgegeben wurde
		if (
			!aeroDataBoxData ||
			(Array.isArray(aeroDataBoxData) && aeroDataBoxData.length === 0)
		) {
			return { data: [] };
		}

		// Sicherstellen, dass wir mit einem Array arbeiten
		const flightsArray = Array.isArray(aeroDataBoxData)
			? aeroDataBoxData
			: [aeroDataBoxData];

		const formattedData = flightsArray
			.map((flight) => {
				try {
					// Extrahiere Flugdaten
					const departureIata = flight.departure?.airport?.iata || "???";
					const arrivalIata = flight.arrival?.airport?.iata || "???";

					// Zeiten formatieren - JETZT MIT UTC STATT LOCAL
					const departureTime = flight.departure?.scheduledTime?.utc
						? flight.departure.scheduledTime.utc.substring(11, 16) // Format HH:MM aus UTC ISO-Timestamp
						: "--:--";
					const arrivalTime = flight.arrival?.scheduledTime?.utc
						? flight.arrival.scheduledTime.utc.substring(11, 16) // Format HH:MM aus UTC ISO-Timestamp
						: "--:--";

					// Fluggesellschaft und Flugnummer
					const airline = flight.number?.slice(0, 2) || "";
					const flightNumber = flight.number?.slice(2) || "";

					// Flugzeugtyp und Registrierung
					const aircraftType = flight.aircraft?.model || "Unknown";
					const registration =
						flight.aircraft?.reg || aircraftRegistration || "";

					// Abflugdatum aus der API oder übergebenes Datum (JETZT MIT UTC)
					const scheduledDepartureDate = flight.departure?.scheduledTime?.utc
						? flight.departure.scheduledTime.utc.substring(0, 10) // Format YYYY-MM-DD aus UTC-Zeit
						: date;

					return {
						type: "DatedFlight",
						scheduledDepartureDate: scheduledDepartureDate,
						flightDesignator: {
							carrierCode: airline,
							flightNumber: flightNumber,
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
						_source: "aerodatabox",
						_rawFlightData: flight,
						_isUtc: true, // Flag zur Kennzeichnung, dass Zeiten in UTC sind
					};
				} catch (error) {
					console.error(
						"Fehler bei der Konvertierung eines AeroDataBox-Fluges:",
						error,
						flight
					);
					return null;
				}
			})
			.filter(Boolean); // Entferne null-Werte

		return { data: formattedData };
	};

	/**
	 * Macht die API-Anfrage für ein bestimmtes Flugzeug
	 * @param {string} aircraftRegistration - Flugzeugregistrierung (z.B. "D-AIBL")
	 * @param {string} date - Datum im Format YYYY-MM-DD
	 * @returns {Promise<Object>} Flugdaten
	 */
	const getAircraftFlights = async (aircraftRegistration, date) => {
		try {
			// Registrierung normalisieren
			const registration = aircraftRegistration.trim().toUpperCase();

			// Prüfen, ob das Datum in der Zukunft liegt (keine historischen Daten in der API)
			const queryDate = new Date(date);
			const today = new Date();
			today.setHours(0, 0, 0, 0);

			// Für Datumsanfragen in der Zukunft oder mehr als 1 Jahr zurück leeres Ergebnis zurückgeben
			if (
				queryDate > today.setFullYear(today.getFullYear() + 1) ||
				queryDate < today.setFullYear(today.getFullYear() - 1)
			) {
				if (config.debugMode) {
					console.log(
						`Datum ${date} ist weit in der Zukunft oder Vergangenheit, keine Daten für ${registration} verfügbar`
					);
				}
				updateFetchStatus(
					`Keine Daten verfügbar - Datum ${date} liegt außerhalb des gültigen Bereichs`,
					true
				);
				return { data: [] };
			}

			updateFetchStatus(`Verarbeite ${registration} - API-Anfrage läuft...`);

			// Standard AeroDataBox API - direkte Abfrage mit Datum im Pfad
			return await rateLimiter(async () => {
				// Direkte AeroDataBox API-Abfrage mit Datum im Pfad und dateLocalRole=Both
				const apiUrl = `${config.baseUrl}/flights/reg/${registration}/${date}?withAircraftImage=false&withLocation=true&dateLocalRole=Both`;

				if (config.debugMode) {
					console.log(`API-Anfrage URL: ${apiUrl}`);
				}

				// API-Anfrage durchführen mit RapidAPI-Headers
				const options = {
					method: "GET",
					headers: {
						"x-rapidapi-key": config.rapidApiKey,
						"x-rapidapi-host": config.rapidApiHost,
					},
				};

				const response = await fetch(apiUrl, options);

				if (!response.ok) {
					const errorText = await response.text();
					throw new Error(
						`API-Anfrage fehlgeschlagen: ${response.status} ${response.statusText}. Details: ${errorText}`
					);
				}

				// Prüfe, ob die Antwort Inhalt hat, bevor JSON-Parsing versucht wird
				const responseText = await response.text();

				if (!responseText || responseText.trim() === "") {
					console.warn(
						`Leere Antwort von der API für ${registration} im Zeitraum`
					);
					updateFetchStatus(
						`Verarbeite ${registration} - Suche alternative Datenquelle...`
					);

					// NEUER CODE: Alternative Abfrage ohne Datumsbeschränkung starten
					console.log(
						`[FALLBACK] Starte alternative API-Anfrage für ${registration} ohne Datumsbeschränkung`
					);

					// Direkter Endpunkt ohne Datum
					const fallbackUrl = `${config.baseUrl}/flights/reg/${registration}?withAircraftImage=false&withLocation=true`;

					try {
						updateFetchStatus(
							`Verarbeite ${registration} - Alternative API-Abfrage läuft...`
						);

						const fallbackResponse = await fetch(fallbackUrl, options);

						if (!fallbackResponse.ok) {
							console.warn(
								`[FALLBACK] Alternative Anfrage fehlgeschlagen: ${fallbackResponse.status}`
							);
							return { data: [] };
						}

						const fallbackData = await fallbackResponse.json();

						if (config.debugMode) {
							console.log(
								`[FALLBACK] Alternative API-Antwort für ${registration}:`,
								fallbackData
							);
						}

						// Prüfe, ob die Alternative Ergebnisse liefert
						if (
							!fallbackData ||
							(Array.isArray(fallbackData) && fallbackData.length === 0)
						) {
							console.warn(
								`[FALLBACK] Keine Daten gefunden in alternativer Anfrage`
							);
							return { data: [] };
						}

						// Filtere die Ergebnisse nach dem angeforderten Datum, falls möglich
						let filteredFlights = fallbackData;

						// Wenn es ein Array ist, filtern wir nach dem Datum
						if (Array.isArray(fallbackData)) {
							filteredFlights = fallbackData.filter((flight) => {
								// Prüfe, ob das Abflugdatum im UTC-Format dem angefragten Datum entspricht
								const flightDate =
									flight.departure?.scheduledTime?.utc?.substring(0, 10);
								return flightDate === date;
							});

							console.log(
								`[FALLBACK] ${filteredFlights.length} von ${fallbackData.length} Flügen passen zum Datum ${date}`
							);
						}

						// Falls keine passenden Flüge nach Datumsfilterung, verwende alle
						if (!filteredFlights.length && Array.isArray(fallbackData)) {
							console.log(
								`[FALLBACK] Keine Flüge für das Datum ${date} gefunden, verwende alle verfügbaren Flüge`
							);
							filteredFlights = fallbackData;
						}

						updateFetchStatus(
							`[FALLBACK] Alternative Abfrage für ${registration} erfolgreich: ${
								Array.isArray(filteredFlights) ? filteredFlights.length : 1
							} Flüge gefunden`
						);

						// Formatieren und zurückgeben
						return convertToUnifiedFormat(filteredFlights, registration, date);
					} catch (fallbackError) {
						console.error(
							`[FALLBACK] Fehler bei alternativer Abfrage:`,
							fallbackError
						);
						return { data: [] };
					}
				}

				let data;
				try {
					data = JSON.parse(responseText);
				} catch (jsonError) {
					console.error(
						`JSON-Parsing-Fehler für ${registration}:`,
						jsonError,
						`Antwortinhalt: ${responseText.substring(0, 100)}...`
					);
					updateFetchStatus(
						`Fehlerhafte JSON-Daten für ${registration} im Zeitraum`,
						false
					);
					// Leeres Ergebnisobjekt zurückgeben
					return { data: [] };
				}

				if (config.debugMode) {
					console.log(`AeroDataBox API-Antwort für ${registration}:`, data);
				}

				// Wenn keine Daten oder leeres Array zurückgegeben wurde, versuche die alternative Abfrage
				if (!data || (Array.isArray(data) && data.length === 0)) {
					console.log(
						`[HAUPTANFRAGE] Keine Daten für ${registration} am ${date} gefunden, starte Fallback...`
					);

					// Aufruf der alternativen Abfrage (gleicher Code wie oben)
					const fallbackUrl = `${config.baseUrl}/flights/reg/${registration}?withAircraftImage=false&withLocation=true`;

					try {
						// ...ähnlicher Code wie oben...
						const fallbackResponse = await fetch(fallbackUrl, options);

						if (!fallbackResponse.ok) {
							console.warn(
								`[FALLBACK] Alternative Anfrage fehlgeschlagen: ${fallbackResponse.status}`
							);
							return { data: [] };
						}

						const fallbackData = await fallbackResponse.json();

						if (config.debugMode) {
							console.log(
								`[FALLBACK] Alternative API-Antwort für ${registration}:`,
								fallbackData
							);
						}

						// Prüfe, ob die Alternative Ergebnisse liefert
						if (
							!fallbackData ||
							(Array.isArray(fallbackData) && fallbackData.length === 0)
						) {
							console.warn(
								`[FALLBACK] Keine Daten gefunden in alternativer Anfrage`
							);
							return { data: [] };
						}

						// Filtere die Ergebnisse nach dem angeforderten Datum, falls möglich
						let filteredFlights = fallbackData;

						// Wenn es ein Array ist, filtern wir nach dem Datum
						if (Array.isArray(fallbackData)) {
							filteredFlights = fallbackData.filter((flight) => {
								// Prüfe, ob das Abflugdatum im UTC-Format dem angefragten Datum entspricht
								const flightDate =
									flight.departure?.scheduledTime?.utc?.substring(0, 10);
								return flightDate === date;
							});

							console.log(
								`[FALLBACK] ${filteredFlights.length} von ${fallbackData.length} Flügen passen zum Datum ${date}`
							);
						}

						// Falls keine passenden Flüge nach Datumsfilterung, verwende alle
						if (!filteredFlights.length && Array.isArray(fallbackData)) {
							console.log(
								`[FALLBACK] Keine Flüge für das Datum ${date} gefunden, verwende alle verfügbaren Flüge`
							);
							filteredFlights = fallbackData;
						}

						updateFetchStatus(
							`[FALLBACK] Alternative Abfrage für ${registration} erfolgreich: ${
								Array.isArray(filteredFlights) ? filteredFlights.length : 1
							} Flüge gefunden`
						);

						// Formatieren und zurückgeben
						return convertToUnifiedFormat(filteredFlights, registration, date);
					} catch (fallbackError) {
						console.error(
							`[FALLBACK] Fehler bei alternativer Abfrage:`,
							fallbackError
						);
						return { data: [] };
					}
				}

				// Formatieren der Antwort in ein einheitliches Format
				return convertToUnifiedFormat(data, registration, date);
			});
		} catch (error) {
			console.error(
				`Fehler bei API-Anfrage für ${aircraftRegistration}:`,
				error
			);
			updateFetchStatus(
				`Fehler: ${aircraftRegistration} - ${error.message}`,
				true
			);

			// Bei Fehlern leeres Datenarray zurückgeben
			return { data: [] };
		}
	};

	/**
	 * Extrahiert eine numerische Zeitangabe aus einem Flugpunkt für die Sortierung
	 * Berücksichtigt, ob die Zeit als UTC markiert ist
	 * @param {Object} flightPoint - Der Flugpunkt (Ankunft oder Abflug)
	 * @returns {number} Numerische Repräsentation der Zeit für Sortierung
	 */
	const getTimeFromFlightPoint = (flightPoint) => {
		if (!flightPoint) return 0;

		try {
			let timeStr;
			// Für Abflugpunkt
			if (
				flightPoint.departurePoint &&
				flightPoint.departure &&
				flightPoint.departure.timings &&
				flightPoint.departure.timings.length
			) {
				timeStr = flightPoint.departure.timings[0].value;
				// Wir gehen davon aus, dass alle Zeiten in UTC sind (aufgrund der Anpassungen in convertToUnifiedFormat)
			}
			// Für Ankunftspunkt
			else if (
				flightPoint.arrivalPoint &&
				flightPoint.arrival &&
				flightPoint.arrival.timings &&
				flightPoint.arrival.timings.length
			) {
				timeStr = flightPoint.arrival.timings[0].value;
				// Wir gehen davon aus, dass alle Zeiten in UTC sind (aufgrund der Anpassungen in convertToUnifiedFormat)
			} else {
				return 0;
			}

			// Extrahiere Stunden und Minuten und konvertiere in einen numerischen Wert
			const timeParts = timeStr.substring(0, 5).split(":");
			return parseInt(timeParts[0]) * 60 + parseInt(timeParts[1]);
		} catch (error) {
			console.error("Fehler bei der Zeitextraktion:", error);
			return 0;
		}
	};

	/**
	 * Extrahiert einen Zeit-String aus einem Flugpunkt
	 * @param {Object} flightPoint - Der Flugpunkt (Ankunft oder Abflug)
	 * @returns {string} Zeit im Format HH:MM
	 */
	const getTimeStringFromFlightPoint = (flightPoint) => {
		if (!flightPoint) return "--:--";

		try {
			let timeStr;
			let isUtc = false;

			// Für Abflugpunkt
			if (
				flightPoint.departurePoint &&
				flightPoint.departure &&
				flightPoint.departure.timings &&
				flightPoint.departure.timings.length
			) {
				timeStr = flightPoint.departure.timings[0].value;
				isUtc = flightPoint.departure.timings[0].isUtc || false;
			}
			// Für Ankunftspunkt
			else if (
				flightPoint.arrivalPoint &&
				flightPoint.arrival &&
				flightPoint.arrival.timings &&
				flightPoint.arrival.timings.length
			) {
				timeStr = flightPoint.arrival.timings[0].value;
				isUtc = flightPoint.arrival.timings[0].isUtc || false;
			} else {
				return "--:--";
			}

			// Extrahiere Stunden und Minuten und füge UTC-Kennzeichnung hinzu wenn nötig
			const timeValue = timeStr.substring(0, 5);
			return isUtc ? `${timeValue} UTC` : timeValue;
		} catch (error) {
			console.error("Fehler bei der Zeitextraktion:", error);
			return "--:--";
		}
	};

	/**
	 * Sucht Flugdaten für ein Flugzeug - VEREINFACHTE VERSION mit expliziten Abfragen für zwei Tage
	 * @param {string} aircraftId - Flugzeugkennung (Registrierung)
	 * @param {string} currentDate - Das aktuelle Datum für die Ankunft (letzter Flug)
	 * @param {string} nextDate - Das Folgedatum für den Abflug (erster Flug)
	 * @returns {Promise<Object>} Flugdaten mit letztem Ankunftsflug und erstem Abflugsflug
	 */
	const updateAircraftData = async (aircraftId, currentDate, nextDate) => {
		if (!aircraftId) {
			updateFetchStatus("Bitte Flugzeugkennung eingeben", true);
			// KORREKTUR: Leere Werte mit Clear-Flag zurückgeben, damit die Anwendung die Felder zurücksetzen kann
			return {
				originCode: "",
				destCode: "",
				departureTime: "",
				arrivalTime: "",
				positionText: "",
				data: [],
				_isUtc: true,
				_noDataFound: true, // Flag für "keine Daten gefunden"
				_clearFields: true, // Flag für UI-Clearing
			};
		}

		// Standardwerte für Daten verwenden, falls nicht angegeben
		const today = formatDate(new Date());
		const tomorrow = formatDate(
			new Date(new Date().setDate(new Date().getDate() + 1))
		);

		currentDate = currentDate || today;
		nextDate = nextDate || tomorrow;

		console.log(
			`AeroDataBoxAPI: Suche Flugdaten für ${aircraftId} - EXPLIZIT an zwei Tagen: ${currentDate} und ${nextDate}`
		);
		updateFetchStatus(`Verarbeite ${aircraftId} - Starte Datenabfrage...`);

		try {
			// Hole den aktuell ausgewählten Flughafen für die Filterung
			const selectedAirport =
				document.getElementById("airportCodeInput")?.value || "MUC";

			if (config.debugMode) {
				console.log(`Gewählter Flughafen für Filterung: ${selectedAirport}`);
			}

			// VEREINFACHT: Zwei separate API-Abfragen für die beiden Tage
			console.log(
				`[EXPLIZITE ABFRAGE 1] Suche nach Flügen für ${aircraftId} am ${currentDate}`
			);
			updateFetchStatus(
				`[1/2] Suche Flüge für ${aircraftId} am ${currentDate}...`
			);

			// Erste Abfrage - aktueller Tag
			const currentDayResponse = await getAircraftFlights(
				aircraftId,
				currentDate
			);
			const currentDayFlights = currentDayResponse?.data || [];

			console.log(
				`[EXPLIZITE ABFRAGE 2] Suche nach Flügen für ${aircraftId} am ${nextDate}`
			);
			updateFetchStatus(
				`[2/2] Suche Flüge für ${aircraftId} am ${nextDate}...`
			);

			// Zweite Abfrage - Folgetag
			const nextDayResponse = await getAircraftFlights(aircraftId, nextDate);
			const nextDayFlights = nextDayResponse?.data || [];

			console.log(
				`[ERGEBNISSE] Gefunden: ${currentDayFlights.length} Flüge am ${currentDate} und ${nextDayFlights.length} Flüge am ${nextDate}`
			);

			// Separate Flüge zum und vom ausgewählten Flughafen
			let arrivalFlights = [];
			let departureFlights = [];

			// Flüge filtern für Ankunft am ausgewählten Flughafen am aktuellen Tag
			currentDayFlights.forEach((flight) => {
				// Datum-Tags für die spätere Erkennung von Folgetags-Flügen hinzufügen
				flight._currentDateRequested = currentDate;
				flight._nextDateRequested = nextDate;

				// Stelle sicher, dass _isUtc Flag gesetzt ist
				flight._isUtc = true;

				if (flight.flightPoints && flight.flightPoints.length >= 2) {
					const arrivalPoint = flight.flightPoints.find((p) => p.arrivalPoint);

					// Prüfen, ob der Flug zum ausgewählten Flughafen geht (Ankunft)
					if (arrivalPoint && arrivalPoint.iataCode === selectedAirport) {
						arrivalFlights.push(flight);
					}
				}
			});

			// Flüge filtern für Abflug vom ausgewählten Flughafen am Folgetag
			nextDayFlights.forEach((flight) => {
				// Datum-Tags für die spätere Erkennung von Folgetags-Flügen hinzufügen
				flight._currentDateRequested = currentDate;
				flight._nextDateRequested = nextDate;

				// Stelle sicher, dass _isUtc Flag gesetzt ist
				flight._isUtc = true;

				if (flight.flightPoints && flight.flightPoints.length >= 2) {
					const departurePoint = flight.flightPoints.find(
						(p) => p.departurePoint
					);

					// Prüfen, ob der Flug vom ausgewählten Flughafen kommt (Abflug)
					if (departurePoint && departurePoint.iataCode === selectedAirport) {
						departureFlights.push(flight);
					}
				}
			});

			// Debug-Info über gefundene Flüge mit Details
			console.log(
				`Gefilterte Ankünfte am ${selectedAirport} (${currentDate}): ${arrivalFlights.length}`
			);
			if (config.debugMode && arrivalFlights.length > 0) {
				console.log(`📥 === ANKUNFTSFLÜGE AM ${currentDate} ===`);
				arrivalFlights.forEach((flight, index) => {
					const arrivalPoint = flight.flightPoints.find((p) => p.arrivalPoint);
					const departurePoint = flight.flightPoints.find(
						(p) => p.departurePoint
					);
					const arrTime = getTimeStringFromFlightPoint(arrivalPoint);
					console.log(
						`${index + 1}. ${departurePoint?.iataCode || "???"} → ${
							arrivalPoint?.iataCode || "???"
						} um ${arrTime}`
					);
				});
			}

			console.log(
				`Gefilterte Abflüge von ${selectedAirport} (${nextDate}): ${departureFlights.length}`
			);
			if (config.debugMode && departureFlights.length > 0) {
				console.log(`📤 === ABFLUGFLÜGE AM ${nextDate} ===`);
				departureFlights.forEach((flight, index) => {
					const arrivalPoint = flight.flightPoints.find((p) => p.arrivalPoint);
					const departurePoint = flight.flightPoints.find(
						(p) => p.departurePoint
					);
					const depTime = getTimeStringFromFlightPoint(departurePoint);
					console.log(
						`${index + 1}. ${departurePoint?.iataCode || "???"} → ${
							arrivalPoint?.iataCode || "???"
						} um ${depTime}`
					);
				});
			}

			// Sortieren der Ankunftsflüge nach Zeit (späteste zuerst)
			arrivalFlights.sort((a, b) => {
				const timeA = getTimeFromFlightPoint(
					a.flightPoints.find((p) => p.arrivalPoint)
				);
				const timeB = getTimeFromFlightPoint(
					b.flightPoints.find((p) => p.arrivalPoint)
				);
				// Absteigende Sortierung für Ankünfte (späteste zuerst)
				return timeB - timeA;
			});

			// Sortieren der Abflüge nach Zeit (früheste zuerst)
			departureFlights.sort((a, b) => {
				const timeA = getTimeFromFlightPoint(
					a.flightPoints.find((p) => p.departurePoint)
				);
				const timeB = getTimeFromFlightPoint(
					b.flightPoints.find((p) => p.departurePoint)
				);
				// Aufsteigende Sortierung für Abflüge (früheste zuerst)
				return timeA - timeB;
			});

			// Die relevanten Flüge auswählen (letzter Ankunftsflug, erster Abflugsflug)
			const lastArrival = arrivalFlights.length > 0 ? arrivalFlights[0] : null;
			const firstDeparture =
				departureFlights.length > 0 ? departureFlights[0] : null;

			// Debug-Information zu den ausgewählten Flügen
			if (config.debugMode) {
				console.log(`🎯 === FINALE AUSWAHL FÜR ${aircraftId} ===`);
			}

			if (lastArrival) {
				const arrivalPoint = lastArrival.flightPoints.find(
					(p) => p.arrivalPoint
				);
				const departurePoint = lastArrival.flightPoints.find(
					(p) => p.departurePoint
				);
				const arrTimeStr = getTimeStringFromFlightPoint(arrivalPoint);
				console.log(
					`🛬 LETZTER Ankunftsflug am ${currentDate}: Von ${
						departurePoint?.iataCode || "---"
					} nach ${arrivalPoint?.iataCode || "---"} um ${arrTimeStr}` // UTC-Kennzeichnung bereits in getTimeStringFromFlightPoint
				);
			} else {
				console.log(
					`🛬 Kein passender Ankunftsflug am ${currentDate} gefunden`
				);
			}

			if (firstDeparture) {
				const departurePoint = firstDeparture.flightPoints.find(
					(p) => p.departurePoint
				);
				const arrivalPoint = firstDeparture.flightPoints.find(
					(p) => p.arrivalPoint
				);
				const depTimeStr = getTimeStringFromFlightPoint(departurePoint);
				console.log(
					`🛫 ERSTER Abflugsflug am ${nextDate}: Von ${
						departurePoint?.iataCode || "---"
					} nach ${arrivalPoint?.iataCode || "---"} um ${depTimeStr}` // UTC-Kennzeichnung bereits in getTimeStringFromFlightPoint
				);
			} else {
				console.log(`🛫 Kein passender Abflugsflug am ${nextDate} gefunden`);
			}

			if (config.debugMode) {
				console.log(`🎯 === ENDE FINALE AUSWAHL ===`);
			}

			// Wenn keine passenden Flüge gefunden wurden
			if (!lastArrival && !firstDeparture) {
				updateFetchStatus(
					`Keine Flüge für ${aircraftId} an Flughafen ${selectedAirport} gefunden`,
					false
				);

				// KORREKTUR: Explizite Markierung für "keine Daten gefunden"
				// und aktiviertes Löschen der UI-Felder
				return {
					originCode: "",
					destCode: "",
					departureTime: "",
					arrivalTime: "",
					positionText: "",
					data: [],
					_noDataFound: true, // Flag für "keine Daten gefunden"
					_clearFields: true, // Flag für UI-Clearing
				};
			}

			// Flugdaten für die Rückgabe vorbereiten
			const selectedFlights = [];
			if (lastArrival) selectedFlights.push(lastArrival);
			if (firstDeparture) selectedFlights.push(firstDeparture);

			// Ergebnisse aufbereiten
			const result = {
				originCode: "---",
				destCode: "---",
				departureTime: "--:--",
				arrivalTime: "--:--",
				positionText: "---",
				data: selectedFlights,
				_isUtc: true, // Explizites Flag für UTC-Zeiten setzen
			};

			// Daten aus den ausgewählten Flügen extrahieren
			if (lastArrival) {
				const arrivalPoint = lastArrival.flightPoints.find(
					(p) => p.arrivalPoint
				);
				const departurePoint = lastArrival.flightPoints.find(
					(p) => p.departurePoint
				);

				if (arrivalPoint) {
					result.destCode = arrivalPoint.iataCode || "---";
					let arrivalTimeStr = getTimeStringFromFlightPoint(arrivalPoint);
					// Entferne "UTC" für die interne Darstellung
					result.arrivalTime = arrivalTimeStr.replace(" UTC", "");
				}

				if (departurePoint) {
					result.originCode = departurePoint.iataCode || "---";
				}
			}

			if (firstDeparture) {
				const departurePoint = firstDeparture.flightPoints.find(
					(p) => p.departurePoint
				);
				const arrivalPoint = firstDeparture.flightPoints.find(
					(p) => p.arrivalPoint
				);

				if (departurePoint) {
					if (lastArrival) {
						// Wenn beide Flüge vorhanden sind, behält der Abflugsflug seine eigene originCode
						let departureTimeStr = getTimeStringFromFlightPoint(departurePoint);
						// Entferne "UTC" für die interne Darstellung
						result.departureTime = departureTimeStr.replace(" UTC", "");
					} else {
						// Wenn kein lastArrival vorhanden ist, verwende firstDeparture als Quelle für originCode
						result.originCode = departurePoint.iataCode || "---";
						let departureTimeStr = getTimeStringFromFlightPoint(departurePoint);
						// Entferne "UTC" für die interne Darstellung
						result.departureTime = departureTimeStr.replace(" UTC", "");
					}
				}

				if (arrivalPoint && !lastArrival) {
					result.destCode = arrivalPoint.iataCode || "---";
				}
			}

			// Positionstext formatieren - präziser mit Datumsangaben
			if (result.originCode !== "---" || result.destCode !== "---") {
				if (lastArrival && firstDeparture) {
					// Wenn beide Flüge bekannt sind - vollständige Information
					result.positionText = `${result.originCode} → ${result.destCode}`;
				} else if (lastArrival) {
					// Nur Ankunft bekannt
					result.positionText = `Ankunft: ${result.originCode} → ${result.destCode}`;
				} else if (firstDeparture) {
					// Nur Abflug bekannt
					result.positionText = `Abflug: ${result.originCode} → ${result.destCode}`;
				}
			}

			// Erfolgreiche Anfrage-Zusammenfassung
			console.log(
				`Flugdaten verarbeitet für ${aircraftId}: ${currentDate} und ${nextDate}`
			);
			updateFetchStatus(
				`${aircraftId} erfolgreich verarbeitet: ${result.positionText}`,
				false
			);

			return result;
		} catch (error) {
			console.error(
				"AeroDataBoxAPI: Fehler beim Abrufen der Flugdaten:",
				error
			);
			updateFetchStatus(
				`Fehler beim Abrufen der Flugdaten: ${error.message || error}`,
				true
			);

			// KORREKTUR: Bei Fehlern leere Werte mit Clear-Flag zurückgeben
			return {
				originCode: "",
				destCode: "",
				departureTime: "",
				arrivalTime: "",
				positionText: "",
				data: [],
				_noDataFound: true, // Flag für "keine Daten gefunden"
				_clearFields: true, // Flag für UI-Clearing
			};
		}
	};

	/**
	 * Ruft Flugdaten für einen Flughafen ab (neue Implementierung basierend auf gewünschter API-Struktur)
	 * @param {string} airportCode - IATA-Code des Flughafens (z.B. "MUC")
	 * @param {string} startDateTime - Startzeit für die Abfrage (Format: YYYY-MM-DDTHH:MM)
	 * @param {string} endDateTime - Endzeit für die Abfrage (Format: YYYY-MM-DDTHH:MM)
	 * @returns {Promise<Object>} Flughafenflüge
	 */
	const getAirportFlights = async (
		airportCode,
		startDateTime = null,
		endDateTime = null
	) => {
		// Standardwerte für Zeiten wenn nicht angegeben
		if (!startDateTime) {
			const now = new Date();
			now.setHours(20, 0, 0, 0); // 20:00 heute
			startDateTime = now.toISOString().slice(0, 16); // Format YYYY-MM-DDTHH:MM
		}
		if (!endDateTime) {
			const tomorrow = new Date();
			tomorrow.setDate(tomorrow.getDate() + 1);
			tomorrow.setHours(8, 0, 0, 0); // 08:00 morgen
			endDateTime = tomorrow.toISOString().slice(0, 16); // Format YYYY-MM-DDTHH:MM
		}

		try {
			const normalizedAirport = airportCode.trim().toUpperCase();
			updateFetchStatus(
				`Flüge für Flughafen ${normalizedAirport} von ${startDateTime} bis ${endDateTime} werden abgefragt...`
			);

			// Neue API-Struktur wie gewünscht
			return await rateLimiter(async () => {
				const url = `${config.baseUrl}/flights/airports/iata/${normalizedAirport}/${startDateTime}/${endDateTime}?withLeg=true&direction=Both&withCancelled=true&withCodeshared=true&withCargo=true&withPrivate=true&withLocation=false`;

				const options = {
					method: "GET",
					headers: {
						"x-rapidapi-key": config.rapidApiKey,
						"x-rapidapi-host": config.rapidApiHost,
					},
				};

				if (config.debugMode) {
					console.log(`AeroDataBox API-Anfrage URL: ${url}`);
				}

				const response = await fetch(url, options);

				if (!response.ok) {
					const errorText = await response.text();
					throw new Error(
						`API-Anfrage fehlgeschlagen: ${response.status} ${response.statusText}. Details: ${errorText}`
					);
				}

				const result = await response.json();

				if (config.debugMode) {
					console.log(
						`AeroDataBox API-Antwort für ${normalizedAirport}:`,
						result
					);
				}

				return result;
			});
		} catch (error) {
			console.error(
				`Fehler bei API-Anfrage für Flughafen ${airportCode}:`,
				error
			);
			updateFetchStatus(
				`Fehler bei der Flughafenabfrage: ${error.message}`,
				true
			);

			// Bei Fehlern leere Arrays zurückgeben
			return { departures: [], arrivals: [] };
		}
	};

	/**
	 * NEUE OPTIMIERTE HAUPTFUNKTION
	 * Sammelt alle Aircraft IDs aus den Kacheln und ruft für jede die entsprechenden Flugdaten ab
	 * EFFIZIENTER ANSATZ: Erst eine Flughafen-Abfrage, dann alle Aircraft IDs darauf prüfen
	 * @param {string} airportCode - IATA-Code des Flughafens (z.B. "MUC")
	 * @param {string} startDateTime - Startzeit für die Abfrage (Format: YYYY-MM-DDTHH:MM)
	 * @param {string} endDateTime - Endzeit für die Abfrage (Format: YYYY-MM-DDTHH:MM)
	 * @returns {Promise<void>} Promise, das nach Abschluss aller Updates resolved wird
	 */
	const updateFlightDataForAllAircraft = async (
		airportCode,
		startDateTime,
		endDateTime
	) => {
		try {
			// Visuelle Statusanzeige initialisieren
			if (window.FlightDataStatusDisplay) {
				window.FlightDataStatusDisplay.show(
					"Sammle Aircraft IDs aus Kacheln...",
					{
						airport: airportCode,
						aircraftCount: 0,
						currentStatus: "Initialisiere...",
					}
				);
			}

			updateFetchStatus("🔍 Sammle Aircraft IDs aus Kacheln...", false, {
				airport: airportCode,
				currentStatus: "Sammle Aircraft IDs...",
			});

			// SCHRITT 1: Alle Aircraft IDs aus den Kacheln sammeln
			const aircraftIds = [];
			const aircraftInputs = document.querySelectorAll(
				'input[id^="aircraft-"]'
			);

			aircraftInputs.forEach((input) => {
				const aircraftId = input.value.trim().toUpperCase();
				if (aircraftId && aircraftId !== "") {
					aircraftIds.push({
						id: aircraftId,
						cellNumber: input.id.split("-")[1],
					});
				}
			});

			if (aircraftIds.length === 0) {
				const errorMessage = "❌ Keine Aircraft IDs in den Kacheln gefunden";
				updateFetchStatus(errorMessage, true, {
					airport: airportCode,
					aircraftCount: 0,
					currentStatus: "Fehler - Keine Aircraft IDs",
				});
				return;
			}

			console.log(
				`🎯 Gefundene Aircraft IDs: ${aircraftIds.map((a) => a.id).join(", ")}`
			);

			// Schritt 1 abgeschlossen - Update Fortschritt
			if (window.FlightDataStatusDisplay) {
				window.FlightDataStatusDisplay.showStep(
					`${aircraftIds.length} Aircraft IDs gefunden`,
					1,
					3,
					{
						airport: airportCode,
						aircraftCount: aircraftIds.length,
						currentStatus: "Aircraft IDs gesammelt",
					}
				);
			}

			updateFetchStatus(
				`🎯 ${aircraftIds.length} Aircraft IDs gefunden. Flughafen-Abfrage wird gestartet...`,
				false,
				{
					airport: airportCode,
					aircraftCount: aircraftIds.length,
					currentStatus: "Starte Flughafen-Abfrage...",
				}
			);

			// SCHRITT 2: EINE einzige effiziente Flughafen-Abfrage für den Zeitraum
			console.log(
				`✈️ Starte EINE API-Abfrage für Flughafen ${airportCode}: ${startDateTime} bis ${endDateTime}`
			);

			// Schritt 2 - API-Abfrage
			if (window.FlightDataStatusDisplay) {
				window.FlightDataStatusDisplay.showStep(
					`Lade Flugdaten von Flughafen ${airportCode}...`,
					2,
					3,
					{
						airport: airportCode,
						aircraftCount: aircraftIds.length,
						currentStatus: "API-Abfrage läuft...",
					}
				);
			}

			const flightData = await getAirportFlights(
				airportCode,
				startDateTime,
				endDateTime
			);

			if (
				!flightData ||
				(!flightData.departures &&
					!flightData.arrivals &&
					!Array.isArray(flightData))
			) {
				const errorMessage = "❌ Keine Flugdaten vom Flughafen erhalten";
				updateFetchStatus(errorMessage, true, {
					airport: airportCode,
					aircraftCount: aircraftIds.length,
					currentStatus: "Fehler - Keine Flugdaten",
				});
				return;
			}

			// SCHRITT 3: Alle Flüge in einem Array sammeln (sowohl departures als auch arrivals)
			let allFlights = [];
			if (Array.isArray(flightData)) {
				allFlights = flightData;
			} else {
				if (flightData.departures)
					allFlights = allFlights.concat(flightData.departures);
				if (flightData.arrivals)
					allFlights = allFlights.concat(flightData.arrivals);
			}

			console.log(
				`📊 Insgesamt ${allFlights.length} Flüge vom Flughafen ${airportCode} erhalten`
			);

			if (config.debugMode) {
				// DEBUG: Sammle und zeige alle Aircraft Registrierungen
				const allAircraftRegs = allFlights
					.map((flight) => {
						const reg =
							flight.aircraft?.reg ||
							flight.aircraft?.registration ||
							flight.aircraft?.tail ||
							flight.aircraftRegistration ||
							flight.registration;
						return reg ? reg.toUpperCase() : null;
					})
					.filter((reg) => reg !== null);

				const uniqueRegs = [...new Set(allAircraftRegs)];
				console.log(
					`🔍 Gefundene Aircraft Registrierungen am Flughafen (${uniqueRegs.length} unique):`,
					uniqueRegs.slice(0, 20)
				);

				// Zeige welche Aircraft IDs wir suchen
				const searchIds = aircraftIds.map((a) => a.id);
				console.log(`🎯 Gesuchte Aircraft IDs:`, searchIds);

				// Zeige Matches vorab
				const matches = searchIds.filter((searchId) =>
					uniqueRegs.some((reg) => reg === searchId)
				);
				console.log(
					`✅ Direkte Matches gefunden: ${matches.length} von ${searchIds.length}`,
					matches
				);
			}

			// SCHRITT 4: Für jede Aircraft ID die passenden Flüge suchen und eintragen
			let successfulUpdates = 0;

			// Schritt 3 - Verarbeitung der Aircraft IDs
			if (window.FlightDataStatusDisplay) {
				window.FlightDataStatusDisplay.showStep(
					`Verarbeite ${aircraftIds.length} Aircraft IDs...`,
					3,
					3,
					{
						airport: airportCode,
						aircraftCount: aircraftIds.length,
						currentStatus: "Verarbeite Aircraft...",
					}
				);
			}

			updateFetchStatus(
				`🔄 Verarbeite ${aircraftIds.length} Aircraft IDs...`,
				false,
				{
					airport: airportCode,
					aircraftCount: aircraftIds.length,
					currentStatus: "Verarbeite Aircraft...",
				}
			);

			for (let i = 0; i < aircraftIds.length; i++) {
				const aircraft = aircraftIds[i];

				// Update Fortschritt während der Verarbeitung
				const progressMessage = `Verarbeite ${aircraft.id} (${i + 1}/${
					aircraftIds.length
				})...`;
				updateFetchStatus(progressMessage, false, {
					airport: airportCode,
					aircraftCount: aircraftIds.length,
					currentStatus: `Aircraft ${i + 1}/${aircraftIds.length}`,
				});

				const updated = await processAircraftFlights(
					aircraft,
					allFlights,
					startDateTime,
					endDateTime
				);
				if (updated) successfulUpdates++;
			}

			// Endresultat anzeigen
			if (successfulUpdates > 0) {
				const successMessage = `✅ Flugdaten für ${successfulUpdates}/${aircraftIds.length} Aircraft erfolgreich aktualisiert`;

				if (window.FlightDataStatusDisplay) {
					window.FlightDataStatusDisplay.showSuccess(successMessage, {
						airport: airportCode,
						aircraftCount: aircraftIds.length,
						currentStatus: `${successfulUpdates} Aircraft aktualisiert`,
					});
				}

				updateFetchStatus(successMessage, false, {
					airport: airportCode,
					aircraftCount: aircraftIds.length,
					currentStatus: "Erfolgreich abgeschlossen",
				});
			} else {
				const warningMessage = `⚠️ Keine passenden Flüge für die ${aircraftIds.length} Aircraft IDs gefunden`;

				if (window.FlightDataStatusDisplay) {
					window.FlightDataStatusDisplay.showError(
						warningMessage,
						{
							airport: airportCode,
							aircraftCount: aircraftIds.length,
							currentStatus: "Keine Matches gefunden",
						},
						4000
					);
				}

				updateFetchStatus(warningMessage, false, {
					airport: airportCode,
					aircraftCount: aircraftIds.length,
					currentStatus: "Keine Matches",
				});
			}
		} catch (error) {
			console.error("❌ Fehler beim Update der Flugdaten:", error);

			const errorMessage = `❌ Fehler beim Update der Flugdaten: ${error.message}`;

			if (window.FlightDataStatusDisplay) {
				window.FlightDataStatusDisplay.showError(errorMessage, {
					airport: airportCode,
					aircraftCount: 0,
					currentStatus: "Fehler aufgetreten",
				});
			}

			updateFetchStatus(errorMessage, true, {
				airport: airportCode,
				currentStatus: "Fehler",
			});
		}
	};

	/**
	 * VERBESSERTE Verarbeitung der Flugdaten für eine spezifische Aircraft ID
	 * @param {Object} aircraft - Objekt mit id und cellNumber
	 * @param {Array} allFlights - Array aller Flüge vom Flughafen
	 * @param {string} startDateTime - Startzeit der Abfrage (YYYY-MM-DDTHH:MM)
	 * @param {string} endDateTime - Endzeit der Abfrage (YYYY-MM-DDTHH:MM)
	 * @returns {boolean} - True wenn Flugdaten gefunden und gesetzt wurden
	 */
	const processAircraftFlights = async (
		aircraft,
		allFlights,
		startDateTime,
		endDateTime
	) => {
		try {
			if (config.debugMode) {
				console.log(
					`\n🔍 === VERARBEITE AIRCRAFT ${aircraft.id} (Kachel ${aircraft.cellNumber}) ===`
				);
			}

			// Nach Flügen mit dieser Aircraft Registration suchen
			const matchingFlights = allFlights.filter((flight) => {
				// Verschiedene mögliche Felder für Aircraft Registration prüfen
				const aircraftReg =
					flight.aircraft?.reg ||
					flight.aircraft?.registration ||
					flight.aircraft?.tail ||
					flight.aircraftRegistration ||
					flight.registration;

				return aircraftReg && aircraftReg.toUpperCase() === aircraft.id;
			});

			if (config.debugMode) {
				console.log(
					`📊 Gefundene Matches: ${matchingFlights.length} von ${allFlights.length} Flügen`
				);
			}

			if (matchingFlights.length === 0) {
				if (config.debugMode) {
					console.log(`❌ Keine Flüge für Aircraft ${aircraft.id} gefunden`);
				}
				return false;
			}

			// Zeitfenster parsen
			const startTime = new Date(startDateTime);
			const endTime = new Date(endDateTime);

			// Flüge im spezifischen Zeitfenster filtern und nach Zeit sortieren
			const relevantFlights = matchingFlights
				.filter((flight) => {
					// Prüfe sowohl Abflug- als auch Ankunftszeit
					const depTime = flight.departure?.scheduledTime?.utc
						? new Date(flight.departure.scheduledTime.utc)
						: null;
					const arrTime = flight.arrival?.scheduledTime?.utc
						? new Date(flight.arrival.scheduledTime.utc)
						: null;

					// Flug ist relevant, wenn Abflug oder Ankunft im Zeitfenster liegt
					const depInRange =
						depTime && depTime >= startTime && depTime <= endTime;
					const arrInRange =
						arrTime && arrTime >= startTime && arrTime <= endTime;

					return depInRange || arrInRange;
				})
				.sort((a, b) => {
					// Sortiere nach der relevanten Zeit (Abflug oder Ankunft, je nachdem was im Zeitfenster liegt)
					const getRelevantTime = (flight) => {
						const depTime = flight.departure?.scheduledTime?.utc
							? new Date(flight.departure.scheduledTime.utc)
							: null;
						const arrTime = flight.arrival?.scheduledTime?.utc
							? new Date(flight.arrival.scheduledTime.utc)
							: null;

						if (depTime && depTime >= startTime && depTime <= endTime)
							return depTime;
						if (arrTime && arrTime >= startTime && arrTime <= endTime)
							return arrTime;
						return depTime || arrTime || new Date(0);
					};

					return getRelevantTime(a) - getRelevantTime(b);
				});

			if (config.debugMode) {
				console.log(
					`🕒 ${relevantFlights.length} Flüge von Aircraft ${aircraft.id} liegen im Zeitfenster ${startDateTime} bis ${endDateTime}`
				);

				// DEBUG: Alle gefundenen Flüge mit Zeiten anzeigen
				console.log(`📋 === ALLE FLÜGE FÜR ${aircraft.id} ===`);
				relevantFlights.forEach((flight, index) => {
					const depTime = flight.departure?.scheduledTime?.utc;
					const arrTime = flight.arrival?.scheduledTime?.utc;
					const depAirport = flight.departure?.airport?.iata || "???";
					const arrAirport = flight.arrival?.airport?.iata || "???";

					console.log(`${index + 1}. ${depAirport} → ${arrAirport}`);
					if (depTime)
						console.log(
							`   📤 Abflug: ${depTime.substring(
								11,
								16
							)} UTC am ${depTime.substring(0, 10)}`
						);
					if (arrTime)
						console.log(
							`   📥 Ankunft: ${arrTime.substring(
								11,
								16
							)} UTC am ${arrTime.substring(0, 10)}`
						);
				});
				console.log(`📋 === ENDE FLUGLISTE ===`);
			}

			if (relevantFlights.length === 0) {
				if (config.debugMode) {
					console.log(
						`⏰ Keine Flüge für ${aircraft.id} im angegebenen Zeitfenster`
					);
				}
				return false;
			}

			// Letzten Ankunftsflug und ersten Abflugflug identifizieren
			let lastArrival = null;
			let firstDeparture = null;

			// KORRIGIERTE LOGIK: Separate Sammlungen für Ankünfte und Abflüge
			const arrivalFlightsInWindow = [];
			const departureFlightsInWindow = [];

			for (const flight of relevantFlights) {
				const depTime = flight.departure?.scheduledTime?.utc
					? new Date(flight.departure.scheduledTime.utc)
					: null;
				const arrTime = flight.arrival?.scheduledTime?.utc
					? new Date(flight.arrival.scheduledTime.utc)
					: null;

				// Sammle Ankunftsflüge (im Zeitfenster)
				if (arrTime && arrTime >= startTime && arrTime <= endTime) {
					arrivalFlightsInWindow.push({ flight, arrTime });
				}

				// Sammle Abflugflüge (im Zeitfenster)
				if (depTime && depTime >= startTime && depTime <= endTime) {
					departureFlightsInWindow.push({ flight, depTime });
				}
			}

			// LETZTER Ankunftsflug = der mit der spätesten Ankunftszeit
			if (arrivalFlightsInWindow.length > 0) {
				arrivalFlightsInWindow.sort((a, b) => b.arrTime - a.arrTime); // Absteigende Sortierung
				lastArrival = arrivalFlightsInWindow[0].flight;
			}

			// ERSTER Abflugflug = der mit der frühesten Abflugzeit
			if (departureFlightsInWindow.length > 0) {
				departureFlightsInWindow.sort((a, b) => a.depTime - b.depTime); // Aufsteigende Sortierung
				firstDeparture = departureFlightsInWindow[0].flight;
			}

			// Debug-Information zu den ausgewählten Flügen
			if (config.debugMode) {
				console.log(`🎯 === AUSGEWÄHLTE FLÜGE FÜR ${aircraft.id} ===`);
				console.log(
					`📥 Ankunftsflüge im Zeitfenster: ${arrivalFlightsInWindow.length}`
				);
				console.log(
					`📤 Abflugflüge im Zeitfenster: ${departureFlightsInWindow.length}`
				);

				if (lastArrival) {
					const arrTime = new Date(lastArrival.arrival.scheduledTime.utc);
					console.log(
						`🛬 LETZTER Ankunftsflug: ${arrTime
							.toISOString()
							.substring(11, 16)} UTC am ${arrTime
							.toISOString()
							.substring(0, 10)} (${
							lastArrival.departure?.airport?.iata || "???"
						} → ${lastArrival.arrival?.airport?.iata || "???"})`
					);
				} else {
					console.log(`🛬 KEIN Ankunftsflug im Zeitfenster gefunden`);
				}

				if (firstDeparture) {
					const depTime = new Date(firstDeparture.departure.scheduledTime.utc);
					console.log(
						`🛫 ERSTER Abflugflug: ${depTime
							.toISOString()
							.substring(11, 16)} UTC am ${depTime
							.toISOString()
							.substring(0, 10)} (${
							firstDeparture.departure?.airport?.iata || "???"
						} → ${firstDeparture.arrival?.airport?.iata || "???"})`
					);
				} else {
					console.log(`🛫 KEIN Abflugflug im Zeitfenster gefunden`);
				}
				console.log(`🎯 === ENDE AUSWAHL ===`);
			}

			// DATEN IN KACHEL EINTRAGEN
			if (lastArrival || firstDeparture) {
				updateCellWithFlightData(
					aircraft.cellNumber,
					lastArrival,
					firstDeparture
				);

				if (config.debugMode) {
					console.log(
						`✅ Kachel ${aircraft.cellNumber} aktualisiert - Ankunft: ${
							lastArrival ? "✓" : "✗"
						}, Abflug: ${firstDeparture ? "✓" : "✗"}`
					);
				}
				return true;
			} else {
				if (config.debugMode) {
					console.log(
						`❌ Keine verwertbaren Flugdaten für ${aircraft.id} gefunden`
					);
				}
				return false;
			}
		} catch (error) {
			console.error(
				`❌ Fehler bei der Verarbeitung von Aircraft ${aircraft.id}:`,
				error
			);
			return false;
		}
	};

	/**
	 * Aktualisiert eine Kachel mit den Flugdaten oder löscht sie bei fehlenden Daten
	 * @param {string} cellNumber - Nummer der Kachel
	 * @param {Object} lastArrival - Letzter Ankunftsflug im Zeitfenster
	 * @param {Object} firstDeparture - Erster Abflugflug im Zeitfenster
	 */
	const updateCellWithFlightData = (
		cellNumber,
		lastArrival,
		firstDeparture
	) => {
		try {
			// KORREKTUR: Wenn keine Flugdaten vorhanden sind, lösche die Felder
			if (!lastArrival && !firstDeparture) {
				// Alle relevanten Felder löschen
				const arrivalElement = document.getElementById(
					`arrival-time-${cellNumber}`
				);
				const departureElement = document.getElementById(
					`departure-time-${cellNumber}`
				);
				const positionElement = document.getElementById(
					`position-${cellNumber}`
				);

				if (arrivalElement) {
					arrivalElement.value = "";
					arrivalElement.removeAttribute("title");
					console.log(`🧹 Kachel ${cellNumber}: Ankunftszeit gelöscht`);
				}

				if (departureElement) {
					departureElement.value = "";
					departureElement.removeAttribute("title");
					console.log(`🧹 Kachel ${cellNumber}: Abflugzeit gelöscht`);
				}

				if (positionElement) {
					positionElement.value = "";
					console.log(`🧹 Kachel ${cellNumber}: Position gelöscht`);
				}

				return;
			}

			// Arrival-Zeit (letzter Ankunftsflug im Zeitfenster)
			if (lastArrival) {
				const arrivalElement = document.getElementById(
					`arrival-time-${cellNumber}`
				);
				if (arrivalElement) {
					const arrivalTime = lastArrival.arrival?.scheduledTime?.utc;
					if (arrivalTime) {
						const timeOnly = arrivalTime.substring(11, 16); // HH:MM Format
						arrivalElement.value = timeOnly; // KORRIGIERT: value statt textContent
						arrivalElement.setAttribute("title", `Ankunft: ${timeOnly} (UTC)`);

						if (config.debugMode) {
							console.log(
								`Kachel ${cellNumber}: Ankunftszeit gesetzt auf ${timeOnly}`
							);
						}
					}
				}

				// Position aus dem letzten Ankunftsflug
				const positionElement = document.getElementById(
					`position-${cellNumber}`
				);
				if (positionElement && lastArrival.arrival?.airport?.iata) {
					positionElement.value = lastArrival.arrival.airport.iata; // KORRIGIERT: value statt textContent

					if (config.debugMode) {
						console.log(
							`Kachel ${cellNumber}: Position gesetzt auf ${lastArrival.arrival.airport.iata}`
						);
					}
				}
			} else {
				// Wenn kein Ankunftsflug vorhanden, lösche Ankunftszeit und Position
				const arrivalElement = document.getElementById(
					`arrival-time-${cellNumber}`
				);
				if (arrivalElement) {
					arrivalElement.value = "";
					arrivalElement.removeAttribute("title");
					console.log(
						`🧹 Kachel ${cellNumber}: Ankunftszeit gelöscht (kein Ankunftsflug)`
					);
				}

				// Auch die Position löschen, da sie normalerweise vom Ankunftsflug kommt
				const positionElement = document.getElementById(
					`position-${cellNumber}`
				);
				if (positionElement) {
					positionElement.value = "";
					console.log(
						`🧹 Kachel ${cellNumber}: Position gelöscht (kein Ankunftsflug)`
					);
				}
			}

			// Departure-Zeit (erster Abflugflug im Zeitfenster)
			if (firstDeparture) {
				const departureElement = document.getElementById(
					`departure-time-${cellNumber}`
				);
				if (departureElement) {
					const departureTime = firstDeparture.departure?.scheduledTime?.utc;
					if (departureTime) {
						const timeOnly = departureTime.substring(11, 16); // HH:MM Format
						departureElement.value = timeOnly; // KORRIGIERT: value statt textContent
						departureElement.setAttribute("title", `Abflug: ${timeOnly} (UTC)`);

						if (config.debugMode) {
							console.log(
								`Kachel ${cellNumber}: Abflugzeit gesetzt auf ${timeOnly}`
							);
						}
					}
				}
			} else {
				// Wenn kein Abflugflug vorhanden, lösche Abflugzeit
				const departureElement = document.getElementById(
					`departure-time-${cellNumber}`
				);
				if (departureElement) {
					departureElement.value = "";
					departureElement.removeAttribute("title");
					console.log(
						`🧹 Kachel ${cellNumber}: Abflugzeit gelöscht (kein Abflugflug)`
					);
				}
			}
		} catch (error) {
			console.error(
				`Fehler beim Aktualisieren der Kachel ${cellNumber}:`,
				error
			);
		}
	};

	// Update der public API - vereinfacht, aber mit beibehaltenen Signaturen
	return {
		updateAircraftData,
		getAircraftFlights,
		getAircraftFlightsDateRange: async (aircraftId, startDate, endDate) => {
			try {
				// Diese Funktion ist ein Wrapper um getAircraftFlights, der Daten
				// für einen Zeitraum abruft und zusammenführt
				const formattedStartDate = formatDate(startDate);
				const formattedEndDate = formatDate(endDate);

				// Statusmeldung anzeigen
				updateFetchStatus(
					`Suche Flüge für ${aircraftId} im Zeitraum ${formattedStartDate} bis ${formattedEndDate}...`
				);

				// Daten für Start- und Enddatum abrufen
				const startDateData = await getAircraftFlights(
					aircraftId,
					formattedStartDate
				);
				const endDateData = await getAircraftFlights(
					aircraftId,
					formattedEndDate
				);

				// Daten zusammenführen
				const combinedData = {
					data: [...(startDateData.data || []), ...(endDateData.data || [])],
				};

				if (config.debugMode) {
					console.log(
						`Kombinierte Daten für ${aircraftId} im Zeitraum:`,
						combinedData
					);
				}

				return combinedData;
			} catch (error) {
				console.error(`Fehler beim Abrufen der Flugdaten für Zeitraum:`, error);
				updateFetchStatus(`Fehler bei Zeitraumabfrage: ${error.message}`, true);
				return { data: [] };
			}
		},
		getMultipleAircraftFlights: async (registrations, date) => {
			try {
				updateFetchStatus(
					`Verarbeite ${registrations.length} Flugzeuge - Start...`
				);

				const results = [];
				for (const reg of registrations) {
					try {
						updateFetchStatus(`Verarbeite ${reg} - Daten werden abgerufen...`);
						const data = await getAircraftFlights(reg, date);
						results.push({ registration: reg, data });
					} catch (error) {
						console.error(`Fehler bei ${reg}:`, error);
						results.push({
							registration: reg,
							error: error.message,
							data: { data: [] },
						});
					}
				}

				updateFetchStatus(
					`Alle Flugdaten abgerufen (${results.length} Flugzeuge)`
				);
				return results;
			} catch (error) {
				console.error("Fehler beim Abrufen mehrerer Flugzeugdaten:", error);
				throw error;
			}
		},
		/**
		 * Abrufen des Flugstatus für eine bestimmte Flugnummer
		 * @param {string} number - Flugnummer
		 * @param {string} date - Datum im Format YYYY-MM-DD
		 * @returns {Promise<Object>} Flugstatusdaten
		 */
		getFlightStatus: async (number, date) => {
			try {
				updateFetchStatus(`Prüfe Flugstatus für ${number} am ${date}...`);

				// Parameter für die Anfrage
				const withAircraftImage = true;
				const withLocation = true;

				// API-Aufruf mit Rate Limiting
				return await rateLimiter(async () => {
					const apiUrl = `${config.baseUrl}${config.statusEndpoint}/${number}/${date}?withAircraftImage=${withAircraftImage}&withLocation=${withLocation}`;

					if (config.debugMode) {
						console.log(`API-Anfrage URL: ${apiUrl}`);
					}

					// API-Anfrage durchführen mit RapidAPI-Headers
					const response = await fetch(apiUrl, {
						headers: {
							"x-rapidapi-key": config.rapidApiKey,
							"x-rapidapi-host": config.rapidApiHost,
						},
					});

					if (!response.ok) {
						const errorText = await response.text();
						console.error(`API-Fehler: ${response.status} - ${errorText}`);
						throw new Error(
							`Flugstatus-Anfrage fehlgeschlagen: ${response.status} ${response.statusText}`
						);
					}

					const data = await response.json();

					if (config.debugMode) {
						console.log(`Flugstatus-Antwort:`, data);
					}

					return data;
				});
			} catch (error) {
				console.error("Fehler beim Abrufen des Flugstatus:", error);
				updateFetchStatus(
					`Fehler beim Abrufen des Flugstatus: ${error.message}`,
					true
				);
				throw error;
			}
		},

		updateFetchStatus,
		getAirportFlights,
		updateFlightDataForAllAircraft,

		/**
		 * NEUE HAUPTFUNKTION: Optimierte Abfrage aller Aircraft IDs im aktuellen Setup
		 * Sammelt alle Aircraft IDs aus den Kacheln und aktualisiert sie mit einer einzigen effizienten API-Abfrage
		 */
		updateAllAircraftFromAirport: async () => {
			try {
				// Hole Konfiguration aus der UI
				const currentDateInput = document.getElementById("currentDateInput");
				const nextDateInput = document.getElementById("nextDateInput");
				const airportCodeInput = document.getElementById("airportCodeInput");

				// Standardwerte setzen falls Eingaben fehlen
				const today = formatDate(new Date());
				const tomorrow = formatDate(
					new Date(new Date().setDate(new Date().getDate() + 1))
				);

				const currentDate = currentDateInput?.value || today;
				const nextDate = nextDateInput?.value || tomorrow;
				const airportCode =
					airportCodeInput?.value?.trim().toUpperCase() || "MUC";

				// Zeitfenster erstellen: vom aktuellen Tag 20:00 bis zum nächsten Tag 08:00
				const startDateTime = `${currentDate}T20:00`;
				const endDateTime = `${nextDate}T08:00`;

				console.log(`🚀 === STARTE OPTIMIERTE FLUGDATEN-ABFRAGE ===`);
				console.log(`🏢 Flughafen: ${airportCode}`);
				console.log(`📅 Zeitfenster: ${startDateTime} bis ${endDateTime}`);

				// Rufe die optimierte Hauptfunktion auf
				await updateFlightDataForAllAircraft(
					airportCode,
					startDateTime,
					endDateTime
				);

				console.log(`✅ === OPTIMIERTE FLUGDATEN-ABFRAGE ABGESCHLOSSEN ===`);

				return {
					success: true,
					message: `Flugdaten für Flughafen ${airportCode} erfolgreich abgerufen`,
					airportCode,
					timeframe: `${startDateTime} bis ${endDateTime}`,
				};
			} catch (error) {
				console.error(`❌ Fehler bei optimierter Flugdaten-Abfrage:`, error);
				updateFetchStatus(
					`❌ Fehler bei der Flugdaten-Abfrage: ${error.message}`,
					true
				);
				throw error;
			}
		},

		/**
		 * TEST-FUNKTION: Debugge eine spezifische Aircraft ID
		 * @param {string} aircraftId - Aircraft ID zum Testen
		 * @param {string} startDateTime - Startzeit (optional)
		 * @param {string} endDateTime - Endzeit (optional)
		 * @returns {Promise<Object>} Debug-Ergebnisse
		 */
		debugAircraftFlights: async (aircraftId, startDateTime, endDateTime) => {
			try {
				console.log(`🧪 === DEBUG-TEST FÜR ${aircraftId} ===`);

				// Standardzeitfenster wenn nicht angegeben
				if (!startDateTime || !endDateTime) {
					const today = formatDate(new Date());
					const tomorrow = formatDate(
						new Date(new Date().setDate(new Date().getDate() + 1))
					);
					startDateTime = startDateTime || `${today}T20:00`;
					endDateTime = endDateTime || `${tomorrow}T08:00`;
				}

				console.log(`🕒 Zeitfenster: ${startDateTime} bis ${endDateTime}`);

				// Hole Flughafen-Code
				const airportCode =
					document
						.getElementById("airportCodeInput")
						?.value?.trim()
						.toUpperCase() || "MUC";
				console.log(`🏢 Flughafen: ${airportCode}`);

				// Führe Flughafen-Abfrage durch
				const flightData = await getAirportFlights(
					airportCode,
					startDateTime,
					endDateTime
				);

				if (!flightData) {
					console.error("❌ Keine Flugdaten vom Flughafen erhalten");
					return { success: false, message: "Keine Flugdaten" };
				}

				// Alle Flüge sammeln
				let allFlights = [];
				if (Array.isArray(flightData)) {
					allFlights = flightData;
				} else {
					if (flightData.departures)
						allFlights = allFlights.concat(flightData.departures);
					if (flightData.arrivals)
						allFlights = allFlights.concat(flightData.arrivals);
				}

				console.log(`📊 Gesamt ${allFlights.length} Flüge vom Flughafen`);

				// Simuliere Aircraft-Objekt
				const aircraft = { id: aircraftId.toUpperCase(), cellNumber: "test" };

				// Führe die Verarbeitung durch
				const result = await processAircraftFlights(
					aircraft,
					allFlights,
					startDateTime,
					endDateTime
				);

				console.log(
					`🧪 === DEBUG-ERGEBNIS: ${
						result ? "✅ ERFOLGREICH" : "❌ FEHLGESCHLAGEN"
					} ===`
				);

				return {
					success: result,
					aircraftId,
					timeframe: `${startDateTime} bis ${endDateTime}`,
					totalFlights: allFlights.length,
				};
			} catch (error) {
				console.error(`❌ Fehler beim Debug-Test:`, error);
				return { success: false, error: error.message };
			}
		},

		init,

		setMockMode: (useMock) => {
			console.log(
				"Mock-Modus ist permanent deaktiviert. Es werden nur echte API-Daten verwendet."
			);
		},

		setApiProvider: (provider) => {
			console.log("Nur AeroDataBox API wird unterstützt.");
		},

		// Konfigurationsexport beibehalten
		config,
	};
})();

// Globalen Namespace für API-Zugriff erstellen
window.AeroDataBoxAPI = AeroDataBoxAPI;

// Debug-Ausgabe zum Überprüfen, ob die API korrekt geladen wurde
console.log(
	"AeroDataBox API erfolgreich geladen und verfügbar:",
	!!window.AeroDataBoxAPI
);
console.log("Verfügbare Funktionen:", Object.keys(window.AeroDataBoxAPI));

// API automatisch initialisieren
if (window.AeroDataBoxAPI && window.AeroDataBoxAPI.init) {
	window.AeroDataBoxAPI.init();
	console.log("AeroDataBox API automatisch initialisiert");
}
