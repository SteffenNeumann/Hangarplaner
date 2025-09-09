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
    console.log("🎯 Dual-Toggle Event-Handler registriert");
  }
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
  async updateSyncModeByString(mode){
    try {
      if (mode === 'standalone') { await this.enableStandaloneMode(); }
      else if (mode === 'sync') { await this.enableSyncMode(); await this.loadServerDataImmediately(); }
      else if (mode === 'master') {
        const ok = await this.ensureNoActiveMaster();
        if (!ok) { this.showNotification('Another user is Master. Taking over is disabled.', 'warning'); this.setModeControlValue('sync'); await this.enableSyncMode(); return; }
        await this.enableMasterMode(); await this.loadServerDataImmediately();
      }
      this.saveSharingSettings();
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
    if (!readEnabled && !writeEnabled) { await this.enableStandaloneMode(); }
    else if (readEnabled && !writeEnabled) { await this.enableSyncMode(); await this.loadServerDataImmediately(); }
    else if (!readEnabled && writeEnabled) { await this.enableMasterMode(); }
    else { await this.enableMasterMode(); await this.loadServerDataImmediately(); }
    this.saveSharingSettings();
    console.log(`✅ Sync-Modus aktualisiert: Read=${readEnabled}, Write=${writeEnabled}, Mode=${this.syncMode}`);
  }
  async enableStandaloneMode(){ try{
    console.log("🏠 Aktiviere Standalone-Modus...");
    if (window.serverSync){ window.serverSync.stopPeriodicSync(); if (window.serverSync.slaveCheckInterval){ clearInterval(window.serverSync.slaveCheckInterval); window.serverSync.slaveCheckInterval = null; } window.serverSync.isMaster = false; window.serverSync.isSlaveActive = false; }
    this.syncMode = 'standalone'; this.isLiveSyncEnabled = false; this.isMasterMode = false;
    this.updateAllSyncDisplays('Standalone', false); this.applyReadOnlyUIState(false); this.showNotification('Standalone-Modus aktiviert - Nur lokale Speicherung','info');
    console.log('✅ Standalone-Modus aktiviert');
  } catch(e){ console.error('❌ Fehler beim Aktivieren des Standalone-Modus:', e); this.showNotification('Fehler beim Wechsel zu Standalone-Modus','error'); } }
  async enableSyncMode(){ try{
    console.log('📡 Aktiviere Sync-Modus (Slave)...');
    if (!window.serverSync) throw new Error('ServerSync nicht verfügbar');
    window.serverSync.isMaster = false; window.serverSync.isSlaveActive = true; console.log('🔄 Starte Slave-Polling für Read-Modus...'); await window.serverSync.startSlaveMode();
    if (!window.serverSync.slaveCheckInterval){ setTimeout(async()=>{ await window.serverSync.startSlaveMode(); console.log('🔄 Slave-Polling Retry ausgeführt'); }, 2000); }
    this.syncMode = 'sync'; this.isLiveSyncEnabled = true; this.isMasterMode = false; this.updateAllSyncDisplays('Sync', true); this.applyReadOnlyUIState(true); this.showNotification('Sync-Modus aktiviert - Empfange Server-Updates','info'); console.log('✅ Sync-Modus (Slave) aktiviert');
  } catch(e){ console.error('❌ Fehler beim Aktivieren des Sync-Modus:', e); this.showNotification('Fehler beim Aktivieren der Synchronisation','error'); await this.enableStandaloneMode(); } }
  async enableMasterMode(){ try{
    console.log('👑 Aktiviere Master-Modus...');
    const ok = await this.ensureNoActiveMaster(); if (!ok){ this.showNotification('Another user is Master. Taking over is disabled.', 'warning'); this.syncMode = 'sync'; this.setModeControlValue('sync'); await this.enableSyncMode(); return; }
    if (!window.serverSync) throw new Error('ServerSync nicht verfügbar');
    window.serverSync.isMaster = true; window.serverSync.isSlaveActive = false; await window.serverSync.startMasterMode(); this.syncMode = 'master'; this.isLiveSyncEnabled = true; this.isMasterMode = true; this.updateAllSyncDisplays('Master', true); this.applyReadOnlyUIState(false); this.showNotification('Master-Modus aktiviert - Sende Daten an Server', 'success'); console.log('✅ Master-Modus aktiviert');
  } catch(e){ console.error('❌ Fehler beim Aktivieren des Master-Modus:', e); this.showNotification('Fehler beim Aktivieren des Master-Modus','error'); await this.enableSyncMode(); } }
  async performLiveSync(){ if (!this.isLiveSyncEnabled) return; try { if (window.serverSync && window.serverSync.syncWithServer){ const success = await window.serverSync.syncWithServer(); if (success){ console.log('🔄 Live Sync erfolgreich'); this.updateSyncStatusIndicator('success'); } else { console.warn('⚠️ Live Sync teilweise fehlgeschlagen'); this.updateSyncStatusIndicator('warning'); } } } catch(e){ console.error('❌ Live Sync Fehler:', e); this.updateSyncStatusIndicator('error'); } }
  updateAllSyncDisplays(status = null, isActive = null){ if (status !== null && isActive !== null){ this.updateSyncStatusDisplay(status, isActive); this.updateWidgetSyncDisplay(status, isActive); } this.updateSyncStatusDisplayNew(); console.log(`🔄 Alle Sync-Anzeigen aktualisiert${status ? ` (${status}, ${isActive})` : ''}`); }
  updateSyncStatusDisplayNew(){ const modeSpans = document.querySelectorAll('#currentSyncMode, #currentSyncModeSidebar, .currentSyncMode'); const syncStatusBtn = document.getElementById('syncStatusBtn'); let readEnabled=false, writeEnabled=false; let modeText='Standalone', modeEmoji='🏠', cssClass='standalone'; if (this.syncMode==='master'){ readEnabled=true; writeEnabled=true; modeText='Master'; modeEmoji='👑'; cssClass='mode-master'; } else if (this.syncMode==='sync'){ readEnabled=true; writeEnabled=false; modeText='Sync'; modeEmoji='📡'; cssClass='mode-sync'; } if (modeSpans && modeSpans.length){ modeSpans.forEach((el)=>{ const isCompact = el.classList.contains('compact'); el.textContent = modeText; el.className = `sync-mode-badge ${isCompact ? 'compact ' : ''}${cssClass}`; }); } try { const manualSyncBtn = document.getElementById('manualSyncBtn'); if (manualSyncBtn){ const enable = (this.syncMode==='master'); manualSyncBtn.disabled = !enable; manualSyncBtn.style.opacity = enable ? '' : '0.6'; manualSyncBtn.style.cursor = enable ? '' : 'not-allowed'; manualSyncBtn.title = enable ? 'Trigger a one-time sync now' : 'Switch to Master to allow manual sync'; } } catch(e){} if (syncStatusBtn){ syncStatusBtn.classList.remove('status-success','status-warning','status-error'); if (this.syncMode!=='standalone'){ syncStatusBtn.textContent = `${modeEmoji} ${modeText}`; syncStatusBtn.classList.add('status-success'); syncStatusBtn.title = `${modeText}-Modus aktiv - Klick für Details`; } else { syncStatusBtn.textContent = '📊 Status'; syncStatusBtn.title = 'Sync inaktiv - Klick für Details'; } } this.updateWidgetSyncDisplay(modeText, this.syncMode!=='standalone'); console.log(`🎯 UI aktualisiert: Read=${readEnabled}, Write=${writeEnabled}, Mode=${this.syncMode}`); }
  updateSyncStatusDisplay(status,isActive){ const syncStatusBtn = document.getElementById('syncStatusBtn'); if (!syncStatusBtn) return; syncStatusBtn.classList.remove('status-success','status-warning','status-error'); if (isActive){ let emoji='📊', cssClass='status-success', title='Sync Status'; if (status==='Master'){ emoji='👑'; cssClass='status-success'; title='Master-Modus aktiv - Klick für Modus-Wechsel, Rechtsklick für Details'; } else if (status==='Sync' || status==='Slave'){ cssClass='status-warning'; title='Sync-Modus aktiv - Klick für Modus-Wechsel, Rechtsklick für Details'; } syncStatusBtn.textContent = `${emoji} ${status}`; syncStatusBtn.classList.add(cssClass); syncStatusBtn.title = title; } else { syncStatusBtn.textContent = '📊 Status'; syncStatusBtn.title = 'Sync inaktiv - Klicken für Details'; } }
  updateWidgetSyncDisplay(status,isActive){ const el = document.getElementById('sync-mode'); if (!el) return; el.classList.remove('master','slave','standalone','write-only'); if (isActive){ if (status==='Master'){ el.textContent='Master'; el.classList.add('master'); } else if (status==='Sync' || status==='Slave'){ el.textContent='Sync Read only'; el.classList.add('slave'); } else if (status==='Write-Only'){ el.textContent='Write-only'; el.classList.add('write-only'); } else { el.textContent=status; el.classList.add('master'); } } else { el.textContent='Standalone'; el.classList.add('standalone'); } }
  applyReadOnlyUIState(isReadOnly){ try{ const ro=!!isReadOnly; document.body.classList.toggle('read-only', ro); try{ const banner=document.getElementById('readOnlyBanner'); if (banner) banner.style.display = ro ? '' : 'none'; }catch(_e){} const containers=[ document.getElementById('hangarGrid'), document.getElementById('secondaryHangarGrid') ]; containers.forEach((container)=>{ if (!container) return; const controls = container.querySelectorAll('input, textarea, select'); controls.forEach((el)=>{ if (ro){ if (!el.disabled){ el.setAttribute('data-readonly-disabled','true'); el.disabled = true; } } else { if (el.hasAttribute('data-readonly-disabled')){ el.disabled = false; el.removeAttribute('data-readonly-disabled'); } } }); }); try{ const root=document; if (ro && !this._roToastHandler){ this._roToastLast = this._roToastLast || 0; this._roToastHandler = ()=>{ const now=Date.now(); if (now - (this._roToastLast||0) > 2500){ this._roToastLast = now; this.showNotification('Read-Only: Changes won’t be saved to the server','info'); } }; root.addEventListener('pointerdown', this._roToastHandler, true); } else if (!ro && this._roToastHandler){ root.removeEventListener('pointerdown', this._roToastHandler, true); this._roToastHandler = null; } } catch(_e){} console.log(`🔒 Read-only UI ${ro ? 'aktiviert' : 'deaktiviert'}`); } catch(e){ console.warn('⚠️ applyReadOnlyUIState fehlgeschlagen:', e); } }
  showSyncStatus(){ try{ let statusInfo = "🔍 SYNCHRONISATION STATUS:\n\n"; statusInfo += `Aktueller Modus: ${this.syncMode.toUpperCase()}\n`; statusInfo += `Sync Toggle: ${this.isLiveSyncEnabled ? '✅ Aktiviert' : '❌ Deaktiviert'}\n\n`; alert(statusInfo); console.log(statusInfo);}catch(e){} }
  setModeControlValue(mode){ try { const ctl = document.getElementById('syncModeControl'); if (ctl) ctl.value = mode; } catch(e){} }
  updateSyncStatusIndicator(){}
  async loadServerDataImmediately(){ try{ if (!window.serverSync || !window.serverSync.serverSyncUrl) return false; if (window.isApplyingServerData || window.isLoadingServerData) return false; window.isLoadingServerData = true; const serverData = await window.serverSync.loadFromServer(); if (serverData && !serverData.error){ const applied = await window.serverSync.applyServerData(serverData); return !!applied; } return false; } catch(e){ return false; } finally { window.isLoadingServerData = false; } }
  loadSavedSharingSettings(){ try{ const settings = JSON.parse(localStorage.getItem('hangarSyncSettings') || '{}'); this.syncMode = settings.syncMode || 'standalone'; this.isLiveSyncEnabled = settings.isLiveSyncEnabled || false; this.isMasterMode = settings.isMasterMode || false; const modeCtl = document.getElementById('syncModeControl'); if (modeCtl){ modeCtl.value = this.syncMode; setTimeout(() => this.updateSyncModeByString(this.syncMode), 100); } } catch(e){ this.syncMode = 'standalone'; } }
  saveSharingSettings(){ try{ const settings = { syncMode: this.syncMode, isLiveSyncEnabled: this.isLiveSyncEnabled, isMasterMode: this.isMasterMode, lastSaved: new Date().toISOString() }; localStorage.setItem('hangarSyncSettings', JSON.stringify(settings)); } catch(e){} }
  destroy(){ try{ if (this.shareCheckInterval) clearInterval(this.shareCheckInterval); this.saveSharingSettings(); } catch(e){} }
}
window.sharingManager = new SharingManager();

// Initialize via central init queue
window.hangarInitQueue = window.hangarInitQueue || [];
window.hangarInitQueue.push(function(){ try { if (window.sharingManager && !window.sharingManager.initialized){ window.sharingManager.init(); } } catch(e){ console.warn('SharingManager init failed', e); } });

console.log('🔗 Sync Manager loaded (alias of Sharing Manager)');
/* END COPY */

