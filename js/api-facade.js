/**
 * API-Fassade für die einheitliche Handhabung verschiedener Flugdaten-APIs
 * Dient als zentraler Zugangspunkt für alle Flugdatenabfragen
 * VEREINFACHT: Nur AeroDataBox wird jetzt verwendet
 */

// Selbst ausführende Funktion für Kapselung
const FlightDataAPI = (function () {
	// Vereinfachte Konfiguration - nur AeroDataBox als Provider
	const config = {
		providers: ["aerodatabox"],
		activeProvider: "aerodatabox", // Immer AeroDataBox
	};

	/**
	 * Initialisierung der Fassade - vereinfacht
	 */
	const initialize = function () {
		console.log(
			"Flight Data API-Fassade initialisiert mit Provider: aerodatabox (vereinfacht)"
		);
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
			`[API-FASSADE] Rufe updateAircraftData auf für Flugzeug: ${aircraftId}, Datum 1: ${currentDate}, Datum 2: ${nextDate}`
		);

		try {
			// Explizite Prüfung auf leere Aircraft ID
			if (!aircraftId || aircraftId.trim() === "") {
				console.log(
					"[API-FASSADE] Keine Aircraft ID angegeben oder leere ID, FORCE RESET wird ausgeführt"
				);
				// KORREKTUR: Konsistente leere Werte mit Clear-Flags für UI-Clearing
				return {
					originCode: "",
					destCode: "",
					departureTime: "",
					arrivalTime: "",
					positionText: "",
					data: [],
					_isUtc: true,
					_forceReset: true, // Spezielles Flag für das UI-Update
					_clearFields: true, // Flag für UI-Clearing
					_noDataFound: true, // Flag für "keine Daten gefunden"
				};
			}

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

			// WICHTIG: Zuerst die originale Methode aufrufen, die in den meisten Fällen funktioniert
			console.log(
				`[API-FASSADE] Rufe AeroDataBoxAPI.updateAircraftData mit beiden Daten auf: ${currentDate}, ${nextDate}`
			);
			const originalResult = await window.AeroDataBoxAPI.updateAircraftData(
				aircraftId,
				currentDate,
				nextDate
			);

			// Sicherstellen, dass wir immer ein gültiges Ergebnisobjekt zurückgeben
			if (!originalResult) {
				console.log(
					"[API-FASSADE] Keine Ergebnisse von der API erhalten, gebe leere Werte zurück"
				);
				return {
					originCode: "",
					destCode: "",
					departureTime: "",
					arrivalTime: "",
					positionText: "",
					data: [],
					_isUtc: true,
					_clearFields: true, // Flag für UI-Clearing
					_noDataFound: true, // Flag für "keine Daten gefunden"
				};
			}

			// Wenn wir Ergebnisse haben und ein Flug für den Folgetag gefunden wurde, geben wir das zurück
			const hasDepartureTime =
				originalResult &&
				originalResult.departureTime &&
				originalResult.departureTime !== "--:--";

			if (hasDepartureTime) {
				console.log(
					`[API-FASSADE] Originale Methode hat vollständige Daten geliefert`
				);
				return originalResult;
			}

			// Falls kein Abflug gefunden wurde, aber Ankünfte vorhanden sind, versuchen wir es
			// mit der optimierten Flughafenabfrage für den Folgetag
			const hasArrivalTime =
				originalResult &&
				originalResult.arrivalTime &&
				originalResult.arrivalTime !== "--:--";

			if (hasArrivalTime) {
				console.log(
					`[API-FASSADE] Ankunftsflug gefunden, aber kein Abflug. Versuche Flughafenabfrage für Folgetag...`
				);

				// Aktuellen Flughafen für die Flughafensuche abrufen
				const selectedAirport =
					document.getElementById("airportCodeInput")?.value || "MUC";

				// Daten für den Folgetag mit der Flughafen-basierten Methode abrufen
				// Zeitfenster von 4:00 bis 16:00 Uhr verwenden (12 Stunden mit hoher Flugaktivität)
				console.log(
					`[API-FASSADE] Optimierte Flughafenabfrage für Folgetag: ${nextDate}`
				);
				const nextDayData =
					await window.AeroDataBoxAPI.getAircraftFlightsByAirport(
						selectedAirport,
						nextDate,
						aircraftId,
						4, // Startstunde (4:00 Uhr)
						16 // Endstunde (16:00 Uhr)
					);

				// Wenn wir keine Flüge am Folgetag gefunden haben, geben wir das ursprüngliche Ergebnis zurück
				if (
					!nextDayData ||
					!nextDayData.data ||
					nextDayData.data.length === 0
				) {
					console.log(
						`[API-FASSADE] Keine zusätzlichen Flüge am Folgetag gefunden. Bleibe bei Originaldaten.`
					);
					return originalResult;
				}

				// Wir haben Flüge am Folgetag gefunden, aber müssen basierend auf anderen Kriterien filtern,
				// da die Flughafen-API keine Aircraft ID zurückgibt
				console.log(
					`[API-FASSADE] ${nextDayData.data.length} Flüge am Folgetag gefunden. Filtere nach passenden Kriterien.`
				);

				// Informationen aus dem Originalergebnis extrahieren, um Flugzeug zu identifizieren
				let airlineCode = null;
				let aircraftModel = null;

				// Versuche, Fluggesellschaft und Modell aus dem ursprünglichen Ergebnis zu ermitteln
				if (
					originalResult &&
					originalResult.data &&
					originalResult.data.length > 0
				) {
					const lastFlight =
						originalResult.data[originalResult.data.length - 1];

					// Extrahiere die Fluggesellschaft (ICAO oder IATA Code)
					if (lastFlight.flight && lastFlight.flight.airline) {
						airlineCode =
							lastFlight.flight.airline.icao || lastFlight.flight.airline.iata;
					}

					// Extrahiere das Flugzeugmodell
					if (lastFlight.aircraft && lastFlight.aircraft.model) {
						aircraftModel = lastFlight.aircraft.model;
					}

					console.log(
						`[API-FASSADE] Filterkriterien aus Ursprungsflug: Airline=${airlineCode}, Modell=${aircraftModel}`
					);
				}

				// Abflüge filtern (wo der ausgewählte Flughafen der Abflughafen ist)
				// und zusätzlich nach Fluggesellschaft und Flugzeugmodell filtern, wenn verfügbar
				const departureFlights = nextDayData.data.filter((flight) => {
					// Erstmal nach Abflug vom gewählten Flughafen filtern
					let isFromSelectedAirport = false;
					if (flight.flightPoints && flight.flightPoints.length >= 2) {
						const departurePoint = flight.flightPoints.find(
							(p) => p.departurePoint
						);
						isFromSelectedAirport =
							departurePoint && departurePoint.iataCode === selectedAirport;
					} else if (flight.departure) {
						// Alternative Struktur in der neuen API
						isFromSelectedAirport = true; // Wenn wir nach Abflügen vom Flughafen suchen, sollte das bereits passen
					}

					if (!isFromSelectedAirport) return false;

					// Wenn wir Fluggesellschaft und Modell haben, zusätzlich danach filtern
					let matchesAirline = true;
					let matchesModel = true;

					// Airline überprüfen (falls verfügbar)
					if (airlineCode && flight.airline) {
						const flightAirlineCode =
							flight.airline.icao || flight.airline.iata;
						matchesAirline = flightAirlineCode === airlineCode;
					}

					// Flugzeugmodell überprüfen (falls verfügbar)
					if (aircraftModel && flight.aircraft && flight.aircraft.model) {
						// Vereinfachter Vergleich - entferne Hersteller aus Modellbezeichnung für allgemeinen Vergleich
						const normalizedModel = aircraftModel
							.replace(/airbus|boeing|embraer|bombardier/i, "")
							.trim();
						const flightModel = flight.aircraft.model
							.replace(/airbus|boeing|embraer|bombardier/i, "")
							.trim();
						matchesModel =
							flightModel.includes(normalizedModel) ||
							normalizedModel.includes(flightModel);
					}

					// Logge detaillierte Informationen für Debugging
					if (matchesAirline && matchesModel) {
						console.log(
							`[API-FASSADE] Passender Flug gefunden: ${
								flight.number || "Unbekannt"
							}`
						);
					}

					return matchesAirline && matchesModel;
				});

				// Nach Abflugzeit sortieren (Unterstützung für verschiedene API-Formate)
				departureFlights.sort((a, b) => {
					// Format 1: Flugpunkte mit departurePoint
					const getTimeFromFlightPoints = (flight) => {
						const depPoint = flight.flightPoints?.find((p) => p.departurePoint);
						return depPoint?.departure?.timings?.[0]?.value || "99:99";
					};

					// Format 2: Direktes departure-Objekt mit scheduledTime oder revisedTime
					const getTimeFromDeparture = (flight) => {
						if (!flight.departure) return "99:99";

						// Versuche zuerst revisedTime.local, dann scheduledTime.local
						const timeString =
							flight.departure.revisedTime?.local ||
							flight.departure.scheduledTime?.local ||
							"99:99";

						// Extrahiere nur die Uhrzeit aus dem ISO-Format (z.B. "2025-06-08 05:50+02:00")
						const match = timeString.match(/\d{2}:\d{2}/);
						return match ? match[0] : "99:99";
					};

					// Wähle die passende Methode je nach verfügbarer Datenstruktur
					const timeA = a.flightPoints
						? getTimeFromFlightPoints(a)
						: getTimeFromDeparture(a);
					const timeB = b.flightPoints
						? getTimeFromFlightPoints(b)
						: getTimeFromDeparture(b);

					return timeA.localeCompare(timeB);
				});

				// Wenn wir Abflüge gefunden haben, nehmen wir den frühesten
				if (departureFlights.length > 0) {
					const firstDeparture = departureFlights[0];

					// Extrahiere Daten je nach API-Format
					let departureTime = "--:--";
					let destCode = "---";

					if (firstDeparture.flightPoints) {
						// Format 1: Flugpunkte-Format
						const departurePoint = firstDeparture.flightPoints?.find(
							(p) => p.departurePoint
						);
						const arrivalPoint = firstDeparture.flightPoints?.find(
							(p) => p.arrivalPoint
						);

						if (departurePoint && arrivalPoint) {
							departureTime =
								departurePoint.departure?.timings?.[0]?.value.substring(0, 5) ||
								"--:--";
							destCode = arrivalPoint.iataCode || "---";
						}
					} else if (firstDeparture.departure && firstDeparture.arrival) {
						// Format 2: Direktes departure/arrival-Format
						const timeString =
							firstDeparture.departure.revisedTime?.local ||
							firstDeparture.departure.scheduledTime?.local ||
							"";

						// Extrahiere nur die Uhrzeit aus dem ISO-Format
						const match = timeString.match(/\d{2}:\d{2}/);
						departureTime = match ? match[0] : "--:--";

						destCode = firstDeparture.arrival.airport?.iata || "---";
					}

					// Das Originalergebnis mit dem gefundenen Abflug ergänzen
					originalResult.departureTime = departureTime;
					originalResult.destCode = destCode;
					originalResult.positionText = `${originalResult.originCode} → ${destCode}`;

					// Die Ergebnisse zusammenführen
					originalResult.data = [...originalResult.data, firstDeparture];

					console.log(
						`[API-FASSADE] Ergebnis mit Folgetagsabflug ergänzt: ${departureTime} nach ${destCode}`
					);
				} else {
					console.log(
						`[API-FASSADE] Keine passenden Abflüge mit den Filterkriterien gefunden.`
					);
				}

				return originalResult;
			}

			// Wenn weder Ankunft noch Abflug gefunden wurden, geben wir das ursprüngliche Ergebnis zurück
			return originalResult;
		} catch (error) {
			console.error("[API-FASSADE] Fehler beim Abrufen der Flugdaten:", error);
			// Fehler weiterreichen für bessere Fehlerbehandlung
			throw error;
		}
	};

	/**
	 * Flugdaten für ein bestimmtes Flugzeug an einem bestimmten Datum abrufen
	 * @param {string} aircraftId - Flugzeugkennung (Registrierung)
	 * @param {string} date - Datum im Format YYYY-MM-DD
	 * @returns {Promise<Object>} Flugdaten
	 */
	const getAircraftFlights = async function (aircraftId, date) {
		console.log(
			`[API-FASSADE] Rufe Einzelflüge ab für Flugzeug: ${aircraftId}, Datum: ${date}`
		);

		try {
			// Dynamic Loading: AeroDataBoxAPI laden falls nicht verfügbar
			if (!window.AeroDataBoxAPI && window.DynamicAPILoader) {
				console.log(
					"[API-FASSADE] Lade AeroDataBoxAPI dynamisch für Einzelflüge..."
				);
				await window.DynamicAPILoader.loadPrimaryAPI();
			}

			// Direkt AeroDataBoxAPI aufrufen
			if (window.AeroDataBoxAPI) {
				return await window.AeroDataBoxAPI.getAircraftFlights(aircraftId, date);
			} else {
				throw new Error(
					"AeroDataBoxAPI ist nicht verfügbar und konnte nicht geladen werden"
				);
			}
		} catch (error) {
			console.error(
				"[API-FASSADE] Fehler beim Abrufen der Einzelflüge:",
				error
			);
			throw error;
		}
	};

	/**
	 * API-Provider ändern - vereinfacht, immer aerodatabox
	 * @param {string} provider - Name des zu aktivierenden Providers (wird ignoriert)
	 */
	const setProvider = function (provider) {
		console.log("[API-FASSADE] Nur AeroDataBox wird unterstützt.");
		return true;
	};

	/**
	 * Aktiven Provider abfragen - immer aerodatabox
	 * @returns {string} Name des aktiven Providers
	 */
	const getActiveProvider = function () {
		return "aerodatabox";
	};

	// Public API - unveränderte Signaturen für Kompatibilität
	return {
		updateAircraftData,
		getAircraftFlights,
		setProvider,
		getActiveProvider,
	};
})();

// Globalen Namespace für API-Zugriff erstellen
window.FlightDataAPI = FlightDataAPI;
