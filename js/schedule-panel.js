(function(){
  // Global Schedule Panel Manager
  const state = {
    entries: [],
    initialized: false,
    lastRenderCount: 0,
  };

  function getCellIds(){
    // Collect primary (1..12) and any secondary (>=101) by scanning DOM
    const ids = new Set();
    // Primary: infer from aircraft inputs present
    document.querySelectorAll('#hangarGrid input[id^="aircraft-"], #secondaryHangarGrid input[id^="aircraft-"]').forEach(el => {
      const m = el.id.match(/^aircraft-(\d+)$/);
      if (m) ids.add(parseInt(m[1], 10));
    });
    // Also include ids from arrival/departure in case aircraft is empty yet
    document.querySelectorAll('#hangarGrid input[id^="arrival-time-"], #hangarGrid input[id^="departure-time-"], #secondaryHangarGrid input[id^="arrival-time-"], #secondaryHangarGrid input[id^="departure-time-"]').forEach(el => {
      const m = el.id.match(/^(?:arrival|departure)-time-(\d+)$/);
      if (m) ids.add(parseInt(m[1], 10));
    });
    return Array.from(ids).sort((a,b)=>a-b);
  }

  function readIsoOrCanonicalize(el){
    if (!el) return '';
    const rawIso = el.dataset && el.dataset.iso ? String(el.dataset.iso).trim() : '';
    if (rawIso) return rawIso;
    const raw = (el.value || '').trim();
    if (!raw) return '';
    try {
      const h = window.helpers || {};
      if (typeof h.isISODateTimeLocal === 'function' && h.isISODateTimeLocal(raw)) return raw;
      if (typeof h.isCompactDateTime === 'function' && h.isCompactDateTime(raw) && typeof h.parseCompactToISOUTC === 'function') return h.parseCompactToISOUTC(raw);
      if (typeof h.isHHmm === 'function' && h.isHHmm(raw) && typeof h.canonicalizeDateTimeFieldValue === 'function') return h.canonicalizeDateTimeFieldValue(el.id, raw);
      return raw; // last resort
    } catch(_e){ return raw; }
  }

  function displayFromIso(iso){
    if (!iso) return '';
    try {
      const h = window.helpers || {};
      if (typeof h.formatISOToCompactUTC === 'function') return h.formatISOToCompactUTC(iso);
    } catch(_e){}
    return iso;
  }

  function collectEntries(){
    const results = [];
    const ids = getCellIds();

    ids.forEach(id => {
      const regEl = document.getElementById(`aircraft-${id}`);
      const reg = (regEl && regEl.value ? regEl.value.trim() : '');
      if (!reg) {
        // Skip tiles with no aircraft id
        return;
      }
      const arrEl = document.getElementById(`arrival-time-${id}`);
      const depEl = document.getElementById(`departure-time-${id}`);

      const arrIso = readIsoOrCanonicalize(arrEl);
      const depIso = readIsoOrCanonicalize(depEl);

      // Only include if any time is provided
      if (!arrIso && !depIso) return;

      results.push({
        cellId: id,
        aircraftId: reg,
        arrivalIso: arrIso,
        departureIso: depIso,
        arrivalDisplay: displayFromIso(arrIso),
        departureDisplay: displayFromIso(depIso),
        sortKey: (arrIso || depIso || ''),
      });
    });

    // Sort by earliest time (arrival first, else departure)
    results.sort((a,b)=>{
      const ax = a.sortKey || '';
      const bx = b.sortKey || '';
      if (ax && bx) return ax.localeCompare(bx);
      if (ax) return -1;
      if (bx) return 1;
      return (a.cellId||0) - (b.cellId||0);
    });

    return results;
  }

  function ensurePanel(){
    return document.getElementById('globalScheduleList');
  }

  function render(entries){
    const host = ensurePanel();
    if (!host) return;

    if (!entries || entries.length === 0){
      host.innerHTML = '<div class="schedule-empty">No scheduled items</div>';
      state.lastRenderCount = 0;
      return;
    }

    const now = new Date();
    const parts = entries.map(e => {
      const timeStr = e.arrivalDisplay || e.departureDisplay || '';
      const badge = e.arrivalDisplay ? 'Arr' : (e.departureDisplay ? 'Dep' : '');
      const pos = document.getElementById(`hangar-position-${e.cellId}`)?.value || document.getElementById(`position-${e.cellId}`)?.value || '';
      const label = pos ? `${pos}` : `#${e.cellId}`;
      return (
        `<div class="sched-row" data-cell-id="${e.cellId}">`+
          `<div class="sched-time"><span class="sched-badge">${badge}</span> ${timeStr}</div>`+
          `<div class="sched-reg">${escapeHtml(e.aircraftId)}</div>`+
          `<div class="sched-tile">${escapeHtml(label)}</div>`+
        `</div>`
      );
    });

    host.innerHTML = parts.join('');
    state.lastRenderCount = entries.length;
  }

  function escapeHtml(s){
    return String(s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
  }

  function refresh(reason){
    try {
      const entries = collectEntries();
      state.entries = entries;
      render(entries);
      // Minimal debug line (can be commented later)
      try { console.log(`📅 Schedule refresh${reason?` (${reason})`:''}: ${entries.length} entries`); } catch(_e){}
    } catch(e){
      try { console.warn('Schedule refresh failed:', e); } catch(_e){}
    }
  }

  function installListeners(){
    if (state.initialized) return;

    const handler = (e) => {
      const id = (e.target && e.target.id) || '';
      if (!id) return;
      if (id.startsWith('aircraft-') || id.startsWith('arrival-time-') || id.startsWith('departure-time-')){
        // Use a short debounce to avoid excessive refreshes while typing
        if (installListeners._t) clearTimeout(installListeners._t);
        installListeners._t = setTimeout(()=>refresh('field-change'), 120);
      }
    };

    document.addEventListener('input', handler, true);
    document.addEventListener('change', handler, true);
    document.addEventListener('blur', handler, true);

    // Periodic refresh: every minute to keep ordering sensible as dates switch
    try {
      if (window.__globalScheduleTimer) clearInterval(window.__globalScheduleTimer);
      window.__globalScheduleTimer = setInterval(()=>refresh('interval'), 60000);
    } catch(_e){}

    // Also refresh after secondary tiles are created
    document.addEventListener('secondaryTilesCreated', ()=> setTimeout(()=>refresh('secondary-added'), 50));

    state.initialized = true;
  }

  function init(){
    installListeners();
    // First paint slightly delayed to allow helpers to transform inputs to compact
    setTimeout(()=> refresh('init'), 200);
  }

  // Defer to hangarInitQueue to align with other initializations
  window.hangarInitQueue = window.hangarInitQueue || [];
  window.hangarInitQueue.push(init);

  // Public API (optional)
  window.GlobalSchedule = {
    refresh,
    collect: collectEntries,
    render,
  };
})();