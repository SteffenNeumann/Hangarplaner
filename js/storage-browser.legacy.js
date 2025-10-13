(function(){
  // Minimal, ES5-safe serverSync for legacy browsers (no async/await, no classes, no arrow functions).
  function safeOrigin(){
    try { return window.location.origin || (window.location.protocol + '//' + window.location.host); } catch(_e){ return ''; }
  }
  function getServerUrl(){
    var base;
    try { base = (window.serverSync && window.serverSync.serverSyncUrl) || (safeOrigin() + '/sync/data.php'); }
    catch(_e){ base = '/sync/data.php'; }
    return base;
  }
  function xhrGet(url, cb){
    try {
      var x = new XMLHttpRequest();
      x.open('GET', url, true);
      x.onreadystatechange = function(){
        if (x.readyState === 4){
          if (x.status >= 200 && x.status < 300){
            var text = x.responseText || '';
            try { cb(null, text ? JSON.parse(text) : null); } catch(e){ cb(e); }
          } else {
            cb(new Error('HTTP '+x.status));
          }
        }
      };
      x.send();
    } catch(e){ cb(e); }
  }
  function ensureSession(){
    var sid = '';
    try { sid = localStorage.getItem('serverSync.sessionId') || ''; } catch(_e){}
    if (!sid){
      try {
        sid = Math.random().toString(36).slice(2) + Date.now().toString(36);
        localStorage.setItem('serverSync.sessionId', sid);
      } catch(_e){}
    }
    return sid;
  }
  var legacy = {
    serverSyncUrl: safeOrigin() ? (safeOrigin() + '/sync/data.php') : '/sync/data.php',
    isMaster: false,
    isSlaveActive: false,
    _readTimer: null,
    _presenceTimer: null,
    _typingWinMs: 8000,
    _lockMs: 5*60*1000,
    _lastKeyAt: 0,
    _remoteLocks: {},
    getServerUrl: function(){ return this.serverSyncUrl || getServerUrl(); },
    getSessionId: function(){ return ensureSession(); },
    canReadFromServer: function(){
      try {
        var m = (window.sharingManager && window.sharingManager.syncMode) || 'offline';
        return m === 'sync' || m === 'master';
      } catch(_e){ return false; }
    },
    _pollReadOnce: function(){
      try {
        var self = this; var url = self.getServerUrl(); if (!url) return;
        var q = url.indexOf('?')>=0 ? '&' : '?';
        xhrGet(url + q + 'action=load', function(err, data){
          if (err || !data) return;
          try {
            if (typeof window.serverSync.applyServerData === 'function') {
              window.serverSync.applyServerData(data);
            } else if (typeof window.serverSync.applyTileData === 'function') {
              try { window.serverSync.applyTileData(data.primaryTiles||[], false); } catch(_e){}
              try { window.serverSync.applyTileData(data.secondaryTiles||[], true); } catch(_e){}
            } else if (typeof window.syncDebugRead === 'function') {
              window.syncDebugRead();
            }
          } catch(_e){}
        });
      } catch(_e){}
    },
    _startReadPolling: function(ms){
      try { this._stopReadPolling(); } catch(_e){}
      var self = this; this._readTimer = setInterval(function(){
        try {
          var now = Date.now();
          var active = (document && document.activeElement && document.activeElement.id) ? document.activeElement.id : '';
          var typing = (now - (self._lastKeyAt||0)) < self._typingWinMs;
          if (typing && /^(aircraft|hangar-position|position|arrival-time|departure-time|status|tow-status|notes)-(\d+)$/.test(active||'')) return;
          if (self.canReadFromServer && self.canReadFromServer()) self._pollReadOnce();
        } catch(_e){}
      }, ms || 3000);
    },
    _stopReadPolling: function(){ if (this._readTimer){ try { clearInterval(this._readTimer); } catch(_e){} this._readTimer = null; } },

    // ===== Write polling (Master) and DOM delta helpers =====
    _writeTimer: null,
    _lastDomChecksum: '',
    _checksum: function(str){ try{ var h=0,i=0,l=str.length; for(i=0;i<l;i++){ h=(h<<5)-h+str.charCodeAt(i); h|=0; } return String(h); } catch(_e){ return String(+new Date()); } },
    _collectDomFieldMap: function(){
      try {
        var map = {};
        var list = document.querySelectorAll("[id^='aircraft-'], [id^='hangar-position-'], [id^='position-'], [id^='arrival-time-'], [id^='departure-time-'], [id^='status-'], [id^='tow-status-'], [id^='notes-']");
        for (var i=0;i<list.length;i++){
          var id = list[i].id; var m = id && id.match(/^(aircraft|hangar-position|position|arrival-time|departure-time|status|tow-status|notes)-(\d+)$/);
          if (!m) continue; var fid = m[1]+"-"+m[2]; var v = (list[i].value!=null? list[i].value : (list[i].textContent||'')).trim();
          map[fid] = v;
        }
        return map;
      } catch(_e){ return {}; }
    },
    _serverFieldMap: function(data){
      try {
        var map = {};
        function put(tile, prefix){
          var id = parseInt(tile && tile.tileId,10)||0; if (!id) return;
          map['aircraft-'+id] = (tile.aircraftId||'')+'';
          map['arrival-time-'+id] = (tile.arrivalTime||'')+'';
          map['departure-time-'+id] = (tile.departureTime||'')+'';
          map['hangar-position-'+id] = (tile.hangarPosition||'')+'';
          map['position-'+id] = (tile.position||'')+'';
          map['status-'+id] = (tile.status||'neutral')+'';
          map['tow-status-'+id] = (tile.towStatus||'neutral')+'';
          map['notes-'+id] = (tile.notes||'')+'';
        }
        var a = Array.isArray(data && data.primaryTiles) ? data.primaryTiles : [];
        for (var i=0;i<a.length;i++){ put(a[i]); }
        var b = Array.isArray(data && data.secondaryTiles) ? data.secondaryTiles : [];
        for (var j=0;j<b.length;j++){ put(b[j]); }
        return map;
      } catch(_e){ return {}; }
    },
    _computeDelta: function(serverMap, domMap){
      try {
        var delta = {};
        var now = Date.now();
        for (var k in domMap){ if (!Object.prototype.hasOwnProperty.call(domMap,k)) continue; var dv = (domMap[k]||'')+''; var sv = (serverMap[k]||'')+'';
          // Skip fields locked by others
          var rk = (legacy._remoteLocks||{})[k]; if (rk && (rk.until||0)>now) continue;
          if (dv !== sv){ delta[k] = dv; }
        }
        return delta;
      } catch(_e){ return {}; }
    },
    _postDomDelta: function(url, sid, settings, done){
      var self=this;
      try {
        var q = url.indexOf('?')>=0 ? '&' : '?';
        xhrGet(url + q + 'action=load', function(err, data){
          try {
            var serverMap = err? {} : self._serverFieldMap(data||{});
            var domMap = self._collectDomFieldMap();
            var delta = self._computeDelta(serverMap, domMap);
            var body = { metadata:{ timestamp: Date.now() }, settings: settings||{} };
            if (delta && Object.keys(delta).length){ body.fieldUpdates = delta; }
            var x = new XMLHttpRequest();
            x.open('POST', url, true);
            x.setRequestHeader('Content-Type','application/json');
            x.setRequestHeader('X-Sync-Role','master');
            x.setRequestHeader('X-Sync-Session', sid);
            try {
              var dname = '';
              try { dname = (localStorage.getItem('presence.displayName')||'').trim(); } catch(_d){}
              if (!dname) { try { dname = 'User-' + String(sid||'').slice(-4); } catch(_e){} }
              x.setRequestHeader('X-Display-Name', dname);
            } catch(_h){}
            x.onreadystatechange = function(){ if (x.readyState===4){ var ok=(x.status>=200&&x.status<300); try{ if(ok) setTimeout(function(){ self._pollReadOnce(); }, 1000);}catch(_e){} if (typeof done==='function') done(ok); } };
            x.send(JSON.stringify(body));
          } catch(e){ if (typeof done==='function') done(false); }
        });
      } catch(e){ if (typeof done==='function') done(false); }
    },
    _startWritePolling: function(ms){
      try { this._stopWritePolling(); } catch(_e){}
var self=this; this._writeTimer = setInterval(function(){ try{
        if (!self.isMaster) return;
        var now = Date.now();
        var active = (document && document.activeElement && document.activeElement.id) ? document.activeElement.id : '';
        var typing = (now - (self._lastKeyAt||0)) < self._typingWinMs;
        if (typing && /^(aircraft|hangar-position|position|arrival-time|departure-time|status|tow-status|notes)-(\d+)$/.test(active||'')) return;
        var dom = self._collectDomFieldMap(); var chk = self._checksum(JSON.stringify(dom)); if (chk === self._lastDomChecksum) return; self._lastDomChecksum = chk; var url = self.getServerUrl(); if (!url) return; var sid = self.getSessionId(); self._postDomDelta(url, sid, {});
      }catch(_e){} }, ms || 5000);
    },
    _stopWritePolling: function(){ if (this._writeTimer){ try { clearInterval(this._writeTimer); } catch(_e){} this._writeTimer=null; } },

    loadFromServer: function(){
      var self = this;
      return new Promise(function(resolve){
        try {
          var url = self.getServerUrl();
          var q = url.indexOf('?') >= 0 ? '&' : '?';
          xhrGet(url + q + 'action=load', function(err, data){ if (err){ resolve(null); } else { resolve(data); } });
        } catch(e){ resolve(null); }
      });
    },
    applyServerData: function(data){
      try {
        if (!data) return false;
        var now = Date.now();
        var active = (document && document.activeElement && document.activeElement.id) ? document.activeElement.id : '';
        var typing = (now - (this._lastKeyAt||0)) < this._typingWinMs;
        var looksRelevant = function(id){ return /^(aircraft|hangar-position|position|arrival-time|departure-time|status|tow-status|notes)-(\d+)$/.test(id||''); };
        // Get current session ID for comparison
        var mySessionId = (typeof legacy.getSessionId === 'function') ? legacy.getSessionId() : '';
        function setField(id, val, updatedBySession){
          try {
            var el = document.getElementById(id); if (!el) return false;
            if (looksRelevant(id)){
              // Skip if user is typing this field
              if (typing && id===active) return false;
              // Skip if locked by others
              var lk = (legacy._remoteLocks || {})[id]; if (lk && (lk.until||0)>now) return false;
            }
            // Allow authoritative clears from other sessions to overwrite non-empty local values
            var cur = ('value' in el) ? (el.value||'').trim() : (el.textContent||'').trim();
            var fromOtherSession = !!(updatedBySession && mySessionId && updatedBySession !== mySessionId);
            // Do not overwrite non-empty local value with empty incoming UNLESS it's from another session (authoritative clear)
            if ((val==null || String(val).trim()==='') && cur && !fromOtherSession) return false;
            if ('value' in el) {
              el.value = String(val||'');
              // Styling hook for selects
              if (/^tow-status-\d+$/.test(id)){
                try {
                  var v = (el.value||'neutral').trim();
                  el.classList.remove('tow-neutral','tow-initiated','tow-ongoing','tow-on-position');
                  el.classList.add('tow-'+v);
                  if (typeof window.updateTowStatusStyles==='function') window.updateTowStatusStyles(el);
                } catch(_s){}
              }
              if (/^status-\d+$/.test(id)){
                try {
                  // Update status light for this tile if helper exists
                  if (typeof window.updateStatusLightByCellId==='function'){
                    var cid = parseInt(id.replace('status-',''),10);
                    if (isFinite(cid)) window.updateStatusLightByCellId(cid);
                  } else if (typeof window.updateStatusLight==='function'){
                    window.updateStatusLight(el);
                  }
                } catch(_sx){}
              }
            } else {
              el.textContent = String(val||'');
            }
            return true;
          } catch(_e){ return false; }
        }
        var applied = 0;
        var applyTile = function(t){
          var id = parseInt(t && t.tileId,10)||0; if (!id) return;
          var updatedBy = (t && t.updatedBySession) ? t.updatedBySession : '';
          if (t.aircraftId!=null) applied += setField('aircraft-'+id, t.aircraftId, updatedBy)?1:0;
          if (t.hangarPosition!=null) applied += setField('hangar-position-'+id, t.hangarPosition, updatedBy)?1:0;
          if (t.position!=null) applied += setField('position-'+id, t.position, updatedBy)?1:0;
          if (t.arrivalTime!=null) applied += setField('arrival-time-'+id, t.arrivalTime, updatedBy)?1:0;
          if (t.departureTime!=null) applied += setField('departure-time-'+id, t.departureTime, updatedBy)?1:0;
          if (t.status!=null) applied += setField('status-'+id, t.status, updatedBy)?1:0;
          if (t.towStatus!=null) applied += setField('tow-status-'+id, t.towStatus, updatedBy)?1:0;
          if (t.notes!=null) applied += setField('notes-'+id, t.notes, updatedBy)?1:0;
        };
        var a = Array.isArray(data.primaryTiles)?data.primaryTiles:[]; for (var i=0;i<a.length;i++) applyTile(a[i]);
        var b = Array.isArray(data.secondaryTiles)?data.secondaryTiles:[]; for (var j=0;j<b.length;j++) applyTile(b[j]);
        // After applying, refresh status lights globally if available
        try {
          if (typeof window.updateAllStatusLightsForced==='function') setTimeout(function(){ window.updateAllStatusLightsForced(); }, 50);
          else if (typeof window.updateAllStatusLights==='function') setTimeout(function(){ window.updateAllStatusLights(); }, 50);
        } catch(_r){}
        return applied>0;
      } catch(_e){ return false; }
    },
    manualSync: function(){ return this.syncWithServer(); },
    syncWithServer: function(){
      var self = this;
      return new Promise(function(resolve){
        try {
          if (!self.isMaster) { resolve(true); return; }
          var url = self.getServerUrl();
          if (!url){ resolve(false); return; }
          var sid = self.getSessionId();
          var headers = { 'Content-Type':'application/json', 'X-Sync-Role':'master', 'X-Sync-Session': sid };
          // settings-only payload (safe)
          var settings = {};
          try {
            if (window.displayOptions && window.displayOptions.current){
              var o = {};
              try { for (var k in window.displayOptions.current){ if (Object.prototype.hasOwnProperty.call(window.displayOptions.current, k)) o[k] = window.displayOptions.current[k]; } } catch(_e){}
              delete o.darkMode;
              settings.displayOptions = o;
            }
          } catch(_e){}
          // Build delta against server snapshot and POST
          self._postDomDelta(url, sid, settings, function(ok){ resolve(!!ok); });
        } catch(e){ resolve(false); }
      });
    },
    startSlaveMode: function(){ this.isSlaveActive = true; try { this._startReadPolling(3000); this._stopWritePolling(); this._startPresenceHeartbeat(); } catch(_e){} return Promise.resolve(); },
    startMasterMode: function(){ this.isMaster = true; this.isSlaveActive = true; try { this._startReadPolling(5000); this._startWritePolling(5000); this._startPresenceHeartbeat(); } catch(_e){} return Promise.resolve(); },
    stopPeriodicSync: function(){ try { this._stopReadPolling(); this._stopWritePolling(); this._stopPresenceHeartbeat(); } catch(_e){} }
  };
  // ===== Presence (multi-master) minimal support =====
  function presenceUrl(){ try { var b = legacy.getServerUrl(); return b.replace(/data\.php(?:\?.*)?$/,'presence.php'); } catch(_e){ return (safeOrigin()||'') + '/sync/presence.php'; } }
  legacy._collectLocalLocks = function(){
    try {
      var now = Date.now();
      var map = (window.__fieldApplyLockUntil && typeof window.__fieldApplyLockUntil==='object') ? window.__fieldApplyLockUntil : {};
      var out = {};
      var fid = (window.__lastActiveFieldId || '').toString();
      if (fid && map[fid] && (parseInt(map[fid],10)||0) > now){ out[fid] = parseInt(map[fid],10); return out; }
      // Fallback: choose the most recent non-expired lock
      var latestK = ''; var latestV = 0;
      for (var k in map){ if (!Object.prototype.hasOwnProperty.call(map,k)) continue; var u = parseInt(map[k],10)||0; if (u>now && u>latestV){ latestV=u; latestK=k; } }
      if (latestK) out[latestK] = latestV;
      return out;
    } catch(_e){ return {}; }
  };
legacy._sendPresenceHeartbeat = function(){ try { var sid = legacy.getSessionId(); var dname=''; try{ dname=(localStorage.getItem('presence.displayName')||'').trim(); }catch(_e){} var role = legacy.isMaster? 'master' : (legacy.canReadFromServer()? 'sync':'standalone'); var locks = legacy._collectLocalLocks(); fetch(presenceUrl(), { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ action:'heartbeat', sessionId: sid, displayName: dname, role: role, page: 'planner', locks: locks, locksReplace: true }) }); } catch(_e){} };
  legacy._startPresenceHeartbeat = function(){ try { legacy._sendPresenceHeartbeat(); if (legacy._presenceTimer){ clearInterval(legacy._presenceTimer);} legacy._presenceTimer = setInterval(function(){ try{ legacy._sendPresenceHeartbeat(); }catch(_e){} }, 20000); } catch(_e){} };
  legacy._stopPresenceHeartbeat = function(){ try { if (legacy._presenceTimer){ clearInterval(legacy._presenceTimer); legacy._presenceTimer=null; } } catch(_e){} };
  legacy._refreshRemoteLocks = async function(){ try { var u = presenceUrl() + '?action=list'; var res = await fetch(u, { headers:{ 'Accept':'application/json' } }); if (!res.ok) return; var data = await res.json(); var users = Array.isArray(data && data.users)? data.users : []; var my = legacy.getSessionId(); var now=Date.now(); var map={}; var otherMasters = users.filter(function(usr){ try { return (usr && usr.role && String(usr.role).toLowerCase()==='master' && usr.sessionId && usr.sessionId!==my); } catch(_e){ return false; } }); if (!otherMasters.length){ legacy._remoteLocks = {}; legacy._renderLockPills(); return; } otherMasters.forEach(function(u){ try { var sid=(u && u.sessionId)||''; var locks=(u && u.locks) || {}; Object.keys(locks).forEach(function(fid){ var until = parseInt(locks[fid],10)||0; if (until>now){ map[fid] = { until: until, sessionId: sid, displayName: (u.displayName||'User') }; } }); } catch(_e){} }); legacy._remoteLocks = map; legacy._renderLockPills(); } catch(_e){} };
  legacy._renderLockPills = function(){
    try {
      // Only show pills in multi-master context
      if (!legacy.isMaster) { try { document.querySelectorAll('span.editing-pill').forEach(function(p){ p.remove(); }); } catch(_){} return; }
      var now = Date.now(); var m = legacy._remoteLocks||{};
      // Remove stale pills not present in map
      try { document.querySelectorAll('span.editing-pill').forEach(function(p){ var fid = (p.id||'').replace('editing-pill-',''); if (!m[fid] || (m[fid].until||0)<=now){ p.remove(); } }); } catch(_r){}
      Object.keys(m).forEach(function(fid){
        try {
          var info=m[fid]; if (!info || (info.until||0)<=now) return;
          var el=document.getElementById(fid); if (!el) return;
          var container = el.closest('.input-container') || el.parentElement;
          if (container && !/relative/.test(container.style.position||'')) { try { container.style.position='relative'; } catch(_s){} }
          var id='editing-pill-'+fid; var pill=document.getElementById(id);
if (!pill){
            pill=document.createElement('span'); pill.id=id; pill.className='editing-pill';
            // Tail element (styled via CSS)
            var tail=document.createElement('i'); tail.className='editing-pill-tail'; pill.appendChild(tail);
            try { (container||el.parentNode).appendChild(pill); } catch(_e){ try { el.insertAdjacentElement('afterend', pill);}catch(__){} }
          }
var mins=Math.max(0, Math.ceil(((info.until||0)-now)/60000));
          try {
            var txt=(info.displayName||'User')+' editing • '+mins+'m';
            if (pill.firstChild && pill.firstChild.classList && pill.firstChild.classList.contains('editing-pill-tail')){
              pill.lastChild && pill.lastChild.nodeType===Node.TEXT_NODE ? (pill.lastChild.textContent=txt) : pill.appendChild(document.createTextNode(txt));
            } else {
              pill.textContent = txt;
            }
          } catch(_e){}
        } catch(_e){}
      });
    } catch(_e){}
  };

  // Typing detection + local lock management (5 min window)
  try {
    document.addEventListener('keydown', function(ev){ try { legacy._lastKeyAt = Date.now(); var t = ev && ev.target; if (!t || !t.id) return; var m = t.id.match(/^(aircraft|hangar-position|position|arrival-time|departure-time|status|tow-status|notes)-(\d+)$/); if (!m) return; window.__lastActiveFieldId = t.id; window.__fieldApplyLockUntil = {}; window.__fieldApplyLockUntil[t.id] = Date.now() + legacy._lockMs; setTimeout(function(){ try { legacy._sendPresenceHeartbeat(); } catch(_e){} }, 0); } catch(_e){} }, true);
    document.addEventListener('input', function(ev){ try { legacy._lastKeyAt = Date.now(); var t = ev && ev.target; if (!t || !t.id) return; var m = t.id.match(/^(aircraft|hangar-position|position|arrival-time|departure-time|status|tow-status|notes)-(\d+)$/); if (!m) return; window.__lastActiveFieldId = t.id; window.__fieldApplyLockUntil = {}; window.__fieldApplyLockUntil[t.id] = Date.now() + legacy._lockMs; setTimeout(function(){ try { legacy._sendPresenceHeartbeat(); } catch(_e){} }, 0); } catch(_e){} }, true);
    // Immediate write on blur for notes and selects in Master mode
    document.addEventListener('blur', function(ev){ try { if (!legacy.isMaster) return; var t=ev && ev.target; if (!t || !t.id) return; if (!/^(notes|status|tow-status)-(\d+)$/.test(t.id)) return; var url=legacy.getServerUrl(); var sid=legacy.getSessionId(); legacy._postDomDelta(url, sid, {}); } catch(_e){} }, true);
    // Periodically refresh remote locks (fast for near-immediate pills)
    setInterval(function(){ try { legacy._refreshRemoteLocks(); } catch(_e){} }, 1000);
  } catch(_e){}

  if (!window.serverSync) window.serverSync = legacy;
  if (!window.storageBrowser) window.storageBrowser = window.serverSync;
})();
