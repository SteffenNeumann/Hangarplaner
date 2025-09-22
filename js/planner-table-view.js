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

    // Configurable placeholder set to treat as empty for sorting
    // Add any additional tokens you consider placeholders here (e.g., '-', 'N/A')
    const PLACEHOLDER_EMPTY_SET = new Set();

    function isSortEmpty(column, v){
      // Base empty checks
      if (v == null) return true;
      if (typeof v === 'string') {
        const t = v.trim();
        if (t === '') return true;
        if (PLACEHOLDER_EMPTY_SET.has(t)) return true;
        // Treat 'neutral' as empty for status/towStatus
        if ((column === 'status' || column === 'towStatus') && t.toLowerCase() === 'neutral') return true;
      }
      return false;
    }

    STATE.filtered.sort((a,b)=>{
      let va = a[col], vb = b[col];
      const aEmpty = isSortEmpty(col, va);
      const bEmpty = isSortEmpty(col, vb);
      // Empties always at the bottom regardless of direction
      if (aEmpty && !bEmpty) return 1;
      if (!aEmpty && bEmpty) return -1;
      if (aEmpty && bEmpty) return 0;

      // try numeric compare for tileId, fallback string
      if (col === 'tileId') { va = +va || 0; vb = +vb || 0; }
      // Custom sorting for status and tow status to group by status type
      else if (col === 'status') {
        const statusOrder = { 'ready': 1, 'maintenance': 2, 'aog': 3 };
        va = statusOrder[va] !== undefined ? statusOrder[va] : 999;
        vb = statusOrder[vb] !== undefined ? statusOrder[vb] : 999;
      }
      else if (col === 'towStatus') {
        const towOrder = { 'initiated': 1, 'ongoing': 2, 'on-position': 3 };
        va = towOrder[va] !== undefined ? towOrder[va] : 999;
        vb = towOrder[vb] !== undefined ? towOrder[vb] : 999;
      }
      else {
        va = String(va||'').toLowerCase();
        vb = String(vb||'').toLowerCase();
      }
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

      // Toggle read-only class on the planner table panel for styling parity with main view
      try { const panel = document.getElementById('panel-planner-table'); if (panel) panel.classList.toggle('read-only', ro); } catch(_){}

      STATE.filtered.forEach(row => {
        const tr = document.createElement('tr');
        tr.className = 'planner-row';
        tr.innerHTML = [
          cellInput(`hangar-pos-${row.tileId}`, row.hangarPosition, 'text', ro, 'hangarPosition'),
          cellInput(`ac-${row.tileId}`, row.aircraftId, 'text', ro, 'aircraftId'),
          cellDateInput(row.tileId, displayTime(row.arrivalTime), ro, 'arrivalTime'),
          cellDateInput(row.tileId, displayTime(row.departureTime), ro, 'departureTime'),
          cellInput(`pos-${row.tileId}`, row.positionInfo, 'text', ro, 'positionInfo'),
          cellTowStatus(`tow-${row.tileId}`, row.towStatus, ro, 'towStatus'),
          cellSelectWithAmpel(`stat-${row.tileId}`, row.status, ro, [{val: 'neutral', text: ''}, {val: 'ready', text: 'Ready'}, {val: 'maintenance', text: 'MX'}, {val: 'aog', text: 'AOG'}], 'status'),
          cellInput(`notes-${row.tileId}`, row.notes, 'text', ro, 'notes')
        ].join('');
        
        // Attach compact date-time picker behavior to this row's Arr/Dep inputs
        try {
          if (window.helpers && typeof window.helpers.attachCompactDateTimeInputs === 'function') {
            window.helpers.attachCompactDateTimeInputs(tr);
          }
        } catch(_){}
        // Attach change handlers for editing
        wireRowEditors(tr, row.tileId, ro);
        tbody.appendChild(tr);
        
        // Initialize tow status styling
        const towSelect = tr.querySelector('.tow-status-selector');
        if (towSelect) {
          towSelect.setAttribute('data-value', row.towStatus);
        }
        
        // Status select in table view intentionally plain (no chip design)
      });

      if (status){
        status.textContent = `${STATE.filtered.length} of ${STATE.rows.length} tiles shown`;
      }

      updateSortIndicators();
    } catch(e){}
  }
  function displayTime(v){
    if (!v) return '';
    try {
      if (window.helpers && typeof window.helpers.isISODateTimeLocal === 'function' && typeof window.helpers.formatISOToCompactUTC === 'function'){
        if (window.helpers.isISODateTimeLocal(v)) return window.helpers.formatISOToCompactUTC(v);
      }
    } catch(_){}
    // Already compact or HH:mm or free text: show as-is
    return v;
  }
  function esc(s){ return String(s==null?'':s).replace(/[&<>"]/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c])); }
  function cellInput(id, val, type, ro, col){
    return `<td class="planner-td"><input data-col="${col}" id="${esc(id)}" type="${type}" class="planner-input" ${ro?'disabled':''} value="${esc(val)}"></td>`;
  }
  function cellSelect(id, val, ro, options, col){
    const opts = options.map(o=>{
      if (typeof o === 'object' && o !== null && o.val !== undefined) {
        const label = (o.text !== undefined) ? o.text : o.val;
        return `<option value="${esc(o.val)}" ${String(val)===o.val?'selected':''}>${esc(label)}</option>`;
      } else {
        const v = String(o);
        return `<option value="${esc(v)}" ${String(val)===v?'selected':''}>${esc(v)}</option>`;
      }
    }).join('');
    return `<td class=\"planner-td\"><select data-col=\"${col}\" id=\"${esc(id)}\" class=\"planner-select\" ${ro?'disabled':''}>${opts}</select></td>`;
  }
  function cellSelectWithAmpel(id, val, ro, options, col){
    const opts = options.map(o=>{
      if (typeof o === 'object' && o.val !== undefined) {
        const label = (o.text !== undefined) ? o.text : o.val;
        return `<option value="${esc(o.val)}" ${String(val)===o.val?'selected':''}>${esc(label)}</option>`;
      } else {
        const v = String(o);
        return `<option value="${esc(v)}" ${String(val)===v?'selected':''}>${esc(v)}</option>`;
      }
    }).join('');
    const statusLight = `<span class=\"status-light\" data-status=\"${esc(val)}\" aria-label=\"Status: ${esc(val)}\"></span>`;
    return `<td class=\"planner-td\"><div class=\"status-cell\">${statusLight}<select data-col=\"${col}\" id=\"${esc(id)}\" class=\"planner-select status-plain\" ${ro?'disabled':''}>${opts}</select></div></td>`;
  }

  // Specialized date-time cell that uses IDs compatible with the compact picker
  function cellDateInput(tileId, val, ro, col){
    const id = col === 'arrivalTime' ? `arrival-time-table-${tileId}` : `departure-time-table-${tileId}`;
    return `<td class="planner-td"><input data-col="${col}" id="${esc(id)}" type="text" class="planner-input" ${ro?'disabled':''} value="${esc(val)}" placeholder="1230 or dd.mm.yy,HH:MM"></td>`;
  }
  function cellTowStatus(id, val, ro, col){
    const towOptions = {
      'neutral': '',
      'initiated': 'Initiated',
      'ongoing': 'In Progress', 
      'on-position': 'On Position'
    };
    const opts = Object.entries(towOptions).map(([value, text]) => 
      `<option value="${esc(value)}" ${String(val)===value?'selected':''}>${esc(text)}</option>`
    ).join('');
    return `<td class="planner-td"><select data-col="${col}" id="${esc(id)}" class="planner-select tow-status-selector" data-value="${esc(val)}" ${ro?'disabled':''}>${opts}</select></td>`;
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
      towStatus: (v)=>{ 
        setIdValue(`tow-status-${tileId}`, v); 
        eventFire(`#tow-status-${tileId}`, 'change');
        // Update tow status styling in table view with delay to avoid flicker
        setTimeout(() => {
          const towSelect = document.querySelector(`#tow-${tileId}`);
          if (towSelect) {
            towSelect.setAttribute('data-value', v);
          }
        }, 100);
      },
      status: (v)=>{ 
        setIdValue(`status-${tileId}`, v); 
        eventFire(`#status-${tileId}`, 'change');
        // Update status light in table view
        const statusLight = document.querySelector(`#stat-${tileId}`)?.parentNode?.querySelector('.status-light');
        if (statusLight) {
          statusLight.setAttribute('data-status', v);
          statusLight.setAttribute('aria-label', `Status: ${v}`);
        }
        // Table view keeps status select plain; no chip styling applied
      },
      notes: (v)=>{ setIdValue(`notes-${tileId}`, v); eventFire(`#notes-${tileId}`, 'input'); }
    };
    if (readOnly) return; // no wiring when read-only

    // Live normalization for AC-ID while typing (mirror tile behavior)
    try {
      const acInput = tr.querySelector(`#ac-${tileId}`);
      if (acInput && !acInput.__normWired) {
        acInput.addEventListener('input', function(){
          try {
            const raw = this.value || '';
            const clean = raw.replace(/-/g, '').toUpperCase();
            const out = clean.length > 1 ? (clean.charAt(0) + '-' + clean.slice(1)) : clean;
            if (out !== this.value) this.value = out;
          } catch(_){}
        });
        acInput.__normWired = true;
      }
    } catch(_){}

    tr.querySelectorAll('input.planner-input, select.planner-select, select.tow-status-selector, select.status-selector').forEach(el => {
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

  // Sync changelog between tile view and table view
  function syncChangelog(){
    try {
      const tileChangeLogList = document.getElementById('changeLogList');
      const tableChangeLogList = document.getElementById('tableChangeLogList');
      
      if (tileChangeLogList && tableChangeLogList) {
        // Copy content from tile view changelog to table view
        tableChangeLogList.innerHTML = tileChangeLogList.innerHTML;
      }
    } catch(e){}
  }
  
  // Setup changelog handlers for table view
  function setupTableChangelog(){
    try {
      // Clear button for table view
      const clearBtn = document.getElementById('tableChangeLogClearBtn');
      if (clearBtn && !clearBtn.__wired) {
        clearBtn.addEventListener('click', function(){
          try {
            // Clear both tile and table changelogs
            const tileList = document.getElementById('changeLogList');
            const tableList = document.getElementById('tableChangeLogList');
            if (tileList) tileList.innerHTML = '';
            if (tableList) tableList.innerHTML = '';
            
            // Also call the main ChangeLog clear function if available
            if (window.ChangeLog && typeof window.ChangeLog.clear === 'function') {
              window.ChangeLog.clear();
            }
          } catch(e){}
        });
        clearBtn.__wired = true;
      }
      
      // Toggle button for table view  
      const toggleBtn = document.getElementById('tableChangelogToggle');
      if (toggleBtn && !toggleBtn.__wired) {
        toggleBtn.addEventListener('click', function(){
          try {
            const panel = document.getElementById('panel-planner-table');
            if (panel) {
              panel.classList.toggle('changelog-collapsed');
              const expanded = !panel.classList.contains('changelog-collapsed');
              toggleBtn.setAttribute('aria-expanded', expanded.toString());
              toggleBtn.title = expanded ? 'Hide side panel' : 'Show side panel';
            }
          } catch(e){}
        });
        toggleBtn.__wired = true;
      }
    } catch(e){}
  }

  // Toggle interaction with Display toggle
  function applyViewVisibility(){
    try {
      const isTable = document.body.classList.contains('table-view');
      const tablePanel = document.getElementById('panel-planner-table');
      const plannerPanel = document.getElementById('panel-planner');
      if (tablePanel) tablePanel.classList.toggle('hidden', !isTable);
      if (plannerPanel) plannerPanel.classList.toggle('hidden', !!isTable);
      if (isTable) {
        refresh();
        syncChangelog();
        setupTableChangelog();
      }
    } catch(_){}
  }

  function refreshTowStatusStyling(){
    try {
      // Refresh all tow status selectors with their current values
      document.querySelectorAll('.tow-status-selector').forEach(select => {
        const currentValue = select.value;
        select.setAttribute('data-value', currentValue);
      });
    } catch(e){}
  }

  function refresh(){
    STATE.rows = getVisibleTileRows();
    applyFilters();
    render();
    // Refresh tow status styling after render
    setTimeout(refreshTowStatusStyling, 50);
  }

  function wireGlobal(){
    // Re-render on tile changes and server updates
    document.addEventListener('primaryTilesUpdated', deb(refresh, 50));
    document.addEventListener('secondaryTilesCreated', deb(refresh, 50));
    document.addEventListener('dataLoaded', deb(refresh, 50));
    document.addEventListener('serverDataLoaded', deb(refresh, 50));
    document.addEventListener('syncModeChanged', deb(()=>{ refresh(); }, 50));
    
    // Additional listeners for server data updates that might affect tow status styling
    document.addEventListener('serverDataApplied', deb(refreshTowStatusStyling, 100));
    document.addEventListener('tileDataUpdated', deb(refreshTowStatusStyling, 100));
    
    // Simplified mutation observer - only for major DOM changes, not attributes
    const towStatusObserver = new MutationObserver(function(mutations) {
      let needsRefresh = false;
      mutations.forEach(mutation => {
        if (mutation.type === 'childList') {
          // Only refresh on major DOM structure changes, not attribute changes
          needsRefresh = true;
        }
      });
      if (needsRefresh) {
        deb(refreshTowStatusStyling, 200)();
      }
    });
    
    // Observe the table body for changes - only childList to avoid flickering
    const tableBody = document.getElementById('plannerTableBody');
    if (tableBody) {
      towStatusObserver.observe(tableBody, { 
        childList: true, 
        subtree: true
      });
    }
    // Also monitor Display toggle effects
    try { const viewToggle = document.getElementById('viewModeToggle'); if (viewToggle) viewToggle.addEventListener('change', deb(applyViewVisibility, 10)); } catch(_){}
    // BFCache/page show
    window.addEventListener('pageshow', deb(()=>{ applyViewVisibility(); }, 0));
    
    // Continuous changelog synchronization and less frequent tow status styling refresh
    setInterval(() => {
      if (document.body.classList.contains('table-view')) {
        syncChangelog();
      }
    }, 1000); // Sync every second when in table view
    
    // Less frequent tow status refresh to avoid dropdown interference
    setInterval(() => {
      if (document.body.classList.contains('table-view')) {
        // Only refresh if no dropdown is currently open
        const openDropdowns = document.querySelectorAll('.tow-status-selector:focus');
        if (openDropdowns.length === 0) {
          refreshTowStatusStyling();
        }
      }
    }, 5000); // Refresh every 5 seconds and only if no dropdown is active
    
    // Listen for changelog updates
    const observer = new MutationObserver(function(mutations) {
      if (document.body.classList.contains('table-view')) {
        deb(syncChangelog, 100)();
      }
    });
    
    // Observe the main changelog for changes
    const mainChangelog = document.getElementById('changeLogList');
    if (mainChangelog) {
      observer.observe(mainChangelog, { childList: true, subtree: true });
    }
    
    // Add resize functionality to table view changelog
    setupTableChangelogResize();
  }
  
  function setupTableChangelogResize(){
    try {
      const infobox = document.getElementById('infobox-table');
      const panel = document.getElementById('panel-planner-table');
      
      if (!infobox || !panel) return;
      
      let isResizing = false;
      let startX, startWidth;
      const minWidth = 280;
      const maxWidth = 800;
      const STORAGE_KEY = 'planner.infobox.width';
      
      // Restore saved width
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const width = Math.max(minWidth, Math.min(maxWidth, parseInt(saved, 10)));
          panel.style.setProperty('--infobox-width', width + 'px');
        }
      } catch(e) {}
      
      function onLeftEdge(ev){
        const rect = infobox.getBoundingClientRect();
        const x = (ev.touches ? ev.touches[0].clientX : ev.clientX);
        return Math.abs(x - rect.left) <= 6;
      }
      
      function startResize(e) {
        if (!onLeftEdge(e)) return;
        isResizing = true;
        startX = (e.touches ? e.touches[0].clientX : e.clientX);
        startWidth = infobox.offsetWidth;
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        e.preventDefault();
      }
      
      function doResize(e) {
        if (!isResizing) return;
        const x = (e.touches ? e.touches[0].clientX : e.clientX);
        const diff = startX - x;
        const newWidth = Math.max(minWidth, Math.min(maxWidth, startWidth + diff));
        panel.style.setProperty('--infobox-width', newWidth + 'px');
      }
      
      function stopResize() {
        if (!isResizing) return;
        isResizing = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        try {
          const currentWidth = infobox.offsetWidth;
          localStorage.setItem(STORAGE_KEY, currentWidth.toString());
        } catch(e) {}
      }
      
      // Mouse events
      infobox.addEventListener('mousedown', startResize);
      document.addEventListener('mousemove', doResize);
      document.addEventListener('mouseup', stopResize);
      
      // Touch events
      infobox.addEventListener('touchstart', startResize, { passive: false });
      document.addEventListener('touchmove', function(e){ if(isResizing){ e.preventDefault(); doResize(e); } }, { passive: false });
      document.addEventListener('touchend', stopResize);
      
    } catch(e) {}
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
  
  // Expose refresh function globally for external calls
  window.tableViewRefreshTowStatus = refreshTowStatusStyling;
})();
