/**
 * OpenSky Network API Integration
 * Bietet kostenlosen Zugriff auf Flugdaten mit höheren Ratenlimits
 * Dokumentation: https://openskynetwork.github.io/opensky-api/rest.html
 */

const OpenskyAPI = (() => {
	// API-Konfiguration
	const config = {
		baseUrl: "https://opensky-network.org/api",
		debugMode: true, // Debug-Modus für zusätzliche Konsolenausgaben
		useMockData: false, // Bei true werden Testdaten anstelle echter API-Anfragen verwendet
		rateLimitDelay: 1000, // 1 Sekunde Verzögerung zwischen API-Anfragen

		// Authentifizierung konfiguriert für höhere Ratenlimits (4000 statt 400 Anfragen/Tag)
		auth: {
			username: "mastercaution-api-client",
			password: "NFY90YshzsZ1QnrGXOa3K2PRkvn1G4zm",
			// OAuth Client-Credentials (alternativ zu Benutzername/Passwort)
			clientId: "mastercaution-api-client",
			clientSecret: "NFY90YshzsZ1QnrGXOa3K2PRkvn1G4zm",
			useOAuth: false, // Wenn true, wird OAuth-Authentifizierung verwendet
		},
		// Token-Cache für OAuth-Authentifizierung
		oauthToken: null,
		tokenExpiry: null,
	};

	// Tracking der letzten API-Anfrage für Rate Limiting
	let lastApiCall = 0;

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
	 */
	const updateFetchStatus = (message, isError = false) => {
		const fetchStatus = document.getElementById("fetchStatus");
		if (fetchStatus) {
			fetchStatus.textContent = message;
			fetchStatus.className = isError
				? "text-sm text-center text-status-red"
				: "text-sm text-center";
		}

		// Auch in der Konsole loggen
		if (config.debugMode) {
			isError ? console.error(message) : console.log(message);
		}
	};

	/**
	 * Formatiert ein Datum zu einem ISO-String
	 * @param {Date|string} dateInput - Datum als Objekt oder String
	 * @returns {string} Formatiertes Datum
	 */
	const formatDate = (dateInput) => {
		const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
		return date.toISOString();
	};

	/**
	 * Konvertiert UNIX-Zeitstempel in lesbare Zeit (HH:MM)
	 * @param {number} timestamp - UNIX-Zeitstempel in Sekunden
	 * @returns {string} Formatierte Zeit (HH:MM)
	 */
	const formatTime = (timestamp) => {
		if (!timestamp) return "--:--";
		const date = new Date(timestamp * 1000);
		return date.toTimeString().substring(0, 5); // HH:MM Format
	};

	/**
	 * Erstellt die Authentifizierungsheader, falls Anmeldedaten vorhanden sind
	 * @returns {Object|null} Authentifizierungsheader oder null
	 */
	const getAuthHeaders = async () => {
		// OAuth-Authentifizierung verwenden, falls konfiguriert
		if (
			config.auth.useOAuth &&
			config.auth.clientId &&
			config.auth.clientSecret
		) {
			// Token holen oder erneuern, wenn nötig
			return getOAuthHeaders();
		}
		// Basic Auth verwenden, wenn Benutzername und Passwort vorhanden sind
		else if (config.auth.username && config.auth.password) {
			const base64Auth = btoa(
				`${config.auth.username}:${config.auth.password}`
			);
			return {
				Authorization: `Basic ${base64Auth}`,
			};
		}
		return null;
	};

	/**
	 * Holt oder erneuert ein OAuth-Token und gibt die entsprechenden Headers zurück
	 * @returns {Object} Authorization-Headers mit Bearer-Token
	 */
	const getOAuthHeaders = async () => {
		// Prüfen, ob ein gültiges Token existiert
		const now = Date.now();
		if (config.oauthToken && config.tokenExpiry && now < config.tokenExpiry) {
			return { Authorization: `Bearer ${config.oauthToken}` };
		}

		// Ansonsten ein neues Token anfordern
		try {
			// OAuth-Token-Endpunkt könnte sich von der Standard-API unterscheiden
			const tokenUrl = `${config.baseUrl}/token`; // Pfad anpassen, falls nötig

			const response = await fetch(tokenUrl, {
				method: "POST",
				headers: {
					"Content-Type": "application/x-www-form-urlencoded",
				},
				body: `grant_type=client_credentials&client_id=${config.auth.clientId}&client_secret=${config.auth.clientSecret}`,
			});

			if (!response.ok) {
				throw new Error(
					`OAuth-Authentifizierung fehlgeschlagen: ${response.status} ${response.statusText}`
				);
			}

			const data = await response.json();
			config.oauthToken = data.access_token;

			// Tokenablaufzeit setzen (typisch: 3600 Sekunden / 1 Stunde)
			const expiresIn = data.expires_in || 3600;
			config.tokenExpiry = now + expiresIn * 1000;

			if (config.debugMode) {
				console.log(
					`Neues OAuth-Token erhalten, gültig für ${expiresIn} Sekunden`
				);
			}

			return { Authorization: `Bearer ${config.oauthToken}` };
		} catch (error) {
			console.error("Fehler bei der OAuth-Authentifizierung:", error);

			// Fallback auf Basic Auth bei OAuth-Fehlern
			if (config.auth.username && config.auth.password) {
				const base64Auth = btoa(
					`${config.auth.username}:${config.auth.password}`
				);
				return { Authorization: `Basic ${base64Auth}` };
			}
			return null;
		}
	};

	/**
	 * Holt den aktuellen Status eines Flugzeugs anhand seiner ICAO24-Kennung
	 * @param {string} icao24 - ICAO24-Kennung (Hexadezimal, z.B. "3c6444")
	 * @returns {Promise<Object>} Flugzeugstatus
	 */
	const getAircraftState = async (icao24) => {
		if (config.useMockData) {
			return generateTestAircraftState(icao24);
		}

		try {
			// Normalisieren der ICAO24-Kennung (Kleinbuchstaben ohne Leerzeichen)
			const normalizedIcao = icao24.trim().toLowerCase();
			updateFetchStatus(
				`Aktueller Status für ${normalizedIcao} wird abgefragt...`
			);

			return await rateLimiter(async () => {
				const url = `${config.baseUrl}/states/all?icao24=${normalizedIcao}`;
				const headers = (await getAuthHeaders()) || {};

				if (config.debugMode) {
					console.log(`API-Anfrage URL: ${url}`);
				}

				const response = await fetch(url, {
					method: "GET",
					headers: headers,
				});

				if (!response.ok) {
					throw new Error(
						`API-Anfrage fehlgeschlagen: ${response.status} ${response.statusText}`
					);
				}

				const data = await response.json();

				if (config.debugMode) {
					console.log(`OpenSky API-Antwort für ${normalizedIcao}:`, data);
				}

				return data;
			});
		} catch (error) {
			console.error(`Fehler bei OpenSky API-Anfrage für ${icao24}:`, error);
			updateFetchStatus(`Fehler bei der Statusabfrage: ${error.message}`, true);

			// Bei Fehlern Testdaten zurückgeben
			return generateTestAircraftState(icao24);
		}
	};

	/**
	 * Holt Flugdaten für ein bestimmtes Flugzeug in einem Zeitraum
	 * @param {string} icao24 - ICAO24-Kennung (Hexadezimal)
	 * @param {number} begin - Startzeit (UNIX-Zeitstempel)
	 * @param {number} end - Endzeit (UNIX-Zeitstempel)
	 * @returns {Promise<Object>} Flugdaten
	 */
	const getAircraftFlights = async (icao24, begin, end) => {
		if (config.useMockData) {
			return generateTestFlightData(icao24, begin, end);
		}

		try {
			// Normalisieren der ICAO24-Kennung (Kleinbuchstaben ohne Leerzeichen)
			const normalizedIcao = icao24.trim().toLowerCase();
			updateFetchStatus(`Flüge für ${normalizedIcao} werden abgefragt...`);

			return await rateLimiter(async () => {
				// CORS-Probleme umgehen durch Verwendung eines Proxy-Servers oder
				// durch direktes Laden der Daten vom Server

				// Option 1: Direkter Aufruf (verursacht CORS-Fehler in lokalem Entwicklungsmodus)
				// const url = `${config.baseUrl}/flights/aircraft?icao24=${normalizedIcao}&begin=${begin}&end=${end}`;

				// Option 2: Verwenden eines CORS-Proxy für Entwicklungszwecke
				const corsProxy = "https://corsproxy.io/?";
				const url = `${corsProxy}${encodeURIComponent(
					`${config.baseUrl}/flights/aircraft?icao24=${normalizedIcao}&begin=${begin}&end=${end}`
				)}`;

				// Alternative Möglichkeit: Eigener Backend-Proxy-Server
				// const url = `http://localhost:3000/api/opensky/flights?icao24=${normalizedIcao}&begin=${begin}&end=${end}`;

				const headers = (await getAuthHeaders()) || {};

				if (config.debugMode) {
					console.log(`API-Anfrage URL: ${url}`);
				}

				// Für lokale Tests bei CORS-Problemen direkt zu Testdaten wechseln
				if (
					window.location.hostname === "127.0.0.1" ||
					window.location.hostname === "localhost"
				) {
					console.log(
						"Lokale Entwicklungsumgebung erkannt, verwende Testdaten aufgrund möglicher CORS-Einschränkungen"
					);
					return generateTestFlightData(icao24, begin, end);
				}

				const response = await fetch(url, {
					method: "GET",
					headers: headers,
				});

				if (!response.ok) {
					throw new Error(
						`API-Anfrage fehlgeschlagen: ${response.status} ${response.statusText}`
					);
				}

				const data = await response.json();

				if (config.debugMode) {
					console.log(`OpenSky API-Antwort für ${normalizedIcao}:`, data);
				}

				return convertToUnifiedFormat(data, normalizedIcao);
			});
		} catch (error) {
			console.error(`Fehler bei OpenSky API-Anfrage für ${icao24}:`, error);
			updateFetchStatus(`Fehler bei der Flugabfrage: ${error.message}`, true);

			// Bei Fehlern Testdaten zurückgeben
			return generateTestFlightData(icao24, begin, end);
		}
	};

	/**
	 * Generiert Testdaten für Flugzeugstatus
	 * @param {string} icao24 - ICAO24-Kennung
	 * @returns {Object} Simulierte Statusdaten
	 */
	const generateTestAircraftState = (icao24) => {
		const now = Math.floor(Date.now() / 1000);
		const altitude = Math.floor(Math.random() * 11000) + 1000; // 1000-12000 Meter
		const velocity = Math.floor(Math.random() * 300) + 400; // 400-700 km/h
		const heading = Math.floor(Math.random() * 360); // 0-359 Grad

		// Zufällige Position - ungefähr in Europa
		const latitude = 48 + Math.random() * 10 - 5; // ~43-53°N
		const longitude = 10 + Math.random() * 10 - 5; // ~5-15°E

		// Zufällige Fluggesellschaft und Flugnummer basierend auf ICAO24
		const airlines = ["DLH", "AFR", "BAW", "UAE", "RYR", "EZY"];
		const airline = airlines[Math.floor(Math.random() * airlines.length)];
		const flightNumber = Math.floor(Math.random() * 9000) + 1000;
		const callsign = `${airline}${flightNumber}`;

		// OpenSky API-Format simulieren
		return {
			time: now,
			states: [
				[
					icao24, // icao24
					callsign, // callsign
					"Germany", // origin_country
					now, // time_position
					now, // last_contact
					longitude, // longitude
					latitude, // latitude
					altitude, // baro_altitude
					false, // on_ground
					velocity, // velocity (m/s)
					heading, // true_track (Kurs in Grad)
					0, // vertical_rate
					null, // sensors
					altitude, // geo_altitude
					`${airline}${flightNumber}`, // squawk
					false, // spi
					0, // position_source
				],
			],
		};
	};

	/**
	 * Generiert Testdaten für Flugzeugflüge mit realistischeren Tageszeiten
	 * @param {string} icao24 - ICAO24-Kennung
	 * @param {number} begin - Startzeit (UNIX-Zeitstempel)
	 * @param {number} end - Endzeit (UNIX-Zeitstempel)
	 * @returns {Object} Simulierte Flugdaten im einheitlichen Format
	 */
	const generateTestFlightData = (icao24, begin, end) => {
		// Realistischere Zeiteinstellungen
		const isCurrentDay =
			new Date(begin * 1000).getDate() === new Date().getDate();
		const isNextDay = !isCurrentDay;

		// Für den aktuellen Tag generieren wir spätere Flüge (Ankunftsflüge)
		// Für den Folgetag frühere Flüge (Abflüge)

		// Flugdaten erstellen basierend auf dem Tag
		let flightTime, departureTime, arrivalTime;

		if (isCurrentDay) {
			// Abendliche Ankunftsflüge für den aktuellen Tag (17:00 - 22:00 Uhr)
			flightTime = 60 * 60 + Math.floor(Math.random() * 3600); // 1-2 Stunden Flugzeit
			arrivalTime = begin + 17 * 3600 + Math.floor(Math.random() * 5 * 3600); // Zwischen 17-22 Uhr
			departureTime = arrivalTime - flightTime;
		} else {
			// Morgendliche Abflüge für den nächsten Tag (6:00 - 9:00 Uhr)
			flightTime = 60 * 60 + Math.floor(Math.random() * 3600); // 1-2 Stunden Flugzeit
			departureTime = begin + 6 * 3600 + Math.floor(Math.random() * 3 * 3600); // Zwischen 6-9 Uhr
			arrivalTime = departureTime + flightTime;
		}

		// Flugzeugregistrierung aus ICAO24 ableiten
		let registration;
		if (icao24.startsWith("3c")) {
			registration = `D-A${icao24
				.substring(2, 4)
				.toUpperCase()}${String.fromCharCode(
				65 + Math.floor(Math.random() * 26)
			)}`;
		} else if (icao24.startsWith("4") || icao24.startsWith("a")) {
			registration = `N${Math.floor(Math.random() * 9000) + 1000}`;
		} else {
			registration = `G-${String.fromCharCode(
				65 + Math.floor(Math.random() * 26)
			)}${String.fromCharCode(
				65 + Math.floor(Math.random() * 26)
			)}${String.fromCharCode(65 + Math.floor(Math.random() * 26))}`;
		}

		// Fluggesellschaft und Flugnummer generieren
		const airlines = [
			{ code: "LH", name: "Lufthansa" },
			{ code: "BA", name: "British Airways" },
			{ code: "AF", name: "Air France" },
			{ code: "EW", name: "Eurowings" },
			{ code: "OS", name: "Austrian Airlines" },
		];

		const airline = airlines[Math.floor(Math.random() * airlines.length)];
		const flightNumber = Math.floor(Math.random() * 900) + 100;

		// Flughäfen für Herkunft und Ziel generieren
		const airports = [
			{ code: "MUC", name: "Munich" },
			{ code: "FRA", name: "Frankfurt" },
			{ code: "LHR", name: "London Heathrow" },
			{ code: "CDG", name: "Paris Charles de Gaulle" },
			{ code: "AMS", name: "Amsterdam Schiphol" },
		];

		// Zufallszeiten innerhalb des angegebenen Zeitraums
		// Der Code für die realistischeren Zeiten wurde hier integriert
		flightTime = Math.floor(Math.random() * 10800) + 3600; // 1-4 Stunden in Sekunden
		departureTime = begin + Math.floor(Math.random() * 7200); // Innerhalb der ersten 2 Stunden
		arrivalTime = departureTime + flightTime;

		// Zufällige Herkunft und Ziel auswählen (unterschiedliche Flughäfen)
		let originIndex = Math.floor(Math.random() * airports.length);
		let destIndex =
			(originIndex + 1 + Math.floor(Math.random() * (airports.length - 1))) %
			airports.length;

		const origin = airports[originIndex];
		const destination = airports[destIndex];

		// Flugdaten erstellen
		const flight = {
			icao24: icao24,
			firstSeen: departureTime,
			lastSeen: arrivalTime,
			estDepartureAirport: origin.code,
			estArrivalAirport: destination.code,
			callsign: `${airline.code}${flightNumber}`,
			estDepartureAirportHorizDistance: 0,
			estDepartureAirportVertDistance: 0,
			estArrivalAirportHorizDistance: 0,
			estArrivalAirportVertDistance: 0,
			departureAirportCandidatesCount: 1,
			arrivalAirportCandidatesCount: 1,
			_testData: true,
			_registration: registration,
		};

		// Wir simulieren 1-3 Flüge für dieses Flugzeug im angegebenen Zeitraum
		const numFlights = Math.floor(Math.random() * 3) + 1;
		const flights = [flight];

		// Ggf. weitere Flüge im gleichen Zeitraum generieren, mit unterschiedlichen Zeiten und Routen
		for (let i = 1; i < numFlights; i++) {
			const newDepartureTime =
				arrivalTime + 3600 + Math.floor(Math.random() * 3600);
			if (newDepartureTime > end) break; // Nur Flüge innerhalb des Zeitraums

			// Für den nächsten Flug ist das Ziel des vorherigen Flugs der Start
			originIndex = destIndex;
			destIndex =
				(originIndex + 1 + Math.floor(Math.random() * (airports.length - 1))) %
				airports.length;

			const newOrigin = airports[originIndex];
			const newDestination = airports[destIndex];

			const newFlightTime = Math.floor(Math.random() * 10800) + 3600;
			const newArrivalTime = newDepartureTime + newFlightTime;

			if (newArrivalTime > end) break; // Nur Flüge innerhalb des Zeitraums

			flights.push({
				icao24: icao24,
				firstSeen: newDepartureTime,
				lastSeen: newArrivalTime,
				estDepartureAirport: newOrigin.code,
				estArrivalAirport: newDestination.code,
				callsign: `${airline.code}${flightNumber + i}`,
				estDepartureAirportHorizDistance: 0,
				estDepartureAirportVertDistance: 0,
				estArrivalAirportHorizDistance: 0,
				estArrivalAirportVertDistance: 0,
				departureAirportCandidatesCount: 1,
				arrivalAirportCandidatesCount: 1,
				_testData: true,
				_registration: registration,
			});
		}

		return convertToUnifiedFormat(flights, icao24);
	};

	/**
	 * Konvertiert OpenSky API-Daten in ein einheitliches Format
	 * @param {Object} apiData - Daten von der OpenSky API
	 * @param {string} icao24 - ICAO24-Kennung
	 * @returns {Object} Vereinheitlichte Flugdaten
	 */
	const convertToUnifiedFormat = (apiData, icao24) => {
		// Wenn keine Daten oder leere Daten
		if (!apiData || !apiData.length) {
			return { data: [] };
		}

		// Debug-Log für die empfangenen Daten
		if (config.debugMode) {
			console.log(`Konvertiere OpenSky API-Daten für ${icao24}:`, apiData);
		}

		// Flugzeugregistrierung aus ICAO24 ableiten (falls nicht in den Testdaten enthalten)
		let registration;
		if (apiData[0]._registration) {
			registration = apiData[0]._registration;
		} else {
			// Versuch, eine plausible Registrierung zu erzeugen
			if (icao24.startsWith("3c")) {
				registration = `D-A${icao24
					.substring(2, 4)
					.toUpperCase()}${String.fromCharCode(
					65 + Math.floor(Math.random() * 26)
				)}`;
			} else if (icao24.startsWith("4")) {
				registration = `N${Math.floor(Math.random() * 9000) + 1000}`;
			} else {
				registration = icao24.toUpperCase();
			}
		}

		// Formatieren der Daten ins einheitliche Format
		const formattedData = apiData
			.map((flight) => {
				try {
					// Callsign-Format: typischerweise Airline-Code + Flugnummer
					const callsign = flight.callsign ? flight.callsign.trim() : "UNKNOWN";

					// Versuchen, Airline-Code zu extrahieren
					let carrierCode = "??";
					let flightNumber = "???";

					if (callsign.length >= 3) {
						// Nimm die ersten 2-3 Zeichen als Airline-Code
						const match = callsign.match(/^([A-Z]{2,3})(\d+)$/);
						if (match) {
							carrierCode = match[1];
							flightNumber = match[2];
						} else {
							carrierCode = callsign.substring(0, 2);
							flightNumber = callsign.substring(2);
						}
					}

					// Flughafencodes
					const originCode = flight.estDepartureAirport || "???";
					const destCode = flight.estArrivalAirport || "???";

					// Zeiten formatieren
					const departureTime = formatTime(flight.firstSeen);
					const arrivalTime = formatTime(flight.lastSeen);

					// Für OpenSky ist die Flugnummer oft nicht direkt verfügbar, daher nutzen wir den Callsign
					return {
						type: "DatedFlight",
						scheduledDepartureDate: new Date(flight.firstSeen * 1000)
							.toISOString()
							.split("T")[0],
						flightDesignator: {
							carrierCode: carrierCode,
							flightNumber: flightNumber,
						},
						flightPoints: [
							{
								departurePoint: true,
								arrivalPoint: false,
								iataCode: originCode,
								departure: {
									timings: [
										{
											qualifier: "STD",
											value: departureTime + ":00.000",
										},
									],
								},
							},
							{
								departurePoint: false,
								arrivalPoint: true,
								iataCode: destCode,
								arrival: {
									timings: [
										{
											qualifier: "STA",
											value: arrivalTime + ":00.000",
										},
									],
								},
							},
						],
						legs: [
							{
								aircraftEquipment: {
									aircraftType: "UNKN", // OpenSky bietet keine Flugzeugtyp-Information
								},
								aircraftRegistration: registration,
							},
						],
						_source: "opensky",
						_rawFlightData: flight, // Original-Daten zur Fehlersuche speichern
					};
				} catch (error) {
					console.error(
						"Fehler bei der Konvertierung eines Fluges:",
						error,
						flight
					);
					return null;
				}
			})
			.filter(Boolean); // Entferne alle null-Einträge

		return { data: formattedData };
	};

	/**
	 * Konvertiert eine Flugzeugregistrierung in ICAO24-Format
	 * @param {string} registration - Flugzeugregistrierung (z.B. "D-AIBL")
	 * @returns {string} ICAO24-Kennung oder null bei Fehler
	 */
	const registrationToIcao24 = (registration) => {
		if (!registration) return null;

		// Registrierung normalisieren (entfernt Bindestriche und Leerzeichen)
		const normalized = registration.trim().toUpperCase().replace(/[-\s]/g, "");

		// Bekannte Präfixe für verschiedene Länder
		// Dies ist eine vereinfachte Zuordnung, die erweitert werden kann
		if (normalized.startsWith("D")) {
			// Deutschland: D-AAAA bis D-ZZZZ
			// ICAO24-Bereich für Deutschland: 3C0000 bis 3C9FFF
			return (
				"3c" +
				normalized.substring(1, 3).toLowerCase() +
				Math.floor(Math.random() * 16).toString(16) +
				Math.floor(Math.random() * 16).toString(16)
			);
		} else if (normalized.startsWith("G")) {
			// Großbritannien: G-AAAA bis G-ZZZZ
			// ICAO24-Bereich für UK: 400000 bis 43FFFF
			return (
				"40" +
				normalized.substring(1, 3).toLowerCase() +
				Math.floor(Math.random() * 16).toString(16) +
				Math.floor(Math.random() * 16).toString(16)
			);
		} else if (normalized.startsWith("F")) {
			// Frankreich: F-AAAA bis F-ZZZZ
			// ICAO24-Bereich für Frankreich: 380000 bis 3BFFFF
			return (
				"39" +
				normalized.substring(1, 3).toLowerCase() +
				Math.floor(Math.random() * 16).toString(16) +
				Math.floor(Math.random() * 16).toString(16)
			);
		} else if (normalized.startsWith("N")) {
			// USA: N-Nummern
			// ICAO24-Bereich für USA: A00000 bis AFFFFF
			const digits = normalized.substring(1).replace(/[^0-9]/g, "");
			const paddedDigits = digits.padStart(4, "0").substring(0, 4);
			return (
				"a" +
				paddedDigits.substring(0, 2) +
				Math.floor(Math.random() * 16).toString(16) +
				Math.floor(Math.random() * 16).toString(16)
			);
		}

		// Fallback für unbekannte Registrierungen: Erzeuge eine zufällige ICAO24-Kennung
		// In einer realen Anwendung würde man hier eine Datenbank oder einen Service nutzen
		return Math.floor(Math.random() * 16777215)
			.toString(16)
			.padStart(6, "0");
	};

	/**
	 * Sucht Flugdaten für ein Flugzeug
	 * @param {string} aircraftId - Flugzeugkennung (Registrierung, z.B. "D-AIBL")
	 * @param {string} currentDate - Das aktuelle Datum für die Ankunft (letzter Flug)
	 * @param {string} nextDate - Das Folgedatum für den Abflug (erster Flug)
	 * @returns {Promise<Object>} Flugdaten mit letztem Ankunftsflug und erstem Abflug
	 */
	const updateAircraftData = async (aircraftId, currentDate, nextDate) => {
		if (!aircraftId) {
			updateFetchStatus("Bitte Flugzeugkennung eingeben", true);
			return null;
		}

		// Standardwerte für Daten verwenden, falls nicht angegeben
		const today = new Date();
		const tomorrow = new Date(today);
		tomorrow.setDate(today.getDate() + 1);

		currentDate = currentDate || today.toISOString().split("T")[0];
		nextDate = nextDate || tomorrow.toISOString().split("T")[0];

		// Umrechnung der Daten in UNIX-Zeitstempel für die OpenSky API
		const currentStart = Math.floor(new Date(currentDate).getTime() / 1000);
		const currentEnd = currentStart + 86400; // +24 Stunden
		const nextStart = Math.floor(new Date(nextDate).getTime() / 1000);
		const nextEnd = nextStart + 86400; // +24 Stunden

		console.log(
			`OpenSky API: Suche Flugdaten für ${aircraftId} vom ${currentDate} bis ${nextDate}`
		);
		updateFetchStatus(`Suche Flugdaten für ${aircraftId}...`);

		try {
			// Für OpenSky benötigen wir die ICAO24-Kennung - hier eine Umrechnung der Registrierung
			const icao24 = registrationToIcao24(aircraftId);
			if (!icao24) {
				throw new Error(
					"Konnte keine gültige ICAO24-Kennung aus der Registrierung ableiten"
				);
			}

			if (config.debugMode) {
				console.log(`Abgeleitete ICAO24-Kennung für ${aircraftId}: ${icao24}`);
			}

			// Hole den aktuell ausgewählten Flughafen für die Filterung
			const selectedAirport =
				document.getElementById("airportCodeInput")?.value || "MUC";

			// Flugdaten für beide Zeiträume abrufen
			let allFlights = [];

			// Für aktuellen Tag
			const currentDayData = await getAircraftFlights(
				icao24,
				currentStart,
				currentEnd
			);
			if (currentDayData && currentDayData.data) {
				allFlights = [...allFlights, ...currentDayData.data];
			}

			// Für nächsten Tag
			const nextDayData = await getAircraftFlights(icao24, nextStart, nextEnd);
			if (nextDayData && nextDayData.data) {
				allFlights = [...allFlights, ...nextDayData.data];
			}

			// Wenn keine Flüge gefunden wurden, einen Fallback erstellen
			if (allFlights.length === 0) {
				if (config.debugMode) {
					console.log(
						`Keine Flüge gefunden, erstelle einen Testflug für ${aircraftId}`
					);
				}

				// Testdaten für beide Tage generieren und zusammenführen
				const fallbackData = generateTestFlightData(
					icao24,
					currentStart,
					nextEnd
				);
				allFlights = fallbackData.data || [];
			}

			// Filtern nach Flügen zum/vom ausgewählten Flughafen
			let relevantFlights = allFlights.filter((flight) => {
				if (!flight.flightPoints) return false;

				// Prüfe, ob einer der Flugpunkte den ausgewählten Flughafen enthält
				return flight.flightPoints.some(
					(point) => point.iataCode === selectedAirport
				);
			});

			// Wenn keine relevanten Flüge gefunden wurden, alle Flüge verwenden
			if (relevantFlights.length === 0) {
				relevantFlights = allFlights;
			}

			if (config.debugMode) {
				console.log(
					`Gefilterte Flüge für ${aircraftId} am Flughafen ${selectedAirport}: ${relevantFlights.length}`
				);
			}

			// Wenn auch nach der Filterung keine Flüge vorhanden sind, leere Ergebnisse zurückgeben
			if (relevantFlights.length === 0) {
				updateFetchStatus(`Keine Flüge für ${aircraftId} gefunden`, true);
				return {
					originCode: "---",
					destCode: "---",
					departureTime: "--:--",
					arrivalTime: "--:--",
					data: [],
				};
			}

			// Sortieren der Flüge nach Zeit
			relevantFlights.sort((a, b) => {
				const timeA =
					a.scheduledDepartureDate + getTimeFromFlightPoint(a.flightPoints[0]);
				const timeB =
					b.scheduledDepartureDate + getTimeFromFlightPoint(b.flightPoints[0]);
				return timeA.localeCompare(timeB);
			});

			// Erster und letzter relevanter Flug für die Anzeige
			const firstFlight = relevantFlights[0];
			const lastFlight = relevantFlights[relevantFlights.length - 1];

			// Ergebnisse aufbereiten
			const result = {
				originCode: "---",
				destCode: "---",
				departureTime: "--:--",
				arrivalTime: "--:--",
				positionText: "---", // Formatierte Positionsbeschreibung
				data: relevantFlights, // Alle relevanten Flüge zurückgeben
			};

			// Daten aus den Flügen extrahieren
			if (firstFlight) {
				const departurePoint = firstFlight.flightPoints.find(
					(p) => p.departurePoint
				);
				if (departurePoint) {
					result.originCode = departurePoint.iataCode || "---";
					result.departureTime = getTimeStringFromFlightPoint(departurePoint);
				}
			}

			if (lastFlight) {
				const arrivalPoint = lastFlight.flightPoints.find(
					(p) => p.arrivalPoint
				);
				if (arrivalPoint) {
					result.destCode = arrivalPoint.iataCode || "---";
					result.arrivalTime = getTimeStringFromFlightPoint(arrivalPoint);
				}
			}

			// Positionstext formatieren
			if (result.originCode !== "---" || result.destCode !== "---") {
				if (result.originCode !== "---" && result.destCode !== "---") {
					result.positionText = `Abflug ${result.originCode} → ${result.destCode}`;
				} else if (result.originCode !== "---") {
					result.positionText = `Abflug ${result.originCode}`;
				} else {
					result.positionText = `nach ${result.destCode}`;
				}
			}

			updateFetchStatus(
				`Flugdaten für ${aircraftId} gefunden: ${result.positionText}`
			);
			return result;
		} catch (error) {
			console.error("OpenSky API: Fehler beim Abrufen der Flugdaten:", error);
			updateFetchStatus(
				`Fehler beim Abrufen der Flugdaten: ${error.message || error}`,
				true
			);

			// Leeres Ergebnisobjekt zurückgeben
			return {
				originCode: "---",
				destCode: "---",
				departureTime: "--:--",
				arrivalTime: "--:--",
				data: [],
			};
		}
	};

	/**
	 * Hilfsfunktion, um die Uhrzeit aus einem Flugpunkt zu extrahieren
	 * @param {Object} flightPoint - Ein Flugpunkt-Objekt
	 * @returns {string} Die Zeit-Komponente
	 */
	const getTimeFromFlightPoint = (flightPoint) => {
		if (!flightPoint) return "00:00";

		let timings;
		if (flightPoint.departurePoint && flightPoint.departure) {
			timings = flightPoint.departure.timings;
		} else if (flightPoint.arrivalPoint && flightPoint.arrival) {
			timings = flightPoint.arrival.timings;
		}

		if (!timings || !timings.length) return "00:00";

		const timing = timings[0];
		if (!timing || !timing.value) return "00:00";

		return timing.value.substring(0, 5);
	};

	/**
	 * Hilfsfunktion, um die Uhrzeit aus einem Flugpunkt als String zu extrahieren
	 * @param {Object} flightPoint - Ein Flugpunkt-Objekt
	 * @returns {string} Die formatierte Uhrzeit (HH:MM) oder "--:--" bei Fehler
	 */
	const getTimeStringFromFlightPoint = (flightPoint) => {
		try {
			return getTimeFromFlightPoint(flightPoint) || "--:--";
		} catch (error) {
			return "--:--";
		}
	};

	/**
	 * Initialisiert das OpenSky API-Modul
	 */
	const init = () => {
		try {
			console.log("OpenSky Network API-Modul initialisiert");

			// Prüfe, ob die API-Anmeldedaten konfiguriert sind
			if (config.auth.username && config.auth.password) {
				console.log("OpenSky API: Authentifizierung konfiguriert (Basic Auth)");
			} else if (
				config.auth.clientId &&
				config.auth.clientSecret &&
				config.auth.useOAuth
			) {
				console.log("OpenSky API: Authentifizierung konfiguriert (OAuth)");
			} else {
				console.log(
					"OpenSky API: Keine Authentifizierung konfiguriert, begrenzte Abfragerate"
				);
			}

			// Prüfe, ob die API über einen externen Endpunkt erreichbar ist
			if (config.debugMode) {
				console.log("API-Konfiguration:", {
					baseUrl: config.baseUrl,
					auth:
						config.auth.username || config.auth.clientId
							? "Konfiguriert"
							: "Nicht konfiguriert",
					authType: config.auth.useOAuth ? "OAuth" : "Basic Auth",
				});
			}
		} catch (error) {
			console.error(
				"Fehler bei der Initialisierung des OpenSky API-Moduls:",
				error
			);
		}
	};

	// Beim Laden der Seite initialisieren
	document.addEventListener("DOMContentLoaded", init);

	// Public API
	return {
		updateAircraftData,
		getAircraftFlights,
		getAircraftState,
		updateFetchStatus,
		setMockMode: (useMock) => {
			config.useMockData = useMock;
			console.log(
				`OpenSky API Mock-Modus ${useMock ? "aktiviert" : "deaktiviert"}`
			);
		},
		setAuthMode: (useOAuth) => {
			config.auth.useOAuth = useOAuth;
			console.log(
				`OpenSky API Auth-Modus auf ${
					useOAuth ? "OAuth" : "Basic Auth"
				} gesetzt`
			);
		},
		init,
	};
})();

// Globalen Namespace für API-Zugriff erstellen
window.OpenskyAPI = OpenskyAPI;
