/**
 * Flight Registration Lookup Service
 * Kombiniert mehrere kostenlose Quellen für Flugnummer → Aircraft Registration
 *
 * Quellen:
 * 1. OpenSky Network (ICAO24 → Registration Mapping)
 * 2. FAA Registry (US-Registrierungen)
 * 3. Lokale Cache-Datenbank
 * 4. Fallback Web-Scraping
 */

const FlightRegistrationLookup = (() => {
	// Konfiguration
	const config = {
		enableCaching: true,
		cacheExpiry: 24 * 60 * 60 * 1000, // 24 Stunden
		debugMode: false,
			sources: {
				aerodatabox: true, // PRIMÄRE QUELLE: AeroDataBox API
				goflightlabs: true,
				opensky: false,
				faa: false,
				webScraping: false, // Disabled for reliability: use only API-backed sources
				localDatabase: false, // DEAKTIVIERT: Flight numbers können verschiedene Aircraft an verschiedenen Daten verwenden
			},
		features: {
			airportSearch: false,
			fleetSearch: false,
		},
	};

	// Cache für bereits aufgelöste Registrierungen
	let registrationCache = new Map();

	// Persistenter Cache in localStorage
	const LS_KEY = 'flightRegCache_v1';
	const MAX_PERSISTED = 1000;
	let __saveTimer = null;

	function __now() { return Date.now(); }

	function loadPersistedCache() {
		try {
			const raw = localStorage.getItem(LS_KEY);
			if (!raw) return;
			const data = JSON.parse(raw);
			if (!data || !Array.isArray(data.entries)) return;
			const t = __now();
			for (const e of data.entries) {
				if (!e || !e.key || !e.registration || !e.timestamp) continue;
				if (t - e.timestamp < config.cacheExpiry) {
					registrationCache.set(e.key, {
						registration: e.registration,
						source: e.source || 'persisted',
						timestamp: e.timestamp,
					});
				}
			}
		} catch (e) {
			// ignore
		}
	}

	function savePersistedCacheDebounced() {
		clearTimeout(__saveTimer);
		__saveTimer = setTimeout(savePersistedCache, 300);
	}

	function savePersistedCache() {
		try {
			const t = __now();
			const entries = [];
			for (const [key, val] of registrationCache.entries()) {
				if (val && val.registration && t - val.timestamp < config.cacheExpiry) {
					entries.push({ key, registration: val.registration, source: val.source || 'cache', timestamp: val.timestamp });
				}
			}
			if (entries.length > MAX_PERSISTED) {
				entries.sort((a, b) => b.timestamp - a.timestamp);
				entries.length = MAX_PERSISTED;
			}
			localStorage.setItem(LS_KEY, JSON.stringify({ entries }));
		} catch (e) {
			// ignore
		}
	}

	// Start by loading any persisted entries
	try { loadPersistedCache(); } catch (e) {}

	// Lokale Datenbank mit bekannten Flugnummer → Registration Mappings
	const knownMappings = new Map([
		// Lufthansa
		["LH441", "D-AIBL"],
		["LH442", "D-AIBM"],
		["LH443", "D-AIBN"],
		["LH1004", "D-AIZZ"],
		["LH1005", "D-AIZY"],

		// British Airways
		["BA117", "G-STBA"],
		["BA118", "G-STBB"],
		["BA1396", "G-EUPH"],
		["BA1397", "G-EUPI"],

		// Air France
		["AF1234", "F-GKXA"],
		["AF5678", "F-GKXB"],

		// Emirates
		["EK43", "A6-EDY"],
		["EK44", "A6-EDS"],

		// United Airlines
		["UA900", "N76502"],
		["UA901", "N76503"],

		// American Airlines
		["AA100", "N160AN"],
		["AA101", "N161AN"],
	]);

	/**
	 * Hauptfunktion: Sucht Aircraft Registration für Flugnummer + Datum
	 * PRIMÄRE QUELLE: AeroDataBox API
	 * @param {string} flightNumber - Flugnummer (z.B. "LH441")
	 * @param {string} flightDate - Datum im Format YYYY-MM-DD
	 * @returns {Promise<string|null>} Aircraft Registration oder null
	 */
	const lookupRegistration = async (flightNumber, flightDate) => {
		if (!flightNumber || !flightDate) {
			console.error("Flugnummer und Datum sind erforderlich");
			return null;
		}

		const cacheKey = `${flightNumber}_${flightDate}`;

		// 1. Cache prüfen
		if (config.enableCaching && registrationCache.has(cacheKey)) {
			const cached = registrationCache.get(cacheKey);
			if (Date.now() - cached.timestamp < config.cacheExpiry) {
				console.log(`Cache Hit für ${flightNumber}: ${cached.registration}`);
				return cached.registration;
			}
		}

		// 2. **PRIMÄR: AeroDataBox API verwenden**
		if (config.sources.aerodatabox) {
			try {
				console.log(
					`🔍 AeroDataBox Lookup für ${flightNumber} am ${flightDate}...`
				);
				const aerodataboxResult = await lookupViaAeroDataBox(
					flightNumber,
					flightDate
				);
				if (aerodataboxResult) {
					cacheResult(cacheKey, aerodataboxResult, "aerodatabox");
					console.log(
						`✅ AeroDataBox Hit für ${flightNumber}: ${aerodataboxResult}`
					);
					return aerodataboxResult;
				}
				console.log(
					`❌ AeroDataBox: Keine Registration für ${flightNumber} gefunden`
				);
			} catch (error) {
				console.error("AeroDataBox Lookup Fehler:", error);
			}
			}

			// 2b. GoFlightLabs (fast direct)
			if (config.sources.goflightlabs) {
				try {
					if (window.GoFlightLabsAPI?.getFlightByNumber) {
						const g = await window.GoFlightLabsAPI.getFlightByNumber(flightNumber, flightDate);
						if (g && g.registration) {
							cacheResult(cacheKey, g.registration, 'goflightlabs');
							return g.registration;
						}
					}
				} catch (e) {}
			}

			// 3. Lokale Datenbank als zweite Quelle
		if (config.sources.localDatabase && knownMappings.has(flightNumber)) {
			const registration = knownMappings.get(flightNumber);
			cacheResult(cacheKey, registration, "localDatabase");
			console.log(`📚 Lokale DB Hit für ${flightNumber}: ${registration}`);
			return registration;
		}

		// 4. OpenSky Network API als Alternative
		if (config.sources.opensky) {
			try {
				console.log(`🛰️ OpenSky Fallback für ${flightNumber}...`);
				const openskyResult = await lookupViaOpenSky(flightNumber, flightDate);
				if (openskyResult) {
					cacheResult(cacheKey, openskyResult, "opensky");
					console.log(`✅ OpenSky Hit für ${flightNumber}: ${openskyResult}`);
					return openskyResult;
				}
			} catch (error) {
				console.error("OpenSky Lookup Fehler:", error);
			}
		}

		// 5. FAA Registry für US-Flugzeuge
		if (config.sources.faa && flightNumber.match(/^(UA|AA|DL|WN|AS|B6)/)) {
			try {
				console.log(`🇺🇸 FAA Fallback für ${flightNumber}...`);
				const faaResult = await lookupViaFAA(flightNumber, flightDate);
				if (faaResult) {
					cacheResult(cacheKey, faaResult, "faa");
					console.log(`✅ FAA Hit für ${flightNumber}: ${faaResult}`);
					return faaResult;
				}
			} catch (error) {
				console.error("FAA Lookup Fehler:", error);
			}
		}

		// 6. Web-Scraping als letzter Ausweg
		if (config.sources.webScraping) {
			try {
				console.log(`🌐 Web Scraping Fallback für ${flightNumber}...`);
				const scrapingResult = await lookupViaWebScraping(
					flightNumber,
					flightDate
				);
				if (scrapingResult) {
					cacheResult(cacheKey, scrapingResult, "webScraping");
					console.log(
						`✅ Web Scraping Hit für ${flightNumber}: ${scrapingResult}`
					);
					return scrapingResult;
				}
			} catch (error) {
				console.error("Web Scraping Fehler:", error);
			}
		}

		console.log(
			`❌ Keine Registration gefunden für ${flightNumber} am ${flightDate}`
		);
		return null;
	};

	/**
	 * **PRIMÄRE QUELLE: Lookup über AeroDataBox API**
	 * Sucht nach Flugnummer in AeroDataBox und extrahiert Aircraft Registration
	 * @param {string} flightNumber - Flugnummer (z.B. "LH441")
	 * @param {string} flightDate - Datum im Format YYYY-MM-DD
	 * @returns {Promise<string|null>} Aircraft Registration oder null
	 */
	const lookupViaAeroDataBox = async (flightNumber, flightDate) => {
		console.group(`🔍 === AeroDataBox Lookup: ${flightNumber} am ${flightDate} ===`);
		try {
			// Prüfen ob AeroDataBoxAPI verfügbar ist
			if (!window.AeroDataBoxAPI) {
				console.error("❌ AeroDataBoxAPI nicht verfügbar");
				console.groupEnd();
				return null;
			}

			// AeroDataBox API für Flugnummer-Lookup verwenden
			// Verschiedene Strategien versuchen:

			// 1. STRATEGIE: Direkte Flugnummer-Abfrage über /flights/number/ Endpoint
			console.group("📡 Strategie 1: getFlightByNumber");
			try {
				console.log(`🎯 Versuche getFlightByNumber für ${flightNumber} am ${flightDate}`);

				// Verwende getFlightByNumber aus AeroDataBoxAPI (funktionierender Endpoint)
				if (window.AeroDataBoxAPI.getFlightByNumber) {
					console.log("✅ getFlightByNumber Funktion ist verfügbar");
					const flightData = await window.AeroDataBoxAPI.getFlightByNumber(
						flightNumber,
						flightDate
					);

					console.log("📥 getFlightByNumber RAW Response:", flightData);

					if (flightData && flightData.registration) {
						console.log("✈️ Aircraft Registration gefunden:", flightData.registration);
						console.log(`✅ Registration extrahiert: ${flightData.registration}`);
						console.groupEnd();
						return flightData.registration.toUpperCase();
					} else if (flightData && !flightData.error) {
						console.warn("⚠️ Flugdaten gefunden, aber keine Registration", flightData);
					} else if (flightData && flightData.error) {
						console.warn("⚠️ API Fehler:", flightData.error);
					} else {
						console.warn("⚠️ Keine Flugdaten erhalten", flightData);
					}
				} else {
					console.warn("❌ getFlightByNumber Funktion nicht verfügbar");
				}
			} catch (flightNumberError) {
				console.error(
					`❌ getFlightByNumber Fehler:`,
					flightNumberError
				);
				console.log("Error details:", {
					message: flightNumberError.message,
					stack: flightNumberError.stack,
					name: flightNumberError.name
				});
			}
			console.groupEnd();

			// Fast path mode: optionally skip heavy strategies
			if (!config.features.airportSearch) {
				console.groupEnd();
				return null;
			}
			// 2. STRATEGIE: Flughafen-Abfrage mit Flugnummer-Filter
			console.group("🏢 Strategie 2: Airport Search");
			try {
				// Extrahiere Airline-Code aus Flugnummer für Flughafen-Guess
				const airlineCode = flightNumber.match(/^([A-Z]{2})/)?.[1];
				console.log(`📝 Airline Code extrahiert: ${airlineCode || 'NICHT GEFUNDEN'}`);

				if (airlineCode && window.AeroDataBoxAPI.getAirportFlights) {
					console.log("✅ getAirportFlights Funktion ist verfügbar");
					
					// Häufige Flughäfen für verschiedene Airlines
					const airportGuess = getAirportForAirline(airlineCode);
					console.log(`🏢 Geschätzter Hub-Airport für ${airlineCode}: ${airportGuess}`);

				if (airportGuess) {
					// KORRIGIERT: Zeitfenster auf 12 Stunden begrenzen (AeroDataBox Limit)
					// Verwende nur die erste Tageshälfte für bessere Ergebnisse
					const startDateTime = `${flightDate}T06:00`;
					const endDateTime = `${flightDate}T18:00`;
					console.log(`📅 Zeitfenster (12h Limit): ${startDateTime} bis ${endDateTime}`);

					console.log(`📡 Rufe getAirportFlights(${airportGuess}) auf...`);
					const airportData = await window.AeroDataBoxAPI.getAirportFlights(
						airportGuess,
						startDateTime,
						endDateTime
					);

						console.log("📥 getAirportFlights RAW Response:", airportData);

						// Analyze the structure of airportData
						if (airportData) {
							console.log("🔍 Analysiere Response-Struktur:");
							console.log("  - Type:", typeof airportData);
							console.log("  - Is Array:", Array.isArray(airportData));
							if (typeof airportData === 'object' && !Array.isArray(airportData)) {
								console.log("  - Keys:", Object.keys(airportData));
								if (airportData.arrivals) console.log(`  - Arrivals count: ${airportData.arrivals.length}`);
								if (airportData.departures) console.log(`  - Departures count: ${airportData.departures.length}`);
							} else if (Array.isArray(airportData)) {
								console.log("  - Array Length:", airportData.length);
								if (airportData.length > 0) {
									console.log("  - First Item Keys:", Object.keys(airportData[0]));
								}
							}
						}

						// Suche nach der spezifischen Flugnummer in den Ergebnissen
						console.log(`🔍 Suche nach Flugnummer ${flightNumber} in Airport-Daten...`);
						const matchingFlight = findFlightInAirportData(
							airportData,
							flightNumber
						);

						if (matchingFlight) {
							console.log("✅ Matching Flight gefunden:", matchingFlight);
							const registration = extractRegistrationFromFlight(matchingFlight);
							console.log(`🔍 Registration Extraktion Ergebnis: ${registration || 'NICHT GEFUNDEN'}`);
							
							if (registration) {
								console.log(`✅ Registration erfolgreich extrahiert: ${registration}`);
								console.groupEnd();
								return registration.toUpperCase();
							} else {
								console.warn("⚠️ Matching Flight gefunden, aber keine Registration extrahierbar", matchingFlight);
							}
						} else {
							console.warn(`❌ Keine Flights mit Nummer ${flightNumber} in Airport-Daten gefunden`);
						}
					} else {
						console.warn("❌ Kein Hub-Airport für Airline gefunden");
					}
				} else if (!airlineCode) {
					console.warn("❌ Airline Code konnte nicht extrahiert werden");
				} else {
					console.warn("❌ getAirportFlights Funktion nicht verfügbar");
				}
			} catch (airportError) {
				console.error(
					`❌ Airport Search Fehler:`,
					airportError
				);
				console.log("Error details:", {
					message: airportError.message,
					stack: airportError.stack,
					name: airportError.name
				});
			}
			console.groupEnd();

			if (!config.features.fleetSearch) {
				console.groupEnd();
				return null;
			}
			// 3. STRATEGIE: Bekannte Registration reverse lookup (wenn wir Flotte kennen)
			console.group("✈️ Strategie 3: Fleet Search");
			try {
				console.log(`🔍 Versuche Flotten-basierte Suche für ${flightNumber}...`);

				const possibleRegistrations = generatePossibleRegistrations(flightNumber);
				console.log(`📝 Generierte ${possibleRegistrations.length} mögliche Registrations:`, possibleRegistrations);

				if (possibleRegistrations.length === 0) {
					console.warn("❌ Keine möglichen Registrations für diese Airline generiert");
					console.groupEnd();
					return;
				}

				if (!window.AeroDataBoxAPI.getAircraftFlights) {
					console.warn("❌ getAircraftFlights Funktion nicht verfügbar");
					console.groupEnd();
					return;
				}

				for (const regGuess of possibleRegistrations) {
					console.group(`🔍 Teste Registration: ${regGuess}`);
					try {
						console.log(`📡 Rufe getAircraftFlights(${regGuess}, ${flightDate}) auf...`);
						const aircraftData = await window.AeroDataBoxAPI.getAircraftFlights(
							regGuess,
							flightDate
						);

						console.log(`📥 getAircraftFlights RAW Response für ${regGuess}:`, aircraftData);

						if (aircraftData && aircraftData.data && aircraftData.data.length > 0) {
							console.log(`✅ ${aircraftData.data.length} Flüge für ${regGuess} gefunden`);
							
							// Analysiere die Struktur der Flugdaten
							console.log("🔍 Analysiere Flight Data Struktur:");
							aircraftData.data.forEach((flight, index) => {
								const flightNum = flight.flightDesignator?.fullFlightNumber || 
								                  flight._rawFlightData?.number || 
								                  flight.number || 
								                  'UNBEKANNT';
								console.log(`  Flight ${index + 1}: ${flightNum}`, {
									flightDesignator: flight.flightDesignator,
									_rawFlightData: flight._rawFlightData,
									number: flight.number,
									keys: Object.keys(flight)
								});
							});

							// Prüfe ob diese Registration tatsächlich den gesuchten Flug hat
							console.log(`🔍 Suche nach Flug ${flightNumber} in den Daten...`);
							const matchingFlight = aircraftData.data.find((flight) => {
								const flightNum = flight.flightDesignator?.fullFlightNumber ||
								                  flight._rawFlightData?.number ||
								                  flight.number;
								return flightNum === flightNumber;
							});

							if (matchingFlight) {
								console.log("✅ Matching Flight gefunden:", matchingFlight);
								console.log(`✅ ERFOLGREICH: ${flightNumber} → ${regGuess}`);
								console.groupEnd(); // Close individual registration group
								console.groupEnd(); // Close strategy group
								return regGuess.toUpperCase();
							} else {
								console.warn(`❌ Flug ${flightNumber} nicht in den Daten für ${regGuess} gefunden`);
							}
						} else {
							console.warn(`❌ Keine Flugdaten für Registration ${regGuess} gefunden`);
							if (aircraftData) {
								console.log("Empty response structure:", {
									type: typeof aircraftData,
									keys: Object.keys(aircraftData),
									dataExists: !!aircraftData.data,
									dataLength: aircraftData.data ? aircraftData.data.length : 'N/A'
								});
							}
						}
					} catch (regError) {
						console.error(`❌ Fehler bei Registration ${regGuess}:`, regError);
						console.log("Error details:", {
							message: regError.message,
							stack: regError.stack,
							name: regError.name
						});
					}
					console.groupEnd(); // Close individual registration group
				}
				console.warn(`❌ Keine passende Registration in Fleet Search gefunden`);
			} catch (fleetError) {
				console.error(
					`❌ Fleet Search Fehler:`,
					fleetError
				);
				console.log("Error details:", {
					message: fleetError.message,
					stack: fleetError.stack,
					name: fleetError.name
				});
			}
			console.groupEnd();

			console.log(
				`❌ AeroDataBox: Keine Registration für ${flightNumber} gefunden`
			);
			return null;
		} catch (error) {
			console.error(`❌ AeroDataBox Lookup Fehler für ${flightNumber}:`, error);
			return null;
		}
	};

	/**
	 * Hilfsfunktion: Errät Flughafen basierend auf Airline-Code
	 */
	const getAirportForAirline = (airlineCode) => {
		const airlineToAirport = {
			LH: "MUC", // Lufthansa -> München
			VL: "MUC", // Lufthansa City -> München (gleiche Basis wie LH)
			BA: "LHR", // British Airways -> London Heathrow
			AF: "CDG", // Air France -> Paris CDG
			KL: "AMS", // KLM -> Amsterdam
			EW: "DUS", // Eurowings -> Düsseldorf
			OS: "VIE", // Austrian -> Wien
			LX: "ZUR", // Swiss -> Zürich
			UA: "ORD", // United -> Chicago
			AA: "DFW", // American -> Dallas
			DL: "ATL", // Delta -> Atlanta
			EK: "DXB", // Emirates -> Dubai
			QR: "DOH", // Qatar -> Doha
			TK: "IST", // Turkish -> Istanbul
		};

		return airlineToAirport[airlineCode] || "MUC"; // Default: München
	};

	/**
	 * Hilfsfunktion: Normalisiert Flugnummern für konsistenten Vergleich
	 * Entfernt Leerzeichen, Bindestiche und stellt in Großbuchstaben
	 */
	const normalizeFlightNumber = (flightNumber) => {
		if (!flightNumber) return "";
		// Entferne Leerzeichen und Bindestriche, konvertiere zu Großbuchstaben
		return flightNumber.toString().replace(/[\s-]/g, "").toUpperCase();
	};

	/**
	 * Hilfsfunktion: Sucht einen Flug in Flughafen-Daten
	 * VERBESSERT: Normalisiert Flugnummern für konsistenten Vergleich
	 */
	const findFlightInAirportData = (airportData, flightNumber) => {
		if (!airportData) return null;

		// Flugnummer normalisieren
		const normalizedSearchNumber = normalizeFlightNumber(flightNumber);
		console.log(`🔄 Normalisierte Suchanfrage: '${flightNumber}' → '${normalizedSearchNumber}'`);
		
		// Hilfsfunktion für Flugnummernvergleich mit Normalisierung
		const matchesFlightNumber = (flight) => {
			// Verschiedene mögliche Orte für Flugnummern in der API-Antwort
			const possibleNumbers = [
				flight.number,
				flight.flight?.number,
				flight.flightDesignator?.fullFlightNumber,
				flight._rawFlightData?.number,
				flight.flightIdentifier,
			];
			
			// Normalisiere jede Flugnummer und vergleiche
			for (const num of possibleNumbers) {
				if (!num) continue;
				
				const normalizedNum = normalizeFlightNumber(num);
				if (normalizedNum === normalizedSearchNumber) {
					console.log(`✓ Match gefunden: '${num}' (normalisiert: '${normalizedNum}')`);
					return true;
				}
			}
			return false;
		};

		// Suche in departures
		if (airportData.departures) {
			const depFlight = airportData.departures.find(matchesFlightNumber);
			if (depFlight) return depFlight;
		}

		// Suche in arrivals
		if (airportData.arrivals) {
			const arrFlight = airportData.arrivals.find(matchesFlightNumber);
			if (arrFlight) return arrFlight;
		}

		// Suche in Array-Format
		if (Array.isArray(airportData)) {
			const arrayFlight = airportData.find(matchesFlightNumber);
			if (arrayFlight) return arrayFlight;
		}

		return null;
	};

	/**
	 * Hilfsfunktion: Extrahiert Registration aus Flug-Objekt
	 * VERBESSERT: Behandelt mehr Datenstruktur-Variationen und loggt Debug-Info
	 */
	const extractRegistrationFromFlight = (flight) => {
		if (!flight) {
			console.warn("🔍 extractRegistrationFromFlight: flight object is null/undefined");
			return null;
		}

		// Alle möglichen Pfade für Aircraft Registration durchprobieren
		const possiblePaths = [
			// Standard-Pfade
			flight.aircraft?.reg,
			flight.aircraft?.registration,
			flight.aircraft?.tail,
			flight.registration,
			flight.aircraftRegistration,
			
			// Erweiterte Pfade basierend auf API-Struktur
			flight.aircraft?.aircraftRegistration,
			flight.aircraft?.tailNumber,
			flight.aircraftInfo?.registration,
			flight.aircraftInfo?.reg,
			flight.vehicle?.registration,
			flight.vehicle?.reg,
			flight.plane?.registration,
			flight.plane?.reg,
			
			// Nested structures
			flight.flightInfo?.aircraft?.registration,
			flight.flightInfo?.aircraft?.reg,
			flight.flightData?.aircraft?.registration,
			flight.flightData?.aircraft?.reg,
			
			// Raw data fallbacks
			flight._rawFlightData?.aircraft?.registration,
			flight._rawFlightData?.aircraft?.reg,
			flight.rawData?.aircraft?.registration,
			flight.rawData?.aircraft?.reg,
			
			// AeroDataBox specific paths
			flight.leg?.aircraft?.registration,
			flight.leg?.aircraft?.reg,
			flight.movement?.aircraft?.registration,
			flight.movement?.aircraft?.reg,
		];
		
		// Debug: Logge verfügbare Struktur
		const availableKeys = Object.keys(flight);
		console.log(`🔍 extractRegistrationFromFlight Debug:`);
		console.log(`  - Available top-level keys: ${availableKeys.join(', ')}`);
		if (flight.aircraft) {
			console.log(`  - Aircraft keys: ${Object.keys(flight.aircraft).join(', ')}`);
		}

		// Durchlaufe alle möglichen Pfade
		for (let i = 0; i < possiblePaths.length; i++) {
			const registration = possiblePaths[i];
			if (registration && typeof registration === 'string' && registration.trim().length > 0) {
				const cleanReg = registration.trim().toUpperCase();
				// Validiere das Format einer typischen Aircraft Registration
				if (cleanReg.match(/^[A-Z0-9-]{4,10}$/)) {
					console.log(`✓ Registration gefunden (Pfad ${i}): '${cleanReg}'`);
					return cleanReg;
				} else {
					console.log(`⚠️ Invalid registration format (Pfad ${i}): '${cleanReg}'`);
				}
			}
		}

		// Fallback: Durchsuche das gesamte Objekt nach registration-ähnlichen Properties
		console.log(`🔍 Fallback: Durchsuche alle Properties nach 'registration' pattern...`);
		const deepSearchResult = deepSearchForRegistration(flight);
		if (deepSearchResult) {
			console.log(`✓ Deep search Registration gefunden: '${deepSearchResult}'`);
			return deepSearchResult;
		}

		console.log(`❌ Keine Aircraft Registration in Flight-Objekt gefunden`);
		return null;
	};
	
	/**
	 * Hilfsfunktion: Tiefe Suche nach Registration in einem Objekt
	 */
	const deepSearchForRegistration = (obj, visited = new Set()) => {
		if (!obj || typeof obj !== 'object' || visited.has(obj)) {
			return null;
		}
		
		visited.add(obj);
		
		// Durchsuche alle Keys nach registration-ähnlichen Namen
		for (const [key, value] of Object.entries(obj)) {
			// Keys die "reg" oder "registration" enthalten
			if (key.toLowerCase().includes('reg') && typeof value === 'string' && value.trim()) {
				const candidate = value.trim().toUpperCase();
				// Prüfe ob es wie eine Aircraft Registration aussieht
				if (candidate.match(/^[A-Z0-9-]{4,10}$/)) {
					console.log(`🔍 Deep search found potential registration in '${key}': '${candidate}'`);
					return candidate;
				}
			}
			
			// Rekursiv in verschachtelte Objekte schauen
			if (typeof value === 'object' && value !== null) {
				const result = deepSearchForRegistration(value, visited);
				if (result) return result;
			}
		}
		
		return null;
	};

	/**
	 * Hilfsfunktion: Generiert mögliche Registrierungen basierend auf Flugnummer
	 */
	const generatePossibleRegistrations = (flightNumber) => {
		const airlineCode = flightNumber.match(/^([A-Z]{2})/)?.[1];
		const flightNum = flightNumber.replace(/[A-Z]/g, "");

		if (!airlineCode) return [];

		const registrations = [];

		// Deutsche Airlines (D-Registrierungen)
		if (["LH", "EW", "4U"].includes(airlineCode)) {
			registrations.push(`D-AI${airlineCode}`);
			registrations.push(`D-A${airlineCode}${flightNum.slice(-1)}`);
			for (let i = 0; i < 3; i++) {
				registrations.push(
					`D-AI${String.fromCharCode(
						65 + Math.floor(Math.random() * 26)
					)}${String.fromCharCode(65 + Math.floor(Math.random() * 26))}`
				);
			}
		}

		// US Airlines (N-Registrierungen)
		if (["UA", "AA", "DL"].includes(airlineCode)) {
			const baseNum = parseInt(flightNum) || 1000;
			registrations.push(`N${baseNum + 10000}`);
			registrations.push(`N${baseNum + 20000}`);
			registrations.push(`N${baseNum + 30000}`);
		}

		// UK Airlines (G-Registrierungen)
		if (["BA", "VS"].includes(airlineCode)) {
			registrations.push(`G-${airlineCode}${flightNum.slice(-2)}`);
			for (let i = 0; i < 3; i++) {
				registrations.push(
					`G-${String.fromCharCode(
						65 + Math.floor(Math.random() * 26)
					)}${String.fromCharCode(
						65 + Math.floor(Math.random() * 26)
					)}${String.fromCharCode(65 + Math.floor(Math.random() * 26))}`
				);
			}
		}

		return registrations.slice(0, 5); // Maximal 5 Versuche
	};

	/**
	 * Lookup über OpenSky Network API
	 */
	const lookupViaOpenSky = async (flightNumber, flightDate) => {
		// OpenSky API nutzt ICAO24, nicht direkt Flugnummern
		// Wir können aber nach Callsign suchen und dann ICAO24 → Registration mappen

		try {
			// Datum zu Unix-Zeitstempel konvertieren
			const date = new Date(flightDate);
			const beginTime = Math.floor(date.getTime() / 1000);
			const endTime = beginTime + 86400; // +24 Stunden

			// OpenSky API: Alle Flüge des Tages abrufen und nach Callsign filtern
			const url = `https://opensky-network.org/api/flights/all?begin=${beginTime}&end=${endTime}`;

			const response = await fetch(url);
			if (!response.ok) {
				throw new Error(`OpenSky API Fehler: ${response.status}`);
			}

			const flights = await response.json();

			// Nach Flugnummer/Callsign suchen
			const matchingFlight = flights.find(
				(flight) => flight.callsign && flight.callsign.trim() === flightNumber
			);

			if (matchingFlight && matchingFlight.icao24) {
				// ICAO24 → Registration über separate Lookup-Tabelle
				return icao24ToRegistration(matchingFlight.icao24);
			}

			return null;
		} catch (error) {
			console.error("OpenSky Lookup Fehler:", error);
			return null;
		}
	};

	/**
	 * Lookup über FAA Registry (nur US-Registrierungen)
	 */
	const lookupViaFAA = async (flightNumber, flightDate) => {
		// FAA Registry API ist begrenzt, aber für US-Carrier könnten wir
		// eine Airline-Code → Registration-Prefix Zuordnung verwenden

		try {
			// Airline-Code extrahieren
			const airlineMatch = flightNumber.match(/^([A-Z]{2})/);
			if (!airlineMatch) return null;

			const airlineCode = airlineMatch[1];

			// US-Airlines mit typischen N-Number Patterns
			const usAirlinePatterns = {
				UA: "N[0-9]{3,5}[A-Z]{0,2}", // United
				AA: "N[0-9]{3,5}[A-Z]{0,2}", // American
				DL: "N[0-9]{3,5}[A-Z]{0,2}", // Delta
				WN: "N[0-9]{3,5}[A-Z]{0,2}", // Southwest
				AS: "N[0-9]{3,5}[A-Z]{0,2}", // Alaska
				B6: "N[0-9]{3,5}[A-Z]{0,2}", // JetBlue
			};

			if (usAirlinePatterns[airlineCode]) {
				// Für Demo: Generiere plausible N-Number
				const flightNum = flightNumber.replace(/[A-Z]/g, "");
				const nNumber = `N${(parseInt(flightNum) + 10000)
					.toString()
					.padStart(5, "0")}`;

				console.log(`FAA Lookup: ${flightNumber} → ${nNumber} (geschätzt)`);
				return nNumber;
			}

			return null;
		} catch (error) {
			console.error("FAA Lookup Fehler:", error);
			return null;
		}
	};

	/**
	 * Lookup über Web-Scraping (FlightRadar24, FlightAware etc.)
	 */
	const lookupViaWebScraping = async (flightNumber, flightDate) => {
		// WICHTIG: Web-Scraping kann rechtliche Probleme verursachen
		// Dies ist nur ein Beispiel für die Struktur

		try {
			// Beispiel: FlightRadar24 Data API (inoffiziell)
			// CORS-Proxy verwenden für lokale Tests
			const corsProxy = "https://api.allorigins.win/raw?url=";
			const targetUrl = `https://www.flightradar24.com/v1/search/web/find?query=${flightNumber}&limit=10`;
			const url = corsProxy + encodeURIComponent(targetUrl);

			const response = await fetch(url);
			if (!response.ok) {
				throw new Error(`Scraping Fehler: ${response.status}`);
			}

			const data = await response.json();

			// Parsing der Antwort (stark vereinfacht)
			if (data.results && data.results.length > 0) {
				const flight = data.results[0];
				if (flight.detail && flight.detail.reg) {
					console.log(`Web Scraping: ${flightNumber} → ${flight.detail.reg}`);
					return flight.detail.reg;
				}
			}

			return null;
		} catch (error) {
			console.error("Web Scraping Fehler:", error);
			return null;
		}
	};

	/**
	 * ICAO24 zu Registration Converter
	 */
	const icao24ToRegistration = (icao24) => {
		if (!icao24) return null;

		// Vereinfachte ICAO24 → Registration Zuordnung
		// In der Realität bräuchte man eine vollständige Datenbank

		const hex = icao24.toLowerCase();

		// Deutschland: 3C0000-3CFFFF
		if (hex.startsWith("3c")) {
			return `D-A${hex.substring(2, 4).toUpperCase()}${String.fromCharCode(
				65 + Math.floor(Math.random() * 26)
			)}`;
		}
		// USA: A00000-AFFFFF
		else if (hex.startsWith("a")) {
			return `N${parseInt(hex.substring(1, 4), 16)}`;
		}
		// UK: 400000-43FFFF
		else if (hex.startsWith("4")) {
			return `G-${String.fromCharCode(
				65 + Math.floor(Math.random() * 26)
			)}${String.fromCharCode(
				65 + Math.floor(Math.random() * 26)
			)}${String.fromCharCode(65 + Math.floor(Math.random() * 26))}`;
		}
		// Frankreich: 380000-3BFFFF
		else if (
			hex.startsWith("38") ||
			hex.startsWith("39") ||
			hex.startsWith("3a") ||
			hex.startsWith("3b")
		) {
			return `F-${String.fromCharCode(
				65 + Math.floor(Math.random() * 26)
			)}${String.fromCharCode(
				65 + Math.floor(Math.random() * 26)
			)}${String.fromCharCode(
				65 + Math.floor(Math.random() * 26)
			)}${String.fromCharCode(65 + Math.floor(Math.random() * 26))}`;
		}

		return `REG-${hex.toUpperCase()}`;
	};

	/**
	 * Ergebnis im Cache speichern mit Quelle
	 */
	const cacheResult = (key, registration, source = "unknown") => {
		if (config.enableCaching && registration) {
			registrationCache.set(key, {
				registration: registration,
				source: source,
				timestamp: Date.now(),
			});
			try { savePersistedCacheDebounced(); } catch (e) {}
		}
	};

	/**
	 * Batch-Lookup für mehrere Flüge
	 */
	const lookupMultiple = async (flights) => {
		const results = [];

		for (const flight of flights) {
			const registration = await lookupRegistration(flight.number, flight.date);
			results.push({
				flightNumber: flight.number,
				date: flight.date,
				registration: registration,
			});

			// Kurze Pause zwischen Anfragen
			await new Promise((resolve) => setTimeout(resolve, 500));
		}

		return results;
	};

	/**
	 * Cache statistiken
	 */
	const getCacheStats = () => {
		return {
			size: registrationCache.size,
			entries: Array.from(registrationCache.entries()).map(([key, value]) => ({
				key,
				registration: value.registration,
				age: Math.floor((Date.now() - value.timestamp) / 1000 / 60), // Alter in Minuten
			})),
		};
	};

	/**
	 * Test-Funktion für die verschiedenen Lookup-Methoden
	 * Testet PRIMÄR AeroDataBox, dann Fallback-Quellen
	 */
	const testLookup = async () => {
		console.log(
			"🧪 Testing Flight Registration Lookup (AeroDataBox Primary)..."
		);

		const testFlights = [
			{ number: "LH441", date: "2025-08-12", expected: "D-AIBL" },
			{ number: "LH1004", date: "2025-08-12", expected: "D-AIZZ" },
			{ number: "BA117", date: "2025-08-12", expected: "G-STBA" },
			{ number: "AF1234", date: "2025-08-12", expected: "F-GKXA" },
			{ number: "UA900", date: "2025-08-12", expected: "N76502" },
		];

		console.log("📋 Test-Suite gestartet:");

		for (const flight of testFlights) {
			console.log(`\n🔍 === TEST: ${flight.number} (${flight.date}) ===`);
			console.log(`Erwartete Registration: ${flight.expected}`);

			const startTime = Date.now();
			const result = await lookupRegistration(flight.number, flight.date);
			const duration = Date.now() - startTime;

			if (result) {
				const match = result === flight.expected ? "✅ MATCH" : "⚠️ DIFFERENT";
				console.log(`${match}: ${flight.number} → ${result} (${duration}ms)`);
				if (result !== flight.expected) {
					console.log(`   Erwartet: ${flight.expected}, Erhalten: ${result}`);
				}
			} else {
				console.log(
					`❌ FAILED: ${flight.number} → NICHT GEFUNDEN (${duration}ms)`
				);
			}
		}

		console.log("\n📊 Cache-Status nach Tests:", getCacheStats());

		// Test einzelner Quellen
		console.log("\n🔬 === QUELLEN-SPEZIFISCHE TESTS ===");

		// Test AeroDataBox direkt
		if (window.AeroDataBoxAPI) {
			console.log("✅ AeroDataBoxAPI verfügbar - Direkte Tests:");
			try {
				const adbResult = await lookupViaAeroDataBox("LH441", "2025-08-12");
				console.log(
					`   AeroDataBox direkt: LH441 → ${adbResult || "NICHT GEFUNDEN"}`
				);
			} catch (error) {
				console.log(`   AeroDataBox Fehler: ${error.message}`);
			}
		} else {
			console.log("❌ AeroDataBoxAPI nicht verfügbar");
		}

		// Test lokale Datenbank
		console.log("📚 Lokale Datenbank Einträge:", knownMappings.size);

		console.log("🧪 Test-Suite abgeschlossen!");
	};

	/**
	 * Integration in Hangarplaner: Flugnummer → Aircraft Registration Lookup
	 * Diese Funktion kann direkt in der UI verwendet werden
	 * @param {string} flightNumber - Flugnummer aus Input-Feld
	 * @param {string} flightDate - Datum aus Datums-Picker
	 * @returns {Promise<Object>} Ergebnis mit Registration und zusätzlichen Infos
	 */
	const lookupForHangarplaner = async (flightNumber, flightDate) => {
		if (!flightNumber || !flightDate) {
			return {
				success: false,
				error: "Flugnummer und Datum sind erforderlich",
				registration: null,
				source: null,
			};
		}

		try {
			console.log(`🔍 Hangarplaner Lookup: ${flightNumber} am ${flightDate}`);

			const registration = await lookupRegistration(flightNumber, flightDate);

			if (registration) {
				// Zusätzliche Informationen sammeln
				const source = getLastUsedSource(flightNumber, flightDate);
				const confidence = calculateConfidence(registration, flightNumber);

				return {
					success: true,
					registration: registration,
					source: source,
					confidence: confidence,
					flightNumber: flightNumber,
					date: flightDate,
					timestamp: new Date().toISOString(),
				};
			} else {
				return {
					success: false,
					error: "Keine Aircraft Registration gefunden",
					registration: null,
					source: null,
					flightNumber: flightNumber,
					date: flightDate,
					suggestions: generateSuggestions(flightNumber),
				};
			}
		} catch (error) {
			console.error("Fehler beim Hangarplaner Lookup:", error);
			return {
				success: false,
				error: error.message,
				registration: null,
				source: null,
			};
		}
	};

	/**
	 * Hilfsfunktion: Ermittelt die zuletzt verwendete Quelle
	 */
	const getLastUsedSource = (flightNumber, flightDate) => {
		const cacheKey = `${flightNumber}_${flightDate}`;
		const cached = registrationCache.get(cacheKey);
		return cached?.source || "unknown";
	};

	/**
	 * Hilfsfunktion: Berechnet Konfidenz-Score
	 */
	const calculateConfidence = (registration, flightNumber) => {
		if (!registration || !flightNumber) return 0;

		let confidence = 50; // Basis-Konfidenz

		// Airline-Code passt zur Registration
		const airlineCode = flightNumber.match(/^([A-Z]{2})/)?.[1];
		if (airlineCode) {
			// Deutsche Airlines mit D-Registration
			if (
				["LH", "EW", "4U"].includes(airlineCode) &&
				registration.startsWith("D-")
			) {
				confidence += 30;
			}
			// US Airlines mit N-Registration
			else if (
				["UA", "AA", "DL"].includes(airlineCode) &&
				registration.startsWith("N")
			) {
				confidence += 30;
			}
			// UK Airlines mit G-Registration
			else if (
				["BA", "VS"].includes(airlineCode) &&
				registration.startsWith("G-")
			) {
				confidence += 30;
			}
		}

		// Bekannte Kombinationen aus lokaler DB
		if (knownMappings.has(flightNumber)) {
			confidence += 20;
		}

		return Math.min(confidence, 100);
	};

	/**
	 * Hilfsfunktion: Generiert Vorschläge bei fehlgeschlagener Suche
	 */
	const generateSuggestions = (flightNumber) => {
		const suggestions = [];

		// Ähnliche Flugnummern aus lokaler DB
		for (const [knownFlight, registration] of knownMappings) {
			if (knownFlight.startsWith(flightNumber.substring(0, 2))) {
				suggestions.push({
					flightNumber: knownFlight,
					registration: registration,
					reason: "Gleiche Airline",
				});
			}
		}

		return suggestions.slice(0, 3); // Maximal 3 Vorschläge
	};

	/**
	 * Widget für die Integration in die Hangarplaner-UI
	 * Erstellt ein einfaches Lookup-Interface
	 */
	const createLookupWidget = () => {
		const widget = document.createElement("div");
		widget.className = "registration-lookup-widget";
		widget.innerHTML = `
            <div class="lookup-container" style="margin: 10px; padding: 15px; border: 1px solid #ddd; border-radius: 5px; background: #f9f9f9;">
                <h4>🔍 Flight Registration Lookup</h4>
                <div style="display: flex; gap: 10px; margin: 10px 0;">
                    <input type="text" id="lookup-flight-number" placeholder="Flugnummer (z.B. LH441)" 
                           style="flex: 1; padding: 5px; border: 1px solid #ccc; border-radius: 3px;">
                    <input type="date" id="lookup-flight-date" 
                           style="padding: 5px; border: 1px solid #ccc; border-radius: 3px;">
                    <button id="lookup-search-btn" style="padding: 5px 15px; background: #007cba; color: white; border: none; border-radius: 3px; cursor: pointer;">
                        Suchen
                    </button>
                </div>
                <div id="lookup-result" style="margin-top: 10px; padding: 10px; background: white; border-radius: 3px; min-height: 40px; border: 1px solid #eee;">
                    <i>Geben Sie eine Flugnummer und ein Datum ein...</i>
                </div>
                <div style="margin-top: 10px; font-size: 12px; color: #666;">
                    Datenquellen: AeroDataBox (primär) → OpenSky → FAA → Web Scraping
                </div>
            </div>
        `;

		// Event Listener hinzufügen
		const searchBtn = widget.querySelector("#lookup-search-btn");
		const flightNumberInput = widget.querySelector("#lookup-flight-number");
		const flightDateInput = widget.querySelector("#lookup-flight-date");
		const resultDiv = widget.querySelector("#lookup-result");

		// Standard-Datum setzen (heute)
		flightDateInput.value = new Date().toISOString().split("T")[0];

		const performLookup = async () => {
			const flightNumber = flightNumberInput.value.trim().toUpperCase();
			const flightDate = flightDateInput.value;

			if (!flightNumber || !flightDate) {
				resultDiv.innerHTML =
					'<span style="color: red;">❌ Bitte Flugnummer und Datum eingeben</span>';
				return;
			}

			resultDiv.innerHTML =
				'<span style="color: blue;">🔍 Suche läuft...</span>';
			searchBtn.disabled = true;

			try {
				const result = await lookupForHangarplaner(flightNumber, flightDate);

				if (result.success) {
					resultDiv.innerHTML = `
                        <div style="color: green;">
                            ✅ <strong>${result.registration}</strong><br>
                            <small>Quelle: ${result.source} | Konfidenz: ${result.confidence}%</small>
                        </div>
                    `;
				} else {
					let html = `<div style="color: red;">❌ ${result.error}</div>`;

					if (result.suggestions && result.suggestions.length > 0) {
						html +=
							'<div style="margin-top: 10px; font-size: 12px;"><strong>Vorschläge:</strong><br>';
						result.suggestions.forEach((s) => {
							html += `• ${s.flightNumber} → ${s.registration} (${s.reason})<br>`;
						});
						html += "</div>";
					}

					resultDiv.innerHTML = html;
				}
			} catch (error) {
				resultDiv.innerHTML = `<span style="color: red;">❌ Fehler: ${error.message}</span>`;
			} finally {
				searchBtn.disabled = false;
			}
		};

		searchBtn.addEventListener("click", performLookup);

		// Enter-Taste in Input-Feldern
		[flightNumberInput, flightDateInput].forEach((input) => {
			input.addEventListener("keypress", (e) => {
				if (e.key === "Enter") {
					performLookup();
				}
			});
		});

		return widget;
	};

	/**
	 * HAUPTFUNKTION: Automatische Übernachtungs-Flugdaten für Hangarplaner
	 *
	 * ARBEITSSCHRITTE:
	 * 1. AeroDataBox API: Alle ankommenden Flüge am ausgewählten Flughafen laden
	 * 2. Sammeln der Flüge ohne weiteren Abflug (latest income/Übernachtung)
	 * 3. Aircraft ID oder Flugnummer zwischenspeichern
	 * 4. Abgleich mit Tiles und Eintragen der Daten
	 * 5. Aircraft Registration Lookup falls nur Flugnummer vorhanden
	 * 6. Gleichen Prozess für Folgetag (Abflüge) wiederholen
	 *
	 * @param {string} airportCode - IATA-Code des Flughafens (z.B. "MUC")
	 * @param {string} currentDate - Aktuelles Datum (YYYY-MM-DD)
	 * @param {string} nextDate - Folgedatum (YYYY-MM-DD)
	 * @returns {Promise<Object>} Ergebnis der Verarbeitung
	 */
	const processOvernightFlightsForHangarplaner = async (
		airportCode,
		currentDate,
		nextDate
	) => {
		console.log(`\n🏨 === ÜBERNACHTUNGS-FLUGDATEN VERARBEITUNG GESTARTET ===`);
		console.log(`Flughafen: ${airportCode}`);
		console.log(`Aktueller Tag: ${currentDate}`);
		console.log(`Folgetag: ${nextDate}`);

		if (!window.AeroDataBoxAPI) {
			const error = "AeroDataBoxAPI nicht verfügbar";
			console.error(error);
			return { success: false, error };
		}

		try {
			// **SCHRITT 1: Ankommende Flüge des aktuellen Tages laden**
			console.log(`\n📥 === SCHRITT 1: ANKOMMENDE FLÜGE ${currentDate} ===`);
			const currentDayArrivals = await loadArrivingFlights(
				airportCode,
				currentDate
			);

			console.log(
				`📊 ${currentDayArrivals.length} ankommende Flüge am ${currentDate} gefunden`
			);

			// **SCHRITT 2: Flüge ohne weiteren Abflug identifizieren (Übernachtung)**
			console.log(`\n🌙 === SCHRITT 2: ÜBERNACHTUNGS-FLÜGE IDENTIFIZIEREN ===`);
			const overnightFlights = await identifyOvernightFlights(
				airportCode,
				currentDayArrivals,
				currentDate
			);

			console.log(
				`🏨 ${overnightFlights.length} Übernachtungs-Flüge identifiziert`
			);

			// **SCHRITT 3: Aircraft IDs sammeln und zwischenspeichern**
			console.log(`\n📋 === SCHRITT 3: AIRCRAFT IDs SAMMELN ===`);
			const aircraftData = extractAircraftData(overnightFlights);

			console.log(`✈️ ${aircraftData.length} Aircraft-Datensätze extrahiert`);

			// **SCHRITT 4: Abgleich mit Tiles (Ankunftsdaten)**
			console.log(`\n🎯 === SCHRITT 4: TILES-ABGLEICH FÜR ANKÜNFTE ===`);
			const arrivalMatches = await matchWithTiles(aircraftData, "arrival");

			console.log(
				`✅ ${arrivalMatches.matched} von ${aircraftData.length} Ankunftsdaten in Tiles eingetragen`
			);

			// **SCHRITT 5: Abflüge des Folgetages laden**
			console.log(`\n📤 === SCHRITT 5: ABFLÜGE ${nextDate} LADEN ===`);
			const nextDayDepartures = await loadDepartingFlights(
				airportCode,
				nextDate
			);

			console.log(
				`📊 ${nextDayDepartures.length} abfliegende Flüge am ${nextDate} gefunden`
			);

			// **SCHRITT 6: Abflüge für übernachtende Aircraft identifizieren**
			console.log(
				`\n🛫 === SCHRITT 6: ÜBERNACHTUNGS-ABFLÜGE IDENTIFIZIEREN ===`
			);
			const overnightDepartures = filterOvernightDepartures(
				nextDayDepartures,
				aircraftData
			);

			console.log(
				`🏨 ${overnightDepartures.length} Übernachtungs-Abflüge identifiziert`
			);

			// **SCHRITT 7: Abgleich mit Tiles (Abflugdaten)**
			console.log(`\n🎯 === SCHRITT 7: TILES-ABGLEICH FÜR ABFLÜGE ===`);
			const departureMatches = await matchWithTiles(
				overnightDepartures,
				"departure"
			);

			console.log(
				`✅ ${departureMatches.matched} von ${overnightDepartures.length} Abflugdaten in Tiles eingetragen`
			);

			// **SCHRITT 8: Zusammenfassung und Ergebnis**
			const summary = {
				success: true,
				airport: airportCode,
				currentDate,
				nextDate,
				statistics: {
					totalArrivals: currentDayArrivals.length,
					overnightFlights: overnightFlights.length,
					totalDepartures: nextDayDepartures.length,
					overnightDepartures: overnightDepartures.length,
					arrivalMatches: arrivalMatches.matched,
					departureMatches: departureMatches.matched,
					registrationLookups:
						arrivalMatches.lookupCount + departureMatches.lookupCount,
				},
				details: {
					arrivals: arrivalMatches,
					departures: departureMatches,
				},
			};

			console.log(`\n🏆 === VERARBEITUNG ABGESCHLOSSEN ===`);
			console.log(`📊 Statistiken:`, summary.statistics);

			return summary;
		} catch (error) {
			console.error("❌ Fehler bei der Übernachtungs-Verarbeitung:", error);
			return {
				success: false,
				error: error.message,
				airport: airportCode,
				currentDate,
				nextDate,
			};
		}
	};

	/**
	 * Lädt alle ankommenden Flüge für einen Tag
	 */
	const loadArrivingFlights = async (airportCode, date) => {
		try {
			const startDateTime = `${date}T00:00`;
			const endDateTime = `${date}T23:59`;

			console.log(
				`📥 Lade Ankünfte für ${airportCode}: ${startDateTime} bis ${endDateTime}`
			);

			const airportData = await window.AeroDataBoxAPI.getAirportFlights(
				airportCode,
				startDateTime,
				endDateTime
			);

			// Nur Ankünfte extrahieren
			let arrivals = [];
			if (airportData.arrivals) {
				arrivals = airportData.arrivals;
			} else if (Array.isArray(airportData)) {
				// Filtere nur Ankünfte (arrival airport = unser Flughafen)
				arrivals = airportData.filter(
					(flight) => flight.arrival?.airport?.iata === airportCode
				);
			}

			console.log(`📊 ${arrivals.length} Ankünfte gefunden`);
			return arrivals;
		} catch (error) {
			console.error(`❌ Fehler beim Laden der Ankünfte für ${date}:`, error);
			return [];
		}
	};

	/**
	 * Lädt alle abfliegenden Flüge für einen Tag
	 */
	const loadDepartingFlights = async (airportCode, date) => {
		try {
			const startDateTime = `${date}T00:00`;
			const endDateTime = `${date}T23:59`;

			console.log(
				`📤 Lade Abflüge für ${airportCode}: ${startDateTime} bis ${endDateTime}`
			);

			const airportData = await window.AeroDataBoxAPI.getAirportFlights(
				airportCode,
				startDateTime,
				endDateTime
			);

			// Nur Abflüge extrahieren
			let departures = [];
			if (airportData.departures) {
				departures = airportData.departures;
			} else if (Array.isArray(airportData)) {
				// Filtere nur Abflüge (departure airport = unser Flughafen)
				departures = airportData.filter(
					(flight) => flight.departure?.airport?.iata === airportCode
				);
			}

			console.log(`📊 ${departures.length} Abflüge gefunden`);
			return departures;
		} catch (error) {
			console.error(`❌ Fehler beim Laden der Abflüge für ${date}:`, error);
			return [];
		}
	};

	/**
	 * Identifiziert Flüge ohne weiteren Abflug (Übernachtung)
	 * KORRIGIERT: Behandelt sowohl Flüge mit Aircraft Registration als auch nur mit Flugnummer
	 */
	const identifyOvernightFlights = async (airportCode, arrivals, date) => {
		console.log(`🔍 Prüfe ${arrivals.length} Ankünfte auf Übernachtung...`);

		const overnightFlights = [];

		for (const arrival of arrivals) {
			const aircraftReg = extractRegistrationFromFlight(arrival);
			const flightNumber = arrival.number;

			// **FALL 1: Aircraft Registration verfügbar - normale Übernachtungsprüfung**
			if (aircraftReg) {
				console.log(`🔍 Prüfe Übernachtung für Aircraft ${aircraftReg} (Flug ${flightNumber})`);
				
				// Prüfe ob das Aircraft am gleichen Tag noch abfliegt
				const hasLaterDeparture = await checkForLaterDeparture(
					aircraftReg,
					airportCode,
					date,
					arrival
				);

				if (!hasLaterDeparture) {
					console.log(
						`🌙 Übernachtung identifiziert: ${aircraftReg} (Flug ${flightNumber})`
					);
					overnightFlights.push({
						...arrival,
						aircraftRegistration: aircraftReg,
						overnightConfirmed: true,
					});
				} else {
					console.log(
						`🔄 Keine Übernachtung: ${aircraftReg} fliegt am gleichen Tag weiter`
					);
				}
			} 
			// **FALL 2: Nur Flugnummer verfügbar - vorsichtige Übernachtungs-Annahme**
			else if (flightNumber) {
				console.log(
					`⚠️ Keine Aircraft Registration für Ankunftsflug ${flightNumber} gefunden - behandle als potenzielle Übernachtung`
				);
				
				// **STRATEGIE: Flights ohne Aircraft Registration als potenzielle Übernachtungen behandeln**
				// Grund: Später kann über Flugnummer eine Registration-Lookup erfolgen
				// Falls das nicht klappt, werden sie in matchWithTiles herausgefiltert
				overnightFlights.push({
					...arrival,
					aircraftRegistration: null, // Explizit null setzen
					overnightConfirmed: false, // Unbestätigt, da keine Registration verfügbar
					requiresLookup: true, // Flag für spätere Registration-Lookup
				});
			}
			// **FALL 3: Weder Aircraft Registration noch Flugnummer - überspringen**
			else {
				console.log(`❌ Weder Aircraft Registration noch Flugnummer für Ankunft verfügbar - überspringe`);
				continue;
			}
		}

		console.log(`🏨 ${overnightFlights.length} potenzielle Übernachtungs-Flüge identifiziert`);
		
		// Aufschlüsselung für bessere Diagnostik
		const confirmedOvernight = overnightFlights.filter(f => f.overnightConfirmed).length;
		const requiresLookup = overnightFlights.filter(f => f.requiresLookup).length;
		
		console.log(`   - ${confirmedOvernight} bestätigte Übernachtungen (mit Aircraft Registration)`);
		console.log(`   - ${requiresLookup} potenzielle Übernachtungen (nur Flugnummer, brauchen Lookup)`);

		return overnightFlights;
	};

	/**
	 * Prüft ob ein Aircraft am gleichen Tag noch abfliegt
	 */
	const checkForLaterDeparture = async (
		aircraftReg,
		airportCode,
		date,
		arrivalFlight
	) => {
		try {
			// Lade alle Abflüge des Tages für diese Aircraft Registration
			const aircraftFlights = await window.AeroDataBoxAPI.getAircraftFlights(
				aircraftReg,
				date
			);

			if (!aircraftFlights || !aircraftFlights.data) {
				return false;
			}

			// Ankunftszeit des Fluges
			const arrivalTime = new Date(
				arrivalFlight.arrival?.scheduledTime?.utc ||
					arrivalFlight.arrival?.scheduledTime?.local
			);

			// Prüfe ob es spätere Abflüge gibt
			const laterDepartures = aircraftFlights.data.filter((flight) => {
				// Muss ein Abflug vom gleichen Flughafen sein
				const depAirport = flight.flightPoints?.find(
					(p) => p.departurePoint
				)?.iataCode;
				if (depAirport !== airportCode) return false;

				// Muss nach der Ankunft stattfinden
				const depTimeStr = flight.flightPoints?.find((p) => p.departurePoint)
					?.departure?.timings?.[0]?.value;
				if (!depTimeStr) return false;

				const depTime = new Date(`${date}T${depTimeStr}`);
				return depTime > arrivalTime;
			});

			return laterDepartures.length > 0;
		} catch (error) {
			console.error(`❌ Fehler bei Abflug-Prüfung für ${aircraftReg}:`, error);
			return false; // Bei Fehlern annehmen, dass übernachtet wird
		}
	};

	/**
	 * Extrahiert Aircraft-Daten aus Flügen
	 */
	const extractAircraftData = (flights) => {
		return flights
			.map((flight) => {
				const aircraftId = extractRegistrationFromFlight(flight);
				const flightNumber = flight.number;

				return {
					aircraftId: aircraftId,
					flightNumber: flightNumber,
					flightData: flight,
					dataSource: aircraftId ? "registration" : "flightNumber",
					arrivalTime:
						flight.arrival?.scheduledTime?.utc?.substring(11, 16) ||
						flight.arrival?.scheduledTime?.local?.substring(11, 16),
					originAirport: flight.departure?.airport?.iata,
					destinationAirport: flight.arrival?.airport?.iata,
				};
			})
			.filter((data) => data.aircraftId || data.flightNumber);
	};

	/**
	 * Filtert Abflüge für übernachtende Aircraft
	 */
	const filterOvernightDepartures = (departures, overnightAircraftData) => {
		const overnightRegistrations = overnightAircraftData
			.filter((data) => data.aircraftId)
			.map((data) => data.aircraftId);

		const overnightFlightNumbers = overnightAircraftData
			.filter((data) => !data.aircraftId && data.flightNumber)
			.map((data) => data.flightNumber);

		return departures
			.filter((departure) => {
				const departureReg = extractRegistrationFromFlight(departure);
				const departureFlightNum = departure.number;

				// Match über Aircraft Registration
				if (departureReg && overnightRegistrations.includes(departureReg)) {
					return true;
				}

				// Match über Flugnummer (für gleiche Aircraft ohne Registration)
				if (
					departureFlightNum &&
					overnightFlightNumbers.includes(departureFlightNum)
				) {
					return true;
				}

				return false;
			})
			.map((departure) => ({
				...departure,
				aircraftRegistration: extractRegistrationFromFlight(departure),
				departureTime:
					departure.departure?.scheduledTime?.utc?.substring(11, 16) ||
					departure.departure?.scheduledTime?.local?.substring(11, 16),
				originAirport: departure.departure?.airport?.iata,
				destinationAirport: departure.arrival?.airport?.iata,
			}));
	};

	/**
	 * Gleicht Aircraft-Daten mit Tiles ab und trägt Daten ein
	 */
	const matchWithTiles = async (aircraftDataList, type) => {
		console.log(
			`🎯 Starte Tiles-Abgleich für ${type} (${aircraftDataList.length} Datensätze)`
		);

		let matched = 0;
		let lookupCount = 0;
		const results = [];

		// Alle Aircraft-Input-Felder in Tiles sammeln
		const aircraftInputs = document.querySelectorAll('input[id^="aircraft-"]');
		const tileAircraftIds = Array.from(aircraftInputs)
			.map((input) => ({
				element: input,
				aircraftId: input.value.trim().toUpperCase(),
				cellNumber: input.id.split("-")[1],
			}))
			.filter((tile) => tile.aircraftId !== "");

		console.log(`📋 ${tileAircraftIds.length} Tiles mit Aircraft IDs gefunden`);

		for (const aircraftData of aircraftDataList) {
			let processedAircraftId = aircraftData.aircraftId;

			// **AIRCRAFT REGISTRATION LOOKUP falls nur Flugnummer vorhanden**
			if (!processedAircraftId && aircraftData.flightNumber) {
				console.log(`🔍 Lookup für Flugnummer: ${aircraftData.flightNumber}`);

				const flightDate =
					type === "arrival" ? getCurrentDateFromUI() : getNextDateFromUI();

				try {
					processedAircraftId = await lookupRegistration(
						aircraftData.flightNumber,
						flightDate
					);
					lookupCount++;

					if (processedAircraftId) {
						console.log(
							`✅ Registration gefunden: ${aircraftData.flightNumber} → ${processedAircraftId}`
						);
					} else {
						console.log(
							`❌ Keine Registration für ${aircraftData.flightNumber} gefunden`
						);
					}
				} catch (error) {
					console.error(
						`❌ Lookup Fehler für ${aircraftData.flightNumber}:`,
						error
					);
				}
			}

			// **ABGLEICH MIT TILES**
			if (processedAircraftId) {
				const matchingTile = tileAircraftIds.find(
					(tile) => tile.aircraftId === processedAircraftId.toUpperCase()
				);

				if (matchingTile) {
					console.log(
						`🎯 MATCH: ${processedAircraftId} → Tile ${matchingTile.cellNumber}`
					);

					// Daten in Tile eintragen
					const success = updateTileWithFlightData(
						matchingTile.cellNumber,
						aircraftData,
						type
					);
					if (success) {
						matched++;
						results.push({
							aircraftId: processedAircraftId,
							cellNumber: matchingTile.cellNumber,
							flightNumber: aircraftData.flightNumber,
							type: type,
							success: true,
						});
					}
				} else {
					console.log(
						`❌ Kein Tile für Aircraft ${processedAircraftId} gefunden`
					);
					results.push({
						aircraftId: processedAircraftId,
						flightNumber: aircraftData.flightNumber,
						type: type,
						success: false,
						reason: "No matching tile found",
					});
				}
			} else {
				console.log(
					`❌ Keine Aircraft ID für Flug ${aircraftData.flightNumber} verfügbar`
				);
				results.push({
					flightNumber: aircraftData.flightNumber,
					type: type,
					success: false,
					reason: "No aircraft ID available",
				});
			}
		}

		return {
			matched,
			lookupCount,
			total: aircraftDataList.length,
			results,
		};
	};

	/**
	 * Aktualisiert ein Tile mit Flugdaten
	 */
	const updateTileWithFlightData = (cellNumber, aircraftData, type) => {
		try {
			if (type === "arrival") {
				// Ankunftsdaten eintragen
				const arrivalTimeElement = document.getElementById(
					`arrival-time-${cellNumber}`
				);
				const positionElement = document.getElementById(
					`position-${cellNumber}`
				);

				if (arrivalTimeElement && aircraftData.arrivalTime) {
					arrivalTimeElement.value = aircraftData.arrivalTime;
					console.log(
						`📝 Tile ${cellNumber}: Ankunftszeit ${aircraftData.arrivalTime} eingetragen`
					);
				}

				if (positionElement && aircraftData.originAirport) {
					positionElement.value = aircraftData.originAirport;
					console.log(
						`📝 Tile ${cellNumber}: Position ${aircraftData.originAirport} eingetragen`
					);
				}
			} else if (type === "departure") {
				// Abflugdaten eintragen
				const departureTimeElement = document.getElementById(
					`departure-time-${cellNumber}`
				);

				if (departureTimeElement && aircraftData.departureTime) {
					departureTimeElement.value = aircraftData.departureTime;
					console.log(
						`📝 Tile ${cellNumber}: Abflugzeit ${aircraftData.departureTime} eingetragen`
					);
				}
			}

			return true;
		} catch (error) {
			console.error(
				`❌ Fehler beim Aktualisieren von Tile ${cellNumber}:`,
				error
			);
			return false;
		}
	};

	/**
	 * Hilfsfunktionen für UI-Datums-Zugriff
	 */
	const getCurrentDateFromUI = () => {
		const dateInput = document.getElementById("currentDateInput");
		return dateInput ? dateInput.value : new Date().toISOString().split("T")[0];
	};

	const getNextDateFromUI = () => {
		const dateInput = document.getElementById("nextDateInput");
		if (dateInput) return dateInput.value;

		// Fallback: Aktuelles Datum + 1 Tag
		const tomorrow = new Date();
		tomorrow.setDate(tomorrow.getDate() + 1);
		return tomorrow.toISOString().split("T")[0];
	};

	// Public API
	const getCachedRegistration = (flightNumber, flightDate) => {
		try {
			const key = `${String(flightNumber || '').toUpperCase()}_${String(flightDate || '')}`;
			const v = registrationCache.get(key);
			if (v && v.registration && (__now() - v.timestamp) < config.cacheExpiry) return v.registration;
			return null;
		} catch (e) { return null; }
	};

	return {
		lookupRegistration,
		lookupForHangarplaner, // NEUE Hauptfunktion für Hangarplaner
		processOvernightFlightsForHangarplaner, // **NEUE HAUPTFUNKTION**
		lookupMultiple,
		testLookup,
		getCacheStats,
		getCachedRegistration,
		clearCache: () => registrationCache.clear(),
		setDebugMode: (enabled) => {
			config.debugMode = enabled;
		},
		enableSource: (source, enabled) => {
			if (config.sources.hasOwnProperty(source)) {
				config.sources[source] = enabled;
			}
		},
		createLookupWidget, // NEUE Widget-Funktion
		// Direkte Quelle-Zugriffe für Tests
		lookupViaAeroDataBox,
		lookupViaOpenSky,
		lookupViaFAA,
		lookupViaWebScraping,
		// Hilfsfunktionen für Debug/Test
		loadArrivingFlights,
		loadDepartingFlights,
		identifyOvernightFlights,
		extractAircraftData,
		matchWithTiles,
	};
})();

// Globalen Namespace erstellen
window.FlightRegistrationLookup = FlightRegistrationLookup;

// Auto-Test beim Laden (nur im Debug-Modus)
document.addEventListener("DOMContentLoaded", () => {
	console.log("✈️ Flight Registration Lookup Service geladen");

	// Uncomment für automatischen Test:
	// FlightRegistrationLookup.testLookup();
});
