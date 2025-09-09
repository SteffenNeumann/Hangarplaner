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
		this.sessionId = null; // stable session id cached

		// Global verfügbar machen für Kompatibilität und Race Condition Prevention
		window.isApplyingServerData = false;
		window.isLoadingServerData = false;
		window.isSavingToServer = false;
	}

	/**
	 * AKTUALISIERT: Initialisiert Server-Synchronisation OHNE automatische Rollenerkennung
	 */
	async initSync(serverUrl) {
		this.serverSyncUrl = serverUrl;
		console.log("🔄 Server-Sync initialisiert:", serverUrl);

		// ENTFERNT: Automatische Master-Slave-Erkennung (wird jetzt über Toggles gesteuert)
		// Geändert: Erststart-Load NUR wenn Lesen erlaubt ist (Read Data = ON)
		try {
			if (this.canReadFromServer()) {
				console.log("📥 Lade Server-Daten beim Erststart (Read enabled)...");
				await this.loadInitialServerData();
			} else {
				console.log("⏭️ Überspringe Erststart-Load (Read disabled)");
			}
		} catch (e) {
			console.warn("⚠️ Erststart-Load Prüfung fehlgeschlagen:", e?.message || e);
		}

		// ENTFERNT: Automatische Modi-Aktivierung
		// Modi werden jetzt ausschließlich über SharingManager-Toggles gesteuert
		console.log("✅ Server-Sync bereit - warte auf Toggle-basierte Modus-Aktivierung");
	}

	/**
	 * Lädt Server-Daten beim Erststart (für beide Modi)
	 */
	async loadInitialServerData() {
		try {
			console.log("📥 Lade einmalige Server-Daten beim Erststart...");

			const serverData = await this.loadFromServer();
			if (serverData && !serverData.error) {
				// Prüfe ob gültige Daten vorhanden sind
				const hasValidData =
					(serverData.primaryTiles && serverData.primaryTiles.length > 0) ||
					(serverData.secondaryTiles && serverData.secondaryTiles.length > 0) ||
					(serverData.settings &&
						Object.keys(serverData.settings).length > 0) ||
					(serverData.metadata && serverData.metadata.projectName);

				if (hasValidData) {
					await this.applyServerData(serverData);
					console.log("✅ Erststart Server-Daten erfolgreich geladen");

					if (window.showNotification) {
						window.showNotification("Server-Daten beim Start geladen", "info");
					}
				} else {
					console.log("📭 Keine gültigen Server-Daten beim Erststart gefunden");
				}
			} else {
				console.log("ℹ️ Keine Server-Daten beim Erststart verfügbar");
			}
		} catch (error) {
			console.error("❌ Fehler beim Laden der Erststart Server-Daten:", error);
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
	 * Prüft, ob Lesen vom Server aktuell erlaubt ist (Read Data Toggle)
	 */
	canReadFromServer() {
		try {
			// Prefer explicit toggles when present
			const readToggle = document.getElementById('readDataToggle');
			if (readToggle) return !!readToggle.checked;
			// Fall back to sharingManager state if available
			if (window.sharingManager && typeof window.sharingManager.syncMode === 'string') {
				return window.sharingManager.syncMode === 'sync' || window.sharingManager.syncMode === 'master';
			}
		} catch (e) { /* noop */ }
		// Safe default: do not read unless explicitly enabled
		return false;
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
	 * AKTUALISIERT: Startet Master-Modus mit bidirektionaler Synchronisation
	 */
	startMasterMode() {
		this.isMaster = true;
		// Respect Read toggle: only receive if reading is enabled
		this.isSlaveActive = this.canReadFromServer();

		// Stoppe bestehende Intervalle
		if (this.slaveCheckInterval) {
			clearInterval(this.slaveCheckInterval);
			this.slaveCheckInterval = null;
		}
		this.stopPeriodicSync();

		// Starte Master-Synchronisation fürs Senden
		this.startPeriodicSync(); // Für das Senden von Daten

		// Nur wenn Lesen erlaubt ist, zusätzlich Updates empfangen (längeres Intervall)
		if (this.isSlaveActive) {
			this.slaveCheckInterval = setInterval(async () => {
				await this.slaveCheckForUpdates();
			}, 30000); // 30 Sekunden für Master-Update-Check
			console.log("👑 Master-Modus: Empfange zusätzlich Updates (Read ON)");
		} else {
			console.log("👑 Master-Modus: Write-only aktiv (Read OFF) – kein Server-Read");
		}

		// Sofort einen ersten Schreibversuch starten, damit andere Browser zeitnah Daten erhalten
		try {
			this.syncWithServer();
		} catch (e) {
			console.warn("⚠️ Sofortiger Master-Sync fehlgeschlagen:", e?.message || e);
		}

		console.log("👑 Master-Modus gestartet – Senden aktiv, Empfangen:", this.isSlaveActive ? 'AN' : 'AUS');
	}

	/**
	 * NEUE METHODE: Startet Slave-Modus
	 */
	startSlaveMode() {
		this.isMaster = false;
		this.isSlaveActive = true;

		// Stoppe normale Sync falls aktiv
		this.stopPeriodicSync();

		// Cleanup bestehende Slave-Intervalle
		if (this.slaveCheckInterval) {
			clearInterval(this.slaveCheckInterval);
			this.slaveCheckInterval = null;
		}

		// Starte Slave-Polling (nur Laden bei Änderungen)
		this.slaveCheckInterval = setInterval(async () => {
			await this.slaveCheckForUpdates();
		}, 15000); // 15 Sekunden Polling-Intervall

		console.log(
			"👤 Slave-Modus gestartet - Polling für Updates alle 15 Sekunden aktiv"
		);
		// HINWEIS: Initialer Load erfolgt bereits in initSync()

		// Sofort einen Update-Check ausführen, damit Daten ohne Wartezeit geladen werden
		try {
			this.slaveCheckForUpdates();
		} catch (e) {
			console.warn("⚠️ Sofortiger Slave-Update-Check fehlgeschlagen:", e?.message || e);
		}
	}

	/**
	 * NEUE METHODE: Slave prüft auf Server-Updates
	 */
	async slaveCheckForUpdates() {
		if (!this.isSlaveActive) return;

		try {
			console.log("🔍 Slave: Prüfe auf Server-Updates...");
			const currentServerTimestamp = await this.getServerTimestamp();
			console.log(
				`📊 Server-Timestamp: ${currentServerTimestamp}, Letzter: ${this.lastServerTimestamp}`
			);

			if (currentServerTimestamp > this.lastServerTimestamp) {
				console.log("🔄 Slave: Neue Daten auf Server erkannt, lade Updates...");

				const serverData = await this.loadFromServer();
				if (serverData && !serverData.error) {
					await this.applyServerData(serverData);
					this.lastServerTimestamp = currentServerTimestamp;
					console.log(
						"✅ Slave: Server-Daten erfolgreich geladen und angewendet"
					);

					// Benachrichtigung für erfolgreiche Updates
					if (window.showNotification) {
						window.showNotification("Server-Updates empfangen", "info");
					}
				} else {
					console.warn("⚠️ Slave: Server-Daten konnten nicht geladen werden");
				}
			} else {
				console.log("⏸️ Slave: Keine neuen Änderungen auf Server");
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
			if (window.showNotification) {
				window.showNotification("Server-URL nicht konfiguriert – Sync übersprungen", "warning");
			}
			return false;
		}

		// NEUE PRÜFUNG: Nur Master darf speichern
		if (!this.isMaster) {
			console.log("⛔ Read-only mode: save skipped (client not master)");
			if (window.showNotification) {
				window.showNotification("Read-only Modus – Schreiben zum Server deaktiviert", "info");
			}
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
			// Header nur im Master-Modus setzen
			const headers = {
				"Content-Type": "application/json",
			};
			if (this.isMaster) {
				headers["X-Sync-Role"] = "master";
			}
			// Always provide a stable session for server lock coordination
			try {
				const sid = this.getSessionId();
				if (sid) headers["X-Sync-Session"] = sid;
				const dname = (localStorage.getItem('presence.displayName') || '').trim();
				if (dname) headers["X-Display-Name"] = dname;
			} catch(_e) {}
			const response = await fetch(serverUrl, {
				method: "POST",
				headers,
				body: JSON.stringify(currentData),
				signal: controller.signal,
			});

			clearTimeout(timeoutId);

				if (response.ok) {
					console.log("✅ Master: Server-Sync erfolgreich");
					// Reset API-Sync-Bypass-Flag nach erfolgreicher Speicherung
					if (window.HangarDataCoordinator) {
						window.HangarDataCoordinator.apiChangesPendingSync = false;
					}
					return true;
				} else if (response.status === 423) {
					let payload = null;
					try { payload = await response.json(); } catch(_e) {}
					console.warn("⛔ Server returned 423 Locked (master lock held)", payload);
					if (window.showNotification) {
						const holder = payload?.holder?.displayName ? ` by ${payload.holder.displayName}` : '';
						window.showNotification(`Write denied: Master lock held${holder}`, 'error');
					}
					try { if (window.sharingManager && typeof window.sharingManager.handleMasterDeniedByServer === 'function') { window.sharingManager.handleMasterDeniedByServer(payload); } } catch(_e) {}
					return false;
				} else {
				let detail = '';
				try { detail = await response.text(); } catch (e) { /* noop */ }
				console.warn("⚠️ Server-Sync fehlgeschlagen:", response.status, detail);
				if (window.showNotification) {
					window.showNotification(`Server-Sync fehlgeschlagen: ${response.status}${detail ? ' • ' + detail : ''}`, 'error');
				}
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
				let data = window.hangarData.collectAllHangarData();

				// Normalize collector output to server schema if needed
				try {
					if (data && !data.primaryTiles && (Array.isArray(data.primary) || Array.isArray(data.secondary))) {
						const mapTile = (row) => ({
							tileId: row.id,
							aircraftId: row.aircraft || '',
							arrivalTime: row.arrival || '',
							departureTime: row.departure || '',
							position: row.position || '',
							// keep hangarPosition as part of position data if present
							hangarPosition: row.hangarPosition || '',
							status: row.status || 'neutral',
							towStatus: row.tow || 'neutral',
							notes: row.notes || '',
						});
						data = {
							metadata: data.metadata || {},
							settings: data.settings || {},
							primaryTiles: (data.primary || []).map(mapTile),
							secondaryTiles: (data.secondary || []).map(mapTile),
						};
						console.log('🔁 Normalized collector output → server schema', {
							primary: data.primaryTiles.length,
							secondary: data.secondaryTiles.length,
						});
					}
				} catch(e) { console.warn('Collector normalization failed', e); }

				// *** NEU: Display Options ergänzen ***
					if (window.displayOptions) {
						// Sammle aktuelle UI-Werte
						window.displayOptions.collectFromUI();

						// Füge Display Options zu den Einstellungen hinzu, aber NIEMALS darkMode synchronisieren
						if (!data.settings) data.settings = {};
						const opts = { ...window.displayOptions.current };
						delete opts.darkMode; // Theme bleibt stets lokal
						data.settings.displayOptions = opts;

						console.log(
							"🎛️ Display Options zu Server-Daten hinzugefügt (ohne darkMode):",
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
				const opts = { ...window.displayOptions.current };
				delete opts.darkMode; // Theme nie auf Server schreiben
				data.settings.displayOptions = opts;
				console.log("🎛️ Display Options zu Fallback-Daten hinzugefügt (ohne darkMode)");
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

			// ERWEITERTE DEBUG: Prüfe verfügbare Datenhandler und DOM-Elemente
			console.log("🔍 DEBUG: Verfügbare Datenhandler:");
			console.log("- window.dataCoordinator:", !!window.dataCoordinator);
			console.log("- window.hangarData:", !!window.hangarData);
			console.log(
				"- window.hangarData.applyLoadedHangarPlan:",
				typeof window.hangarData?.applyLoadedHangarPlan
			);

			// NEUE DEBUG: DOM-Elemente prüfen
			console.log("🔍 DEBUG: DOM-Elemente verfügbar:");
			const aircraft1 = document.getElementById("aircraft-1");
			const position1 = document.getElementById("hangar-position-1");
			const notes1 = document.getElementById("notes-1");
			console.log("- aircraft-1 Element:", !!aircraft1, aircraft1?.tagName);
			console.log(
				"- hangar-position-1 Element:",
				!!position1,
				position1?.tagName
			);
			console.log("- notes-1 Element:", !!notes1, notes1?.tagName);

			console.log("- serverData Struktur:", {
				hasPrimaryTiles: !!(
					serverData.primaryTiles && serverData.primaryTiles.length > 0
				),
				primaryTilesCount: serverData.primaryTiles?.length || 0,
				hasSecondaryTiles: !!(
					serverData.secondaryTiles && serverData.secondaryTiles.length > 0
				),
				secondaryTilesCount: serverData.secondaryTiles?.length || 0,
				hasSettings: !!serverData.settings,
				hasMetadata: !!serverData.metadata,
			});

			// NEUE DEBUG: Zeige erste Kachel-Daten
			if (serverData.primaryTiles && serverData.primaryTiles.length > 0) {
				console.log(
					"🔍 DEBUG: Erste Kachel-Daten:",
					serverData.primaryTiles[0]
				);
			}

			// *** PRIORITÄT 1: Display Options aus Serverdaten anwenden ***
			if (
				serverData.settings &&
				serverData.settings.displayOptions &&
				window.displayOptions
			) {
				// Server-Display-Options in das aktuelle Display Options System laden (ohne darkMode)
				const serverOpts = { ...serverData.settings.displayOptions };
				delete serverOpts.darkMode;
				window.displayOptions.current = {
					...window.displayOptions.defaults,
					...serverOpts,
				};
				// CRITICAL: Respect locally persisted theme (never let server override user's choice)
				try {
					const persisted = (localStorage.getItem('hangar.theme') || '').toLowerCase();
					if (persisted === 'dark') {
						window.displayOptions.current.darkMode = true;
					} else if (persisted === 'light') {
						window.displayOptions.current.darkMode = false;
					} else {
						// Fallback: derive from current DOM if set
						const domDark = document.documentElement.classList.contains('dark-mode') || (document.body && document.body.classList.contains('dark-mode'));
						if (domDark) window.displayOptions.current.darkMode = true;
					}
				} catch (e) { /* noop */ }
				window.displayOptions.updateUI();
				window.displayOptions.applySettings();
				console.log(
					"🎛️ Display Options vom Server angewendet (theme respected from local):",
					window.displayOptions.current
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
				console.log("🔄 Verwende dataCoordinator für Server-Daten...");
				window.dataCoordinator.loadProject(serverData, "server");
				console.log("✅ Server-Daten über Datenkoordinator angewendet");
				try { this.lastLoadedAt = Date.now(); document.dispatchEvent(new CustomEvent('serverDataLoaded', { detail: { loadedAt: this.lastLoadedAt } })); } catch(e){}
				return true;
			}

			// Fallback: Direkte Anwendung (nur wenn Koordinator nicht verfügbar)
			if (
				window.hangarData &&
				typeof window.hangarData.applyLoadedHangarPlan === "function"
			) {
				console.log(
					"🔄 Verwende hangarData.applyLoadedHangarPlan für Server-Daten..."
				);
				const result = window.hangarData.applyLoadedHangarPlan(serverData);
				console.log(
					"✅ Server-Daten über hangarData angewendet (Fallback), Ergebnis:",
					result
				);
				if (result) { try { this.lastLoadedAt = Date.now(); document.dispatchEvent(new CustomEvent('serverDataLoaded', { detail: { loadedAt: this.lastLoadedAt } })); } catch(e){} }
				return result;
			}

			// ERWEITERT: Direkter Fallback für Kachel-Daten
			console.log(
				"⚠️ Keine Standard-Datenhandler verfügbar, verwende direkten Fallback..."
			);
			let applied = false;

			// Direkte Anwendung der Kachel-Daten
			if (serverData.primaryTiles && serverData.primaryTiles.length > 0) {
				console.log("🔄 Wende primäre Kachel-Daten direkt an...");
				this.applyTileData(serverData.primaryTiles, false);
				applied = true;
			}

			if (serverData.secondaryTiles && serverData.secondaryTiles.length > 0) {
				console.log("🔄 Wende sekundäre Kachel-Daten direkt an...");
				this.applyTileData(serverData.secondaryTiles, true);
				applied = true;
			}

			// Basis-Fallback für Projektname
			if (serverData.metadata && serverData.metadata.projectName) {
				const projectNameInput = document.getElementById("projectName");
				if (projectNameInput) {
					projectNameInput.value = serverData.metadata.projectName;
					console.log(
						"📝 Projektname gesetzt:",
						serverData.metadata.projectName
					);
					applied = true;
				}
			}

			if (applied) {
				console.log("✅ Server-Daten über direkten Fallback angewendet");
				try { this.lastLoadedAt = Date.now(); document.dispatchEvent(new CustomEvent('serverDataLoaded', { detail: { loadedAt: this.lastLoadedAt } })); } catch(e){}
				return true;
			} else {
				console.warn("⚠️ Keine Server-Daten konnten angewendet werden");
				console.warn("⚠️ Keine Server-Daten konnten angewendet werden");
				return false;
			}
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

		let successfullyApplied = 0;
		let failedToApply = 0;

		tiles.forEach((tileData, index) => {
			const tileId = tileData.tileId || (isSecondary ? 101 + index : 1 + index);
			console.log(`🔄 Verarbeite Kachel ${tileId}:`, tileData);

			// Aircraft ID
			if (tileData.aircraftId) {
				const aircraftInput = document.getElementById(`aircraft-${tileId}`);
				if (aircraftInput) {
					const oldValue = aircraftInput.value;
					aircraftInput.value = tileData.aircraftId;
					console.log(
						`✈️ Aircraft ID gesetzt: ${tileId} = ${oldValue} → ${tileData.aircraftId}`
					);
					successfullyApplied++;
				} else {
					console.warn(`❌ Aircraft Input nicht gefunden: aircraft-${tileId}`);
					failedToApply++;
				}
			}

			// Position
			if (tileData.position) {
				const positionInput =
					document.getElementById(`hangar-position-${tileId}`) ||
					document.getElementById(`position-${tileId}`);
				if (positionInput) {
					const oldValue = positionInput.value;
					positionInput.value = tileData.position;
					console.log(
						`📍 Position gesetzt: ${tileId} = ${oldValue} → ${tileData.position}`
					);
					successfullyApplied++;
				} else {
					console.warn(
						`❌ Position Input nicht gefunden: hangar-position-${tileId} oder position-${tileId}`
					);
					failedToApply++;
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
					let toSet = tileData.arrivalTime;
					if (arrivalInput.type === 'datetime-local' && window.helpers) {
						const h = window.helpers;
						if (h.isDateTimeLocal && h.isDateTimeLocal(tileData.arrivalTime)) {
							toSet = tileData.arrivalTime;
						} else if (h.isHHmm && h.isHHmm(tileData.arrivalTime) && h.getBaseDates && h.coerceHHmmToDateTimeLocalUtc) {
							const bases = h.getBaseDates();
							toSet = h.coerceHHmmToDateTimeLocalUtc(tileData.arrivalTime, bases.arrivalBase || '');
						}
					}
					arrivalInput.value = toSet || '';
					console.log(
						`🛬 Ankunftszeit gesetzt: ${tileId} = ${toSet || ''}`
					);
				}
			}

			// Departure Time
			if (tileData.departureTime) {
				const departureInput = document.getElementById(
					`departure-time-${tileId}`
				);
				if (departureInput) {
					let toSet = tileData.departureTime;
					if (departureInput.type === 'datetime-local' && window.helpers) {
						const h = window.helpers;
						if (h.isDateTimeLocal && h.isDateTimeLocal(tileData.departureTime)) {
							toSet = tileData.departureTime;
						} else if (h.isHHmm && h.isHHmm(tileData.departureTime) && h.getBaseDates && h.coerceHHmmToDateTimeLocalUtc) {
							const bases = h.getBaseDates();
							toSet = h.coerceHHmmToDateTimeLocalUtc(tileData.departureTime, bases.departureBase || '');
						}
					}
					departureInput.value = toSet || '';
					console.log(
						`🛫 Abflugzeit gesetzt: ${tileId} = ${toSet || ''}`
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
					const oldValue = towStatusSelect.value;
					towStatusSelect.value = tileData.towStatus;
					console.log(
						`🚚 Tow Status gesetzt: ${tileId} = ${oldValue} → ${tileData.towStatus}`
					);
					// WICHTIG: Styling der Tow-Status-Selects nach programmatischer Änderung aktualisieren
					try {
						if (typeof window.updateTowStatusStyles === 'function') {
							window.updateTowStatusStyles(towStatusSelect);
						} else if (typeof updateTowStatusStyles === 'function') {
							updateTowStatusStyles(towStatusSelect);
						} else {
							// Fallback: Klassen direkt setzen, keine Inline-Farben
							const v = (towStatusSelect.value || 'neutral').trim();
							towStatusSelect.classList.remove('tow-neutral','tow-initiated','tow-ongoing','tow-on-position');
							towStatusSelect.classList.add(`tow-${v}`);
							towStatusSelect.style.backgroundColor = '';
							towStatusSelect.style.color = '';
							towStatusSelect.style.borderColor = '';
							towStatusSelect.style.borderLeftColor = '';
						}
					} catch(e) {
						console.warn('⚠️ Tow-Status Styling-Aktualisierung fehlgeschlagen:', e);
					}
					successfullyApplied++;
				} else {
					console.warn(
						`❌ Tow Status Select nicht gefunden: tow-status-${tileId}`
					);
					failedToApply++;
				}
			}

			// Last-Update Badge aus geladenen Daten wiederherstellen (falls vorhanden)
			if (tileData.updatedAt && typeof window.createOrUpdateLastUpdateBadge === 'function') {
				const ts = Date.parse(tileData.updatedAt);
				if (!isNaN(ts)) {
					window.createOrUpdateLastUpdateBadge(tileId, 'server', ts, { persist: true });
				}
			}
		});

		// NEUE ZUSAMMENFASSUNG
		console.log(`📊 Kachel-Daten Anwendung Ergebnis:`, {
			type: isSecondary ? "sekundär" : "primär",
			totalTiles: tiles.length,
			successfullyApplied,
			failedToApply,
			successRate: `${Math.round(
				(successfullyApplied / (successfullyApplied + failedToApply)) * 100
			)}%`,
		});

		return successfullyApplied > 0;
	}

	/**
	 * Prüft ob Daten geändert wurden (für optimierte Sync)
	 */
	hasDataChanged() {
		try {
			// WICHTIG: Prüfe ob kürzlich API-Updates stattgefunden haben
			if (
				window.HangarDataCoordinator &&
				window.HangarDataCoordinator.dataSource === "api"
			) {
				const lastApiUpdate = window.HangarDataCoordinator.lastUpdate;
				if (lastApiUpdate) {
					const timeSinceApiUpdate =
						Date.now() - new Date(lastApiUpdate).getTime();
						// Blockiere Server-Sync für 5 Minuten nach API-Update
						if (timeSinceApiUpdate < 300000) {
							// 5 Minuten in Millisekunden
							if (
								window.HangarDataCoordinator &&
								window.HangarDataCoordinator.apiChangesPendingSync
							) {
								console.log(
									"⏭️ API Sync-Bypass aktiviert: Update-Änderungen werden synchronisiert"
								);
								// kein return; weiter mit normaler Change-Detection
							} else {
								console.log(
									"⏸️ Server-Sync pausiert: Kürzliche API-Updates schützen"
								);
								return false;
							}
						}
				}
			}

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

	// Provide stable session id for lock coordination with server
	getSessionId() {
		try {
			let sid = localStorage.getItem('presence.sessionId') || localStorage.getItem('serverSync.sessionId');
			if (!sid || typeof sid !== 'string' || !sid.length) {
				sid = Math.random().toString(36).slice(2) + Date.now().toString(36);
				try { localStorage.setItem('serverSync.sessionId', sid); } catch(_e) {}
			}
			this.sessionId = sid;
			return sid;
		} catch(e) {
			if (!this.sessionId) {
				this.sessionId = Math.random().toString(36).slice(2) + Date.now().toString(36);
			}
			return this.sessionId;
		}
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

			// Tow-Status Styling nach Server-Load sicher aktualisieren
			setTimeout(() => {
				const towElements = document.querySelectorAll('.tow-status-selector');
				towElements.forEach((select) => {
					try {
						if (typeof window.updateTowStatusStyles === 'function') {
							window.updateTowStatusStyles(select);
						} else if (typeof updateTowStatusStyles === 'function') {
							updateTowStatusStyles(select);
						} else {
							const v = (select.value || 'neutral').trim();
							select.classList.remove('tow-neutral','tow-initiated','tow-ongoing','tow-on-position');
							select.classList.add(`tow-${v}`);
							select.style.backgroundColor = '';
							select.style.color = '';
							select.style.borderColor = '';
							select.style.borderLeftColor = '';
						}
					} catch(e) {
						console.warn('⚠️ Tow-Status Styling-Refresh fehlgeschlagen:', e);
					}
				});
				console.log(`✅ ${towElements.length} Tow-Status Styles aktualisiert`);
			}, 400);
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
		console.log("Slave-Check-Intervall ID:", this.slaveCheckInterval);
		console.log("Letzter Server-Timestamp:", this.lastServerTimestamp);
		console.log(
			"Master-Slave Sync aktiv:",
			window.sharingManager?.isLiveSyncEnabled || false
		);
		console.log("=== END SYNC STATUS ===");
	}

	/**
	 * NEUE METHODE: Bereinigt alle Intervalle und Ressourcen
	 */
	destroy() {
		this.stopPeriodicSync();

		if (this.slaveCheckInterval) {
			clearInterval(this.slaveCheckInterval);
			this.slaveCheckInterval = null;
			console.log("🧹 Slave-Check-Intervall bereinigt");
		}

		this.serverSyncUrl = null;
		this.lastDataChecksum = null;
		this.lastServerTimestamp = 0;
		this.isMaster = false;
		this.isSlaveActive = false;

		console.log("🧹 ServerSync vollständig bereinigt");
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

console.log(
	"📦 Server-Sync-Modul geladen (Performance-optimiert: Master 120s, Slave 15s Intervalle, Change-Detection, initSync mit Erststart-Load)"
);

// Kleine Debug-Hilfe: Server-Lock anzeigen
window.debugServerLock = async function(){
	try {
		const u = (window.serverSync && typeof window.serverSync.getServerUrl==='function') ? window.serverSync.getServerUrl() : (window.serverSync?.serverSyncUrl || '');
		if (!u) { console.log('No server URL'); return; }
		const res = await fetch(u + (u.includes('?') ? '&' : '?') + 'action=lock');
		const data = await res.json();
		console.log('🔒 Server lock info:', data);
	} catch(e){ console.warn('debugServerLock failed', e); }
};

// Globale Debug-Funktion für Synchronisations-Probleme
window.debugSync = function () {
	if (window.serverSync) {
		window.serverSync.debugSyncStatus();
	} else {
		console.log("❌ ServerSync nicht verfügbar");
	}
};

// NEUE FUNKTION: Setzt hängende Sync-Flags zurück
window.resetSyncFlags = function () {
	console.log("🔧 SETZE SYNC-FLAGS ZURÜCK...");

	const wasFlagged =
		window.serverSync?.isApplyingServerData ||
		window.isApplyingServerData ||
		window.isLoadingServerData ||
		window.isSavingToServer;

	if (window.serverSync) {
		window.serverSync.isApplyingServerData = false;
	}
	window.isApplyingServerData = false;
	window.isLoadingServerData = false;
	window.isSavingToServer = false;

	if (wasFlagged) {
		console.log("✅ Hängende Sync-Flags wurden zurückgesetzt");
		window.debugSync(); // Zeige neuen Status
	} else {
		console.log("ℹ️ Keine hängenden Flags gefunden");
	}
};

// NEUER DEBUG-BEFEHL: Testet explizit Read-Modus
window.testReadMode = function () {
	console.log("🧪 TESTE READ-MODUS FUNKTIONALITÄT");

	if (!window.serverSync) {
		console.log("❌ ServerSync nicht verfügbar");
		return;
	}

	// KRITISCH: Flags zurücksetzen falls sie hängen
	if (window.serverSync.isApplyingServerData || window.isApplyingServerData) {
		console.log("🔧 RESETZE HÄNGENDE FLAGS...");
		window.serverSync.isApplyingServerData = false;
		window.isApplyingServerData = false;
		console.log("✅ Flags zurückgesetzt");
	}

	console.log("1. Aktueller Status:");
	window.serverSync.debugSyncStatus();

	console.log("2. Aktiviere Read-Modus manuell:");
	window.serverSync.isMaster = false;
	window.serverSync.isSlaveActive = true;
	window.serverSync.startSlaveMode();

	console.log("3. Status nach Read-Modus-Aktivierung:");
	setTimeout(() => {
		window.serverSync.debugSyncStatus();

		console.log("4. Führe manuellen Slave-Check durch:");
		window.serverSync.slaveCheckForUpdates();

		console.log("5. Teste Server-Daten-Anwendung in 5 Sekunden...");
		setTimeout(async () => {
			console.log("🧪 TESTE SERVER-DATEN-ANWENDUNG:");

			// Lade aktuelle Server-Daten
			const serverData = await window.serverSync.loadFromServer();
			if (serverData) {
				console.log("📥 Server-Daten geladen:", serverData);

				// Teste applyServerData direkt
				const applied = await window.serverSync.applyServerData(serverData);
				console.log("✅ Server-Daten-Anwendung Ergebnis:", applied);
			} else {
				console.log("❌ Keine Server-Daten verfügbar für Test");
			}

			// NEUE DOM-MANIPULATION TESTS
			console.log("🧪 TESTE DIREKTE DOM-MANIPULATION:");
			const testData = {
				aircraftId: "TEST-123",
				position: "A1-TEST",
				notes: "Test-Notiz vom Debug",
			};

			// Teste direkte DOM-Manipulation auf Kachel 1
			const aircraft1 = document.getElementById("aircraft-1");
			const position1 = document.getElementById("hangar-position-1");
			const notes1 = document.getElementById("notes-1");

			console.log("DOM-Elemente gefunden:", {
				aircraft1: !!aircraft1,
				position1: !!position1,
				notes1: !!notes1,
			});

			if (aircraft1) {
				aircraft1.value = testData.aircraftId;
				console.log("✅ Aircraft ID direkt gesetzt:", testData.aircraftId);
			}
			if (position1) {
				position1.value = testData.position;
				console.log("✅ Position direkt gesetzt:", testData.position);
			}
			if (notes1) {
				notes1.value = testData.notes;
				console.log("✅ Notizen direkt gesetzt:", testData.notes);
			}
		}, 5000);
	}, 2000);
}; // Hilfe-Funktion
window.syncHelp = function () {
	console.log(`
🔧 SYNCHRONISATION DEBUG HILFE

Verfügbare Befehle:
- window.debugSync()                    → Zeigt aktuellen Sync-Status
- window.testReadMode()                 → Testet Read-Modus explizit
- window.serverSync.manualSync()       → Startet manuellen Server-Sync
- window.displayOptions.load()         → Lädt Display Options vom Server
- window.displayOptions.saveToServer() → Speichert Display Options
- window.displayOptions.getPerformanceStats() → Performance-Statistiken

Performance-Flags:
- window.isApplyingServerData           → Server-Daten werden gerade angewendet
- window.isLoadingServerData            → Server-Daten werden gerade geladen
- window.isSavingToServer               → Daten werden gerade gespeichert

Performance-Optimierungen:
✅ Slave-Polling: 15s Intervall (hochfrequent für Read-Modus)
✅ Master-Sync: 120s Intervall (nur bei Änderungen)
✅ Change-Detection: Nur bei Änderungen synchronisieren
✅ Debounced Saves: Sammelt mehrere Änderungen (1s Verzögerung)
✅ Request Timeouts: 8-10s Timeouts für Server-Anfragen
✅ Race Condition Guards: Verhindert mehrfache gleichzeitige Operationen
✅ Zentrale Initialisierung: Statt 26 separate DOMContentLoaded Events
	`);
};
