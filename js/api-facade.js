/**
 * API-Fassade für die einheitliche Handhabung verschiedener Flugdaten-APIs
 * Dient als zentraler Zugangspunkt für alle Flugdatenabfragen
 * ERWEITERT: AeroDataBox, Aviationstack und API Market unterstützt
 */

// Selbst ausführende Funktion für Kapselung
const FlightDataAPI = (function () {
	// Erweiterte Konfiguration - AeroDataBox, Aviationstack und API Market als Provider
	const config = {
		providers: ["aerodatabox", "aviationstack", "apimarket"],
		activeProvider: "aerodatabox", // Standard: AeroDataBox
	};

	/**
	 * Initialisierung der Fassade - erweitert
	 */
	const initialize = function () {
		console.log(
			`Flight Data API-Fassade initialisiert mit Standard-Provider: ${config.activeProvider}`
		);
		console.log(`Verfügbare Provider: ${config.providers.join(", ")}`);
	};

	// Sofortige Initialisierung beim Laden
	initialize();

	/**
	 * Flugdaten für ein Flugzeug abrufen und aktualisieren
	 * @param {string} aircraftId - Flugzeugkennung (Registrierung)
	 * @param {string} currentDate - Das aktuelle Datum für die Ankunft (letzter Flug)
	 * @param {string} nextDate - Das Folgedatum für den Abflug (erster Flug)
	 * @returns {Promise<Object>} Vereinheitlichte Flugdaten
	 */
	const updateAircraftData = async function (
		aircraftId,
		currentDate,
		nextDate
	) {
		console.log(
			`[API-FASSADE] Rufe updateAircraftData auf für Flugzeug: ${aircraftId}, Datum 1: ${currentDate}, Datum 2: ${nextDate}, Provider: ${config.activeProvider}`
		);

		try {
			// Explizite Prüfung auf leere Aircraft ID
			if (!aircraftId || aircraftId.trim() === "") {
				console.log(
					"[API-FASSADE] Keine Aircraft ID angegeben oder leere ID, FORCE RESET wird ausgeführt"
				);
				return {
					originCode: "",
					destCode: "",
					departureTime: "",
					arrivalTime: "",
					positionText: "",
					data: [],
					_isUtc: true,
					_forceReset: true,
					_clearFields: true,
					_noDataFound: true,
				};
			}

			// Provider-spezifische API-Aufrufe
			if (config.activeProvider === "aviationstack") {
				return await handleAviationstackRequest(
					aircraftId,
					currentDate,
					nextDate
				);
			} else if (config.activeProvider === "apimarket") {
				return await handleAPIMarketRequest(aircraftId, currentDate, nextDate);
			} else {
				// Standard: AeroDataBox
				return await handleAeroDataBoxRequest(
					aircraftId,
					currentDate,
					nextDate
				);
			}
		} catch (error) {
			console.error(`[API-FASSADE] Fehler bei updateAircraftData:`, error);
			return {
				originCode: "",
				destCode: "",
				departureTime: "",
				arrivalTime: "",
				positionText: "",
				data: [],
				_isUtc: true,
				_error: error.message,
				_clearFields: true,
			};
		}
	};

	/**
	 * Behandelt Aviationstack API-Anfragen - Free-Plan angepasst für Flughafen-basierte Suche
	 */
	const handleAviationstackRequest = async function (
		aircraftId,
		currentDate,
		nextDate
	) {
		// Sicherstellen, dass AviationstackAPI verfügbar ist
		if (!window.aviationstackAPI) {
			throw new Error(
				"AviationstackAPI ist nicht verfügbar. Bitte laden Sie die aviationstack-api.js Datei."
			);
		}

		console.log(
			`[API-FASSADE] Verwende Aviationstack API (Free-Plan) für ${aircraftId} - Flughafen-basierte Suche`
		);
		console.log(
			`💡 TIPP: Basic-Plan ($10/Monat) ermöglicht direkte Aircraft-Registrierung-Suche`
		);

		// Hole aktuellen Flughafen für Kontext
		const selectedAirport =
			document.getElementById("airportCodeInput")?.value || "MUC";
		console.log(`[API-FASSADE] Gewählter Flughafen: ${selectedAirport}`);

		try {
			// Verwende die spezialisierte Übernachtungslogik der Aviationstack API
			const overnightData = await window.aviationstackAPI.getOvernightFlights(
				aircraftId,
				selectedAirport
			);

			console.log(
				`[API-FASSADE] Aviationstack Übernachtungsdaten:`,
				overnightData
			);

			// Wenn keine Daten gefunden wurden
			if (!overnightData.today.length && !overnightData.tomorrow.length) {
				console.log(
					`[API-FASSADE] Keine Flüge für Flughafen ${selectedAirport} gefunden`
				);
				return {
					originCode: "",
					destCode: "",
					departureTime: "",
					arrivalTime: "",
					positionText: `Keine Flüge für ${selectedAirport} gefunden (Free-Plan)`,
					data: [],
					_isUtc: true,
					_source: "aviationstack",
					_noDataFound: true,
					_freePlanNote: "Aircraft-Registrierung im Free-Plan nicht verfügbar",
				};
			}

			// Extrahiere Ankunfts- und Abflugdaten für UI
			let arrivalTime = "--:--";
			let departureTime = "--:--";
			let originCode = "";
			let destCode = "";
			let positionText = "";

			// Versuche spezifische Aircraft-Daten zu finden, falls verfügbar
			let relevantTodayFlights = overnightData.today;
			let relevantTomorrowFlights = overnightData.tomorrow;

			if (overnightData.aircraftSpecific) {
				// Spezifisches Flugzeug gefunden!
				relevantTodayFlights = overnightData.aircraftTodayFlights || [];
				relevantTomorrowFlights = overnightData.aircraftTomorrowFlights || [];
				positionText = `✅ ${aircraftId} spezifisch gefunden!`;
			} else {
				// Free-Plan Limitation: Zeige alle Flughafen-Flüge
				positionText = `⚠️ Free-Plan: ${
					overnightData.today.length + overnightData.tomorrow.length
				} Flüge am ${selectedAirport}`;
			}

			// Letzter Flug heute (Ankunft)
			if (relevantTodayFlights.length > 0) {
				const lastToday = relevantTodayFlights[relevantTodayFlights.length - 1];
				if (lastToday.arrival.scheduled) {
					arrivalTime = new Date(
						lastToday.arrival.scheduled
					).toLocaleTimeString("de-DE", {
						hour: "2-digit",
						minute: "2-digit",
					});
				}
				originCode = lastToday.departure.iata || "";
				destCode = lastToday.arrival.iata || "";
			}

			// Erster Flug morgen (Abflug)
			if (relevantTomorrowFlights.length > 0) {
				const firstTomorrow = relevantTomorrowFlights[0];
				if (firstTomorrow.departure.scheduled) {
					departureTime = new Date(
						firstTomorrow.departure.scheduled
					).toLocaleTimeString("de-DE", {
						hour: "2-digit",
						minute: "2-digit",
					});
				}
				// Falls noch kein Origin gesetzt, verwende den Abflugort von morgen
				if (!originCode) {
					originCode = firstTomorrow.departure.iata || "";
				}
				// Zielort für morgen
				if (firstTomorrow.arrival.iata) {
					destCode = firstTomorrow.arrival.iata || destCode;
				}
			}

			// Alle relevanten Flüge für Detailansicht kombinieren
			const allFlights = [...relevantTodayFlights, ...relevantTomorrowFlights];

			return {
				originCode,
				destCode,
				departureTime,
				arrivalTime,
				positionText,
				data: allFlights,
				_isUtc: true,
				_source: "aviationstack",
				_overnightData: overnightData,
				_airportFilter: selectedAirport,
				_freePlanMode: true,
				_aircraftSpecific: overnightData.aircraftSpecific,
				_allAirportFlights: [...overnightData.today, ...overnightData.tomorrow], // Alle Flughafen-Flüge für Debug
			};
		} catch (error) {
			console.error(`[API-FASSADE] Fehler bei Aviationstack-Anfrage:`, error);
			return {
				originCode: "",
				destCode: "",
				departureTime: "",
				arrivalTime: "",
				positionText: "Fehler beim Laden der Flugdaten (Free-Plan)",
				data: [],
				_isUtc: true,
				_source: "aviationstack",
				_error: error.message,
				_clearFields: true,
				_freePlanNote: "Aircraft-Registrierung im Free-Plan nicht verfügbar",
			};
		}
	};

	/**
	 * Behandelt API Market Anfragen - Placeholder für zukünftige Integration
	 */
	const handleAPIMarketRequest = async function (
		aircraftId,
		currentDate,
		nextDate
	) {
		console.log(`[API-FASSADE] API Market Provider gewählt für ${aircraftId}`);

		// Placeholder - API Market ist noch nicht implementiert
		console.warn("[API-FASSADE] API Market ist noch nicht implementiert");

		return {
			originCode: "",
			destCode: "",
			departureTime: "",
			arrivalTime: "",
			positionText: "API Market noch nicht implementiert",
			data: [],
			_isUtc: true,
			_source: "apimarket",
			_notImplemented: true,
			_clearFields: true,
		};
	};

	/**
	 * Behandelt AeroDataBox API-Anfragen (vereinfachte Version)
	 */
	const handleAeroDataBoxRequest = async function (
		aircraftId,
		currentDate,
		nextDate
	) {
		// Dynamic Loading: AeroDataBoxAPI laden falls nicht verfügbar
		if (!window.AeroDataBoxAPI && window.DynamicAPILoader) {
			console.log("[API-FASSADE] Lade AeroDataBoxAPI dynamisch...");
			await window.DynamicAPILoader.loadPrimaryAPI();
		}

		// Prüfen, ob AeroDataBoxAPI verfügbar ist
		if (!window.AeroDataBoxAPI) {
			throw new Error(
				"AeroDataBoxAPI ist nicht verfügbar und konnte nicht geladen werden"
			);
		}

		console.log(`[API-FASSADE] Verwende AeroDataBox API für ${aircraftId}`);

		// Direkte Weiterleitung an die ursprüngliche AeroDataBox-Implementierung
		const result = await window.AeroDataBoxAPI.updateAircraftData(
			aircraftId,
			currentDate,
			nextDate
		);

		// Sicherstellen, dass wir immer ein gültiges Ergebnisobjekt zurückgeben
		if (!result) {
			return {
				originCode: "",
				destCode: "",
				departureTime: "",
				arrivalTime: "",
				positionText: "",
				data: [],
				_isUtc: true,
				_source: "aerodatabox",
				_noDataFound: true,
			};
		}

		// Markiere das Ergebnis mit der Quelle
		result._source = "aerodatabox";
		return result;
	};

	/**
	 * Einzelne Flugdaten für ein Flugzeug abrufen
	 * @param {string} aircraftId - Flugzeugkennung (Registrierung)
	 * @param {string} date - Datum im Format YYYY-MM-DD
	 * @returns {Promise<Object>} Flugdaten
	 */
	const getAircraftFlights = async function (aircraftId, date) {
		console.log(
			`[API-FASSADE] Rufe getAircraftFlights auf für ${aircraftId} am ${date}, Provider: ${config.activeProvider}`
		);

		try {
			if (config.activeProvider === "aviationstack") {
				if (!window.aviationstackAPI) {
					throw new Error("AviationstackAPI ist nicht verfügbar");
				}
				// Prüfe ob Datum in der Zukunft liegt
				const today = new Date();
				const queryDate = new Date(date);
				const isNextDate = queryDate > today;

				if (isNextDate) {
					// Zukünftige Flüge
					const flights = await window.aviationstackAPI.getFutureFlights(
						aircraftId,
						{
							flight_date: date,
						}
					);
					return { data: flights };
				} else {
					// Aktuelle/historische Flüge
					const flights = await window.aviationstackAPI.getCurrentFlights(
						aircraftId,
						{
							flight_date: date,
						}
					);
					return { data: flights };
				}
			} else if (config.activeProvider === "apimarket") {
				console.warn("[API-FASSADE] API Market noch nicht implementiert");
				return { data: [], _notImplemented: true };
			} else {
				// Standard: AeroDataBox
				if (!window.AeroDataBoxAPI) {
					throw new Error("AeroDataBoxAPI ist nicht verfügbar");
				}
				return await window.AeroDataBoxAPI.getAircraftFlights(aircraftId, date);
			}
		} catch (error) {
			console.error(`[API-FASSADE] Fehler bei getAircraftFlights:`, error);
			return { data: [], _error: error.message };
		}
	};

	/**
	 * API-Provider ändern
	 * @param {string} provider - Name des zu aktivierenden Providers
	 */
	const setProvider = function (provider) {
		if (config.providers.includes(provider)) {
			const oldProvider = config.activeProvider;
			config.activeProvider = provider;
			console.log(
				`[API-FASSADE] Provider geändert von ${oldProvider} zu ${provider}`
			);
			return true;
		} else {
			console.warn(
				`[API-FASSADE] Unbekannter Provider: ${provider}. Verfügbare Provider: ${config.providers.join(
					", "
				)}`
			);
			return false;
		}
	};

	/**
	 * Aktiven Provider abfragen
	 * @returns {string} Name des aktiven Providers
	 */
	const getActiveProvider = function () {
		return config.activeProvider;
	};

	// Public API
	return {
		updateAircraftData,
		getAircraftFlights,
		setProvider,
		getActiveProvider,
		// Für Debugging
		getConfig: () => ({ ...config }),
	};
})();

// Globalen Namespace für API-Zugriff erstellen
window.FlightDataAPI = FlightDataAPI;
