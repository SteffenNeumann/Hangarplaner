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

					// Fluggesellschaft und Flugnummer - VERBESSERT: Nutze echte Airline-Daten
					// Priorisiere echte Airline-Daten aus der API
					const airlineData = flight.airline || {};
					const airlineName = airlineData.name || "";
					const airlineIata =
						airlineData.iata || flight.number?.slice(0, 2) || "";
					const airlineIcao = airlineData.icao || "";

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
							carrierCode: airlineIata,
							carrierName: airlineName,
							carrierIcao: airlineIcao,
							flightNumber: flightNumber,
							fullFlightNumber: flight.number || "",
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
				let errorMessage = `API-Anfrage fehlgeschlagen: ${response.status} ${response.statusText}`;
				
				// Versuche JSON Error Message zu extrahieren
				try {
					const errorData = JSON.parse(errorText);
					if (errorData.message) {
						errorMessage += `. Error: ${errorData.message}`;
					}
				} catch {
					// Falls kein JSON, verwende direkten Text
					if (errorText) {
						errorMessage += `. Details: ${errorText}`;
					}
				}
				
				console.error(`AeroDataBox API Error for ${registration}:`, {
					status: response.status,
					statusText: response.statusText,
					errorText: errorText,
					url: apiUrl
				});
				
				throw new Error(errorMessage);
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

						// Falls keine passenden Flüge nach Datumsfilterung, gib leeres Ergebnis zurück
						if (!filteredFlights.length && Array.isArray(fallbackData)) {
							console.log(
								`[FALLBACK] Keine Flüge für das Datum ${date} gefunden - verwende KEINE Flüge (strikte Datumsfilterung)`
							);
							// Gib leeres Ergebnis zurück statt alle Flüge zu verwenden
							return { data: [] };
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

						// Falls keine passenden Flüge nach Datumsfilterung, gib leeres Ergebnis zurück
						if (!filteredFlights.length && Array.isArray(fallbackData)) {
							console.log(
								`[FALLBACK] Keine Flüge für das Datum ${date} gefunden - verwende KEINE Flüge (strikte Datumsfilterung)`
							);
							// Gib leeres Ergebnis zurück statt alle Flüge zu verwenden
							return { data: [] };
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
		// KORREKTUR: Erweiterte Prüfung auf leere/ungültige Aircraft ID
		if (
			!aircraftId ||
			aircraftId.trim() === "" ||
			aircraftId.trim().length === 0
		) {
			updateFetchStatus("Keine Flugzeugkennung - Daten werden gelöscht", false);
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
				_emptyAircraftId: true, // Spezifisches Flag für leere Aircraft ID
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

			// NEUE ÜBERNACHTUNGS-LOGIK: Prüfe ob das Flugzeug über Nacht am Flughafen verbleibt
			console.log(`\n🏨 === ÜBERNACHTUNGS-PRÜFUNG FÜR ${aircraftId} ===`);

			// Schritt 1: Strikte Datumsfilterung - nur Flüge im gewählten Datumsbereich verwenden
			console.log(`📅 Filtere Flüge strikt nach Datum: ${currentDate} und ${nextDate}`);
			
			// Filtere currentDayFlights nach dem tatsächlichen currentDate
			const filteredCurrentDayFlights = currentDayFlights.filter((flight) => {
				const flightDate = flight.scheduledDepartureDate || currentDate;
				const isValidDate = flightDate === currentDate;
				if (!isValidDate && config.debugMode) {
					console.log(`❌ Flug vom ${flightDate} ausgeschlossen (erwartet: ${currentDate})`);
				}
				return isValidDate;
			});
			
			// Filtere nextDayFlights nach dem tatsächlichen nextDate
			const filteredNextDayFlights = nextDayFlights.filter((flight) => {
				const flightDate = flight.scheduledDepartureDate || nextDate;
				const isValidDate = flightDate === nextDate;
				if (!isValidDate && config.debugMode) {
					console.log(`❌ Flug vom ${flightDate} ausgeschlossen (erwartet: ${nextDate})`);
				}
				return isValidDate;
			});
			
			console.log(`📊 Nach Datumsfilterung: ${filteredCurrentDayFlights.length} Flüge am ${currentDate}, ${filteredNextDayFlights.length} Flüge am ${nextDate}`);

			// Schritt 2: Alle gefilterten Flüge kombinieren und sortieren
			const allFlights = [...filteredCurrentDayFlights, ...filteredNextDayFlights];

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
				`📋 Alle Flüge für ${aircraftId} (${allFlights.length} Flüge gefunden):`
			);
			if (config.debugMode) {
				allFlights.forEach((flight, index) => {
					const depPoint = flight.flightPoints?.find((p) => p.departurePoint);
					const arrPoint = flight.flightPoints?.find((p) => p.arrivalPoint);
					const depTime = getTimeStringFromFlightPoint(depPoint);
					const arrTime = getTimeStringFromFlightPoint(arrPoint);
					const flightDate = flight.scheduledDepartureDate || currentDate;
					console.log(
						`${index + 1}. ${flightDate}: ${
							depPoint?.iataCode || "???"
						} (${depTime}) → ${arrPoint?.iataCode || "???"} (${arrTime})`
					);
				});
			}

			// Schritt 2: Finde den letzten Flug von Tag 1, der am gewählten Flughafen landet
			let overnightArrival = null;
			let overnightDeparture = null;

			// Suche letzten Ankunftsflug am Tag 1 zum gewählten Flughafen (verwende strikt tagesgefilterte Flüge)
			const currentDayFlightsToAirport = filteredCurrentDayFlights
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

				const sameDayDeparturesAfterArrival = filteredCurrentDayFlights.filter(
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
						`✅ Übernachtung bestätigt! Letzter Flug am ${currentDate}:`
					);
					const arrPoint = overnightArrival.flightPoints.find(
						(p) => p.arrivalPoint
					);
					const depPoint = overnightArrival.flightPoints.find(
						(p) => p.departurePoint
					);
					console.log(
						`   ${depPoint?.iataCode || "???"} → ${
							arrPoint?.iataCode || "???"
						} um ${getTimeStringFromFlightPoint(arrPoint)}`
					);
				} else {
					console.log(
						`❌ Keine Übernachtung - ${sameDayDeparturesAfterArrival.length} weitere Abflüge am ${currentDate} gefunden:`
					);
					if (config.debugMode) {
						sameDayDeparturesAfterArrival.forEach((flight) => {
							const depPoint = flight.flightPoints.find(
								(p) => p.departurePoint
							);
							const arrPoint = flight.flightPoints.find((p) => p.arrivalPoint);
							console.log(
								`   ${depPoint?.iataCode || "???"} → ${
									arrPoint?.iataCode || "???"
								} um ${getTimeStringFromFlightPoint(depPoint)}`
							);
						});
					}
				}
			} else {
				console.log(
					`❌ Kein Ankunftsflug am ${currentDate} zum Flughafen ${selectedAirport} gefunden`
				);
			}

			// Schritt 3: Finde den ersten Abflug am Tag 2 vom gewählten Flughafen (verwende strikt tagesgefilterte Flüge)
			const nextDayDeparturesFromAirport = filteredNextDayFlights
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
				console.log(`✅ Erster Abflug am ${nextDate} gefunden:`);
				const depPoint = overnightDeparture.flightPoints.find(
					(p) => p.departurePoint
				);
				const arrPoint = overnightDeparture.flightPoints.find(
					(p) => p.arrivalPoint
				);
				console.log(
					`   ${depPoint?.iataCode || "???"} → ${
						arrPoint?.iataCode || "???"
					} um ${getTimeStringFromFlightPoint(depPoint)}`
				);
			} else {
				console.log(
					`⚠️ Kein Abflug am ${nextDate} vom Flughafen ${selectedAirport} gefunden`
				);
			}

			console.log(`🏨 === ENDE ÜBERNACHTUNGS-PRÜFUNG ===\n`);

			// Die relevanten Flüge für Übernachtung
			const lastArrival = overnightArrival;
			const firstDeparture = overnightDeparture;

			// Debug-Information zu den ausgewählten Flügen
			if (config.debugMode) {
				console.log(
					`🎯 === FINALE AUSWAHL FÜR ${aircraftId} (ÜBERNACHTUNG) ===`
				);
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
					`🛬 ÜBERNACHTUNG - Ankunft am ${currentDate}: Von ${
						departurePoint?.iataCode || "---"
					} nach ${arrivalPoint?.iataCode || "---"} um ${arrTimeStr}`
				);
			} else {
				console.log(
					`🛬 Keine Übernachtung - kein passender Ankunftsflug am ${currentDate} gefunden`
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
					`🛫 ÜBERNACHTUNG - Abflug am ${nextDate}: Von ${
						departurePoint?.iataCode || "---"
					} nach ${arrivalPoint?.iataCode || "---"} um ${depTimeStr}`
				);
			} else {
				console.log(
					`🛫 Keine Übernachtung - kein passender Abflugsflug am ${nextDate} gefunden`
				);
			}

			if (config.debugMode) {
				console.log(`🎯 === ENDE FINALE AUSWAHL (ÜBERNACHTUNG) ===`);
			}

			// Neue Definition: Übernachtung gilt, wenn letzter Ankunftsflug ODER erster Abflug am Folgetag vorhanden ist
			if (!lastArrival && !firstDeparture) {
				const reason = "kein Ankunfts- und kein Abflugsflug";
				updateFetchStatus(
					`${aircraftId} übernachtet nicht in ${selectedAirport} (${reason})`,
					false
				);

				// Explizite Markierung für "keine Übernachtung"
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

			// Positionstext formatieren - für Übernachtung spezifisch
			if (result.originCode !== "---" || result.destCode !== "---") {
				if (lastArrival && firstDeparture) {
					// Übernachtung bestätigt - vollständige Information mit Kennzeichnung
					result.positionText = `🏨 ${result.originCode} → ${result.destCode}`;
				} else if (lastArrival) {
					// Nur Ankunft bekannt (sollte bei neuer Logik nicht vorkommen)
					result.positionText = `Ankunft: ${result.originCode} → ${result.destCode}`;
				} else if (firstDeparture) {
					// Nur Abflug bekannt (sollte bei neuer Logik nicht vorkommen)
					result.positionText = `Abflug: ${result.originCode} → ${result.destCode}`;
				}
			}

			// Erfolgreiche Übernachtungs-Zusammenfassung
			console.log(
				`🏨 Übernachtung bestätigt für ${aircraftId}: ${currentDate} → ${nextDate}`
			);
			updateFetchStatus(
				`${aircraftId} übernachtet in ${selectedAirport}: ${result.positionText}`,
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

			// Helper: normalize registration for tile comparison (adds hyphen after first char)
			function normalizeRegForTiles(reg) {
				if (!reg) return '';
				let v = String(reg).toUpperCase();
				if (v.length > 1 && !v.includes('-')) {
					v = v.charAt(0) + '-' + v.substring(1);
				}
				return v;
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

				const aircraftRegNorm = aircraftReg ? normalizeRegForTiles(aircraftReg) : '';
				const tileRegNorm = normalizeRegForTiles(aircraft.id);
				return aircraftRegNorm && aircraftRegNorm === tileRegNorm;
			});

			if (config.debugMode) {
				console.log(
					`📊 Gefundene Matches: ${matchingFlights.length} von ${allFlights.length} Flügen`
				);
			}

			// NEUER CODE: Fallback zu Flugnummer-Lookup wenn keine Aircraft Registration gefunden
			if (matchingFlights.length === 0) {
				console.log(
					`❌ Keine direkte Aircraft Registration für ${aircraft.id} gefunden`
				);
				console.log(`🔍 Starte Flugnummer-basierte Suche...`);

				// Sammle alle Flugnummern aus den Flughafendaten
				const flightNumbers = allFlights
					.map((flight) => flight.number)
					.filter((number) => number && number.trim() !== "");

				console.log(
					`📋 ${flightNumbers.length} Flugnummern gefunden, starte Registration Lookup...`
				);

				// Verwende FlightRegistrationLookup für jede Flugnummer
				for (const flightNumber of flightNumbers) {
					try {
						if (
							window.FlightRegistrationLookup &&
							window.FlightRegistrationLookup.lookupRegistration
						) {
							// Datum extrahieren (verwende aktuelles Datum aus startDateTime)
							const searchDate = startDateTime.split("T")[0];

							console.log(`🔍 Lookup: ${flightNumber} am ${searchDate}`);
							const foundRegistration =
								await window.FlightRegistrationLookup.lookupRegistration(
									flightNumber,
									searchDate
								);

						const foundNorm = normalizeRegForTiles(foundRegistration);
						const tileNorm = normalizeRegForTiles(aircraft.id);
						if (foundNorm && foundNorm === tileNorm) {
								console.log(
									`✅ MATCH GEFUNDEN: ${flightNumber} → ${foundRegistration} = ${aircraft.id}`
								);

								// Finde den entsprechenden Flug in allFlights
								const matchedFlight = allFlights.find(
									(flight) => flight.number === flightNumber
								);
								if (matchedFlight) {
									console.log(
										`🎯 Flug ${flightNumber} wird für ${aircraft.id} verwendet`
									);

									// Füge die gefundene Registration zum Flug hinzu
									matchedFlight.aircraftRegistration = foundRegistration;
									matchingFlights.push(matchedFlight);

									// Beende die Suche nach dem ersten Match
									break;
								}
							}
						}
					} catch (lookupError) {
						console.log(
							`⚠️ Lookup Fehler für ${flightNumber}:`,
							lookupError.message
						);
						// Fortsetzung mit nächster Flugnummer
					}
				}

				// Prüfe erneut nach dem Lookup
				if (matchingFlights.length === 0) {
					console.log(
						`❌ Auch nach Flugnummer-Lookup keine Matches für ${aircraft.id} gefunden`
					);
					return false;
				} else {
					console.log(
						`✅ Nach Flugnummer-Lookup ${matchingFlights.length} Matches für ${aircraft.id} gefunden`
					);
				}
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

			// NEU: Airline-Informationen speichern
			// Speichere Airline-Daten aus lastArrival oder firstDeparture für TimetableManager
			let airlineInfo = "---";
			let flightNumberInfo = "";

			if (lastArrival) {
				// Extrahiere Airline aus lastArrival Flug
				const rawFlightData = lastArrival._rawFlightData;
				if (rawFlightData) {
					const airlineName = rawFlightData.airline?.name || "";
					const airlineIata = rawFlightData.airline?.iata || "";
					const flightNumber = rawFlightData.number || "";

					// Priorität: Vollständiger Name > IATA-Code > Flight Number
					if (airlineName) {
						airlineInfo = airlineName;
					} else if (airlineIata) {
						airlineInfo = airlineIata;
					} else if (flightNumber) {
						// Fallback: IATA aus Flugnummer extrahieren
						const flightMatch = flightNumber.match(/^([A-Z]{2})/);
						if (flightMatch) {
							airlineInfo = flightMatch[1];
						}
					}
					flightNumberInfo = flightNumber;
				}
			} else if (firstDeparture) {
				// Falls kein Ankunftsflug, nutze Abflugflug
				const rawFlightData = firstDeparture._rawFlightData;
				if (rawFlightData) {
					const airlineName = rawFlightData.airline?.name || "";
					const airlineIata = rawFlightData.airline?.iata || "";
					const flightNumber = rawFlightData.number || "";

					if (airlineName) {
						airlineInfo = airlineName;
					} else if (airlineIata) {
						airlineInfo = airlineIata;
					} else if (flightNumber) {
						const flightMatch = flightNumber.match(/^([A-Z]{2})/);
						if (flightMatch) {
							airlineInfo = flightMatch[1];
						}
					}
					flightNumberInfo = flightNumber;
				}
			}

			// Speichere Airline-Info als data-attribute für TimetableManager
			const cellElement = document.getElementById(`cell-${cellNumber}`);
			if (cellElement && airlineInfo !== "---") {
				cellElement.setAttribute("data-airline", airlineInfo);
				if (flightNumberInfo) {
					cellElement.setAttribute("data-flight-number", flightNumberInfo);
				}

				if (config.debugMode) {
					console.log(
						`✈️ Kachel ${cellNumber}: Airline-Info gespeichert - ${airlineInfo} (${flightNumberInfo})`
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

	// Lokale Hilfsfunktionen für generateOvernightTimetable
	const calculateOvernightDuration = (arrivalTime, departureTime) => {
		try {
			const arrival = new Date(arrivalTime);
			const departure = new Date(departureTime);
			const diffMs = departure - arrival;
			const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
			const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
			return `${diffHours}h ${diffMinutes}m`;
		} catch (error) {
			return "n/a";
		}
	};

	const convertTimeToMinutes = (timeStr) => {
		if (!timeStr || timeStr === "--:--") return 9999;
		const match = timeStr.match(/(\d{1,2}):(\d{2})/);
		if (!match) return 9999;
		return parseInt(match[1]) * 60 + parseInt(match[2]);
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

		// Neue Funktionen für Flight Number Abfragen mit Aircraft Registration
		getFlightByNumber: async (flightNumber, date) => {
			try {
				updateFetchStatus(
					`Suche Aircraft Registration für Flug ${flightNumber} am ${date}...`
				);

				return await rateLimiter(async () => {
					// Verwende /flights/number/ statt /status/ für bessere Aircraft-Daten
					const apiUrl = `${config.baseUrl}/flights/number/${flightNumber}/${date}?withAircraftImage=false&withLocation=true`;

					const options = {
						method: "GET",
						headers: {
							"x-rapidapi-key": config.rapidApiKey,
							"x-rapidapi-host": config.rapidApiHost,
						},
					};

					if (config.debugMode) {
						console.log(`Flight Number API-Anfrage: ${apiUrl}`);
					}

					const response = await fetch(apiUrl, options);

					if (!response.ok) {
						const errorText = await response.text();
						throw new Error(
							`API-Anfrage fehlgeschlagen: ${response.status} ${errorText}`
						);
					}

					const data = await response.json();

					if (config.debugMode) {
						console.log(`Flight Number API-Antwort für ${flightNumber}:`, data);
					}

					// Verarbeite die Antwort - kann Array oder einzelnes Objekt sein
					let flightData = null;
					if (Array.isArray(data) && data.length > 0) {
						flightData = data[0]; // Nehme ersten Eintrag wenn Array
					} else if (data && !Array.isArray(data)) {
						flightData = data; // Einzelnes Objekt
					}

					if (!flightData) {
						throw new Error(
							`Keine Flugdaten für ${flightNumber} am ${date} gefunden`
						);
					}

					// Extrahiere Aircraft Registration aus verschiedenen möglichen Feldern
					const aircraftRegistration =
						flightData.aircraft?.reg ||
						flightData.aircraft?.registration ||
						flightData.aircraft?.tail ||
						flightData.aircraftRegistration ||
						flightData.registration ||
						null;

					const result = {
						flightNumber: flightNumber,
						date: date,
						registration: aircraftRegistration
							? aircraftRegistration.toUpperCase()
							: null,
						aircraftType: flightData.aircraft?.model || "Unknown",
						departure: {
							airport:
								flightData.departure?.airport?.iata ||
								flightData.departure?.airport?.icao,
							scheduled: flightData.departure?.scheduledTime?.utc,
							actual: flightData.departure?.actualTime?.utc,
							terminal: flightData.departure?.terminal,
							gate: flightData.departure?.gate,
						},
						arrival: {
							airport:
								flightData.arrival?.airport?.iata ||
								flightData.arrival?.airport?.icao,
							scheduled: flightData.arrival?.scheduledTime?.utc,
							actual: flightData.arrival?.actualTime?.utc,
							terminal: flightData.arrival?.terminal,
							gate: flightData.arrival?.gate,
						},
						status: flightData.status || "Unknown",
						rawData: flightData, // Für Debug-Zwecke
					};

					if (config.debugMode) {
						console.log(`Verarbeitete Flugdaten für ${flightNumber}:`, result);
					}

					return result;
				});
			} catch (error) {
				console.error(
					`Fehler bei Flight Number Abfrage für ${flightNumber}:`,
					error
				);
				updateFetchStatus(
					`Fehler bei Flugnummer ${flightNumber}: ${error.message}`,
					true
				);
				return {
					flightNumber: flightNumber,
					date: date,
					registration: null,
					error: error.message,
				};
			}
		},

		getFlightByNumberMultipleDays: async (
			flightNumber,
			startDate,
			daysToCheck = 7
		) => {
			try {
				updateFetchStatus(
					`Suche Flug ${flightNumber} für ${daysToCheck} Tage ab ${startDate}...`
				);

				const results = [];
				const start = new Date(startDate);

				for (let i = 0; i < daysToCheck; i++) {
					const checkDate = new Date(start);
					checkDate.setDate(checkDate.getDate() + i);
					const dateStr = formatDate(checkDate);

					try {
						// Verwende die getFlightByNumber Funktion aus dem gleichen Objekt
						const flightData = await rateLimiter(async () => {
							const apiUrl = `${config.baseUrl}/flights/number/${flightNumber}/${dateStr}?withAircraftImage=false&withLocation=true`;

							const options = {
								method: "GET",
								headers: {
									"x-rapidapi-key": config.rapidApiKey,
									"x-rapidapi-host": config.rapidApiHost,
								},
							};

							const response = await fetch(apiUrl, options);
							if (!response.ok) {
								throw new Error(`Kein Flug am ${dateStr}`);
							}

							const data = await response.json();
							let flightData = null;
							if (Array.isArray(data) && data.length > 0) {
								flightData = data[0];
							} else if (data && !Array.isArray(data)) {
								flightData = data;
							}

							if (!flightData) {
								throw new Error(`Keine Flugdaten gefunden`);
							}

							const aircraftRegistration =
								flightData.aircraft?.reg ||
								flightData.aircraft?.registration ||
								flightData.aircraft?.tail ||
								flightData.aircraftRegistration ||
								flightData.registration ||
								null;

							return {
								flightNumber: flightNumber,
								date: dateStr,
								registration: aircraftRegistration
									? aircraftRegistration.toUpperCase()
									: null,
								aircraftType: flightData.aircraft?.model || "Unknown",
								departure: {
									airport:
										flightData.departure?.airport?.iata ||
										flightData.departure?.airport?.icao,
									scheduled: flightData.departure?.scheduledTime?.utc,
								},
								arrival: {
									airport:
										flightData.arrival?.airport?.iata ||
										flightData.arrival?.airport?.icao,
									scheduled: flightData.arrival?.scheduledTime?.utc,
								},
								status: flightData.status || "Unknown",
							};
						});

						if (flightData && flightData.registration) {
							results.push(flightData);
						}
					} catch (error) {
						if (config.debugMode) {
							console.log(
								`Kein Flug ${flightNumber} am ${dateStr}: ${error.message}`
							);
						}
						// Fehler ignorieren und weiter suchen
					}
				}

				updateFetchStatus(
					`${results.length} Flüge für ${flightNumber} in ${daysToCheck} Tagen gefunden`
				);
				return results;
			} catch (error) {
				console.error(`Fehler bei Multi-Day Suche für ${flightNumber}:`, error);
				updateFetchStatus(`Fehler bei Multi-Day Suche: ${error.message}`, true);
				return [];
			}
		},

		/**
		 * Hilfsfunktion: Extrahiert alle Aircraft Registrations aus Airport Flight Daten
		 * @param {Object|Array} flightData - Flugdaten vom Flughafen
		 * @returns {Array} Array mit Flugnummer und zugehöriger Registration
		 */
		extractAircraftRegistrations: (flightData) => {
			let allFlights = [];

			// Alle Flüge sammeln
			if (Array.isArray(flightData)) {
				allFlights = flightData;
			} else if (flightData && typeof flightData === "object") {
				if (flightData.departures)
					allFlights = allFlights.concat(flightData.departures);
				if (flightData.arrivals)
					allFlights = allFlights.concat(flightData.arrivals);
			}

			const flightRegistrations = [];

			allFlights.forEach((flight) => {
				// Aircraft Registration extrahieren
				const aircraftReg =
					flight.aircraft?.reg ||
					flight.aircraft?.registration ||
					flight.aircraft?.tail ||
					flight.aircraftRegistration ||
					flight.registration;

				// Flugnummer extrahieren
				const flightNumber =
					flight.number ||
					flight.departure?.flight?.number ||
					flight.arrival?.flight?.number;

				// Nur hinzufügen wenn beide Werte vorhanden
				if (aircraftReg && flightNumber) {
					flightRegistrations.push({
						flightNumber: flightNumber,
						registration: aircraftReg.toUpperCase(),
						departure: {
							airport: flight.departure?.airport?.iata,
							time: flight.departure?.scheduledTime?.utc,
						},
						arrival: {
							airport: flight.arrival?.airport?.iata,
							time: flight.arrival?.scheduledTime?.utc,
						},
						aircraftType: flight.aircraft?.model || "Unknown",
					});
				}
			});

			return flightRegistrations;
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

		/**
		 * Hilfsfunktion: Berechnet die Übernachtungsdauer
		 * @param {string} arrivalTime - Ankunftszeit (ISO)
		 * @param {string} departureTime - Abflugzeit (ISO)
		 * @returns {string} Formatierte Dauer
		 */
		calculateOvernightDuration: function (arrivalTime, departureTime) {
			try {
				const arrival = new Date(arrivalTime);
				const departure = new Date(departureTime);
				const diffMs = departure - arrival;
				const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
				const diffMinutes = Math.floor(
					(diffMs % (1000 * 60 * 60)) / (1000 * 60)
				);
				return `${diffHours}h ${diffMinutes}m`;
			} catch (error) {
				return "n/a";
			}
		},

		/**
		 * Hilfsfunktion: Konvertiert Zeit zu Minuten für Sortierung
		 * @param {string} timeStr - Zeit als String (HH:MM)
		 * @returns {number} Minuten seit Mitternacht
		 */
		convertTimeToMinutes: function (timeStr) {
			if (!timeStr || timeStr === "--:--") return 9999;
			const match = timeStr.match(/(\d{1,2}):(\d{2})/);
			if (!match) return 9999;
			return parseInt(match[1]) * 60 + parseInt(match[2]);
		},

		/**
		 * NEUE TIMETABLE-FUNKTION: Erstellt chronologische Übersicht aller übernachtenden Flugzeuge
		 * Sammelt alle Flüge vom gewählten Flughafen und identifiziert Übernachtungen
		 * @param {string} airportCode - IATA-Code des Flughafens (optional, Standard aus UI)
		 * @param {string} currentDate - Aktuelles Datum (optional, Standard heute)
		 * @param {string} nextDate - Folgedatum (optional, Standard morgen)
		 * @returns {Promise<Array>} Array mit übernachtenden Flugzeugen
		 */
		generateOvernightTimetable: async (
			airportCode = null,
			currentDate = null,
			nextDate = null
		) => {
			try {
				console.log("🕐 === GENERIERE ÜBERNACHTUNGS-TIMETABLE ===");

				// Parameter aus UI holen falls nicht angegeben
				const selectedAirport =
					airportCode ||
					document
						.getElementById("airportCodeInput")
						?.value?.trim()
						?.toUpperCase() ||
					"MUC";

				const today = formatDate(new Date());
				const tomorrow = formatDate(
					new Date(new Date().setDate(new Date().getDate() + 1))
				);

				const startDate = currentDate || today;
				const endDate = nextDate || tomorrow;

				console.log(`🏢 Flughafen: ${selectedAirport}`);
				console.log(`📅 Zeitraum: ${startDate} → ${endDate}`);

				updateFetchStatus(
					`🕐 Erstelle Timetable für ${selectedAirport}...`,
					false
				);

				// API erlaubt max. 12 Stunden - verwenden erweiterte Zeitfenster für vollständige Abdeckung
				console.log(
					"📡 Verwende erweiterte 12h-Zeitfenster für vollständige Flugabdeckung..."
				);

				// Tag 1: 06:00 bis 18:00 (12 Stunden - frühere Ankünfte bis späten Nachmittag)
				const day1Start = `${startDate}T06:00`;
				const day1End = `${startDate}T18:00`;

				// Tag 1 Fortsetzung: 18:00 bis 23:59 (weitere 6 Stunden für späte Ankünfte)
				const day1LateStart = `${startDate}T18:00`;
				const day1LateEnd = `${startDate}T23:59`;

				// Tag 2: 00:00 bis 12:00 (12 Stunden - frühe bis mittlere Abflüge)
				const day2Start = `${endDate}T00:00`;
				const day2End = `${endDate}T12:00`;

				// Tag 2 Fortsetzung: 12:00 bis 23:59 (weitere 12 Stunden für alle späteren Abflüge)
				const day2LateStart = `${endDate}T12:00`;
				const day2LateEnd = `${endDate}T23:59`;

				console.log(
					`📅 Tag 1 Teil 1 (Früh-Nachmittag): ${day1Start} bis ${day1End}`
				);
				console.log(
					`📅 Tag 1 Teil 2 (Abend-Nacht): ${day1LateStart} bis ${day1LateEnd}`
				);
				console.log(
					`📅 Tag 2 Teil 1 (Nacht-Mittag): ${day2Start} bis ${day2End}`
				);
				console.log(
					`📅 Tag 2 Teil 2 (Nachmittag-Abend): ${day2LateStart} bis ${day2LateEnd}`
				);

				// Alle vier Zeitfenster parallel abfragen für vollständige Abdeckung
				const [day1Data, day1LateData, day2Data, day2LateData] =
					await Promise.all([
						getAirportFlights(selectedAirport, day1Start, day1End),
						getAirportFlights(selectedAirport, day1LateStart, day1LateEnd),
						getAirportFlights(selectedAirport, day2Start, day2End),
						getAirportFlights(selectedAirport, day2LateStart, day2LateEnd),
					]);

				console.log("✅ Alle vier API-Anfragen abgeschlossen");

				if (!day1Data && !day1LateData && !day2Data && !day2LateData) {
					console.log("❌ Keine Flugdaten für alle Zeitfenster erhalten");
					return [];
				}

				// Alle Flüge aus allen vier Zeitfenstern sammeln
				let allFlights = [];

				// Tag 1 Teil 1 Daten hinzufügen
				if (day1Data) {
					if (Array.isArray(day1Data)) {
						allFlights = allFlights.concat(day1Data);
					} else {
						if (day1Data.departures)
							allFlights = allFlights.concat(day1Data.departures);
						if (day1Data.arrivals)
							allFlights = allFlights.concat(day1Data.arrivals);
					}
				}

				// Tag 1 Teil 2 (spät) Daten hinzufügen
				if (day1LateData) {
					if (Array.isArray(day1LateData)) {
						allFlights = allFlights.concat(day1LateData);
					} else {
						if (day1LateData.departures)
							allFlights = allFlights.concat(day1LateData.departures);
						if (day1LateData.arrivals)
							allFlights = allFlights.concat(day1LateData.arrivals);
					}
				}

				// Tag 2 Teil 1 Daten hinzufügen
				if (day2Data) {
					if (Array.isArray(day2Data)) {
						allFlights = allFlights.concat(day2Data);
					} else {
						if (day2Data.departures)
							allFlights = allFlights.concat(day2Data.departures);
						if (day2Data.arrivals)
							allFlights = allFlights.concat(day2Data.arrivals);
					}
				}

				// Tag 2 Teil 2 (spät) Daten hinzufügen
				if (day2LateData) {
					if (Array.isArray(day2LateData)) {
						allFlights = allFlights.concat(day2LateData);
					} else {
						if (day2LateData.departures)
							allFlights = allFlights.concat(day2LateData.departures);
						if (day2LateData.arrivals)
							allFlights = allFlights.concat(day2LateData.arrivals);
					}
				}

				console.log(`📊 ${allFlights.length} Flüge insgesamt erhalten`);

				// Extrahiere Aircraft Registrations und gruppiere nach Flugzeug
				const aircraftFlights = {};

				allFlights.forEach((flight) => {
					const aircraftReg =
						flight.aircraft?.reg ||
						flight.aircraft?.registration ||
						flight.aircraft?.tail ||
						flight.aircraftRegistration ||
						flight.registration;

					if (aircraftReg) {
						const registration = aircraftReg.toUpperCase();

						if (!aircraftFlights[registration]) {
							aircraftFlights[registration] = {
								registration: registration,
								aircraftType: flight.aircraft?.model || "Unknown",
								flights: [],
							};
						}

						// Flugdetails hinzufügen
						const flightInfo = {
							date:
								flight.departure?.scheduledTime?.utc?.substring(0, 10) ||
								flight.arrival?.scheduledTime?.utc?.substring(0, 10) ||
								startDate,
							flightNumber: flight.number || "",
							// NEUE AIRLINE-EXTRAKTION aus JSON-API-Antwort
							airline: {
								name: flight.airline?.name || "",
								iata: flight.airline?.iata || "",
								icao: flight.airline?.icao || "",
								// Fallback: Extrahiere IATA aus Flight Number
								fallbackIata: flight.number
									? flight.number.substring(0, 2)
									: "",
							},
							departure: {
								airport:
									flight.departure?.airport?.iata ||
									flight.departure?.airport?.icao ||
									selectedAirport, // FALLBACK: Wenn Departure fehlt, ist es selectedAirport
								time: flight.departure?.scheduledTime?.utc || "",
								timeFormatted: flight.departure?.scheduledTime?.utc
									? flight.departure.scheduledTime.utc.substring(11, 16)
									: "--:--",
							},
							arrival: {
								airport:
									flight.arrival?.airport?.iata ||
									flight.arrival?.airport?.icao ||
									selectedAirport, // FALLBACK: Wenn Arrival fehlt, ist es selectedAirport
								time: flight.arrival?.scheduledTime?.utc || "",
								timeFormatted: flight.arrival?.scheduledTime?.utc
									? flight.arrival.scheduledTime.utc.substring(11, 16)
									: "--:--",
							},
							isArrival:
								flight.arrival?.airport?.iata === selectedAirport ||
								flight.arrival?.airport?.icao === selectedAirport ||
								(!flight.arrival?.airport?.iata &&
									!flight.arrival?.airport?.icao), // FALLBACK: Wenn Arrival fehlt, ist es ein Arrival zu selectedAirport
							isDeparture:
								flight.departure?.airport?.iata === selectedAirport ||
								flight.departure?.airport?.icao === selectedAirport ||
								(!flight.departure?.airport?.iata &&
									!flight.departure?.airport?.icao), // FALLBACK: Wenn Departure fehlt, ist es ein Departure von selectedAirport
						};

						aircraftFlights[registration].flights.push(flightInfo);
					}
				});

				console.log(
					`✈️ ${
						Object.keys(aircraftFlights).length
					} verschiedene Flugzeuge gefunden`
				);

				// DEBUG: Zeige Details für D-ACNL falls vorhanden
				if (aircraftFlights["D-ACNL"]) {
					console.log("🔍 === DEBUG: Flüge für D-ACNL ===");
					const acnlFlights = aircraftFlights["D-ACNL"].flights;
					console.log(`📊 ${acnlFlights.length} Flüge für D-ACNL gefunden:`);

					acnlFlights.forEach((flight, index) => {
						const direction = flight.isArrival
							? "→ ANKUNFT"
							: flight.isDeparture
							? "← ABFLUG"
							: "TRANSIT";
						console.log(
							`  ${index + 1}. ${flight.date} | ${flight.flightNumber} | ${
								flight.departure.airport
							} ${flight.departure.timeFormatted} → ${flight.arrival.airport} ${
								flight.arrival.timeFormatted
							} | ${direction}`
						);
					});
				}

				// Übernachtungen identifizieren
				const overnightFlights = [];

				Object.values(aircraftFlights).forEach((aircraft) => {
					// Sortiere Flüge nach Zeit
					aircraft.flights.sort((a, b) => {
						const timeA = new Date(a.departure.time || a.arrival.time);
						const timeB = new Date(b.departure.time || b.arrival.time);
						return timeA - timeB;
					});

					// VERBESSERTE ÜBERNACHTUNGS-LOGIK
					// Finde alle Ankünfte AM ZIELFLUGHAFEN (selectedAirport)
					const arrivals = aircraft.flights.filter((f) => f.isArrival);
					// Finde alle Abflüge VOM ZIELFLUGHAFEN (selectedAirport)
					const departures = aircraft.flights.filter((f) => f.isDeparture);

					// DEBUG für D-ACNL
					if (aircraft.registration === "D-ACNL") {
						console.log(`🔍 D-ACNL Übernachtungsanalyse:`);
						console.log(
							`📥 ${arrivals.length} Ankünfte:`,
							arrivals.map(
								(f) => `${f.date} ${f.arrival.timeFormatted} ${f.flightNumber}`
							)
						);
						console.log(
							`📤 ${departures.length} Abflüge:`,
							departures.map(
								(f) =>
									`${f.date} ${f.departure.timeFormatted} ${f.flightNumber}`
							)
						);
					}

					// Finde Ankunft am ersten Tag (heute)
					const day1Arrivals = arrivals.filter((f) => {
						const flightDate = f.date;
						return flightDate === startDate;
					});

					// Finde Abflüge am zweiten Tag (morgen)
					const day2Departures = departures.filter((f) => {
						const flightDate = f.date;
						return flightDate === endDate;
					});

					// DEBUG für D-ACNL
					if (aircraft.registration === "D-ACNL") {
						console.log(
							`📥 Tag 1 (${startDate}) Ankünfte:`,
							day1Arrivals.map(
								(f) => `${f.arrival.timeFormatted} ${f.flightNumber}`
							)
						);
						console.log(
							`📤 Tag 2 (${endDate}) Abflüge:`,
							day2Departures.map(
								(f) => `${f.departure.timeFormatted} ${f.flightNumber}`
							)
						);
					}

					// Finde letzten Ankunftsflug am Tag 1
					const lastArrival =
						day1Arrivals.length > 0
							? day1Arrivals
									.sort(
										(a, b) =>
											new Date(a.arrival.time) - new Date(b.arrival.time)
									)
									.pop()
							: null;

					if (lastArrival) {
						// DEBUG für D-ACNL
						if (aircraft.registration === "D-ACNL") {
							console.log(
								`🏁 Letzter Ankunftsflug Tag 1: ${lastArrival.arrival.timeFormatted} ${lastArrival.flightNumber}`
							);
						}

						if (day2Departures.length > 0) {
							// Finde alle Abflüge am gleichen Tag nach der Ankunft
							const arrivalTime = new Date(lastArrival.arrival.time);
							const sameDayDepartures = departures.filter((f) => {
								const flightDate = f.date;
								const depTime = new Date(f.departure.time);
								return flightDate === startDate && depTime > arrivalTime;
							});

							// DEBUG für D-ACNL
							if (aircraft.registration === "D-ACNL") {
								console.log(
									`🔍 Weitere Abflüge am ${startDate} nach ${lastArrival.arrival.timeFormatted}: ${sameDayDepartures.length}`
								);
								if (sameDayDepartures.length > 0) {
									console.log(
										`   ${sameDayDepartures
											.map(
												(f) => `${f.departure.timeFormatted} ${f.flightNumber}`
											)
											.join(", ")}`
									);
								}
							}

							// Übernachtung nur wenn KEINE weiteren Abflüge am Tag 1 nach der Ankunft
							if (sameDayDepartures.length === 0) {
								// Ersten Abflug am Tag 2 finden
								const firstDeparture = day2Departures.sort(
									(a, b) =>
										new Date(a.departure.time) - new Date(b.departure.time)
								)[0];

								if (firstDeparture) {
									// DEBUG für D-ACNL
									if (aircraft.registration === "D-ACNL") {
										console.log(`✅ ÜBERNACHTUNG BESTÄTIGT für D-ACNL:`);
										console.log(
											`   Ankunft: ${lastArrival.arrival.timeFormatted} ${lastArrival.flightNumber}`
										);
										console.log(
											`   Abflug: ${firstDeparture.departure.timeFormatted} ${firstDeparture.flightNumber}`
										);
									}

									// Übernachtung bestätigt!
									overnightFlights.push({
										registration: aircraft.registration,
										aircraftType: aircraft.aircraftType,
										// NEUE AIRLINE-DATEN hinzufügen
										airline: {
											// Priorität 1: Airline aus Ankunftsflug
											name:
												lastArrival.airline?.name ||
												firstDeparture.airline?.name ||
												"",
											iata:
												lastArrival.airline?.iata ||
												firstDeparture.airline?.iata ||
												lastArrival.airline?.fallbackIata ||
												firstDeparture.airline?.fallbackIata ||
												"",
											icao:
												lastArrival.airline?.icao ||
												firstDeparture.airline?.icao ||
												"",
										},
										arrival: {
											from: lastArrival.departure.airport,
											to: lastArrival.arrival.airport,
											time: lastArrival.arrival.timeFormatted,
											date: startDate,
											flightNumber: lastArrival.flightNumber,
										},
										departure: {
											from: firstDeparture.departure.airport,
											to: firstDeparture.arrival.airport,
											time: firstDeparture.departure.timeFormatted,
											date: endDate,
											flightNumber: firstDeparture.flightNumber,
										},
										route: `${lastArrival.departure.airport} → ${firstDeparture.arrival.airport}`,
										overnightDuration: calculateOvernightDuration(
											lastArrival.arrival.time,
											firstDeparture.departure.time
										),
									});
								}
							} else {
								// DEBUG für D-ACNL
								if (aircraft.registration === "D-ACNL") {
									console.log(
										`❌ KEINE ÜBERNACHTUNG für D-ACNL: weitere Abflüge am gleichen Tag gefunden`
									);
								}
							}
						} else {
							// DEBUG für D-ACNL
							if (aircraft.registration === "D-ACNL") {
								console.log(
									`❌ KEINE ÜBERNACHTUNG für D-ACNL: keine Abflüge am nächsten Tag`
								);
							}
						}
					} else {
						// DEBUG für D-ACNL
						if (aircraft.registration === "D-ACNL") {
							console.log(
								`❌ KEINE ÜBERNACHTUNG für D-ACNL: keine Ankunft am ersten Tag`
							);
						}
					}
				});

				// Sortiere nach Ankunftszeit
				overnightFlights.sort((a, b) => {
					const timeA = convertTimeToMinutes(a.arrival.time);
					const timeB = convertTimeToMinutes(b.arrival.time);
					return timeA - timeB;
				});

				console.log(
					`🏨 ${overnightFlights.length} Übernachtungen identifiziert`
				);
				updateFetchStatus(
					`🏨 ${overnightFlights.length} übernachtende Flugzeuge gefunden`,
					false
				);

				return overnightFlights;
			} catch (error) {
				console.error("❌ Fehler bei Timetable-Generierung:", error);
				updateFetchStatus(`❌ Fehler bei Timetable: ${error.message}`, true);
				return [];
			}
		},

		/**
		 * DEBUG: Hole alle Flüge für eine spezifische Aircraft Registration
		 * @param {string} registration - Aircraft Registration (z.B. "D-ACNL")
		 * @param {string} airportCode - IATA-Code des Flughafens (optional, Standard aus UI)
		 * @param {string} startDate - Start-Datum (optional, Standard heute)
		 * @param {string} endDate - End-Datum (optional, Standard morgen)
		 * @returns {Promise<Array>} Array mit allen Flügen für die Registrierung
		 */
		getFlightsForRegistration: async (
			registration,
			airportCode = null,
			startDate = null,
			endDate = null
		) => {
			try {
				console.log(`🔍 === SUCHE ALLE FLÜGE FÜR ${registration} ===`);

				// Parameter aus UI holen falls nicht angegeben
				const selectedAirport =
					airportCode ||
					document
						.getElementById("airportCodeInput")
						?.value?.trim()
						?.toUpperCase() ||
					"MUC";

				const today = formatDate(new Date());
				const tomorrow = formatDate(
					new Date(new Date().setDate(new Date().getDate() + 1))
				);

				const searchStartDate = startDate || today;
				const searchEndDate = endDate || tomorrow;

				console.log(`🏢 Flughafen: ${selectedAirport}`);
				console.log(`📅 Zeitraum: ${searchStartDate} → ${searchEndDate}`);
				console.log(`✈️ Suche nach: ${registration}`);

				// Erweiterte Zeitfenster für vollständige Abdeckung
				const day1Start = `${searchStartDate}T06:00`;
				const day1End = `${searchStartDate}T18:00`;
				const day1LateStart = `${searchStartDate}T18:00`;
				const day1LateEnd = `${searchStartDate}T23:59`;
				const day2Start = `${searchEndDate}T00:00`;
				const day2End = `${searchEndDate}T12:00`;
				const day2LateStart = `${searchEndDate}T12:00`;
				const day2LateEnd = `${searchEndDate}T23:59`;

				console.log("📡 Lade Flugdaten für alle Zeitfenster...");

				// Alle vier Zeitfenster parallel abfragen
				const [day1Data, day1LateData, day2Data, day2LateData] =
					await Promise.all([
						getAirportFlights(selectedAirport, day1Start, day1End),
						getAirportFlights(selectedAirport, day1LateStart, day1LateEnd),
						getAirportFlights(selectedAirport, day2Start, day2End),
						getAirportFlights(selectedAirport, day2LateStart, day2LateEnd),
					]);

				// Alle Flüge sammeln
				let allFlights = [];

				[day1Data, day1LateData, day2Data, day2LateData].forEach(
					(data, index) => {
						if (data) {
							console.log(
								`📊 Zeitfenster ${index + 1}: ${
									Array.isArray(data)
										? data.length
										: (data.departures?.length || 0) +
										  (data.arrivals?.length || 0)
								} Flüge`
							);
							if (Array.isArray(data)) {
								allFlights = allFlights.concat(data);
							} else {
								if (data.departures)
									allFlights = allFlights.concat(data.departures);
								if (data.arrivals)
									allFlights = allFlights.concat(data.arrivals);
							}
						}
					}
				);

				console.log(`📊 ${allFlights.length} Flüge insgesamt erhalten`);

				// Filtere Flüge für die gewünschte Registrierung
				const targetFlights = allFlights.filter((flight) => {
					const aircraftReg =
						flight.aircraft?.reg ||
						flight.aircraft?.registration ||
						flight.aircraft?.tail ||
						flight.aircraftRegistration ||
						flight.registration;

					return (
						aircraftReg &&
						aircraftReg.toUpperCase() === registration.toUpperCase()
					);
				});

				console.log(
					`✈️ ${targetFlights.length} Flüge für ${registration} gefunden`
				);

				if (targetFlights.length === 0) {
					console.log("❌ Keine Flüge für diese Registrierung gefunden");
					return [];
				}

				// Sortiere Flüge chronologisch
				targetFlights.sort((a, b) => {
					const timeA = new Date(
						a.departure?.scheduledTime?.utc || a.arrival?.scheduledTime?.utc
					);
					const timeB = new Date(
						b.departure?.scheduledTime?.utc || b.arrival?.scheduledTime?.utc
					);
					return timeA - timeB;
				});

				// Detaillierte Ausgabe aller Flüge
				console.log(`📋 Detaillierte Flugübersicht für ${registration}:`);
				targetFlights.forEach((flight, index) => {
					const flightDate =
						flight.departure?.scheduledTime?.utc?.substring(0, 10) ||
						flight.arrival?.scheduledTime?.utc?.substring(0, 10);

					const depAirport =
						flight.departure?.airport?.iata ||
						flight.departure?.airport?.icao ||
						"---";
					const arrAirport =
						flight.arrival?.airport?.iata ||
						flight.arrival?.airport?.icao ||
						"---";

					const depTime = flight.departure?.scheduledTime?.utc
						? flight.departure.scheduledTime.utc.substring(11, 16)
						: "--:--";
					const arrTime = flight.arrival?.scheduledTime?.utc
						? flight.arrival.scheduledTime.utc.substring(11, 16)
						: "--:--";

					const isArrival = arrAirport === selectedAirport;
					const isDeparture = depAirport === selectedAirport;

					const direction = isArrival
						? "→ ANKUNFT"
						: isDeparture
						? "← ABFLUG"
						: "TRANSIT";

					console.log(
						`📍 ${
							index + 1
						}. ${flightDate} ${depTime} ${depAirport} → ${arrTime} ${arrAirport} | ${
							flight.number
						} | ${direction}`
					);
					console.log(
						`   Airline: ${flight.airline?.name || "Unknown"} (${
							flight.airline?.iata || "---"
						})`
					);
					console.log(`   Status: ${flight.status || "Unknown"}`);
				});

				return targetFlights;
			} catch (error) {
				console.error(
					`❌ Fehler beim Abrufen der Flüge für ${registration}:`,
					error
				);
				return [];
			}
		},

		/**
		 * CORRECTED IMPLEMENTATION: Airport-First Overnight Processing
		 * This is the correct approach that starts with airport-wide flight collection
		 * instead of individual aircraft queries from tiles
		 */
		processOvernightFlightsCorrectly: async (
			airportCode = null,
			currentDate = null,
			nextDate = null
		) => {
			try {
				console.log(`🏢 === CORRECT AIRPORT-FIRST OVERNIGHT PROCESSING ===`);

				// Get parameters from UI if not provided
				const selectedAirport = airportCode ||
					document.getElementById("airportCodeInput")?.value?.trim()?.toUpperCase() || "MUC";

				const today = formatDate(new Date());
				const tomorrow = formatDate(new Date(new Date().setDate(new Date().getDate() + 1)));

				const startDate = currentDate || today;
				const endDate = nextDate || tomorrow;

				console.log(`🏢 Airport: ${selectedAirport}`);
				console.log(`📅 Date range: ${startDate} → ${endDate}`);

				updateFetchStatus(`🏢 Starting airport-wide overnight processing for ${selectedAirport}...`, false);

				// Local helper: normalize registrations to match tile format (first letter + hyphen + rest)
				function normalizeRegForTiles(reg) {
					if (!reg) return '';
					let v = String(reg).toUpperCase();
					if (v.length > 1 && !v.includes('-')) {
						v = v.charAt(0) + '-' + v.substring(1);
					}
					return v;
				}

				// STEP 1: Get ALL flights from airport (4 time periods for complete coverage)
				console.log(`📡 === STEP 1: COLLECTING ALL AIRPORT FLIGHTS ===`);
				const timeWindows = [
					{ start: `${startDate}T00:00`, end: `${startDate}T12:00`, desc: "Day 1 Midnight-Noon" },
					{ start: `${startDate}T12:00`, end: `${startDate}T23:59`, desc: "Day 1 Noon-Midnight" },
					{ start: `${endDate}T00:00`, end: `${endDate}T12:00`, desc: "Day 2 Midnight-Noon" },
					{ start: `${endDate}T12:00`, end: `${endDate}T23:59`, desc: "Day 2 Noon-Midnight" }
				];

				console.log(`🕐 Collecting flights for ${timeWindows.length} time windows...`);
				timeWindows.forEach((window, index) => {
					console.log(`   ${index + 1}. ${window.desc}: ${window.start} to ${window.end}`);
				});

				// Parallel API calls for all time windows
				const flightPromises = timeWindows.map(window =>
					getAirportFlights(selectedAirport, window.start, window.end)
				);

				const allFlightData = await Promise.all(flightPromises);
				console.log(`✅ All ${timeWindows.length} API calls completed`);

				// Flatten and collect all flights
				let allFlights = [];
				allFlightData.forEach((data, index) => {
					if (data) {
						let flightCount = 0;
						if (Array.isArray(data)) {
							allFlights = allFlights.concat(data);
							flightCount = data.length;
						} else {
							if (data.departures) {
								allFlights = allFlights.concat(data.departures);
								flightCount += data.departures.length;
							}
							if (data.arrivals) {
								allFlights = allFlights.concat(data.arrivals);
								flightCount += data.arrivals.length;
							}
						}
						console.log(`   ${timeWindows[index].desc}: ${flightCount} flights`);
					}
				});

				console.log(`📊 Total flights collected: ${allFlights.length}`);

				if (allFlights.length === 0) {
					console.log(`❌ No flights found at ${selectedAirport} for the specified time range`);
					updateFetchStatus(`No flights found at ${selectedAirport}`, true);
					return { success: false, message: "No flights found" };
				}

				// STEP 2: OPTIMIZED - Extract only minimal data for overnight detection
				console.log(`🔍 === STEP 2: LIGHTWEIGHT OVERNIGHT CANDIDATE DETECTION ===`);
				const potentialOvernightFlights = new Map();
				const unknownFlightNumbers = new Set();
				const unknownFlightData = new Map(); // Store flight data for lookup
				let directRegistrations = 0;

				// OPTIMIZED: Only extract essential data for overnight detection
				allFlights.forEach(flight => {
					const rawRegistration = flight.aircraft?.reg || 
										 flight.aircraft?.registration || 
										 flight.aircraft?.tail ||
										 flight.aircraftRegistration ||
										 flight.registration;
					const registration = normalizeRegForTiles(rawRegistration);
					// Be robust to different shapes for flight number in airport results
					const flightNumber = flight.number || flight.departure?.flight?.number || flight.arrival?.flight?.number;
					// Use dedicated dates for arrival vs departure (do NOT mix)
					const depDate = flight.departure?.scheduledTime?.utc?.substring(0, 10) || null;
					const arrDate = flight.arrival?.scheduledTime?.utc?.substring(0, 10) || null;
					const arrivalAirport = flight.arrival?.airport?.iata || flight.arrival?.airport?.icao;
					const departureAirport = flight.departure?.airport?.iata || flight.departure?.airport?.icao;
					const arrivalTime = flight.arrival?.scheduledTime?.utc;
					const departureTime = flight.departure?.scheduledTime?.utc;

					// FILTER: Only collect flights that could be overnight candidates
					// 1. Arrivals to selected airport on day 1 (potential overnight start)
					// 2. Departures from selected airport on day 2 (potential overnight end)
					const isDay1Arrival = (arrDate === startDate) && (arrivalAirport === selectedAirport) && !!arrivalTime;
					const isDay2Departure = (depDate === endDate) && (departureAirport === selectedAirport) && !!departureTime;

					if (isDay1Arrival || isDay2Departure) {
						if (registration) {
							// Direct registration available (normalized for tile format)
							const regKey = registration;
							if (!potentialOvernightFlights.has(regKey)) {
								potentialOvernightFlights.set(regKey, { 
									registration: regKey, 
									arrivals: [], 
									departures: [],
									allFlights: []
								});
							}
							const aircraftData = potentialOvernightFlights.get(regKey);
							if (isDay1Arrival) aircraftData.arrivals.push(flight);
							if (isDay2Departure) aircraftData.departures.push(flight);
							aircraftData.allFlights.push(flight);
							directRegistrations++;
						} else if (flightNumber) {
							// Need lookup for this flight - but only for potential overnight flights
							unknownFlightNumbers.add(flightNumber);
							// Store flight data for later use after lookup
							unknownFlightData.set(flightNumber, {
								flight,
								isDay1Arrival,
								isDay2Departure,
								flightDate: arrDate || depDate
							});
						}
					}
				});

				console.log(`✅ Direct registrations found: ${directRegistrations}`);
				console.log(`🔍 Flights needing registration lookup: ${unknownFlightNumbers.size}`);
				console.log(`📊 Unique aircraft with direct registrations: ${potentialOvernightFlights.size}`);

				// STEP 3: Lookup registrations for flight numbers
				console.log(`🔎 === STEP 3: FLIGHT NUMBER TO REGISTRATION LOOKUP ===`);
				let lookupSuccesses = 0;
				let lookupFailures = 0;
				// UI status hint so users can see that registration-by-flight lookup is running
				try {
					const count = unknownFlightNumbers.size;
					updateFetchStatus(`Looking up registrations for ${count} flight number(s)...`, false);
				} catch (e) { /* ignore UI status issues */ }

				// Helper: robust resolver that tries provider (single day), provider (multi-day), then FlightRegistrationLookup
				async function resolveRegistrationForFlightNumber(flightNumber, primaryDate, extraDates = []) {
					const dates = Array.from(new Set([primaryDate, ...extraDates].filter(Boolean)));
					// Try provider by exact date(s)
					for (const date of dates) {
						try {
							const res = await (window.AeroDataBoxAPI?.getFlightByNumber
								? window.AeroDataBoxAPI.getFlightByNumber(flightNumber, date)
								: null);
							if (res && res.registration) {
								return { registration: res.registration, source: 'provider', dateTried: date };
							}
						} catch (e) {
							// continue to next date
						}
					}
					// Try small multi-day forward search (up to 3 days)
					try {
						const multi = await (window.AeroDataBoxAPI?.getFlightByNumberMultipleDays
							? window.AeroDataBoxAPI.getFlightByNumberMultipleDays(flightNumber, primaryDate, 3)
							: null);
						if (Array.isArray(multi) && multi.length) {
							const withReg = multi.find(x => x && x.registration);
							if (withReg) {
								return { registration: withReg.registration, source: 'provider-multiday', dateTried: withReg.date };
							}
						}
					} catch (e) {}
					// FlightRegistrationLookup fallback (can use multiple sources internally)
					if (window.FlightRegistrationLookup?.lookupRegistration) {
						try {
							const reg = await window.FlightRegistrationLookup.lookupRegistration(flightNumber, primaryDate);
							if (reg) {
								return { registration: reg, source: 'lookup', dateTried: primaryDate };
							}
						} catch (e) {}
					}
					return null;
				}

				for (const flightNumber of unknownFlightNumbers) {
					try {
						updateFetchStatus(`Looking up registration for flight ${flightNumber}...`, false);
						const flightMeta = unknownFlightData.get(flightNumber) || {};
						const primaryDate = flightMeta.flightDate || startDate;
						const altDates = [startDate, endDate];
						const resolved = await resolveRegistrationForFlightNumber(flightNumber, primaryDate, altDates);

						if (resolved && resolved.registration) {
							const regUpper = normalizeRegForTiles(resolved.registration);
							const flightData = unknownFlightData.get(flightNumber);
							// Create or get aircraft entry
							if (!potentialOvernightFlights.has(regUpper)) {
								potentialOvernightFlights.set(regUpper, { 
									registration: regUpper, 
									arrivals: [], 
									departures: [],
									allFlights: []
								});
							}
							const aircraftData = potentialOvernightFlights.get(regUpper);
							if (flightData?.isDay1Arrival) aircraftData.arrivals.push(flightData.flight);
							if (flightData?.isDay2Departure) aircraftData.departures.push(flightData.flight);
							if (flightData?.flight) aircraftData.allFlights.push(flightData.flight);
							console.log(`✅ Found registration ${regUpper} for flight ${flightNumber} via ${resolved.source} (${resolved.dateTried})`);
							lookupSuccesses++;
						} else {
							console.log(`❌ No registration found for flight ${flightNumber}`);
							lookupFailures++;
						}
					} catch (error) {
						console.log(`⚠️ Could not find registration for flight ${flightNumber}: ${error.message}`);
						lookupFailures++;
					}
				}

				console.log(`📈 Registration lookup results:`);
				console.log(`   ✅ Successful lookups: ${lookupSuccesses}`);
				console.log(`   ❌ Failed lookups: ${lookupFailures}`);
				console.log(`   📊 Total unique aircraft discovered: ${potentialOvernightFlights.size}`);

				// STEP 4: Apply overnight logic to all discovered aircraft
				console.log(`🏨 === STEP 4: OVERNIGHT LOGIC FOR ALL DISCOVERED AIRCRAFT ===`);
				const overnightResults = [];

				for (const [registration, aircraftData] of potentialOvernightFlights) {
					console.log(`\n🔍 Analyzing overnight pattern for ${registration}...`);
					
					// Use the organized flight data
					const day1Arrivals = aircraftData.arrivals;
					const day2Departures = aircraftData.departures;

					console.log(`   📥 Day 1 arrivals at ${selectedAirport}: ${day1Arrivals.length}`);
					console.log(`   📤 Day 2 departures from ${selectedAirport}: ${day2Departures.length}`);

				// If there are no arrivals on day 1, we can still classify overnight via day 2 first departure
				if (day1Arrivals.length === 0 && day2Departures.length === 0) {
					console.log(`   ❌ No arrivals on day 1 and no departures on day 2 - no overnight`);
					continue;
				}

				// Find last arrival on day 1 (if any)
					let lastArrival = day1Arrivals.sort((a, b) => {
						const timeA = new Date(a.arrival?.scheduledTime?.utc || 0);
						const timeB = new Date(b.arrival?.scheduledTime?.utc || 0);
						return timeB - timeA; // Latest first
					})[0];

					// Check for subsequent departures on day 1 AFTER the last arrival
					const arrivalTime = new Date(lastArrival.arrival?.scheduledTime?.utc);
					const sameDayDepartures = allFlights.filter(flight => {
						const flightDate = flight.departure?.scheduledTime?.utc?.substring(0, 10);
						const departureAirport = flight.departure?.airport?.iata || flight.departure?.airport?.icao;
						const departureTime = new Date(flight.departure?.scheduledTime?.utc);
						
						return flightDate === startDate && 
							   departureAirport === selectedAirport && 
							   departureTime > arrivalTime;
					});

					console.log(`   ⏰ Last arrival: ${lastArrival.arrival?.scheduledTime?.utc?.substring(11, 16)} (${lastArrival.number})`);
					console.log(`   🔄 Subsequent departures on day 1: ${sameDayDepartures.length}`);

				if (sameDayDepartures.length > 0) {
					console.log(`   ❌ Aircraft continues same day after last arrival`);
					// We still allow overnight detection via day 2 first departure rule below
					lastArrival = null;
				}

				// UPDATED LOGIC: Aircraft stays overnight if
				// (a) it has a last arrival with no same-day departures, OR
				// (b) it has a first departure on day 2 from the selected airport
				let firstDeparture = null;
				let overnightType = "";
				let route = "";
				let duration = "";

				if (day2Departures.length > 0) {
					// Has departure on day 2 - normal overnight with continuation
					firstDeparture = day2Departures.sort((a, b) => {
						const timeA = new Date(a.departure?.scheduledTime?.utc || 0);
						const timeB = new Date(b.departure?.scheduledTime?.utc || 0);
						return timeA - timeB; // Earliest first
					})[0];
					
					overnightType = "continues";
					if (lastArrival) {
						route = `${lastArrival.departure?.airport?.iata || ""} → ${firstDeparture.arrival?.airport?.iata || ""}`;
						duration = calculateOvernightDuration(
							lastArrival.arrival?.scheduledTime?.utc,
							firstDeparture.departure?.scheduledTime?.utc
						);
					} else {
						// No last arrival known – still consider overnight by departure rule
						route = `${selectedAirport} → ${firstDeparture.arrival?.airport?.iata || ""}`;
						duration = "unknown";
					}
					
					console.log(`   ⏰ First departure: ${firstDeparture.departure?.scheduledTime?.utc?.substring(11, 16)} (${firstDeparture.number})`);
					console.log(`   🏨 ✅ OVERNIGHT CONFIRMED for ${registration} - continues next day!`);
				} else {
					// No departure on day 2 - aircraft is PARKED overnight
					overnightType = "parked";
					route = `${lastArrival?.departure?.airport?.iata || selectedAirport} → PARKED`;
					duration = "∞ (parked)";
					
					console.log(`   🏨 ✅ OVERNIGHT CONFIRMED for ${registration} - PARKED (no departure scheduled)!`);
				}

				overnightResults.push({
					registration,
					aircraftType: lastArrival?.aircraft?.model || (firstDeparture?.aircraft?.model) || "Unknown",
					overnightType, // "continues" or "parked"
					arrival: lastArrival ? {
						from: lastArrival.departure?.airport?.iata || "",
						to: selectedAirport,
						time: lastArrival.arrival?.scheduledTime?.utc?.substring(11, 16) || "--:--",
						date: startDate,
						flightNumber: lastArrival.number || ""
					} : {
						from: "",
						to: selectedAirport,
						time: "--:--",
						date: startDate,
						flightNumber: ""
					},
					departure: firstDeparture ? {
						from: selectedAirport,
						to: firstDeparture.arrival?.airport?.iata || "",
						time: firstDeparture.departure?.scheduledTime?.utc?.substring(11, 16) || "--:--",
						date: endDate,
						flightNumber: firstDeparture.number || ""
					} : {
						// Aircraft is parked - no departure
						from: selectedAirport,
						to: "PARKED",
						time: "--:--",
						date: endDate,
						flightNumber: "PARKED"
					},
					route,
					overnightDuration: duration,
					position: "--" // Will be determined later or via other logic
				});
				}

				console.log(`🏨 Overnight analysis complete: ${overnightResults.length} confirmed overnight aircraft`);

				// STEP 5: Match with tiles and populate/clear
				console.log(`🎯 === STEP 5: TILE MATCHING AND POPULATION ===`);
				const tiles = document.querySelectorAll('input[id^="aircraft-"]');
				let matched = 0;
				let cleared = 0;
				let empty = 0;

				tiles.forEach(async tile => {
					const tileAircraftIdRaw = tile.value.trim().toUpperCase();
					const tileAircraftId = normalizeRegForTiles(tileAircraftIdRaw);
					const tileNumber = tile.id.split('-')[1];

					if (!tileAircraftId) {
						empty++;
						return;
					}

					const overnightMatch = overnightResults.find(aircraft => 
						aircraft.registration === tileAircraftId
					);

					if (overnightMatch) {
						console.log(`✅ Match found: Tile ${tileNumber} (${tileAircraftId}) has overnight data`);
						
						// FIXED: Use correct function to update tile and badge
						if (window.HangarData && typeof window.HangarData.updateAircraftFromFlightData === "function") {
							// Create flight data object in expected format
							const flightData = {
								arrivalTime: overnightMatch.arrival.time,
								departureTime: overnightMatch.departure.time,
								positionText: `🏨 ${overnightMatch.route}`,
								originCode: overnightMatch.arrival.from,
								destCode: overnightMatch.departure.to
							};
							
							// Call the unified update function to update tile AND badge
							try {
								await window.HangarData.updateAircraftFromFlightData(tileAircraftId, flightData);
								console.log(`✅ Tile ${tileNumber} updated with overnight data and badge refreshed`);
							} catch (error) {
								console.error(`❌ Error updating tile ${tileNumber}:`, error);
							}
						} else {
							// Fallback: Direct DOM update (without badge update)
							console.warn(`⚠️ HangarData.updateAircraftFromFlightData not available, using fallback`);
							const arrTimeInput = document.getElementById(`arrival-time-${tileNumber}`);
							const depTimeInput = document.getElementById(`departure-time-${tileNumber}`);
							
							if (arrTimeInput) arrTimeInput.value = overnightMatch.arrival.time;
							if (depTimeInput) depTimeInput.value = overnightMatch.departure.time;
						}

						matched++;
					} else {
						console.log(`❌ No overnight data: Tile ${tileNumber} (${tileAircraftId}) - clearing fields`);
						
						// FIXED: Use correct function to clear tile and update badge
						if (window.HangarData && typeof window.HangarData.updateAircraftFromFlightData === "function") {
							// Create empty flight data to clear the tile
							const emptyData = {
								arrivalTime: "",
								departureTime: "",
								positionText: "",
								originCode: "",
								destCode: "",
								_noDataFound: true,
								_clearFields: true
							};
							
							try {
								await window.HangarData.updateAircraftFromFlightData(tileAircraftId, emptyData);
								console.log(`✅ Tile ${tileNumber} cleared and badge refreshed`);
							} catch (error) {
								console.error(`❌ Error clearing tile ${tileNumber}:`, error);
							}
						} else {
							// Fallback: Direct DOM clear (without badge update)
							console.warn(`⚠️ HangarData.updateAircraftFromFlightData not available, using fallback`);
							const arrTimeInput = document.getElementById(`arrival-time-${tileNumber}`);
							const depTimeInput = document.getElementById(`departure-time-${tileNumber}`);
							
							if (arrTimeInput) arrTimeInput.value = "";
							if (depTimeInput) depTimeInput.value = "";
						}

						cleared++;
					}
				});

				console.log(`🎯 Tile matching results:`);
				console.log(`   ✅ Tiles with overnight data: ${matched}`);
				console.log(`   ❌ Tiles cleared (no overnight): ${cleared}`);
				console.log(`   ⭕ Empty tiles: ${empty}`);

				// Final summary
				const successMessage = `✅ Airport-first processing complete: ${overnightResults.length} overnight aircraft discovered, ${matched} tiles updated`;
				updateFetchStatus(successMessage, false);
				console.log(`🏆 === PROCESSING COMPLETE ===`);
				console.log(successMessage);

				return {
					success: true,
					airport: selectedAirport,
					timeframe: `${startDate} → ${endDate}`,
					totalFlights: allFlights.length,
					discoveredAircraft: potentialOvernightFlights.size,
					overnightAircraft: overnightResults.length,
					tilesMatched: matched,
					tilesCleared: cleared,
					details: overnightResults
				};

			} catch (error) {
				console.error(`❌ Error in airport-first overnight processing:`, error);
				updateFetchStatus(`❌ Processing failed: ${error.message}`, true);
				return {
					success: false,
					error: error.message
				};
			}
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
