function renameDept(input) {
  const did = input.dataset.did;
  const oldName = input.dataset.old;
  const newName = input.value.trim();
  if (!newName || newName === oldName) { input.value = oldName; return; }
  const data = cd().departments;
  if (data[newName]) { showToast('Name already exists','error'); input.value = oldName; return; }
  // Rebuild departments preserving order
  const rebuilt = {};
  Object.entries(data).forEach(([k,v]) => rebuilt[k === oldName ? newName : k] = v);
  cd().departments = rebuilt;
  // Update all item dept_quantities keys
  items().forEach(item => {
    if (item.dept_quantities && item.dept_quantities[oldName] !== undefined) {
      item.dept_quantities[newName] = item.dept_quantities[oldName];
      delete item.dept_quantities[oldName];
    }
  });
  // Update _ctx entries
  Object.keys(_ctx).forEach(d => { if (_ctx[d] && _ctx[d].deptName === oldName) _ctx[d].deptName = newName; });
  // Update delivery keys in blob: rename dept prefix in deliveries
  if (S.data.deliveries) {
    const oldPfx = `${oldName}||`;
    const newPfx = `${newName}||`;
    const toRename = Object.keys(S.data.deliveries).filter(k => k.startsWith(oldPfx));
    toRename.forEach(k => {
      S.data.deliveries[newPfx + k.slice(oldPfx.length)] = S.data.deliveries[k];
      delete S.data.deliveries[k];
    });
  }
  save();
  showToast(`Renamed to "${newName}"`, 'success');
  renderTab('matrix');
  // If progress tab is currently showing, re-render it too
  if (document.getElementById('tab-progress')?.classList.contains('active')) renderTab('progress');
}

// ── DEPARTMENTS (MATRIX) ──
function getDeptTotal(deptName) {
  let t = 0;
  items().forEach(item => {
    const dq = item.dept_quantities?.[deptName];
    if (dq) Object.values(dq).forEach(q => t += (parseInt(q, 10)||0));
  });
  return t;
}

function renderMatrix(container) {
  const ds = depts();
  let html = `
    <div class="toolbar">
      <input class="search-box" id="mx-search" placeholder="Search departments, items, locations…" oninput="filterMatrix(this.value)">
      <select class="filter-select" id="mx-dept" onchange="filterMatrix(document.getElementById('mx-search').value)">
        <option value="">All Departments</option>
        ${ds.map(([k])=>`<option value="${esc(k)}">${esc(k)}</option>`).join('')}
      </select>
    </div>
    <div class="dept-accordion" id="dept-accordion">`;

  ds.forEach(([deptName, deptData], idx) => {
    const color = deptColor(idx);
    const locs = Object.keys(deptData.locations||{});
    const { total, del } = getDeptCounts(deptName, locs);
    const pct = total > 0 ? Math.round(del/total*100) : 0;
    const did = slug(deptName);
    const isOpen = S.openDept === did;
    html += `
      <div class="dept-block${isOpen?' open':''}" id="dept-${did}" data-dept="${esc(deptName)}">
        <div class="dept-header" onclick="toggleDept('${did}','${esc(deptName)}')">
          <span class="dept-chevron">${icon('chevron-r',14)}</span>
          <span class="dept-color-dot" style="background:${color}"></span>
          <input class="dept-name-input" value="${esc(deptName)}" data-old="${esc(deptName)}" data-did="${did}" onclick="event.stopPropagation()" onblur="renameDept(this)" onkeydown="if(event.key==='Enter'){event.preventDefault();this.blur()}">
          <div class="dept-stats">
            <span class="dept-stat"><strong>${locs.length}</strong> locs</span>
            <span class="dept-stat"><strong>${total}</strong> items</span>
            <span class="dept-stat" style="color:${pct===100?'var(--success)':pct>50?'var(--warning)':'var(--text-muted)'}"><strong>${pct}%</strong> done</span>
          </div>
          <div class="dept-header-btns" onclick="event.stopPropagation()">
            <button class="dept-export-btn" onclick="exportDept('${esc(deptName)}')">${icon('download',13)} Export</button>
            <button class="dept-add-loc-btn" onclick="showAddLocModal('${esc(deptName)}')">+ Location</button>
            <button class="dept-del-btn" onclick="deleteDept('${esc(deptName)}')">${icon('trash',13)} Delete</button>
          </div>
        </div>
        <div class="dept-body" id="dept-body-${did}">
          ${renderDeptBody(deptName, deptData, did, color)}
        </div>
      </div>`;
  });

  html += `</div>`;
  container.innerHTML = html;
}

function renderDeptBody(deptName, deptData, did, color) {
  const locs = Object.entries(deptData.locations||{});
  if (!locs.length) return `<div style="padding:20px;color:var(--text-muted);font-size:13px">No locations yet — click "+ Location" to add one.</div>`;

  const activeLoc = S.activeLoc[did] && deptData.locations[S.activeLoc[did]]
    ? S.activeLoc[did]
    : locs[0][0];
  if (!S.activeLoc[did]) S.activeLoc[did] = activeLoc;

  const isSummary = activeLoc === '_summary';
  let html = `<div class="loc-tabs-bar" id="loc-tabs-${did}">`;
  // Summary tab first
  html += `<div class="loc-tab${isSummary?' active':''}" id="lt-${did}-_summary" data-dept="${esc(deptName)}" data-loc="_summary" data-did="${did}" onclick="handleLocTabClick(this)" style="font-style:italic">
    <span>${icon('chart',13)} All Items</span>
  </div>`;
  locs.forEach(([locName]) => {
    const { total, del } = getLocCounts(deptName, locName);
    const isActive = !isSummary && locName === activeLoc;
    const locSlug = slug(locName);
    html += `<div class="loc-tab${isActive?' active':''}" id="lt-${did}-${locSlug}" data-dept="${esc(deptName)}" data-loc="${esc(locName)}" data-did="${did}" onclick="handleLocTabClick(this)">
      <span>${esc(locName.length>26?locName.slice(0,26)+'…':locName)}</span>
      <span class="loc-tab-count" style="color:${del===total&&total>0?'var(--success)':'var(--text-muted)'}">(${del}/${total})</span>
      <button class="loc-tab-del" onclick="event.stopPropagation();deleteLocationByTab(this)" title="Delete location">${icon('x',14)}</button>
    </div>`;
  });
  html += `</div>`;
  const detailContent = isSummary
    ? renderDeptSummary(deptName, deptData, did)
    : renderLocDetail(deptName, activeLoc, deptData.locations[activeLoc]||{}, did);
  html += `<div class="loc-detail" id="loc-detail-${did}">${detailContent}</div>`;
  return html;
}

function handleLocTabClick(el) {
  const deptName = el.dataset.dept;
  const locName = el.dataset.loc;
  const did = el.dataset.did;
  switchLoc(did, deptName, locName);
}

function switchLoc(did, deptName, locName) {
  S.activeLoc[did] = locName;
  // Update tab active classes
  const tabsBar = document.getElementById(`loc-tabs-${did}`);
  if (tabsBar) {
    tabsBar.querySelectorAll('.loc-tab').forEach(t => t.classList.remove('active'));
    const tabId = locName === '_summary' ? `lt-${did}-_summary` : `lt-${did}-${slug(locName)}`;
    const target = document.getElementById(tabId);
    if (target) target.classList.add('active');
  }
  // Re-render detail
  const detail = document.getElementById(`loc-detail-${did}`);
  const deptData = cd().departments[deptName];
  if (detail && deptData) {
    if (locName === '_summary') {
      detail.innerHTML = renderDeptSummary(deptName, deptData, did);
    } else {
      detail.innerHTML = renderLocDetail(deptName, locName, deptData.locations[locName]||{}, did);
    }
  }
}

// ── DEPT SUMMARY (All-items view across all locations) ──
function renderDeptSummary(deptName, deptData, did) {
  const locs = Object.keys(deptData.locations||{});
  const its = items();
  const rows = [];
  its.forEach(item => {
    const dq = item.dept_quantities?.[deptName];
    if (!dq) return;
    let deptTotal = 0;
    const locBreakdown = [];
    locs.forEach(loc => {
      const q = parseInt(dq[loc]||0, 10);
      if (q > 0) { deptTotal += q; locBreakdown.push({loc, q}); }
    });
    if (deptTotal === 0) return;
    // Total available stock = LIC inventory + MOYS/LIC + Aspire (live from master view data)
    const totalStock = (item.lic_inventory||0) + (item.moys_lic||0) + (item.aspire||0);
    // Coverage: how much of this dept's need is covered by available stock
    const coverPct = totalStock > 0 ? Math.round(Math.min(deptTotal, totalStock) / deptTotal * 100) : 0;
    // Whether stock fully covers this dept alone
    const covered = totalStock >= deptTotal;
    rows.push({item, deptTotal, totalStock, coverPct, covered, locBreakdown});
  });
  rows.sort((a,b) => b.deptTotal - a.deptTotal);
  if (!rows.length) return `<div style="padding:24px;color:var(--text-muted);font-size:13px">No items assigned to this department.</div>`;

  let html = `<div style="padding:12px 16px">
    <div style="margin-bottom:12px;font-size:12px;color:var(--text-muted)">
      Dept need vs available LIC stock (LIC Inventory + MOYS/LIC + Aspire). Updates live when changed in Master View.
    </div>
    <div style="overflow-x:auto">
    <table class="dept-summary-table">
      <thead><tr>
        <th>Item</th>
        <th>Category</th>
        <th style="text-align:right">Dept Needs</th>
        <th style="text-align:right">LIC Stock</th>
        <th style="text-align:right">Surplus / Shortfall</th>
        <th>Coverage</th>
        <th>Locations</th>
      </tr></thead>
      <tbody>`;

  rows.forEach(({item, deptTotal, totalStock, coverPct, covered, locBreakdown}) => {
    const cat = item.category || categorize(item.name);
    const diff = totalStock - deptTotal;
    const diffLabel = diff >= 0 ? `+${diff}` : `${diff}`;
    const diffColor = diff >= 0 ? 'var(--success)' : 'var(--danger)';
    const barColor = covered ? 'var(--success)' : coverPct > 50 ? 'var(--warning)' : 'var(--danger)';
    html += `<tr>
      <td style="font-weight:600;max-width:180px">${esc(item.name)}</td>
      <td><span class="cat-badge">${esc(cat)}</span></td>
      <td style="text-align:right;font-weight:700;font-size:13px">${deptTotal}</td>
      <td style="text-align:right;font-weight:600">${totalStock}</td>
      <td style="text-align:right;font-weight:700;color:${diffColor}">${diffLabel}</td>
      <td style="white-space:nowrap">
        <span style="font-weight:700;font-size:12px;color:${barColor};min-width:36px;display:inline-block">${coverPct}%</span>
        <span class="usage-bar-wrap"><span class="usage-bar-fill" style="width:${Math.min(coverPct,100)}%;background:${barColor};display:block;height:100%"></span></span>
      </td>
      <td style="font-size:11px;color:var(--text-muted)">
        ${locBreakdown.map(({loc,q})=>`<span style="display:inline-block;background:var(--surface3);padding:1px 5px;border-radius:3px;margin:1px;white-space:nowrap">${esc(loc.length>16?loc.slice(0,16)+'…':loc)}: <strong>${q}</strong></span>`).join('')}
      </td>
    </tr>`;
  });

  const grandDept = rows.reduce((s,r)=>s+r.deptTotal,0);
  const grandStock = rows.reduce((s,r)=>s+r.totalStock,0);
  const grandDiff = grandStock - grandDept;
  html += `</tbody>
      <tfoot><tr style="background:var(--surface2)">
        <td colspan="2" style="font-weight:700;padding:8px 10px">Total</td>
        <td style="text-align:right;font-weight:700;padding:8px 10px">${grandDept}</td>
        <td style="text-align:right;font-weight:700;padding:8px 10px">${grandStock}</td>
        <td style="text-align:right;font-weight:700;padding:8px 10px;color:${grandDiff>=0?'var(--success)':'var(--danger)'}">${grandDiff>=0?'+':''}${grandDiff}</td>
        <td colspan="2" style="padding:8px 10px;color:var(--text-muted);font-size:11px">${rows.length} item types · ${locs.length} location${locs.length!==1?'s':''}</td>
      </tr></tfoot>
    </table></div></div>`;
  return html;
}

// Store current dept/loc for each open panel — avoids passing through HTML attributes
const _ctx = {};  // did -> {deptName, locName}

function renderLocDetail(deptName, locName, locInfo, did) {
  _ctx[did] = { deptName, locName };   // register context — all handlers read from here
  const its = items();
  const locItems = its.filter(i => (parseInt(i.dept_quantities?.[deptName]?.[locName], 10)||0) > 0);
  const { total, del } = getLocCounts(deptName, locName);

  let html = `
    <div class="loc-meta">
      <div class="loc-meta-item">
        <div class="loc-meta-label">Location</div>
        <input class="loc-meta-input" value="${esc(locName)}" style="min-width:180px" onblur="renameLocationCtx('${did}',this.value)">
      </div>
      <div class="loc-meta-item">
        <div class="loc-meta-label">Bump In</div>
        <input class="loc-meta-input" type="date" value="${locInfo.bump_in||''}" onchange="updateLocMetaCtx('${did}','bump_in',this.value)">
      </div>
      <div class="loc-meta-item">
        <div class="loc-meta-label">Bump Out</div>
        <input class="loc-meta-input" type="date" value="${locInfo.bump_out||''}" onchange="updateLocMetaCtx('${did}','bump_out',this.value)">
      </div>
      <div class="loc-meta-item">
        <div class="loc-meta-label">Contact</div>
        <input class="loc-meta-input" value="${esc(locInfo.contact||'')}" onblur="updateLocMetaCtx('${did}','contact',this.value)">
      </div>
      <div class="loc-meta-item" style="margin-left:auto;justify-content:flex-end">
        <div class="loc-meta-label">Delivery</div>
        <div style="display:flex;align-items:center;gap:8px">
          <span id="del-counter-${did}" style="font-size:13px;font-weight:700;color:${del===total&&total>0?'var(--success)':del>0?'var(--warning)':'var(--text-muted)'}">${del}/${total}</span>
          <button class="done-loc-btn" onclick="markLocDoneCtx('${did}')">${icon('check',13)} Done</button>
        </div>
      </div>
    </div>
    <div class="items-table-wrap">
      <table class="items-table">
        <thead><tr>
          <th>Item</th><th>Desc / Dimensions</th><th>Category</th><th>Qty Requested</th><th>Delivered</th><th>Status</th><th></th>
        </tr></thead>
        <tbody id="loc-items-${did}">`;

  locItems.forEach(item => {
    const qty = parseInt(item.dept_quantities[deptName][locName], 10)||0;
    const dval = getDelivered(deptName, locName, item.id);
    const pct = qty > 0 ? Math.round(dval/qty*100) : 0;
    const sc = pct===100?'var(--success)':pct>0?'var(--warning)':'var(--text-muted)';
    const cat = item.category||categorize(item.name);
    html += `<tr data-item-id="${item.id}" data-qty="${qty}">
      <td style="font-weight:600;max-width:160px">${esc(item.name)}</td>
      <td style="color:var(--text-muted);font-size:12px;max-width:150px">${esc(item.description||'—')}</td>
      <td><span class="cat-badge">${esc(cat)}</span></td>
      <td><input class="qty-input qty-req" type="number" min="0" value="${qty}" oninput="updateQtyCtx('${did}','${item.id}',this.value,this)"></td>
      <td><input class="qty-input qty-del" type="number" min="0" max="${qty}" value="${dval}" oninput="updateDelCtx('${did}','${item.id}',this.value,this)"></td>
      <td class="status-cell" style="min-width:80px">
        <div class="status-pct" style="color:${sc};font-size:12px;font-weight:600">${pct}%</div>
        <div class="progress-mini"><div class="progress-mini-fill" style="width:${pct}%;background:${sc}"></div></div>
      </td>
      <td><button class="del-row-btn" onclick="removeItemCtx('${did}','${item.id}')">${icon('x',12)}</button></td>
    </tr>`;
  });

  html += `</tbody></table>
    <div class="add-item-row">
      <select class="add-item-select" id="add-sel-${did}">
        <option value="">— Add item to this location —</option>
        ${items().filter(i=>!i.teams_only&&!locItems.find(li=>li.id===i.id)).map(i=>
          `<option value="${i.id}">${esc(i.name)}${i.description?' — '+esc(i.description.substring(0,40)):''}</option>`
        ).join('')}
      </select>
      <input class="qty-input" type="number" min="1" value="1" id="add-qty-${did}">
      <button class="btn btn-primary" style="font-size:12px;padding:7px 12px" onclick="addItemToLocCtx('${did}')">Add</button>
    </div>
  </div>`;
  return html;
}

// ── Context-based handlers (no string-passing through HTML attributes) ──
function updateDelCtx(did, itemId, val, input) {
  const {deptName, locName} = _ctx[did]||{};
  if (!deptName) return;
  const item = items().find(i=>i.id===itemId);
  const qty = parseInt(item?.dept_quantities?.[deptName]?.[locName]||0, 10);
  const d = Math.min(parseQty(val), qty);
  if (input) input.value = d;
  setDelivered(deptName, locName, itemId, d);
  // Update status cell in same row
  const row = input?.closest('tr');
  if (row) {
    const pct = qty > 0 ? Math.round(d/qty*100) : 0;
    const sc = pct===100?'var(--success)':pct>0?'var(--warning)':'var(--text-muted)';
    const sc2 = row.querySelector('.status-pct');
    const bar = row.querySelector('.progress-mini-fill');
    if (sc2) { sc2.textContent = pct+'%'; sc2.style.color = sc; }
    if (bar) { bar.style.width = pct+'%'; bar.style.background = sc; }
  }
  refreshDelCounter(did, deptName, locName);
  refreshLocTabCount(did, deptName, locName);
  refreshDeptStats(did, deptName);
}

function updateQtyCtx(did, itemId, val, input) {
  const {deptName, locName} = _ctx[did]||{};
  if (!deptName) return;
  const qty = parseQty(val);
  const item = items().find(i=>i.id===itemId);
  if (!item) return;
  if (!item.dept_quantities[deptName]) item.dept_quantities[deptName] = {};
  item.dept_quantities[deptName][locName] = qty;
  recalcTotalNeeded(item);
  recalcDeficit(item);
  refreshDeficitPill(itemId);
  debouncedSave();
}

function removeItemCtx(did, itemId) {
  const {deptName, locName} = _ctx[did]||{};
  if (!deptName) return;
  const item = items().find(i=>i.id===itemId);
  if (!item) return;
  delete item.dept_quantities[deptName][locName];
  recalcTotalNeeded(item);
  recalcDeficit(item);
  refreshDeficitPill(itemId);
  save();
  reRenderDetail(did);
  showToast('Item removed','success');
}

function addItemToLocCtx(did) {
  const {deptName, locName} = _ctx[did]||{};
  if (!deptName) return;
  const sel = document.getElementById(`add-sel-${did}`);
  const qtyEl = document.getElementById(`add-qty-${did}`);
  const itemId = sel?.value;
  if (!itemId) return showToast('Select an item first','error');
  const qty = Math.max(1, parseInt(qtyEl?.value, 10)||1);
  const item = items().find(i=>i.id===itemId);
  if (!item) return;
  if (!item.dept_quantities[deptName]) item.dept_quantities[deptName] = {};
  item.dept_quantities[deptName][locName] = qty;
  recalcTotalNeeded(item);
  recalcDeficit(item);
  refreshDeficitPill(item.id);
  save();
  reRenderDetail(did);
  showToast(`${item.name} added`,'success');
}

function markLocDoneCtx(did) {
  const {deptName, locName} = _ctx[did]||{};
  if (!deptName) return;
  // Check if already fully delivered — if so, undo (reset to 0)
  const {total, del} = getLocCounts(deptName, locName);
  const allDone = total > 0 && del === total;
  items().forEach(item => {
    const qty = parseInt(item.dept_quantities?.[deptName]?.[locName]||0, 10);
    if (qty > 0) setDelivered(deptName, locName, item.id, allDone ? 0 : qty);
  });
  reRenderDetail(did);
  refreshLocTabCount(did, deptName, locName);
  refreshDeptStats(did, deptName);
  showToast(allDone ? 'Delivery reset to 0' : 'All items marked as delivered ✓', allDone ? 'error' : 'success');
}

function updateLocMetaCtx(did, field, value) {
  const {deptName, locName} = _ctx[did]||{};
  if (!deptName) return;
  const dept = cd().departments[deptName];
  if (dept?.locations?.[locName]) { dept.locations[locName][field] = value; save(); }
}

function renameLocationCtx(did, newName) {
  const {deptName, locName} = _ctx[did]||{};
  if (!deptName) return;
  newName = newName.trim();
  if (!newName || newName === locName) return;
  const dept = cd().departments[deptName];
  if (!dept?.locations?.[locName]) return;
  dept.locations[newName] = dept.locations[locName];
  delete dept.locations[locName];
  items().forEach(item => {
    if (item.dept_quantities?.[deptName]?.[locName] !== undefined) {
      item.dept_quantities[deptName][newName] = item.dept_quantities[deptName][locName];
      delete item.dept_quantities[deptName][locName];
    }
  });
  _ctx[did].locName = newName;
  S.activeLoc[did] = newName;
  save();
  const idx = depts().findIndex(([k])=>k===deptName);
  const bodyEl = document.getElementById(`dept-body-${did}`);
  if (bodyEl) bodyEl.innerHTML = renderDeptBody(deptName, dept, did, deptColor(idx));
  showToast('Location renamed','success');
}

function reRenderDetail(did) {
  const {deptName, locName} = _ctx[did]||{};
  if (!deptName) return;
  const deptData = cd().departments[deptName];
  const detail = document.getElementById(`loc-detail-${did}`);
  if (detail && deptData) detail.innerHTML = renderLocDetail(deptName, locName, deptData.locations[locName]||{}, did);
}

function refreshDelCounter(did, deptName, locName) {
  const {total, del} = getLocCounts(deptName, locName);
  const el = document.getElementById(`del-counter-${did}`);
  if (el) { el.textContent = `${del}/${total}`; el.style.color = del===total&&total>0?'var(--success)':del>0?'var(--warning)':'var(--text-muted)'; }
}

function markLocDone(deptName, locName, did) {
  // Set all delivered quantities in localStorage
  items().forEach(item => {
    const qty = parseInt(item.dept_quantities?.[deptName]?.[locName]||0, 10);
    if (qty > 0) setDelivered(deptName, locName, item.id, qty);
  });
  // Full re-render of the location detail — reads fresh values from localStorage
  const deptData = cd().departments[deptName];
  const detail = document.getElementById(`loc-detail-${did}`);
  if (detail && deptData) {
    detail.innerHTML = renderLocDetail(deptName, locName, deptData.locations[locName]||{}, did);
  }
  refreshLocTabCount(did, deptName, locName);
  refreshDeptStats(did, deptName);
  showToast('All items marked as delivered ✓', 'success');
}

function toggleDept(did, deptName) {
  const el = document.getElementById(`dept-${did}`);
  if (el.classList.contains('open')) {
    el.classList.remove('open');
    S.openDept = null;
  } else {
    document.querySelectorAll('.dept-block.open').forEach(d => d.classList.remove('open'));
    el.classList.add('open');
    S.openDept = did;
  }
}

function deleteDept(deptName) {
  if (!confirm(`Delete department "${deptName}" and all its location data?`)) return;
  delete cd().departments[deptName];
  items().forEach(item => { delete item.dept_quantities[deptName]; });
  // Remove all delivery entries for this dept
  if (S.data.deliveries) {
    const pfx = `${deptName}||`;
    Object.keys(S.data.deliveries).forEach(k => { if (k.startsWith(pfx)) delete S.data.deliveries[k]; });
  }
  save();
  renderTab('matrix');
  showToast(`Department "${deptName}" deleted`, 'success');
}

function updateQty(deptName, locName, itemId, val, did) {
  const qty = parseQty(val);
  const item = items().find(i=>i.id===itemId);
  if (!item) return;
  if (!item.dept_quantities[deptName]) item.dept_quantities[deptName] = {};
  item.dept_quantities[deptName][locName] = qty;
  recalcTotalNeeded(item);
  save();
}

function updateDel(deptName, locName, itemId, val, did) {
  const item = items().find(i=>i.id===itemId);
  const qty = parseInt(item?.dept_quantities?.[deptName]?.[locName]||0, 10);
  const d = Math.min(parseQty(val), qty);
  setDelivered(deptName, locName, itemId, d);
  // Update the status cell inline — find by class to avoid cell index issues
  const tbody = document.getElementById(`loc-items-${did}`);
  if (tbody) {
    const row = tbody.querySelector(`tr[data-item-id="${CSS.escape(itemId)}"]`);
    if (row) {
      const pct = qty > 0 ? Math.round(d/qty*100) : 0;
      const sc = pct===100?'var(--success)':pct>0?'var(--warning)':'var(--text-muted)';
      const statusCell = row.querySelector('.status-cell');
      if (statusCell) {
        statusCell.innerHTML = `<div style="color:${sc};font-size:12px;font-weight:600">${pct}%</div><div class="progress-mini"><div class="progress-mini-fill" style="width:${pct}%;background:${sc}"></div></div>`;
      }
    }
  }
  refreshLocTabCount(did, deptName, locName);
  refreshDeptStats(did, deptName);
}

function refreshLocTabCount(did, deptName, locName) {
  const { total, del } = getLocCounts(deptName, locName);
  const tabEl = document.getElementById(`lt-${did}-${slug(locName)}`);
  if (tabEl) {
    const span = tabEl.querySelector('.loc-tab-count');
    if (span) { span.textContent = `(${del}/${total})`; span.style.color = del===total&&total>0?'var(--success)':'var(--text-muted)'; }
  }
}

function refreshDeptStats(did, deptName) {
  const deptData = cd().departments[deptName];
  const locs = Object.keys(deptData?.locations||{});
  const { total, del } = getDeptCounts(deptName, locs);
  const pct = total > 0 ? Math.round(del/total*100) : 0;
  const block = document.getElementById(`dept-${did}`);
  if (block) {
    const statEls = block.querySelectorAll('.dept-stat');
    if (statEls[2]) {
      statEls[2].style.color = pct===100?'var(--success)':pct>50?'var(--warning)':'var(--text-muted)';
      statEls[2].innerHTML = `<strong>${pct}%</strong> done`;
    }
  }
}

function removeItem(deptName, locName, itemId, did) {
  const item = items().find(i=>i.id===itemId);
  if (!item) return;
  delete item.dept_quantities[deptName][locName];
  recalcTotalNeeded(item);
  save();
  const deptData = cd().departments[deptName];
  const detail = document.getElementById(`loc-detail-${did}`);
  if (detail && deptData) detail.innerHTML = renderLocDetail(deptName, locName, deptData.locations[locName]||{}, did);
  showToast('Item removed','success');
}

function addItemToLoc(deptName, locName, did) {
  const sel = document.getElementById(`add-sel-${did}`);
  const qtyEl = document.getElementById(`add-qty-${did}`);
  const itemId = sel?.value;
  if (!itemId) return showToast('Select an item first','error');
  const qty = Math.max(1, parseInt(qtyEl?.value, 10)||1);
  const item = items().find(i=>i.id===itemId);
  if (!item) return;
  if (!item.dept_quantities[deptName]) item.dept_quantities[deptName] = {};
  item.dept_quantities[deptName][locName] = qty;
  recalcTotalNeeded(item);
  save();
  const deptData = cd().departments[deptName];
  const detail = document.getElementById(`loc-detail-${did}`);
  if (detail && deptData) detail.innerHTML = renderLocDetail(deptName, locName, deptData.locations[locName]||{}, did);
  showToast(`${item.name} added`,'success');
}

function updateLocMeta(deptName, locName, field, value) {
  const dept = cd().departments[deptName];
  if (dept?.locations?.[locName]) { dept.locations[locName][field] = value; save(); }
}

function renameLocation(deptName, oldName, newName, did) {
  newName = newName.trim();
  if (!newName || newName === oldName) return;
  const dept = cd().departments[deptName];
  if (!dept?.locations?.[oldName]) return;
  dept.locations[newName] = dept.locations[oldName];
  delete dept.locations[oldName];
  items().forEach(item => {
    if (item.dept_quantities?.[deptName]?.[oldName] !== undefined) {
      item.dept_quantities[deptName][newName] = item.dept_quantities[deptName][oldName];
      delete item.dept_quantities[deptName][oldName];
    }
  });
  S.activeLoc[did] = newName;
  save();
  const bodyEl = document.getElementById(`dept-body-${did}`);
  const idx = depts().findIndex(([k])=>k===deptName);
  if (bodyEl) bodyEl.innerHTML = renderDeptBody(deptName, dept, did, deptColor(idx));
  showToast('Location renamed','success');
}

function deleteLocationByTab(btn) {
  const tab = btn.closest('.loc-tab');
  if (!tab) return;
  const deptName = tab.dataset.dept;
  const locName  = tab.dataset.loc;
  const did      = tab.dataset.did;
  if (!confirm(`Delete location "${locName}"?`)) return;
  const dept = cd().departments[deptName];
  if (!dept) return;
  delete dept.locations[locName];
  items().forEach(item => { if (item.dept_quantities?.[deptName]) delete item.dept_quantities[deptName][locName]; });
  // Remove delivery entries for this dept+loc
  if (S.data.deliveries) {
    const pfx = `${deptName}||${locName}||`;
    Object.keys(S.data.deliveries).forEach(k => { if (k.startsWith(pfx)) delete S.data.deliveries[k]; });
  }
  if (S.activeLoc[did] === locName) delete S.activeLoc[did];
  if (_ctx[did]?.locName === locName) delete _ctx[did];
  save();
  const bodyEl = document.getElementById(`dept-body-${did}`);
  const idx = depts().findIndex(([k])=>k===deptName);
  if (bodyEl) bodyEl.innerHTML = renderDeptBody(deptName, dept, did, deptColor(idx));
  showToast('Location deleted','success');
}

let _filterMatrixTimer = null;
function filterMatrix(q) {
  if (_filterMatrixTimer) clearTimeout(_filterMatrixTimer);
  _filterMatrixTimer = setTimeout(() => {
    q = (q||'').toLowerCase();
    const df = document.getElementById('mx-dept')?.value||'';
    document.querySelectorAll('.dept-block').forEach(block => {
      const dn = block.dataset.dept;
      const dMatch = !df || dn === df;
      const nameMatch = !q || dn.toLowerCase().includes(q) ||
        items().some(item => item.name.toLowerCase().includes(q) && item.dept_quantities?.[dn]);
      block.style.display = (dMatch && nameMatch) ? '' : 'none';
    });
  }, 120);
}

// ── MODALS ──
