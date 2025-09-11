/**
 * Server-Synchronisation für HangarPlanner
 * Reduzierte Version - nur Server-Sync ohne Event-Handler
 * Optimiert von 2085 → ~400 Zeilen
 */

class ServerSync {
	constructor() {
		// Set a safe default so sync is configured even if initSync is delayed
		try {
			this.serverSyncUrl = window.location.origin + "/sync/data.php";
		} catch(_e) {
			this.serverSyncUrl = "/sync/data.php";
		}
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

		// Client-side write fencing to prevent self-echo/oscillation in multi-master
		this._pendingWrites = {}; // { fieldId: timestampMs }
		this._writeFenceMs = 1200; // fence TTL window

		// Baseline of last server-applied data to compute precise deltas (fieldUpdates)
		this._baselinePrimary = {};
		this._baselineSecondary = {};

		// Global verfügbar machen für Kompatibilität und Race Condition Prevention
		window.isApplyingServerData = false;
		window.isLoadingServerData = false;
		window.isSavingToServer = false;

		// Bind critical instance methods so they are always present as own props
		try {
			this.applyServerData = this.applyServerData.bind(this);
			this.applyTileData = this.applyTileData.bind(this);
		} catch(_e){}
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
					(serverData.settings && Object.keys(serverData.settings).length > 0) ||
					(serverData.metadata && serverData.metadata.projectName);

				if (hasValidData) {
					// Wende Server-Daten an
					const applied = await window.serverSync.applyServerData(serverData);
					if (applied) {
						console.log("✅ Server-Daten sofort geladen und angewendet");
						// Subtle author pills for tiles updated by server (multi-master)
						try {
							const allTiles = [];
							if (Array.isArray(serverData.primaryTiles)) allTiles.push(...serverData.primaryTiles);
							if (Array.isArray(serverData.secondaryTiles)) allTiles.push(...serverData.secondaryTiles);
							allTiles.forEach(t => {
								const id = parseInt(t?.tileId || 0, 10);
								const ts = Date.parse(t?.updatedAt || '') || null;
								const author = (t?.updatedBy || serverData?.metadata?.lastWriter || '').trim();
								if (id && ts && author && typeof window.createOrUpdateUpdateAuthorPill === 'function') {
									window.createOrUpdateUpdateAuthorPill(id, author, ts, { source: 'server' });
								}
							});
						} catch(_e) {}
						// Benachrichtigung anzeigen falls verfügbar
						if (window.showNotification) {
							window.showNotification(`Server-Daten geladen (${this.syncMode} Modus)`, "success");
						}
						return true;
					} else {
						console.warn("⚠️ Server-Daten konnten nicht angewendet werden");
						return false;
					}
				} else {
					console.log("ℹ️ Keine gültigen Server-Daten gefunden");
					return false;
				}
			} else {
				console.log("ℹ️ Keine Server-Daten verfügbar für sofortige Ladung");
				return false;
			}
		} catch (e) {
			console.warn("⚠️ Erststart-Load fehlgeschlagen:", e?.message || e);
			return false;
		}
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
	 * Startet die periodische Synchronisation (Master-Modus)
	 */
	startPeriodicSync() {
		try {
			if (this.serverSyncInterval) {
				clearInterval(this.serverSyncInterval);
			}
			this.serverSyncInterval = setInterval(() => {
				try {
					if (
						!this.isApplyingServerData &&
						!window.isApplyingServerData &&
						!window.isLoadingServerData &&
						!window.isSavingToServer &&
						this.hasDataChanged()
					) {
						this.syncWithServer();
					}
				} catch (_e) {}
			}, 5000);
			console.log("⏰ Periodische Server-Sync gestartet (5s Intervall, Change-Detection)");
		} catch (e) {
			console.warn('startPeriodicSync failed', e);
		}
	}

	/**
	 * VEREINFACHT: Nur Standard Server-URL ohne Projekt-IDs
	 */
	getServerUrl() {
		try {
			return this.serverSyncUrl || (window.location.origin + "/sync/data.php");
		} catch(_e) {
			return this.serverSyncUrl || "/sync/data.php";
		}
	}

	/**
	 * Build/refresh baseline maps from server data (used for delta posting)
	 */
	_updateBaselineFromServerData(serverData) {
		try {
			const toMap = (arr)=>{
				const m = {};
				(arr||[]).forEach(t=>{ const id = parseInt(t?.tileId||0,10); if (id) m[id] = { ...t, tileId: id }; });
				return m;
			};
			this._baselinePrimary = toMap(serverData?.primaryTiles||[]);
			this._baselineSecondary = toMap(serverData?.secondaryTiles||[]);
			// Optionally store timestamp baseline for preflight checks
			try { if (serverData?.metadata?.timestamp) this.lastServerTimestamp = Math.max(this.lastServerTimestamp||0, parseInt(serverData.metadata.timestamp,10)||0); } catch(_e){}
			console.log('📌 Baseline aktualisiert', { primary: Object.keys(this._baselinePrimary).length, secondary: Object.keys(this._baselineSecondary).length });
		} catch(e) { console.warn('Baseline update failed', e); }
	}

	// ===== Write-fence helpers (anti-oscillation) =====
	_now(){ try { return Date.now(); } catch(_e) { return new Date().getTime(); } }
	_markPendingWrite(fieldId){ try { if (!fieldId) return; this._pendingWrites[fieldId] = this._now(); } catch(_e){} }
	_isWriteFenceActive(fieldId){ try { if (!fieldId) return false; const ts = this._pendingWrites[fieldId] || 0; return ts && (this._now() - ts) < this._writeFenceMs; } catch(_e){ return false; } }
	_hasActiveFences(){ try { const now = this._now(); const win = this._writeFenceMs; return Object.values(this._pendingWrites||{}).some(ts => (now - ts) < win); } catch(_e){ return false; } }
	_fieldIdFor(tileId, key){
		try {
			const id = parseInt(tileId||0,10); if (!id) return null;
			switch(key){
				case 'aircraftId': return `aircraft-${id}`;
				case 'arrivalTime': return `arrival-time-${id}`;
				case 'departureTime': return `departure-time-${id}`;
				case 'hangarPosition': return `hangar-position-${id}`;
				case 'position': return `position-${id}`;
				case 'status': return `status-${id}`;
				case 'towStatus': return `tow-status-${id}`;
				case 'notes': return `notes-${id}`;
				default: return null;
			}
		} catch(_e){ return null; }
	}
	_cloneFilteredServerData(serverData){
		try {
			const copyTile = (t)=>{
				const id = parseInt(t?.tileId||0,10);
				const out = { tileId: id };
				const keys = ['aircraftId','arrivalTime','departureTime','hangarPosition','position','status','towStatus','notes','updatedAt','updatedBy'];
				keys.forEach(k=>{
					if (t.hasOwnProperty(k)){
						const fid = this._fieldIdFor(id, k);
						if (!fid || !this._isWriteFenceActive(fid)){
							out[k] = t[k];
						}
					}
				});
				return out;
			};
			const filtered = { ...serverData };
			filtered.primaryTiles = Array.isArray(serverData?.primaryTiles) ? serverData.primaryTiles.map(copyTile) : [];
			filtered.secondaryTiles = Array.isArray(serverData?.secondaryTiles) ? serverData.secondaryTiles.map(copyTile) : [];
			return filtered;
		} catch(e){ console.warn('filter server data by fences failed', e); return serverData; }
	}

	/**
	 * Compute fine-grained fieldUpdates vs. current baseline
	 */
	_computeFieldUpdates(currentData) {
		try {
			const updates = {};
			const visit = (tiles, isSecondary=false)=>{
				(tiles||[]).forEach(t=>{
					const id = parseInt(t?.tileId||0,10); if (!id) return;
					const base = (isSecondary ? this._baselineSecondary[id] : this._baselinePrimary[id]) || {};
					const mapField = (key)=>{
						if (key==='aircraftId') return `aircraft-${id}`;
						if (key==='arrivalTime') return `arrival-time-${id}`;
						if (key==='departureTime') return `departure-time-${id}`;
						if (key==='hangarPosition') return `hangar-position-${id}`;
						if (key==='position') return `position-${id}`;
						if (key==='status') return `status-${id}`;
						if (key==='towStatus') return `tow-status-${id}`;
						if (key==='notes') return `notes-${id}`;
						return null;
					};
					['aircraftId','arrivalTime','departureTime','hangarPosition','position','status','towStatus','notes'].forEach(k=>{
						const v = (t?.[k] ?? ''); const b = (base?.[k] ?? '');
						if (v !== b) {
							const fid = mapField(k);
							if (fid) updates[fid] = v;
						}
					});
				});
			};
			visit(currentData?.primaryTiles, false);
			visit(currentData?.secondaryTiles, true);
			return updates;
		} catch(e){ console.warn('delta compute failed', e); return {}; }
	}

	/**
	 * Internal: build a fetch timeout signal with a safe fallback when AbortSignal.timeout is not available
	 */
	_createTimeoutSignal(ms = 10000) {
		try {
			if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
				return { signal: AbortSignal.timeout(ms), cancel: () => {} };
			}
		} catch(_e){}
		const controller = new AbortController();
		const id = setTimeout(() => { try { controller.abort(); } catch(_e){} }, ms);
		return { signal: controller.signal, cancel: () => clearTimeout(id) };
	}

	/**
	 * Internal: watchdog to recover from hung loads in case the timeout mechanism is unavailable
	 */
	_startLoadWatchdog(ms = 15000) {
		try {
			if (this._loadWatchdogId) { clearTimeout(this._loadWatchdogId); }
			this._loadWatchdogId = setTimeout(() => {
				try {
					if (this._isLoading || window.isLoadingServerData) {
						console.warn(`⏱️ Load watchdog fired after ${ms}ms — resetting flags and aborting pending load`);
						this._isLoading = false;
						window.isLoadingServerData = false;
						// Best-effort UI nudge
						if (window.showNotification) {
							window.showNotification('Server read timed out — retrying', 'warning');
						}
						// Trigger a single retry if in read-enabled mode
						try {
							if (this.canReadFromServer && this.canReadFromServer()) {
								this.slaveCheckForUpdates && this.slaveCheckForUpdates();
							}
						} catch(_e){}
					}
				} catch(_e){}
			}, ms);
		} catch(_e){}
	}

	/**
	 * Prüft, ob Lesen vom Server aktuell erlaubt ist (Read Data Toggle)
	 */
	canReadFromServer() {
		try {
			// In Master mode we always read for multi-master convergence
			if (this.isMaster === true) return true;
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
			const { signal, cancel } = this._createTimeoutSignal(5000);
			const response = await fetch(`${this.serverSyncUrl}?action=timestamp`, {
				method: "GET",
				signal,
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
		// In Master we always read for multi-master convergence
		this.isSlaveActive = true;

		// Stoppe bestehende Intervalle
		if (this.slaveCheckInterval) {
			clearInterval(this.slaveCheckInterval);
			this.slaveCheckInterval = null;
		}
		this.stopPeriodicSync();

		// Starte Master-Synchronisation fürs Senden
		this.startPeriodicSync(); // Für das Senden von Daten

		// Zusätzlich Updates empfangen (15 Sekunden Intervall)
		this.slaveCheckInterval = setInterval(async () => {
			await this.slaveCheckForUpdates();
		}, 15000); // 15 Sekunden für Master-Update-Check
		console.log("👑 Master-Modus: Empfange zusätzlich Updates (15s, Read forced ON)");

		// Sofort einen ersten Update-Check und Schreibversuch starten
		try {
			this.slaveCheckForUpdates();
		} catch (_e) {}
		try {
			this.syncWithServer();
		} catch (e) {
			console.warn("⚠️ Sofortiger Master-Sync fehlgeschlagen:", e?.message || e);
		}

		console.log("👑 Master-Modus gestartet – Senden aktiv, Empfangen: AN");
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
		}, 10000); // 10 Sekunden Polling-Intervall (original)

		console.log(
			"👤 Slave-Modus gestartet - Polling für Updates alle 10 Sekunden aktiv"
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
	 * Suspend server reads temporarily (pauses slave polling and ignores update checks)
	 * Use around destructive local operations to avoid re-populating UI from stale server data
	 */
	suspendReads() {
		try {
			// Remember previous active state so we can restore accurately
			this._readPausedPrevActive = !!this.isSlaveActive;
			this.isSlaveActive = false;
			if (this.slaveCheckInterval) {
				clearInterval(this.slaveCheckInterval);
				this.slaveCheckInterval = null;
			}
			console.log('⏸️ Server reads suspended');
		} catch (e) { console.warn('suspendReads failed', e); }
	}

	/**
	 * Resume server reads after a suspension. If immediate=true, trigger an on-demand update check
	 */
	resumeReads(immediate = false) {
		try {
			// Only resume if reads are allowed by current mode/toggles
			const allow = (typeof this.canReadFromServer === 'function') ? !!this.canReadFromServer() : true;
			const wantActive = (this._readPausedPrevActive === undefined) ? allow : (this._readPausedPrevActive && allow);
			delete this._readPausedPrevActive;
			if (!wantActive) {
				this.isSlaveActive = false;
				console.log('▶️ Server reads remain disabled (mode/toggles)');
				return;
			}
			this.isSlaveActive = true;
			// Recreate polling interval according to current role
			if (this.slaveCheckInterval) {
				clearInterval(this.slaveCheckInterval);
				this.slaveCheckInterval = null;
			}
			const intervalMs = this.isMaster ? 30000 : 10000;
			this.slaveCheckInterval = setInterval(async () => { try { await this.slaveCheckForUpdates(); } catch(_){} }, intervalMs);
			if (immediate) {
				try { this.slaveCheckForUpdates(); } catch(_e) {}
			}
			console.log('▶️ Server reads resumed', { intervalMs, immediate });
		} catch (e) { console.warn('resumeReads failed', e); }
	}

	/**
	 * NEUE METHODE: Slave prüft auf Server-Updates
	 */
async slaveCheckForUpdates() {
        if (!this.isSlaveActive) return;
        if (this._isCheckingUpdates) return;
        this._isCheckingUpdates = true;

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

					// Update handled by header pill via 'serverDataLoaded' event; suppress toast
				} else {
					console.warn("⚠️ Slave: Server-Daten konnten nicht geladen werden");
				}
			} else {
				console.log("⏸️ Slave: Keine neuen Änderungen auf Server");
			}
        } catch (error) {
            console.error("❌ Slave: Fehler beim Prüfen auf Updates:", error);
        } finally {
            this._isCheckingUpdates = false;
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
			console.log("📝 syncWithServer(): preparing POST", {
				isMaster: this.isMaster,
				serverUrl: this.getServerUrl && this.getServerUrl(),
				canRead: this.canReadFromServer && this.canReadFromServer(),
				changesPending: this.hasDataChanged && this.hasDataChanged(),
			});
			// Pre-flight: if server changed since our last read, pull updates first to avoid overwriting newer data
			try {
				const srvTs = await this.getServerTimestamp();
				if (srvTs > (this.lastServerTimestamp || 0)) {
					await this.slaveCheckForUpdates();
				}
			} catch(_e){}
			// Aktuelle Daten sammeln
			const currentData = this.collectCurrentData();

			if (!currentData) {
				console.warn("⚠️ Keine Daten zum Synchronisieren verfügbar");
				return false;
			}

			// Delta bevorzugen: Nur geänderte Felder schicken, um Fremdänderungen nicht zu überschreiben
			let requestBody = null;
			const delta = this._computeFieldUpdates(currentData);
			try { if (delta && typeof delta === 'object') { Object.keys(delta).forEach(fid => { try { this._markPendingWrite(fid); } catch(_e){} }); } } catch(_e){}
			if (delta && Object.keys(delta).length > 0) {
				requestBody = { metadata: { timestamp: Date.now() }, fieldUpdates: delta, settings: currentData.settings || {} };
			} else {
				// Fallback auf vollständige Daten (z.B. erstes Speichern ohne Baseline)
				requestBody = currentData;
			}

			// Optimierung: Verwende AbortController für Timeout
			const { signal, cancel } = this._createTimeoutSignal(10000); // 10s Timeout

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
				body: JSON.stringify(requestBody),
				signal,
			});

			cancel && cancel();

				if (response.ok) {
					// Try to consume JSON and advance our lastServerTimestamp immediately for read-after-write coherency
					let _resp = null; try { _resp = await response.json(); } catch(_e){}
					try { const ts = parseInt(_resp?.timestamp || 0, 10); if (ts) { this.lastServerTimestamp = Math.max(this.lastServerTimestamp||0, ts); } } catch(_e){}
					console.log("✅ Master: Server-Sync erfolgreich");
					// Reset API-Sync-Bypass-Flag nach erfolgreicher Speicherung
					if (window.HangarDataCoordinator) {
						window.HangarDataCoordinator.apiChangesPendingSync = false;
					}
					// Immediate read-back for fast convergence when reading is allowed
					try {
						if (this.canReadFromServer && this.canReadFromServer()) {
							await this.slaveCheckForUpdates();
						}
					} catch(_e) {}
					// Update baseline optimistically if we posted deltas and did not read back yet
					try {
						if (requestBody && requestBody.fieldUpdates && (!this.isSlaveActive)) {
							// Apply deltas to local baseline so subsequent diffs are correct
							Object.entries(requestBody.fieldUpdates).forEach(([fid, val])=>{
								const m = fid.match(/^(aircraft|arrival-time|departure-time|hangar-position|position|status|tow-status|notes)-(\d+)$/);
								if (!m) return; const field = m[1]; const id = parseInt(m[2],10); const keyMap = { 'aircraft':'aircraftId','arrival-time':'arrivalTime','departure-time':'departureTime','hangar-position':'hangarPosition','position':'position','status':'status','tow-status':'towStatus','notes':'notes' };
								const key = keyMap[field]; if (!key) return;
								let tgt = (id>=100 ? this._baselineSecondary : this._baselinePrimary);
								tgt[id] = tgt[id] || { tileId: id };
								tgt[id][key] = val;
							});
						}
					} catch(_e){}
					return true;
				} else if (response.status === 423) {
					let payload = null;
					try { payload = await response.json(); } catch(_e) {}
					console.warn("🚫 Master denied by server (423)", payload);
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

					// Ensure tiles present; if missing/empty, collect from DOM
					try {
						const needDom = !data || !Array.isArray(data.primaryTiles) || data.primaryTiles.length === 0;
						if (needDom) {
							const dom = this.collectTilesFromDom();
							data = data || {};
							data.primaryTiles = dom.primary;
							if (dom.secondary && dom.secondary.length) data.secondaryTiles = dom.secondary;
							console.log('🧮 DOM collector → tiles', { primary: dom.primary.length, secondary: dom.secondary.length });
						}
					} catch(_e){}
					
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
	 * Sammle Kachel-Daten direkt aus dem DOM, wenn keine andere Quelle verfügbar ist
	 */
	collectTilesFromDom() {
		const ids = new Set();
		try {
			const sel = document.querySelectorAll("[id^='aircraft-'], [id^='position-'], [id^='hangar-position-'], [id^='arrival-time-'], [id^='departure-time-'], [id^='status-'], [id^='tow-status-'], [id^='notes-']");
			sel.forEach(el => { const m = el.id.match(/-(\d+)$/); if (m) ids.add(parseInt(m[1],10)); });
		} catch(_e){}
		const toTile = (id) => {
			const getVal = (prefix) => { const el = document.getElementById(`${prefix}${id}`); return el ? (el.value || '').trim() : ''; };
			const aircraftId = getVal('aircraft-');
			const posInfo = getVal('position-');
			const posHangar = getVal('hangar-position-');
			const arrivalTime = getVal('arrival-time-');
			const departureTime = getVal('departure-time-');
			const status = getVal('status-') || 'neutral';
			const towStatus = getVal('tow-status-') || 'neutral';
			const notes = getVal('notes-');
			// Only include if there is meaningful content
			const hasMeaning = !!(aircraftId || posInfo || posHangar || arrivalTime || departureTime || notes || (status && status !== 'neutral') || (towStatus && towStatus !== 'neutral'));
			if (!hasMeaning) return null;
			return {
				tileId: id,
				aircraftId,
				position: posInfo,
				hangarPosition: posHangar,
				arrivalTime,
				departureTime,
				status,
				towStatus,
				notes,
			};
		};
		const allIds = Array.from(ids).sort((a,b)=>a-b);
		const primary = [];
		const secondary = [];
		allIds.forEach(id => { const t = toTile(id); if (!t) return; if (id >= 100) secondary.push(t); else primary.push(t); });
		return { primary, secondary };
	}
	
	/**
	 * Lädt Daten vom Server
	 */
	async loadFromServer() {
		if (!this.serverSyncUrl) {
			console.warn("⚠️ Server-URL nicht konfiguriert");
			return null;
		}

		// Reentrancy guard
		if (this._isLoading || window.isLoadingServerData) {
			console.log("⏸️ Load skipped: another server read in progress");
			return null;
		}

		this._isLoading = true;
		window.isLoadingServerData = true;
		this._startLoadWatchdog(15000);

		try {
			// Verwende korrekte Server-URL mit Project-ID falls vorhanden
			const serverUrl = this.getServerUrl();
			const loadUrl = serverUrl + (serverUrl.includes("?") ? "&" : "?") + "action=load";

			const { signal, cancel } = this._createTimeoutSignal(10000);
			const response = await fetch(loadUrl, {
				method: "GET",
				headers: { Accept: "application/json" },
				signal,
			});
			cancel && cancel();

			if (response.ok) {
				const data = await response.json();
				console.log("✅ Daten vom Server geladen");
				return data;
			} else {
				let text = '';
				try { text = await response.text(); } catch(_e){}
				console.warn("⚠️ Server-Sync fehlgeschlagen:", { status: response.status, body: text.slice(0,200) });
				return false;
			}
		} catch (error) {
			if (error && error.name === 'AbortError') {
				console.warn("⚠️ Server-Load Timeout (10s)");
			} else {
				console.error("❌ Server-Load Fehler:", error);
			}
			return null;
		} finally {
			try { if (this._loadWatchdogId) { clearTimeout(this._loadWatchdogId); this._loadWatchdogId = null; } } catch(_e){}
			this._isLoading = false;
			window.isLoadingServerData = false;
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
		// Stale snapshot gating by server timestamp to prevent oscillation
		try {
			const incTs = parseInt(serverData?.metadata?.timestamp || 0, 10);
			if (incTs && (this.lastServerTimestamp || 0) && incTs <= (this.lastServerTimestamp || 0)){
				console.log('⏭️ Überspringe veralteten Server-Snapshot', { incTs, last: this.lastServerTimestamp });
				return false;
			}
		} catch(_e){}
		// Normalize legacy schemas to { primaryTiles, secondaryTiles } if needed
		try {
			if (!serverData.primaryTiles && (Array.isArray(serverData.primary) || Array.isArray(serverData.secondary))) {
				const mapTile = (row, idx) => ({
					ileId: parseInt(row?.tileId || row?.id || (idx + 1), 10),
					aircraftId: row?.aircraftId || row?.aircraft || '',
					arrivalTime: row?.arrivalTime || row?.arrival || '',
					departureTime: row?.departureTime || row?.departure || '',
					position: row?.position || row?.hangarPosition || '',
					hangarPosition: row?.hangarPosition || '',
					status: row?.status || 'neutral',
					towStatus: row?.towStatus || row?.tow || 'neutral',
					notes: row?.notes || '',
					updatedAt: row?.updatedAt || undefined,
					updatedBy: row?.updatedBy || undefined,
				});
				serverData = {
					...serverData,
					primaryTiles: (serverData.primary || []).map(mapTile),
					secondaryTiles: (serverData.secondary || []).map(mapTile),
				};
				console.log('🔁 Normalized legacy server data → primaryTiles/secondaryTiles');
			}
			// Legacy: tilesData (object of cells)
			if (!serverData.primaryTiles && serverData.tilesData && typeof serverData.tilesData === 'object'){
				const entries = Object.entries(serverData.tilesData);
				const toTiles = entries.map(([key, v]) => {
					const m = String(key).match(/cell_(\d+)/);
					const id = m ? parseInt(m[1],10) : 0;
					return {
						tileId: id,
						aircraftId: v?.aircraftId || '',
						arrivalTime: v?.arrivalTime || '',
						departureTime: v?.departureTime || '',
						position: v?.position || '',
						status: v?.status || 'neutral',
						towStatus: v?.towStatus || 'neutral',
						notes: v?.notes || '',
					};
				}).filter(t => t.tileId > 0);
				serverData = { ...serverData, primaryTiles: toTiles };
				console.log('🔁 Normalized tilesData → primaryTiles');
			}
		} catch(e) { console.warn('⚠️ Server data normalization failed', e); }

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
			// NEUE LOGIK: Verwende zentralen Datenkoordinator wenn keine aktiven Write-Fences bestehen,
			// andernfalls wende nur nicht-gefenzte Felder direkt an, um Oscillation zu vermeiden
			const hasFences = this._hasActiveFences();
			if (window.dataCoordinator && !hasFences) {
				console.log("🔄 Verwende dataCoordinator für Server-Daten...");
				window.dataCoordinator.loadProject(serverData, "server");
				console.log("✅ Server-Daten über Datenkoordinator angewendet");
				try { this._updateBaselineFromServerData(serverData); } catch(_e){}
				try { this.lastLoadedAt = Date.now(); document.dispatchEvent(new CustomEvent('serverDataLoaded', { detail: { loadedAt: this.lastLoadedAt } })); } catch(e){}
				return true;
			}

			// Versuche Legacy-Handler, falle bei Fehlschlag auf direkte Anwendung zurück
			if (
				window.hangarData &&
				typeof window.hangarData.applyLoadedHangarPlan === "function"
			) {
				try {
					console.log("🔄 Versuche hangarData.applyLoadedHangarPlan...");
					const result = window.hangarData.applyLoadedHangarPlan(serverData);
					console.log("📄 Ergebnis hangarData.applyLoadedHangarPlan:", result);
					if (result) {
						try { this.lastLoadedAt = Date.now(); document.dispatchEvent(new CustomEvent('serverDataLoaded', { detail: { loadedAt: this.lastLoadedAt } })); } catch(e){}
						return true;
					}
				} catch(e) {
					console.warn("⚠️ applyLoadedHangarPlan fehlgeschlagen, nutze direkte Anwendung", e);
				}
			}

			// ERWEITERT: Direkter Fallback für Kachel-Daten
			console.log(
				hasFences
					? "⚠️ Aktive Write-Fences erkannt – wende nur nicht-gefenzte Felder direkt an"
					: "⚠️ Keine Standard-Datenhandler verfügbar, verwende direkten Fallback..."
			);
			let applied = false;
			const dataForApply = hasFences ? this._cloneFilteredServerData(serverData) : serverData;

			// Direkte Anwendung der Kachel-Daten
			if (dataForApply.primaryTiles && dataForApply.primaryTiles.length > 0) {
				console.log("🔄 Wende primäre Kachel-Daten direkt an...");
				const a = this.applyTileData(dataForApply.primaryTiles, false);
				applied = !!(applied || a);
				console.log("📊 Primäre Kacheln angewendet:", a);
			}

			if (dataForApply.secondaryTiles && dataForApply.secondaryTiles.length > 0) {
				console.log("🔄 Wende sekundäre Kachel-Daten direkt an...");
				const b = this.applyTileData(dataForApply.secondaryTiles, true);
				applied = !!(applied || b);
				console.log("📊 Sekundäre Kacheln angewendet:", b);
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
				try { this._updateBaselineFromServerData(serverData); } catch(_e){}
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
                    // Subtle author pill (multi-master): show "Updated by NAME" until dismissed
                    try {
                        const author = (tileData.updatedBy || '').trim();
                        if (author && typeof window.createOrUpdateUpdateAuthorPill === 'function') {
                            window.createOrUpdateUpdateAuthorPill(tileId, author, ts, { source: 'server' });
                        }
                    } catch(_e) {}
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

			// Entferne zeitabhängige Felder und normalisiere Struktur für stabilen Vergleich
			const compareData = JSON.parse(JSON.stringify(currentData || {}));
			if (compareData.metadata) {
				delete compareData.metadata.lastModified;
				delete compareData.metadata.lastSaved;
				delete compareData.metadata.lastSync;
				delete compareData.metadata.timestamp;
				delete compareData.metadata.lastWriter;
				delete compareData.metadata.lastWriterSession;
				delete compareData.metadata.source;
			}
			const stableTile = (t) => ({
				tileId: parseInt(t.tileId || 0, 10) || 0,
				aircraftId: t.aircraftId || '',
				arrivalTime: t.arrivalTime || '',
				departureTime: t.departureTime || '',
				position: t.position || '',
				hangarPosition: t.hangarPosition || '',
				status: t.status || 'neutral',
				towStatus: t.towStatus || 'neutral',
				notes: t.notes || '',
			});
			if (Array.isArray(compareData.primaryTiles)) {
				compareData.primaryTiles = compareData.primaryTiles.map(stableTile).sort((a,b)=>a.tileId-b.tileId);
			}
			if (Array.isArray(compareData.secondaryTiles)) {
				compareData.secondaryTiles = compareData.secondaryTiles.map(stableTile).sort((a,b)=>a.tileId-b.tileId);
			}

			const currentChecksum = this.generateChecksum(JSON.stringify(compareData));

			if (this.lastDataChecksum !== currentChecksum) {
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

			const { signal, cancel } = this._createTimeoutSignal(5000);
			const response = await fetch(serverUrl, {
				method: "GET",
				headers: {
					Accept: "application/json",
				},
				signal,
			});
			cancel && cancel();

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

		// Event-Handler über Event-Manager reaktivieren (robust)
		setTimeout(() => {
			try {
				if (window.hangarEventManager) {
					if (!window.hangarEventManager.initialized && typeof window.hangarEventManager.init === 'function') {
						window.hangarEventManager.init();
						console.log("✅ Event-Manager init during reactivation");
					} else if (typeof window.hangarEventManager.setupUnifiedEventHandlers === 'function') {
						window.hangarEventManager.setupUnifiedEventHandlers();
						console.log("✅ Unified Event-Handler reaktiviert");
					}
				} else {
					// Retry later if manager not yet loaded
					setTimeout(() => {
						try {
							if (window.hangarEventManager) {
								if (!window.hangarEventManager.initialized && typeof window.hangarEventManager.init === 'function') window.hangarEventManager.init();
								else if (typeof window.hangarEventManager.setupUnifiedEventHandlers === 'function') window.hangarEventManager.setupUnifiedEventHandlers();
								console.log("✅ Unified Event-Handler reaktiviert (delayed)");
							}
						} catch(_e){}
					}, 800);
				}
			} catch(_e){}
		}, 200);

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

// Standard: verwende gleichen Origin-Server wie die App
	const defaultServerUrl = window.location.origin + "/sync/data.php";

	// Prüfe auf gespeicherte Server-URL
	let serverUrl = localStorage.getItem("hangarServerSyncUrl");

	// Migration: korrigiere versehentliche Domain-Mismatches (e.g., hangarplanner.de → hangarplaner.de)
	try {
		if (serverUrl) {
			const savedHost = new URL(serverUrl).hostname;
			const currentHost = window.location.hostname;
			if (savedHost && savedHost !== currentHost) {
				console.warn(`⚠️ Gespeicherte Server-URL Host (${savedHost}) != aktueller Host (${currentHost}) – setze auf gleichen Origin`);
				serverUrl = defaultServerUrl;
				localStorage.setItem("hangarServerSyncUrl", serverUrl);
			}
		}
	} catch(_e){}

	// Wenn keine URL gespeichert ist, verwende gleichen Origin
	if (!serverUrl) {
		serverUrl = defaultServerUrl;
		console.log("🌐 Verwende Standard-Server (gleicher Origin):", serverUrl);
	} else {
		console.log("💾 Verwende gespeicherte Server-URL:", serverUrl);
	}

	if (window.serverSync) {
		window.serverSync.initSync(serverUrl);
		localStorage.setItem("hangarServerSyncUrl", serverUrl); // Für künftige Verwendung speichern
		console.log("🚀 Server-Sync initialisiert mit URL:", serverUrl);
	}
});

// DOMContentLoaded fallback: ensure initSync runs even if queue processing is delayed/missing
try {
	document.addEventListener('DOMContentLoaded', function(){
		try {
			if (!window.serverSync) return;
			if (!window.serverSync.serverSyncUrl) {
				const u = localStorage.getItem("hangarServerSyncUrl") || (window.location.origin + "/sync/data.php");
				console.log("🛠️ Fallback initSync on DOMContentLoaded:", u);
				window.serverSync.initSync(u);
			}
		} catch(e){ console.warn('Fallback initSync failed', e); }
	}, { once: true });
} catch(_e){}

// SERVER-VERBINDUNGSTEST (verzögert)
setTimeout(async () => {
	if (!window.serverSync) return;

	const serverUrl = localStorage.getItem("hangarServerSyncUrl") || (window.location.origin + "/sync/data.php");
	const isServerReachable = await window.serverSync.testServerConnection(serverUrl);

	if (!isServerReachable) {
		console.warn("⚠️ Server nicht erreichbar, bleibe im lokalen Modus");
		// Optional: hier könnte ein alternativer Host getestet werden, aktuell nicht nötig
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
