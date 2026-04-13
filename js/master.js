function renderMaster(container) {
  const its = items();
  const allDepts = depts();
  // Show import banner after render (async so container is in DOM)
  setTimeout(() => maybeShowImportBanner(container), 0);

  // Analytics — use computed functions, never stored total_needed/deficit
  const totalNeeded = its.reduce((s,i) => s+itemTotal(i), 0);
  const needProcurement = its.filter(i => itemDeficit(i) > 0);
  const totalDeficit = needProcurement.reduce((s,i) => s+itemDeficit(i), 0);
  // Dept with most demand
  const deptDemand = allDepts.map(([n]) => ({ name:n, total: getDeptTotal(n) })).sort((a,b)=>b.total-a.total);
  const topDept = deptDemand[0];

  let html = `
    <div class="inv-stats-row">
      <div class="inv-stat-card" style="--c:var(--champ-color)">
        <div class="stat-label">Total Items Requested</div>
        <div class="stat-value">${totalNeeded.toLocaleString()}</div>
        <div class="stat-sub">${its.length} unique item types</div>
      </div>
      <div class="inv-stat-card" style="--c:var(--danger);cursor:pointer" onclick="showProcurementModal()" title="Click to see items needing procurement">
        <div class="stat-label">Needs Procurement <span style="font-size:10px;opacity:0.6">▶ view list</span></div>
        <div class="stat-value">${needProcurement.length}</div>
        <div class="stat-sub">${totalDeficit} units total deficit</div>
      </div>
      <div class="inv-stat-card" style="--c:var(--warning)">
        <div class="stat-label">Highest Demand Dept</div>
        <div class="stat-value" style="font-size:16px;padding-top:4px">${topDept ? esc(topDept.name.substring(0,22)) : '—'}</div>
        <div class="stat-sub">${topDept ? topDept.total+' items' : ''}</div>
      </div>
      <div class="inv-stat-card" style="--c:var(--success)">
        <div class="stat-label">Departments</div>
        <div class="stat-value">${allDepts.length}</div>
        <div class="stat-sub">${allDepts.reduce((s,[,d])=>s+Object.keys(d.locations||{}).length,0)} locations</div>
      </div>
    </div>
    <div class="toolbar">
      <input class="search-box" id="inv-search" placeholder="Search items..." oninput="filterInv(this.value)" style="max-width:280px">
      <select class="filter-select" id="inv-cat" onchange="filterInv(document.getElementById('inv-search').value)">
        <option value="">All Categories</option>
        ${[...new Set(its.map(i=>i.category||categorize(i.name)).filter(Boolean))].sort().map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('')}
      </select>
      <select class="filter-select" id="inv-status" onchange="filterInv(document.getElementById('inv-search').value)">
        <option value="">All Status</option>
        <option value="deficit">Has Deficit</option>
        <option value="ok">No Deficit</option>
      </select>
      <span class="inv-count-label" style="color:var(--text-muted);font-size:12px;margin-left:auto">${its.length} items</span>
    </div>
    <div class="inventory-table-wrap">
      <table class="inv-table">
        <thead>
          <tr>
            <th onclick="sortInv('name')">Item ↕</th>
            <th>Category</th>
            <th onclick="sortInv('depts')" title="Total from Departments">Depts ↕</th>
            <th onclick="sortInv('teamtotal')" title="Total from Teams">Teams ↕</th>
            <th onclick="sortInv('total')" title="Combined Total (Depts + Teams)">Total ↕</th>
            <th>LIC Inv.</th>
            <th>MOYS/LIC</th>
            <th>Aspire</th>
            <th onclick="sortInv('deficit')">Deficit ↕</th>
            <th>Departments</th>
            <th style="min-width:140px">Notes</th>
            <th style="width:36px"></th>
          </tr>
        </thead>
        <tbody id="inv-tbody">`;

  its.forEach(item => {
    const cat = item.category || categorize(item.name);
    const tot = itemTotal(item);
    const avail = itemAvail(item);
    const deficit = itemDeficit(item);
    const surplus = avail - tot;
    const dc = deficit > 20 ? 'bad' : deficit > 0 ? 'warn' : 'ok';
    const dLabel = deficit > 0 ? `−${deficit}` : surplus > 0 ? `+${surplus} surplus` : '✓ 0';
    const activeDepts = Object.keys(item.dept_quantities||{}).filter(d => {
      const dq = item.dept_quantities[d];
      return dq && Object.values(dq).some(q=>(parseInt(q, 10)||0)>0);
    });
    // Dept total and team total separately
    let deptsTotal = 0, teamsTotal = 0;
    Object.values(item.dept_quantities||{}).forEach(dq => Object.values(dq).forEach(q => deptsTotal += (parseInt(q, 10)||0)));
    Object.values(item.team_quantities||{}).forEach(tq => Object.values(tq).forEach(q => teamsTotal += (parseInt(q, 10)||0)));
    html += `
      <tr data-item-id="${item.id}" data-name="${esc(item.name.toLowerCase())}" data-cat="${esc(cat)}" data-deficit="${deficit}" data-total="${tot}" data-depts="${deptsTotal}" data-teamtotal="${teamsTotal}">
        <td style="max-width:220px"><input class="notes-input" style="font-weight:600;width:100%" value="${esc(item.name)}" onblur="updateItemName('${item.id}',this.value)" title="Click to edit name"></td>
        <td><span class="cat-badge">${esc(cat)}</span></td>
        <td style="font-weight:600;color:var(--text-muted)">${deptsTotal||0}</td>
        <td style="font-weight:600;color:var(--accent)">${teamsTotal||0}</td>
        <td style="font-weight:700" class="total-cell-${item.id}">${tot}</td>
        <td><input class="inv-edit-input" type="number" min="0" value="${item.lic_inventory||0}" oninput="updateInv('${item.id}','lic_inventory',this.value)"></td>
        <td><input class="inv-edit-input" type="number" min="0" value="${item.moys_lic||0}" oninput="updateInv('${item.id}','moys_lic',this.value)"></td>
        <td><input class="inv-edit-input" type="number" min="0" value="${item.aspire||0}" oninput="updateInv('${item.id}','aspire',this.value)"></td>
        <td><span class="deficit-pill ${dc}">${dLabel}</span></td>
        <td style="font-size:11px;max-width:180px;cursor:pointer" onclick="showDeptPopover(event,'${item.id}')" title="Click to see all departments">${activeDepts.slice(0,3).map(d=>`<span style="display:inline-block;background:var(--surface3);padding:1px 5px;border-radius:3px;margin:1px;white-space:nowrap">${esc(d.substring(0,14))}</span>`).join('')}${activeDepts.length>3?`<span style="color:var(--accent);font-weight:600"> +${activeDepts.length-3} more ▾</span>`:''}</td>
        <td><input class="notes-input" type="text" value="${esc(item.notes||'')}" placeholder="Add note…" onblur="updateNote('${item.id}',this.value)"></td>
        <td><button class="del-row-btn" onclick="deleteItem('${item.id}')" title="Remove item">${icon('trash',13)}</button></td>
      </tr>`;
  });

  if (!its.length) {
    html += `<tr><td colspan="12">${emptyState('search','No items yet','Click "+ Item" to add your first inventory item')}</td></tr>`;
  }
  html += `</tbody></table></div>`;
  container.innerHTML = html;
}
let _filterInvTimer = null;
function filterInv(q) {
  if (_filterInvTimer) clearTimeout(_filterInvTimer);
  _filterInvTimer = setTimeout(() => {
    q = (q||'').toLowerCase();
    const cat = document.getElementById('inv-cat')?.value||'';
    const st = document.getElementById('inv-status')?.value||'';
    let visible = 0;
    document.querySelectorAll('#inv-tbody tr').forEach(r => {
      const nm = r.dataset.name?.includes(q) !== false;
      const cm = !cat || r.dataset.cat === cat;
      const def = parseInt(r.dataset.deficit||'0', 10);
      const sm = !st || (st==='deficit' ? def>0 : def<=0);
      const show = (!q||nm) && cm && sm;
      r.style.display = show ? '' : 'none';
      if (show) visible++;
    });
    const countEl = document.querySelector('.inv-count-label');
    const total = document.querySelectorAll('#inv-tbody tr').length;
    if (countEl) countEl.textContent = (visible < total) ? `${visible} of ${total} items` : `${total} items`;
  }, 120);
}
function sortInv(field) {
  const tbody = document.getElementById('inv-tbody');
  if (!tbody) return;
  const rows = [...tbody.querySelectorAll('tr')];
  rows.sort((a,b) => {
    if (field === 'name') return (a.dataset.name||'').localeCompare(b.dataset.name||'');
    const key = field === 'deficit' ? 'deficit' : field === 'depts' ? 'depts' : field === 'teamtotal' ? 'teamtotal' : 'total';
    return parseInt(b.dataset[key]||'0', 10) - parseInt(a.dataset[key]||'0', 10);
  });
  rows.forEach(r => tbody.appendChild(r));
}
function recalcTotalNeeded(item) {
  item.total_needed = itemTotal(item);
}
function recalcDeficit(item) {
  item.deficit = itemDeficit(item);
}
function recalcAllDeficits() {
  items().forEach(item => { recalcTotalNeeded(item); recalcDeficit(item); });
  save();
}

// ── CROSS-CHAMPIONSHIP SYNC ──
let _syncApplyFn = null;

function refreshDeficitPill(itemId) {
  const item = items().find(i=>i.id===itemId);
  if (!item) return;
  const row = document.querySelector(`#inv-tbody tr[data-item-id="${itemId}"]`);
  if (!row) return;
  const tot = itemTotal(item);
  const avail = itemAvail(item);
  const deficit = itemDeficit(item);
  const surplus = avail - tot;
  const dc = deficit > 20 ? 'bad' : deficit > 0 ? 'warn' : 'ok';
  const dLabel = deficit > 0 ? `−${deficit}` : surplus > 0 ? `+${surplus} surplus` : '✓ 0';
  const pill = row.querySelector('.deficit-pill');
  if (pill) { pill.className = `deficit-pill ${dc}`; pill.textContent = dLabel; }
  row.dataset.deficit = deficit;
  // Also update the "Needed" total cell
  const totalCell = row.querySelector(`.total-cell-${itemId}`);
  if (totalCell) totalCell.textContent = tot;
  row.dataset.total = tot;
}
function updateInv(itemId, field, val) {
  const item = items().find(i=>i.id===itemId);
  if (!item) return;
  const numVal = parseQty(val);
  item[field] = numVal;
  refreshDeficitPill(itemId);
  debouncedSave();
  // Debounce the sync panel so it doesn't fire on every keystroke
  clearTimeout(updateInv._t);
  updateInv._t = setTimeout(() => {
    const fieldLabel = { lic_inventory:'LIC Inventory', moys_lic:'MOYS/LIC', aspire:'Aspire' }[field] || field;
    showSyncPanel(
      'Sync inventory to other championships?',
      `<strong>${esc(item.name)}</strong> · ${fieldLabel} set to <strong>${numVal}</strong>`,
      (data) => { const it = (data.items||[]).find(i=>i.id===itemId); if (it) { it[field]=numVal; recalcAllDeficitsForData(data); } }
    );
  }, 1200);
}
function updateNote(itemId, val) {
  const item = items().find(i=>i.id===itemId);
  if (!item) return;
  item.notes = val;
  save();
}
function updateItemName(itemId, val) {
  val = val.trim();
  if (!val) return;
  const item = items().find(i=>i.id===itemId);
  if (!item) return;
  const oldName = item.name;
  if (oldName === val) return;
  item.name = val;
  save();
  showToast(`Renamed to "${val}"`, 'success');
  showSyncPanel(
    'Rename in other championships?',
    `"<strong>${esc(oldName)}</strong>" → "<strong>${esc(val)}</strong>"`,
    (data) => { const it = (data.items||[]).find(i=>i.id===itemId); if (it) it.name = val; }
  );
}
let _deletedItem = null;  // { item, idx } — held for undo
let _undoTimer = null;
let _undoRafId = null;
const UNDO_DURATION = 6000; // ms

function deleteItem(itemId) {
  if (!confirm('Remove this item from the system?')) return;
  const item = items().find(i=>i.id===itemId);
  if (!item) return;
  const idx = cd().items.findIndex(i=>i.id===itemId);
  if (idx === -1) return;

  // Stash for undo before splicing
  _deletedItem = { item: JSON.parse(JSON.stringify(item)), idx, champ: S.champ, year: S.year };
  cd().items.splice(idx, 1);
  // Remove all delivery entries for this item
  if (S.data.deliveries) {
    Object.keys(S.data.deliveries).forEach(k => { if (k.endsWith(`||${itemId}`)) delete S.data.deliveries[k]; });
  }
  save();
  renderTab('master');
  showUndoToast(`"${item.name}" removed`);

  showSyncPanel(
    'Remove from other championships?',
    `"<strong>${esc(item.name)}</strong>" was removed from <strong>${CHAMP_NAMES[S.champ]}</strong>`,
    (data) => { if (!data.items) return; const i = data.items.findIndex(it=>it.id===item.id); if (i !== -1) data.items.splice(i, 1); }
  );
}


function showDeptPopover(e, itemId) {
  e.stopPropagation();
  if (_popoverEl) { _popoverEl.remove(); _popoverEl = null; }
  const item = items().find(i=>i.id===itemId);
  if (!item) return;
  const activeDepts = Object.keys(item.dept_quantities||{}).filter(d => {
    const dq = item.dept_quantities[d];
    return dq && Object.values(dq).some(q=>(parseInt(q, 10)||0)>0);
  });
  if (!activeDepts.length) return;
  const pop = document.createElement('div');
  pop.className = 'dept-popover';
  pop.innerHTML = `<div class="dept-popover-title">Departments (${activeDepts.length})</div>` +
    activeDepts.map(d=>`<div class="dept-popover-item">${esc(d)}</div>`).join('');
  const r = e.currentTarget.getBoundingClientRect();
  pop.style.top = (r.bottom + 6 + window.scrollY) + 'px';
  pop.style.left = Math.min(r.left, window.innerWidth - 280) + 'px';
  document.body.appendChild(pop);
  _popoverEl = pop;
  const dismiss = ev => { if (!pop.contains(ev.target)) { pop.remove(); _popoverEl = null; document.removeEventListener('click', dismiss, true); } };
  setTimeout(() => document.addEventListener('click', dismiss, true), 50);
}

// ── RENAME DEPT ──
