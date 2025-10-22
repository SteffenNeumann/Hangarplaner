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
    // Multi-level sorting (ranked). Each item: { col, dir: 'asc'|'desc' }
    sorts: [{ col: 'hangarPosition', dir: 'asc' }],
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
      
      // Tag primary (Hangar) tiles
      const primRows = prim.map(row => ({
        tileId: row.tileId,
        section: 'primary',
        hangarPosition: byIdValue(`hangar-position-${row.tileId}`),
        aircraftId: row.aircraftId || '',
        arrivalTime: row.arrivalTime || '',
        departureTime: row.departureTime || '',
        positionInfo: byIdValue(`position-${row.tileId}`),
        towStatus: row.towStatus || 'neutral',
        status: row.status || 'neutral',
        notes: byIdValue(`notes-${row.tileId}`),
      }));
      
      // Tag secondary (Apron) tiles
      const secRows = sec.map(row => ({
        tileId: row.tileId,
        section: 'secondary',
        hangarPosition: byIdValue(`hangar-position-${row.tileId}`),
        aircraftId: row.aircraftId || '',
        arrivalTime: row.arrivalTime || '',
        departureTime: row.departureTime || '',
        positionInfo: byIdValue(`position-${row.tileId}`),
        towStatus: row.towStatus || 'neutral',
        status: row.status || 'neutral',
        notes: byIdValue(`notes-${row.tileId}`),
      }));
      
      // Filter out placeholder positions 8 and 11 only
      const allRows = primRows.concat(secRows);
      return allRows.filter(row => {
        const pos = String(row.hangarPosition || '').trim();
        return pos !== '8' && pos !== '11';
      });
    } catch(e){ return []; }
  }
  function byIdValue(id){ const el = document.getElementById(id); return el ? (el.value || '') : ''; }
  function setIdValue(id, value){ const el = document.getElementById(id); if (!el) return; el.value = value; }
  function deb(fn, ms){ let t=null; return function(){ clearTimeout(t); const args=arguments, self=this; t=setTimeout(()=>fn.apply(self,args), ms||250); } }
  function persist(){
    try {
      const payload = { sorts: STATE.sorts, filters: STATE.filters };
      localStorage.setItem(STATE.persistKey, JSON.stringify(payload));
    } catch(_){}
  }
  function restore(){
    try {
      const raw = localStorage.getItem(STATE.persistKey);
      if (!raw) return;
      const obj = JSON.parse(raw);
      if (obj) {
        // Backward compatibility: migrate single sort -> sorts
        if (obj.sorts && Array.isArray(obj.sorts) && obj.sorts.length) {
          STATE.sorts = obj.sorts;
        } else if (obj.sort && obj.sort.col) {
          STATE.sorts = [{ col: obj.sort.col, dir: obj.sort.dir || 'asc' }];
        }
        if (obj.filters) STATE.filters = { ...STATE.filters, ...obj.filters };
      }
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
    const sorts = Array.isArray(STATE.sorts) && STATE.sorts.length ? STATE.sorts : [{ col: 'hangarPosition', dir: 'asc' }];

    // Configurable placeholder set to treat as empty for sorting
    const PLACEHOLDER_EMPTY_SET = new Set();

    // Parse time values to UTC timestamps for chronological sorting
    function parseTimeToTimestamp(rawValue){
      const h = window.helpers || {};
      if (rawValue == null) return NaN;
      let v = String(rawValue).trim();
      if (!v) return NaN;

      // 4-digit HHMM → HH:mm
      if (/^\d{4}$/.test(v)) {
        const hhmm = v.slice(0,2) + ':' + v.slice(2);
        v = hhmm;
      }

      // ISO local with date: 2025-10-22T09:30
      if (h.isISODateTimeLocal && h.isISODateTimeLocal(v)) {
        // Treat as UTC; append Z if missing zone info
        let isoUTC = v;
        if (!/[Z+-]\d{2}:?\d{2}$/.test(isoUTC)) isoUTC += 'Z';
        const t = Date.parse(isoUTC);
        return Number.isFinite(t) ? t : NaN;
      }

      // Compact with date: dd.mm.yy,HH:MM
      if (h.isCompactDateTime && h.isCompactDateTime(v)) {
        const isoUTC = h.parseCompactToISOUTC ? h.parseCompactToISOUTC(v) : null;
        if (isoUTC) {
          // Append Z if missing zone
          const iso = !/[Z+-]\d{2}:?\d{2}$/.test(isoUTC) ? isoUTC + 'Z' : isoUTC;
          const t = Date.parse(iso);
          return Number.isFinite(t) ? t : NaN;
        }
        return NaN;
      }

      // Time-only HH:mm → use current date as base (simple fallback)
      if (/^\d{1,2}:\d{2}$/.test(v)) {
        // Use helpers base date logic if available
        const bases = h.getBaseDates ? h.getBaseDates() : {};
        const baseDate = bases.arrivalBase || new Date().toISOString().slice(0,10);
        if (/^\d{4}-\d{2}-\d{2}$/.test(baseDate)) {
          const [hh, mm] = v.split(':');
          const isoUTC = `${baseDate}T${hh.padStart(2,'0')}:${mm}Z`;
          const t = Date.parse(isoUTC);
          return Number.isFinite(t) ? t : NaN;
        }
        return NaN;
      }

      // Fallback: try direct parse
      const t = Date.parse(v);
      return Number.isFinite(t) ? t : NaN;
    }

    function isSortEmpty(column, v){
      if (v == null) return true;
      // Treat NaN as empty for time columns
      if (Number.isNaN(v)) return true;
      if (typeof v === 'string') {
        const t = v.trim();
        if (t === '') return true;
        if (PLACEHOLDER_EMPTY_SET.has(t)) return true;
        if ((column === 'status' || column === 'towStatus') && t.toLowerCase() === 'neutral') return true;
      }
      return false;
    }

    function projectValue(column, v){
      // Normalize per-column for comparison
      if (column === 'tileId') return +v || 0;
      if (column === 'status') {
        const order = { 'ready': 1, 'maintenance': 2, 'aog': 3 };
        return order[v] !== undefined ? order[v] : 999;
      }
      if (column === 'towStatus') {
        const order = { 'initiated': 1, 'ongoing': 2, 'on-position': 3 };
        return order[v] !== undefined ? order[v] : 999;
      }
      // Time columns: parse to numeric timestamp for chronological sorting
      if (column === 'arrivalTime' || column === 'departureTime') {
        return parseTimeToTimestamp(v);
      }
      return String(v||'').toLowerCase();
    }

    // Section-aware sorting: Hangar (primary) always on top, Apron (secondary) below
    // Within each section, apply multi-level sorting
    STATE.filtered.sort((a,b)=>{
      // Enforce section grouping first: primary < secondary
      const aSec = (a.section === 'secondary') ? 1 : 0;
      const bSec = (b.section === 'secondary') ? 1 : 0;
      if (aSec !== bSec) return aSec - bSec; // Hangar before Apron
      
      // Within same section, apply sorting
      for (let i=0;i<sorts.length;i++){
        const { col, dir } = sorts[i];
        const sign = dir === 'asc' ? 1 : -1;
        const vaRaw = a[col], vbRaw = b[col];
        const aEmpty = isSortEmpty(col, vaRaw);
        const bEmpty = isSortEmpty(col, vbRaw);
        if (aEmpty !== bEmpty) return aEmpty ? 1 : -1; // empties bottom
        if (aEmpty && bEmpty) continue; // equal for this key
        const va = projectValue(col, vaRaw);
        const vb = projectValue(col, vbRaw);
        if (va < vb) return -1*sign;
        if (va > vb) return 1*sign;
      }
      return 0;
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

      // Determine column count for divider colspan
      const table = document.getElementById('plannerTable');
      const colCount = table ? table.querySelectorAll('thead th').length : 8;
      
      // Check if we have any secondary (Apron) rows
      const hasSecondary = STATE.filtered.some(r => r.section === 'secondary');
      let dividerInserted = false;

      STATE.filtered.forEach(row => {
        // Insert divider before the first secondary row
        if (!dividerInserted && hasSecondary && row.section === 'secondary') {
          const trDiv = document.createElement('tr');
          trDiv.className = 'section-divider';
          trDiv.setAttribute('aria-hidden', 'true');
          
          const td = document.createElement('td');
          td.colSpan = colCount;
          td.innerHTML = '<div class="divider-line"><span class="divider-badge">APRON</span></div>';
          
          trDiv.appendChild(td);
          tbody.appendChild(trDiv);
          dividerInserted = true;
        }
        
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
          cellInput(`notes-table-${row.tileId}`, row.notes, 'text', ro, 'notes')
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
      // Ensure tow alert dots are updated for new rows
      try { setTimeout(updateTowAlertDots, 0); } catch(_){ }
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
    const cls = `planner-select tow-status-selector tow-${esc(val || 'neutral')}`;
    // Wrap dot + select in a flex container centered as a group. Dot is always visible for alignment; alert state is styled via classes.
    return `<td class="planner-td"><div class="tow-cell"><span class="tow-dot neutral" aria-hidden="true" style="display:inline-block"></span><select data-col="${col}" id="${esc(id)}" class="${cls}" data-value="${esc(val)}" ${ro?'disabled':''}>${opts}</select></div></td>`;
  }

  function updateSortIndicators(){
    const headers = $all('#plannerTable thead .planner-table-header th.sortable');
    const tip = 'Click to sort; Shift+Click to add as secondary/tertiary level. Click without Shift to reset.';
    headers.forEach(h => {
      const col = h.getAttribute('data-col');
      let indicator = h.querySelector('.sort-indicator');
      if (!indicator) return;
      // Ensure a small numeric badge exists
      let rankBadge = h.querySelector('.sort-rank');
      if (!rankBadge) {
        rankBadge = document.createElement('span');
        rankBadge.className = 'sort-rank';
        h.appendChild(rankBadge);
      }
      const idx = (STATE.sorts || []).findIndex(s => s.col === col);
      // Tooltip on header
      if (!h.getAttribute('title')) h.setAttribute('title', tip);
      if (idx >= 0) {
        const s = STATE.sorts[idx];
        // Arrow only for primary (rank 1), neutral for others
        indicator.textContent = idx === 0 ? (s.dir === 'asc' ? '↑' : '↓') : '↕';
        h.classList.add('sorted');
        const rankText = String(idx+1);
        rankBadge.textContent = rankText;
        rankBadge.style.display = 'inline-block';
        rankBadge.setAttribute('title', `Sort level ${rankText}. ${tip}`);
        rankBadge.setAttribute('aria-label', `Sort level ${rankText}`);
      } else {
        indicator.textContent = '↕';
        h.classList.remove('sorted');
        rankBadge.textContent = '';
        rankBadge.style.display = 'none';
        rankBadge.removeAttribute('title');
        rankBadge.removeAttribute('aria-label');
      }
    });
  }

  // Wiring edits back to tiles
  function wireRowEditors(tr, tileId, readOnly){
    // Tooltip + right-click move for AC input
    try {
      const acInput = tr.querySelector(`#ac-${tileId}`);
      if (acInput) {
if (!acInput.getAttribute('title')) acInput.setAttribute('title', 'Shift+Click to move content to another hangar position');
        if (!acInput.__ctxWired) {
          acInput.addEventListener('click', function(e){
            try {
              if (!e.shiftKey) return; // only Shift+Click
              e.preventDefault();
              const val = (acInput.value||'').trim();
              if (!val) { try { window.showNotification && window.showNotification('No Aircraft ID in this row', 'warning'); } catch(_){} return; }
              const sourceId = tileId;
              const free = (window.getFreeTilesWithLabels ? window.getFreeTilesWithLabels() : []).filter(t => t && t.id !== sourceId);
              if (!free.length) { try { window.showNotification && window.showNotification('No free tiles available', 'info'); } catch(_){} return; }
              if (typeof window.openTileSelectionOverlay === 'function') {
                window.openTileSelectionOverlay({ tiles: free, onSelect: (destId)=> { try { window.moveTileContent && window.moveTileContent(sourceId, destId); } catch(_){} } });
              }
            } catch(_){}
          });
          acInput.__ctxWired = true;
        }
      }
    } catch(_){}
    const handlers = {
      // Fire 'input' for live UI feedback and 'change' so ChangeLog (which listens for 'change') records edits
      hangarPosition: (v)=>{ 
        setIdValue(`hangar-position-${tileId}`, v); 
        eventFire(`#hangar-position-${tileId}`, 'input'); 
        eventFire(`#hangar-position-${tileId}`, 'change'); 
      },
      aircraftId: (v)=>{ 
        setIdValue(`aircraft-${tileId}`, v); 
        // Ensure ChangeLog picks this up even if the main view input is hidden
        eventFire(`#aircraft-${tileId}`, 'change');
        blurThenSync(`#aircraft-${tileId}`); 
      },
      arrivalTime: (v)=>{ writeTimeTo(`#arrival-time-${tileId}`, v); },
      departureTime: (v)=>{ writeTimeTo(`#departure-time-${tileId}`, v); },
      positionInfo: (v)=>{ 
        setIdValue(`position-${tileId}`, v); 
        eventFire(`#position-${tileId}`, 'input'); 
        eventFire(`#position-${tileId}`, 'change'); 
      },
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
      notes: (v)=>{ 
        setIdValue(`notes-${tileId}`, v); 
        // Fire same pattern as Board: change then blur to trigger immediate flush by Event Manager
        eventFire(`#notes-${tileId}`, 'change'); 
        blurThenSync(`#notes-${tileId}`);
        // Additionally call the Event Manager flush path directly to ensure immediate server write even if the Board field is hidden
        try {
          if (window.hangarEventManager && typeof window.hangarEventManager.debouncedFieldUpdate === 'function'){
            window.hangarEventManager.debouncedFieldUpdate(`notes-${tileId}`, v, 150, { flushDelayMs: 0, source: 'blur' });
          }
        } catch(_e){}
      }
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

  function parseTileIdFromControlId(id){
    if (!id) return NaN;
    // ids like: hangar-pos-12, ac-12, arrival-time-table-12, departure-time-table-12, pos-12, tow-12, stat-12, notes-12
    const m = String(id).match(/(.*?)(\d+)$/);
    return m ? parseInt(m[2], 10) : NaN;
  }

  function updateTowSelectChipClasses(selectEl, val){
    if (!selectEl) return;
    const v = (val||'').trim() || 'neutral';
    selectEl.classList.remove('tow-neutral','tow-initiated','tow-ongoing','tow-on-position');
    selectEl.classList.add(`tow-${v}`);
    try { selectEl.setAttribute('data-value', v); } catch(_){ }
  }

  function updateRowCache(tileId, col, val){
    if (!isFinite(tileId)) return;
    const applyTo = (row)=>{ if (!row) return; if (col in row) row[col] = val; };
    const r1 = STATE.rows.find(r => +r.tileId === +tileId);
    const r2 = STATE.filtered.find(r => +r.tileId === +tileId);
    applyTo(r1); applyTo(r2);
  }

  async function applyEditorChange(el, handlers){
    try {
      const col = el.getAttribute('data-col');
      if (!col || !handlers[col]) return;
      const val = el.value;
      const tileId = parseTileIdFromControlId(el.id);
      handlers[col](val);
      // keep table model in sync so sort/render after click doesn’t drop edits
      if (isFinite(tileId)) updateRowCache(tileId, col, val);
      if (col === 'towStatus') { updateTowSelectChipClasses(el, val); try { updateTowAlertDots(); } catch(_){} }
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
      h.addEventListener('click', (ev) => {
        const col = h.getAttribute('data-col');
        if (!col) return;
        let sorts = Array.isArray(STATE.sorts) ? [...STATE.sorts] : [];
        const idx = sorts.findIndex(s => s.col === col);
        if (ev && ev.shiftKey) {
          // Multi-sort: toggle or add, cap at 3
          if (idx >= 0) {
            sorts[idx] = { col, dir: (sorts[idx].dir === 'asc') ? 'desc' : 'asc' };
          } else {
            if (sorts.length >= 3) sorts.pop();
            sorts.push({ col, dir: 'asc' });
          }
        } else {
          // Single sort
          if (idx === 0 && sorts.length === 1) {
            sorts = [{ col, dir: (sorts[0].dir === 'asc') ? 'desc' : 'asc' }];
          } else {
            sorts = [{ col, dir: 'asc' }];
          }
        }
        STATE.sorts = sorts;
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
  
  // Map ChangeLog field prefixes to table-view input/select IDs
  function mapPrefixToTableId(prefix, tileId){
    try {
      const id = parseInt(tileId, 10);
      if (!isFinite(id)) return '';
      switch (String(prefix)){
        case 'aircraft': return `ac-${id}`;
        case 'hangar-position': return `hangar-pos-${id}`;
        case 'arrival-time': return `arrival-time-table-${id}`;
        case 'departure-time': return `departure-time-table-${id}`;
        case 'position': return `pos-${id}`;
        case 'status': return `stat-${id}`;
        case 'tow-status': return `tow-${id}`;
        case 'notes': return `notes-table-${id}`;
        default: return '';
      }
    } catch(_) { return ''; }
  }
  
  function focusAndHighlight(el){
    try {
      if (!el) return;
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // For dropdowns, don't focus (blur after highlighting to remove focus styling)
      const isDropdown = el.tagName === 'SELECT';
      if (!isDropdown) {
        try { el.focus({ preventScroll: true }); } catch(_){ try { el.focus(); } catch(__){} }
      }
      // Clear any existing highlight timeout for this element
      if (el.__highlightTimer) { clearTimeout(el.__highlightTimer); el.__highlightTimer = null; }
      // Store original outline (only if not already storing one)
      if (!el.__originalOutline) { el.__originalOutline = el.style.outline || ''; }
      // Apply highlight
      el.style.outline = '2px solid #ff7043';
      // Remove highlight after delay and restore original
      el.__highlightTimer = setTimeout(()=>{ 
        try { 
          el.style.outline = el.__originalOutline || ''; 
          el.style.removeProperty('outline'); // Ensure CSS rules re-apply
          delete el.__originalOutline;
          delete el.__highlightTimer;
          // Force blur for dropdowns to remove focus styling
          if (isDropdown) el.blur();
        } catch(_){} 
      }, 1500);
    } catch(_){}
  }
  
  function wireTableChangeLogLinkDelegation(){
    try {
      const container = document.getElementById('tableChangeLogList');
      if (!container || container.__linksWired) return;
      container.addEventListener('click', function(e){
        try {
          const a = e.target && (e.target.closest ? e.target.closest('a') : null);
          if (!a) return;
          const id = a.id || '';
          if (!/^goTo_/.test(id)) return; // not a changelog link we know
          // Intercept fully so no other handlers can toggle views
          try { e.preventDefault(); } catch(_){}
          try { e.stopPropagation(); } catch(_){}
          try { if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation(); } catch(_){}
          // Only act when in table-view; tile view has its own wiring
          if (!document.body.classList.contains('table-view')) return;
          // goTo_[...optional...]_<cellId>_<prefix>
          const parts = id.split('_');
          if (parts.length < 3) return;
          const prefix = parts.pop();
          const cellId = parseInt(parts.pop(), 10);
          if (!isFinite(cellId)) return;
          const tableId = mapPrefixToTableId(prefix, cellId);
          if (!tableId) return;
          const target = document.getElementById(tableId);
          if (target) {
            focusAndHighlight(target);
          } else {
            // If filtered out or not rendered, do nothing (stay on view)
          }
        } catch(_){}
      });
      container.__linksWired = true;
    } catch(_){}
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
        const STORAGE_KEY = 'planner.infobox.width';
        toggleBtn.addEventListener('click', function(){
          try {
            const panel = document.getElementById('panel-planner-table');
            const infobox = document.getElementById('infobox-table');
            if (!panel || !infobox) return;
            const willCollapse = !panel.classList.contains('changelog-collapsed');
            if (willCollapse) {
              // Save current width, then collapse by overriding inline var to ensure priority over saved width
              try {
                const currentWidth = infobox.offsetWidth;
                panel.__prevInfoboxWidth = currentWidth;
                localStorage.setItem(STORAGE_KEY, String(currentWidth));
              } catch(_){}
              panel.classList.add('changelog-collapsed');
              panel.style.setProperty('--infobox-width', '18px');
              toggleBtn.setAttribute('aria-expanded', 'false');
              toggleBtn.title = 'Show side panel';
            } else {
              panel.classList.remove('changelog-collapsed');
              let restoreWidth = panel.__prevInfoboxWidth;
              if (!restoreWidth || !isFinite(restoreWidth)) {
                try {
                  const saved = parseInt(localStorage.getItem(STORAGE_KEY)||'', 10);
                  if (isFinite(saved)) restoreWidth = saved;
                } catch(_){}
              }
              if (!restoreWidth || !isFinite(restoreWidth)) restoreWidth = 340;
              panel.style.setProperty('--infobox-width', restoreWidth + 'px');
              toggleBtn.setAttribute('aria-expanded', 'true');
              toggleBtn.title = 'Hide side panel';
            }
          } catch(e){}
        });
        toggleBtn.__wired = true;
      }

      // Delegated link handling for copied Change Log items (robust to innerHTML resets)
      wireTableChangeLogLinkDelegation();
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
        // also refresh tow alert dots when entering table view
        setTimeout(updateTowAlertDots, 0);
      }
    } catch(_){}
  }

  function refreshTowStatusStyling(){
    try {
      // Refresh all tow status selectors with their current values and chip classes
      document.querySelectorAll('.tow-status-selector').forEach(select => {
        const currentValue = select.value;
        select.setAttribute('data-value', currentValue);
        updateTowSelectChipClasses(select, currentValue);
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
    // A move triggers tileDataUpdated; refresh table rows and styling immediately
    document.addEventListener('tileDataUpdated', deb(()=>{ refresh(); refreshTowStatusStyling(); syncChangelog(); }, 25));
    
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

    // Update Tow alert dots roughly every minute when in table view
    setInterval(() => {
      if (document.body.classList.contains('table-view')) {
        updateTowAlertDots();
      }
    }, 60000);
    
    // Listen for changelog updates
    let mainLogObserver = null;
    const ensureMainLogObserver = () => {
      try {
        const mainChangelogNow = document.getElementById('changeLogList');
        if (mainChangelogNow && !mainLogObserver) {
          mainLogObserver = new MutationObserver(function(){
            if (document.body.classList.contains('table-view')) {
              deb(syncChangelog, 100)();
            }
          });
          mainLogObserver.observe(mainChangelogNow, { childList: true, subtree: true });
          // Immediate sync on attach
          deb(syncChangelog, 0)();
        }
      } catch(_){}
    };

    // Try now and again shortly after load in case elements are created late
    ensureMainLogObserver();
    setTimeout(ensureMainLogObserver, 300);
    setTimeout(ensureMainLogObserver, 1200);

    // Boot-time syncs to cover race conditions (run regardless of current view)
    setTimeout(syncChangelog, 0);
    setTimeout(syncChangelog, 400);
    setTimeout(syncChangelog, 1500);

    // Ensure table changelog UI is wired even if we started in board view
    setupTableChangelogResize();
    setupTableChangelog();
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

  // Tow alert indicator logic (pulsing dot) — parity with Board
  function readTowingReminderConfig(){
    try {
      const raw = localStorage.getItem('towingReminder');
      if (!raw) return { minutes: 15, active: false };
      const obj = JSON.parse(raw);
      const minutes = Math.max(1, parseInt(obj.minutes||15,10)||15);
      const active = !!obj.active;
      return { minutes, active };
    } catch(_) { return { minutes: 15, active: false }; }
  }
  function getDepartureIso(tileId){
    try {
      const el = document.getElementById(`departure-time-${tileId}`);
      if (!el) return '';
      const raw = (el.dataset && el.dataset.iso) ? el.dataset.iso : (el.value || '').trim();
      if (raw && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(raw)) return raw;
      if (window.helpers && typeof window.helpers.canonicalizeDateTimeFieldValue === 'function'){
        const iso = window.helpers.canonicalizeDateTimeFieldValue(`departure-time-${tileId}`, raw);
        if (iso && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(iso)) return iso;
      }
      return '';
    } catch(_) { return ''; }
  }
  function isoToMs(iso){
    if (!iso) return NaN;
    try {
      const [d,t] = iso.split('T');
      const [y,m,dd] = d.split('-').map(Number);
      const [hh,mm] = t.split(':').map(Number);
      return Date.UTC(y, (m||1)-1, dd||1, hh||0, mm||0, 0, 0);
    } catch(_) { return NaN; }
  }
  function ensureTowDotInContainer(selectEl, isAlert){
    if (!selectEl) return;
    const container = selectEl.closest('.tow-cell');
    if (!container) return;
    let dot = container.querySelector('.tow-dot');
    if (!dot) {
      dot = document.createElement('span');
      dot.className = 'tow-dot neutral';
      dot.title = 'Tow reminder';
      dot.setAttribute('aria-hidden', 'true');
      container.insertBefore(dot, container.firstChild);
    }
    // Always keep dot visible for alignment; toggle alert styling via class
    dot.style.display = 'inline-block';
    dot.classList.remove('alert','neutral');
    dot.classList.add(isAlert ? 'alert' : 'neutral');
  }
  function updateTowAlertDots(){
    try {
      const cfg = readTowingReminderConfig();
      const cutoffMs = Date.now() + (cfg.minutes||15)*60000;
      document.querySelectorAll('#plannerTable select.tow-status-selector').forEach(select => {
        const tileId = parseTileIdFromControlId(select.id);
        const towVal = (select.value||'').trim();
        if (!isFinite(tileId)) return;
        const iso = getDepartureIso(tileId);
        const depMs = isoToMs(iso);
        const eligible = (towVal === 'on-position') && isFinite(depMs) && depMs <= cutoffMs;
        // Remove any stray dot placed after the select from older logic
        try {
          const sib = select.nextElementSibling;
          if (sib && sib.classList && sib.classList.contains('tow-dot')) sib.remove();
        } catch(_){ }
        const showAlert = !!cfg.active && !!eligible;
        ensureTowDotInContainer(select, showAlert);
      });
    } catch(_){}
  }

document.addEventListener('DOMContentLoaded', function(){ setTimeout(init, 0); });

  // Delegated capture-phase Shift+Click and Shift+Enter to open selection overlay in table view (theme-independent)
  try {
    const delegatedTablePointer = (e) => {
      try {
        if (!e || !e.shiftKey) return;
        // Block in read-only (Sync) mode
        try { if (window.sharingManager && window.sharingManager.syncMode === 'sync') { return; } } catch(_){ }
        let ac = (e.target && e.target.closest) ? e.target.closest('#plannerTable input[id^="ac-"]') : null;
        if (!ac && e.target && e.target.closest) {
          const row = e.target.closest('#plannerTable tbody tr');
          if (row) ac = row.querySelector('input[id^="ac-"]');
        }
        if (!ac) return;
        // Ensure tooltip label for clarity
        try { if (!ac.getAttribute('title')) ac.setAttribute('title', 'Shift+Click to move content to another hangar position'); } catch(_){ }
        e.preventDefault();
        e.stopPropagation();
        const m = (ac.id||'').match(/ac-(\d+)$/);
        const sourceId = m ? parseInt(m[1], 10) : NaN;
        if (!isFinite(sourceId)) return;
        const val = (ac.value||'').trim();
        if (!val) { try { window.showNotification && window.showNotification('No Aircraft ID in this row', 'warning'); } catch(_){} return; }
        const free = (window.getFreeTilesWithLabels ? window.getFreeTilesWithLabels() : []).filter(t => t && t.id !== sourceId);
        if (!free.length) { try { window.showNotification && window.showNotification('No free tiles available', 'info'); } catch(_){} return; }
        if (typeof window.openTileSelectionOverlay === 'function') {
          window.openTileSelectionOverlay({ tiles: free, onSelect: (destId)=> { try { window.moveTileContent && window.moveTileContent(sourceId, destId); } catch(_){} } });
        }
      } catch(_){ }
    };
    document.addEventListener('pointerdown', delegatedTablePointer, true);

    const delegatedTableShiftEnter = (e) => {
      try {
        if (!e || !e.shiftKey || e.key !== 'Enter') return;
        // Block in read-only (Sync) mode
        try { if (window.sharingManager && window.sharingManager.syncMode === 'sync') { return; } } catch(_){ }
        const ac = (e.target && e.target.matches) ? (e.target.matches('#plannerTable input[id^="ac-"]') ? e.target : null) : null;
        if (!ac) return;
        try { if (!ac.getAttribute('title')) ac.setAttribute('title', 'Shift+Click to move content to another hangar position'); } catch(_){ }
        e.preventDefault();
        const m = (ac.id||'').match(/ac-(\d+)$/);
        const sourceId = m ? parseInt(m[1], 10) : NaN;
        if (!isFinite(sourceId)) return;
        const val = (ac.value||'').trim();
        if (!val) { try { window.showNotification && window.showNotification('No Aircraft ID in this row', 'warning'); } catch(_){} return; }
        const free = (window.getFreeTilesWithLabels ? window.getFreeTilesWithLabels() : []).filter(t => t && t.id !== sourceId);
        if (!free.length) { try { window.showNotification && window.showNotification('No free tiles available', 'info'); } catch(_){} return; }
        if (typeof window.openTileSelectionOverlay === 'function') {
          window.openTileSelectionOverlay({ tiles: free, onSelect: (destId)=> { try { window.moveTileContent && window.moveTileContent(sourceId, destId); } catch(_){} } });
        }
      } catch(_){ }
    };
    document.addEventListener('keydown', delegatedTableShiftEnter, true);
  } catch(_){ }
  
  // Expose refresh function globally for external calls
  window.tableViewRefreshTowStatus = refreshTowStatusStyling;
})();
