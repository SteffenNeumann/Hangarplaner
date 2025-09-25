(function(){
  if (window.debugMoveOverlay) return;
  function sel(q){ try { return Array.from(document.querySelectorAll(q)); } catch(_) { return []; } }
  function isTable(){ try { return document.body.classList.contains('table-view'); } catch(_) { return false; } }
  function getSyncMode(){ try { return (window.sharingManager && window.sharingManager.syncMode) || 'unknown'; } catch(_) { return 'unknown'; } }
  function getEMStatus(){ try { return (typeof window.getEventManagerStatus==='function') ? window.getEventManagerStatus() : null; } catch(_) { return null; } }
  function freeTilesCount(){ try { return (typeof window.getFreeTilesWithLabels==='function') ? (window.getFreeTilesWithLabels()||[]).length : null; } catch(_) { return null; } }
  
  const dbg = {
    status(){
      const s = {
        view: isTable() ? 'table' : 'tiles',
        syncMode: getSyncMode(),
        eventManager: getEMStatus(),
        boardAircraftInputs: sel('#hangarGrid input[id^="aircraft-"], #secondaryHangarGrid input[id^="aircraft-"]').length,
        tableAircraftInputs: sel('#plannerTableBody input[id^="ac-"]').length,
        freeTiles: freeTilesCount(),
      };
      try { console.log('debugMoveOverlay.status →', s); } catch(_) {}
      return s;
    },
    forceWiring(){
      try {
        sel('#hangarGrid input[id^="aircraft-"], #secondaryHangarGrid input[id^="aircraft-"]').forEach(inp => {
          if (!inp.getAttribute('title')) inp.setAttribute('title','Shift+Click to move content to another hangar position');
        });
        if (window.hangarEventManager && typeof window.hangarEventManager.setupUnifiedEventHandlers==='function'){
          window.hangarEventManager.setupUnifiedEventHandlers();
        }
        console.log('debugMoveOverlay.forceWiring applied');
      } catch(e){ console.warn('forceWiring failed', e); }
    },
    test(tileId){
      try {
        const tiles = (typeof window.getFreeTilesWithLabels==='function') ? (window.getFreeTilesWithLabels()||[]) : [];
        if (!tiles.length){ console.warn('No free tiles available for test'); return false; }
        if (typeof window.openTileSelectionOverlay!=='function'){ console.warn('openTileSelectionOverlay not available'); return false; }
        console.log('Opening selection overlay with', tiles.length, 'tiles');
        window.openTileSelectionOverlay({ tiles, onSelect: (id)=>{ try { console.log('Picked tile', id); } catch(_){} } });
        return true;
      } catch(e){ console.warn('test() failed', e); return false; }
    },
    install(){
      if (this._installed) { console.log('debugMoveOverlay already installed'); return; }
      const onPD = (e)=>{
        try {
          if (!e.shiftKey) return;
          const inBoard = !!(e.target && e.target.closest && e.target.closest('#panel-planner'));
          const isAc = !!(e.target && e.target.matches && e.target.matches('#hangarGrid input[id^="aircraft-"], #secondaryHangarGrid input[id^="aircraft-"]'));
          const cell = e.target && e.target.closest ? e.target.closest('#hangarGrid .hangar-cell, #secondaryHangarGrid .hangar-cell') : null;
          const ac = isAc ? e.target : (cell ? cell.querySelector('input[id^="aircraft-"]') : null);
          const id = ac && ac.id ? (ac.id.match(/(\d+)$/)||[])[1] : undefined;
          console.log('[dbg] pointerdown shift', { inBoard, isAc, hasCell: !!cell, sourceId: id, sync: getSyncMode() });
        } catch(_){}
      };
      const onClick = (e)=>{
        try {
          if (!e.shiftKey) return;
          const isAc = !!(e.target && e.target.matches && e.target.matches('#hangarGrid input[id^="aircraft-"], #secondaryHangarGrid input[id^="aircraft-"]'));
          console.log('[dbg] click shift', { isAc, sync: getSyncMode() });
        } catch(_){}
      };
      const onKey = (e)=>{
        try {
          if (!e.shiftKey || e.key!=='Enter') return;
          const isAc = !!(e.target && e.target.matches && e.target.matches('#hangarGrid input[id^="aircraft-"], #secondaryHangarGrid input[id^="aircraft-"]'));
          console.log('[dbg] keydown Shift+Enter', { isAc, sync: getSyncMode() });
        } catch(_){}
      };
      document.addEventListener('pointerdown', onPD, true);
      document.addEventListener('click', onClick, true);
      document.addEventListener('keydown', onKey, true);
      this._installed = true;
      this._handlers = { onPD, onClick, onKey };
      console.log('debugMoveOverlay installed');
    },
    uninstall(){
      try {
        if (!this._installed) return;
        const { onPD, onClick, onKey } = this._handlers || {};
        if (onPD) document.removeEventListener('pointerdown', onPD, true);
        if (onClick) document.removeEventListener('click', onClick, true);
        if (onKey) document.removeEventListener('keydown', onKey, true);
        this._installed = false;
        this._handlers = null;
        console.log('debugMoveOverlay uninstalled');
      } catch(e){ console.warn('uninstall failed', e); }
    }
  };
  try { window.debugMoveOverlay = dbg; console.log('📦 debugMoveOverlay ready'); } catch(_){}
})();