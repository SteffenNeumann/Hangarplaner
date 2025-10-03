/**
 * Fleet Database Manager für serverseitige JSON-Datenbank
 * Verwaltet Flugzeug-Flottendaten mit intelligenter Synchronisation
 *
 * Funktionen:
 * - Lädt Daten beim Seitenstart aus der serverseitigen Datenbank
 * - Erste Synchronisation füllt die Datenbank komplett
 * - Folgende Synchronisationen gleichen nur Unterschiede ab
 * - Cached Daten lokal für bessere Performance
 */

class FleetDatabaseManager {
	constructor() {
		this.apiEndpoint = "sync/fleet-database.php";
		this.localCache = null;
		this.isInitialized = false;
		this.syncInProgress = false;
		this.initializationPromise = null;

		// Event callbacks
		this.onDataLoaded = null;
		this.onSyncComplete = null;
		this.onError = null;

		// Initialisierung starten, aber nicht blockieren
		this.initializationPromise = this.initialize();
	}

	/**
	 * Initialisiert den Fleet Database Manager
	 */
	async initialize() {
		console.log("🚁 Fleet Database Manager wird initialisiert...");

		try {
			// Status der serverseitigen Datenbank prüfen
			console.log("📡 Prüfe Server-Status...");
			const status = await this.getServerStatus();
			console.log("📊 Fleet Database Status:", status);

			if (status.exists && status.totalAircrafts > 0) {
				// Daten von Server laden
				console.log("📥 Lade vorhandene Daten vom Server...");
				await this.loadFromServer();
				console.log(
					`✅ ${status.totalAircrafts} Flugzeuge aus der Datenbank geladen`
				);
			} else {
				console.log("📭 Noch keine Fleet-Daten in der Datenbank vorhanden");
				this.localCache = this.getEmptyFleetDatabase();
			}

			this.isInitialized = true;
			console.log("✅ Fleet Database Manager erfolgreich initialisiert");

			// Event für andere Module aussenden
			window.dispatchEvent(
				new CustomEvent("fleetDatabaseManagerReady", {
					detail: { manager: this, data: this.localCache },
				})
			);

			// Callback ausführen wenn Daten geladen wurden
			if (this.onDataLoaded && typeof this.onDataLoaded === "function") {
				this.onDataLoaded(this.localCache);
			}
		} catch (error) {
			console.error("❌ Fehler bei der Initialisierung:", error);
			console.error("📄 Error Details:", error.message, error.stack);

			// Fallback auf leere Datenbank
			this.localCache = this.getEmptyFleetDatabase();
			this.isInitialized = true; // Trotzdem als initialisiert markieren

			if (this.onError && typeof this.onError === "function") {
				this.onError(error);
			}
		}
	}

	/**
	 * Wartet auf die Initialisierung
	 */
	async waitForInitialization() {
		if (this.initializationPromise) {
			await this.initializationPromise;
		}
		return this.isInitialized;
	}

	/**
	 * Status der serverseitigen Datenbank abrufen
	 */
	async getServerStatus() {
		try {
			console.log(
				"📡 Rufe Server-Status ab:",
				`${this.apiEndpoint}?action=status`
			);
			const response = await fetch(`${this.apiEndpoint}?action=status`);

			console.log(
				"📡 Server Response Status:",
				response.status,
				response.statusText
			);

			if (!response.ok) {
				const errorText = await response.text();
				console.error("❌ Server Status Fehler:", response.status, errorText);
				throw new Error(
					`Server Status Fehler: ${response.status} - ${errorText}`
				);
			}

			const data = await response.json();
			console.log("📊 Server Status Daten:", data);
			return data;
		} catch (error) {
			if (error && (error.name === "AbortError" || error.code === 20 || String(error).toLowerCase().includes("aborted"))) {
				console.warn("ℹ️ Server-Status-Abfrage abgebrochen (unbedenklich):", error);
				return {
					exists: false,
					syncStatus: "unknown",
					totalAircrafts: 0,
					airlines: [],
					success: false,
					error: "aborted",
				};
			}

			console.error("❌ Fehler beim Abrufen des Server-Status:", error);

			// Fallback: Annahme dass keine Daten vorhanden sind
			return {
				exists: false,
				syncStatus: "never_synced",
				totalAircrafts: 0,
				airlines: [],
				success: false,
				error: error.message,
			};
		}
	}

	/**
	 * Daten von der serverseitigen Datenbank laden
	 */
	async loadFromServer() {
		try {
			console.log("📥 Lade Daten vom Server:", this.apiEndpoint);
			const response = await fetch(this.apiEndpoint);

			console.log(
				"📡 Server Response Status:",
				response.status,
				response.statusText
			);

			if (!response.ok) {
				const errorText = await response.text();
				console.error("❌ Laden fehlgeschlagen:", response.status, errorText);
				throw new Error(
					`Laden fehlgeschlagen: ${response.status} - ${errorText}`
				);
			}

			const data = await response.json();
			console.log("📥 Rohdaten erhalten:", data);

			// Validiere Datenstruktur
			if (!data.fleetDatabase) {
				console.error("❌ Ungültige Datenstruktur: fleetDatabase fehlt");
				throw new Error("Ungültige Datenstruktur von Server erhalten");
			}

			this.localCache = data;

			console.log("📥 Fleet-Daten vom Server geladen:", {
				airlines: Object.keys(data.fleetDatabase.airlines).length,
				totalAircrafts: data.fleetDatabase.metadata.totalAircrafts,
				lastUpdate: new Date(data.fleetDatabase.lastUpdate),
			});

			return data;
		} catch (error) {
			console.error("❌ Fehler beim Laden vom Server:", error);
			throw error;
		}
	}

	/**
	 * Erste Synchronisation - füllt die Datenbank komplett
	 */
	async performInitialSync(apiData) {
		if (this.syncInProgress) {
			console.log("⏳ Synchronisation bereits in Bearbeitung...");
			return;
		}

		this.syncInProgress = true;
		console.log("🔄 Starte Erst-Synchronisation der Fleet-Datenbank...");

		try {
			// Zeige Notification wenn verfügbar
			if (window.showNotification) {
				window.showNotification(
					"Fleet-Datenbank wird erstmalig gefüllt...",
					"info"
				);
			}

			console.log(
				"📤 Sende POST Request an:",
				`${this.apiEndpoint}?sync=false`
			);
			console.log("📊 Daten die gesendet werden:", apiData);

			const response = await fetch(`${this.apiEndpoint}?sync=false`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify(apiData),
			});

			console.log(
				"📡 POST Response Status:",
				response.status,
				response.statusText
			);

			if (!response.ok) {
				const errorText = await response.text();
				console.error("❌ POST Response Error:", errorText);
				throw new Error(
					`Erst-Synchronisation fehlgeschlagen: ${response.status} - ${errorText}`
				);
			}

			const responseText = await response.text();
			console.log("📄 POST Response Body:", responseText);

			let result;
			try {
				result = JSON.parse(responseText);
			} catch (parseError) {
				console.error("❌ JSON Parse Fehler:", parseError.message);
				throw new Error(
					`Ungültige JSON-Antwort vom Server: ${parseError.message}`
				);
			}

			console.log("✅ Erst-Synchronisation erfolgreich:", result);

			// Lokalen Cache aktualisieren
			await this.loadFromServer();

			if (window.showNotification) {
				window.showNotification(
					`Fleet-Datenbank erstellt: ${result.totalAircrafts} Flugzeuge in ${result.airlines} Airlines`,
					"success"
				);
			}

			// Callback ausführen
			if (this.onSyncComplete && typeof this.onSyncComplete === "function") {
				this.onSyncComplete(result, "initial");
			}

			return result;
		} catch (error) {
			console.error("❌ Fehler bei der Erst-Synchronisation:", error);
			console.error("📄 Error Stack:", error.stack);

			if (window.showNotification) {
				window.showNotification(
					"Fehler bei der Fleet-Datenbank Erstellung: " + error.message,
					"error"
				);
			}

			throw error;
		} finally {
			this.syncInProgress = false;
		}
	}

	/**
	 * Folge-Synchronisation - gleicht nur Unterschiede ab
	 */
	async performDifferentialSync(apiData) {
		if (this.syncInProgress) {
			console.log("⏳ Synchronisation bereits in Bearbeitung...");
			return;
		}

		this.syncInProgress = true;
		console.log("🔄 Starte Differential-Synchronisation...");

		try {
			if (window.showNotification) {
				window.showNotification("Fleet-Datenbank wird abgeglichen...", "info");
			}

			const response = await fetch(`${this.apiEndpoint}?sync=true`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify(apiData),
			});

			if (!response.ok) {
				throw new Error(
					`Differential-Synchronisation fehlgeschlagen: ${response.status}`
				);
			}

			const result = await response.json();
			console.log("✅ Differential-Synchronisation erfolgreich:", result);

			// Lokalen Cache aktualisieren
			await this.loadFromServer();

			// Statistik anzeigen
			const changes = result.changes;
			const totalChanges = changes.added + changes.updated + changes.removed;

			if (totalChanges > 0) {
				let message = `Fleet-Datenbank aktualisiert: `;
				const changeParts = [];
				if (changes.added > 0) changeParts.push(`${changes.added} hinzugefügt`);
				if (changes.updated > 0)
					changeParts.push(`${changes.updated} aktualisiert`);
				if (changes.removed > 0)
					changeParts.push(`${changes.removed} entfernt`);
				message += changeParts.join(", ");

				if (window.showNotification) {
					window.showNotification(message, "success");
				}
			} else {
				if (window.showNotification) {
					window.showNotification(
						"Fleet-Datenbank ist bereits aktuell",
						"info"
					);
				}
			}

			// Callback ausführen
			if (this.onSyncComplete && typeof this.onSyncComplete === "function") {
				this.onSyncComplete(result, "differential");
			}

			return result;
		} catch (error) {
			console.error("❌ Fehler bei der Differential-Synchronisation:", error);

			if (window.showNotification) {
				window.showNotification(
					"Fehler beim Fleet-Datenbank Abgleich",
					"error"
				);
			}

			throw error;
		} finally {
			this.syncInProgress = false;
		}
	}

	/**
	 * Automatische Synchronisation basierend auf Datenbank-Status
	 */
	async syncWithApiData(apiData) {
		console.log(
			"🔄 Starte syncWithApiData mit:",
			Object.keys(apiData.airlines || {}).length,
			"Airlines"
		);

		// Warte auf Initialisierung
		await this.waitForInitialization();

		if (!this.isInitialized) {
			throw new Error(
				"Fleet Database Manager konnte nicht initialisiert werden"
			);
		}

		try {
			console.log("📊 Prüfe Server-Status für Synchronisation...");
			const status = await this.getServerStatus();
			console.log("📊 Status erhalten:", status);

			if (!status.exists || status.totalAircrafts === 0) {
				// Erste Synchronisation
				console.log("🆕 Führe Erst-Synchronisation durch...");
				return await this.performInitialSync(apiData);
			} else {
				// Differential-Synchronisation
				console.log("🔄 Führe Differential-Synchronisation durch...");
				return await this.performDifferentialSync(apiData);
			}
		} catch (error) {
			console.error("❌ Fehler bei der automatischen Synchronisation:", error);
			throw error;
		}
	}

	/**
	 * Einzelnes Flugzeug hinzufügen oder aktualisieren
	 */
	async addOrUpdateAircraft(
		airline,
		aircraft,
		airlineName = null,
		airlineColor = null
	) {
		try {
			const data = {
				airline: airline,
				aircraft: aircraft,
				airlineName: airlineName,
				airlineColor: airlineColor,
			};

			const response = await fetch(this.apiEndpoint, {
				method: "PUT",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify(data),
			});

			if (!response.ok) {
				throw new Error(
					`Flugzeug hinzufügen fehlgeschlagen: ${response.status}`
				);
			}

			const result = await response.json();
			console.log("✅ Flugzeug erfolgreich gespeichert:", result);

			// Lokalen Cache aktualisieren
			await this.loadFromServer();

			return result;
		} catch (error) {
			console.error("❌ Fehler beim Hinzufügen des Flugzeugs:", error);
			throw error;
		}
	}

	/**
	 * Flugzeug oder Airline löschen
	 */
	async deleteAircraft(airline, registration = null) {
		try {
			let url = `${this.apiEndpoint}?airline=${encodeURIComponent(airline)}`;
			if (registration) {
				url += `&registration=${encodeURIComponent(registration)}`;
			}

			const response = await fetch(url, {
				method: "DELETE",
			});

			if (!response.ok) {
				throw new Error(`Löschen fehlgeschlagen: ${response.status}`);
			}

			const result = await response.json();
			console.log("✅ Erfolgreich gelöscht:", result);

			// Lokalen Cache aktualisieren
			await this.loadFromServer();

			return result;
		} catch (error) {
			console.error("❌ Fehler beim Löschen:", error);
			throw error;
		}
	}

	/**
	 * Fleet-Daten aus dem lokalen Cache abrufen
	 */
	getFleetData() {
		return this.localCache;
	}

	/**
	 * Flugzeuge einer bestimmten Airline abrufen
	 */
	getAirlineFleet(airlineCode) {
		if (
			!this.localCache ||
			!this.localCache.fleetDatabase.airlines[airlineCode]
		) {
			return [];
		}
		return this.localCache.fleetDatabase.airlines[airlineCode].aircrafts;
	}

	/**
	 * Alle Airlines abrufen
	 */
	getAirlines() {
		if (!this.localCache) {
			return [];
		}
		return Object.values(this.localCache.fleetDatabase.airlines);
	}

	/**
	 * Flugzeug anhand der Registrierung suchen
	 */
	findAircraftByRegistration(registration) {
		if (!this.localCache) {
			return null;
		}

		for (const airline of Object.values(
			this.localCache.fleetDatabase.airlines
		)) {
			const aircraft = airline.aircrafts.find(
				(a) => a.registration === registration
			);
			if (aircraft) {
				return {
					aircraft: aircraft,
					airline: airline,
				};
			}
		}
		return null;
	}

	/**
	 * Leere Fleet-Datenbank-Struktur erstellen
	 */
	getEmptyFleetDatabase() {
		return {
			fleetDatabase: {
				version: "1.0.0",
				lastUpdate: Date.now(),
				airlines: {},
				metadata: {
					created: Date.now(),
					lastModified: Date.now(),
					totalAircrafts: 0,
					syncStatus: "never_synced",
					apiCalls: 0,
					lastApiSync: null,
				},
			},
		};
	}

	/**
	 * Statistiken der Fleet-Datenbank abrufen
	 */
	getStatistics() {
		if (!this.localCache) {
			return {
				totalAircrafts: 0,
				totalAirlines: 0,
				lastUpdate: null,
				syncStatus: "not_initialized",
			};
		}

		const fleetDb = this.localCache.fleetDatabase;
		return {
			totalAircrafts: fleetDb.metadata.totalAircrafts,
			totalAirlines: Object.keys(fleetDb.airlines).length,
			lastUpdate: fleetDb.lastUpdate,
			syncStatus: fleetDb.metadata.syncStatus,
			lastApiSync: fleetDb.metadata.lastApiSync,
		};
	}

	/**
	 * Alle Aircraft Registrations aus der Fleet Database abrufen
	 * @returns {Array} Array mit allen Aircraft-Objekten {registration, aircraftType, airline, etc.}
	 */
	getAllAircrafts() {
		if (!this.localCache || !this.localCache.fleetDatabase) {
			console.log("⚠️ Fleet Database Cache nicht verfügbar");
			return [];
		}

		const aircrafts = [];
		const fleetDb = this.localCache.fleetDatabase;

		// Debug: Zeige Struktur der Fleet Database
		console.log("🔍 Fleet Database Struktur:", fleetDb);
		console.log("🔍 Airlines verfügbar:", Object.keys(fleetDb.airlines || {}));

		// Prüfe ob Airlines existieren
		if (!fleetDb.airlines || typeof fleetDb.airlines !== "object") {
			console.log("⚠️ Keine Airlines in Fleet Database gefunden");
			return [];
		}

		// Durchlaufe alle Airlines
		Object.values(fleetDb.airlines).forEach((airline) => {
			console.log(`🔍 Verarbeite Airline:`, airline);

			// Prüfe ob Airline aircrafts Array hat (neue Struktur aus PHP)
			if (airline.aircrafts && Array.isArray(airline.aircrafts)) {
				airline.aircrafts.forEach((aircraft) => {
					aircrafts.push({
						registration: aircraft.registration,
						aircraftType: aircraft.aircraftType || aircraft.type || "Unknown",
						airline: {
							iata: airline.code || airline.iata || "",
							name: airline.name || "",
							icao: airline.icao || "",
						},
						serial: aircraft.serial,
						numSeats: aircraft.numSeats,
						manufacturingYear: aircraft.manufacturingYear,
						firstFlightDate: aircraft.firstFlightDate,
						deliveryDate: aircraft.deliveryDate,
						registrationDate: aircraft.registrationDate,
						ageYears: aircraft.ageYears,
					});
				});
			}
			// Fallback: Prüfe ob alte aircraftTypes Struktur vorhanden ist
			else if (
				airline.aircraftTypes &&
				typeof airline.aircraftTypes === "object"
			) {
				Object.values(airline.aircraftTypes).forEach((aircraftType) => {
					if (aircraftType.aircrafts && Array.isArray(aircraftType.aircrafts)) {
						aircraftType.aircrafts.forEach((aircraft) => {
							aircrafts.push({
								registration: aircraft.registration,
								aircraftType: aircraftType.type || "Unknown",
								airline: {
									iata: airline.iata || airline.code || "",
									name: airline.name || "",
									icao: airline.icao || "",
								},
								serial: aircraft.serial,
								numSeats: aircraft.numSeats,
								manufacturingYear: aircraft.manufacturingYear,
								firstFlightDate: aircraft.firstFlightDate,
								deliveryDate: aircraft.deliveryDate,
								registrationDate: aircraft.registrationDate,
								ageYears: aircraft.ageYears,
							});
						});
					}
				});
			} else {
				console.log(
					`⚠️ Airline ${
						airline.name || "unbekannt"
					} hat keine gültige Aircraft-Struktur`
				);
			}
		});

		console.log(
			`📋 ${aircrafts.length} Aircraft Registrations aus Fleet Database extrahiert`
		);
		return aircrafts;
	}

	/**
	 * Aircraft Registrations nach Airline filtern
	 * @param {string} airlineIata - IATA-Code der Airline (z.B. "CLH", "LHX")
	 * @returns {Array} Gefilterte Aircraft-Liste
	 */
	getAircraftsByAirline(airlineIata) {
		const allAircrafts = this.getAllAircrafts();
		return allAircrafts.filter(
			(aircraft) => aircraft.airline.iata === airlineIata
		);
	}

	/**
	 * Aircraft Registrations nach Flugzeugtyp filtern
	 * @param {string} aircraftType - Flugzeugtyp (z.B. "A320", "A321")
	 * @returns {Array} Gefilterte Aircraft-Liste
	 */
	getAircraftsByType(aircraftType) {
		const allAircrafts = this.getAllAircrafts();
		return allAircrafts.filter(
			(aircraft) => aircraft.aircraftType === aircraftType
		);
	}

	/**
	 * Cache-Status prüfen
	 */
	isCacheValid() {
		return this.localCache !== null && this.isInitialized;
	}

	/**
	 * Cache leeren (für Debug-Zwecke)
	 */
	clearCache() {
		this.localCache = null;
		this.isInitialized = false;
		console.log("🗑️ Fleet Database Cache geleert");
	}
}

// Globale Instanz erstellen
window.fleetDatabaseManager = new FleetDatabaseManager();

// Export für Module
if (typeof module !== "undefined" && module.exports) {
	module.exports = FleetDatabaseManager;
}
