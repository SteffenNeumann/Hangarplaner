/**
 * VERBESSERTER ZENTRALER EVENT-MANAGER
 * Löst alle identifizierten Funktionskonflikte
 * Version: 2.0 - Konfliktbereinigt
 */

class HangarEventManager {
	constructor() {
		this.initialized = false;
		this.registeredHandlers = new Map(); // Tracking aller Handler
		this.storageQueue = []; // Queue für localStorage-Operationen
		this.isProcessingStorage = false;
		this.debounceTimers = new Map();
		// Field-level write aggregation (batch POST)
		this._pendingFieldUpdates = {};
		this._pendingFlushTimer = null;
		this._pendingFlushDueAt = 0;
		this._flushInFlight = false;

		// Typing UX controls
		this.TYPING_DEBOUNCE_MS = 5000; // how long to wait after last keystroke before sending text to server (increased to reduce mid-typing writes)
		this.BLUR_SAVE_DELAY_MS = 150; // local debounce on blur before sync
		this._lastTypingAt = 0;

		// Local edit tracking for conflict prompts (per-field)
		this.lastLocalEdit = {}; // { fieldId: { value, editedAt } }

		// Singleton-Pattern
		if (HangarEventManager.instance) {
			return HangarEventManager.instance;
		}
		HangarEventManager.instance = this;
	}

	/**
	 * SICHERE EVENT-HANDLER-REGISTRIERUNG
	 * Verhindert Mehrfachregistrierung automatisch
	 */
	safeAddEventListener(element, eventType, handler, handlerName = null) {
		if (!element || typeof handler !== "function") {
			console.warn("❌ Ungültige Event-Handler-Parameter:", {
				element,
				eventType,
				handler,
			});
			return false;
		}

		const elementId =
			element.id ||
			element.tagName + "_" + Math.random().toString(36).substr(2, 9);
		const key = `${elementId}_${eventType}_${handlerName || "anonymous"}`;

		// Bestehenden Handler entfernen, falls vorhanden
		if (this.registeredHandlers.has(key)) {
			const oldHandler = this.registeredHandlers.get(key);
			element.removeEventListener(eventType, oldHandler);
		}

		// Neuen Handler registrieren
		element.addEventListener(eventType, handler);
		this.registeredHandlers.set(key, handler);

		return true;
	}

	/**
	 * ZENTRALISIERTE LOCALSTORAGE-OPERATIONEN
	 * Verhindert Race Conditions durch Queueing
	 */
	async saveToStorage(key, data, priority = "normal") {
		return new Promise((resolve, reject) => {
			const operation = {
				type: "save",
				key,
				data,
				priority,
				resolve,
				reject,
				timestamp: Date.now(),
			};

			if (priority === "high") {
				this.storageQueue.unshift(operation);
			} else {
				this.storageQueue.push(operation);
			}

			this.processStorageQueue();
		});
	}

	async loadFromStorage(key) {
		return new Promise((resolve, reject) => {
			const operation = {
				type: "load",
				key,
				resolve,
				reject,
				timestamp: Date.now(),
			};

			this.storageQueue.push(operation);
			this.processStorageQueue();
		});
	}

	async processStorageQueue() {
		if (this.isProcessingStorage || this.storageQueue.length === 0) {
			return;
		}

		this.isProcessingStorage = true;

		while (this.storageQueue.length > 0) {
			const operation = this.storageQueue.shift();

			try {
				if (operation.type === "save") {
					localStorage.setItem(operation.key, JSON.stringify(operation.data));
					operation.resolve(true);
				} else if (operation.type === "load") {
					const data = localStorage.getItem(operation.key);
					operation.resolve(data ? JSON.parse(data) : null);
				}
			} catch (error) {
				console.error("localStorage-Operation fehlgeschlagen:", error);
				operation.reject(error);
			}

			// Kleine Pause zwischen Operationen
			await new Promise((resolve) => setTimeout(resolve, 10));
		}

		this.isProcessingStorage = false;
	}

	/**
	 * DEBOUNCED FIELD UPDATES
	 * Verhindert zu häufige localStorage-Updates
	 * options: { flushDelayMs?: number, source?: 'input'|'blur'|'change' }
	 */
	debouncedFieldUpdate(fieldId, value, delay = 500, options = {}) {
		try {
			// Record local edit immediately for conflict detection
			this.recordLocalEdit(fieldId, value);
		} catch(_e){}
		// Bestehenden Timer löschen
		if (this.debounceTimers.has(fieldId)) {
			clearTimeout(this.debounceTimers.get(fieldId));
		}

		// Neuen Timer setzen
		const timer = setTimeout(async () => {
			await this.updateFieldInStorage(fieldId, value, options);
			this.debounceTimers.delete(fieldId);
		}, delay);

		this.debounceTimers.set(fieldId, timer);
	}

	async updateFieldInStorage(fieldId, value, options = {}) {
		try {
			// 1. Lokale Speicherung
			const existing = (await this.loadFromStorage("hangarPlannerData")) || {};
			let storeValue = value;
			if ((fieldId.startsWith('arrival-time-') || fieldId.startsWith('departure-time-')) && typeof window.helpers !== 'undefined' && typeof window.helpers.canonicalizeDateTimeFieldValue === 'function'){
				const iso = window.helpers.canonicalizeDateTimeFieldValue(fieldId, (value||'').trim());
				storeValue = iso || '';
			}
			existing[fieldId] = storeValue;
			existing.lastModified = new Date().toISOString();

			await this.saveToStorage("hangarPlannerData", existing);

			// 2. Server-Synchronisation (Konfigurierbar)
			await this.syncFieldToServer(fieldId, storeValue, options);
		} catch (error) {
			console.error("Fehler beim Speichern von Feld:", fieldId, error);
		}
	}

	/**
	 * Direkte Server-Synchronisation für einzelne Felder
	 */
	async syncFieldToServer(fieldId, value, options = {}) {
		try {
			// Ensure unified sync object
			if (!window.serverSync && window.storageBrowser) { window.serverSync = window.storageBrowser; }
			const syncObj = window.storageBrowser || window.serverSync || null;
			const syncUrl = (syncObj && (typeof syncObj.getServerUrl === 'function' ? syncObj.getServerUrl() : syncObj.serverSyncUrl)) || '';
			console.log('🧩 syncFieldToServer start', { fieldId, hasSyncObj: !!syncObj, syncUrl: !!syncUrl, isMaster: !!window.serverSync?.isMaster, mode: window.sharingManager?.syncMode });
			if (!syncObj || !syncUrl) {
				console.info("ℹ️ Server-Sync noch nicht konfiguriert – versuche später zu synchronisieren");
				setTimeout(() => { try { (window.serverSync || window.storageBrowser)?.syncWithServer?.(); } catch (e) {} }, 1200);
				return;
			}

			// Gate writes to Master only
			const isWriteEnabled = (!!window.serverSync && window.serverSync.isMaster === true) || (!!window.sharingManager && window.sharingManager.isMasterMode === true);
			if (!isWriteEnabled) {
				console.info("📘 Read-only Modus aktiv – überspringe Server-Write für Feld:", fieldId);
				return;
			}

			// ===== Aggregation path: batch multiple field updates into a single POST =====
			try {
				// Mark write fence (if supported by serverSync)
				try { if (window.serverSync && typeof window.serverSync._markPendingWrite === 'function') { window.serverSync._markPendingWrite(fieldId); } } catch(_e){}
				// Collect pending updates
				this._pendingFieldUpdates = this._pendingFieldUpdates || {};
				this._pendingFieldUpdates[fieldId] = value;
				// Determine desired flush delay
				const desiredDelay = (options && typeof options.flushDelayMs === 'number') ? options.flushDelayMs : 450;
				const now = Date.now();
				const postUrl = (window.serverSync?.getServerUrl?.()) || (window.storageBrowser?.serverSyncUrl) || '';
				const lastWriter = (localStorage.getItem('presence.displayName') || '');
				const flushFn = async () => {
					if (this._flushInFlight) { this._pendingFlushTimer = null; this._pendingFlushDueAt = 0; return; }
					this._flushInFlight = true;
					try {
					const updates = { ...(this._pendingFieldUpdates||{}) };
						this._pendingFieldUpdates = {};
						this._pendingFlushTimer = null;
						this._pendingFlushDueAt = 0;
						if (!postUrl){ this._flushInFlight = false; return; }
						// Route aggregated field updates through serverSync to leverage preconditions and conflict handling
						try {
							if (window.serverSync && typeof window.serverSync.syncFieldUpdates === 'function'){
								await window.serverSync.syncFieldUpdates(updates, { aggregated: true });
							} else {
								// Fallback: trigger a full sync if serverSync is not ready
								await (window.serverSync?.syncWithServer?.() || Promise.resolve(false));
							}
						} catch(err){ console.warn('aggregate flush failed', err); }
					} catch(err){ console.warn('aggregate flush failed', err); }
					finally { this._flushInFlight = false; }
				};

				// If immediate flush requested (e.g., blur), do it now
				if (desiredDelay === 0) {
					if (this._pendingFlushTimer) { clearTimeout(this._pendingFlushTimer); this._pendingFlushTimer = null; }
					this._pendingFlushDueAt = 0;
					await flushFn();
				} else {
					// Trailing debounce: always schedule flush desiredDelay after the most recent update
					if (this._pendingFlushTimer) { clearTimeout(this._pendingFlushTimer); }
					this._pendingFlushDueAt = now + desiredDelay;
					this._pendingFlushTimer = setTimeout(async () => { await flushFn(); }, desiredDelay);
				}
			} catch(_e){}
			// Stop here; legacy immediate single-field path not needed when aggregation is enabled
			return;

		} // end aggregated path

		// Legacy single-field fallback path (kept for clarity; normally not executed when aggregation path returns)

		// IMPORTANT: For field-level updates, always send fieldUpdates directly to avoid overwriting unrelated fields in multi-master

		// Sammle alle aktuellen Daten für vollständige Server-Synchronisation (Fallback)
		let allData = null;
			if (
				window.hangarData &&
				typeof window.hangarData.collectAllHangarData === "function"
			) {
				allData = window.hangarData.collectAllHangarData();
			} else {
				// Fallback: Erweiterte Datensammlung für sekundäre Tiles
				const primaryFields = this.collectFieldsFromContainer(
					"hangarGrid",
					false
				);
				const secondaryFields = this.collectFieldsFromContainer(
					"secondaryHangarGrid",
					true
				);

				allData = {
					metadata: {
						lastModified: new Date().toISOString(),
						projectName:
							document.getElementById("projectName")?.value || "HangarPlan",
						syncTriggeredBy: fieldId,
						version: "2.0-enhanced",
					},
					settings: {
						tilesCount:
							parseInt(document.getElementById("tilesCount")?.value) || 8,
						secondaryTilesCount:
							parseInt(document.getElementById("secondaryTilesCount")?.value) ||
							0,
						layout: parseInt(document.getElementById("layoutType")?.value) || 4,
					},
					primaryTiles: primaryFields,
					secondaryTiles: secondaryFields,
					fieldUpdates: {
						[fieldId]: value,
					},
					// Sammle alle aktuell sichtbaren Felder
					currentFields: this.collectAllVisibleFields(),
				};
			}

			// Normalize to server schema if needed
			try {
				if (allData && !allData.primaryTiles && (Array.isArray(allData.primary) || Array.isArray(allData.secondary))) {
					const mapTile = (row) => ({
						tileId: row.id,
						aircraftId: row.aircraft || '',
						arrivalTime: row.arrival || '',
						departureTime: row.departure || '',
						position: row.position || '',
						hangarPosition: row.hangarPosition || '',
						status: row.status || 'neutral',
						towStatus: row.tow || 'neutral',
						notes: row.notes || '',
					});
					allData = {
						metadata: allData.metadata || {},
						settings: allData.settings || {},
						primaryTiles: (allData.primary || []).map(mapTile),
						secondaryTiles: (allData.secondary || []).map(mapTile),
						fieldUpdates: allData.fieldUpdates || {},
						currentFields: allData.currentFields || {},
					};
				}
			} catch(e) { /* noop */ }

			// Server-Request with fieldUpdates payload only
			const postUrl = (window.serverSync?.getServerUrl?.()) || (window.storageBrowser?.serverSyncUrl) || '';
			console.log('📮 field-update POST', { url: postUrl, fieldId });
			const response = await fetch(postUrl, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"X-Sync-Role": "master",
					"X-Sync-Session": (window.serverSync && typeof window.serverSync.getSessionId === 'function') ? window.serverSync.getSessionId() : (localStorage.getItem('serverSync.sessionId') || ''),
					"X-Display-Name": (localStorage.getItem('presence.displayName') || ''),
				},
				body: JSON.stringify({
					metadata: { timestamp: Date.now(), lastWriter: (localStorage.getItem('presence.displayName') || '') },
					settings: {},
					fieldUpdates: { [fieldId]: value }
				}),
			});

			if (response.ok) {
				try {
					// Optional read-back to converge if Read is ON
					const canRead = !!(window.serverSync && typeof window.serverSync.canReadFromServer === 'function' && window.serverSync.canReadFromServer());
					if (canRead && typeof window.serverSync.loadFromServer === 'function' && typeof window.serverSync.applyServerData === 'function') {
						const data = await window.serverSync.loadFromServer();
						if (data && !data.error) await window.serverSync.applyServerData(data);
					}
				} catch(_e){}
			} else {
				console.warn(
					`⚠️ Server-Sync fehlgeschlagen für ${fieldId}:`,
					response.status,
					await response.text()
				);
			}
		} catch (error) {
			console.error(`❌ Server-Sync Fehler für ${fieldId}:`, error);
		}
	}

	/**
	 * Sammelt Felder aus einem bestimmten Container
	 */
	collectFieldsFromContainer(containerId, isSecondary = false) {
		const container = document.getElementById(containerId);
		if (!container) {
			console.warn(`⚠️ Container ${containerId} nicht gefunden`);
			return [];
		}
		const tiles = [];
		const selectors = [
			'input[id^="aircraft-"]',
			'input[id^="arrival-time-"]',
			'input[id^="departure-time-"]',
			'input[id^="position-"]',
			'input[id^="hangar-position-"]',
			'textarea[id^="notes-"]',
			'select[id^="status-"]',
			'select[id^="tow-status-"]',
		];

		// Sammle alle relevanten Elemente aus diesem Container
		const containerFields = {};
		selectors.forEach((selector) => {
			const elements = container.querySelectorAll(selector);
			elements.forEach((element) => {
				if (element.id && element.value !== undefined) {
					const cellId = this.extractCellIdFromElement(element);
					if (cellId && (isSecondary ? cellId >= 101 : cellId < 101)) {
						containerFields[element.id] = element.value;
					}
				}
			});
		});

		// Gruppiere Felder nach Tile-ID
		const tileGroups = {};
		Object.entries(containerFields).forEach(([fieldId, value]) => {
			const cellId = this.extractCellIdFromElement({ id: fieldId });
			if (cellId) {
				if (!tileGroups[cellId]) {
					tileGroups[cellId] = { tileId: cellId };
				}

				if (fieldId.includes("aircraft-")) {
					tileGroups[cellId].aircraftId = value;
				} else if (/^hangar-position-/.test(fieldId)) {
					// Header field in tile header → hangarPosition
					tileGroups[cellId].hangarPosition = value;
				} else if (/^position-/.test(fieldId)) {
					// Route/Info grid position → position
					tileGroups[cellId].position = value;
				} else if (fieldId.includes("notes-")) {
					tileGroups[cellId].notes = value;
				} else if (fieldId.includes("arrival-time-")) {
					if (typeof window.helpers !== 'undefined' && typeof window.helpers.canonicalizeDateTimeFieldValue === 'function'){
						const iso = window.helpers.canonicalizeDateTimeFieldValue(fieldId, value);
						tileGroups[cellId].arrivalTime = iso || '';
					} else {
						tileGroups[cellId].arrivalTime = value;
					}
				} else if (fieldId.includes("departure-time-")) {
					if (typeof window.helpers !== 'undefined' && typeof window.helpers.canonicalizeDateTimeFieldValue === 'function'){
						const iso = window.helpers.canonicalizeDateTimeFieldValue(fieldId, value);
						tileGroups[cellId].departureTime = iso || '';
					} else {
						tileGroups[cellId].departureTime = value;
					}
				} else if (fieldId.includes("status-")) {
					tileGroups[cellId].status = value;
				} else if (fieldId.includes("tow-status-")) {
					tileGroups[cellId].towStatus = value;
				}
			}
		});

		const tilesArray = Object.values(tileGroups);
		return tilesArray;
	}

	/**
	 * Sammelt alle sichtbaren Feldwerte
	 */
	collectAllVisibleFields() {
		const fields = {};

		// Alle relevanten Felder durchgehen
		const selectors = [
			'input[id^="aircraft-"]',
			'input[id^="arrival-time-"]',
			'input[id^="departure-time-"]',
			'input[id^="position-"]',
			'input[id^="hangar-position-"]',
			'textarea[id^="notes-"]',
			'select[id^="status-"]',
			'select[id^="tow-status-"]',
		];

		selectors.forEach((selector) => {
			document.querySelectorAll(selector).forEach((element) => {
				if (element.id && element.value !== undefined) {
					fields[element.id] = element.value;
				}
			});
		});

		return fields;
	}

	/**
	 * API-Aufruf-Konsolidierung
	 * Alle API-Aufrufe über zentrale Fassade
	 */
	async callAPI(method, params = {}) {
		if (window.FlightDataAPI && window.FlightDataAPI[method]) {
			return await window.FlightDataAPI[method](params);
		} else {
			throw new Error(`API-Methode ${method} nicht verfügbar`);
		}
	}

	/**
	 * Initialisierung und Cleanup
	 */
	init() {
		if (this.initialized) {
			console.debug("ℹ️ Event-Manager bereits initialisiert - überspringe");
			return;
		}

		console.log("🔧 Initialisiere Event-Manager...");

		// Bestehende Event-Handler bereinigen
		this.cleanupExistingHandlers();

		// Neue Handler registrieren
		this.setupUnifiedEventHandlers();

		// Global delegated right-click handler for Board view aircraft inputs (robust wiring)
		try {
			const delegatedCtx = (e) => {
				try {
					const t = e.target;
					if (!t || !t.matches) return;
					if (!t.matches('#hangarGrid input[id^="aircraft-"], #secondaryHangarGrid input[id^="aircraft-"]')) return;
					// Ensure tooltip
					try { if (!t.getAttribute('title')) t.setAttribute('title', 'Right-click to move content to another hangar position'); } catch(_){ }
					e.preventDefault();
					const m = (t.id||'').match(/aircraft-(\d+)/);
					const sourceId = m ? parseInt(m[1],10) : null;
					if (!isFinite(sourceId)) return;
					const val = (t.value||'').trim();
					if (!val) { try { window.showNotification && window.showNotification('No Aircraft ID in this tile', 'warning'); } catch(_){} return; }
					const free = (window.getFreeTilesWithLabels ? window.getFreeTilesWithLabels() : []).filter(x => x && x.id !== sourceId);
					if (!free.length) { try { window.showNotification && window.showNotification('No free tiles available', 'info'); } catch(_){} return; }
					if (typeof window.openTileSelectionOverlay === 'function') {
						window.openTileSelectionOverlay({ tiles: free, onSelect: (destId)=> { try { window.moveTileContent && window.moveTileContent(sourceId, destId); } catch(_){} } });
					}
				} catch(_){ }
			};
			document.addEventListener('contextmenu', delegatedCtx, true);
		} catch(_){ }

		this.initialized = true;
		console.log("✅ Event-Manager erfolgreich initialisiert");
		
		// Dispatch event to notify other components
		try {
			document.dispatchEvent(new CustomEvent('eventManagerReady'));
			console.debug("📢 eventManagerReady Event gesendet");
		} catch(_e) {
			console.warn("⚠️ Fehler beim Senden des eventManagerReady Events:", _e);
		}
	}

	cleanupExistingHandlers() {
		// Alle registrierten Handler entfernen
		this.registeredHandlers.forEach((handler, key) => {
			const [elementId, eventType] = key.split("_");
			const element = document.getElementById(elementId);
			if (element) {
				element.removeEventListener(eventType, handler);
			}
		});

		this.registeredHandlers.clear();
	}

	setupUnifiedEventHandlers() {
		// Unified Input Handler für alle relevanten Felder
		const relevantSelectors = [
			'input[id^="aircraft-"]', // Aircraft ID Felder
			'input[id^="arrival-time-"]', // Ankunftszeit Felder
			'input[id^="departure-time-"]', // Abflugzeit Felder
			'input[id^="position-"]', // Position Felder
			'input[id^="hangar-position-"]', // Hangar Position Felder
			'textarea[id^="notes-"]', // Notizen Felder
			'select[id^="status-"]', // Status Dropdowns
			'select[id^="tow-status-"]', // Tow Status Dropdowns
			'input[type="text"][class*="aircraft"]', // Felder mit aircraft CSS-Klasse
			'input[type="text"][class*="position"]', // Felder mit position CSS-Klasse
			'textarea[class*="notes"]', // Notiz-Textareas mit CSS-Klasse
		];

		// Container-spezifische Registrierung
		const primaryContainer = document.getElementById("hangarGrid");
		const secondaryContainer = document.getElementById("secondaryHangarGrid");

		let handlersRegistered = 0;

		// Event-Handler für primäre Container registrieren
		if (primaryContainer) {
			relevantSelectors.forEach((selector) => {
				const elements = primaryContainer.querySelectorAll(selector);
				elements.forEach((element) => {
					// Prüfe ob Element wirklich im primären Container und primäre ID hat
					const cellId = this.extractCellIdFromElement(element);
					if (cellId && cellId < 101 && primaryContainer.contains(element)) {
						if (this.registerHandlerForElement(element, "primary")) {
							handlersRegistered++;
						}
					}
				});
			});
		}

		// Event-Handler für sekundäre Container registrieren
		if (secondaryContainer) {
			relevantSelectors.forEach((selector) => {
				const elements = secondaryContainer.querySelectorAll(selector);
				elements.forEach((element) => {
					// Prüfe ob Element wirklich im sekundären Container und sekundäre ID hat
					const cellId = this.extractCellIdFromElement(element);
					if (cellId && cellId >= 101 && secondaryContainer.contains(element)) {
						if (this.registerHandlerForElement(element, "secondary")) {
							handlersRegistered++;
						}
					}
				});
			});
		}

		// Zusätzlich: Tooltip + contextmenu (right-click move) for Aircraft ID inputs in Board view
		try {
			const setBoardAircraftTooltips = () => {
				document.querySelectorAll('#hangarGrid input[id^="aircraft-"], #secondaryHangarGrid input[id^="aircraft-"]').forEach(inp => {
					try { if (!inp.getAttribute('title')) inp.setAttribute('title', 'Right-click to move content to another hangar position'); } catch(_){ }
					// context menu
					const handlerName = `board_ctx_${inp.id}`;
					this.safeAddEventListener(inp, 'contextmenu', (e)=>{
						e.preventDefault();
						const idMatch = (e.currentTarget.id||'').match(/aircraft-(\d+)/);
						const sourceId = idMatch ? parseInt(idMatch[1],10) : null;
						if (!isFinite(sourceId)) return;
						// Only allow when source has content
						const val = (e.currentTarget.value||'').trim();
						if (!val) { try { window.showNotification && window.showNotification('No Aircraft ID in this tile', 'warning'); } catch(_){} return; }
						// Compute free destinations
						const free = (window.getFreeTilesWithLabels ? window.getFreeTilesWithLabels() : []).filter(t => t && t.id !== sourceId);
						if (!free.length) { try { window.showNotification && window.showNotification('No free tiles available', 'info'); } catch(_){} return; }
						if (typeof window.openTileSelectionOverlay === 'function') {
							window.openTileSelectionOverlay({ tiles: free, onSelect: (destId)=> { try { window.moveTileContent && window.moveTileContent(sourceId, destId); } catch(_){} } });
						} else {
							try { window.showNotification && window.showNotification('Selection overlay not available', 'error'); } catch(_){}
						}
					}, handlerName);
				});
			};
			setBoardAircraftTooltips();
		} catch(_){ }

		// Zusätzlich: MutationObserver für dynamisch hinzugefügte Felder
		this.setupMutationObserver();
	}

	/**
	 * Registriert Handler für ein einzelnes Element
	 */
	registerHandlerForElement(element, containerType) {
		if (!element || !element.id) return false;

		const elementId = element.id;
		const cellId = this.extractCellIdFromElement(element);

		// Prüfe Container-Kontext für korrekte ID-Zuordnung
		if (containerType === "secondary" && cellId < 101) {
			console.warn(
				`⚠️ Sekundäres Element ${elementId} hat primäre ID ${cellId} - überspringe`
			);
			return false;
		}
		if (containerType === "primary" && cellId >= 101) {
			console.warn(
				`⚠️ Primäres Element ${elementId} hat sekundäre ID ${cellId} - überspringe`
			);
			return false;
		}

		// Input Event (während der Eingabe)
		this.safeAddEventListener(
			element,
			"input",
			(event) => {
				if (window.isApplyingServerData) {
					return;
				}
				const fid = event.target.id || '';
				// Mark field as locally edited and mark a write fence immediately to avoid server echo overriding while typing
				try { if (window.serverSync && typeof window.serverSync._markPendingWrite === 'function') { window.serverSync._markPendingWrite(fid); } } catch(_e){}
				if (this.isFreeTextFieldId(fid)) {
					this._lastTypingAt = Date.now();
					// Local save after 500ms, server flush after typing idle window
					this.debouncedFieldUpdate(fid, event.target.value, 500, { flushDelayMs: this.TYPING_DEBOUNCE_MS, source: 'input' });
				} else {
					this.debouncedFieldUpdate(fid, event.target.value);
				}
			},
			`${containerType}_input`
		);

		// Blur Event (wenn Feld verlassen wird)
		this.safeAddEventListener(
			element,
			"blur",
			(event) => {
				if (window.isApplyingServerData) {
					return;
				}

				// KORREKTUR: Spezielle Behandlung für Aircraft ID Felder beim Verlassen des Feldes
				if (event.target.id.startsWith("aircraft-")) {
					// Only call handler on blur; but do NOT let empty API responses clear user value.
					if (
						window.hangarEvents &&
						typeof window.hangarEvents.handleAircraftIdChange === "function"
					) {
						try {
							window.hangarEvents.handleAircraftIdChange(
								event.target.id,
								event.target.value
							);
						} catch (e) { /* noop */ }
					}
				}
					(event.target.id.startsWith('arrival-time-') || event.target.id.startsWith('departure-time-')) &&
					typeof window.helpers !== 'undefined'
				) {
					const h = window.helpers;
					const raw = (event.target.value || '').trim();
					let iso = (typeof h.canonicalizeDateTimeFieldValue === 'function')
						? h.canonicalizeDateTimeFieldValue(event.target.id, raw)
						: raw;
					if (iso && typeof h.formatISOToCompactUTC === 'function'){
						event.target.value = h.formatISOToCompactUTC(iso);
						event.target.dataset.iso = iso;
					} else {
						event.target.value = '';
						delete event.target.dataset.iso;
					}
				}

				// Store ISO for date/time fields, otherwise raw value
				let storeVal = event.target.value;
				if ((event.target.id.startsWith('arrival-time-') || event.target.id.startsWith('departure-time-')) && typeof window.helpers !== 'undefined' && typeof window.helpers.canonicalizeDateTimeFieldValue === 'function'){
					const iso = window.helpers.canonicalizeDateTimeFieldValue(event.target.id, (event.target.dataset.iso || event.target.value || '').trim());
					if (iso) storeVal = iso; else storeVal = '';
				}

				const fid = event.target.id || '';
				const isFree = this.isFreeTextFieldId(fid);
				// On blur, flush free-text immediately; others keep normal quick debounce
				this.debouncedFieldUpdate(fid, storeVal, this.BLUR_SAVE_DELAY_MS, { flushDelayMs: isFree ? 0 : 150, source: 'blur' });
			},
			`${containerType}_blur`
		);

		// Change Event (für Dropdowns)
		this.safeAddEventListener(
			element,
			"change",
			(event) => {
				if (window.isApplyingServerData) {
					return;
				}

				// KORREKTUR: Aircraft ID Handling entfernt vom change Event
				// um Doppelaufrufe zu verhindern - wird nur bei blur behandelt

				const fid = event.target.id || '';
				// Mark fence on change for non-free-text fields too
				try { if (window.serverSync && typeof window.serverSync._markPendingWrite === 'function') { window.serverSync._markPendingWrite(fid); } } catch(_e){}
				const isFree = this.isFreeTextFieldId(fid);
				// Hard lock this field from server applies for a short window after local change
				try { window.__fieldApplyLockUntil = window.__fieldApplyLockUntil || {}; window.__fieldApplyLockUntil[fid] = Date.now() + 15000; } catch(_e){}
				this.debouncedFieldUpdate(fid, event.target.value, 150, { flushDelayMs: isFree ? this.TYPING_DEBOUNCE_MS : 150, source: 'change' });
			},
			`${containerType}_change`
		);

		return true;
	}

	/**
	 * Extrahiert Cell-ID aus Element-ID
	 */
	extractCellIdFromElement(element) {
		if (!element.id) return null;

		const patterns = [
			/^aircraft-(\d+)$/,
			/^hangar-position-(\d+)$/,
			/^position-(\d+)$/,
			/^arrival-time-(\d+)$/,
			/^departure-time-(\d+)$/,
			/^notes-(\d+)$/,
			/^status-(\d+)$/,
			/^tow-status-(\d+)$/,
		];

		for (const pattern of patterns) {
			const match = element.id.match(pattern);
			if (match) {
				return parseInt(match[1]);
			}
		}

		return null;
	}

	/**
	 * MutationObserver für dynamisch hinzugefügte Felder
	 */
	setupMutationObserver() {
		const observer = new MutationObserver((mutations) => {
			mutations.forEach((mutation) => {
				mutation.addedNodes.forEach((node) => {
					if (node.nodeType === Node.ELEMENT_NODE) {
						// Prüfe auf neue Input-Felder
						const newInputs = node.querySelectorAll
							? node.querySelectorAll("input, textarea, select")
							: [];

						newInputs.forEach((input) => {
							if (this.isRelevantField(input)) {
								// Bestimme Container-Typ
								const primaryContainer = document.getElementById("hangarGrid");
								const secondaryContainer = document.getElementById(
									"secondaryHangarGrid"
								);

								let containerType = "unknown";
								if (primaryContainer && primaryContainer.contains(input)) {
									containerType = "primary";
								} else if (
									secondaryContainer &&
									secondaryContainer.contains(input)
								) {
									containerType = "secondary";
								}

								this.attachEventHandlersToElement(input, containerType);
							}
						});

						// Zusätzliche Prüfung: Falls ganze Kacheln hinzugefügt wurden
						if (node.classList && node.classList.contains("hangar-cell")) {
							setTimeout(() => {
								// Event-Handler für alle Felder in der neuen Kachel registrieren
								const cellInputs = node.querySelectorAll(
									"input, textarea, select"
								);
								cellInputs.forEach((input) => {
									if (this.isRelevantField(input)) {
										const cellId = this.extractCellIdFromElement(input);
										const containerType =
											cellId >= 101 ? "secondary" : "primary";
										this.attachEventHandlersToElement(input, containerType);
									}
								});
							}, 100);
						}
					}
				});
			});
		});

		// Überwache sowohl Haupt-Container als auch sekundäre Container
		const containersToObserve = ["hangarGrid", "secondaryHangarGrid"];
		containersToObserve.forEach((containerId) => {
			const container = document.getElementById(containerId);
			if (container) {
				observer.observe(container, {
					childList: true,
					subtree: true,
				});
			}
		});

		// Zusätzlich: Überwache Body für größere Strukturänderungen
		observer.observe(document.body, {
			childList: true,
			subtree: true,
		});
	}

	/**
	 * Prüft ob ein Feld für Event-Handling relevant ist
	 */
	isRelevantField(element) {
		const id = element.id;
		const className = element.className;

		return (
			id.startsWith("aircraft-") ||
			id.startsWith("arrival-time-") ||
			id.startsWith("departure-time-") ||
			id.startsWith("position-") ||
			id.startsWith("hangar-position-") ||
			id.startsWith("notes-") ||
			id.startsWith("status-") ||
			id.startsWith("tow-status-") ||
			className.includes("aircraft") ||
			className.includes("position") ||
			className.includes("notes")
		);
	}

	/**
	 * Hängt Event-Handler an ein einzelnes Element an
	 */
	attachEventHandlersToElement(element, containerType = "unknown") {
		const cellId = this.extractCellIdFromElement(element);
		const handlerPrefix = `${containerType}_dynamic_${cellId || "unknown"}`;

		this.safeAddEventListener(
			element,
			"input",
			(event) => {
				if (window.isApplyingServerData) {
					return;
				}
				const fid = event.target.id || '';
				// Mark fence early on input to prevent echo overwrite
				try { if (window.serverSync && typeof window.serverSync._markPendingWrite === 'function') { window.serverSync._markPendingWrite(fid); } } catch(_e){}
				if (this.isFreeTextFieldId(fid)) {
					this._lastTypingAt = Date.now();
					this.debouncedFieldUpdate(fid, event.target.value, 500, { flushDelayMs: this.TYPING_DEBOUNCE_MS, source: 'input' });
				} else {
					this.debouncedFieldUpdate(fid, event.target.value);
				}
			},
			`${handlerPrefix}_input`
		);

		// Avoid duplicate blur listeners on aircraft inputs
		if (element.id && element.id.startsWith('aircraft-') && element.hasAttribute('data-aircraft-blur-wired')) {
			// already wired via UI initialization
		} else {
			if (element.id && element.id.startsWith('aircraft-')) {
				// Tooltip + contextmenu on dynamically added aircraft inputs
				try { if (!element.getAttribute('title')) element.setAttribute('title', 'Right-click to move content to another hangar position'); } catch(_){ }
				this.safeAddEventListener(
					element,
					'contextmenu',
					(e) => {
						e.preventDefault();
						const idMatch = (e.currentTarget.id||'').match(/aircraft-(\d+)/);
						const sourceId = idMatch ? parseInt(idMatch[1],10) : null;
						if (!isFinite(sourceId)) return;
						const val = (e.currentTarget.value||'').trim();
						if (!val) { try { window.showNotification && window.showNotification('No Aircraft ID in this tile', 'warning'); } catch(_){} return; }
						const free = (window.getFreeTilesWithLabels ? window.getFreeTilesWithLabels() : []).filter(t => t && t.id !== sourceId);
						if (!free.length) { try { window.showNotification && window.showNotification('No free tiles available', 'info'); } catch(_){} return; }
						if (typeof window.openTileSelectionOverlay === 'function') {
							window.openTileSelectionOverlay({ tiles: free, onSelect: (destId)=> { try { window.moveTileContent && window.moveTileContent(sourceId, destId); } catch(_){} } });
						} else {
							try { window.showNotification && window.showNotification('Selection overlay not available', 'error'); } catch(_){}
						}
					},
					`${handlerPrefix}_ctx`
				);
				element.setAttribute('data-aircraft-blur-wired', 'true');
			}
			this.safeAddEventListener(
				element,
				"blur",
				(event) => {
					if (window.isApplyingServerData) {
						return;
					}

				// KORREKTUR: Spezielle Behandlung für Aircraft ID Felder beim Verlassen des Feldes
				if (event.target.id.startsWith("aircraft-")) {
					// Prüfe ob Aircraft ID geleert wurde und lösche zugehörige Flugdaten
					if (
						window.hangarEvents &&
						typeof window.hangarEvents.handleAircraftIdChange === "function"
					) {
						window.hangarEvents.handleAircraftIdChange(
							event.target.id,
							event.target.value
						);
					}
} else if (
					(event.target.id.startsWith('arrival-time-') || event.target.id.startsWith('departure-time-')) &&
					typeof window.helpers !== 'undefined'
				) {
					const h = window.helpers;
					const raw = (event.target.value || '').trim();
					let iso = (typeof h.canonicalizeDateTimeFieldValue === 'function')
						? h.canonicalizeDateTimeFieldValue(event.target.id, raw)
						: raw;
					if (iso && typeof h.formatISOToCompactUTC === 'function'){
						event.target.value = h.formatISOToCompactUTC(iso);
						event.target.dataset.iso = iso;
					} else {
						event.target.value = '';
						delete event.target.dataset.iso;
					}
				}

				// Store ISO for date/time fields, otherwise raw value
				let storeVal = event.target.value;
				if ((event.target.id.startsWith('arrival-time-') || event.target.id.startsWith('departure-time-')) && typeof window.helpers !== 'undefined' && typeof window.helpers.canonicalizeDateTimeFieldValue === 'function'){
					const iso = window.helpers.canonicalizeDateTimeFieldValue(event.target.id, (event.target.dataset.iso || event.target.value || '').trim());
					if (iso) storeVal = iso; else storeVal = '';
				}

				const fid = event.target.id || '';
				const isFree = this.isFreeTextFieldId(fid);
				this.debouncedFieldUpdate(fid, storeVal, this.BLUR_SAVE_DELAY_MS, { flushDelayMs: isFree ? 0 : 150, source: 'blur' });
			},
			`${handlerPrefix}_blur`
		);
		}

		this.safeAddEventListener(
			element,
			"change",
			(event) => {
				if (window.isApplyingServerData) {
					return;
				}

				// KORREKTUR: Aircraft ID Handling entfernt vom change Event
				// um Doppelaufrufe zu verhindern - wird nur bei blur behandelt

				// Spezielle Behandlung für Status-Felder
				if (
					event.target.id.startsWith("status-") &&
					cellId &&
					window.updateStatusLights
				) {
					window.updateStatusLights(cellId);
				}

				const fid = event.target.id || '';
				try { if (window.serverSync && typeof window.serverSync._markPendingWrite === 'function') { window.serverSync._markPendingWrite(fid); } } catch(_e){}
				const isFree = this.isFreeTextFieldId(fid);
				// Hard lock this field from server applies for a short window after local change
				try { window.__fieldApplyLockUntil = window.__fieldApplyLockUntil || {}; window.__fieldApplyLockUntil[fid] = Date.now() + 15000; } catch(_e){}
				this.debouncedFieldUpdate(fid, event.target.value, 150, { flushDelayMs: isFree ? this.TYPING_DEBOUNCE_MS : 150, source: 'change' });
			},
			`${handlerPrefix}_change`
		);
	}

	/**
	 * Debugging und Monitoring
	 */
	getStatus() {
		return {
			initialized: this.initialized,
			registeredHandlers: this.registeredHandlers.size,
			storageQueueLength: this.storageQueue.length,
			activeDebounceTimers: this.debounceTimers.size,
			isProcessingStorage: this.isProcessingStorage,
			localEditsTracked: (this.lastLocalEdit && typeof this.lastLocalEdit === 'object') ? Object.keys(this.lastLocalEdit).length : 0,
		};
	}

	destroy() {
		this.cleanupExistingHandlers();
		this.debounceTimers.forEach((timer) => clearTimeout(timer));
		this.debounceTimers.clear();
		this.storageQueue.length = 0;
		this.initialized = false;
	}

	// Track a field's last local edit for conflict prompts
	recordLocalEdit(fieldId = '', value) {
		try {
			if (!fieldId) return;
			this.lastLocalEdit[fieldId] = { value, editedAt: Date.now() };
		} catch(_e){}
	}

	// Utility: identify free-text fields that should not live-sync per keystroke
	isFreeTextFieldId(fieldId = '') {
		try {
			return (
				fieldId.startsWith('notes-') ||
				fieldId.startsWith('aircraft-') ||
				fieldId.startsWith('position-') ||
				fieldId.startsWith('hangar-position-')
			);
		} catch(_e){ return false; }
	}

	// Utility: typing recency for read-back gating
	isUserTypingRecently(windowMs = 2000) {
		try { return (Date.now() - (this._lastTypingAt || 0)) < windowMs; } catch(_e){ return false; }
	}
}

// Globale Instanz erstellen
window.hangarEventManager = new HangarEventManager();
window.improved_event_manager = window.hangarEventManager; // Kompatibilität

// *** ZENTRALE INITIALISIERUNG STATT SEPARATER DOMContentLoaded ***
// Verwende zentrale Initialisierungsqueue statt separate DOMContentLoaded Events
window.hangarInitQueue = window.hangarInitQueue || [];
window.hangarInitQueue.push(function () {
	console.log(
		"🎯 Event Manager wird über zentrale Initialisierung gestartet..."
	);

	// Reduce timeout and add fallback for immediate initialization
	setTimeout(() => {
		if (window.hangarEventManager && !window.hangarEventManager.initialized) {
			console.log("⚡ Initialisiere Event Manager...");
			window.hangarEventManager.init();
		}
	}, 100); // Reduced from 200ms to 100ms for faster startup
});

// Additional immediate initialization attempt for cases where DOM is already ready
if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', () => {
		setTimeout(() => {
			if (window.hangarEventManager && !window.hangarEventManager.initialized) {
				console.log("⚡ Event Manager DOMContentLoaded Fallback-Initialisierung");
				window.hangarEventManager.init();
			}
		}, 50);
	});
} else {
	// DOM already loaded, try immediate init
	setTimeout(() => {
		if (window.hangarEventManager && !window.hangarEventManager.initialized) {
			console.log("⚡ Event Manager sofortige Fallback-Initialisierung");
			window.hangarEventManager.init();
		}
	}, 10);
}

// Für Debugging
window.getEventManagerStatus = () => window.hangarEventManager.getStatus();

// Expose helper for conflict detection lookups
window.getLastLocalEdit = function(fieldId){
	try { return (window.hangarEventManager && window.hangarEventManager.lastLocalEdit) ? (window.hangarEventManager.lastLocalEdit[fieldId] || null) : null; } catch(_e){ return null; }
};

console.log("📦 Improved Event Manager geladen und global verfügbar");
