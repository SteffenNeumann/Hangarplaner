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
        try { if (self.canReadFromServer && self.canReadFromServer()) self._pollReadOnce(); } catch(_e){}
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
        for (var k in domMap){ if (!Object.prototype.hasOwnProperty.call(domMap,k)) continue; var dv = (domMap[k]||'')+''; var sv = (serverMap[k]||'')+''; if (dv !== sv){ delta[k] = dv; } }
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
            x.onreadystatechange = function(){ if (x.readyState===4){ var ok=(x.status>=200&&x.status<300); try{ if(ok) setTimeout(function(){ self._pollReadOnce(); }, 1000);}catch(_e){} if (typeof done==='function') done(ok); } };
            x.send(JSON.stringify(body));
          } catch(e){ if (typeof done==='function') done(false); }
        });
      } catch(e){ if (typeof done==='function') done(false); }
    },
    _startWritePolling: function(ms){
      try { this._stopWritePolling(); } catch(_e){}
      var self=this; this._writeTimer = setInterval(function(){ try{
        if (!self.isMaster) return; var dom = self._collectDomFieldMap(); var chk = self._checksum(JSON.stringify(dom)); if (chk === self._lastDomChecksum) return; self._lastDomChecksum = chk; var url = self.getServerUrl(); if (!url) return; var sid = self.getSessionId(); self._postDomDelta(url, sid, {});
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
      // Apply tiles via applyTileData polyfill when available (primary + secondary)
      try {
        var a=false,b=false;
        if (data && typeof window.serverSync.applyTileData === 'function'){
          try { if (Array.isArray(data.primaryTiles)) a = !!window.serverSync.applyTileData(data.primaryTiles, false); } catch(_e){}
          try { if (Array.isArray(data.secondaryTiles)) b = !!window.serverSync.applyTileData(data.secondaryTiles, true); } catch(_e){}
        }
        return !!(a||b);
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
    startSlaveMode: function(){ this.isSlaveActive = true; try { this._startReadPolling(3000); this._stopWritePolling(); } catch(_e){} return Promise.resolve(); },
    startMasterMode: function(){ this.isMaster = true; this.isSlaveActive = true; try { this._startReadPolling(5000); this._startWritePolling(5000); } catch(_e){} return Promise.resolve(); },
    stopPeriodicSync: function(){ try { this._stopReadPolling(); this._stopWritePolling(); } catch(_e){} }
  };
  if (!window.serverSync) window.serverSync = legacy;
  if (!window.storageBrowser) window.storageBrowser = window.serverSync;
})();
