/**
 * airport-flights.js
 * Funktionalität für die Anzeige von Flughafen-Flugplänen im HangarPlanner
 */

const AirportFlights = (() => {
	/**
	 * Zeigt Flugdaten für einen Flughafen im UI an
	 * @param {string} airportCode - IATA-Code des Flughafens
	 * @param {string} [startDateTime=null] - Optional: Startzeit, Standard ist heute 20:00 Uhr
	 * @param {string} [endDateTime=null] - Optional: Endzeit, Standard ist morgen 08:00 Uhr
	 * @param {string} [operatorCode=""] - Optional: ICAO/IATA-Code der Fluggesellschaft für Filterung
	 */
	const displayAirportFlights = async (
		airportCode,
		startDateTime = null,
		endDateTime = null,
		operatorCode = ""
	) => {
		try {
			// Alle Flüge anzeigen (keine Begrenzung)
			const maxFlightsToShow = 100; // Auf einen hohen Wert setzen, um alle Flüge anzuzeigen

			// Standard-Zeitfenster: Heute 20:00 bis morgen 08:00 Uhr
			const now = new Date();
			const today = now.toISOString().split("T")[0];
			const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000)
				.toISOString()
				.split("T")[0];

			startDateTime = startDateTime || `${today}T20:00`;
			endDateTime = endDateTime || `${tomorrow}T08:00`;

			// Hole den aktuell ausgewählten Flughafen, falls keiner übergeben wurde
			if (!airportCode || airportCode.trim() === "") {
				const airportCodeInput = document.getElementById("airportCodeInput");
				airportCode = airportCodeInput?.value || "MUC";
			}

			// Flugdaten abrufen über die AeroDataBoxAPI
			window.AeroDataBoxAPI.updateFetchStatus(
				`Flugdaten für ${airportCode} werden geladen...`
			);

			// Prüfe, ob die API verfügbar ist
			if (!window.AeroDataBoxAPI || !window.AeroDataBoxAPI.getAirportFlights) {
				throw new Error("AeroDataBoxAPI ist nicht verfügbar");
			}

			// API-Anfrage durchführen
			const response = await window.AeroDataBoxAPI.getAirportFlights(
				airportCode,
				startDateTime,
				endDateTime
			);

			console.log("API-Antwort vollständig:", response);

			// Überprüfe und extrahiere die Flugdaten aus der API-Antwort
			let arrivals = [];
			let departures = [];

			if (response && typeof response === "object") {
				// Format: {departures: Array, arrivals: Array}
				if (Array.isArray(response.departures)) {
					departures = response.departures;
					console.log(`${departures.length} Abflüge extrahiert`, departures[0]);
				}
				if (Array.isArray(response.arrivals)) {
					arrivals = response.arrivals;
					console.log(`${arrivals.length} Ankünfte extrahiert`, arrivals[0]);
				}

				// Alternative Formate prüfen
				if (Array.isArray(response)) {
					// Fallback: Wenn response ein Array ist
					const flightData = response;
					arrivals = flightData.filter((flight) => flight.arrival);
					departures = flightData.filter((flight) => flight.departure);
				}
			} else {
				console.warn("API-Antwort hat unerwartetes Format:", response);
				throw new Error("Unerwartete Datenstruktur von der API erhalten");
			}

			// Filtere die Flüge nach dem Operator-Code, falls angegeben
			if (operatorCode && operatorCode.trim() !== "") {
				const operatorCodeUpper = operatorCode.trim().toUpperCase();

				// Filter für Ankünfte
				const originalArrivalsCount = arrivals.length;
				arrivals = arrivals.filter((flight) => {
					// Überprüfe verschiedene mögliche Orte für den Operator-Code:
					const airlineIcao = flight.airline?.icao || "";
					const airlineIata = flight.airline?.iata || "";
					const flightNumber = flight.number || "";

					return (
						airlineIcao.includes(operatorCodeUpper) ||
						airlineIata.includes(operatorCodeUpper) ||
						flightNumber.startsWith(operatorCodeUpper)
					);
				});

				// Filter für Abflüge
				const originalDeparturesCount = departures.length;
				departures = departures.filter((flight) => {
					const airlineIcao = flight.airline?.icao || "";
					const airlineIata = flight.airline?.iata || "";
					const flightNumber = flight.number || "";

					return (
						airlineIcao.includes(operatorCodeUpper) ||
						airlineIata.includes(operatorCodeUpper) ||
						flightNumber.startsWith(operatorCodeUpper)
					);
				});

				console.log(
					`Flüge gefiltert nach Operator ${operatorCodeUpper}: 
					Ankünfte: ${arrivals.length} von ${originalArrivalsCount}
					Abflüge: ${departures.length} von ${originalDeparturesCount}`
				);

				// Statusmeldung aktualisieren
				window.AeroDataBoxAPI.updateFetchStatus(
					`Flüge gefiltert nach Operator ${operatorCodeUpper}: ${
						arrivals.length + departures.length
					} von ${originalArrivalsCount + originalDeparturesCount} Flügen`
				);
            }

            // Prefill missing registrations before rendering
            await prefillMissingRegistrations(arrivals, true, startDateTime);
            await prefillMissingRegistrations(departures, false, startDateTime);

            // Suche den Container für die Anzeige
			const mainContent = document.querySelector("main") || document.body;

			// Bestehende Fluginfos entfernen falls vorhanden
			const existingFlightInfo = document.getElementById(
				"airport-flights-container"
			);
			if (existingFlightInfo) {
				existingFlightInfo.remove();
				console.log("Bestehenden Flug-Container entfernt");
			}

			// Erstelle einen Container für die Fluginfos mit dem Design des Hangarplanners
			const flightInfoContainer = document.createElement("div");
			flightInfoContainer.id = "airport-flights-container";
			flightInfoContainer.className = "section-container fleet-table-container";
			flightInfoContainer.style.marginTop = "2rem";
			flightInfoContainer.style.maxWidth = "100%"; // Maximale Breite
			flightInfoContainer.style.width = "auto"; // Anpassung an Container-Breite
			flightInfoContainer.style.marginLeft = "auto"; // Zentrierung
			flightInfoContainer.style.marginRight = "auto"; // Zentrierung
			// Use CSS for theming (light/dark); avoid inline background-color
			flightInfoContainer.style.borderRadius = "0.5rem";
			flightInfoContainer.style.boxShadow = "0 1px 3px rgba(0,0,0,0.12)";
			flightInfoContainer.style.padding = "1rem";

			// Erstelle einen Titel für den Abschnitt
			const sectionTitle = document.createElement("h2");
			sectionTitle.style.fontSize = "1.25rem";
			sectionTitle.style.fontWeight = "600";
			sectionTitle.style.color = "#3A4354"; // Industrial dark Farbe
			sectionTitle.style.marginBottom = "1rem";
			const labelText =
				operatorCode.trim() !== ""
					? `Flights at ${airportCode} (Operator: ${operatorCode.toUpperCase()})`
					: `Flights at ${airportCode}`;
			sectionTitle.textContent = labelText;
			flightInfoContainer.appendChild(sectionTitle);

			// Container für die Flugdaten
			const flightDataContainer = document.createElement("div");
			flightDataContainer.style.width = "100%";
			flightDataContainer.style.overflowX = "auto";

			// Ankunftsliste als Tabelle
			if (arrivals.length > 0) {
				const arrivalsTitle = document.createElement("h3");
				arrivalsTitle.style.fontSize = "1.125rem";
				arrivalsTitle.style.fontWeight = "500";
				arrivalsTitle.style.color = "#3A4354";
				arrivalsTitle.style.marginBottom = "0.75rem";
				arrivalsTitle.textContent = `Arrivals (${arrivals.length})`;
				flightDataContainer.appendChild(arrivalsTitle);

				// Sortieren der Ankünfte nach Zeit
				arrivals.sort((a, b) => {
					if (
						!a.arrival?.scheduledTime?.local ||
						!b.arrival?.scheduledTime?.local
					)
						return 0;
					return (
						new Date(a.arrival.scheduledTime.local) -
						new Date(b.arrival.scheduledTime.local)
					);
				});

				// Tabelle für Ankünfte erstellen
				const arrivalsTable = document.createElement("table");
				arrivalsTable.className = "flight-table arrivals-table";
				arrivalsTable.style.width = "100%";
				arrivalsTable.style.borderCollapse = "collapse";
				arrivalsTable.style.marginBottom = "2rem";

				// Tabellenkopf erstellen mit geänderter Spaltenreihenfolge
				const tableHead = document.createElement("thead");
				tableHead.innerHTML = `
					<tr>
						<th>Registration</th>
						<th>Flight</th>
						<th>Time (UTC)</th>
						<th>From</th>
						<th>Status</th>
						<th>Actions</th>
					</tr>
				`;
				arrivalsTable.appendChild(tableHead);

				// Tabellenkörper erstellen
				const tableBody = document.createElement("tbody");
				arrivals.forEach((flight) => {
					tableBody.appendChild(createFlightTableRow(flight, true));
				});
				arrivalsTable.appendChild(tableBody);

				flightDataContainer.appendChild(arrivalsTable);
			}

			// Abflugsliste als Tabelle
			if (departures.length > 0) {
				const departuresTitle = document.createElement("h3");
				departuresTitle.style.fontSize = "1.125rem";
				departuresTitle.style.fontWeight = "500";
				departuresTitle.style.color = "#3A4354";
				departuresTitle.style.marginBottom = "0.75rem";
				departuresTitle.textContent = `Departures (${departures.length})`;
				flightDataContainer.appendChild(departuresTitle);

				// Sortieren der Abflüge nach Zeit
				departures.sort((a, b) => {
					if (
						!a.departure?.scheduledTime?.local ||
						!b.departure?.scheduledTime?.local
					)
						return 0;
					return (
						new Date(a.departure.scheduledTime.local) -
						new Date(b.departure.scheduledTime.local)
					);
				});

				// Tabelle für Abflüge erstellen
				const departuresTable = document.createElement("table");
				departuresTable.className = "flight-table departures-table";
				departuresTable.style.width = "100%";
				departuresTable.style.borderCollapse = "collapse";

				// Tabellenkopf erstellen mit geänderter Spaltenreihenfolge
				const tableHead = document.createElement("thead");
				tableHead.innerHTML = `
					<tr>
						<th>Registration</th>
						<th>Flight</th>
						<th>Time (UTC)</th>
						<th>To</th>
						<th>Status</th>
						<th>Actions</th>
					</tr>
				`;
				departuresTable.appendChild(tableHead);

				// Tabellenkörper erstellen - alle Flüge anzeigen
				const tableBody = document.createElement("tbody");
				departures.forEach((flight) => {
					tableBody.appendChild(createFlightTableRow(flight, false));
				});
				departuresTable.appendChild(tableBody);

				flightDataContainer.appendChild(departuresTable);
			}

			// Keine Flüge gefunden
			if (arrivals.length === 0 && departures.length === 0) {
				const noFlightsMessage = document.createElement("p");
				noFlightsMessage.style.textAlign = "center";
				noFlightsMessage.style.color = "#666";
				noFlightsMessage.style.padding = "2rem 0";

				if (operatorCode.trim() !== "") {
					noFlightsMessage.textContent = `Keine Flüge für Operator ${operatorCode.toUpperCase()} am Flughafen ${airportCode} im angegebenen Zeitraum gefunden.`;
				} else {
					noFlightsMessage.textContent = `Keine Flüge für ${airportCode} im angegebenen Zeitraum gefunden.`;
				}

				flightDataContainer.appendChild(noFlightsMessage);
			}

			flightInfoContainer.appendChild(flightDataContainer);

			// CSS-Stile für die Tabellen hinzufügen
			const styleElement = document.createElement("style");
			styleElement.textContent = `
				#airport-flights-container {
					box-sizing: border-box;
				}
				
				#airport-flights-container .flight-table {
					width: 100%;
					border-collapse: collapse;
					margin-bottom: 1.5rem;
					table-layout: auto;
				}
				
				#airport-flights-container .flight-table th,
				#airport-flights-container .flight-table td {
					padding: 0.75rem;
					text-align: left;
					border-bottom: 1px solid #e5e7eb;
					white-space: nowrap;
				}
				
				#airport-flights-container .flight-table th {
					background-color: #f9fafb;
					font-weight: 600;
					color: #374151;
					font-size: 0.875rem;
					text-transform: uppercase;
					letter-spacing: 0.05em;
					position: sticky;
					top: 0;
					z-index: 10;
				}
				
				#airport-flights-container .flight-table tbody tr:nth-child(odd) {
					background-color: #ffffff;
				}
				
				#airport-flights-container .flight-table tbody tr:nth-child(even) {
					background-color: #f9fafb;
				}
				
				#airport-flights-container .flight-table tr:hover {
					background-color: #f3f4f6;
				}
				
				/* Erste Spalte als Hauptelement (Registrierung) */
				#airport-flights-container .flight-reg {
					font-weight: 600;
					color: #111827;
					font-size: 0.95rem;
				}
				
				/* Andere Spalten als Informationselemente */
				#airport-flights-container .flight-number,
				#airport-flights-container .flight-time,
				#airport-flights-container td:nth-child(4) {
					font-weight: 400;
					color: #6b7280;
					font-size: 0.875rem;
				}
				
				#airport-flights-container .flight-status {
					padding: 0.25rem 0.5rem;
					border-radius: 9999px;
					font-size: 0.75rem;
					font-weight: 500;
					display: inline-block;
				}
				
				/* Status-Farben beibehalten */
				#airport-flights-container .status-scheduled {
					background-color: #e5e7eb;
					color: #4b5563;
				}
				
				#airport-flights-container .status-airborne {
					background-color: #dbeafe;
					color: #2563eb;
				}
				
				#airport-flights-container .status-landed {
					background-color: #d1fae5;
					color: #059669;
				}
				
				#airport-flights-container .status-delayed {
					background-color: #fef3c7;
					color: #d97706;
				}
			`;
			document.head.appendChild(styleElement);

			// Hauptbereich finden und den Container einfügen - Breite an Container anpassen
			const hangarContainer = document.querySelector(".hangar-container");
			if (hangarContainer) {
				// Container-Breite auslesen und anwenden
				const hangarContainerStyle = window.getComputedStyle(hangarContainer);
				const contentWidth = hangarContainerStyle.width;

				// Padding des Containers berücksichtigen
				const containerPadding =
					parseFloat(hangarContainerStyle.paddingLeft) +
					parseFloat(hangarContainerStyle.paddingRight);

				// Breite abzüglich des internen Paddings setzen
				if (contentWidth) {
					flightInfoContainer.style.width = contentWidth;
					// Padding des Flight-Containers berücksichtigen
					flightInfoContainer.style.boxSizing = "border-box";
				}

				hangarContainer.appendChild(flightInfoContainer);

				// Nach dem Einfügen zum Container scrollen
				flightInfoContainer.scrollIntoView({
					behavior: "smooth",
					block: "start",
				});
			} else {
				// Fallback: an den Body anhängen
				document.body.appendChild(flightInfoContainer);
			}

			let statusMessage = `Flugdaten für ${airportCode} geladen (${arrivals.length} Ankünfte, ${departures.length} Abflüge)`;
			if (operatorCode.trim() !== "") {
				statusMessage += ` - gefiltert nach Operator ${operatorCode.toUpperCase()}`;
			}
			window.AeroDataBoxAPI.updateFetchStatus(statusMessage);
		} catch (error) {
			console.error("Fehler bei der Anzeige der Flughafen-Daten:", error);

			if (window.AeroDataBoxAPI && window.AeroDataBoxAPI.updateFetchStatus) {
				window.AeroDataBoxAPI.updateFetchStatus(
					`Fehler: ${error.message}`,
					true
				);
			}

			// Fehleranzeige erstellen
			const container = document.getElementById("hangarGrid");
			if (container) {
				const errorDiv = document.createElement("div");
				errorDiv.id = "airport-flights-container";
				errorDiv.style.width = "100%";
				errorDiv.style.margin = "1rem 0";
				errorDiv.style.padding = "1rem";
				errorDiv.style.backgroundColor = "#FEE2E2";
				errorDiv.style.borderRadius = "0.5rem";

				errorDiv.innerHTML = `
                    <div style="color: #DC2626; font-weight: 500;">Fehler beim Laden der Flugdaten für ${airportCode}</div>
                    <div style="font-size: 0.875rem; color: #EF4444;">${error.message}</div>
                `;
				container.after(errorDiv);
			}
		}
	};

	/**
	 * Prefill missing registrations by flight number before rendering the table.
	 * Uses the existing FlightRegistrationLookup.lookupRegistration(flightNumber, date)
	 * to resolve aircraft registrations for flights that don't include it.
	 */
	async function prefillMissingRegistrations(flights, isArrival, startDateTime) {
		try {
			if (!Array.isArray(flights) || flights.length === 0) return;

			// Derive a fallback date from the provided window or UI date selector
			const fallbackDate = (() => {
				try {
					if (startDateTime && typeof startDateTime === 'string' && startDateTime.includes('T')) {
						return startDateTime.split('T')[0];
					}
					const di = document.getElementById('flightDateInput');
					if (di && di.value) return di.value;
				} catch (e) {}
				return new Date().toISOString().split('T')[0];
			})();

			const toNormFlight = (n) => String(n || '').replace(/\s+/g, '').toUpperCase();

			// Collect targets that need a lookup for better logging
			const targets = flights.filter(f => {
				const hasReg = !!(f?.aircraft?.reg || f?.aircraft?.registration || f?.aircraftRegistration || f?.registration);
				return !hasReg && !!f?.number;
			});
			if (targets.length) {
				console.log(`[AirportFlights] Missing registrations to resolve: ${targets.length}`);
			}

			const memo = (function(){
				// Share memo across arrivals + departures and multiple reloads
				if (!window.__RegMemo) window.__RegMemo = new Map();
				return window.__RegMemo;
			})(); // key: FLIGHTNUMBER_YYYY-MM-DD -> registration or null

			async function resolveRegistration(flightNumberRaw, dateStr) {
				const flightNumber = toNormFlight(flightNumberRaw);
				const key = `${flightNumber}_${dateStr}`;
				if (memo.has(key)) return memo.get(key);

				let reg = null;
				// 1) Primary: use existing FlightRegistrationLookup service
				if (window.FlightRegistrationLookup?.lookupRegistration) {
					try {
						reg = await window.FlightRegistrationLookup.lookupRegistration(flightNumber, dateStr);
					} catch (e) {
						console.warn('[AirportFlights] lookupRegistration failed:', e?.message || e);
					}
				}
				// Keep fast: rely on FlightRegistrationLookup's fast path only (no multi-day)

				memo.set(key, reg || null);
				return reg || null;
			}

			// Build a deduplicated, prioritized candidate set
			const candidateMap = new Map(); // key -> { flightNumber, dateStr, timeMs, flights: [] }
			const getTimeMsFromSched = (sched) => {
				try {
					if (sched && typeof sched === 'object') {
						const s = typeof sched.utc === 'string' ? sched.utc : (typeof sched.local === 'string' ? sched.local : null);
						if (s) {
							const t = Date.parse(s);
							if (!isNaN(t)) return t;
						}
					} else if (typeof sched === 'string') {
						const t = Date.parse(sched);
						if (!isNaN(t)) return t;
					}
				} catch (e) {}
				return Number.POSITIVE_INFINITY;
			};

			for (const f of flights) {
				const existingReg = (f && (f.aircraft?.reg || f.aircraft?.registration || f.aircraftRegistration || f.registration));
				if (existingReg && String(existingReg).trim() !== '') continue;

				const flightNumRaw = f?.number;
				if (!flightNumRaw || String(flightNumRaw).trim() === '') continue;

				let dateStr = null;
				const sched = isArrival ? f?.arrival?.scheduledTime : f?.departure?.scheduledTime;
				try {
					if (sched && typeof sched === 'object') {
						if (sched.utc && typeof sched.utc === 'string' && sched.utc.length >= 10) {
							dateStr = sched.utc.substring(0, 10);
						} else if (sched.local && typeof sched.local === 'string' && sched.local.length >= 10) {
							dateStr = sched.local.substring(0, 10);
						}
					} else if (typeof sched === 'string') {
						const d = new Date(sched);
						if (!isNaN(d.getTime())) dateStr = d.toISOString().substring(0, 10);
					}
				} catch (e) {}
				if (!dateStr) dateStr = fallbackDate;

				const timeMs = getTimeMsFromSched(sched);
				const flightNumber = toNormFlight(flightNumRaw);
				const key = `${flightNumber}_${dateStr}`;
				if (!candidateMap.has(key)) {
					candidateMap.set(key, { flightNumber, dateStr, timeMs, flights: [] });
				}
				candidateMap.get(key).flights.push(f);
			}

			const MAX_LOOKUPS = 30;
			const CONCURRENCY = 4;
			const candidates = Array.from(candidateMap.values())
				.sort((a, b) => a.timeMs - b.timeMs)
				.slice(0, MAX_LOOKUPS);

			for (let i = 0; i < candidates.length; i += CONCURRENCY) {
				const batch = candidates.slice(i, i + CONCURRENCY);
				await Promise.all(batch.map(async (c) => {
					try {
						const resolved = await resolveRegistration(c.flightNumber, c.dateStr);
						if (resolved) {
							c.flights.forEach((f) => {
								if (!f.aircraft) f.aircraft = {};
								if (!f.aircraft.reg) f.aircraft.reg = resolved;
								if (!f.aircraftRegistration) f.aircraftRegistration = resolved;
							});
						}
					} catch (e) {
						console.warn('[AirportFlights] Registration resolution failed:', e?.message || e);
					}
				}));
			}
		} catch (e) {
			console.warn('[AirportFlights] prefillMissingRegistrations failed:', e?.message || e);
		}
	}

	/**
	 * Erstellt eine Tabellenzeile für einen Flug
	 * @param {Object} flight - Flugdaten
	 * @param {boolean} isArrival - Handelt es sich um eine Ankunft
	 * @returns {HTMLElement} - Die Tabellenzeile
	 */
	const createFlightTableRow = (flight, isArrival) => {
		const row = document.createElement("tr");

		// Flugdetails extrahieren
		const pointData = isArrival ? flight.arrival : flight.departure;
		const otherPointData = isArrival ? flight.departure : flight.arrival;
		const flightNumber = flight.number || "----";
		const registration =
			flight.aircraft?.reg ||
			flight.aircraft?.registration ||
			flight.aircraftRegistration ||
			flight.registration ||
			"-----";

		// Expose airline codes for client-side filtering (IATA/ICAO)
		const airlineIata = (flight.airline && flight.airline.iata) ? flight.airline.iata : "";
		const airlineIcao = (flight.airline && flight.airline.icao) ? flight.airline.icao : "";
		row.dataset.airlineIata = airlineIata;
		row.dataset.airlineIcao = airlineIcao;

		const otherAirport = isArrival
			? flight.departure?.airport?.iata || "---"
			: flight.arrival?.airport?.iata || "---";

		// Zeitformatierung (display in UTC)
		let timeText = "--:--";
		if (pointData && pointData.scheduledTime) {
			if (
				typeof pointData.scheduledTime === "object" &&
				pointData.scheduledTime.utc
			) {
				// Extract HH:MM from UTC ISO string
				const utcStr = String(pointData.scheduledTime.utc);
				const hhmm = utcStr.substring(11, 16);
				if (/^\d{2}:\d{2}$/.test(hhmm)) timeText = hhmm;
			} else if (typeof pointData.scheduledTime === "string") {
				const d = new Date(pointData.scheduledTime);
				if (!isNaN(d.getTime())) {
					const hh = String(d.getUTCHours()).padStart(2, "0");
					const mm = String(d.getUTCMinutes()).padStart(2, "0");
					timeText = `${hh}:${mm}`;
				}
			}
		}

		// Status bestimmen
		const status =
			pointData && pointData.actualRunway
				? "Landed"
				: pointData && pointData.actualTime
				? "Airborne"
				: pointData && pointData.estimatedRunway
				? "Delayed"
				: "Scheduled";

		// CSS-Klasse für den Status
		const statusClass =
			status === "Gelandet"
				? "status-landed"
				: status === "In der Luft"
				? "status-airborne"
				: status === "Verspätet"
				? "status-delayed"
				: "status-scheduled";

		// Hat die Zeile eine gültige Registrierung?
		const hasReg = registration && registration !== "-----";

		// Beide Zeiten (Arr/Dep) extrahieren für Übergabe an den Hangar
		const extractHHMM = (scheduledTime) => {
			try {
				if (scheduledTime && typeof scheduledTime === 'object' && scheduledTime.local) {
					const m = scheduledTime.local.match(/\d{2}:\d{2}/);
					return m ? m[0] : '';
				}
				if (typeof scheduledTime === 'string') {
					const d = new Date(scheduledTime);
					if (!isNaN(d.getTime())) {
						return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
					}
				}
			} catch (e) {}
			return '';
		};
		const arrHHMM = flight.arrival ? extractHHMM(flight.arrival.scheduledTime) : '';
		const depHHMM = flight.departure ? extractHHMM(flight.departure.scheduledTime) : '';

		// Zelleninhalte erstellen - geänderte Reihenfolge (erst Registrierung, dann Flugnummer) und Action-Spalte
		row.innerHTML = `
			<td>
				<span class="flight-reg">${registration}</span>
			</td>
			<td>
				<span class="flight-number">${flightNumber}</span>
			</td>
			<td>
				<span class="flight-time">${timeText}</span>
			</td>
			<td>${otherAirport}</td>
			<td>
				<span class="flight-status ${statusClass}">${status}</span>
			</td>
			<td>
				${hasReg
					? `<button class=\"text-green-600 hover:text-green-800\" onclick=\"AirportFlights.useInHangar('${registration}','${arrHHMM}','${depHHMM}')\" title=\"In HangarPlanner verwenden\">\n\t\t\t\t\t\t<svg class=\"w-4 h-4\" fill=\"none\" stroke=\"currentColor\" viewBox=\"0 0 24 24\">\n\t\t\t\t\t\t\t<path stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M12 6v6m0 0v6m0-6h6m-6 0H6\"></path>\n\t\t\t\t\t\t</svg>\n\t\t\t\t\t</button>`
					: `<span class=\"text-gray-400\" title=\"Keine Registrierung\">—</span>`}
			</td>
		`;

		return row;
	};

	// Aktion: Flugzeug im HangarPlanner verwenden (wie Fleet Database)
	// ERWEITERT: Arr/Dep Zeiten an die Hauptseite übergeben
	const useInHangar = (registration, arrTime, depTime) => {
		const reg = (registration || "").trim();
		if (!reg || reg === "-----") {
			alert("Registration not available for this flight");
			return;
		}
		// Mark that we should prompt for a target tile on the Hangar page
		localStorage.setItem("selectedAircraft", reg);
		localStorage.setItem("selectedAircraftPrompt", "true");
		// Persist provided times (HH:MM) for pickup on index.html
		if (arrTime && typeof arrTime === 'string' && arrTime.trim()) {
			localStorage.setItem("selectedArrivalTime", arrTime.trim());
		} else {
			localStorage.removeItem("selectedArrivalTime");
		}
		if (depTime && typeof depTime === 'string' && depTime.trim()) {
			localStorage.setItem("selectedDepartureTime", depTime.trim());
		} else {
			localStorage.removeItem("selectedDepartureTime");
		}
		try {
			const params = new URLSearchParams();
			params.set("selectedAircraft", reg);
			if (arrTime && arrTime.trim()) params.set("arr", arrTime.trim());
			if (depTime && depTime.trim()) params.set("dep", depTime.trim());
			params.set("prompt", "1");
			window.location.href = `index.html?${params.toString()}`;
		} catch (e) {
			// Fallback redirect without params
			window.location.href = "index.html";
		}
	};

	/**
	 * Initialisiert die Event-Listener für die Airport-Flights-Funktionalität
	 */
	const init = () => {
		document.addEventListener("DOMContentLoaded", function () {
			// Event-Handler für den "Airport Flights" Button
			const showAirportFlightsBtn = document.getElementById(
				"showAirportFlightsBtn"
			);

			if (showAirportFlightsBtn) {
				// Wenn bereits vorhanden, nicht erneut einfügen
				let operatorInput = document.getElementById("operatorCodeInput");
				if (!operatorInput) {
					// Label + Input im Stil der Fleet-Filter erzeugen
					const operatorLabel = document.createElement("label");
					operatorLabel.setAttribute("for", "operatorCodeInput");
					operatorLabel.className = "block text-sm font-medium text-gray-900 mb-1";
					operatorLabel.textContent = "Airline Code (optional)";

					operatorInput = document.createElement("input");
					operatorInput.type = "text";
					operatorInput.id = "operatorCodeInput";
					operatorInput.placeholder = "z.B. LH, DLH";
					operatorInput.maxLength = "3";
					operatorInput.style.textTransform = "uppercase";
					operatorInput.className =
						"w-full border border-gray-300 rounded-md px-3 py-2 bg-white text-gray-900 uppercase placeholder-gray-500 focus:ring-2 focus:ring-industrial-accent focus:border-industrial-accent";

					const operatorHint = document.createElement("p");
					operatorHint.className = "text-xs text-gray-500 mt-1";
					operatorHint.textContent =
						"Enter an ICAO/IATA code to filter by airline";

					// Falls ein Platzhalter-Container existiert, dort einfügen
					const placeholder = document.getElementById("operatorFilterContainer");
					if (placeholder) {
						placeholder.appendChild(operatorLabel);
						placeholder.appendChild(operatorInput);
						placeholder.appendChild(operatorHint);
					} else {
						// Fallback: vor dem Button einfügen (mit eigener Box)
						const operatorInputContainer = document.createElement("div");
						operatorInputContainer.className = "w-full md:w-auto";
						operatorInputContainer.appendChild(operatorLabel);
						operatorInputContainer.appendChild(operatorInput);
						operatorInputContainer.appendChild(operatorHint);
						showAirportFlightsBtn.parentNode.insertBefore(
							operatorInputContainer,
							showAirportFlightsBtn
						);
					}
				}

				// Event-Handler für den Button aktualisieren
				showAirportFlightsBtn.addEventListener("click", function () {
					const airportCodeInput = document.getElementById("airportCodeInput");
					const airportCode = airportCodeInput?.value || "MUC";

					// Operator-Code aus dem Eingabefeld auslesen
					const operatorCodeInput =
						document.getElementById("operatorCodeInput");
					const operatorCode = operatorCodeInput?.value || "";

					// Datum lesen und Zeitfenster setzen (ganzer Tag)
					const dateInput = document.getElementById("flightDateInput");
					const selectedDate = dateInput?.value || null;
					let startDateTime = null;
					let endDateTime = null;
					if (selectedDate) {
						// Use the API-compliant 12h window: 20:00 on selected day to 08:00 next day
						const d = new Date(selectedDate + 'T00:00:00');
						const next = new Date(d);
						next.setDate(d.getDate() + 1);
						const toISODate = (dt) => dt.toISOString().split('T')[0];
						startDateTime = `${toISODate(d)}T20:00`;
						endDateTime = `${toISODate(next)}T08:00`;
					}

					// Call with computed 12h window + operator filter
					displayAirportFlights(airportCode, startDateTime, endDateTime, operatorCode);
				});
			}
		});
	};

	// Initialisierung ausführen
	init();

	// Public API
	return {
		displayAirportFlights,
		init,
		useInHangar,
	};
})();

// Globalen Namespace für Airport-Flights-Zugriff erstellen
window.AirportFlights = AirportFlights;
