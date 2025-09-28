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
          var body = { metadata:{ timestamp: Date.now() }, settings: settings };
          var x = new XMLHttpRequest();
          x.open('POST', url, true);
          x.setRequestHeader('Content-Type','application/json');
          x.setRequestHeader('X-Sync-Role','master');
          x.setRequestHeader('X-Sync-Session', sid);
          x.onreadystatechange = function(){ if (x.readyState===4){ var ok = (x.status>=200 && x.status<300); try { if (ok) setTimeout(function(){ self._pollReadOnce(); }, 1000); } catch(_e){} resolve(ok); } };
          x.send(JSON.stringify(body));
        } catch(e){ resolve(false); }
      });
    },
    startSlaveMode: function(){ this.isSlaveActive = true; try { this._startReadPolling(3000); } catch(_e){} return Promise.resolve(); },
    startMasterMode: function(){ this.isMaster = true; this.isSlaveActive = true; try { this._startReadPolling(5000); } catch(_e){} return Promise.resolve(); },
    stopPeriodicSync: function(){ try { this._stopReadPolling(); } catch(_e){} }
  };
  if (!window.serverSync) window.serverSync = legacy;
  if (!window.storageBrowser) window.storageBrowser = window.serverSync;
})();
