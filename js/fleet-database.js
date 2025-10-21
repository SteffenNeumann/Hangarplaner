/**
 * Fleet Database - Flotten-Datenbank für CLH und LHX
 * Lädt und verwaltet Flugzeugdaten über die AeroDataBox API
 */

const FleetDatabase = (function () {
	// Konfiguration
	const config = {
		rapidApiKey: "b76afbf516mshf864818d919de86p10475ejsna65b718a8602",
		rapidApiHost: "aerodatabox.p.rapidapi.com",
		baseUrl: "https://aerodatabox.p.rapidapi.com",
		airlines: {
			// Verschiedene Lufthansa-Codes testen
			CLH: {
				code: "CLH",
				name: "Lufthansa CityLine",
				color: "#0066CC",
				alternatives: ["CL", "LHC", "CityLine"],
			},
			LHX: {
				code: "LHX",
				name: "Lufthansa Private Jet",
				color: "#FFD700",
				alternatives: ["LH", "DLH", "Lufthansa"],
			},
			// Zusätzliche Test-Airlines
			DLH: {
				code: "DLH",
				name: "Deutsche Lufthansa AG",
				color: "#FFD700",
				alternatives: ["LH"],
			},
			LH: {
				code: "LH",
				name: "Lufthansa",
				color: "#FFD700",
				alternatives: ["DLH"],
			},
		},
		pageSize: 10, // API-Limit: Werte zwischen 0 und 10
		rateLimitDelay: 2000, // Erhöht auf 2 Sekunden
	};

	// Interne Datenstrukturen
	let fleetData = [];
	let filteredData = [];
	let sortOrder = { column: "airline", direction: "asc" };
	let lastApiCall = 0;
	let isLoading = false; // Load Protection Flag

	// API Rate Limit Tracking
	window.FleetDatabase = window.FleetDatabase || {};
	window.FleetDatabase.apiQuotaExceeded = false;

	/**
	 * Check if error is a rate limit (429) error
	 */
	function isRateLimitError(e) {
		return e && (e.status === 429 || e.isRateLimit === true);
	}

	// DOM-Elemente
	let elements = {};

	/**
	 * Initialisierung der Fleet Database
	 */
	function init() {
		console.log("🛩️ Fleet Database wird initialisiert...");

		// DOM-Elemente referenzieren
		elements = {
			loadButton: document.getElementById("loadFleetData"),
			exportButton: document.getElementById("exportFleetData"),
			airlineFilter: document.getElementById("airlineFilter"),
			aircraftTypeFilter: document.getElementById("aircraftTypeFilter"),
			searchFilter: document.getElementById("searchFilter"),
			fleetStatus: document.getElementById("fleetStatus"),
			fleetCount: document.getElementById("fleetCount"),
			fleetTable: document.getElementById("fleetTable"),
			fleetTableBody: document.getElementById("fleetTableBody"),
			fleetTableEmpty: document.getElementById("fleetTableEmpty"),
			fleetTableLoading: document.getElementById("fleetTableLoading"),
		};

		// Event-Listener einrichten
		setupEventListeners();

		// Initial leere Tabelle anzeigen
		showEmptyState();

		console.log("✅ Fleet Database initialisiert");

		// Debug: Zeige aktuellen Status
		console.log("🔍 Fleet Database Debug Info:", {
			fleetDataLength: fleetData.length,
			filteredDataLength: filteredData.length,
			hasFleetManager: !!window.fleetDatabaseManager,
			managerInitialized: window.fleetDatabaseManager?.isInitialized,
		});

		// TESTING: Button für manuelles Laden
		console.log("🔘 Load Button verfügbar:", !!elements.loadButton);

		// DIREKTES RACE CONDITION FIX: Prüfe sofort nach der Initialisierung
		// Entferne überflüssigen Init-Check
		// setTimeout(() => {
		// 	console.log(
		// 		"🚀 INIT: Prüfe FleetDatabaseManager direkt nach FleetDatabase.init()"
		// 	);
		// 	if (
		// 		window.fleetDatabaseManager &&
		// 		window.fleetDatabaseManager.isInitialized
		// 	) {
		// 		console.log(
		// 			"✅ INIT: FleetDatabaseManager bereit - starte automatische Datenladung"
		// 		);
		// 		loadFleetData();
		// 	} else {
		// 		console.log("⏳ INIT: FleetDatabaseManager noch nicht bereit");
		// 	}
		// }, 50);
	}

	/**
	 * Event-Listener einrichten
	 */
	function setupEventListeners() {
		// Laden-Button
		if (elements.loadButton) {
			elements.loadButton.addEventListener("click", loadFleetData);
		}

		// Export-Button
		if (elements.exportButton) {
			elements.exportButton.addEventListener("click", exportFleetData);
		}

		// Test-Button
		const testButton = document.getElementById("testAPI");
		if (testButton) {
			testButton.addEventListener("click", testAPIConnection);
		}

		// Filter-Event-Listener
		if (elements.airlineFilter) {
			elements.airlineFilter.addEventListener("change", applyFilters);
		}

		if (elements.aircraftTypeFilter) {
			elements.aircraftTypeFilter.addEventListener("change", applyFilters);
		}

		if (elements.searchFilter) {
			elements.searchFilter.addEventListener(
				"input",
				debounce(applyFilters, 300)
			);
		}

		// Sortier-Event-Listener für Tabellenspalten
		const sortableHeaders = document.querySelectorAll("[data-sort]");
		sortableHeaders.forEach((header) => {
			header.addEventListener("click", () => {
				const column = header.getAttribute("data-sort");
				sortData(column);
			});
		});
	}

	/**
	 * Flottendaten für beide Airlines laden - MIT SERVERSEITIGER DATENBANK
	 */
	async function loadFleetData() {
		console.log("📡 loadFleetData() aufgerufen!");

		// Load Protection: Verhindere mehrfache parallele Ladungen
		if (isLoading) {
			console.log("⏳ Datenladung bereits im Gange - überspringe...");
			return;
		}

		isLoading = true;
		console.log("📡 Starte das Laden der Flottendaten...");

		showLoadingState();
		updateStatus("Lade Flottendaten...");

		try {
			// Prüfe ob Fleet Database Manager verfügbar ist
			if (!window.fleetDatabaseManager) {
				console.error("❌ Fleet Database Manager nicht verfügbar");
				throw new Error("Fleet Database Manager nicht initialisiert");
			}

			// Warte bis Fleet Database Manager initialisiert ist
			updateStatus("Warte auf Fleet Database Initialisierung...");
			console.log("⏳ Warte auf Fleet Database Manager Initialisierung...");

			await window.fleetDatabaseManager.waitForInitialization();
			console.log("✅ Fleet Database Manager ist bereit");

			// Prüfe ob bereits Daten in der Datenbank vorhanden sind
			const stats = window.fleetDatabaseManager.getStatistics();
			console.log("📊 Fleet Database Status:", stats);

			if (stats.totalAircrafts > 0) {
				// Daten aus der Datenbank laden
				updateStatus("Lade vorhandene Daten aus der Fleet-Datenbank...");
				const cachedData = window.fleetDatabaseManager.getFleetData();
				console.log("🔍 CACHED DATA STRUCTURE:", cachedData);

				// Daten für die Tabelle konvertieren
				fleetData = convertFleetDataForTable(cachedData);
				console.log("🔍 CONVERTED FLEET DATA:", fleetData);
				console.log("🔍 FLEET DATA LENGTH:", fleetData.length);

				updateStatus(
					`${fleetData.length} Flugzeuge aus der Datenbank geladen. Prüfe API-Aktualisierung...`
				);
				console.log(`📥 ${fleetData.length} Flugzeuge aus dem Cache geladen`);

				// Prüfe ob API-Aktualisierung nötig ist (nur alle 4 Wochen)
				const lastSync = stats.lastApiSync || 0;
				const now = Date.now();
				const syncInterval = 28 * 24 * 60 * 60 * 1000; // 28 Tage (4 Wochen)
				const needsSync = now - lastSync > syncInterval;

				if (needsSync) {
					console.log(
						"🔄 API-Synchronisation wird durchgeführt (letzte Sync vor >4 Wochen)..."
					);

					// API-Daten laden für Abgleich
					console.log("📡 Starte API-Datenabgleich...");
					const apiData = await loadAllFleetDataFromAPI();
					console.log("📊 API-Daten erhalten:", apiData);

					// Check if API returned empty due to 429 rate limit
					const apiIsEmpty =
						!apiData ||
						!apiData.airlines ||
						Object.keys(apiData.airlines).length === 0;

					if (apiIsEmpty && window.FleetDatabase.apiQuotaExceeded) {
						console.warn(
							"[FleetDB] 429 fallback active. Skipping API sync and keeping cached data."
						);
						const msg =
							"⚠️ AeroDataBox API quota exceeded. Showing cached fleet data (may not be up-to-date).";
						updateStatus(msg);
						// Keep existing cached fleetData; do NOT overwrite DB
						// Continue with rendering the cached data below
					} else {
						// Normal path: Differential-Synchronisation durchführen (ohne neue Datenladung)
						console.log("🔄 Starte Differential-Synchronisation...");
						await window.fleetDatabaseManager.syncWithApiData(apiData, {
							skipReload: true,
						});

						// Aktualisierte Daten laden (nur einmal)
						const updatedData = window.fleetDatabaseManager.getFleetData();
						fleetData = convertFleetDataForTable(updatedData);
						console.log("✅ Synchronisation abgeschlossen");
					}
				} else {
					console.log(
						"⏭️ API-Synchronisation übersprungen (letzte Sync < 4 Wochen)"
					);
				}
			} else {
				// Erste Ladung - Daten von API holen und Datenbank füllen
				updateStatus("Erste Synchronisation - lade Daten von der API...");
				console.log("🆕 Erste Synchronisation wird durchgeführt...");

				const apiData = await loadAllFleetDataFromAPI();
				console.log("📊 API-Daten für Erst-Synchronisation erhalten:", apiData);

				// Check if API returned empty due to 429 rate limit
				const apiIsEmpty =
					!apiData ||
					!apiData.airlines ||
					Object.keys(apiData.airlines).length === 0;

				if (apiIsEmpty && window.FleetDatabase.apiQuotaExceeded) {
					console.warn(
						"[FleetDB] 429 on first sync. Cannot load initial data from API."
					);
					const msg =
						"⚠️ AeroDataBox API quota exceeded. Unable to load initial fleet data. Please try again later.";
					updateStatus(msg);
					// No cached data available for first load; show empty state
					fleetData = [];
				} else {
					// Normal path: Daten in der serverseitigen Datenbank speichern
					console.log("💾 Speichere Daten in der Fleet Database...");
					await window.fleetDatabaseManager.syncWithApiData(apiData);

					// Daten für die Tabelle laden
					const savedData = window.fleetDatabaseManager.getFleetData();
					fleetData = convertFleetDataForTable(savedData);
					console.log("✅ Daten erfolgreich in Fleet Database gespeichert");
				}
			}

			console.log(`✅ ${fleetData.length} Flugzeuge verfügbar`);
			updateStatus(`${fleetData.length} Flugzeuge erfolgreich geladen`);

			// Flugzeugtypen für Filter extrahieren
			updateAircraftTypeFilter();

			// Airline-Filter aktualisieren
			updateAirlineFilter();

			// Tabelle aktualisieren
			applyFilters();
		} catch (error) {
			console.error("❌ Fehler beim Laden der Flottendaten:", error);
			console.error("📄 Error Stack:", error.stack);
			updateStatus("Fehler beim Laden der Flottendaten: " + error.message);
			showEmptyState();
		} finally {
			// Load Protection zurücksetzen
			isLoading = false;
			console.log("🔓 Datenladung abgeschlossen - Load Protection deaktiviert");
		}
	}

	/**
	 * Alle Flottendaten von der API laden (für Synchronisation)
	 */
	async function loadAllFleetDataFromAPI() {
		console.log("📡 Starte API-Datenladung...");
		const apiData = {
			airlines: {},
		};

		try {
			// Early exit if quota already exceeded
			if (window.FleetDatabase.apiQuotaExceeded) {
				console.warn(
					"[FleetDB] API quota already exceeded. Returning empty airlines object."
				);
				return { airlines: {} };
			}

			// CLH Flotte laden
			updateStatus("Lade CLH (Lufthansa CityLine) Flotte von API...");
			console.log("📡 Lade CLH Flotte...");
			const clhData = await loadSimpleAirlineFleet("CLH");
			console.log(`📊 CLH: ${clhData.length} Flugzeuge erhalten`);

			if (clhData.length > 0) {
				apiData.airlines.CLH = {
					name: "Lufthansa CityLine",
					color: "#0066CC",
					aircrafts: clhData,
				};
			}

			// LHX Flotte laden
			updateStatus("Lade LHX (Lufthansa Private Jet) Flotte von API...");
			console.log("📡 Lade LHX Flotte...");
			const lhxData = await loadSimpleAirlineFleet("LHX");
			console.log(`📊 LHX: ${lhxData.length} Flugzeuge erhalten`);

			if (lhxData.length > 0) {
				apiData.airlines.LHX = {
					name: "Lufthansa Private Jet",
					color: "#FFD700",
					aircrafts: lhxData,
				};
			}

		console.log(
			`📊 API-Daten geladen: CLH=${clhData.length}, LHX=${lhxData.length}`
		);
		console.log("📊 API-Daten Struktur:", apiData);
		return apiData;
	} catch (error) {
		// Handle 429 rate limit errors gracefully
		if (isRateLimitError(error) || window.FleetDatabase.apiQuotaExceeded) {
			console.warn(
				"[FleetDB] 429 rate limit in loadAllFleetDataFromAPI(). Returning empty airlines object."
			);
			return { airlines: {} };
		}
		console.error("❌ Fehler beim Laden der API-Daten:", error);
		throw error;
	}
}

	/**
	 * Konvertiert Fleet Database Daten für die Tabellen-Anzeige
	 */
	function convertFleetDataForTable(fleetDbData) {
		console.log("🔄 convertFleetDataForTable aufgerufen mit:", fleetDbData);
		const tableData = [];

		if (
			!fleetDbData ||
			!fleetDbData.fleetDatabase ||
			!fleetDbData.fleetDatabase.airlines
		) {
			console.log("⚠️ Fehlende Datenstruktur in convertFleetDataForTable");
			return tableData;
		}

		const airlines = fleetDbData.fleetDatabase.airlines;
		console.log("✈️ Airlines gefunden:", Object.keys(airlines));

		for (const [airlineCode, airline] of Object.entries(airlines)) {
			console.log(`🔍 Verarbeite Airline ${airlineCode}:`, airline);
			if (airline.aircrafts && Array.isArray(airline.aircrafts)) {
				console.log(
					`✈️ ${airline.aircrafts.length} Flugzeuge in ${airlineCode}`
				);
				for (const aircraft of airline.aircrafts) {
					tableData.push({
						...aircraft,
						airline: airlineCode,
						airlineName: airline.name,
						airlineColor: airline.color,
					});
				}
			}
		}

		console.log(
			`✅ convertFleetDataForTable: ${tableData.length} Flugzeuge konvertiert`
		);
		return tableData;
	}

	/**
	 * Alle Seiten einer Airline-Flotte laden (erweitert für vollständige Datenerfassung)
	 */
	async function loadSimpleAirlineFleet(airlineCode) {
		const allAircrafts = [];
		let pageOffset = 0;
		let hasMoreData = true;
		const pageSize = config.pageSize; // Verwende API-konforme pageSize (max 10)

		console.log(`📡 Lade ${airlineCode} Flotte (alle Seiten)...`);

		while (hasMoreData) {
			const url = `${config.baseUrl}/airlines/${airlineCode}/aircrafts?pageSize=${pageSize}&pageOffset=${pageOffset}&withRegistrations=false`;

			console.log(`📡 Lade Seite: ${url}`);

			// Rate Limiting
			await rateLimitDelay();

			try {
				const pageData = await loadSinglePage(url, airlineCode);

				if (pageData && pageData.length > 0) {
					allAircrafts.push(...pageData);
					pageOffset += pageSize;
					console.log(
						`📊 ${airlineCode}: ${
							pageData.length
						} Flugzeuge auf Seite ${Math.floor(
							pageOffset / pageSize
						)} geladen. Gesamt: ${allAircrafts.length}`
					);

					// Wenn weniger als pageSize zurückgegeben wird, sind wir am Ende
					if (pageData.length < pageSize) {
						hasMoreData = false;
					}
				} else {
					hasMoreData = false;
				}
			} catch (error) {
				// Handle 429 rate limit errors gracefully
				if (isRateLimitError(error)) {
					window.FleetDatabase.apiQuotaExceeded = true;
					console.warn(
						`[FleetDB] 429 rate limit in loadSimpleAirlineFleet(${airlineCode}). Returning ${allAircrafts.length} aircrafts loaded so far.`
					);
					hasMoreData = false;
					// Return what we have so far instead of throwing
					break;
				}
				console.error(
					`❌ Fehler beim Laden der Seite für ${airlineCode}:`,
					error
				);
				hasMoreData = false;
			}
		}

		console.log(
			`✅ ${airlineCode}: Insgesamt ${allAircrafts.length} Flugzeuge geladen`
		);
		return allAircrafts;
	}

	/**
	 * Einzelne Seite der API laden
	 */
	async function loadSinglePage(url, airlineCode) {
		return new Promise((resolve, reject) => {
			const xhr = new XMLHttpRequest();
			xhr.withCredentials = true;

			xhr.addEventListener("readystatechange", function () {
				if (this.readyState === this.DONE) {
					console.log(`📊 ${airlineCode} Response Status: ${this.status}`);

					// Handle 429 Rate Limit Error
					if (this.status === 429) {
						window.FleetDatabase.apiQuotaExceeded = true;
						const bodyText = this.responseText || "";
						console.warn(
							`[FleetDB] AeroDataBox 429 rate limit for ${airlineCode}. Falling back to cached data.`
						);
						console.warn(`[FleetDB] 429 response body:`, bodyText);
						const err = new Error(`HTTP 429 for ${airlineCode}`);
						err.status = 429;
						err.isRateLimit = true;
						err.body = bodyText;
						reject(err);
						return;
					}

					if (this.status === 200) {
						try {
							const data = JSON.parse(this.responseText);
							console.log(`✅ ${airlineCode} API-Antwort:`, data);

							// KORREKTUR: Verschiedene Datenstrukturen handhaben
							let aircrafts = [];
							if (data.items) {
								// AeroDataBox Format: { items: [...] }
								aircrafts = data.items;
							} else if (data.aircrafts) {
								// Alternatives Format: { aircrafts: [...] }
								aircrafts = data.aircrafts;
							} else if (Array.isArray(data)) {
								// Direktes Array
								aircrafts = data;
							} else {
								console.warn(
									`⚠️ Unbekannte Datenstruktur für ${airlineCode}:`,
									data
								);
								aircrafts = [];
							}

							const processedAircrafts = aircrafts.map((aircraft) => {
								// Berechne Alter in Jahren
								const currentYear = new Date().getFullYear();
								const manufactYear =
									parseInt(aircraft.manufacturingYear) ||
									parseInt(aircraft.deliveryDate?.split("-")[0]) ||
									null;
								const ageYears = manufactYear
									? currentYear - manufactYear
									: "Unknown";

								return {
									...aircraft,
									airline: airlineCode,
									airlineName:
										config.airlines[airlineCode]?.name || airlineCode,
									airlineColor:
										config.airlines[airlineCode]?.color || "#666666",
									registration:
										aircraft.registration ||
										aircraft.reg ||
										aircraft.tail ||
										"Unknown",
									aircraftType:
										aircraft.aircraftType ||
										aircraft.model ||
										aircraft.typeName ||
										"Unknown",
									serial:
										aircraft.serial ||
										aircraft.serialNumber ||
										aircraft.msn ||
										"Unknown",
									numSeats:
										aircraft.numSeats ||
										aircraft.seatCount ||
										aircraft.maxSeats ||
										"Unknown",
									manufacturingYear: manufactYear || "Unknown",
									firstFlightDate:
										aircraft.firstFlightDate ||
										aircraft.firstFlight ||
										"Unknown",
									deliveryDate:
										aircraft.deliveryDate || aircraft.delivery || "Unknown",
									registrationDate:
										aircraft.registrationDate || aircraft.regDate || "Unknown",
									ageYears: ageYears,
								};
							});

							resolve(processedAircrafts);
						} catch (parseError) {
							console.error(`❌ ${airlineCode} JSON Parse Error:`, parseError);
							reject(
								new Error(
									`JSON Parse Error für ${airlineCode}: ${parseError.message}`
								)
							);
						}
					} else {
						console.error(
							`❌ ${airlineCode} HTTP Error: ${this.status} ${this.statusText}`
						);
						console.error(
							`❌ ${airlineCode} Error Response:`,
							this.responseText
						);
						reject(
							new Error(
								`HTTP ${this.status} für ${airlineCode}: ${this.statusText} - ${this.responseText}`
							)
						);
					}
				}
			});

			xhr.open("GET", url);
			xhr.setRequestHeader("x-rapidapi-key", config.rapidApiKey);
			xhr.setRequestHeader("x-rapidapi-host", config.rapidApiHost);

			xhr.send(null);
		});
	}

	/**
	 * Testet verschiedene API-Endpoints um den korrekten zu finden
	 */
	async function testApiEndpoints() {
		console.log("🧪 Teste API-Endpoints...");

		const testEndpoints = [
			"/airlines/CLH",
			"/airlines/CLH/fleet",
			"/airlines/CLH/aircrafts",
			"/operators/CLH/aircrafts",
			"/airlines/DLH",
			"/airlines/LH",
		];

		for (const endpoint of testEndpoints) {
			try {
				const url = `${config.baseUrl}${endpoint}`;
				console.log(`🔍 Teste Endpoint: ${url}`);

				await rateLimitDelay();
				const response = await fetch(url, {
					method: "GET",
					headers: {
						"X-RapidAPI-Key": config.rapidApiKey,
						"X-RapidAPI-Host": config.rapidApiHost,
					},
				});

				console.log(
					`📊 ${endpoint}: Status ${response.status} ${response.statusText}`
				);

				if (response.ok) {
					const data = await response.json();
					console.log(`✅ ${endpoint} funktioniert:`, data);

					// Detaillierte Analyse der Datenstruktur
					if (data) {
						console.log(`📋 Datenstruktur-Analyse für ${endpoint}:`);
						console.log(`   - Typ: ${typeof data}`);
						console.log(`   - Ist Array: ${Array.isArray(data)}`);
						console.log(`   - Keys:`, Object.keys(data));
						if (data.aircrafts) {
							console.log(`   - Anzahl Flugzeuge: ${data.aircrafts.length}`);
						}
					}
				} else {
					// Fehlerdetails ausgeben
					try {
						const errorData = await response.json();
						console.log(`❌ ${endpoint} Fehler-Details:`, errorData);
					} catch (e) {
						const errorText = await response.text();
						console.log(`❌ ${endpoint} Fehler-Text:`, errorText);
					}
				}
			} catch (error) {
				console.log(`❌ ${endpoint} Netzwerk-Fehler:`, error.message);
			}
		}
	}

	/**
	 * Flotte einer bestimmten Airline laden
	 */
	async function loadAirlineFleet(airlineCode) {
		console.log(`📡 Lade ${airlineCode} Flotte...`);

		// SCHRITT 2: Verschiedene URL-Varianten testen
		const urlVariants = [
			`${config.baseUrl}/airlines/${airlineCode}/aircrafts`,
			`${config.baseUrl}/airlines/${airlineCode}/fleet`,
			`${config.baseUrl}/operators/${airlineCode}/aircrafts`,
			`${config.baseUrl}/airlines/${airlineCode}`,
		];

		for (let i = 0; i < urlVariants.length; i++) {
			const url = urlVariants[i];
			console.log(`� Teste URL ${i + 1}/${urlVariants.length}: ${url}`);

			await rateLimitDelay();

			try {
				const response = await fetch(url, {
					method: "GET",
					headers: {
						"X-RapidAPI-Key": config.rapidApiKey,
						"X-RapidAPI-Host": config.rapidApiHost,
					},
				});

				console.log(
					`📊 ${airlineCode} Response Status: ${response.status} ${response.statusText}`
				);

				if (response.ok) {
					const data = await response.json();
					console.log(`✅ ${airlineCode} API-Antwort von ${url}:`, data);

					// Verschiedene Datenstrukturen handhaben
					let aircrafts = [];
					if (data.aircrafts) {
						aircrafts = data.aircrafts;
					} else if (Array.isArray(data)) {
						aircrafts = data;
					} else if (data.fleet) {
						aircrafts = data.fleet;
					} else {
						console.log(
							`⚠️ Unbekannte Datenstruktur für ${airlineCode}:`,
							data
						);
						aircrafts = [];
					}

					console.log(
						`📊 ${airlineCode}: ${aircrafts.length} Flugzeuge gefunden`
					);

					return aircrafts.map((aircraft) => ({
						...aircraft,
						airline: airlineCode,
						airlineName: config.airlines[airlineCode]?.name || airlineCode,
						airlineColor: config.airlines[airlineCode]?.color || "#666666",
						registration:
							aircraft.registration ||
							aircraft.reg ||
							aircraft.tail ||
							"Unknown",
					}));
				} else {
					// Detaillierte Fehleranalyse
					let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
					try {
						const errorData = await response.json();
						errorMessage += ` - ${JSON.stringify(errorData)}`;
					} catch (e) {
						const errorText = await response.text();
						errorMessage += ` - ${errorText}`;
					}
					console.error(
						`❌ API-Fehler für ${airlineCode} (${url}): ${errorMessage}`
					);

					// Nur bei der letzten URL einen Fehler werfen
					if (i === urlVariants.length - 1) {
						throw new Error(
							`Alle API-Endpoints fehlgeschlagen für ${airlineCode}: ${errorMessage}`
						);
					}
				}
			} catch (error) {
				console.error(`❌ Netzwerk-Fehler für ${airlineCode} (${url}):`, error);

				// Nur bei der letzten URL einen Fehler werfen
				if (i === urlVariants.length - 1) {
					throw error;
				}
			}
		}

		// Fallback: Leeres Array zurückgeben
		console.warn(
			`⚠️ Keine Daten für ${airlineCode} gefunden, verwende leeres Array`
		);
		return [];
	}

	/**
	 * Rate Limiting für API-Aufrufe
	 */
	async function rateLimitDelay() {
		const now = Date.now();
		const timeSinceLastCall = now - lastApiCall;

		if (timeSinceLastCall < config.rateLimitDelay) {
			const waitTime = config.rateLimitDelay - timeSinceLastCall;
			console.log(`⏱️ Rate Limiting: Warte ${waitTime}ms...`);
			await new Promise((resolve) => setTimeout(resolve, waitTime));
		}

		lastApiCall = Date.now();
	}

	/**
	 * Filter anwenden
	 */
	function applyFilters() {
		console.log("🔍 applyFilters() aufgerufen");
		console.log("📊 fleetData.length:", fleetData.length);
		let filtered = [...fleetData];

		// Airline-Filter
		const airlineFilter = elements.airlineFilter?.value;
		if (airlineFilter && airlineFilter !== "all") {
			filtered = filtered.filter(
				(aircraft) => aircraft.airline === airlineFilter
			);
		}

		// Flugzeugtyp-Filter
		const typeFilter = elements.aircraftTypeFilter?.value;
		if (typeFilter && typeFilter !== "all") {
			filtered = filtered.filter(
				(aircraft) =>
					aircraft.aircraftType === typeFilter || aircraft.model === typeFilter
			);
		}

		// Such-Filter
		const searchTerm = elements.searchFilter?.value?.toLowerCase();
		if (searchTerm) {
			filtered = filtered.filter(
				(aircraft) =>
					aircraft.registration?.toLowerCase().includes(searchTerm) ||
					aircraft.aircraftType?.toLowerCase().includes(searchTerm) ||
					aircraft.model?.toLowerCase().includes(searchTerm) ||
					aircraft.airlineName?.toLowerCase().includes(searchTerm)
			);
		}

		filteredData = filtered;
		console.log("📊 Nach Filterung: filteredData.length:", filteredData.length);

		// Sortierung anwenden
		applySorting();

		// Tabelle aktualisieren
		console.log("🔄 Rufe renderFleetTable() auf...");
		renderFleetTable();

		// Anzahl aktualisieren
		updateFleetCount(filteredData.length, fleetData.length);
	}

	/**
	 * Sortierung anwenden
	 */
	function applySorting() {
		const { column, direction } = sortOrder;

		filteredData.sort((a, b) => {
			let valueA = a[column] || "";
			let valueB = b[column] || "";

			// Numerische Werte für bestimmte Spalten
			if (
				column === "manufacturingYear" ||
				column === "ageYears" ||
				column === "numSeats"
			) {
				valueA = parseInt(valueA) || 0;
				valueB = parseInt(valueB) || 0;
			} else if (
				column === "firstFlightDate" ||
				column === "deliveryDate" ||
				column === "registrationDate"
			) {
				// Datum-Sortierung
				valueA = new Date(valueA || "1900-01-01").getTime();
				valueB = new Date(valueB || "1900-01-01").getTime();
			} else {
				// String-Vergleich
				valueA = valueA.toString().toLowerCase();
				valueB = valueB.toString().toLowerCase();
			}

			let comparison = 0;
			if (valueA < valueB) comparison = -1;
			if (valueA > valueB) comparison = 1;

			return direction === "asc" ? comparison : -comparison;
		});
	}

	/**
	 * Sortierung für eine Spalte ändern
	 */
	function sortData(column) {
		if (sortOrder.column === column) {
			// Richtung umkehren wenn gleiche Spalte
			sortOrder.direction = sortOrder.direction === "asc" ? "desc" : "asc";
		} else {
			// Neue Spalte, standardmäßig aufsteigend
			sortOrder.column = column;
			sortOrder.direction = "asc";
		}

		// Sortier-Indikatoren aktualisieren
		updateSortIndicators();

		// Filter erneut anwenden (mit neuer Sortierung)
		applyFilters();
	}

	/**
	 * Sortier-Indikatoren in Tabellenkopf aktualisieren
	 */
	function updateSortIndicators() {
		const headers = document.querySelectorAll("[data-sort]");
		headers.forEach((header) => {
			const indicator = header.querySelector(".sort-indicator");
			const column = header.getAttribute("data-sort");

			if (column === sortOrder.column) {
				indicator.textContent = sortOrder.direction === "asc" ? "↑" : "↓";
				header.classList.add("bg-blue-100");
			} else {
				indicator.textContent = "↕";
				header.classList.remove("bg-blue-100");
			}
		});
	}

	/**
	 * Flugzeugtyp-Filter aktualisieren
	 */
	function updateAircraftTypeFilter() {
		if (!elements.aircraftTypeFilter) return;

		// Eindeutige Flugzeugtypen extrahieren
		const types = [
			...new Set(
				fleetData.map((aircraft) => aircraft.aircraftType).filter(Boolean)
			),
		];
		types.sort();

		// Filter-Optionen aktualisieren
		elements.aircraftTypeFilter.innerHTML =
			'<option value="all">Alle Typen</option>';
		types.forEach((type) => {
			const option = document.createElement("option");
			option.value = type;
			option.textContent = type;
			elements.aircraftTypeFilter.appendChild(option);
		});

		// Airline-Filter auch dynamisch aktualisieren
		updateAirlineFilter();
	}

	/**
	 * Airline-Filter mit gefundenen Airlines aktualisieren
	 */
	function updateAirlineFilter() {
		if (!elements.airlineFilter) return;

		/**
		 * Airline-Filter aktualisieren basierend auf geladenen Daten
		 */
		function updateAirlineFilter() {
			if (!elements.airlineFilter) return;

			// Eindeutige Airlines extrahieren
			const airlines = [
				...new Set(
					fleetData.map((aircraft) => aircraft.airline).filter(Boolean)
				),
			];
			airlines.sort();

			// Filter-Optionen aktualisieren
			elements.airlineFilter.innerHTML =
				'<option value="all">Alle Airlines</option>';
			airlines.forEach((airlineCode) => {
				const option = document.createElement("option");
				option.value = airlineCode;
				const airlineInfo = config.airlines[airlineCode];
				option.textContent = airlineInfo
					? `${airlineCode} - ${airlineInfo.name}`
					: airlineCode;
				elements.airlineFilter.appendChild(option);
			});

			console.log(
				`📊 Filter aktualisiert: ${airlines.length} Airlines gefunden`
			);
		}
	}

	/**
	 * Flottentabelle rendern
	 */
	function renderFleetTable() {
		console.log("🎨 renderFleetTable() aufgerufen");
		console.log("📊 filteredData.length:", filteredData.length);
		console.log("🔍 elements.fleetTableBody:", !!elements.fleetTableBody);

		if (!elements.fleetTableBody) {
			console.error("❌ fleetTableBody Element nicht gefunden!");
			return;
		}

		if (filteredData.length === 0) {
			console.log("📭 Keine gefilterten Daten - zeige Empty State");
			showEmptyState();
			return;
		}

		console.log("✅ Verstecke Empty State und rendere Tabelle");
		hideEmptyState();

		const tbody = elements.fleetTableBody;
		tbody.innerHTML = "";

		filteredData.forEach((aircraft, index) => {
			console.log(
				`🛩️ Rendere Flugzeug ${index + 1}:`,
				aircraft.registration || "Unknown"
			);
			const row = createFleetTableRow(aircraft);
			tbody.appendChild(row);
		});

		console.log(`✅ ${filteredData.length} Flugzeuge erfolgreich gerendert`);
	}

	/**
	 * Tabellenzeile für ein Flugzeug erstellen
	 */
	function createFleetTableRow(aircraft) {
		const row = document.createElement("tr");
		row.className = "hover:bg-gray-50 transition-colors";

		row.innerHTML = `
            <td class="px-4 py-3 whitespace-nowrap">
                <div class="flex items-center">
                    <div class="w-3 h-3 rounded-full mr-2" style="background-color: ${
											aircraft.airlineColor
										}"></div>
                    <span class="text-sm font-medium text-gray-900">${
											aircraft.airline
										}</span>
                    <span class="text-xs text-gray-500 ml-1">${
											aircraft.airlineName
										}</span>
                </div>
            </td>
            <td class="px-4 py-3 whitespace-nowrap">
                <span class="text-sm font-mono text-gray-900">${
									aircraft.registration || "-"
								}</span>
            </td>
            <td class="px-4 py-3 whitespace-nowrap">
                <span class="text-sm text-gray-900">${
									aircraft.aircraftType || "-"
								}</span>
            </td>
            <td class="px-4 py-3 whitespace-nowrap">
                <span class="text-sm text-gray-900">${
									aircraft.serial || "-"
								}</span>
            </td>
            <td class="px-4 py-3 whitespace-nowrap">
                <span class="text-sm text-gray-900">${
									aircraft.numSeats || "-"
								}</span>
            </td>
            <td class="px-4 py-3 whitespace-nowrap">
                <span class="text-sm text-gray-900">${
									aircraft.manufacturingYear || "-"
								}</span>
            </td>
            <td class="px-4 py-3 whitespace-nowrap">
                <span class="text-sm text-gray-900">${
									formatDate(aircraft.firstFlightDate) || "-"
								}</span>
            </td>
            <td class="px-4 py-3 whitespace-nowrap">
                <span class="text-sm text-gray-900">${
									formatDate(aircraft.deliveryDate) || "-"
								}</span>
            </td>
            <td class="px-4 py-3 whitespace-nowrap">
                <span class="text-sm text-gray-900">${
									formatDate(aircraft.registrationDate) || "-"
								}</span>
            </td>
            <td class="px-4 py-3 whitespace-nowrap">
                <span class="text-sm text-gray-900">${
									aircraft.ageYears !== "Unknown" ? aircraft.ageYears : "-"
								}</span>
            </td>
            <td class="px-4 py-3 whitespace-nowrap text-sm">
                <button class="text-blue-600 hover:text-blue-800 mr-2" 
                        onclick="FleetDatabase.viewAircraftDetails('${
													aircraft.registration
												}')"
                        title="Details anzeigen">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                              d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
                    </svg>
                </button>
                <button class="text-green-600 hover:text-green-800" 
                        onclick="FleetDatabase.useInHangar('${
													aircraft.registration
												}')"
                        title="In HangarPlanner verwenden">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                              d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
                    </svg>
                </button>
            </td>
        `;

		return row;
	}

	/**
	 * Triebwerke formatieren - verbessert für AeroDataBox Datenstruktur
	 */
	function formatEngines(engines) {
		if (!engines) return "";

		// Wenn es bereits ein String ist (von der Datennormalisierung)
		if (typeof engines === "string") {
			return engines;
		}

		// Wenn es ein Array ist
		if (Array.isArray(engines)) {
			return engines
				.map((engine) => {
					if (typeof engine === "string") return engine;
					if (engine.model) return engine.model;
					if (engine.type) return engine.type;
					return "Unknown";
				})
				.join(", ");
		}

		// Fallback
		return engines.toString();
	}

	/**
	 * Datum formatieren für die Anzeige
	 */
	function formatDate(dateString) {
		if (!dateString || dateString === "Unknown") return "";

		try {
			const date = new Date(dateString);
			if (isNaN(date.getTime())) return dateString; // Fallback für ungültige Datumsformate

			return date.toLocaleDateString("de-DE", {
				year: "numeric",
				month: "2-digit",
				day: "2-digit",
			});
		} catch (error) {
			return dateString; // Fallback bei Fehlern
		}
	}

	/**
	 * Loading-Zustand anzeigen
	 */
	function showLoadingState() {
		if (elements.fleetTableEmpty)
			elements.fleetTableEmpty.style.display = "none";
		if (elements.fleetTableLoading)
			elements.fleetTableLoading.style.display = "block";
		if (elements.fleetTable) elements.fleetTable.style.display = "table";
	}

	/**
	 * Leeren Zustand anzeigen
	 */
	function showEmptyState() {
		if (elements.fleetTableLoading)
			elements.fleetTableLoading.style.display = "none";
		if (elements.fleetTableEmpty)
			elements.fleetTableEmpty.style.display = "block";
		if (elements.fleetTable) elements.fleetTable.style.display = "none";
	}

	/**
	 * Leeren Zustand verstecken
	 */
	function hideEmptyState() {
		if (elements.fleetTableLoading)
			elements.fleetTableLoading.style.display = "none";
		if (elements.fleetTableEmpty)
			elements.fleetTableEmpty.style.display = "none";
		if (elements.fleetTable) elements.fleetTable.style.display = "table";
	}

	/**
	 * Status-Text aktualisieren
	 */
	function updateStatus(message) {
		if (elements.fleetStatus) {
			elements.fleetStatus.textContent = message;
		}
		console.log("📊 Status:", message);
	}

	/**
	 * Flugzeuganzahl aktualisieren
	 */
	function updateFleetCount(filtered, total) {
		if (elements.fleetCount) {
			if (filtered === total) {
				elements.fleetCount.textContent = `${total} Flugzeuge geladen`;
			} else {
				elements.fleetCount.textContent = `${filtered} von ${total} Flugzeugen angezeigt`;
			}
		}
	}

	/**
	 * Flottendaten exportieren
	 */
	function exportFleetData() {
		if (filteredData.length === 0) {
			alert(
				"Keine Daten zum Exportieren verfügbar. Bitte laden Sie zuerst die Flottendaten."
			);
			return;
		}

		const csvContent = generateCSV(filteredData);
		downloadCSV(csvContent, "fleet-database.csv");

		updateStatus(`${filteredData.length} Flugzeuge exportiert`);
	}

	/**
	 * CSV-Inhalt generieren
	 */
	function generateCSV(data) {
		const headers = [
			"Airline",
			"Airline Name",
			"Registration",
			"Aircraft Type",
			"Model",
			"Manufacturing Year",
			"Engines",
		];
		const csvRows = [headers.join(",")];

		data.forEach((aircraft) => {
			const row = [
				aircraft.airline || "",
				aircraft.airlineName || "",
				aircraft.registration || "",
				aircraft.aircraftType || "",
				aircraft.model || "",
				aircraft.manufacturingYear || "",
				formatEngines(aircraft.engines) || "",
			].map((field) => `"${field.toString().replace(/"/g, '""')}"`);

			csvRows.push(row.join(","));
		});

		return csvRows.join("\n");
	}

	/**
	 * CSV-Datei herunterladen
	 */
	function downloadCSV(csvContent, filename) {
		const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
		const link = document.createElement("a");

		if (link.download !== undefined) {
			const url = URL.createObjectURL(blob);
			link.setAttribute("href", url);
			link.setAttribute("download", filename);
			link.style.visibility = "hidden";
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
		}
	}

	/**
	 * Flugzeugdetails anzeigen (Placeholder)
	 */
	function viewAircraftDetails(registration) {
		alert(
			`Details für ${registration} würden hier angezeigt werden.\n\nDiese Funktion kann später ausgebaut werden.`
		);
	}

	/**
	 * Flugzeug im HangarPlanner verwenden
	 */
	function useInHangar(registration) {
		try {
			const reg = String(registration || '').trim();
			if (!reg) return;
			localStorage.setItem('selectedAircraft', reg);
			localStorage.setItem('selectedAircraftPrompt', 'true');
			const params = new URLSearchParams();
			params.set('selectedAircraft', reg);
			params.set('prompt', '1');
			// Navigate top-level (not the iframe) so Planner opens correctly
			try { window.top.location.href = `index.html?${params.toString()}`; }
			catch(_e){ window.location.href = `index.html?${params.toString()}`; }
		} catch (e) {
			try { window.top.location.href = 'index.html'; }
			catch(_e){ window.location.href = 'index.html'; }
		}
	}

	/**
	 * Debounce-Funktion für Such-Input
	 */
	function debounce(func, wait) {
		let timeout;
		return function executedFunction(...args) {
			const later = () => {
				clearTimeout(timeout);
				func(...args);
			};
			clearTimeout(timeout);
			timeout = setTimeout(later, wait);
		};
	}

	// Öffentliche API
	return {
		init,
		loadFleetData,
		exportFleetData,
		viewAircraftDetails,
		useInHangar,
		getFleetData: () => fleetData,
		getFilteredData: () => filteredData,
		testAPIConnection, // Korrigierte Test-Funktion für Debugging
	};

	/**
	 * Test-Funktion für API-Verbindung
	 */
	function testAPIConnection() {
		console.log("🧪 Teste API-Verbindung...");

		// Test für CLH
		const testUrl = `${config.baseUrl}/airlines/CLH/aircrafts?pageSize=1&pageOffset=0&withRegistrations=false`;
		console.log("📡 Test-URL:", testUrl);

		const xhr = new XMLHttpRequest();
		xhr.withCredentials = true;

		xhr.addEventListener("readystatechange", function () {
			if (this.readyState === this.DONE) {
				console.log("📊 Test Response Status:", this.status);
				console.log("📊 Test Response Text:", this.responseText);

				if (this.status === 200) {
					console.log("✅ API-Verbindung erfolgreich!");
					try {
						const data = JSON.parse(this.responseText);
						console.log("✅ API-Test Daten:", data);
					} catch (e) {
						console.error("❌ JSON Parse Error:", e);
					}
				} else {
					console.error(
						"❌ API-Test fehlgeschlagen:",
						this.status,
						this.statusText
					);
				}
			}
		});

		xhr.open("GET", testUrl);
		xhr.setRequestHeader("x-rapidapi-key", config.rapidApiKey);
		xhr.setRequestHeader("x-rapidapi-host", config.rapidApiHost);
		xhr.send(null);
	}
})();

// Initialisierung wenn DOM bereit ist
document.addEventListener("DOMContentLoaded", function () {
	console.log("🚀 DOM geladen - starte Fleet Database Initialisierung...");
	FleetDatabase.init();

	// Einmaliger Event-Listener für Fleet Database Manager Bereitschaft
	let dataLoadTriggered = false;

	function triggerDataLoad() {
		if (dataLoadTriggered) {
			console.log("� Datenladung bereits ausgelöst - überspringe...");
			return;
		}
		dataLoadTriggered = true;
		console.log("🎯 Starte einmalige automatische Datenladung...");
		FleetDatabase.loadFleetData();
	}

	// Event-Listener für Fleet Database Manager Bereitschaft
	window.addEventListener("fleetDatabaseManagerReady", function (event) {
		console.log("🎉 Fleet Database Manager Ready Event erhalten!");
		console.log("� Event Details:", event.detail);

		// Kurze Verzögerung für UI-Stabilisierung
		setTimeout(() => {
			triggerDataLoad();
		}, 200);
	});

	// Fallback: Prüfung nach 1 Sekunde ob Manager bereits bereit ist
	setTimeout(() => {
		console.log("� Fallback Check: Prüfe FleetDatabaseManager Status...");

		if (
			window.fleetDatabaseManager &&
			window.fleetDatabaseManager.isInitialized
		) {
			console.log(
				"✅ FleetDatabaseManager bereits bereit - starte Datenladung..."
			);
			triggerDataLoad();
		} else {
			console.log(
				"⏳ FleetDatabaseManager noch nicht bereit - warte auf Event..."
			);
		}
	}, 1000);

	// Wetter-API laden (falls verfügbar)
	if (typeof WeatherAPI !== "undefined") {
		WeatherAPI.init();
		WeatherAPI.updateWeatherDisplay();
	}
});

// Global verfügbar machen
window.FleetDatabase = FleetDatabase;

// Test-Funktion für direktes Laden
window.testFleetDatabaseLoad = function () {
	console.log("🧪 Test: Lade Flottendaten direkt...");
	FleetDatabase.loadFleetData();
};

console.log("🧪 Test-Funktion verfügbar: testFleetDatabaseLoad()");
