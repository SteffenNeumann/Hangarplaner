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
		this._writeFenceMs = 20000; // fence TTL window (further increased to reduce oscillation in multi-master)
			// Presence-aware reads in Master mode: only read/apply when another Master is online
			// Default OFF for simpler, more reliable convergence in multi-master
			this.requireOtherMastersForRead = false;

		// Baseline of last server-applied data to compute precise deltas (fieldUpdates)
		this._baselinePrimary = {};
		this._baselineSecondary = {};
		// Remote locks advertised via presence (fieldId -> { until, sessionId, displayName })
		this._remoteLocks = {};
		this._presenceHeartbeatTimer = null;
		this._lastPresenceRefreshAt = 0;

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
	_pruneStaleFences(){ try { const now = this._now(); const win = this._writeFenceMs; Object.keys(this._pendingWrites||{}).forEach(k=>{ const ts = this._pendingWrites[k]||0; if (!ts || (now - ts) >= win) delete this._pendingWrites[k]; }); } catch(_e){} }
	// ===== Presence helpers (online Masters) =====
	_getPresenceUrl(){
		try {
			let base = this.getServerUrl();
			if (typeof base !== 'string' || !base.length) base = (window.location.origin + '/sync/data.php');
			const url = base.replace(/data\.php(?:\?.*)?$/i, 'presence.php');
			return /presence\.php/i.test(url) ? url : (window.location.origin + '/sync/presence.php');
		} catch(e){ try { return window.location.origin + '/sync/presence.php'; } catch(_e2){ return '/sync/presence.php'; } }
	}
	async _hasOtherMastersOnline(){
		try {
			const url = this._getPresenceUrl() + '?action=list';
			const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
			if (!res.ok) return false;
			const data = await res.json();
			const users = Array.isArray(data?.users) ? data.users : [];
			let mySession = '';
			try { mySession = this.getSessionId ? (this.getSessionId()||'') : (localStorage.getItem('presence.sessionId')||''); } catch(_e){}
			return !!users.find(u => ((u?.role || '').toLowerCase() === 'master') && u.sessionId && u.sessionId !== mySession);
		} catch(e){ return false; }
	}
	_collectLocalLocks(){
		try {
			const now = Date.now();
			const map = (window.__fieldApplyLockUntil && typeof window.__fieldApplyLockUntil==='object') ? window.__fieldApplyLockUntil : {};
			// Prefer the explicitly tracked last active field
			try {
				const fid = (window.__lastActiveFieldId || '').toString();
				const until = parseInt(map[fid] || 0, 10) || 0;
				if (fid && until > now && this._isRelevantFieldId && this._isRelevantFieldId(fid)){
					const out = {}; out[fid] = until; return out;
				}
			} catch(_e){}
			// Fallback: choose the most recent non-expired lock
			let latestK = '';
			let latestV = 0;
			try {
				Object.keys(map).forEach(k => { const u = parseInt(map[k],10)||0; if (u>now && u>latestV && this._isRelevantFieldId && this._isRelevantFieldId(k)){ latestV=u; latestK=k; } });
			} catch(_e){}
			if (latestK){ const out = {}; out[latestK] = latestV; return out; }
			return {};
		} catch(_e){ return {}; }
	}
	async _sendPresenceHeartbeat(){
		try {
			const url = this._getPresenceUrl();
			const sid = this.getSessionId ? this.getSessionId() : (localStorage.getItem('presence.sessionId') || localStorage.getItem('serverSync.sessionId') || '');
			let dname = '';
			try { const inp = document.getElementById('presenceNameInput'); if (inp && inp.value) dname = (inp.value||'').trim(); } catch(_eDom){}
			try { if (!dname) dname = (localStorage.getItem('presence.displayName') || '').trim(); } catch(_e){}
			if (!dname) { try { dname = 'User-' + String(sid||'').slice(-4); } catch(_e2) { dname = 'User'; } }
			const role = this._isMasterMode && this._isMasterMode() ? 'master' : (this.canReadFromServer && this.canReadFromServer() ? 'sync' : 'standalone');
			const locks = this._collectLocalLocks();
await fetch(url, { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({ action:'heartbeat', sessionId: sid, displayName: dname, role, page: 'planner', locks, locksReplace: true }) });
		} catch(_e){}
	}
	_startPresenceHeartbeat(){
		try {
			if (this._presenceHeartbeatTimer) { clearInterval(this._presenceHeartbeatTimer); this._presenceHeartbeatTimer = null; }
			// Send immediately, then every 20s
			this._sendPresenceHeartbeat();
			this._presenceHeartbeatTimer = setInterval(() => { try { this._sendPresenceHeartbeat(); } catch(_e){} }, 20000);
		} catch(_e){}
	}
	_stopPresenceHeartbeat(){ try { if (this._presenceHeartbeatTimer) { clearInterval(this._presenceHeartbeatTimer); this._presenceHeartbeatTimer = null; } } catch(_e){}
	async _refreshRemoteLocksFromPresence(force){
		try { force = !!force; } catch(_e){}
		try {
			const now = Date.now();
			if (!force && (now - (this._lastPresenceRefreshAt||0)) < 1000) return; // throttle to ~1s
			this._lastPresenceRefreshAt = now;
			// Store previous locks state for cleanup
			const previousLocks = { ...this._remoteLocks };
			const url = this._getPresenceUrl() + '?action=list';
			const res = await fetch(url, { headers: { 'Accept':'application/json' } });
			if (!res.ok) return;
			const data = await res.json();
			const users = Array.isArray(data?.users) ? data.users : [];
			let mySession = '';
			try { mySession = this.getSessionId ? (this.getSessionId()||'') : (localStorage.getItem('presence.sessionId')||localStorage.getItem('serverSync.sessionId')||''); } catch(_e){}
			const locks = {};
			users.forEach(u => {
				try {
					const sid = (u?.sessionId || '').toString().trim(); if (!sid || sid === mySession) return;
					const name = (u?.displayName || ('User-' + sid.slice(-4))).toString();
					const map = (u?.locks && typeof u.locks === 'object') ? u.locks : {};
					Object.entries(map).forEach(([fid, until]) => {
						const u2 = parseInt(until, 10) || 0; if (u2 > now) {
							const prev = locks[fid]; if (!prev || (u2 > prev.until)) locks[fid] = { until: u2, sessionId: sid, displayName: name };
						}
					});
				} catch(_e){}
			});
			this._remoteLocks = locks;
			// Clean up borders for removed locks before rendering
			try {
				Object.keys(previousLocks).forEach(fieldId => {
					if (!this._remoteLocks[fieldId]) {
						const field = document.getElementById(fieldId);
						if (field) {
							field.classList.remove('remote-locked-field');
						}
					}
				});
			} catch(_c){}
			// Render visual pills for active locks
			try { this._renderEditingLockPills(); } catch(_e){}
		} catch(_e){}
	}
	_startPresenceRefreshPoller(){
		try {
			if (this._presenceRefreshTimer) { clearInterval(this._presenceRefreshTimer); this._presenceRefreshTimer = null; }
			// Faster polling (500ms) for more responsive lock updates
			this._presenceRefreshTimer = setInterval(() => { try { this._refreshRemoteLocksFromPresence(true); } catch(_e){} }, 500);
		} catch(_e){}
	}
	_stopPresenceRefreshPoller(){ try { if (this._presenceRefreshTimer) { clearInterval(this._presenceRefreshTimer); this._presenceRefreshTimer = null; } } catch(_e){}
	_renderEditingLockPills(){
		try {
			const now = Date.now();
			const map = this._remoteLocks || {};
			// Remove stale pills not present or expired
			try {
				document.querySelectorAll('span.editing-pill').forEach(p => {
					const fid = (p.id||'').replace('editing-pill-','');
					const info = map[fid];
					if (!info || (info.until||0) <= now) {
						// Remove styles and pill from field
						const field = document.getElementById(fid);
						if (field) {
							field.classList.remove('remote-locked-field');
							// Restore original styles
							if (field.dataset.originalBg !== undefined) {
								field.style.background = field.dataset.originalBg;
								field.style.border = field.dataset.originalBorder;
								field.style.boxShadow = field.dataset.originalBoxShadow;
								delete field.dataset.originalBg;
								delete field.dataset.originalBorder;
								delete field.dataset.originalBoxShadow;
							}
						}
						p.remove();
					}
				});
			} catch(_r){}
			Object.entries(map).forEach(([fid, info]) => {
				try { if (!info || (info.until||0) <= now) return; this._createOrUpdateEditingLockPill(fid, info.displayName || 'User', info.until); } catch(_e){}
			});
			// Also show our local pill for own locks as subtle hint (optional)
			const local = this._collectLocalLocks();
			Object.entries(local).forEach(([fid, until]) => { try { this._createOrUpdateEditingLockPill(fid, 'You', until); } catch(_e){} });
			// Clean up orphaned styles for fields without locks
			try {
				document.querySelectorAll('.remote-locked-field').forEach(field => {
					const fieldId = field.id;
					if (!this._remoteLocks[fieldId]) {
						field.classList.remove('remote-locked-field');
						// Restore original styles
						if (field.dataset.originalBg !== undefined) {
							field.style.background = field.dataset.originalBg;
							field.style.border = field.dataset.originalBorder;
							field.style.boxShadow = field.dataset.originalBoxShadow;
							delete field.dataset.originalBg;
							delete field.dataset.originalBorder;
							delete field.dataset.originalBoxShadow;
						}
					}
				});
			} catch(_c){}
		} catch(_e){}
	}
	_createOrUpdateEditingLockPill(fieldId, label, until){
		console.log(`🔍 _createOrUpdateEditingLockPill called: fieldId=${fieldId}, label=${label}, until=${until}`);
		try {
			const el = document.getElementById(fieldId);
			console.log(`🔍 Element found:`, el);
			if (!el) {
				console.warn(`⚠️ No element found for fieldId: ${fieldId}`);
				return;
			}
			const id = `editing-pill-${fieldId}`;
			let pill = document.getElementById(id);
			// Anchor in an input container if available
			let container = null;
			try { container = el.closest('.input-container') || el.parentElement; } catch(_c) {}
			if (container && !/relative/.test((container.style && container.style.position) || '')){
				try { container.style.position = 'relative'; } catch(_s){}
			}
			if (!pill) {
				pill = document.createElement('span');
				pill.id = id;
				pill.className = 'editing-pill';
				// Tail element for speech bubble
				const tail = document.createElement('i');
				tail.className = 'editing-pill-tail';
				pill.appendChild(tail);
				try { (container||el.parentNode).appendChild(pill); } catch(_e){ try { el.insertAdjacentElement('afterend', pill); } catch(_){} }
			}
			const mins = Math.max(0, Math.ceil((until - Date.now())/60000));
			// Update text (keep tail child)
			try {
				const txt = `${label} editing • ${mins}m`;
				// If firstChild is tail, manage text separately
				if (pill.firstChild && pill.firstChild.classList && pill.firstChild.classList.contains('editing-pill-tail')){
					pill.lastChild && pill.lastChild.nodeType === Node.TEXT_NODE ? (pill.lastChild.textContent = txt) : pill.appendChild(document.createTextNode(txt));
				} else {
					pill.textContent = txt; // fallback
				}
			} catch(_t){}
			// Add background highlight for remote users only (Multi-Master Mode)
			console.log(`🎨 About to check label condition: label='${label}', condition result: ${label !== 'You'}`);
			try {
				if (label !== 'You') {
					console.log(`🟢 Condition passed! Applying inline styles to ${fieldId}...`);
					// Store original styles so we can restore them later
					if (!el.dataset.originalBg) {
						el.dataset.originalBg = el.style.background || '';
						el.dataset.originalBorder = el.style.border || '';
						el.dataset.originalBoxShadow = el.style.boxShadow || '';
					}
					// Apply inline styles - these will override any CSS
					console.log(`🔧 About to add class and set styles...`);
					el.classList.add('remote-locked-field');
					console.log(`🔧 Class added. Now setting background...`);
					el.style.background = 'rgba(244, 158, 12, 0.25)';
					console.log(`🔧 Background set. Now setting border...`);
					el.style.border = '2px solid rgba(244, 158, 12, 0.8)';
					console.log(`🔧 Border set. Now setting boxShadow...`);
					el.style.boxShadow = '0 0 12px rgba(244, 158, 12, 0.5)';
					console.log(`🔧 BoxShadow set. Now setting transition...`);
					el.style.transition = 'all 0.2s ease';
					console.log(`🔒 🎨 Applied INLINE styles to ${fieldId} for user: ${label}`);
					console.log(`   Background: ${el.style.background}`);
					console.log(`   Border: ${el.style.border}`);
					console.log(`   Box-shadow: ${el.style.boxShadow}`);
					console.log(`   Element after styling:`, el);
					console.log(`   Element.style object:`, el.style);
				} else {
					// Restore original styles for own fields
					el.classList.remove('remote-locked-field');
					if (el.dataset.originalBg !== undefined) {
						el.style.background = el.dataset.originalBg;
						el.style.border = el.dataset.originalBorder;
						el.style.boxShadow = el.dataset.originalBoxShadow;
						delete el.dataset.originalBg;
						delete el.dataset.originalBorder;
						delete el.dataset.originalBoxShadow;
					}
					console.log(`✅ Removed remote-locked styles from ${fieldId} (own field)`);
				}
			} catch(_b){ console.error('Failed to add/remove remote-locked-field styles:', _b); }
		} catch(_e){}
	}
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
	_isRelevantFieldId(fid){
		try {
			return (typeof fid === 'string') && /^(aircraft|arrival-time|departure-time|hangar-position|position|status|tow-status|notes)-(\d+)$/.test(fid);
		} catch(_e){ return false; }
	}
	_activeRelevantFieldId(){
		try {
			const el = (typeof document !== 'undefined' && document.activeElement) ? document.activeElement : null;
			const id = (el && el.id) ? el.id : '';
			return (this._isRelevantFieldId && this._isRelevantFieldId(id)) ? id : '';
		} catch(_e){ return ''; }
	}
	_cloneFilteredServerData(serverData){
		try {
			const copyTile = (t)=>{
				const id = parseInt(t?.tileId||0,10);
				const out = { tileId: id };
				const keys = ['aircraftId','arrivalTime','departureTime','hangarPosition','position','status','towStatus','notes','updatedAt','updatedBy','updatedBySession'];
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
		 * Build a map id->tile for quick lookup
		 */
		_buildTileMap(data){
			try {
				const toMap = (arr)=>{
					const m = {};
					(arr||[]).forEach(t=>{ const id = parseInt(t?.tileId||0,10); if (id) m[id] = { ...t, tileId:id }; });
					return m;
				};
				return {
					primary: toMap(data?.primaryTiles||[]),
					secondary: toMap(data?.secondaryTiles||[]),
				};
			} catch(e){ return { primary:{}, secondary:{} }; }
		}

		_isMasterMode(){
			try {
				if (this.isMaster) return true;
				if (window.sharingManager && window.sharingManager.syncMode === 'master') return true;
			} catch(_e){}
			return false;
		}

		/**
		 * Detect conflicts and filter server data so we only apply other users' changes
		 * A conflict is when the same field diverged from the baseline both locally and on the server.
		 */

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
			// Use single-mode selector state
			if (window.sharingManager && typeof window.sharingManager.syncMode === 'string') {
				const m = window.sharingManager.syncMode;
				return m === 'sync' || m === 'master';
			}
			// Fallback to internal slave activity flag
			return !!this.isSlaveActive;
		} catch (_) {
			return !!this.isSlaveActive;
		}
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
		// Start presence heartbeats for locks
		this._startPresenceHeartbeat();
		// Fast presence lock polling for immediate pills
		this._startPresenceRefreshPoller();

		// Zusätzlich Updates empfangen (15 Sekunden Intervall)
			this.slaveCheckInterval = setInterval(async () => {
				await this.slaveCheckForUpdates();
			}, 3000); // 3 Sekunden für Master-Update-Check
			console.log("👑 Master-Modus: Empfange zusätzlich Updates (3s, Read forced ON)");

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
			// Refresh remote locks periodically as part of read polling
			try { await this._refreshRemoteLocksFromPresence(false); } catch(_e){}
			await this.slaveCheckForUpdates();
		}, 3000); // 3 Sekunden Polling-Intervall

		console.log(
			"👤 Slave-Modus gestartet - Polling für Updates alle 3 Sekunden aktiv"
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
			const intervalMs = this.isMaster ? 5000 : 3000;
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

	/**
	 * Debug: force a baseline refresh from server snapshot (safe, no logic change)
	 */
	async forceBaselineRefresh(immediateReadBack = false) {
		try {
			const fresh = await this.loadFromServer();
			if (fresh && !fresh.error) {
				await this.applyServerData(fresh);
				if (immediateReadBack && this.canReadFromServer && this.canReadFromServer()) {
					try { await this.slaveCheckForUpdates(); } catch(_e){}
				}
				console.log('🔧 Baseline refreshed from server snapshot');
				return true;
			}
			console.warn('⚠️ Baseline refresh: no server data');
			return false;
		} catch(e) {
			console.warn('forceBaselineRefresh failed', e);
			return false;
		}
	}

	async slaveCheckForUpdates() {
        if (!this.isSlaveActive) return;
        if (this._isCheckingUpdates) return;
        this._isCheckingUpdates = true;

        try {
			console.log("🔍 Slave: Prüfe auf Server-Updates...");
			// Skip read-back while user is actively typing to prevent flip-backs
			try {
				const typingWin = Math.min(15000, (this._writeFenceMs || 7000));
				if (window.hangarEventManager && typeof window.hangarEventManager.isUserTypingRecently === 'function') {
					const isReadOnly = !!(document.body && document.body.classList.contains('read-only')) || !!(window.sharingManager && window.sharingManager.syncMode === 'sync');
					if (!isReadOnly && window.hangarEventManager.isUserTypingRecently(typingWin)) {
						return; // finally will clear _isCheckingUpdates
					}
				}
			} catch(_e) {}
			// Also skip if a relevant field is currently focused (prevents caret jumps/flip-backs)
			// BUT do not stall read-only receivers: in Sync mode or when the element is disabled, we still proceed.
			try {
				const activeId = (typeof document !== 'undefined' && document.activeElement && document.activeElement.id) ? document.activeElement.id : '';
				if (this._isRelevantFieldId && this._isRelevantFieldId(activeId)) {
					const el = document.getElementById(activeId);
					const isReadOnly = !!(document.body && document.body.classList.contains('read-only')) || !!(window.sharingManager && window.sharingManager.syncMode === 'sync');
					const isDisabled = !!(el && el.disabled === true);
					if (!isReadOnly && !isDisabled) {
						return; // finally will clear _isCheckingUpdates
					}
				}
			} catch(_e) {}
			// Also opportunistically refresh remote locks (throttled)
			try { await this._refreshRemoteLocksFromPresence(false); } catch(_e){}
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

		// If user is actively typing, skip this periodic sync to avoid mid-typing oscillation
		try {
			if (window.hangarEventManager && typeof window.hangarEventManager.isUserTypingRecently === 'function'){
				const win = Math.min(15000, (this._writeFenceMs || 7000));
				if (window.hangarEventManager.isUserTypingRecently(win)) {
					// Defer until typing settles
					return true;
				}
			}
		} catch(_e){}

		// Verhindere gleichzeitige Sync-Operationen
		if (window.isSavingToServer) {
			// console.log("⏸️ Server-Sync übersprungen (Speicherung läuft bereits)");
			return false;
		}

			// Performance: prüfe erst, ob sich Daten geändert haben.
			// Wenn keine Änderungen vorliegen, posten wir trotzdem Einstellungen weiter unten (settings-only), um UI-Änderungen zu persistieren.
			const noChanges = !this.hasDataChanged();

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
				try { console.log('⏳ Preflight ts', { srvTs, last: (this.lastServerTimestamp||0) }); } catch(_e2){}
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
			let delta = this._computeFieldUpdates(currentData);
			// Filter out fields locked by other Masters
			try {
				const now = Date.now();
				if (this._remoteLocks && delta && typeof delta==='object') {
					Object.keys(delta).forEach(fid => {
						const info = this._remoteLocks[fid];
						if (info && (info.until||0) > now) {
							delete delta[fid];
							try { if (window.showNotification) window.showNotification(`Field locked by ${info.displayName}`, 'warning'); } catch(_e){}
						}
					});
				}
			} catch(_e){}
			try { if (delta && typeof delta === 'object') { Object.keys(delta).forEach(fid => { try { this._markPendingWrite(fid); } catch(_e){} }); } } catch(_e){}
			if (delta && Object.keys(delta).length > 0) {
				// Include baseline preconditions for optimistic concurrency
				const pre = {};
				try {
					Object.keys(delta).forEach(fid => {
						const m = fid.match(/^(aircraft|arrival-time|departure-time|hangar-position|position|status|tow-status|notes)-(\d+)$/);
						if (!m) return; const field = m[1]; const id = parseInt(m[2],10);
						const keyMap = { 'aircraft':'aircraftId','arrival-time':'arrivalTime','departure-time':'departureTime','hangar-position':'hangarPosition','position':'position','status':'status','tow-status':'towStatus','notes':'notes' };
						const key = keyMap[field]; if (!key) return;
						const base = (id>=100 ? this._baselineSecondary[id] : this._baselinePrimary[id]) || {};
						pre[fid] = (base[key] ?? '');
					});
				} catch(_e){}
				let __uname = '';
				try { const inp = document.getElementById('presenceNameInput'); if (inp && inp.value) __uname = (inp.value||'').trim(); } catch(_eDom){}
				try { if (!__uname) __uname = (localStorage.getItem('presence.displayName') || '').trim(); } catch(_e){}
				requestBody = { metadata: { timestamp: Date.now(), displayName: __uname }, fieldUpdates: delta, preconditions: pre, settings: currentData.settings || {} };
            } else {
                // No field delta: skip POST in multi-master to avoid metadata churn and self-echo suppression
                // Read-back polling will still converge both clients.
                console.log('⏭️ No field delta; skipping POST (multi-master safe)');
                return true;
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
			// Always provide a stable session for server coordination and a non-empty display name
			try {
				const sid = this.getSessionId();
				if (sid) headers["X-Sync-Session"] = sid;
				let dname = '';
				// Prefer live value from header input
				try { const inp = document.getElementById('presenceNameInput'); if (inp && inp.value) dname = (inp.value || '').trim(); } catch(_eDom){}
				// Fallback to localStorage
				if (!dname) { try { dname = (localStorage.getItem('presence.displayName') || '').trim(); } catch(_e){} }
				if (!dname) { try { dname = 'User-' + String(sid||'').slice(-4); } catch(_e2) { dname = 'User'; } }
				headers["X-Display-Name"] = dname;
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
					// Read-after-write: delay read-back if user is actively typing to avoid caret jump
					try {
						const typingWin = Math.min(15000, (this._writeFenceMs || 7000));
						const typingActive = !!(window.hangarEventManager && typeof window.hangarEventManager.isUserTypingRecently === 'function' && window.hangarEventManager.isUserTypingRecently(typingWin));
						let allowReadBack = true;
						try { if (this._isMasterMode() && this.requireOtherMastersForRead) { allowReadBack = await this._hasOtherMastersOnline(); } } catch(_e){ allowReadBack = false; }
						if (allowReadBack && this.canReadFromServer && this.canReadFromServer()) {
							if (typingActive) {
								setTimeout(async () => {
									try { if (this.canReadFromServer && this.canReadFromServer()) { await this.slaveCheckForUpdates(); } } catch(_e){}
								}, Math.max(1500, Math.floor(typingWin/2)));
							} else {
								await this.slaveCheckForUpdates();
							}
						}
					} catch(_e) {}
					// Update baseline optimistically if we posted deltas
					try {
						if (requestBody && requestBody.fieldUpdates) {
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
				} else if (response.status === 409) {
					// Conflict detected: keep-local retry for recently edited fields, else accept server
					try {
						let payload = null; try { payload = await response.json(); } catch(_e){}
						const conflicts = (payload && Array.isArray(payload.conflicts)) ? payload.conflicts : [];
						const keepUpdates = {};
						const pre = {};
						const KEEP_WIN = Math.min(15000, (this._writeFenceMs || 7000) + 3000);
						const getLE = (typeof window.getLastLocalEdit === 'function') ? window.getLastLocalEdit : null;
						if (conflicts.length && getLE) {
							conflicts.forEach(c => {
								const fid = (c && c.fieldId) ? String(c.fieldId) : '';
								if (!fid) return;
								const le = getLE(fid);
								if (le && le.editedAt && ((Date.now() - le.editedAt) < KEEP_WIN)) {
									// Prefer current delta value if present, else last local edit value
									let v = (delta && Object.prototype.hasOwnProperty.call(delta, fid)) ? delta[fid] : (le.value || '');
									keepUpdates[fid] = v;
									if (c && Object.prototype.hasOwnProperty.call(c, 'serverValue')) pre[fid] = (c.serverValue ?? '');
								}
							});
						}
						if (Object.keys(keepUpdates).length > 0) {
							// Retry targeted write to keep local edits
							const body2 = { metadata: { timestamp: Date.now() }, fieldUpdates: keepUpdates, preconditions: pre, settings: {} };
							const headers2 = { "Content-Type": "application/json" };
							if (this.isMaster) headers2["X-Sync-Role"] = "master";
							try {
								const sid = this.getSessionId(); if (sid) headers2["X-Sync-Session"] = sid;
								let dname = '';
								try { const inp = document.getElementById('presenceNameInput'); if (inp && inp.value) dname = (inp.value||'').trim(); } catch(_eDom){}
								if (!dname) { try { dname = (localStorage.getItem('presence.displayName') || '').trim(); } catch(_e){} }
								if (!dname) { try { dname = 'User-' + String(sid||'').slice(-4); } catch(_e) { dname = 'User'; } }
								headers2["X-Display-Name"] = dname;
							} catch(_e){}
							const { signal: sig2, cancel: cancel2 } = this._createTimeoutSignal(10000);
							const url2 = this.getServerUrl();
							const res2 = await fetch(url2, { method: 'POST', headers: headers2, body: JSON.stringify(body2), signal: sig2 });
							cancel2 && cancel2();
							if (res2.ok) {
								// Try to advance timestamp and update local baselines optimistically for kept fields
								try {
									let _resp2 = null; try { _resp2 = await res2.json(); } catch(_e){}
									try { const ts2 = parseInt(_resp2?.timestamp || 0, 10); if (ts2) { this.lastServerTimestamp = Math.max(this.lastServerTimestamp||0, ts2); } } catch(_e){}
									// Apply keepUpdates to baseline so we don't re-post the same deltas
									Object.entries(keepUpdates).forEach(([fid, val]) => {
										const m = fid.match(/^(aircraft|arrival-time|departure-time|hangar-position|position|status|tow-status|notes)-(\d+)$/);
										if (!m) return;
										const field = m[1];
										const id = parseInt(m[2], 10);
										const keyMap = { 'aircraft':'aircraftId','arrival-time':'arrivalTime','departure-time':'departureTime','hangar-position':'hangarPosition','position':'position','status':'status','tow-status':'towStatus','notes':'notes' };
										const key = keyMap[field]; if (!key) return;
										const tgt = (id>=100 ? this._baselineSecondary : this._baselinePrimary);
										tgt[id] = tgt[id] || { tileId: id };
										tgt[id][key] = val;
									});
								} catch(_e){}
								// Optional read-back if not typing
								try {
									const typingWin = Math.min(15000, (this._writeFenceMs || 7000));
									const typingActive = !!(window.hangarEventManager && typeof window.hangarEventManager.isUserTypingRecently === 'function' && window.hangarEventManager.isUserTypingRecently(typingWin));
									if (!typingActive && this.canReadFromServer && this.canReadFromServer()) {
										const d = await this.loadFromServer(); if (d && !d.error) await this.applyServerData(d);
									}
								} catch(_e){}
								return true;
							} else {
								// Retry failed: accept server state now
								try { const d = await this.loadFromServer(); if (d && !d.error) await this.applyServerData(d); } catch(_e){}
								return true;
							}
						}
						// No recent local edit to protect: accept server
						const d = await this.loadFromServer();
						if (d && !d.error) await this.applyServerData(d);
						return true;
					} catch(_err) {
						try { const d = await this.loadFromServer(); if (d && !d.error) await this.applyServerData(d); } catch(_e){}
						return true;
					}
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
	 * Post a targeted set of fieldUpdates immediately (bypasses change-detection), Master-only
	 * @param {Object} fieldUpdates - map of fieldId -> value (e.g., { 'aircraft-1': '', 'status-1': 'neutral' })
	 * @param {Object} options - optional flags
	 * @returns {Promise<boolean>} success
	 */
	async syncFieldUpdates(fieldUpdates = {}, options = {}) {
		try {
			if (!this.serverSyncUrl) {
				console.warn("⚠️ Server-URL nicht konfiguriert");
				if (window.showNotification) window.showNotification("Server-URL nicht konfiguriert – Sync übersprungen", "warning");
				return false;
			}
			if (!this.isMaster) {
				console.log("⛔ Read-only mode: targeted write skipped (client not master)");
				if (window.showNotification) window.showNotification("Read-only Modus – Schreiben zum Server deaktiviert", "info");
				return false;
			}
			if (!fieldUpdates || typeof fieldUpdates !== 'object' || Object.keys(fieldUpdates).length === 0) {
				return true; // nothing to do
			}
			if (window.isSavingToServer) {
				return false;
			}
			window.isSavingToServer = true;

			// Filter out fields locked by other Masters
			try {
				const now = Date.now();
				if (this._remoteLocks && fieldUpdates && typeof fieldUpdates==='object') {
					Object.keys(fieldUpdates).forEach(fid => {
						const info = this._remoteLocks[fid];
						if (info && (info.until||0) > now) {
							delete fieldUpdates[fid];
							try { if (window.showNotification) window.showNotification(`Field locked by ${info.displayName}`, 'warning'); } catch(_e){}
						}
					});
				}
			} catch(_e){}
			const pre = {};
			try {
				Object.keys(fieldUpdates).forEach(fid => {
					const m = fid.match(/^(aircraft|arrival-time|departure-time|hangar-position|position|status|tow-status|notes)-(\d+)$/);
					if (!m) return; const field = m[1]; const id = parseInt(m[2],10);
					const keyMap = { 'aircraft':'aircraftId','arrival-time':'arrivalTime','departure-time':'departureTime','hangar-position':'hangarPosition','position':'position','status':'status','tow-status':'towStatus','notes':'notes' };
					const key = keyMap[field]; if (!key) return;
					const base = (id>=100 ? this._baselineSecondary[id] : this._baselinePrimary[id]) || {};
					pre[fid] = (base[key] ?? '');
				});
			} catch(_e){}
			let __uname3 = '';
			try { const inp = document.getElementById('presenceNameInput'); if (inp && inp.value) __uname3 = (inp.value||'').trim(); } catch(_eDom){}
			try { if (!__uname3) __uname3 = (localStorage.getItem('presence.displayName') || '').trim(); } catch(_e){}
			const body = { metadata: { timestamp: Date.now(), displayName: __uname3 }, fieldUpdates, preconditions: pre, settings: {} };
			const headers = { "Content-Type": "application/json" };
			if (this.isMaster) headers["X-Sync-Role"] = "master";
			try {
				const sid = this.getSessionId(); if (sid) headers["X-Sync-Session"] = sid;
				let dname = '';
				try { const inp = document.getElementById('presenceNameInput'); if (inp && inp.value) dname = (inp.value||'').trim(); } catch(_eDom){}
				if (!dname) { try { dname = (localStorage.getItem('presence.displayName') || '').trim(); } catch(_e){} }
				if (!dname) { try { dname = 'User-' + String(sid||'').slice(-4); } catch(_e) { dname = 'User'; } }
				headers["X-Display-Name"] = dname;
			} catch(_e){}

			const { signal, cancel } = this._createTimeoutSignal(10000);
			const serverUrl = this.getServerUrl();
			const res = await fetch(serverUrl, { method: 'POST', headers, body: JSON.stringify(body), signal });
			cancel && cancel();
			if (res.status === 409) {
				// Intelligent 409 handling: if the user recently edited the conflicting fields, keep local by re-posting with server preconditions
				try {
					if (options && options._retryFrom409) {
						// Already retried once, accept server
						const data = await this.loadFromServer();
						if (data && !data.error) await this.applyServerData(data);
						return true;
					}
					let payload = null;
					try { payload = await res.json(); } catch(_e){}
					const conflicts = (payload && Array.isArray(payload.conflicts)) ? payload.conflicts : [];
					const keepUpdates = {};
					const pre = {};
					const KEEP_WIN = Math.min(15000, (this._writeFenceMs || 7000) + 3000);
					const getLE = (typeof window.getLastLocalEdit === 'function') ? window.getLastLocalEdit : null;
					if (conflicts.length && getLE) {
						conflicts.forEach(c => {
							const fid = (c && c.fieldId) ? String(c.fieldId) : '';
							if (!fid) return;
							const le = getLE(fid);
							if (le && le.editedAt && ((Date.now() - le.editedAt) < KEEP_WIN)) {
								// Keep local for this field
								let v = (fieldUpdates && Object.prototype.hasOwnProperty.call(fieldUpdates, fid)) ? fieldUpdates[fid] : (le.value || '');
								keepUpdates[fid] = v;
								// Use serverValue from conflict as precondition to pass on retry
								if (c && Object.prototype.hasOwnProperty.call(c, 'serverValue')) pre[fid] = (c.serverValue ?? '');
							}
						});
					}
					if (Object.keys(keepUpdates).length > 0) {
						// Retry a targeted write keeping local values for conflicting fields only
						const body2 = { metadata: { timestamp: Date.now() }, fieldUpdates: keepUpdates, preconditions: pre, settings: {} };
						const headers2 = { "Content-Type": "application/json" };
						if (this.isMaster) headers2["X-Sync-Role"] = "master";
						try {
							const sid = this.getSessionId(); if (sid) headers2["X-Sync-Session"] = sid;
							let dname = '';
							try { const inp = document.getElementById('presenceNameInput'); if (inp && inp.value) dname = (inp.value||'').trim(); } catch(_eDom){}
							if (!dname) { try { dname = (localStorage.getItem('presence.displayName') || '').trim(); } catch(_e){} }
							if (!dname) { try { dname = 'User-' + String(sid||'').slice(-4); } catch(_e) { dname = 'User'; } }
							headers2["X-Display-Name"] = dname;
						} catch(_e){}
						const { signal: sig2, cancel: cancel2 } = this._createTimeoutSignal(10000);
						const url2 = this.getServerUrl();
						const res2 = await fetch(url2, { method: 'POST', headers: headers2, body: JSON.stringify(body2), signal: sig2 });
						cancel2 && cancel2();
						if (res2.ok) {
							// Success: optionally read-back if not typing
							try {
								const typingWin = Math.min(15000, (this._writeFenceMs || 7000));
								const typingActive = !!(window.hangarEventManager && typeof window.hangarEventManager.isUserTypingRecently === 'function' && window.hangarEventManager.isUserTypingRecently(typingWin));
								if (!typingActive && this.canReadFromServer && this.canReadFromServer()) {
									const d = await this.loadFromServer(); if (d && !d.error) await this.applyServerData(d);
								}
							} catch(_e){}
							return true;
						} else {
							// Retry failed: accept server state now
							try { const d = await this.loadFromServer(); if (d && !d.error) await this.applyServerData(d); } catch(_e){}
							return true;
						}
					}
					// No recent local edit to protect: accept server
					const d = await this.loadFromServer();
					if (d && !d.error) await this.applyServerData(d);
					return true;
				} catch(err) {
					try { const d = await this.loadFromServer(); if (d && !d.error) await this.applyServerData(d); } catch(_e){}
					return true;
				}
			}
			if (!res.ok) {
				let detail = '';
				try { detail = await res.text(); } catch(_e){}
				console.warn("⚠️ Targeted POST failed:", res.status, detail);
				if (window.showNotification) window.showNotification(`Server-Sync fehlgeschlagen: ${res.status}`, 'error');
				return false;
			}
			let payload = null; try { payload = await res.json(); } catch(_e){}
			try {
				const ts = parseInt(payload?.timestamp || 0, 10);
				if (ts) this.lastServerTimestamp = Math.max(this.lastServerTimestamp||0, ts);
			} catch(_e){}

			// Optional immediate read-back to converge, but avoid while typing
			try {
				const typingWin = Math.min(15000, (this._writeFenceMs || 7000));
				const typingActive = !!(window.hangarEventManager && typeof window.hangarEventManager.isUserTypingRecently === 'function' && window.hangarEventManager.isUserTypingRecently(typingWin));
				let allowReadBack = true;
				try { if (this._isMasterMode() && this.requireOtherMastersForRead) { allowReadBack = await this._hasOtherMastersOnline(); } } catch(_e){ allowReadBack = false; }
				if (allowReadBack && this.canReadFromServer && this.canReadFromServer()) {
					if (typingActive) {
						setTimeout(async () => {
							try { if (this.canReadFromServer && this.canReadFromServer()) { const data = await this.loadFromServer(); if (data && !data.error) await this.applyServerData(data); } } catch(_e){}
						}, Math.max(1500, Math.floor(typingWin/2)));
					} else {
						const data = await this.loadFromServer();
						if (data && !data.error) await this.applyServerData(data);
					}
				}
			} catch(_e){}

			// Update local baselines optimistically with applied fieldUpdates
			try {
				Object.entries(fieldUpdates).forEach(([fid, val]) => {
					const m = fid.match(/^(aircraft|arrival-time|departure-time|hangar-position|position|status|tow-status|notes)-(\d+)$/);
					if (!m) return;
					const field = m[1];
					const id = parseInt(m[2], 10);
					const keyMap = { 'aircraft':'aircraftId','arrival-time':'arrivalTime','departure-time':'departureTime','hangar-position':'hangarPosition','position':'position','status':'status','tow-status':'towStatus','notes':'notes' };
					const key = keyMap[field]; if (!key) return;
					const tgt = (id>=100 ? this._baselineSecondary : this._baselinePrimary);
					tgt[id] = tgt[id] || { tileId: id };
					tgt[id][key] = val;
				});
			} catch(_e){}

			// Optional immediate read-back to converge
			try {
				if (this.canReadFromServer && this.canReadFromServer()) {
					await this.slaveCheckForUpdates();
				}
			} catch(_e){}

			return true;
		} catch (e) {
			console.warn('syncFieldUpdates failed', e);
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
							// Legacy 'position' is header hangar position in old format; keep it in hangarPosition
							hangarPosition: (row.hangarPosition || row.position || ''),
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

					// Normalize tile positions → ensure header hangarPosition and info-grid position remain distinct
					try {
						if (data && Array.isArray(data.primaryTiles)) {
							data.primaryTiles = data.primaryTiles.map((t)=>{
								const out = { ...t };
								// Map local collector's positionInfoGrid → position (info grid)
								if (Object.prototype.hasOwnProperty.call(out, 'positionInfoGrid')) {
									out.position = out.positionInfoGrid || '';
									delete out.positionInfoGrid;
								}
								// Ensure hangarPosition is populated from the header field (collector used 'position' for header)
								if (!Object.prototype.hasOwnProperty.call(out, 'hangarPosition')) {
									const headerPos = (typeof t.hangarPosition !== 'undefined') ? (t.hangarPosition || '') : ((typeof t.position !== 'undefined') ? (t.position || '') : '');
									out.hangarPosition = headerPos;
								}
								// If 'position' equals header and there is no explicit info grid value, clear it to avoid cross-population
								try {
									const header = (out.hangarPosition || '').trim();
									if ((out.position || '').trim() === header && header && !Object.prototype.hasOwnProperty.call(t, 'positionInfoGrid')) {
										out.position = '';
									}
								} catch(_e){}
								return out;
							});
						}
						if (data && Array.isArray(data.secondaryTiles)) {
							data.secondaryTiles = data.secondaryTiles.map((t)=>{
								const out = { ...t };
								if (Object.prototype.hasOwnProperty.call(out, 'positionInfoGrid')) {
									out.position = out.positionInfoGrid || '';
									delete out.positionInfoGrid;
								}
								if (!Object.prototype.hasOwnProperty.call(out, 'hangarPosition')) {
									const headerPos = (typeof t.hangarPosition !== 'undefined') ? (t.hangarPosition || '') : ((typeof t.position !== 'undefined') ? (t.position || '') : '');
									out.hangarPosition = headerPos;
								}
								try {
									const header = (out.hangarPosition || '').trim();
									if ((out.position || '').trim() === header && header && !Object.prototype.hasOwnProperty.call(t, 'positionInfoGrid')) {
										out.position = '';
									}
								} catch(_e){}
								return out;
							});
						}
					} catch(_e) { console.warn('tile position normalization failed', _e); }

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
		// Do not skip entire snapshots based on lastWriterSession; rely on field-level fences/locks to prevent flip-backs.
		// This ensures we still apply other users' changes even if our client posted a metadata-only write earlier.
		// Reset detection log
		try { const lw = (serverData?.metadata?.lastWriter||''); const lws = (serverData?.metadata?.lastWriterSession||''); if (lw==='reset' || lws==='system') { console.log('🧹 Reset snapshot detected', { lastWriter: lw, lastWriterSession: lws }); } } catch(_e){}
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
			// Always refresh local baseline with incoming server snapshot for correct preconditions, even if UI changes are minimal/none
			try { this._updateBaselineFromServerData(serverData); } catch(_e){}
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
					updatedBySession: row?.updatedBySession || undefined,
				});
				serverData = {
					...serverData,
					primaryTiles: (serverData.primary || []).map(mapTile),
					secondaryTiles: (serverData.secondary || []).map(mapTile),
				};
				console.log('🔁 Normalized legacy server data → primaryTiles/secondaryTiles');
			}
			// Heuristic legacy fix: if hangarPosition missing but position looks like a header slot (e.g., "1A"), treat it as hangarPosition
			try {
				const looksLikeHeader = (v)=>{ try { if (!v) return false; const s = String(v).trim(); if (!s || s.length>5) return false; return /^[A-Za-z]?[0-9]{1,2}[A-Za-z]?$/.test(s); } catch(_) { return false; } };
				['primaryTiles','secondaryTiles'].forEach(key=>{
					const arr = Array.isArray(serverData[key]) ? serverData[key] : [];
					arr.forEach(t=>{
						try {
							if ((!t.hangarPosition || t.hangarPosition==='') && t.position && looksLikeHeader(t.position)){
								t.hangarPosition = t.position;
								t.position = '';
							}
						} catch(_e){}
					});
				});
			} catch(_e){}
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
			// Presence-aware gating: In Master mode, skip applying tile updates unless other Masters are online
			try {
				if (this._isMasterMode && this._isMasterMode() && this.requireOtherMastersForRead) {
					let otherOnline = false;
					try { otherOnline = await this._hasOtherMastersOnline(); } catch(_e) { otherOnline = false; }
					if (!otherOnline) {
						console.log('↩️ Presence gating: no other Master online — skipping tile updates');
						try { this.lastLoadedAt = Date.now(); document.dispatchEvent(new CustomEvent('serverDataLoaded', { detail: { loadedAt: this.lastLoadedAt } })); } catch(e){}
						return true;
					}
				}
			} catch(_e){}
					// Last-write-wins baseline, but protect locally edited fields in multi-master
					let toApply = serverData;
			// NEUE LOGIK: Verwende zentralen Datenkoordinator wenn keine aktiven Write-Fences bestehen,
			// andernfalls wende nur nicht-gefenzte Felder direkt an, um Oscillation zu vermeiden
			try { if (typeof this._pruneStaleFences === 'function') this._pruneStaleFences(); } catch(_e){}
			const isFirstApply = !this._firstApplyDone;
			const hasFences = isFirstApply ? false : this._hasActiveFences();
			this._bypassFencesOnce = !!isFirstApply;
			// Determine whether bulk apply is safe (no typing, no focused relevant field, no fences)
			let typingActive = false;
			try {
				const typingWin = Math.min(15000, (this._writeFenceMs || 7000));
				typingActive = !!(window.hangarEventManager && typeof window.hangarEventManager.isUserTypingRecently==='function' && window.hangarEventManager.isUserTypingRecently(typingWin));
			} catch(_e){}
			let activeRelevant = false;
			try {
				const aid = (typeof document !== 'undefined' && document.activeElement && document.activeElement.id) ? document.activeElement.id : '';
				activeRelevant = !!(this._isRelevantFieldId && this._isRelevantFieldId(aid));
			} catch(_e){}
			let mayBulkApply = !!(window.dataCoordinator && !hasFences && !typingActive && !activeRelevant);
			// In read-only (Sync), prefer direct field application to avoid diverging logic for certain fields (notes/position)
			try { if (window.sharingManager && window.sharingManager.syncMode === 'sync') { mayBulkApply = false; } } catch(_e){}
			if (mayBulkApply) {
				console.log("🔄 Verwende dataCoordinator für Server-Daten (safe bulk apply)...");
				window.dataCoordinator.loadProject(toApply, "server");
				console.log("✅ Server-Daten über Datenkoordinator angewendet");
				try { this._updateBaselineFromServerData(toApply); } catch(_e){}
				try { this.lastLoadedAt = Date.now(); document.dispatchEvent(new CustomEvent('serverDataLoaded', { detail: { loadedAt: this.lastLoadedAt } })); } catch(e){}
				this._firstApplyDone = true;
				this._bypassFencesOnce = false;
				return true;
			}

			// Versuche Legacy-Handler, falle bei Fehlschlag auf direkte Anwendung zurück
			// WICHTIG: Nur verwenden, wenn ein Bulk-Apply sicher ist (keine Fences, kein Tippen, kein aktives Feld)
			const canUseLegacyBulk = (!hasFences && !typingActive && !activeRelevant);
			if (
				canUseLegacyBulk &&
				window.hangarData &&
				typeof window.hangarData.applyLoadedHangarPlan === "function"
			) {
				try {
					console.log("🔄 Verwende hangarData.applyLoadedHangarPlan (safe bulk apply, keine aktiven Edits)...");
					const result = window.hangarData.applyLoadedHangarPlan(serverData);
					console.log("📄 Ergebnis hangarData.applyLoadedHangarPlan:", result);
					if (result) {
						try { this.lastLoadedAt = Date.now(); document.dispatchEvent(new CustomEvent('serverDataLoaded', { detail: { loadedAt: this.lastLoadedAt } })); } catch(e){}
						this._firstApplyDone = true;
						this._bypassFencesOnce = false;
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
			// Recompute conflict stripping for fallback path as well (also filter when typing or focused)
			const needFilter = hasFences || typingActive || activeRelevant;
			let dataForApply = needFilter ? this._cloneFilteredServerData(serverData) : toApply;
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

			// Receiver convergence: clear tiles present locally but missing in server snapshot
			try {
				const serverIds = new Set();
				try { (dataForApply.primaryTiles||[]).forEach(t=>{ const id = parseInt(t?.tileId||0,10); if (id) serverIds.add(id); }); } catch(_e){}
				try { (dataForApply.secondaryTiles||[]).forEach(t=>{ const id = parseInt(t?.tileId||0,10); if (id) serverIds.add(id); }); } catch(_e){}
				const dom = (typeof this.collectTilesFromDom === 'function') ? this.collectTilesFromDom() : null;
				const domIds = new Set();
				if (dom) {
					try { (dom.primary||[]).forEach(t=>{ const id = parseInt(t?.tileId||0,10); if (id) domIds.add(id); }); } catch(_e){}
					try { (dom.secondary||[]).forEach(t=>{ const id = parseInt(t?.tileId||0,10); if (id) domIds.add(id); }); } catch(_e){}
				}
				const toClear = [];
				domIds.forEach(id => { if (!serverIds.has(id)) toClear.push(id); });
				if (toClear.length) {
					const payload = toClear.map(id => ({
						tileId: id,
						aircraftId: '',
						arrivalTime: '',
						departureTime: '',
						position: '',
						notes: '',
						status: 'neutral',
						towStatus: 'neutral',
					}));
					const c1 = this.applyTileData(payload.filter(t => (t.tileId||0) < 100), false);
					const c2 = this.applyTileData(payload.filter(t => (t.tileId||0) >= 100), true);
					applied = !!(applied || c1 || c2);
					console.log('🧹 Receiver cleared tiles missing in server snapshot:', toClear);
				}
			} catch(_e){}

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
				this._firstApplyDone = true;
				this._bypassFencesOnce = false;
					return true;
				} else {
					console.warn("⚠️ Keine Server-Daten konnten angewendet werden");
					// Even if no DOM changes were applied (e.g., empty dataset), update baseline and timestamp
					try { this._updateBaselineFromServerData(serverData); } catch(_e){}
					try { this.lastLoadedAt = Date.now(); document.dispatchEvent(new CustomEvent('serverDataLoaded', { detail: { loadedAt: this.lastLoadedAt } })); } catch(e){}
					return true; // treat as success for convergence
				}
		} catch (error) {
			console.error("❌ Fehler beim Anwenden der Server-Daten:", error);
			return false;
		} finally {
			// Flag zurücksetzen mit Verzögerung um Race Conditions zu vermeiden
			setTimeout(() => {
				this.isApplyingServerData = false;
				window.isApplyingServerData = false;
				this._bypassFencesOnce = false;
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

		// Helpers to decide whether a server value should be applied to a specific field now
		const recentlyEdited = (fid, windowMs = (this._writeFenceMs || 7000)) => {
			try {
				if (!fid) return false;
				// In read-only, ignore 'recently edited' guards (no local edits should happen)
				const isReadOnly = !!(document.body && document.body.classList.contains('read-only')) || !!(window.sharingManager && window.sharingManager.syncMode === 'sync');
				if (isReadOnly) return false;
				const getLE = (typeof window.getLastLocalEdit === 'function') ? window.getLastLocalEdit : null;
				if (!getLE) return false;
				const e = getLE(fid);
				return !!(e && e.editedAt && (Date.now() - e.editedAt) < windowMs);
			} catch(_e){ return false; }
		};
		const canApplyField = (fid, el) => {
			try {
				if (!fid) return true;
				// For the first DOM application after startup, bypass fences/recent edit checks to ensure UI mirrors server
				if (this._bypassFencesOnce) {
					// Still avoid overwriting the actively focused element to prevent caret jumps
					if (el && document.activeElement === el) return false;
					return true;
				}
				// Hard lock: if field is locked from local change, do not apply server value
				try {
					if (window.__fieldApplyLockUntil && window.__fieldApplyLockUntil[fid]){
						if (Date.now() < window.__fieldApplyLockUntil[fid]) return false;
						delete window.__fieldApplyLockUntil[fid];
					}
				} catch(_e){}
				// Skip when user is actively editing this element (only in editable modes)
				if (el && document.activeElement === el) {
					const isReadOnly = !!(document.body && document.body.classList.contains('read-only')) || !!(window.sharingManager && window.sharingManager.syncMode === 'sync');
					if (!isReadOnly && !el.disabled) return false;
				}
				// Skip when a write fence is active for this field
				if (typeof this._isWriteFenceActive === 'function' && this._isWriteFenceActive(fid)) return false;
				// Skip when the user very recently edited this specific field
				if (recentlyEdited(fid)) return false;
				// Do not block read applies based on remote locks; local hard-locks and fences already protect user edits
				return true;
			} catch(_e){ return true; }
		};

		let successfullyApplied = 0;
		let failedToApply = 0;

		tiles.forEach((tileData, index) => {
			const tileId = tileData.tileId || (isSecondary ? 101 + index : 1 + index);
			console.log(`🔄 Verarbeite Kachel ${tileId}:`, tileData);

			// Aircraft ID — treat missing key as empty (server often omits empty fields)
			{
				const aircraftInput = document.getElementById(`aircraft-${tileId}`);
				if (aircraftInput) {
					const incomingRaw = (typeof tileData.aircraftId === 'string') ? tileData.aircraftId : '';
					const incoming = (incomingRaw || '').trim();
					const current = (aircraftInput.value || '').trim();
					const fid = `aircraft-${tileId}`;
					const fromOtherSession = !!(tileData.updatedBySession) &&
						(typeof this.getSessionId === 'function') &&
						(tileData.updatedBySession !== this.getSessionId());

					if (!canApplyField(fid, aircraftInput)) {
						// skip while locally editing/fenced
					} else if (incoming.length > 0) {
						if (!(document.activeElement === aircraftInput && current === incoming)) {
							aircraftInput.value = incoming;
						}
						// Persist locally and notify listeners
						try { if (window.hangarEventManager && typeof window.hangarEventManager.updateFieldInStorage==='function') window.hangarEventManager.updateFieldInStorage(fid, incoming, { source:'server', flushDelayMs:0 }); } catch(_e){}
						try { aircraftInput.dispatchEvent(new Event('input', { bubbles:true })); aircraftInput.dispatchEvent(new Event('change', { bubbles:true })); } catch(_e){}
						console.log(`✈️ Aircraft ID gesetzt: ${tileId} = ${current} → ${incoming}`);
						successfullyApplied++;
					} else {
						// missing or empty → clear on receiver
						aircraftInput.value = '';
						try { if (window.hangarEventManager && typeof window.hangarEventManager.updateFieldInStorage==='function') window.hangarEventManager.updateFieldInStorage(fid, '', { source:'server', flushDelayMs:0 }); } catch(_e){}
						try { aircraftInput.dispatchEvent(new Event('input', { bubbles:true })); aircraftInput.dispatchEvent(new Event('change', { bubbles:true })); } catch(_e){}
						console.log(`✈️ Aircraft ID geleert (Server-Clear or missing): ${tileId}`);
						successfullyApplied++;
					}
				} else {
					console.warn(`❌ Aircraft Input nicht gefunden: aircraft-${tileId}`);
					failedToApply++;
				}
			}

			// Hangar Position (header) — apply only when server provided hangarPosition key
			if (Object.prototype.hasOwnProperty.call(tileData, 'hangarPosition')) {
				const hangarPosInput = document.getElementById(`hangar-position-${tileId}`);
				if (hangarPosInput) {
					const newVal = tileData.hangarPosition || '';
					const oldValue = hangarPosInput.value;
					const fid = `hangar-position-${tileId}`;
					if (canApplyField(fid, hangarPosInput)){
						if (!(document.activeElement === hangarPosInput && oldValue === newVal)) {
							hangarPosInput.value = newVal;
						}
						try { if (window.hangarEventManager && typeof window.hangarEventManager.updateFieldInStorage==='function') window.hangarEventManager.updateFieldInStorage(fid, newVal, { source:'server', flushDelayMs:0 }); } catch(_e){}
						try { hangarPosInput.dispatchEvent(new Event('input', { bubbles:true })); hangarPosInput.dispatchEvent(new Event('change', { bubbles:true })); } catch(_e){}
						console.log(`📍 Hangar Position gesetzt: ${tileId} = ${oldValue} → ${newVal}`);
						successfullyApplied++;
					}
				} else {
					console.warn(`❌ Hangar Position Input nicht gefunden: hangar-position-${tileId}`);
					failedToApply++;
				}
			}

			// Position in info grid — treat missing as empty
			{
				const posInfoInput = document.getElementById(`position-${tileId}`);
				if (posInfoInput) {
					const newVal = tileData.position || '';
					const oldValue = posInfoInput.value;
					const fid = `position-${tileId}`;
					if (canApplyField(fid, posInfoInput)){
						if (!(document.activeElement === posInfoInput && oldValue === newVal)) {
							posInfoInput.value = newVal;
						}
						try { if (window.hangarEventManager && typeof window.hangarEventManager.updateFieldInStorage==='function') window.hangarEventManager.updateFieldInStorage(fid, newVal, { source:'server', flushDelayMs:0 }); } catch(_e){}
						try { posInfoInput.dispatchEvent(new Event('input', { bubbles:true })); posInfoInput.dispatchEvent(new Event('change', { bubbles:true })); } catch(_e){}
						console.log(`📍 Pos (info) gesetzt: ${tileId} = ${oldValue} → ${newVal}`);
						successfullyApplied++;
					}
				} else {
					console.warn(`❌ Position (info) Input nicht gefunden: position-${tileId}`);
					failedToApply++;
				}
			}

			// Notes — treat missing as empty
			{
				const notesInput = document.getElementById(`notes-${tileId}`);
				if (notesInput) {
					const newVal = tileData.notes || '';
					const fid = `notes-${tileId}`;
					if (canApplyField(fid, notesInput)){
						if (!(document.activeElement === notesInput && notesInput.value === newVal)) {
							notesInput.value = newVal;
						}
						try { if (window.hangarEventManager && typeof window.hangarEventManager.updateFieldInStorage==='function') window.hangarEventManager.updateFieldInStorage(fid, newVal, { source:'server', flushDelayMs:0 }); } catch(_e){}
						try { notesInput.dispatchEvent(new Event('input', { bubbles:true })); notesInput.dispatchEvent(new Event('change', { bubbles:true })); } catch(_e){}
						console.log(`📝 Notizen gesetzt: ${tileId} = ${newVal}`);
					}
				}
			}

			// Arrival Time — treat missing as empty
			{
				const arrivalInput = document.getElementById(`arrival-time-${tileId}`);
				if (arrivalInput) {
					const fid = `arrival-time-${tileId}`;
					if (canApplyField(fid, arrivalInput)){
						let toSet = tileData.arrivalTime || '';
						// Convert ISO format to compact display format for all input types
					if (toSet && window.helpers) {
						const h = window.helpers;
						if (h.isISODateTimeLocal && h.isISODateTimeLocal(toSet)) {
							// Convert ISO to compact format for display
							toSet = h.formatISOToCompactUTC ? h.formatISOToCompactUTC(toSet) : toSet;
							// Store original ISO in dataset for later use
							if (arrivalInput.dataset) arrivalInput.dataset.iso = tileData.arrivalTime;
							try { if (window.hangarEventManager && typeof window.hangarEventManager.updateFieldInStorage==='function') window.hangarEventManager.updateFieldInStorage(fid, (arrivalInput.dataset?.iso||toSet||''), { source:'server', flushDelayMs:0 }); } catch(_e){}
							try { arrivalInput.dispatchEvent(new Event('input', { bubbles:true })); arrivalInput.dispatchEvent(new Event('change', { bubbles:true })); } catch(_e){}
						} else if (h.isHHmm && h.isHHmm(toSet) && h.getBaseDates && h.coerceHHmmToDateTimeLocalUtc) {
							const bases = h.getBaseDates();
							const isoTime = h.coerceHHmmToDateTimeLocalUtc(toSet, bases.arrivalBase || '');
							if (isoTime && h.formatISOToCompactUTC) {
								toSet = h.formatISOToCompactUTC(isoTime);
								if (arrivalInput.dataset) arrivalInput.dataset.iso = iso;
								try { if (window.hangarEventManager && typeof window.hangarEventManager.updateFieldInStorage==='function') window.hangarEventManager.updateFieldInStorage(fid, iso, { source:'server', flushDelayMs:0 }); } catch(_e){}
								try { arrivalInput.dispatchEvent(new Event('input', { bubbles:true })); arrivalInput.dispatchEvent(new Event('change', { bubbles:true })); } catch(_e){}
							}
						} else if (h.isCompactDateTime && h.isCompactDateTime(toSet)) {
							// Already in compact format, store corresponding ISO
							if (h.parseCompactToISOUTC) {
								const iso = h.parseCompactToISOUTC(toSet);
								if (iso && arrivalInput.dataset) arrivalInput.dataset.iso = iso;
							}
						}
					}
						arrivalInput.value = toSet || '';
						try { if (!toSet && arrivalInput.dataset) delete arrivalInput.dataset.iso; } catch(_e){}
						try { if (window.hangarEventManager && typeof window.hangarEventManager.updateFieldInStorage==='function') window.hangarEventManager.updateFieldInStorage(fid, (arrivalInput.dataset?.iso||''), { source:'server', flushDelayMs:0 }); } catch(_e){}
						try { arrivalInput.dispatchEvent(new Event('input', { bubbles:true })); arrivalInput.dispatchEvent(new Event('change', { bubbles:true })); } catch(_e){}
						console.log(`🛬 Ankunftszeit gesetzt: ${tileId} = ${toSet || ''}`);
					}
				}
			}

			// Departure Time — treat missing as empty
			{
				const departureInput = document.getElementById(`departure-time-${tileId}`);
				if (departureInput) {
					const fid = `departure-time-${tileId}`;
					if (canApplyField(fid, departureInput)){
						let toSet = tileData.departureTime || '';
						// Convert ISO format to compact display format for all input types
					if (toSet && window.helpers) {
						const h = window.helpers;
						if (h.isISODateTimeLocal && h.isISODateTimeLocal(toSet)) {
							// Convert ISO to compact format for display
							toSet = h.formatISOToCompactUTC ? h.formatISOToCompactUTC(toSet) : toSet;
							// Store original ISO in dataset for later use
							if (departureInput.dataset) departureInput.dataset.iso = tileData.departureTime;
							try { if (window.hangarEventManager && typeof window.hangarEventManager.updateFieldInStorage==='function') window.hangarEventManager.updateFieldInStorage(fid, (departureInput.dataset?.iso||toSet||''), { source:'server', flushDelayMs:0 }); } catch(_e){}
							try { departureInput.dispatchEvent(new Event('input', { bubbles:true })); departureInput.dispatchEvent(new Event('change', { bubbles:true })); } catch(_e){}
						} else if (h.isHHmm && h.isHHmm(toSet) && h.getBaseDates && h.coerceHHmmToDateTimeLocalUtc) {
							const bases = h.getBaseDates();
							const isoTime = h.coerceHHmmToDateTimeLocalUtc(toSet, bases.departureBase || '');
							if (isoTime && h.formatISOToCompactUTC) {
								toSet = h.formatISOToCompactUTC(isoTime);
								if (departureInput.dataset) departureInput.dataset.iso = iso;
								try { if (window.hangarEventManager && typeof window.hangarEventManager.updateFieldInStorage==='function') window.hangarEventManager.updateFieldInStorage(fid, iso, { source:'server', flushDelayMs:0 }); } catch(_e){}
								try { departureInput.dispatchEvent(new Event('input', { bubbles:true })); departureInput.dispatchEvent(new Event('change', { bubbles:true })); } catch(_e){}
							}
						} else if (h.isCompactDateTime && h.isCompactDateTime(toSet)) {
							// Already in compact format, store corresponding ISO
							if (h.parseCompactToISOUTC) {
								const iso = h.parseCompactToISOUTC(toSet);
								if (iso && departureInput.dataset) departureInput.dataset.iso = iso;
							}
						}
					}
						departureInput.value = toSet || '';
						try { if (!toSet && departureInput.dataset) delete departureInput.dataset.iso; } catch(_e){}
						try { if (window.hangarEventManager && typeof window.hangarEventManager.updateFieldInStorage==='function') window.hangarEventManager.updateFieldInStorage(fid, (departureInput.dataset?.iso||''), { source:'server', flushDelayMs:0 }); } catch(_e){}
						try { departureInput.dispatchEvent(new Event('input', { bubbles:true })); departureInput.dispatchEvent(new Event('change', { bubbles:true })); } catch(_e){}
						console.log(`🛫 Abflugzeit gesetzt: ${tileId} = ${toSet || ''}`);
					}
				}
			}

			// Status (apply on key presence)
			if (Object.prototype.hasOwnProperty.call(tileData, 'status')) {
				const statusSelect = document.getElementById(`status-${tileId}`);
				if (statusSelect) {
					const fid = `status-${tileId}`;
					if (canApplyField(fid, statusSelect)){
						statusSelect.value = tileData.status || 'neutral';
						console.log(`🚦 Status gesetzt: ${tileId} = ${tileData.status || 'neutral'}`);
					}
				}
			}

			// Tow Status (apply on key presence)
			if (Object.prototype.hasOwnProperty.call(tileData, 'towStatus')) {
				const towStatusSelect = document.getElementById(`tow-status-${tileId}`);
				if (towStatusSelect) {
					const oldValue = towStatusSelect.value;
					const fid = `tow-status-${tileId}`;
					if (canApplyField(fid, towStatusSelect)){
						towStatusSelect.value = tileData.towStatus || 'neutral';
						console.log(`🚚 Tow Status gesetzt: ${tileId} = ${oldValue} → ${towStatusSelect.value}`);
						try {
						if (typeof window.updateTowStatusStyles === 'function') {
							window.updateTowStatusStyles(towStatusSelect);
						} else if (typeof updateTowStatusStyles === 'function') {
							updateTowStatusStyles(towStatusSelect);
						} else {
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
						}
					}
				} else {
					console.warn(`❌ Tow Status Select nicht gefunden: tow-status-${tileId}`);
					failedToApply++;
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

		// Event-Handler für sekundäre Kacheln reaktivieren - MIT VERBESSERTER LOGIK (gated auf Event-Manager Bereitschaft)
		const __emReady = !!(window.hangarEventManager && window.hangarEventManager.safeAddEventListener);
		if (window.setupSecondaryTileEventListeners || (window.hangarUI && window.hangarUI.setupSecondaryTileEventListeners)) {
			if (__emReady) {
				setTimeout(() => {
					try {
						const fn = window.setupSecondaryTileEventListeners || (window.hangarUI && window.hangarUI.setupSecondaryTileEventListeners);
						const result = fn ? fn() : false;
						console.log("✅ Event-Handler für sekundäre Kacheln reaktiviert (gated):", result);
					} catch (e) { console.warn('setupSecondaryTileEventListeners (gated) failed', e); }
				}, 100);
			} else {
				// Defer until Event Manager signals ready to avoid race and log noise
				try {
					document.addEventListener('eventManagerReady', () => {
						try {
							const fn = window.setupSecondaryTileEventListeners || (window.hangarUI && window.hangarUI.setupSecondaryTileEventListeners);
							if (fn) fn();
						} catch (_e) {}
					}, { once: true });
				} catch (_e) {}
			}
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
	 * Vereinheitlichtes destroy(): entfernt doppelte Definition und räumt alle Timer/Flags konsistent auf
	 */
	destroy() {
		try {
			// Stop scheduled write loop
			this.stopPeriodicSync();
		} catch(_) {}

		// Stop polling for reads (slave/master read-backs)
		try {
			if (this.slaveCheckInterval) {
				clearInterval(this.slaveCheckInterval);
				this.slaveCheckInterval = null;
				console.log("🧹 Slave-Check-Intervall bereinigt");
			}
		} catch(_) {}

		// Clear autosave timeout if present
		try {
			if (this.autoSaveTimeout) {
				clearTimeout(this.autoSaveTimeout);
				this.autoSaveTimeout = null;
			}
		} catch(_) {}

		// Clear load watchdog timer if present
		try {
			if (this._loadWatchdogId) {
				clearTimeout(this._loadWatchdogId);
				this._loadWatchdogId = null;
			}
		} catch(_) {}

		// Stop presence heartbeats
		try { this._stopPresenceHeartbeat(); } catch(_) {}

		// Reset transient state and baselines
		try { this._pendingWrites = {}; } catch(_) {}
		try { this._baselinePrimary = {}; this._baselineSecondary = {}; } catch(_) {}

		// Reset core properties
		this.serverSyncUrl = null;
		this.lastDataChecksum = null;
		this.lastServerTimestamp = 0;
		this.isMaster = false;
		this.isSlaveActive = false;

		// Reset global flags to safe defaults
		try { window.isSavingToServer = false; } catch(_) {}
		try { window.isLoadingServerData = false; } catch(_) {}
		try { window.isApplyingServerData = false; } catch(_) {}

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
