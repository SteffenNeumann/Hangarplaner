/**
 * API-Fassade für die einheitliche Handhabung verschiedener Flugdaten-APIs
 * Dient als zentraler Zugangspunkt für alle Flugdatenabfragen
 * ERWEITERT: AeroDataBox und Flightradar24 unterstützt
 */

// Selbst ausführende Funktion für Kapselung
const FlightDataAPI = (function () {
	// Erweiterte Konfiguration - AeroDataBox und Flightradar24 als Provider
	const config = {
		providers: ["aerodatabox", "flightradar24", "apimarket"],
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
			if (config.activeProvider === "flightradar24") {
				return await handleFlightradar24Request(
					aircraftId,
					currentDate,
					nextDate
				);
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
	 * Behandelt Flightradar24 API-Anfragen
	 */
	const handleFlightradar24Request = async function (
		aircraftId,
		currentDate,
		nextDate
	) {
		// Sicherstellen, dass Flightradar24API verfügbar ist
		if (!window.Flightradar24API) {
			throw new Error(
				"Flightradar24API ist nicht verfügbar. Bitte laden Sie die flightradar24-api.js Datei."
			);
		}

		console.log(`[API-FASSADE] Verwende Flightradar24 API für ${aircraftId}`);

		// Hole aktuellen Flughafen für Übernachtungslogik
		const selectedAirport =
			document.getElementById("airportCodeInput")?.value || "MUC";

		// Verwende die Übernachtungslogik von Flightradar24
		const overnightResult = await window.Flightradar24API.getOvernightFlights(
			aircraftId,
			selectedAirport,
			currentDate,
			nextDate
		);

		// Konvertiere Flightradar24-Ergebnis in das erwartete Format
		if (
			overnightResult.hasOvernightStay &&
			overnightResult.lastArrival &&
			overnightResult.firstDeparture
		) {
			// Extrahiere Daten aus dem letzten Ankunftsflug
			const lastArrival = overnightResult.lastArrival;
			const firstDeparture = overnightResult.firstDeparture;

			const arrivalPoint = lastArrival.flightPoints?.find(
				(p) => p.arrivalPoint
			);
			const departurePoint = firstDeparture.flightPoints?.find(
				(p) => p.departurePoint
			);

			const arrivalTime =
				arrivalPoint?.arrival?.timings?.[0]?.value?.substring(0, 5) || "--:--";
			const departureTime =
				departurePoint?.departure?.timings?.[0]?.value?.substring(0, 5) ||
				"--:--";

			const originCode =
				lastArrival.flightPoints?.find((p) => p.departurePoint)?.iataCode || "";
			const destCode =
				firstDeparture.flightPoints?.find((p) => p.arrivalPoint)?.iataCode ||
				"";

			return {
				originCode: originCode,
				destCode: destCode,
				departureTime: departureTime,
				arrivalTime: arrivalTime,
				positionText: `${originCode} → ${selectedAirport} → ${destCode}`,
				data: [lastArrival, firstDeparture],
				_isUtc: true,
				_source: "flightradar24",
				_hasOvernightStay: true,
			};
		} else {
			// Keine Übernachtung gefunden - versuche einzelne Flugdaten für beide Tage
			const [currentDayData, nextDayData] = await Promise.all([
				window.Flightradar24API.getAircraftFlights(aircraftId, currentDate),
				window.Flightradar24API.getAircraftFlights(aircraftId, nextDate),
			]);

			const allFlights = [
				...(currentDayData.data || []),
				...(nextDayData.data || []),
			];

			if (allFlights.length > 0) {
				// Nimm den ersten gefundenen Flug als Beispiel
				const firstFlight = allFlights[0];
				const depPoint = firstFlight.flightPoints?.find(
					(p) => p.departurePoint
				);
				const arrPoint = firstFlight.flightPoints?.find((p) => p.arrivalPoint);

				return {
					originCode: depPoint?.iataCode || "",
					destCode: arrPoint?.iataCode || "",
					departureTime:
						depPoint?.departure?.timings?.[0]?.value?.substring(0, 5) ||
						"--:--",
					arrivalTime:
						arrPoint?.arrival?.timings?.[0]?.value?.substring(0, 5) || "--:--",
					positionText: `${depPoint?.iataCode || "???"} → ${
						arrPoint?.iataCode || "???"
					}`,
					data: allFlights,
					_isUtc: true,
					_source: "flightradar24",
					_hasOvernightStay: false,
				};
			} else {
				return {
					originCode: "",
					destCode: "",
					departureTime: "",
					arrivalTime: "",
					positionText: "",
					data: [],
					_isUtc: true,
					_source: "flightradar24",
					_noDataFound: true,
				};
			}
		}
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
			if (config.activeProvider === "flightradar24") {
				if (!window.Flightradar24API) {
					throw new Error("Flightradar24API ist nicht verfügbar");
				}
				return await window.Flightradar24API.getAircraftFlights(
					aircraftId,
					date
				);
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
