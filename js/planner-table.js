(function(){
  // Planner Table (iframe) script – pulls data from parent and renders
  const STATE = {
    rows: [],
    filtered: [],
    sort: { col: 'hangarPosition', dir: 'asc' },
    filters: { hangarPosition:'', aircraftId:'', arrivalTime:'', departureTime:'', positionInfo:'', towStatus:'', status:'', notes:'' },
    persistKey: 'plannerTableView.settings.v1'
  };

  function $all(sel){ return Array.from(document.querySelectorAll(sel)); }
  function deb(fn, ms){ let t=null; return function(){ clearTimeout(t); const a=arguments,s=this; t=setTimeout(()=>fn.apply(s,a), ms||200); } }

  function restore(){
    try { const raw = localStorage.getItem(STATE.persistKey); if (!raw) return; const obj = JSON.parse(raw);
      if (obj?.sort) STATE.sort = obj.sort;
      if (obj?.filters) STATE.filters = { ...STATE.filters, ...obj.filters };
    } catch(_){}
  }
  function persist(){
    try { localStorage.setItem(STATE.persistKey, JSON.stringify({ sort: STATE.sort, filters: STATE.filters })); } catch(_){}
  }

  function term(s){ return String(s||'').toLowerCase(); }

  function pullFromParent(){
    try {
      const p = window.parent;
      if (!p || !p.document) {
        console.warn('No parent window or document found');
        return [];
      }
      
      // Use parent.collectContainerTileData
      if (typeof p.collectContainerTileData !== 'function') {
        console.warn('collectContainerTileData function not found in parent');
        return [];
      }
      
      console.log('Pulling data from parent window...');
      const prim = p.collectContainerTileData('#hangarGrid') || [];
      const sec = p.collectContainerTileData('#secondaryHangarGrid') || [];
      const both = prim.concat(sec);
      
      console.log(`Found ${prim.length} primary tiles, ${sec.length} secondary tiles`);
      
      const result = both.map(row => ({
        tileId: row.tileId,
        hangarPosition: byParentIdValue(p, `hangar-position-${row.tileId}`),
        aircraftId: row.aircraftId || '',
        arrivalTime: row.arrivalTime || '',
        departureTime: row.departureTime || '',
        positionInfo: byParentIdValue(p, `position-${row.tileId}`),
        towStatus: row.towStatus || 'neutral',
        status: row.status || 'neutral',
        notes: byParentIdValue(p, `notes-${row.tileId}`)
      }));
      
      console.log(`Mapped ${result.length} tile data objects`);
      return result;
    } catch(error) { 
      console.error('Error pulling data from parent:', error);
      return [];
    }
  }
  function byParentIdValue(p, id){ const el = p.document.getElementById(id); return el ? (el.value||'') : ''; }

  function applyFilters(){
    const f = STATE.filters;
    const rows = STATE.rows.filter(r =>
      (!f.hangarPosition || term(r.hangarPosition).includes(term(f.hangarPosition))) &&
      (!f.aircraftId || term(r.aircraftId).includes(term(f.aircraftId))) &&
      (!f.arrivalTime || term(r.arrivalTime).includes(term(f.arrivalTime))) &&
      (!f.departureTime || term(r.departureTime).includes(term(f.departureTime))) &&
      (!f.positionInfo || term(r.positionInfo).includes(term(f.positionInfo))) &&
      (!f.towStatus || term(r.towStatus)===term(f.towStatus)) &&
      (!f.status || term(r.status)===term(f.status)) &&
      (!f.notes || term(r.notes).includes(term(f.notes)))
    );
    STATE.filtered = rows;
    sortRows();
  }
  function sortRows(){
    const { col, dir } = STATE.sort; const s = dir==='asc'?1:-1;
    STATE.filtered.sort((a,b)=>{ let va=a[col], vb=b[col]; if(col==='tileId'){ va=+va||0; vb=+vb||0; } else { va=term(va); vb=term(vb); } if(va<vb) return -1*s; if(va>vb) return 1*s; return 0; });
  }

  function render(){
    const body = document.getElementById('plannerDbBody');
    const table = document.getElementById('plannerDbTable');
    const loading = document.getElementById('loadingMessage');
    
    if (!body) {
      console.error('plannerDbBody element not found');
      return;
    }
    
    body.innerHTML = '';
    const ro = isReadOnly();

    // Show table, hide loading message
    if (table) table.style.display = '';
    if (loading) loading.style.display = 'none';

    if (STATE.filtered.length === 0) {
      const tr = document.createElement('tr');
      tr.innerHTML = '<td colspan="8" style="text-align: center; padding: 20px; color: #666; font-style: italic;">No aircraft data available. Add aircraft to tiles in the main view.</td>';
      body.appendChild(tr);
    } else {
      let dividerInserted = false;
      STATE.filtered.forEach(row => {
        // Insert divider before first secondary (tileId >= 100)
        if (!dividerInserted && isSecondaryRow(row)){
          const d = document.createElement('tr');
          d.className = 'section-divider-row';
          d.innerHTML = '<td colspan="8">Outer Section</td>';
          body.appendChild(d);
          dividerInserted = true;
        }
        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid #e5e7eb';
        tr.innerHTML = [
          tdInput(`pos-${row.tileId}`, row.hangarPosition, ro, 'hangarPosition'),
          tdInput(`ac-${row.tileId}`, row.aircraftId, ro, 'aircraftId'),
          tdInput(`arr-${row.tileId}`, row.arrivalTime, ro, 'arrivalTime'),
          tdInput(`dep-${row.tileId}`, row.departureTime, ro, 'departureTime'),
          tdInput(`pinfo-${row.tileId}`, row.positionInfo, ro, 'positionInfo'),
          tdSelect(`tow-${row.tileId}`, row.towStatus, ro, ['neutral','initiated','ongoing','on-position'], 'towStatus'),
          tdSelect(`stat-${row.tileId}`, row.status, ro, ['neutral','ready','maintenance','aog'], 'status'),
          tdInput(`notes-${row.tileId}`, row.notes, ro, 'notes')
        ].join('');
        wireEditors(tr, row.tileId, ro);
        body.appendChild(tr);
      });
    }
    
    const st = document.getElementById('plannerDbStatus');
    if (st) st.textContent = `${STATE.filtered.length} of ${STATE.rows.length} tiles shown`;
    updateSortIndicators();
    console.log(`Table rendered with ${STATE.filtered.length} rows`);
  }

  function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;' }[c])); }
  function tdInput(id, val, ro, col){ return `<td><input id="${esc(id)}" data-col="${col}" class="planner-input" ${ro?'disabled':''} value="${esc(val)}"></td>`; }
  function tdSelect(id, val, ro, opts, col){ const o = opts.map(v=>`<option value="${esc(v)}" ${String(val)===v?'selected':''}>${esc(v)}</option>`).join(''); return `<td><select id="${esc(id)}" data-col="${col}" class="planner-select" ${ro?'disabled':''}>${o}</select></td>`; }

  function updateSortIndicators(){
    $all('thead .sortable').forEach(th => {
      const col = th.getAttribute('data-col');
      const ind = th.querySelector('.sort-indicator'); if (!ind) return;
      // reset
      th.classList.remove('sorted','sorted-asc','sorted-desc');
      if (col === STATE.sort.col){
        ind.textContent = STATE.sort.dir==='asc'?'↑':'↓';
        th.classList.add('sorted');
        th.classList.add(STATE.sort.dir==='asc' ? 'sorted-asc' : 'sorted-desc');
      } else {
        ind.textContent = '↕';
      }
    });
  }

  function isReadOnly(){ try { const p = window.parent; if (!p) return false; if (p.sharingManager && typeof p.sharingManager.syncMode==='string') return p.sharingManager.syncMode==='sync'; return false; } catch(_) { return false; }
  }
  }
  function isMaster(){ try { const p=window.parent; if (!p) return false; if (p.serverSync && p.serverSync.isMaster===true) return true; if (p.sharingManager && p.sharingManager.isMasterMode===true) return true; } catch(_){} return false; }
  function isSecondaryRow(row){ try { return parseInt(row.tileId,10) >= 100; } catch(_) { return false; } }

  function fireParent(selector, type){ try { const p=window.parent; const el=p.document.querySelector(selector); if (el) el.dispatchEvent(new Event(type, { bubbles: true })); } catch(_){} }
  function setParent(selector, value){ try { const p=window.parent; const el=p.document.querySelector(selector); if (el) el.value = value; } catch(_){} }

  function wireEditors(tr, tileId, ro){
    if (ro) return;
    const handlers = {
      hangarPosition: v => { setParent(`#hangar-position-${tileId}`, v); fireParent(`#hangar-position-${tileId}`, 'input'); },
      aircraftId: v => { setParent(`#aircraft-${tileId}`, v); fireParent(`#aircraft-${tileId}`, 'blur'); },
      arrivalTime: v => { setParent(`#arrival-time-${tileId}`, v); fireParent(`#arrival-time-${tileId}`, 'change'); fireParent(`#arrival-time-${tileId}`, 'blur'); },
      departureTime: v => { setParent(`#departure-time-${tileId}`, v); fireParent(`#departure-time-${tileId}`, 'change'); fireParent(`#departure-time-${tileId}`, 'blur'); },
      positionInfo: v => { setParent(`#position-${tileId}`, v); fireParent(`#position-${tileId}`, 'input'); },
      towStatus: v => { setParent(`#tow-status-${tileId}`, v); fireParent(`#tow-status-${tileId}`, 'change'); },
      status: v => { setParent(`#status-${tileId}`, v); fireParent(`#status-${tileId}`, 'change'); },
      notes: v => { setParent(`#notes-${tileId}`, v); fireParent(`#notes-${tileId}`, 'input'); }
    };
    // FIX: wire to the classes actually used in the DOM we render (planner-input/planner-select)
    tr.querySelectorAll('input.planner-input, select.planner-select').forEach(el => {
      el.addEventListener('change', async function(){ await applyChange(this, handlers); });
      el.addEventListener('blur', async function(){ await applyChange(this, handlers); });
      if (el.tagName==='INPUT') el.addEventListener('input', deb(function(){ applyChange(el, handlers); }, 350));
    });
  }

  async function applyChange(el, handlers){
    try {
      const col = el.getAttribute('data-col'); if (!col || !handlers[col]) return; const v = el.value; handlers[col](v);
      if (isMaster()){ try { const p=window.parent; if (p.serverSync && typeof p.serverSync.syncWithServer==='function') await p.serverSync.syncWithServer(); } catch(_){} }
    } catch(_){}
  }

  function wireSorting(){
    $all('thead .sortable').forEach(th => {
      th.addEventListener('click', () => {
        const col = th.getAttribute('data-col'); if (!col) return;
        if (STATE.sort.col === col) STATE.sort.dir = STATE.sort.dir==='asc'?'desc':'asc'; else { STATE.sort.col = col; STATE.sort.dir = 'asc'; }
        persist();
        applyFilters();
        render();
      });
    });
  }

  function wireFilters(){
    // No filter row for now
  }

  function refresh(){ 
    console.log('Refreshing table data...');
    STATE.rows = pullFromParent(); 
    applyFilters(); 
    render(); 
  }

  function init(){ 
    console.log('Initializing planner table iframe...');
    
    // Check if we're actually in an iframe
    if (window === window.parent) {
      console.warn('Table view appears to be loaded directly, not in iframe');
      const loading = document.getElementById('loadingMessage');
      if (loading) {
        loading.textContent = 'This table view should be loaded within the main application.';
        loading.style.color = '#dc2626';
      }
      return;
    }
    
    restore(); 
    wireSorting(); 
    wireFilters(); 
    
    // Add a small delay to ensure parent is ready
    setTimeout(refresh, 100);
    // Extra retries to avoid the "broken until hover" symptom
    setTimeout(refresh, 400);
    setTimeout(refresh, 1000);
  }

  window.addEventListener('DOMContentLoaded', init);
  window.addEventListener('message', function(e){ 
    try { 
      if (e && e.data) {
        console.log('Received message:', e.data.type);
        if (e.data.type === 'planner-table-refresh') {
          refresh();
        }
        if (e.data.type === 'theme') {
          document.documentElement.classList.toggle('dark-mode', !!e.data.dark);
          if (document.body) document.body.classList.toggle('dark-mode', !!e.data.dark);
        }
      }
    } catch(error) {
      console.error('Error handling message:', error);
    }
  });
})();
