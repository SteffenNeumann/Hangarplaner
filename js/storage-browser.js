/**
 * Server-Synchronisation für HangarPlanner
 * Reduzierte Version - nur Server-Sync ohne Event-Handler
 * Optimiert von 2085 → ~400 Zeilen
 */

class ServerSync {
	constructor() {
		this.serverSyncUrl = null;
		this.serverSyncInterval = null;
		this.isApplyingServerData = false;
		this.lastDataChecksum = null;
		this.autoSaveTimeout = null;

		// NEUE Master-Slave Eigenschaften
		this.isMaster = false;
		this.isSlaveActive = false;
		this.serverTimestamp = null;
		this.slaveCheckInterval = null;
		this.lastServerTimestamp = 0;

		// Global verfügbar machen für Kompatibilität und Race Condition Prevention
		window.isApplyingServerData = false;
		window.isLoadingServerData = false;
		window.isSavingToServer = false;
	}

	/**
	 * Initialisiert die Server-Synchronisation mit Master-Slave Erkennung
	 */
	async initSync(serverUrl) {
		this.serverSyncUrl = serverUrl;
		console.log("🔄 Server-Sync initialisiert:", serverUrl);

		// Automatische Master-Slave Erkennung
		await this.determineMasterSlaveRole();

		if (this.isMaster) {
			console.log("👑 Master-Modus aktiviert");
			this.startMasterMode();
		} else {
			console.log("👤 Slave-Modus aktiviert");
			this.startSlaveMode();
		}
	}

	/**
	 * Startet periodische Synchronisation alle 60 Sekunden (optimiert)
	 */
	startPeriodicSync() {
		if (this.serverSyncInterval) {
			clearInterval(this.serverSyncInterval);
		}

		this.serverSyncInterval = setInterval(() => {
			// Nur synchronisieren wenn keine andere Sync-Operation läuft UND Daten geändert wurden
			if (
				!this.isApplyingServerData &&
				!window.isApplyingServerData &&
				!window.isLoadingServerData &&
				!window.isSavingToServer &&
				this.hasDataChanged()
			) {
				this.syncWithServer();
			} else {
				// console.log("⏸️ Periodische Sync übersprungen (keine Änderungen oder Sync aktiv)");
			}
		}, 120000); // 120 Sekunden statt 60 für bessere Performance

		console.log(
			"⏰ Periodische Server-Sync gestartet (120s Intervall, Change-Detection)"
		);
	}

	/**
	 * Stoppt die periodische Synchronisation
	 */
	stopPeriodicSync() {
		if (this.serverSyncInterval) {
			clearInterval(this.serverSyncInterval);
			this.serverSyncInterval = null;
			console.log("⏹️ Periodische Server-Sync gestoppt");
		}
	}

	/**
	 * VEREINFACHT: Nur Standard Server-URL ohne Projekt-IDs
	 */
	getServerUrl() {
		return this.serverSyncUrl;
	}

	/**
	 * NEUE METHODE: Bestimmt Master oder Slave Rolle
	 */
	async determineMasterSlaveRole() {
		try {
			// Prüfe ob bereits Daten auf Server vorhanden sind
			const serverTimestamp = await this.getServerTimestamp();

			// Wenn kein Server-Timestamp vorhanden, wird diese Instanz Master
			if (!serverTimestamp || serverTimestamp === 0) {
				this.isMaster = true;
				this.isSlaveActive = false;
				console.log("🏴 Keine Server-Daten gefunden - Master-Rolle übernommen");
			} else {
				// Server-Daten vorhanden, diese Instanz wird Slave
				this.isMaster = false;
				this.isSlaveActive = true;
				this.lastServerTimestamp = serverTimestamp;
				console.log("📡 Server-Daten gefunden - Slave-Rolle übernommen");
			}
		} catch (error) {
			// Bei Fehler standardmäßig Master werden
			console.warn(
				"⚠️ Fehler bei Master-Slave Erkennung, werde Master:",
				error
			);
			this.isMaster = true;
			this.isSlaveActive = false;
		}
	}

	/**
	 * NEUE METHODE: Holt Server-Timestamp für Change-Detection
	 */
	async getServerTimestamp() {
		try {
			const response = await fetch(`${this.serverSyncUrl}?action=timestamp`, {
				method: "GET",
				signal: AbortSignal.timeout(5000),
			});

			if (response.ok) {
				const data = await response.json();
				return data.timestamp || 0;
			} else {
				return 0;
			}
		} catch (error) {
			console.warn("⚠️ Server-Timestamp nicht abrufbar:", error.message);
			return 0;
		}
	}

	/**
	 * NEUE METHODE: Startet Master-Modus
	 */
	startMasterMode() {
		this.isMaster = true;
		this.isSlaveActive = false;

		// Stoppe Slave-Intervall falls aktiv
		if (this.slaveCheckInterval) {
			clearInterval(this.slaveCheckInterval);
			this.slaveCheckInterval = null;
		}

		// Starte normale periodische Synchronisation (Speichern)
		this.startPeriodicSync();
		console.log("👑 Master-Modus gestartet - periodisches Speichern aktiv");
	}

	/**
	 * NEUE METHODE: Startet Slave-Modus
	 */
	startSlaveMode() {
		this.isMaster = false;
		this.isSlaveActive = true;

		// Stoppe normale Sync falls aktiv
		this.stopPeriodicSync();

		// Starte Slave-Polling (nur Laden bei Änderungen)
		this.slaveCheckInterval = setInterval(async () => {
			await this.slaveCheckForUpdates();
		}, 30000); // 30 Sekunden Polling-Intervall

		console.log("👤 Slave-Modus gestartet - Polling für Updates aktiv");

		// Initialer Load der Server-Daten
		setTimeout(() => this.slaveCheckForUpdates(), 1000);
	}

	/**
	 * NEUE METHODE: Slave prüft auf Server-Updates
	 */
	async slaveCheckForUpdates() {
		if (!this.isSlaveActive) return;

		try {
			const currentServerTimestamp = await this.getServerTimestamp();

			if (currentServerTimestamp > this.lastServerTimestamp) {
				console.log("🔄 Slave: Neue Daten auf Server erkannt, lade Updates...");

				const serverData = await this.loadFromServer();
				if (serverData && !serverData.error) {
					await this.applyServerData(serverData);
					this.lastServerTimestamp = currentServerTimestamp;
					console.log("✅ Slave: Server-Daten erfolgreich geladen");
				}
			} else {
				// console.log("⏸️ Slave: Keine Änderungen auf Server");
			}
		} catch (error) {
			console.error("❌ Slave: Fehler beim Prüfen auf Updates:", error);
		}
	}

	/**
	 * Synchronisiert Daten mit dem Server (NUR Master-Modus)
	 */
	async syncWithServer() {
		if (!this.serverSyncUrl) {
			console.warn("⚠️ Server-URL nicht konfiguriert");
			return false;
		}

		// NEUE PRÜFUNG: Nur Master darf speichern
		if (!this.isMaster) {
			// console.log("⏸️ Slave-Modus: Speichern übersprungen");
			return true; // Kein Fehler, nur keine Berechtigung
		}

		// Verhindere gleichzeitige Sync-Operationen
		if (window.isSavingToServer) {
			// console.log("⏸️ Server-Sync übersprungen (Speicherung läuft bereits)");
			return false;
		}

		// Performance: Prüfe erst ob sich Daten geändert haben
		if (!this.hasDataChanged()) {
			// console.log("⏸️ Server-Sync übersprungen (keine Änderungen)");
			return true; // Kein Fehler, nur keine Änderungen
		}

		window.isSavingToServer = true;

		try {
			// Aktuelle Daten sammeln
			const currentData = this.collectCurrentData();

			if (!currentData) {
				console.warn("⚠️ Keine Daten zum Synchronisieren verfügbar");
				return false;
			}

			// Optimierung: Verwende AbortController für Timeout
			const controller = new AbortController();
			const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s Timeout

			// Verwende korrekte Server-URL mit Project-ID falls vorhanden
			const serverUrl = this.getServerUrl();

			// Daten an Server senden
			const response = await fetch(serverUrl, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify(currentData),
				signal: controller.signal,
			});

			clearTimeout(timeoutId);

			if (response.ok) {
				console.log("✅ Master: Server-Sync erfolgreich");
				return true;
			} else {
				console.warn("⚠️ Server-Sync fehlgeschlagen:", response.status);
				return false;
			}
		} catch (error) {
			if (error.name === "AbortError") {
				console.warn("⚠️ Server-Sync Timeout (10s)");
			} else {
				console.error("❌ Server-Sync Fehler:", error);
			}
			return false;
		} finally {
			window.isSavingToServer = false;
		}
	}

	/**
	 * Sammelt aktuelle Daten für Server-Sync
	 */
	collectCurrentData() {
		try {
			// Verwende hangarData falls verfügbar
			if (
				window.hangarData &&
				typeof window.hangarData.collectAllHangarData === "function"
			) {
				const data = window.hangarData.collectAllHangarData();

				// *** NEU: Display Options ergänzen ***
				if (window.displayOptions) {
					// Sammle aktuelle UI-Werte
					window.displayOptions.collectFromUI();

					// Füge Display Options zu den Einstellungen hinzu
					if (!data.settings) data.settings = {};
					data.settings.displayOptions = { ...window.displayOptions.current };

					console.log(
						"🎛️ Display Options zu Server-Daten hinzugefügt:",
						data.settings.displayOptions
					);
				}

				return data;
			}

			// Fallback: Sammle Basis-Daten
			const data = {
				timestamp: new Date().toISOString(),
				projectName:
					document.getElementById("projectName")?.value || "Unbenannt",
				settings: JSON.parse(
					localStorage.getItem("hangarPlannerSettings") || "{}"
				),
				metadata: {
					lastSync: new Date().toISOString(),
					source: "server-sync-lite",
				},
			};

			// *** NEU: Display Options auch im Fallback hinzufügen ***
			if (window.displayOptions) {
				window.displayOptions.collectFromUI();
				data.settings.displayOptions = { ...window.displayOptions.current };
				console.log("🎛️ Display Options zu Fallback-Daten hinzugefügt");
			}

			return data;
		} catch (error) {
			console.error("❌ Fehler beim Sammeln der Daten:", error);
			return null;
		}
	}

	/**
	 * Lädt Daten vom Server
	 */
	async loadFromServer() {
		if (!this.serverSyncUrl) {
			console.warn("⚠️ Server-URL nicht konfiguriert");
			return null;
		}

		try {
			// Verwende korrekte Server-URL mit Project-ID falls vorhanden
			const serverUrl = this.getServerUrl();
			const loadUrl =
				serverUrl + (serverUrl.includes("?") ? "&" : "?") + "action=load";

			const response = await fetch(loadUrl, {
				method: "GET",
				headers: {
					Accept: "application/json",
				},
			});

			if (response.ok) {
				const data = await response.json();
				console.log("✅ Daten vom Server geladen");
				return data;
			} else {
				console.warn("⚠️ Server-Load fehlgeschlagen:", response.status);
				return null;
			}
		} catch (error) {
			console.error("❌ Server-Load Fehler:", error);
			return null;
		}
	}

	/**
	 * Wendet Server-Daten auf die Anwendung an - KOORDINIERT
	 */
	async applyServerData(serverData) {
		if (!serverData) {
			console.warn("⚠️ Keine Server-Daten zum Anwenden");
			return false;
		}

		// Verhindere gleichzeitige Anwendung von Server-Daten
		if (this.isApplyingServerData) {
			console.log("⏸️ Server-Daten werden bereits angewendet, überspringe");
			return false;
		}

		try {
			// KRITISCH: Flag setzen um localStorage-Konflikte zu vermeiden
			this.isApplyingServerData = true;
			window.isApplyingServerData = true;

			console.log("📥 Wende Server-Daten über Koordinator an:", serverData);

			// *** PRIORITÄT 1: Display Options aus Serverdaten anwenden ***
			if (
				serverData.settings &&
				serverData.settings.displayOptions &&
				window.displayOptions
			) {
				// Server-Display-Options in das aktuelle Display Options System laden
				window.displayOptions.current = {
					...window.displayOptions.defaults,
					...serverData.settings.displayOptions,
				};
				window.displayOptions.updateUI();
				window.displayOptions.applySettings();
				console.log(
					"🎛️ Display Options vom Server angewendet:",
					serverData.settings.displayOptions
				);
			} else if (serverData.settings) {
				// Legacy-Format: Direkte Einstellungen ohne displayOptions
				if (window.displayOptions) {
					const legacySettings = {
						tilesCount: serverData.settings.tilesCount || 8,
						secondaryTilesCount: serverData.settings.secondaryTilesCount || 4,
						layout: serverData.settings.layout || 4,
					};
					window.displayOptions.current = {
						...window.displayOptions.defaults,
						...legacySettings,
					};
					window.displayOptions.updateUI();
					window.displayOptions.applySettings();
					console.log(
						"🎛️ Legacy-Einstellungen vom Server angewendet:",
						legacySettings
					);
				}
			}

			// *** PRIORITÄT 2: Kachel-Daten anwenden ***
			// NEUE LOGIK: Verwende zentralen Datenkoordinator
			if (window.dataCoordinator) {
				// Server-Daten haben höchste Priorität
				window.dataCoordinator.loadProject(serverData, "server");
				console.log("✅ Server-Daten über Datenkoordinator angewendet");
				return true;
			}

			// Fallback: Direkte Anwendung (nur wenn Koordinator nicht verfügbar)
			if (
				window.hangarData &&
				typeof window.hangarData.applyLoadedHangarPlan === "function"
			) {
				const result = window.hangarData.applyLoadedHangarPlan(serverData);
				console.log("✅ Server-Daten über hangarData angewendet (Fallback)");
				return result;
			}

			// Basis-Fallback
			if (serverData.metadata && serverData.metadata.projectName) {
				const projectNameInput = document.getElementById("projectName");
				if (projectNameInput) {
					projectNameInput.value = serverData.metadata.projectName;
					console.log(
						"📝 Projektname gesetzt:",
						serverData.metadata.projectName
					);
				}
			}

			console.log("✅ Server-Daten angewendet (Basis-Fallback)");
			return true;
		} catch (error) {
			console.error("❌ Fehler beim Anwenden der Server-Daten:", error);
			return false;
		} finally {
			// Flag zurücksetzen mit Verzögerung um Race Conditions zu vermeiden
			setTimeout(() => {
				this.isApplyingServerData = false;
				window.isApplyingServerData = false;
				console.log("🏁 Server-Sync abgeschlossen, Flag zurückgesetzt");

				// Event-Handler nach Server-Load reaktivieren
				this.reactivateEventHandlers();

				// KRITISCH: Ampelfarben nach Server-Sync aktualisieren
				if (typeof window.updateAllStatusLightsForced === "function") {
					setTimeout(() => {
						window.updateAllStatusLightsForced();
						console.log(
							"🚦 Ampelfarben nach Server-Sync erzwungen aktualisiert"
						);
					}, 100);
				} else if (typeof window.updateAllStatusLights === "function") {
					setTimeout(() => {
						window.updateAllStatusLights();
						console.log("🚦 Ampelfarben nach Server-Sync aktualisiert");
					}, 100);
				} else if (typeof updateAllStatusLights === "function") {
					setTimeout(() => {
						updateAllStatusLights();
						console.log(
							"🚦 Ampelfarben nach Server-Sync aktualisiert (global)"
						);
					}, 100);
				}
			}, 1000); // 1 Sekunde Verzögerung
		}
	}

	/**
	 * NEUE HILFSFUNKTION: Wendet Kachel-Daten auf die UI an
	 */
	applyTileData(tiles, isSecondary = false) {
		console.log(
			`🏗️ Wende ${isSecondary ? "sekundäre" : "primäre"} Kachel-Daten an:`,
			tiles.length,
			"Kacheln"
		);

		tiles.forEach((tileData, index) => {
			const tileId = tileData.tileId || (isSecondary ? 101 + index : 1 + index);

			// Aircraft ID
			if (tileData.aircraftId) {
				const aircraftInput = document.getElementById(`aircraft-${tileId}`);
				if (aircraftInput) {
					aircraftInput.value = tileData.aircraftId;
					console.log(
						`✈️ Aircraft ID gesetzt: ${tileId} = ${tileData.aircraftId}`
					);
				}
			}

			// Position
			if (tileData.position) {
				const positionInput =
					document.getElementById(`hangar-position-${tileId}`) ||
					document.getElementById(`position-${tileId}`);
				if (positionInput) {
					positionInput.value = tileData.position;
					console.log(`📍 Position gesetzt: ${tileId} = ${tileData.position}`);
				}
			}

			// Notes
			if (tileData.notes) {
				const notesInput = document.getElementById(`notes-${tileId}`);
				if (notesInput) {
					notesInput.value = tileData.notes;
					console.log(`📝 Notizen gesetzt: ${tileId} = ${tileData.notes}`);
				}
			}

			// Arrival Time
			if (tileData.arrivalTime) {
				const arrivalInput = document.getElementById(`arrival-time-${tileId}`);
				if (arrivalInput) {
					arrivalInput.value = tileData.arrivalTime;
					console.log(
						`🛬 Ankunftszeit gesetzt: ${tileId} = ${tileData.arrivalTime}`
					);
				}
			}

			// Departure Time
			if (tileData.departureTime) {
				const departureInput = document.getElementById(
					`departure-time-${tileId}`
				);
				if (departureInput) {
					departureInput.value = tileData.departureTime;
					console.log(
						`🛫 Abflugzeit gesetzt: ${tileId} = ${tileData.departureTime}`
					);
				}
			}

			// Status
			if (tileData.status) {
				const statusSelect = document.getElementById(`status-${tileId}`);
				if (statusSelect) {
					statusSelect.value = tileData.status;
					console.log(`🚦 Status gesetzt: ${tileId} = ${tileData.status}`);
				}
			}

			// Tow Status
			if (tileData.towStatus) {
				const towStatusSelect = document.getElementById(`tow-status-${tileId}`);
				if (towStatusSelect) {
					towStatusSelect.value = tileData.towStatus;
					console.log(
						`🚚 Tow Status gesetzt: ${tileId} = ${tileData.towStatus}`
					);
				}
			}
		});
	}

	/**
	 * Prüft ob Daten geändert wurden (für optimierte Sync)
	 */
	hasDataChanged() {
		try {
			const currentData = this.collectCurrentData();

			// Entferne zeitabhängige Felder für Vergleich
			const compareData = { ...currentData };
			if (compareData.metadata) {
				delete compareData.metadata.lastModified;
				delete compareData.metadata.lastSaved;
			}

			const currentChecksum = this.generateChecksum(
				JSON.stringify(compareData)
			);

			if (this.lastDataChecksum !== currentChecksum) {
				// console.log("🔄 Datenänderung erkannt, Sync erforderlich");
				this.lastDataChecksum = currentChecksum;
				return true;
			}

			return false;
		} catch (error) {
			console.error("❌ Fehler bei Change-Detection:", error);
			return true; // Bei Fehler sync durchführen
		}
	}

	/**
	 * Generiert eine einfache Checksumme
	 */
	generateChecksum(str) {
		let hash = 0;
		for (let i = 0; i < str.length; i++) {
			const char = str.charCodeAt(i);
			hash = (hash << 5) - hash + char;
			hash = hash & hash; // Convert to 32-bit integer
		}
		return hash.toString();
	}

	/**
	 * Manueller Sync-Trigger
	 */
	async manualSync() {
		console.log("🔄 Manueller Server-Sync gestartet...");
		const success = await this.syncWithServer();

		if (success) {
			console.log("✅ Manueller Server-Sync erfolgreich");
			// Optional: Erfolgsmeldung anzeigen
			if (window.showNotification) {
				window.showNotification("Daten erfolgreich synchronisiert", "success");
			}
		} else {
			console.error("❌ Manueller Server-Sync fehlgeschlagen");
			// Optional: Fehlermeldung anzeigen
			if (window.showNotification) {
				window.showNotification("Synchronisation fehlgeschlagen", "error");
			}
		}

		return success;
	}

	/**
	 * Status der Server-Sync
	 */
	getStatus() {
		return {
			serverUrl: this.serverSyncUrl,
			isActive: !!this.serverSyncInterval,
			lastSync: this.lastDataChecksum ? new Date().toISOString() : null,
			isApplyingData: this.isApplyingServerData,
		};
	}

	/**
	 * Cleanup beim Zerstören
	 */
	destroy() {
		this.stopPeriodicSync();

		if (this.autoSaveTimeout) {
			clearTimeout(this.autoSaveTimeout);
			this.autoSaveTimeout = null;
		}

		console.log("🗑️ Server-Sync zerstört und bereinigt");
	}

	/**
	 * Testet die Server-Verbindung
	 */
	async testServerConnection(serverUrl) {
		try {
			console.log("🔍 Teste Server-Verbindung zu:", serverUrl);

			const response = await fetch(serverUrl, {
				method: "GET",
				headers: {
					Accept: "application/json",
				},
				// Timeout nach 5 Sekunden
				signal: AbortSignal.timeout(5000),
			});

			if (response.ok || response.status === 404) {
				// 404 ist OK - bedeutet nur, dass noch keine Daten vorhanden sind
				console.log("✅ Server-Verbindung erfolgreich");
				return true;
			} else {
				console.warn("⚠️ Server antwortet mit Status:", response.status);
				return false;
			}
		} catch (error) {
			console.error("❌ Server-Verbindungstest fehlgeschlagen:", error.message);
			return false;
		}
	}

	/**
	 * ERWEITERTE FUNKTION: Reaktiviert Event-Handler nach Server-Load
	 */
	reactivateEventHandlers() {
		console.log("🔄 Reaktiviere Event-Handler nach Server-Load...");

		// Event-Handler für sekundäre Kacheln reaktivieren - MIT VERBESSERTER LOGIK
		if (window.setupSecondaryTileEventListeners) {
			setTimeout(() => {
				const result = window.setupSecondaryTileEventListeners();
				console.log(
					"✅ Event-Handler für sekundäre Kacheln reaktiviert (global):",
					result
				);
			}, 100);
		} else if (
			window.hangarUI &&
			window.hangarUI.setupSecondaryTileEventListeners
		) {
			setTimeout(() => {
				const result = window.hangarUI.setupSecondaryTileEventListeners();
				console.log(
					"✅ Event-Handler für sekundäre Kacheln reaktiviert (hangarUI):",
					result
				);
			}, 100);
		} else {
			console.warn("⚠️ setupSecondaryTileEventListeners nicht verfügbar");
		}

		// Event-Handler über Event-Manager reaktivieren
		if (
			window.hangarEventManager &&
			window.hangarEventManager.setupUnifiedEventHandlers
		) {
			setTimeout(() => {
				window.hangarEventManager.setupUnifiedEventHandlers();
				console.log("✅ Unified Event-Handler reaktiviert");
			}, 200);
		}

		// Status-Indikatoren und UI-Updates
		setTimeout(() => {
			const statusElements = document.querySelectorAll('[id^="status-"]');
			statusElements.forEach((element) => {
				if (element.value && window.updateStatusLights) {
					const cellId = parseInt(element.id.replace("status-", ""));
					if (!isNaN(cellId)) {
						window.updateStatusLights(cellId);
					}
				}
			});
			console.log(
				`✅ ${statusElements.length} Status-Indikatoren aktualisiert`
			);
		}, 300);
	}

	/**
	 * Debug-Funktion: Zeigt aktuellen Sync-Status
	 */
	debugSyncStatus() {
		console.log("🔍 === SYNC STATUS DEBUG ===");
		console.log("Server URL:", this.serverSyncUrl);
		console.log("Project ID:", "Standard (kein Projekt-ID System)");
		console.log("Effektive Server URL:", this.getServerUrl());
		console.log("isApplyingServerData:", this.isApplyingServerData);
		console.log("window.isApplyingServerData:", window.isApplyingServerData);
		console.log("window.isLoadingServerData:", window.isLoadingServerData);
		console.log("window.isSavingToServer:", window.isSavingToServer);
		console.log("Display Options isLoading:", window.displayOptions?.isLoading);
		console.log("Display Options isSaving:", window.displayOptions?.isSaving);
		console.log("Periodische Sync aktiv:", !!this.serverSyncInterval);
		console.log("Master-Modus:", this.isMaster);
		console.log("Slave-Modus:", this.isSlaveActive);
		console.log(
			"Master-Slave Sync aktiv:",
			window.sharingManager?.isLiveSyncEnabled || false
		);
		console.log("=== END SYNC STATUS ===");
	}
}

// Globale Instanz für Kompatibilität
window.serverSync = new ServerSync();
window.storageBrowser = window.serverSync; // Alias für Kompatibilität

// Für Kompatibilität mit bestehender storage-browser.js
window.StorageBrowser = ServerSync;

// *** ZENTRALE INITIALISIERUNG STATT SEPARATER DOMContentLoaded ***
// Verwende zentrale Initialisierungsqueue statt separate DOMContentLoaded Events
window.hangarInitQueue = window.hangarInitQueue || [];
window.hangarInitQueue.push(async function () {
	console.log("🔄 Server-Sync wird über zentrale Initialisierung gestartet...");

	// PRODUKTIONS-Server-URL für hangarplanner.de
	const productionServerUrl = "https://hangarplanner.de/sync/data.php";

	// Fallback für lokale Entwicklung
	const localServerUrl = window.location.origin + "/sync/data.php";

	// Prüfe auf Server-Konfiguration oder verwende Produktions-URL
	let serverUrl = localStorage.getItem("hangarServerSyncUrl");

	// Wenn keine URL gespeichert ist, verwende Produktions-URL
	if (!serverUrl) {
		serverUrl = productionServerUrl;
		console.log("🌐 Verwende Produktions-Server:", productionServerUrl);
	} else {
		console.log("💾 Verwende gespeicherte Server-URL:", serverUrl);
	}

	if (window.serverSync) {
		window.serverSync.initSync(serverUrl);
		localStorage.setItem("hangarServerSyncUrl", serverUrl); // Für künftige Verwendung speichern
		console.log("🚀 Server-Sync initialisiert mit URL:", serverUrl);
	}
});

// SERVER-VERBINDUNGSTEST (verzögert)
setTimeout(async () => {
	if (!window.serverSync) return;

	const serverUrl =
		localStorage.getItem("hangarServerSyncUrl") ||
		"https://hangarplanner.de/sync/data.php";
	const isServerReachable = await window.serverSync.testServerConnection(
		serverUrl
	);

	if (!isServerReachable) {
		console.warn("⚠️ Server nicht erreichbar, verwende lokale Speicherung");

		// Fallback auf lokalen Server falls Produktions-Server nicht erreichbar
		if (serverUrl.includes("hangarplanner.de")) {
			const fallbackUrl = window.location.origin + "/sync/data.php";
			console.log("🔄 Versuche Fallback auf lokalen Server:", fallbackUrl);

			const isFallbackReachable = await window.serverSync.testServerConnection(
				fallbackUrl
			);
			if (isFallbackReachable) {
				window.serverSync.initSync(fallbackUrl);
				localStorage.setItem("hangarServerSyncUrl", fallbackUrl);
				console.log("✅ Fallback auf lokalen Server erfolgreich");
			}
		}
	} else {
		console.log("✅ Server-Verbindung bestätigt");
	}
}, 2000);

// KOORDINIERTES AUTO-LOAD: Verhindert Race Conditions und mehrfaches Laden
setTimeout(async () => {
	if (!window.serverSync) return;

	// Race Condition Guard - verhindert mehrfaches gleichzeitiges Laden
	if (window.serverSync.isApplyingServerData || window.isLoadingServerData) {
		console.log("⏸️ Server-Load bereits aktiv, überspringe Auto-Load");
		return;
	}

	window.isLoadingServerData = true;

	try {
		console.log("📥 Versuche koordinierten Server-Daten-Load beim Start...");

		const serverData = await window.serverSync.loadFromServer();

		if (serverData && !serverData.error) {
			// KRITISCHE PRÜFUNG: Nur laden wenn Server-Daten nicht leer sind
			const hasValidServerData =
				(serverData.primaryTiles && serverData.primaryTiles.length > 0) ||
				(serverData.secondaryTiles && serverData.secondaryTiles.length > 0) ||
				(serverData.settings && serverData.settings.displayOptions) ||
				(serverData.settings && Object.keys(serverData.settings).length > 0);

			if (hasValidServerData) {
				console.log("📥 Gültige Server-Daten gefunden, wende sie an...");
				const applied = await window.serverSync.applyServerData(serverData);

				if (applied) {
					console.log("✅ Server-Daten erfolgreich angewendet");
				} else {
					console.log("⚠️ Server-Daten konnten nicht angewendet werden");
				}
			} else {
				console.log("📭 Server-Daten sind leer, behalte lokale Einstellungen");

				// Bei leeren Server-Daten: Speichere aktuelle lokale Daten auf Server (debounced)
				if (window.displayOptions) {
					// Verzögert um Server-Last zu reduzieren
					setTimeout(async () => {
						await window.displayOptions.saveToServer();
						console.log(
							"💾 Lokale Einstellungen auf Server gesichert (debounced)"
						);
					}, 5000);
				}
			}
		} else {
			console.log("📭 Keine Server-Daten vorhanden, erstelle Basis-Daten");

			// Erstelle Basis-Datenstruktur auf Server (debounced)
			if (window.displayOptions) {
				setTimeout(async () => {
					await window.displayOptions.saveToServer();
					console.log("🏗️ Basis-Einstellungen auf Server erstellt (debounced)");
				}, 8000);
			}
		}
	} catch (error) {
		console.log("⚠️ Server-Daten konnten nicht geladen werden:", error.message);
	} finally {
		window.isLoadingServerData = false;
	}
}, 5000); // Erhöht auf 5 Sekunden für bessere Performance

console.log(
	"📦 Server-Sync-Modul geladen (Performance-optimiert: 120s Intervall, Change-Detection, Debouncing)"
);

// Globale Debug-Funktion für Synchronisations-Probleme
window.debugSync = function () {
	if (window.serverSync) {
		window.serverSync.debugSyncStatus();
	} else {
		console.log("❌ ServerSync nicht verfügbar");
	}
};

// Hilfe-Funktion
window.syncHelp = function () {
	console.log(`
🔧 SYNCHRONISATION DEBUG HILFE

Verfügbare Befehle:
- window.debugSync()                    → Zeigt aktuellen Sync-Status
- window.serverSync.manualSync()       → Startet manuellen Server-Sync
- window.displayOptions.load()         → Lädt Display Options vom Server
- window.displayOptions.saveToServer() → Speichert Display Options
- window.displayOptions.getPerformanceStats() → Performance-Statistiken

Performance-Flags:
- window.isApplyingServerData           → Server-Daten werden gerade angewendet
- window.isLoadingServerData            → Server-Daten werden gerade geladen
- window.isSavingToServer               → Daten werden gerade gespeichert

Performance-Optimierungen:
✅ Periodische Sync: 120s Intervall (statt 60s)
✅ Change-Detection: Nur bei Änderungen synchronisieren
✅ Debounced Saves: Sammelt mehrere Änderungen (1s Verzögerung)
✅ Request Timeouts: 8-10s Timeouts für Server-Anfragen
✅ Race Condition Guards: Verhindert mehrfache gleichzeitige Operationen
✅ Zentrale Initialisierung: Statt 26 separate DOMContentLoaded Events
	`);
};
