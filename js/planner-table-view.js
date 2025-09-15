(function(){
  // Planner Table View module
  // Renders a table alternative to the tile grids using existing tile data and enforces the same edit/sync rules.
  
  // Inline table view (now primary). It must run in the main window, not inside an iframe.
  if (window !== window.parent) {
    try { console.warn('planner-table-view.js: not running inside iframes.'); } catch(_){}
    return;
  }

  // Local state
  const STATE = {
    rows: [],      // full set (visible tiles only)
    filtered: [],  // after filtering and sorting
    sort: { col: 'hangarPosition', dir: 'asc' },
    filters: {
      hangarPosition: '',
      aircraftId: '',
      arrivalTime: '',
      departureTime: '',
      positionInfo: '',
      towStatus: '',
      status: '',
      notes: '',
    },
    persistKey: 'plannerTableView.settings.v1'
  };

  // Utils
  function $(sel){ return document.querySelector(sel); }
  function $all(sel){ return Array.from(document.querySelectorAll(sel)); }
  function isMaster(){
    try {
      if (window.serverSync && window.serverSync.isMaster === true) return true;
      if (window.sharingManager && window.sharingManager.isMasterMode === true) return true;
    } catch(e){}
    return false;
  }
  function canReadOnly(){
    try {
      if (window.sharingManager && typeof window.sharingManager.syncMode === 'string') return window.sharingManager.syncMode === 'sync';
      return false;
    } catch(e){ return false; }
  }
  function getVisibleTileRows(){
    try {
      if (!window.collectContainerTileData) return [];
      const prim = window.collectContainerTileData('#hangarGrid') || [];
      const sec = window.collectContainerTileData('#secondaryHangarGrid') || [];
      const both = prim.concat(sec);
      // Only visible tiles: collectContainerTileData already skips hidden ones
      return both.map(row => ({
        tileId: row.tileId,
        hangarPosition: byIdValue(`hangar-position-${row.tileId}`),
        aircraftId: row.aircraftId || '',
        arrivalTime: row.arrivalTime || '',
        departureTime: row.departureTime || '',
        positionInfo: byIdValue(`position-${row.tileId}`),
        towStatus: row.towStatus || 'neutral',
        status: row.status || 'neutral',
        notes: byIdValue(`notes-${row.tileId}`),
      }));
    } catch(e){ return []; }
  }
  function byIdValue(id){ const el = document.getElementById(id); return el ? (el.value || '') : ''; }
  function setIdValue(id, value){ const el = document.getElementById(id); if (!el) return; el.value = value; }
  function deb(fn, ms){ let t=null; return function(){ clearTimeout(t); const args=arguments, self=this; t=setTimeout(()=>fn.apply(self,args), ms||250); } }
  function persist(){
    try {
      const payload = { sort: STATE.sort, filters: STATE.filters };
      localStorage.setItem(STATE.persistKey, JSON.stringify(payload));
    } catch(_){}
  }
  function restore(){
    try {
      const raw = localStorage.getItem(STATE.persistKey);
      if (!raw) return;
      const obj = JSON.parse(raw);
      if (obj && obj.sort) STATE.sort = obj.sort;
      if (obj && obj.filters) STATE.filters = { ...STATE.filters, ...obj.filters };
    } catch(_){}
  }

  // Filtering and sorting
  function applyFilters(){
    const f = STATE.filters;
    const term = s => String(s||'').toLowerCase();
    STATE.filtered = STATE.rows.filter(r =>
      (!f.hangarPosition || term(r.hangarPosition).includes(term(f.hangarPosition))) &&
      (!f.aircraftId || term(r.aircraftId).includes(term(f.aircraftId))) &&
      (!f.arrivalTime || term(r.arrivalTime).includes(term(f.arrivalTime))) &&
      (!f.departureTime || term(r.departureTime).includes(term(f.departureTime))) &&
      (!f.positionInfo || term(r.positionInfo).includes(term(f.positionInfo))) &&
      (!f.towStatus || term(r.towStatus)===term(f.towStatus)) &&
      (!f.status || term(r.status)===term(f.status)) &&
      (!f.notes || term(r.notes).includes(term(f.notes)))
    );
    sortRows();
  }
  function sortRows(){
    const { col, dir } = STATE.sort;
    const sign = dir === 'asc' ? 1 : -1;
    STATE.filtered.sort((a,b)=>{
      let va = a[col], vb = b[col];
      // try numeric compare for tileId, fallback string
      if (col === 'tileId') { va = +va || 0; vb = +vb || 0; }
      else { va = String(va||'').toLowerCase(); vb = String(vb||'').toLowerCase(); }
      if (va < vb) return -1*sign; if (va > vb) return 1*sign; return 0;
    });
  }

  // Rendering
  function render(){
    try {
      const tbody = document.getElementById('plannerTableBody');
      const status = document.getElementById('plannerTableStatus');
      if (!tbody) return;
      tbody.innerHTML = '';
      const ro = canReadOnly();

      STATE.filtered.forEach(row => {
        const tr = document.createElement('tr');
        tr.className = 'planner-row';
        tr.innerHTML = [
          cellInput(`hangar-pos-${row.tileId}`, row.hangarPosition, 'text', ro, 'hangarPosition'),
          cellInput(`ac-${row.tileId}`, row.aircraftId, 'text', ro, 'aircraftId'),
          cellInput(`arr-${row.tileId}`, displayTime(row.arrivalTime), 'text', ro, 'arrivalTime'),
          cellInput(`dep-${row.tileId}`, displayTime(row.departureTime), 'text', ro, 'departureTime'),
          cellInput(`pos-${row.tileId}`, row.positionInfo, 'text', ro, 'positionInfo'),
          cellSelect(`tow-${row.tileId}`, row.towStatus, ro, ['neutral','initiated','ongoing','on-position'], 'towStatus'),
          cellSelect(`stat-${row.tileId}`, row.status, ro, ['neutral','ready','maintenance','aog'], 'status'),
          cellInput(`notes-${row.tileId}`, row.notes, 'text', ro, 'notes')
        ].join('');
        // Attach change handlers for editing
        wireRowEditors(tr, row.tileId, ro);
        tbody.appendChild(tr);
      });

      if (status){
        status.textContent = `${STATE.filtered.length} of ${STATE.rows.length} tiles shown`;
      }

      updateSortIndicators();
    } catch(e){}
  }
  function displayTime(isoOrHHmm){
    if (!isoOrHHmm) return '';
    // Keep as stored; helpers may transform on write; filters accept free text
    return isoOrHHmm;
  }
  function esc(s){ return String(s==null?'':s).replace(/[&<>"]/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c])); }
  function cellInput(id, val, type, ro, col){
    return `<td class="planner-td"><input data-col="${col}" id="${esc(id)}" type="${type}" class="planner-input" ${ro?'disabled':''} value="${esc(val)}"></td>`;
  }
  function cellSelect(id, val, ro, options, col){
    const opts = options.map(o=>`<option value="${esc(o)}" ${String(val)===o?'selected':''}>${esc(o)}</option>`).join('');
    return `<td class="planner-td"><select data-col="${col}" id="${esc(id)}" class="planner-select" ${ro?'disabled':''}>${opts}</select></td>`;
  }

  function updateSortIndicators(){
    const headers = $all('#plannerTable thead .planner-table-header th.sortable');
    headers.forEach(h => {
      const col = h.getAttribute('data-col');
      const indicator = h.querySelector('.sort-indicator');
      if (!indicator) return;
      if (col === STATE.sort.col){ indicator.textContent = STATE.sort.dir === 'asc' ? '↑' : '↓'; h.classList.add('sorted'); }
      else { indicator.textContent = '↕'; h.classList.remove('sorted'); }
    });
  }

  // Wiring edits back to tiles
  function wireRowEditors(tr, tileId, readOnly){
    const handlers = {
      hangarPosition: (v)=>{ setIdValue(`hangar-position-${tileId}`, v); eventFire(`#hangar-position-${tileId}`, 'input'); },
      aircraftId: (v)=>{ setIdValue(`aircraft-${tileId}`, v); blurThenSync(`#aircraft-${tileId}`); },
      arrivalTime: (v)=>{ writeTimeTo(`#arrival-time-${tileId}`, v); },
      departureTime: (v)=>{ writeTimeTo(`#departure-time-${tileId}`, v); },
      positionInfo: (v)=>{ setIdValue(`position-${tileId}`, v); eventFire(`#position-${tileId}`, 'input'); },
      towStatus: (v)=>{ setIdValue(`tow-status-${tileId}`, v); eventFire(`#tow-status-${tileId}`, 'change'); },
      status: (v)=>{ setIdValue(`status-${tileId}`, v); eventFire(`#status-${tileId}`, 'change'); },
      notes: (v)=>{ setIdValue(`notes-${tileId}`, v); eventFire(`#notes-${tileId}`, 'input'); }
    };
    if (readOnly) return; // no wiring when read-only

    tr.querySelectorAll('input.planner-input, select.planner-select').forEach(el => {
      el.addEventListener('change', async function(){ await applyEditorChange(this, handlers); });
      el.addEventListener('blur', async function(){ await applyEditorChange(this, handlers); });
      if (el.tagName === 'INPUT') el.addEventListener('input', deb(function(){ applyEditorChange(el, handlers); }, 400));
    });
  }
  async function applyEditorChange(el, handlers){
    try {
      const col = el.getAttribute('data-col');
      if (!col || !handlers[col]) return;
      const val = el.value;
      handlers[col](val);
      // Master mode: persist via centralized server sync if available
      if (isMaster() && window.serverSync && typeof window.serverSync.syncWithServer === 'function'){
        try { await window.serverSync.syncWithServer(); } catch(_){}
      }
    } catch(e){}
  }
  function writeTimeTo(selector, displayVal){
    const el = document.querySelector(selector);
    if (!el) return;
    el.value = displayVal || '';
    // let helpers convert on blur/change according to app’s logic
    eventFire(selector, 'change');
    eventFire(selector, 'blur');
  }
  function blurThenSync(selector){
    try {
      const el = document.querySelector(selector);
      if (!el) return;
      el.dispatchEvent(new Event('blur', { bubbles: true }));
    } catch(_){}
  }
  function eventFire(selector, type){
    try { const el = document.querySelector(selector); if (!el) return; el.dispatchEvent(new Event(type, { bubbles: true })); } catch(_){}
  }

  // Table header sorting
  function wireSorting(){
    const headers = $all('#plannerTable thead .planner-table-header th.sortable');
    headers.forEach(h => {
      h.addEventListener('click', () => {
        const col = h.getAttribute('data-col');
        if (!col) return;
        if (STATE.sort.col === col){ STATE.sort.dir = (STATE.sort.dir === 'asc') ? 'desc' : 'asc'; }
        else { STATE.sort.col = col; STATE.sort.dir = 'asc'; }
        persist();
        applyFilters();
        render();
      });
    });
  }

  // Filter controls
  function wireFilters(){
    const map = [
      ['flt_hangarPosition','hangarPosition'],
      ['flt_aircraftId','aircraftId'],
      ['flt_arrivalTime','arrivalTime'],
      ['flt_departureTime','departureTime'],
      ['flt_positionInfo','positionInfo'],
      ['flt_towStatus','towStatus'],
      ['flt_status','status'],
      ['flt_notes','notes'],
    ];
    map.forEach(([id, key]) => {
      const el = document.getElementById(id);
      if (!el) return;
      // initialize from restored filters
      if (STATE.filters[key]) el.value = STATE.filters[key];
      const handler = deb(function(){ STATE.filters[key] = el.value || ''; persist(); applyFilters(); render(); }, 200);
      el.addEventListener('input', handler);
      el.addEventListener('change', handler);
    });
  }

  // Toggle interaction with Display toggle
  function applyViewVisibility(){
    try {
      const isTable = document.body.classList.contains('table-view');
      const tablePanel = document.getElementById('panel-planner-table');
      const plannerPanel = document.getElementById('panel-planner');
      if (tablePanel) tablePanel.classList.toggle('hidden', !isTable);
      if (plannerPanel) plannerPanel.classList.toggle('hidden', !!isTable);
      if (isTable) refresh();
    } catch(_){}
  }

  function refresh(){
    STATE.rows = getVisibleTileRows();
    applyFilters();
    render();
  }

  function wireGlobal(){
    // Re-render on tile changes
    document.addEventListener('primaryTilesUpdated', deb(refresh, 50));
    document.addEventListener('secondaryTilesCreated', deb(refresh, 50));
    document.addEventListener('dataLoaded', deb(refresh, 50));
    document.addEventListener('serverDataLoaded', deb(refresh, 50));
    document.addEventListener('syncModeChanged', deb(()=>{ refresh(); }, 50));
    // Also monitor Display toggle effects
    try { const viewToggle = document.getElementById('viewModeToggle'); if (viewToggle) viewToggle.addEventListener('change', deb(applyViewVisibility, 10)); } catch(_){}
    // BFCache/page show
    window.addEventListener('pageshow', deb(()=>{ applyViewVisibility(); }, 0));
  }

  function init(){
    const table = document.getElementById('plannerTable');
    if (!table) return; // not on this page
    restore();
    wireSorting();
    wireFilters();
    wireGlobal();
    // Initial visibility
    applyViewVisibility();
  }

  document.addEventListener('DOMContentLoaded', function(){ setTimeout(init, 0); });
})();
