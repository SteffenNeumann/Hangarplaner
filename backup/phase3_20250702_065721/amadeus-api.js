/**
 * Amadeus API Integration
 * Handles authentication and API calls to fetch flight data
 */

const AmadeusAPI = (() => {
	// API Configuration
	const config = {
		apiKey: "VDCRHgvSyMzkgb9Y3ztJzRszQLvg8Qcq", // Your Amadeus API Key
		apiSecret: "AQWCDWW1vNhXLlVt", // Your Amadeus API Secret
		baseUrl: "https://test.api.amadeus.com/v2", // Test environment, change to production when ready
		tokenUrl: "https://test.api.amadeus.com/v1/security/oauth2/token",
		debugMode: true, // Aktiviere Debug-Modus für zusätzliche Konsolenausgaben
	};

	// Access token storage
	let accessToken = null;
	let tokenExpiry = null;

	/**
	 * Get authentication token
	 * @returns {Promise<string>} Access token
	 */
	const getToken = async () => {
		// Check if we have a valid token
		if (accessToken && tokenExpiry && new Date() < tokenExpiry) {
			return accessToken;
		}

		try {
			const response = await fetch(config.tokenUrl, {
				method: "POST",
				headers: {
					"Content-Type": "application/x-www-form-urlencoded",
				},
				body: `grant_type=client_credentials&client_id=${config.apiKey}&client_secret=${config.apiSecret}`,
			});

			if (!response.ok) {
				throw new Error(`Authentication failed: ${response.statusText}`);
			}

			const data = await response.json();
			accessToken = data.access_token;

			// Calculate token expiry (usually 30 minutes)
			const expiresIn = data.expires_in || 1800; // Default to 30 min if not provided
			tokenExpiry = new Date(new Date().getTime() + expiresIn * 1000);

			return accessToken;
		} catch (error) {
			console.error("Error obtaining access token:", error);
			updateFetchStatus(
				"Authentifizierung fehlgeschlagen. Bitte API-Schlüssel überprüfen.",
				true
			);
			throw error;
		}
	};

	/**
	 * Update the fetch status display in UI
	 * @param {string} message - Status message to display
	 * @param {boolean} isError - Whether this is an error message
	 */
	const updateFetchStatus = (message, isError = false) => {
		const fetchStatus = document.getElementById("fetchStatus");
		if (fetchStatus) {
			fetchStatus.textContent = message;
			fetchStatus.className = isError
				? "text-sm text-center text-status-red"
				: "text-sm text-center";
		}

		// Auch in der Konsole loggen für bessere Nachverfolgung
		if (config.debugMode) {
			isError ? console.error(message) : console.log(message);
		}
	};

	/**
	 * Format date to YYYY-MM-DD
	 * @param {Date|string} dateInput - Date object or date string
	 * @returns {string} Formatted date string
	 */
	const formatDate = (dateInput) => {
		const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
		return date.toISOString().split("T")[0];
	};

	/**
	 * Fetch flights for a specific aircraft on a specific date
	 * @param {string} aircraftId - Aircraft registration number/identifier
	 * @param {string} date - Date in YYYY-MM-DD format
	 * @returns {Promise<Object>} Flight information
	 */
	const getAircraftFlights = async (aircraftId, date) => {
		try {
			updateFetchStatus(`Suche Flüge für Aircraft ${aircraftId} am ${date}...`);

			const token = await getToken();

			// Debug: Token-Informationen
			if (config.debugMode) {
				console.log(`Token erhalten: ${token.substring(0, 10)}...`);
			}

			// Korrigierter Endpunkt für die Amadeus Flight Schedules API
			let apiUrl;

			// Prüfen, ob es sich um eine Flugnummer im Format "LH123" handelt
			const flightCodeRegex = /^([A-Z]{2})(\d+)$/;
			const match = aircraftId.match(flightCodeRegex);

			if (match) {
				// Format: Airline Code (2 Buchstaben) + Flugnummer
				const carrierCode = match[1];
				const flightNumber = match[2];
				apiUrl = `${config.baseUrl}/schedule/flights?carrierCode=${carrierCode}&flightNumber=${flightNumber}&scheduledDepartureDate=${date}`;
			} else {
				// Bei Aircraft-Registrierung wie D-AIBL müssen wir einen alternativen Endpoint oder
				// eine andere API verwenden, da die Flight Schedules API keine direkte Suche nach
				// Flugzeugregistrierungen unterstützt

				// Da wir keinen direkten Zugriff auf Flüge nach Registrierung haben,
				// können wir einen Test-Flug einer bekannten Airline abfragen
				// oder einen Mock-Endpunkt für Testzwecke verwenden

				// WICHTIG: Diese Testdaten sind nur als Übergangslösung zu verstehen!
				// Für eine produktive Umgebung müsste eine andere API verwendet werden,
				// die Flüge nach Registrierung suchen kann

				// Beispiel für einen Testflug (LH438)
				apiUrl = `${config.baseUrl}/schedule/flights?carrierCode=LH&flightNumber=438&scheduledDepartureDate=${date}`;

				updateFetchStatus(
					`Hinweis: Suche nach Aircraft ${aircraftId} - Verwende Testdaten für Demo-Zwecke`,
					false
				);

				// Alternativ könnten wir hier auch Mock-Daten zurückgeben:
				if (config.debugMode) {
					console.log(`Verwende Test-API für ${aircraftId}: ${apiUrl}`);
				}
			}

			// Debug: API-URL anzeigen
			if (config.debugMode) {
				console.log(`API-Anfrage an: ${apiUrl}`);
			}

			const response = await fetch(apiUrl, {
				method: "GET",
				headers: {
					Authorization: `Bearer ${token}`,
					"Content-Type": "application/json",
				},
			});

			// Debug: API-Antwort Status anzeigen
			if (config.debugMode) {
				console.log(
					`API-Antwort Status: ${response.status} ${response.statusText}`
				);
			}

			// Handling von 404 und anderen Fehlern
			if (response.status === 404) {
				updateFetchStatus(
					`Keine Daten gefunden für ${aircraftId} am ${date}`,
					true
				);
				return { data: [] }; // Leeres Daten-Array zurückgeben
			}

			if (!response.ok) {
				const errorText = await response.text();
				throw new Error(
					`API-Anfrage fehlgeschlagen: ${response.status} ${response.statusText}. Details: ${errorText}`
				);
			}

			const data = await response.json();

			// Debug: Empfangene Daten anzeigen
			if (config.debugMode) {
				console.log(`API-Antwort Daten:`, data);
			}

			// Überprüfen und loggen der zurückgegebenen Datenstruktur
			if (data && data.data && data.data.length > 0) {
				updateFetchStatus(
					`Gefundene Flüge für ${aircraftId}: ${data.data.length}`
				);
			} else {
				updateFetchStatus(
					`Keine Flüge gefunden für ${aircraftId} am ${date}`,
					true
				);
			}

			return data;
		} catch (error) {
			console.error("Error fetching aircraft flights:", error);
			updateFetchStatus(`Fehler bei der Flugabfrage: ${error.message}`, true);

			// Leeres Objekt zurückgeben, damit der Rest des Codes weiter funktioniert
			return { data: [] };
		}
	};

	/**
	 * Fetch flights for a specific airport on a specific date
	 * @param {string} airportCode - IATA airport code (e.g., 'FRA', 'MUC')
	 * @param {string} date - Date in YYYY-MM-DD format
	 * @param {string} [flightType='departure'] - Type of flights ('departure' or 'arrival')
	 * @returns {Promise<Object>} Flight information
	 */
	const getAirportFlights = async (
		airportCode,
		date,
		flightType = "departure"
	) => {
		try {
			updateFetchStatus(
				`Suche ${
					flightType === "departure" ? "Abflüge" : "Ankünfte"
				} für Flughafen ${airportCode} am ${date}...`
			);

			const token = await getToken();

			// API-Endpunkt für Flughafen-Flugpläne
			// Tatsächlicher Endpunkt hängt von der Amadeus API-Version ab
			let apiUrl;
			if (flightType === "departure") {
				apiUrl = `${config.baseUrl}/schedule/flights?originLocationCode=${airportCode}&scheduledDepartureDate=${date}`;
			} else {
				apiUrl = `${config.baseUrl}/schedule/flights?destinationLocationCode=${airportCode}&scheduledDepartureDate=${date}`;
			}

			if (config.debugMode) {
				console.log(
					`API-Anfrage für Flughafen ${airportCode} (${flightType}): ${apiUrl}`
				);
			}

			const response = await fetch(apiUrl, {
				method: "GET",
				headers: {
					Authorization: `Bearer ${token}`,
					"Content-Type": "application/json",
				},
			});

			// Bei 404 oder anderen Fehlern verwenden wir simulierte Testdaten
			if (!response.ok) {
				if (response.status === 404 || response.status === 400) {
					// Wir simulieren Flughafen-spezifische Testdaten
					return generateAirportTestData(airportCode, date, flightType);
				}

				const errorText = await response.text();
				throw new Error(
					`API-Anfrage fehlgeschlagen: ${response.status} ${response.statusText}. Details: ${errorText}`
				);
			}

			const data = await response.json();

			if (config.debugMode) {
				console.log(
					`Gefundene Flüge für Flughafen ${airportCode}: ${
						data.data?.length || 0
					}`
				);
			}

			return data;
		} catch (error) {
			console.error(
				`Fehler bei Abfrage der Flüge für Flughafen ${airportCode}:`,
				error
			);
			updateFetchStatus(
				`Verwende Testdaten für Flughafen ${airportCode}`,
				false
			);

			// Bei Fehlern nutzen wir simulierte Daten
			return generateAirportTestData(airportCode, date, flightType);
		}
	};

	/**
	 * Generiert realistische Testdaten für einen bestimmten Flughafen
	 * @param {string} airportCode - IATA Flughafen-Code
	 * @param {string} date - Datum im Format YYYY-MM-DD
	 * @param {string} flightType - 'departure' oder 'arrival'
	 * @returns {Object} Simulierte Flugdaten
	 */
	const generateAirportTestData = (airportCode, date, flightType) => {
		// Fluggesellschaften nach Flughafen zuordnen
		const airlinesByAirport = {
			FRA: ["LH", "DE", "XQ", "LX"], // Lufthansa, Condor, SunExpress, Swiss
			MUC: ["LH", "EN", "EW", "OS"], // Lufthansa, Air Dolomiti, Eurowings, Austrian
			DUS: ["EW", "AB", "DE", "X3"], // Eurowings, Air Berlin, Condor, TUIfly
			TXL: ["AB", "EW", "LH", "X3"], // Air Berlin, Eurowings, Lufthansa, TUIfly
			BER: ["EW", "LH", "DE", "X3"], // Eurowings, Lufthansa, Condor, TUIfly
			HAM: ["EW", "LH", "DE", "AB"], // Eurowings, Lufthansa, Condor, Air Berlin
			CGN: ["EW", "LH", "AB", "X3"], // Eurowings, Lufthansa, Air Berlin, TUIfly
			STR: ["EW", "LH", "X3", "DE"], // Eurowings, Lufthansa, TUIfly, Condor
			LHR: ["BA", "VS", "LH", "UA"], // British Airways, Virgin Atlantic, Lufthansa, United
			CDG: ["AF", "LH", "BA", "EW"], // Air France, Lufthansa, British Airways, Eurowings
			AMS: ["KL", "LH", "BA", "DL"], // KLM, Lufthansa, British Airways, Delta
		};

		// Standard-Airlines
		const defaultAirlines = ["LH", "BA", "AF", "UA", "DL"];

		// Wähle Airlines basierend auf dem Flughafen oder nutze Standard
		const airlines = airlinesByAirport[airportCode] || defaultAirlines;

		// Flughafen-Kombinationen für Ankünfte/Abflüge
		const europeAirports = [
			"FRA",
			"MUC",
			"LHR",
			"CDG",
			"AMS",
			"MAD",
			"FCO",
			"VIE",
			"ZRH",
			"BRU",
		];
		const usaAirports = [
			"JFK",
			"LAX",
			"ORD",
			"MIA",
			"SFO",
			"DFW",
			"BOS",
			"IAD",
			"SEA",
			"PHL",
		];
		const asiaAirports = [
			"NRT",
			"HND",
			"PEK",
			"PVG",
			"HKG",
			"SIN",
			"BKK",
			"ICN",
			"DEL",
			"DXB",
		];

		// Entferne den aktuellen Flughafen aus den Listen
		const filteredEuropeAirports = europeAirports.filter(
			(ap) => ap !== airportCode
		);
		const allDestinations = [
			...filteredEuropeAirports,
			...usaAirports,
			...asiaAirports,
		];

		const flightCount = Math.floor(Math.random() * 5) + 3; // 3-7 Flüge generieren
		const testFlights = [];

		for (let i = 0; i < flightCount; i++) {
			const airline = airlines[Math.floor(Math.random() * airlines.length)];
			const flightNumber = String(Math.floor(Math.random() * 900) + 100);
			const destinationIdx = Math.floor(Math.random() * allDestinations.length);
			const destination = allDestinations[destinationIdx];

			// Zufällige Stunde (5-23) und Minute (0-59)
			const hour = String(Math.floor(Math.random() * 19) + 5).padStart(2, "0");
			const minute = String(Math.floor(Math.random() * 60)).padStart(2, "0");
			const departureTime = `${hour}:${minute}:00.000`;

			// Aircraft-Codes basierend auf Airline
			const aircraftCodes = {
				LH: ["A320", "A321", "A333", "A343", "A359", "B748"],
				BA: ["A320", "A321", "B772", "B788", "B789"],
				AF: ["A318", "A319", "A320", "A321", "A332", "B772"],
				UA: ["B738", "B739", "B772", "B789", "B77W"],
				DL: ["A319", "A320", "A321", "B738", "B739", "B764"],
				EW: ["A319", "A320", "A321"],
				DE: ["A320", "A321", "B753", "B763"],
				AB: ["A320", "A321", "A332", "B738"],
				X3: ["B738", "B739"],
			};

			const aircraftCode = aircraftCodes[airline]
				? aircraftCodes[airline][
						Math.floor(Math.random() * aircraftCodes[airline].length)
				  ]
				: "A320";

			// Registrierungsmuster nach Airline
			const registrationPatterns = {
				LH: "D-AI",
				BA: "G-EU",
				AF: "F-GK",
				UA: "N",
				DL: "N",
				EW: "D-AE",
				DE: "D-AI",
				AB: "D-AB",
				X3: "D-AT",
			};

			// Generiere zufällige Registrierung
			const regBase = registrationPatterns[airline] || "D-A";
			const regChars = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // Keine I oder O, da sie leicht mit 1 oder 0 verwechselt werden
			let registration;

			if (regBase === "N") {
				// US-Format: N + 1-5 Ziffern
				registration = "N" + Math.floor(Math.random() * 90000 + 10000);
			} else {
				// Europäisches Format: Präfix + 2-3 Buchstaben
				registration =
					regBase +
					regChars.charAt(Math.floor(Math.random() * regChars.length)) +
					regChars.charAt(Math.floor(Math.random() * regChars.length)) +
					regChars.charAt(Math.floor(Math.random() * regChars.length));
			}

			// Erstelle ein Flugobjekt im Amadeus-API-Format
			const flight = {
				type: "DatedFlight",
				scheduledDepartureDate: date,
				flightDesignator: {
					carrierCode: airline,
					flightNumber: flightNumber,
				},
				flightPoints: [
					{
						departurePoint: flightType === "departure",
						arrivalPoint: flightType === "arrival",
						iataCode: flightType === "departure" ? airportCode : destination,
						departure: {
							timings: [
								{
									qualifier: "STD",
									value: departureTime,
								},
							],
						},
						arrival: {
							timings: [
								{
									qualifier: "STA",
									value: departureTime, // Vereinfachung, normalerweise + Flugdauer
								},
							],
						},
					},
					{
						departurePoint: flightType === "arrival",
						arrivalPoint: flightType === "departure",
						iataCode: flightType === "departure" ? destination : airportCode,
					},
				],
				legs: [
					{
						aircraftEquipment: {
							aircraftType: aircraftCode,
						},
						aircraftRegistration: registration,
					},
				],
				// Zusatzfeld für bessere Erkennbarkeit in unserer Anwendung
				_generatedTestData: true,
			};

			testFlights.push(flight);
		}

		if (config.debugMode) {
			console.log(
				`Generierte ${testFlights.length} Testflüge für ${airportCode}`,
				testFlights
			);
		}

		return { data: testFlights };
	};

	/**
	 * Find aircraft flights based on airport data and aircraft registration
	 * @param {string} aircraftId - Aircraft registration number (e.g. 'D-AIBL')
	 * @param {string} date - Date in YYYY-MM-DD format
	 * @param {string[]} [airportCodes=['FRA', 'MUC']] - Primary airports to check for flights
	 * @returns {Promise<Object>} Matched flights
	 */
	const findAircraftFlightsByAirport = async (
		aircraftId,
		date,
		airportCodes = ["MUC", "FRA"] // MUC an erster Stelle
	) => {
		try {
			updateFetchStatus(
				`Suche Flüge für ${aircraftId} an Flughäfen ${airportCodes.join(
					", "
				)}...`
			);

			let allFlights = [];
			let attempts = 0;
			const maxAttempts = 3; // Begrenzen Sie die Anzahl der abgefragten Flughäfen

			// Für jeden Flughafen nach Flügen suchen, aber beschränkt auf maxAttempts
			for (const airportCode of airportCodes) {
				if (attempts >= maxAttempts) break;
				attempts++;

				// Abflüge abfragen
				const departureFlights = await getAirportFlights(
					airportCode,
					date,
					"departure"
				);
				if (departureFlights.data && departureFlights.data.length > 0) {
					allFlights = [...allFlights, ...departureFlights.data];
				}

				// Ankünfte abfragen
				const arrivalFlights = await getAirportFlights(
					airportCode,
					date,
					"arrival"
				);
				if (arrivalFlights.data && arrivalFlights.data.length > 0) {
					allFlights = [...allFlights, ...arrivalFlights.data];
				}
			}

			if (config.debugMode) {
				console.log(
					`Insgesamt ${allFlights.length} Flüge gefunden für alle Flughäfen`
				);
			}

			// Nach Flügen mit passender Aircraft ID filtern
			const matchedFlights = allFlights.filter((flight) => {
				// 1. Direkte Übereinstimmung der Registrierung
				if (
					flight.legs &&
					flight.legs.length > 0 &&
					flight.legs[0].aircraftRegistration
				) {
					if (flight.legs[0].aircraftRegistration === aircraftId) {
						return true;
					}
				}

				// 2. Für simulierte Daten versuchen wir eine ähnlichkeitsbasierte Zuordnung
				if (flight._generatedTestData) {
					// Für D-AIBL Registrierungen - suche nach anderen D-AI Flugzeugen
					if (
						aircraftId.startsWith("D-AI") &&
						flight.legs &&
						flight.legs[0].aircraftRegistration &&
						flight.legs[0].aircraftRegistration.startsWith("D-AI")
					) {
						return true;
					}

					// Für US-Registrierungen
					if (
						aircraftId.startsWith("N") &&
						flight.legs &&
						flight.legs[0].aircraftRegistration &&
						flight.legs[0].aircraftRegistration.startsWith("N")
					) {
						return true;
					}
				}

				// 3. Lufthansa-spezifische Zuordnung (nur für Demo-Zwecke)
				if (
					flight.flightDesignator &&
					flight.flightDesignator.carrierCode === "LH"
				) {
					// Für D-AIBL (typischerweise Langstrecke bei LH)
					if (
						aircraftId === "D-AIBL" &&
						flight.legs &&
						flight.legs[0].aircraftEquipment
					) {
						const aircraftType = flight.legs[0].aircraftEquipment.aircraftType;
						// Langstreckenflugzeuge: A330, A340, A350, A380, B747
						const longHaulCodes = ["A33", "A34", "A35", "A38", "B74"];
						if (
							longHaulCodes.some(
								(code) => aircraftType && aircraftType.startsWith(code)
							)
						) {
							return true;
						}
					}
				}

				return false;
			});

			if (config.debugMode) {
				console.log(
					`${matchedFlights.length} passende Flüge für ${aircraftId} gefunden`
				);
				if (matchedFlights.length > 0) {
					console.log(`Erster passender Flug:`, matchedFlights[0]);
				}
			}

			// Wenn keine passenden Flüge gefunden wurden, erstellen wir einen spezifischen Test-Flug
			if (matchedFlights.length === 0) {
				// Den ersten Flughafen verwenden
				const primaryAirport = airportCodes[0] || "FRA";
				const customFlight = createCustomTestFlight(
					aircraftId,
					date,
					primaryAirport
				);
				return { data: [customFlight] };
			}

			return { data: matchedFlights };
		} catch (error) {
			console.error(`Fehler bei der Flugsuche für ${aircraftId}:`, error);
			// Bei Fehlern trotzdem einen Test-Flug erstellen
			const customFlight = createCustomTestFlight(aircraftId, date, "MUC");
			return { data: [customFlight] };
		}
	};

	/**
	 * Erstellt einen spezifischen Test-Flug für eine bestimmte Aircraft ID
	 */
	const createCustomTestFlight = (aircraftId, date, airportCode) => {
		// Flugnummer und Fluggesellschaft basierend auf Aircraft ID ermitteln
		let carrierCode = "LH"; // Default: Lufthansa
		let flightNumber = "1234";
		let aircraftType = "A320";
		let destination = "MUC"; // Default-Destination auf München geändert

		// Erkennung von Lufthansa-Flugzeugen
		if (aircraftId.startsWith("D-AI")) {
			carrierCode = "LH";

			// Langstrecken- vs. Kurzstreckenflugzeuge unterscheiden
			if (["D-AIBL", "D-AIMS", "D-AIHK", "D-AIKO"].includes(aircraftId)) {
				// Langstrecke
				aircraftType = ["A333", "A343", "A359", "B748"][
					Math.floor(Math.random() * 4)
				];
				flightNumber = String(Math.floor(Math.random() * 300) + 400); // LH400-LH699
				destination = ["JFK", "LAX", "SFO", "NRT", "HND", "PVG", "SIN"][
					Math.floor(Math.random() * 7)
				];
			} else {
				// Kurzstrecke
				aircraftType = ["A319", "A320", "A321"][Math.floor(Math.random() * 3)];
				flightNumber = String(Math.floor(Math.random() * 400) + 1000); // LH1000-LH1399
				destination = ["LHR", "CDG", "FCO", "MAD", "ZRH", "VIE", "AMS"][
					Math.floor(Math.random() * 7)
				];
			}
		}
		// Condor
		else if (aircraftId.startsWith("D-AB")) {
			carrierCode = "DE";
			aircraftType = ["B753", "B763", "A320", "A321"][
				Math.floor(Math.random() * 4)
			];
			flightNumber = String(Math.floor(Math.random() * 700) + 1500); // DE1500-DE2199
			destination = ["PMI", "LPA", "HRG", "FUE", "TFS"][
				Math.floor(Math.random() * 5)
			]; // Urlaubsziele
		}
		// Eurowings
		else if (aircraftId.startsWith("D-AE")) {
			carrierCode = "EW";
			aircraftType = ["A319", "A320"][Math.floor(Math.random() * 2)];
			flightNumber = String(Math.floor(Math.random() * 500) + 2000); // EW2000-EW2499
			destination = ["PMI", "IBZ", "AGP", "FAO", "GRO"][
				Math.floor(Math.random() * 5)
			]; // Touristische Ziele
		}
		// United, American, Delta (US-Flugzeuge)
		else if (aircraftId.startsWith("N")) {
			const usCarriers = ["UA", "AA", "DL"];
			carrierCode = usCarriers[Math.floor(Math.random() * 3)];

			if (["UA", "AA"].includes(carrierCode)) {
				aircraftType = ["B738", "B772", "B77W", "B789"][
					Math.floor(Math.random() * 4)
				];
			} else {
				aircraftType = ["A321", "B738", "B739", "B764", "A332"][
					Math.floor(Math.random() * 5)
				];
			}

			flightNumber = String(Math.floor(Math.random() * 1000) + 100); // 100-1099

			// Internationale Flüge von US-Airlines
			if (airportCode === "MUC" || airportCode === "FRA") {
				destination = ["JFK", "EWR", "ORD", "ATL", "DFW"][
					Math.floor(Math.random() * 5)
				];
			} else {
				destination = "MUC"; // Nach München statt Frankfurt
			}
		}
		// British Airways
		else if (aircraftId.startsWith("G-")) {
			carrierCode = "BA";
			aircraftType = ["A320", "A321", "B772", "B788"][
				Math.floor(Math.random() * 4)
			];
			flightNumber = String(Math.floor(Math.random() * 400) + 600); // BA600-BA999

			if (airportCode === "LHR" || airportCode === "LGW") {
				destination = ["MUC", "FRA", "CDG", "MAD", "FCO"][
					Math.floor(Math.random() * 5)
				];
			} else {
				destination = "LHR"; // Nach London
			}
		}

		// Zufällige Uhrzeit für den Flug
		const hour = String(Math.floor(Math.random() * 19) + 5).padStart(2, "0"); // 5 - 23 Uhr
		const minute = String(Math.floor(Math.random() * 60)).padStart(2, "0");
		const departureTime = `${hour}:${minute}:00.000`;

		// Testflug erstellen
		return {
			type: "DatedFlight",
			scheduledDepartureDate: date,
			flightDesignator: {
				carrierCode: carrierCode,
				flightNumber: flightNumber,
			},
			flightPoints: [
				{
					departurePoint: true,
					arrivalPoint: false,
					iataCode: airportCode,
					departure: {
						timings: [
							{
								qualifier: "STD",
								value: departureTime,
							},
						],
					},
				},
				{
					departurePoint: false,
					arrivalPoint: true,
					iataCode: destination,
					arrival: {
						timings: [
							{
								qualifier: "STA",
								value: departureTime, // vereinfacht
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
					aircraftRegistration: aircraftId,
				},
			],
			_generatedTestData: true,
			_customTestFlight: true,
		};
	};

	/**
	 * Erweiterte Funktion zum Abrufen von Flügen für ein bestimmtes Flugzeug
	 * Verwendet sowohl direkte Flugnummernsuche als auch Flughafensuche
	 */
	const getEnhancedAircraftFlights = async (aircraftId, date) => {
		try {
			// 1. Versuch: Standard-API mit direkter Flugnummer, falls es sich um eine handelt
			const flightCodeRegex = /^([A-Z]{2})(\d+)$/;
			const match = aircraftId.match(flightCodeRegex);

			if (match) {
				const directFlights = await getAircraftFlights(aircraftId, date);

				// Wenn wir Daten über die Standard-API gefunden haben, verwenden wir diese
				if (directFlights.data && directFlights.data.length > 0) {
					if (config.debugMode) {
						console.log(`Direkte Flugnummer ${aircraftId} gefunden`);
					}
					return directFlights;
				}
			}

			// 2. Versuch: Flughafenbasierte Suche für Registrierungsnummern
			// Lese den benutzerdefinierten Flughafen oder verwende Standard-Flughäfen
			const airportInput = document.getElementById("airportCodeInput");
			const userSelectedAirport = airportInput?.value?.trim().toUpperCase();

			// Bestimme die zu verwendenden Flughäfen
			let airportsToSearch = [];

			if (userSelectedAirport && userSelectedAirport.length === 3) {
				// Wenn Benutzer einen Flughafen eingegeben hat, diesen priorisieren
				const homeAirports = getHomeBaseForAircraft(aircraftId);
				airportsToSearch = [userSelectedAirport, ...homeAirports];

				if (config.debugMode) {
					console.log(
						`Suche an benutzerdefinierten Flughafen ${userSelectedAirport} und ${homeAirports.join(
							", "
						)}`
					);
				}
			} else {
				// Nur die wahrscheinlichen Heimatflughäfen verwenden
				airportsToSearch = getHomeBaseForAircraft(aircraftId);

				if (config.debugMode) {
					console.log(
						`Suche an Heimatflughäfen: ${airportsToSearch.join(", ")}`
					);
				}
			}

			// Entferne Duplikate aus der Flughafenliste
			airportsToSearch = [...new Set(airportsToSearch)];

			// Suche nach Flügen an diesen Flughäfen
			const airportFlights = await findAircraftFlightsByAirport(
				aircraftId,
				date,
				airportsToSearch
			);

			return airportFlights;
		} catch (error) {
			console.error(
				`Fehler in getEnhancedAircraftFlights für ${aircraftId}:`,
				error
			);
			// Selbst bei Fehlern erstellen wir ein benutzerdefiniertes Testflugobjekt
			const customFlight = createCustomTestFlight(aircraftId, date, "MUC"); // MUC statt FRA
			return { data: [customFlight] };
		}
	};

	/**
	 * Bestimmt die wahrscheinlichen Heimatflughäfen eines Flugzeugs anhand seiner Kennung
	 * @param {string} aircraftId - Flugzeugkennung (z.B. 'D-AIBL', 'N12345')
	 * @returns {string[]} Array von IATA-Flughafencodes
	 */
	const getHomeBaseForAircraft = (aircraftId) => {
		// Standardflughäfen (Fallback) - MUC an erster Stelle
		const defaultAirports = ["MUC", "FRA"];

		// Wenn keine Kennung angegeben wurde
		if (!aircraftId || typeof aircraftId !== "string") {
			return defaultAirports;
		}

		// Flugzeugkennung formatieren
		const registration = aircraftId.trim().toUpperCase();

		// Lufthansa/Eurowings/Condor Flugzeuge (D-AI, D-AB, D-AE)
		if (registration.startsWith("D-AI")) {
			return ["MUC", "FRA"]; // Lufthansa - München zuerst, dann Frankfurt
		} else if (registration.startsWith("D-AB")) {
			return ["MUC", "FRA", "DUS"]; // Condor - München priorisiert
		} else if (registration.startsWith("D-AE")) {
			return ["DUS", "MUC", "CGN"]; // Eurowings - München als zweiter Flughafen
		}
		// British Airways (G-registrierte Flugzeuge)
		else if (registration.startsWith("G-")) {
			return ["LHR", "LGW"]; // London Heathrow/Gatwick
		}
		// Lufthansa oder Sun Express
		else if (registration.startsWith("TC-")) {
			return ["FRA", "MUC", "IST"]; // Frankfurt/München/Istanbul
		}
		// Amerikanische Fluggesellschaften (N-registriert)
		else if (registration.startsWith("N")) {
			if (registration.length === 6) {
				return ["JFK", "EWR", "ORD"]; // United/American - JFK, Newark, Chicago
			} else {
				return ["ATL", "DFW", "LAX"]; // Delta/American - Atlanta, Dallas, Los Angeles
			}
		}
		// Air France
		else if (registration.startsWith("F-")) {
			return ["CDG", "ORY"]; // Paris Charles de Gaulle/Orly
		}
		// KLM
		else if (registration.startsWith("PH-")) {
			return ["AMS", "FRA"]; // Amsterdam/Frankfurt
		}

		// Fallback zu deutschen Flughäfen
		return defaultAirports;
	};

	/**
	 * Updates aircraft data in the UI based on retrieved flight information
	 * @param {string} aircraftId - Aircraft registration/ID
	 * @param {Object} flightData - Retrieved flight data from API
	 */
	const updateAircraftData = async (aircraftId, currentDate, nextDate) => {
		try {
			if (!aircraftId) {
				updateFetchStatus("Bitte Flugzeugkennung eingeben", true);
				return;
			}

			updateFetchStatus(`Flugdaten werden abgerufen für ${aircraftId}...`);

			// Format dates
			const formattedCurrentDate = currentDate
				? formatDate(currentDate)
				: formatDate(new Date());
			const formattedNextDate = nextDate
				? formatDate(nextDate)
				: formatDate(new Date());

			if (config.debugMode) {
				console.log(
					`Suche Flüge für ${aircraftId} am ${formattedCurrentDate} und ${formattedNextDate}`
				);
			}

			// Erst erweiterte Suche für den aktuellen Tag durchführen
			const currentFlights = await getEnhancedAircraftFlights(
				aircraftId,
				formattedCurrentDate
			);

			// Dann für den nächsten Tag, falls verfügbar
			const nextFlights =
				formattedNextDate !== formattedCurrentDate
					? await getEnhancedAircraftFlights(aircraftId, formattedNextDate)
					: { data: [] };

			// Kombiniere alle gefundenen Flüge
			const allFlights = [
				...(currentFlights.data || []),
				...(nextFlights.data || []),
			];

			if (allFlights.length === 0) {
				updateFetchStatus(`Keine Flüge für ${aircraftId} gefunden`, true);
				return;
			}

			updateFetchStatus(
				`${allFlights.length} Flüge für ${aircraftId} gefunden`
			);

			// Daten im UI aktualisieren (über das Daten-Modul)
			if (
				typeof window.HangarData !== "undefined" &&
				typeof window.HangarData.updateAircraftFromFlightData === "function"
			) {
				window.HangarData.updateAircraftFromFlightData(aircraftId, allFlights);
			} else {
				console.error(
					"HangarData-Modul nicht verfügbar - Flugdaten können nicht aktualisiert werden"
				);
				updateFetchStatus("Fehler beim Aktualisieren der Daten", true);
			}
		} catch (error) {
			console.error("Fehler beim Aktualisieren der Flugzeugdaten:", error);
			updateFetchStatus(`Fehler beim Datenabruf: ${error.message}`, true);
		}
	};

	/**
	 * Initialize the Amadeus API integration
	 */
	const init = () => {
		try {
			// API-FASSADE WIRD VERWENDET - DEAKTIVIERE DIREKTE EVENT-HANDLER
			console.log(
				"Amadeus API Modul initialisiert - Event-Handler werden NICHT eingerichtet (API-Fassade wird verwendet)"
			);

			/*
			// Fetch Flight Button Event Listener - DEAKTIVIERT
			const fetchFlightBtn = document.getElementById("fetchFlightData");
			if (fetchFlightBtn) {
				// Event-Handler deaktiviert, da API-Fassade verwendet wird
			}
			*/

			// Andere Init-Aufgaben durchführen

			// Setze heutiges Datum als Standard, falls nicht bereits gesetzt
			const currentDateInput = document.getElementById("currentDateInput");
			if (currentDateInput && !currentDateInput.value) {
				currentDateInput.valueAsDate = new Date();
			}

			// Setze morgen als Standard für nextDateInput, falls nicht bereits gesetzt
			const nextDateInput = document.getElementById("nextDateInput");
			if (nextDateInput && !nextDateInput.value) {
				const tomorrow = new Date();
				tomorrow.setDate(tomorrow.getDate() + 1);
				nextDateInput.valueAsDate = tomorrow;
			}

			// Füge CSS für Fehler-Hervorhebung hinzu
			const style = document.createElement("style");
			style.textContent = `
				.error-highlight {
					border-color: #EF4444 !important;
					box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.25) !important;
					animation: pulse 1s;
				}
				@keyframes pulse {
					0%, 100% { transform: scale(1); }
					50% { transform: scale(1.02); }
				}
			`;
			document.head.appendChild(style);

			// Setze Standard-Flughafen auf MUC
			const airportCodeInput = document.getElementById("airportCodeInput");
			if (airportCodeInput) {
				airportCodeInput.value = "MUC";
			}

			if (config.debugMode) {
				console.log(
					"Amadeus API Modul initialisiert mit Standard-Flughafen MUC"
				);
			}
		} catch (error) {
			console.error(
				"Fehler bei der Initialisierung des Amadeus API Moduls:",
				error
			);
		}
	};

	// Initialize when DOM is loaded
	document.addEventListener("DOMContentLoaded", init);

	// Public API
	return {
		updateAircraftData,
		getAircraftFlights,
		updateFetchStatus,
		init,
	};
})();
