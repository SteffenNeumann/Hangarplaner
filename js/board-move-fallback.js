(function(){
  try {
    if (window.__boardMoveFallbackInstalled) return; window.__boardMoveFallbackInstalled = true;
    function isReadOnly(){ try { return (window.sharingManager && window.sharingManager.syncMode === 'sync'); } catch(_) { return false; } }
    function findAircraftInputFromTarget(t){
      try {
        if (!t) return null;
        if (t.matches && t.matches('#hangarGrid input[id^="aircraft-"], #secondaryHangarGrid input[id^="aircraft-"]')) return t;
        const cell = t.closest ? t.closest('#hangarGrid .hangar-cell, #secondaryHangarGrid .hangar-cell') : null;
        return cell ? (cell.querySelector('input[id^="aircraft-"]') || null) : null;
      } catch(_) { return null; }
    }
    function setTooltips(){
      try {
        document.querySelectorAll('#hangarGrid input[id^="aircraft-"], #secondaryHangarGrid input[id^="aircraft-"]').forEach(inp => {
          try { if (!inp.getAttribute('title')) inp.setAttribute('title', 'Shift+Click to move content to another hangar position'); } catch(_){}
        });
      } catch(_){}
    }
    function onPointerDown(e){
      try {
        if (!e || !e.shiftKey) return;
        if (e.defaultPrevented) return; // event manager already handled
        if (isReadOnly()) return;
        const ac = findAircraftInputFromTarget(e.target);
        if (!ac) return;
        const m = (ac.id||'').match(/aircraft-(\d+)$/); const sourceId = m?parseInt(m[1],10):NaN; if (!isFinite(sourceId)) return;
        const val = (ac.value||'').trim(); if (!val){ try { window.showNotification && window.showNotification('No Aircraft ID in this tile', 'warning'); } catch(_){} return; }
        const free = (window.getFreeTilesWithLabels ? (window.getFreeTilesWithLabels()||[]) : []).filter(t => t && t.id !== sourceId);
        if (!free.length){ try { window.showNotification && window.showNotification('No free tiles available', 'info'); } catch(_){} return; }
        if (typeof window.openTileSelectionOverlay === 'function'){
          window.openTileSelectionOverlay({ tiles: free, onSelect: (destId)=>{ try { window.moveTileContent && window.moveTileContent(sourceId, destId); } catch(_){} } });
          e.preventDefault(); e.stopPropagation();
        }
      } catch(_){}
    }
    // Initial tooltip pass and dynamic updates
    if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', setTooltips, { once:true }); } else { setTooltips(); }
    document.addEventListener('secondaryTilesCreated', function(){ setTimeout(setTooltips, 50); }, { once:false });
    // Delegated capture-phase fallback for Shift+Click
    document.addEventListener('pointerdown', onPointerDown, true);
    console.log('Board move fallback installed');
  } catch(e){ try { console.warn('Board move fallback failed to install', e); } catch(_){} }
})();