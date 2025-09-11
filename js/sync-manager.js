/**
 * Sync Manager (renamed from sharing-manager.js to avoid ad blockers)
 * Provides the same functionality and exports window.sharingManager
 */

// NOTE: This file is an exact copy of js/sharing-manager.js to avoid ad-blockers blocking the file by name.
// The code defines class SharingManager and attaches window.sharingManager.

/* BEGIN COPY FROM sharing-manager.js */
class SharingManager {
  constructor() {
    this.syncMode = "standalone";
    this.isLiveSyncEnabled = false;
    this.isMasterMode = false;
    this.initialized = false;
    if (SharingManager.instance) { return SharingManager.instance; }
    SharingManager.instance = this;
  }
  init() {
    if (this.initialized) { console.warn("⚠️ Sharing Manager bereits initialisiert"); return; }
    this.setupEventHandlers();
    this.loadSavedSharingSettings();
    this.updateAllSyncDisplays();
    this.initialized = true;
    console.log("🔗 Sharing Manager initialisiert - Modus:", this.syncMode);
  }
  setupEventHandlers() {
    const readDataToggle = document.getElementById("readDataToggle");
    if (readDataToggle) {
      readDataToggle.addEventListener("change", (e) => { this.handleReadDataToggle(e.target.checked); });
    }
    const writeDataToggle = document.getElementById("writeDataToggle");
    if (writeDataToggle) {
      writeDataToggle.addEventListener("change", (e) => { this.handleWriteDataToggle(e.target.checked); });
    }
    const manualSyncBtn = document.getElementById("manualSyncBtn");
    if (manualSyncBtn) { manualSyncBtn.addEventListener("click", () => { this.performManualSync(); }); }
    const modeControl = document.getElementById("syncModeControl");
    if (modeControl) { modeControl.addEventListener("change", (e) => { this.handleModeControlChange(e.target.value); }); }
    const syncStatusBtn = document.getElementById("syncStatusBtn");
    if (syncStatusBtn) {
      syncStatusBtn.addEventListener("contextmenu", (e) => { e.preventDefault(); this.showSyncStatus(); });
      syncStatusBtn.addEventListener("click", () => { this.showSyncStatus(); });
    }

    // Debug panel wiring (optional)
    try {
      const urlEl = document.getElementById('syncDebugUrl');
      if (urlEl) urlEl.textContent = this._getServerUrlSafe();
      const testReadBtn = document.getElementById('syncTestReadBtn');
      if (testReadBtn) testReadBtn.addEventListener('click', () => this.debugTestRead());
      const testWriteBtn = document.getElementById('syncTestWriteBtn');
      if (testWriteBtn) testWriteBtn.addEventListener('click', () => this.debugTestWrite());
    } catch(_e){}
  }

  _getServerUrlSafe(){ try { return (window.serverSync && typeof window.serverSync.getServerUrl==='function' && window.serverSync.getServerUrl()) || (window.serverSync && window.serverSync.serverSyncUrl) || (window.location.origin + '/sync/data.php'); } catch(e){ return window.location.origin + '/sync/data.php'; } }
  _debugLog(line){ try { const el = document.getElementById('syncDebugLog'); const ts = new Date().toLocaleTimeString(); if (el){ const msg = `[${ts}] ${line}`; el.textContent = (el.textContent ? el.textContent + "\n" : '') + msg; el.scrollTop = el.scrollHeight; } console.log(line); } catch(_e){} }
  async debugTestRead(){ try { const url = this._getServerUrlSafe(); this._debugLog(`GET ${url}`); const res = await fetch(url + (url.includes('?') ? '&' : '?') + 'action=load', { headers: { 'Accept':'application/json' }}); this._debugLog(`GET status ${res.status}`); const text = await res.text(); this._debugLog(`Body (first 200): ${text.slice(0,200)}`); try { const json = JSON.parse(text); if (window.serverSync && typeof window.serverSync.applyServerData==='function'){ const applied = await window.serverSync.applyServerData(json); this._debugLog(`applyServerData: ${applied}`); } } catch(_e){} } catch(e){ this._debugLog(`READ error: ${e.message}`); } }
  async debugTestWrite(){ try { const url = this._getServerUrlSafe(); const sid = (window.serverSync && typeof window.serverSync.getSessionId==='function') ? window.serverSync.getSessionId() : (localStorage.getItem('serverSync.sessionId') || ''); const dname = (localStorage.getItem('presence.displayName') || '').trim(); const body = { metadata: { debugPing: new Date().toISOString(), timestamp: Math.round(Date.now()) } }; this._debugLog(`POST ${url}`); const res = await fetch(url, { method:'POST', headers: { 'Content-Type':'application/json', 'X-Sync-Role':'master', 'X-Sync-Session': sid, 'X-Display-Name': dname }, body: JSON.stringify(body) }); this._debugLog(`POST status ${res.status}`); const text = await res.text(); this._debugLog(`Body (first 200): ${text.slice(0,200)}`); await this.debugTestRead(); } catch(e){ this._debugLog(`WRITE error: ${e.message}`); } }

  async handleReadDataToggle(enabled){
    const writeDataToggle = document.getElementById("writeDataToggle");
    const isWriteEnabled = writeDataToggle?.checked || false;
    await this.updateSyncMode(enabled, isWriteEnabled);
    console.log(`📥 Read Data Toggle: ${enabled ? "AN" : "AUS"}`);
  }
  async handleWriteDataToggle(enabled){
    const readDataToggle = document.getElementById("readDataToggle");
    const isReadEnabled = readDataToggle?.checked || false;
    await this.updateSyncMode(isReadEnabled, enabled);
    console.log(`📤 Write Data Toggle: ${enabled ? "AN" : "AUS"}`);
  }
  handleModeControlChange(mode){ if (!mode) return; this.updateSyncModeByString(mode); }
  _emitModeChanged(){ try { document.dispatchEvent(new CustomEvent('syncModeChanged', { detail: { mode: this.syncMode } })); } catch(_e){} }
  async updateSyncModeByString(mode){
    try {
      if (mode === 'standalone') { await this.enableStandaloneMode(); }
      else if (mode === 'sync') { await this.enableSyncMode(); await this.loadServerDataImmediately(); }
      else if (mode === 'master') {
        await this.enableMasterMode();
        await this.loadServerDataImmediately();
      }
      this.saveSharingSettings();
      this._emitModeChanged();
    } catch(e){ console.error('updateSyncModeByString failed', e); }
  }
  async ensureNoActiveMaster(){
    try {
      const presenceUrl = (function(){ try { let base = (window.serverSync && typeof window.serverSync.getServerUrl === 'function' && window.serverSync.getServerUrl()) || (window.serverSync && window.serverSync.serverSyncUrl) || (window.location.origin + '/sync/data.php'); if (typeof base !== 'string' || !base.length) base = window.location.origin + '/sync/data.php'; const url = base.replace(/data\.php(?:\?.*)?$/i, 'presence.php'); return /presence\.php/i.test(url) ? url : (window.location.origin + '/sync/presence.php'); } catch(e){ return window.location.origin + '/sync/presence.php'; } })();
      const res = await fetch(presenceUrl + '?action=list', { headers: { 'Accept': 'application/json' } });
      if (!res.ok) return true; const data = await res.json(); const users = Array.isArray(data?.users) ? data.users : []; let mySession = ''; try { mySession = localStorage.getItem('presence.sessionId') || ''; } catch(e) {}
      const otherMaster = users.find(u => (u?.role || '').toLowerCase() === 'master' && u.sessionId && u.sessionId !== mySession);
      return !otherMaster;
    } catch(e){ return true; }
  }
  setModeControlValue(mode){ try { const ctl = document.getElementById('syncModeControl'); if (ctl) ctl.value = mode; } catch(e){} }
  handleMasterDeniedByServer(detail){ try { this.showNotification('Master denied by server. Switching to Sync.', 'warning'); this.syncMode = 'sync'; this.setModeControlValue('sync'); this.enableSyncMode(); this.saveSharingSettings(); } catch(e){} }
  async updateSyncMode(readEnabled, writeEnabled){
    console.log(`🔄 Sync-Modus wird geändert: Read=${readEnabled}, Write=${writeEnabled}`);
    // Enforce: Write implies Read (no write-only mode)
    if (writeEnabled && !readEnabled) {
      console.log('🛡️ Enforcing Read ON when Write is enabled (no write-only mode)');
      readEnabled = true;
      try { const readToggle = document.getElementById('readDataToggle'); if (readToggle) readToggle.checked = true; } catch(_e){}
    }
    if (!readEnabled && !writeEnabled) { await this.enableStandaloneMode(); }
    else if (readEnabled && !writeEnabled) { await this.enableSyncMode(); await this.loadServerDataImmediately(); }
    else { await this.enableMasterMode(); await this.loadServerDataImmediately(); }
    this.saveSharingSettings();
    console.log(`✅ Sync-Modus aktualisiert: Read=${readEnabled}, Write=${writeEnabled}, Mode=${this.syncMode}`);
  }
  _clearFallbackTimers(){ try { if (this._fallbackReadInterval){ clearInterval(this._fallbackReadInterval); this._fallbackReadInterval = null; } if (this._fallbackWriteInterval){ clearInterval(this._fallbackWriteInterval); this._fallbackWriteInterval = null; } } catch(_e){} }
  _startFallbackReadPolling(){ try { if (!window.serverSync || typeof window.serverSync.loadFromServer !== 'function' || typeof window.serverSync.applyServerData !== 'function') return; this._clearFallbackTimers(); const poll = async()=>{ try { const serverData = await window.serverSync.loadFromServer(); if (serverData && !serverData.error){ await window.serverSync.applyServerData(serverData); } } catch(_e){} }; poll(); this._fallbackReadInterval = setInterval(poll, 5000); console.log('📡 Fallback Read-Polling aktiviert (5s)'); } catch(_e){} }
  _startFallbackWriteTimer(){ try { if (!window.serverSync) return; const writer = async()=>{ try { if (typeof window.serverSync.manualSync === 'function'){ await window.serverSync.manualSync(); } else if (typeof window.serverSync.syncWithServer === 'function'){ await window.serverSync.syncWithServer(); } } catch(_e){} }; this._fallbackWriteInterval = setInterval(writer, 30000); setTimeout(writer, 0); console.log('📝 Fallback Write-Timer aktiviert (30s)'); } catch(_e){} }
  async enableStandaloneMode(){ try{
    console.log("🏠 Aktiviere Standalone-Modus...");
    try { if (window.serverSync && typeof window.serverSync.stopPeriodicSync === 'function'){ window.serverSync.stopPeriodicSync(); } } catch(_e){}
    try { if (window.serverSync && window.serverSync.slaveCheckInterval){ clearInterval(window.serverSync.slaveCheckInterval); window.serverSync.slaveCheckInterval = null; } } catch(_e){}
    this._clearFallbackTimers();
    if (window.serverSync){ window.serverSync.isMaster = false; window.serverSync.isSlaveActive = false; }
    this.syncMode = 'standalone'; this.isLiveSyncEnabled = false; this.isMasterMode = false;
    this.updateAllSyncDisplays('Standalone', false); this.applyReadOnlyUIState(false); this.showNotification('Standalone-Modus aktiviert - Nur lokale Speicherung','info'); this._emitModeChanged();
    console.log('✅ Standalone-Modus aktiviert');
  } catch(e){ console.error('❌ Fehler beim Aktivieren des Standalone-Modus:', e); this.showNotification('Fehler beim Wechsel zu Standalone-Modus','error'); } }
  async enableSyncMode(){ try{
    console.log('📡 Aktiviere Sync-Modus (Slave)...');
    if (!window.serverSync) throw new Error('ServerSync nicht verfügbar');
    window.serverSync.isMaster = false; window.serverSync.isSlaveActive = true;
    if (typeof window.serverSync.startSlaveMode === 'function'){
      console.log('🔄 Starte Slave-Polling für Read-Modus...'); await window.serverSync.startSlaveMode();
      if (!window.serverSync.slaveCheckInterval){ setTimeout(async()=>{ await window.serverSync.startSlaveMode(); console.log('🔄 Slave-Polling Retry ausgeführt'); }, 2000); }
    } else {
      console.warn('⚠️ startSlaveMode nicht verfügbar – aktiviere Fallback-Polling');
      this._startFallbackReadPolling();
    }
    this.syncMode = 'sync'; this.isLiveSyncEnabled = true; this.isMasterMode = false; this.updateAllSyncDisplays('Sync', true); this.applyReadOnlyUIState(true); this.showNotification('Sync-Modus aktiviert - Empfange Server-Updates','info'); this._emitModeChanged(); console.log('✅ Sync-Modus (Slave) aktiviert');
  } catch(e){ console.error('❌ Fehler beim Aktivieren des Sync-Modus:', e); this.showNotification('Fehler beim Aktivieren der Synchronisation','error'); await this.enableStandaloneMode(); } }
  async enableMasterMode(){ try{
    console.log('👑 Aktiviere Master-Modus...');
    if (!window.serverSync) throw new Error('ServerSync nicht verfügbar');
    window.serverSync.isMaster = true; window.serverSync.isSlaveActive = true; // Force read for multi-master
    if (typeof window.serverSync.startMasterMode === 'function'){
      await window.serverSync.startMasterMode();
    } else {
      console.warn('⚠️ startMasterMode nicht verfügbar – aktiviere Fallback Write/Read');
      // Always enable fallback write and read-back in Master for convergence
      this._startFallbackWriteTimer();
      this._startFallbackReadPolling();
    }
    try { const readToggle = document.getElementById('readDataToggle'); if (readToggle) readToggle.checked = true; } catch(_e){}
    this.syncMode = 'master'; this.isLiveSyncEnabled = true; this.isMasterMode = true; this.updateAllSyncDisplays('Master', true); this.applyReadOnlyUIState(false); this.showNotification('Master-Modus aktiviert - Sende Daten an Server', 'success'); this._emitModeChanged(); console.log('✅ Master-Modus aktiviert');
  } catch(e){ console.error('❌ Fehler beim Aktivieren des Master-Modus:', e); this.showNotification('Fehler beim Aktivieren des Master-Modus','error'); await this.enableSyncMode(); } }
  async performLiveSync(){ if (!this.isLiveSyncEnabled) return; try { if (window.serverSync && window.serverSync.syncWithServer){ const success = await window.serverSync.syncWithServer(); if (success){ console.log('🔄 Live Sync erfolgreich'); this.updateSyncStatusIndicator('success'); } else { console.warn('⚠️ Live Sync teilweise fehlgeschlagen'); this.updateSyncStatusIndicator('warning'); } } } catch(e){ console.error('❌ Live Sync Fehler:', e); this.updateSyncStatusIndicator('error'); } }
  async performManualSync(){
    try {
      const manualSyncBtn = document.getElementById('manualSyncBtn');
      if (this.syncMode !== 'master'){
        this.showNotification('Manual Sync is only available in Master mode','warning');
        return;
      }
      if (!window.serverSync){
        this.showNotification('ServerSync not available','error');
        return;
      }
      if (manualSyncBtn){ manualSyncBtn.disabled = true; manualSyncBtn.textContent = 'Syncing...'; }

      let success = false;
      try {
        if (typeof window.serverSync.manualSync === 'function'){
          success = await window.serverSync.manualSync();
        } else if (typeof window.serverSync.syncWithServer === 'function'){
          success = await window.serverSync.syncWithServer();
        } else {
          this.showNotification('ServerSync not available','error');
          return;
        }
      } catch(err){
        console.error('Manual sync call failed', err);
        success = false;
      }

      if (success){
        this.showNotification('Manual sync completed','success');
        this.updateSyncStatusIndicator('success');
        // Always perform immediate read-back to converge, regardless of Read toggle
        try { await this.loadServerDataImmediately(); } catch(_e){}
      } else {
        this.showNotification('Manual sync failed','error');
        this.updateSyncStatusIndicator('error');
      }
    } catch(e){
      console.error('❌ Manual Sync error:', e);
      this.showNotification('Manual sync failed','error');
      this.updateSyncStatusIndicator('error');
    } finally {
      const manualSyncBtn = document.getElementById('manualSyncBtn');
      if (manualSyncBtn){ manualSyncBtn.disabled = false; manualSyncBtn.textContent = 'Manual Sync'; }
    }
  }
  updateAllSyncDisplays(status = null, isActive = null){ if (status !== null && isActive !== null){ this.updateSyncStatusDisplay(status, isActive); this.updateWidgetSyncDisplay(status, isActive); } this.updateSyncStatusDisplayNew(); console.log(`🔄 Alle Sync-Anzeigen aktualisiert${status ? ` (${status}, ${isActive})` : ''}`); }
  updateSyncStatusDisplayNew(){ const modeSpans = document.querySelectorAll('#currentSyncMode, #currentSyncModeSidebar, .currentSyncMode'); const syncStatusBtn = document.getElementById('syncStatusBtn'); let readEnabled=false, writeEnabled=false; let modeText='Standalone', modeEmoji='🏠', cssClass='standalone'; if (this.syncMode==='master'){ readEnabled=true; writeEnabled=true; modeText='Master'; modeEmoji='👑'; cssClass='mode-master'; } else if (this.syncMode==='sync'){ readEnabled=true; writeEnabled=false; modeText='Sync'; modeEmoji='📡'; cssClass='mode-sync'; } if (modeSpans && modeSpans.length){ modeSpans.forEach((el)=>{ const isCompact = el.classList.contains('compact'); el.textContent = modeText; el.className = `sync-mode-badge ${isCompact ? 'compact ' : ''}${cssClass}`; }); } try { const manualSyncBtn = document.getElementById('manualSyncBtn'); if (manualSyncBtn){ const enable = (this.syncMode==='master'); manualSyncBtn.disabled = !enable; manualSyncBtn.style.opacity = enable ? '' : '0.6'; manualSyncBtn.style.cursor = enable ? '' : 'not-allowed'; manualSyncBtn.title = enable ? 'Trigger a one-time sync now' : 'Switch to Master to allow manual sync'; } } catch(e){} if (syncStatusBtn){ syncStatusBtn.classList.remove('status-success','status-warning','status-error'); if (this.syncMode!=='standalone'){ syncStatusBtn.textContent = `${modeEmoji} ${modeText}`; syncStatusBtn.classList.add('status-success'); syncStatusBtn.title = `${modeText}-Modus aktiv - Klick für Details`; } else { syncStatusBtn.textContent = '📊 Status'; syncStatusBtn.title = 'Sync inaktiv - Klick für Details'; } } this.updateWidgetSyncDisplay(modeText, this.syncMode!=='standalone'); console.log(`🎯 UI aktualisiert: Read=${readEnabled}, Write=${writeEnabled}, Mode=${this.syncMode}`); }
  updateSyncStatusDisplay(status,isActive){ const syncStatusBtn = document.getElementById('syncStatusBtn'); if (!syncStatusBtn) return; syncStatusBtn.classList.remove('status-success','status-warning','status-error'); if (isActive){ let emoji='📊', cssClass='status-success', title='Sync Status'; if (status==='Master'){ emoji='👑'; cssClass='status-success'; title='Master-Modus aktiv - Klick für Modus-Wechsel, Rechtsklick für Details'; } else if (status==='Sync' || status==='Slave'){ cssClass='status-warning'; title='Sync-Modus aktiv - Klick für Modus-Wechsel, Rechtsklick für Details'; } syncStatusBtn.textContent = `${emoji} ${status}`; syncStatusBtn.classList.add(cssClass); syncStatusBtn.title = title; } else { syncStatusBtn.textContent = '📊 Status'; syncStatusBtn.title = 'Sync inaktiv - Klicken für Details'; } }
updateWidgetSyncDisplay(status,isActive){ const el = document.getElementById('sync-mode'); if (!el) return; el.classList.remove('master','slave','standalone'); if (isActive){ if (status==='Master'){ el.textContent='Master'; el.classList.add('master'); } else if (status==='Sync' || status==='Slave'){ el.textContent='Sync Read only'; el.classList.add('slave'); } else { el.textContent=status; el.classList.add('master'); } } else { el.textContent='Standalone'; el.classList.add('standalone'); } }
  applyReadOnlyUIState(isReadOnly){
    try{
      const ro = !!isReadOnly;
      document.body.classList.toggle('read-only', ro);

      // Always hide legacy banner – Option B (on-demand modal only)
      try {
        const banner = document.getElementById('readOnlyBanner');
        if (banner) banner.style.display = 'none';
      } catch(_e) {}

      // Disable/enable inputs inside hangar grids
      const containers = [
        document.getElementById('hangarGrid'),
        document.getElementById('secondaryHangarGrid'),
      ];
      containers.forEach((container) => {
        if (!container) return;
        const controls = container.querySelectorAll('input, textarea, select');
        controls.forEach((el) => {
          if (ro){
            if (!el.disabled){
              el.setAttribute('data-readonly-disabled','true');
              el.disabled = true;
            }
          } else {
            if (el.hasAttribute('data-readonly-disabled')){
              el.disabled = false;
              el.removeAttribute('data-readonly-disabled');
            }
          }
        });
      });

      // Install an on-demand modal hint (rate-limited) when interacting with disabled controls
      try {
        const root = document;

        // Helper to create modal lazily
        const ensureModal = () => {
          let overlay = document.getElementById('readOnlyModalOverlay');
          if (overlay) return overlay;
          overlay = document.createElement('div');
          overlay.id = 'readOnlyModalOverlay';
          overlay.className = 'hp-modal-overlay';

          const panel = document.createElement('div');
          panel.id = 'readOnlyModalPanel';
          panel.className = 'hp-modal';
          panel.setAttribute('role', 'dialog');
          panel.setAttribute('aria-modal', 'true');
          panel.setAttribute('aria-labelledby', 'roModalTitle');

          panel.innerHTML = `
            <div class="hp-modal-title" id="roModalTitle">Read-only mode is active</div>
            <div class="hp-modal-body">You're in Sync (read-only). Edits are disabled and won’t be saved to the server.</div>
            <div class="hp-modal-actions">
              <button id="roModalSyncSettings" type="button" class="sidebar-btn sidebar-btn-secondary">Open Sync settings</button>
              <button id="roModalOk" type="button" class="sidebar-btn sidebar-btn-primary">Got it</button>
            </div>
          `;

          overlay.appendChild(panel);
          document.body.appendChild(overlay);

          // Wire actions
          const okBtn = panel.querySelector('#roModalOk');
          const openSyncBtn = panel.querySelector('#roModalSyncSettings');
          const hide = () => { overlay.style.display = 'none'; document.removeEventListener('keydown', escHandler, true); };
          okBtn.addEventListener('click', hide);

          function openSyncSubmenu(){
            try {
              const btn = document.querySelector('#leftMenu .menu-item[data-menu="sync"]');
              const panel = document.getElementById('submenu-sync');
              if (btn) {
                btn.click();
                // if still hidden after click, enforce fallback show
                setTimeout(()=>{
                  try {
                    const p = document.getElementById('submenu-sync');
                    if (p && p.classList.contains('hidden')){
                      p.classList.remove('hidden');
                      const scrim = document.getElementById('submenu-scrim');
                      if (scrim) scrim.classList.remove('hidden');
                      btn.classList.add('active');
                      btn.setAttribute('aria-expanded','true');
                    }
                  } catch(_e){}
                }, 0);
                return true;
              }
              // direct fallback if button not found
              if (panel){
                panel.classList.remove('hidden');
                const scrim = document.getElementById('submenu-scrim');
                if (scrim) scrim.classList.remove('hidden');
                return true;
              }
            } catch(_e){}
            return false;
          }

          openSyncBtn.addEventListener('click', () => {
            openSyncSubmenu();
            hide();
          });
          overlay.addEventListener('click', (e)=>{ if (e.target===overlay) hide(); });

          function escHandler(e){ if (e.key === 'Escape') { hide(); } }

          // Expose a helper to focus the primary button when shown
          overlay.__focusPrimary = () => { try { okBtn.focus(); } catch(_) {} };
          overlay.__escHandler = escHandler;
          return overlay;
        };

        const showModal = () => {
          const ov = ensureModal();
          ov.style.display = 'flex';
          try { document.addEventListener('keydown', ov.__escHandler, true); } catch(_e){}
          try { if (typeof ov.__focusPrimary === 'function') ov.__focusPrimary(); } catch(_e){}
        };

        if (ro && !this._roGuardHandler) {
          this._roModalLast = this._roModalLast || 0;
          this._roGuardHandler = (ev) => {
            try {
              const tgt = ev.target;
              if (!tgt) return;
              const control = tgt.closest('input, textarea, select, button');
              if (!control) return;
              const blocked = control.disabled || control.getAttribute('aria-disabled') === 'true';
              if (blocked) {
                ev.preventDefault(); ev.stopPropagation();
                const now = Date.now();
                if (now - (this._roModalLast||0) > 3000) { this._roModalLast = now; showModal(); }
              }
            } catch(_err) {}
          };
          root.addEventListener('pointerdown', this._roGuardHandler, true);
        } else if (!ro && this._roGuardHandler) {
          root.removeEventListener('pointerdown', this._roGuardHandler, true);
          this._roGuardHandler = null;
        }
      } catch(_e) {}

      console.log(`🔒 Read-only UI ${ro ? 'aktiviert' : 'deaktiviert'}`);
    } catch(e){
      console.warn('⚠️ applyReadOnlyUIState fehlgeschlagen:', e);
    }
  }
  showSyncStatus(){ try{ let statusInfo = "🔍 SYNCHRONISATION STATUS:\n\n"; statusInfo += `Aktueller Modus: ${this.syncMode.toUpperCase()}\n`; statusInfo += `Sync Toggle: ${this.isLiveSyncEnabled ? '✅ Aktiviert' : '❌ Deaktiviert'}\n\n`; alert(statusInfo); console.log(statusInfo);}catch(e){} }
  setModeControlValue(mode){ try { const ctl = document.getElementById('syncModeControl'); if (ctl) ctl.value = mode; } catch(e){} }
  updateSyncStatusIndicator(){}
  async loadServerDataImmediately(){ try{ if (!window.serverSync || !window.serverSync.serverSyncUrl) return false; if (window.isApplyingServerData || window.isLoadingServerData) return false; const serverData = await window.serverSync.loadFromServer(); if (serverData && !serverData.error){ const applied = await window.serverSync.applyServerData(serverData); return !!applied; } return false; } catch(e){ return false; } }
  loadSavedSharingSettings(){ try{ const settings = JSON.parse(localStorage.getItem('hangarSyncSettings') || '{}'); this.syncMode = settings.syncMode || 'master'; this.isLiveSyncEnabled = settings.isLiveSyncEnabled || false; this.isMasterMode = settings.isMasterMode || false; const modeCtl = document.getElementById('syncModeControl'); if (modeCtl){ modeCtl.value = this.syncMode; setTimeout(() => this.updateSyncModeByString(this.syncMode), 100); } } catch(e){ this.syncMode = 'master'; } }
  saveSharingSettings(){ try{ const settings = { syncMode: this.syncMode, isLiveSyncEnabled: this.isLiveSyncEnabled, isMasterMode: this.isMasterMode, lastSaved: new Date().toISOString() }; localStorage.setItem('hangarSyncSettings', JSON.stringify(settings)); } catch(e){} }
  showNotification(message, type = 'info'){
    try {
      if (typeof window.showNotification === 'function') {
        window.showNotification(message, type);
        return;
      }
      console.log(`${String(type || 'info').toUpperCase()}: ${message}`);
      if (type === 'error') {
        alert(`Error: ${message}`);
      }
    } catch(e) {
      try { console.log('NOTIFY:', message); } catch(_e) {}
    }
  }
  destroy(){ try{ if (this.shareCheckInterval) clearInterval(this.shareCheckInterval); this.saveSharingSettings(); } catch(e){} }
}
window.sharingManager = new SharingManager();

// Initialize via central init queue
window.hangarInitQueue = window.hangarInitQueue || [];
window.hangarInitQueue.push(function(){ try { if (window.sharingManager && !window.sharingManager.initialized){ window.sharingManager.init(); } } catch(e){ console.warn('SharingManager init failed', e); } });

console.log('🔗 Sync Manager loaded (alias of Sharing Manager)');
/* END COPY */

