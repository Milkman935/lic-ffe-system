function exportData() {
  const rows = [['Item','Category','Description','Department','Location','Qty Requested','Delivered','Bump In','Bump Out','Total Needed','LIC Inventory','Deficit','Notes']];
  depts().forEach(([dn, dd]) => {
    Object.entries(dd.locations||{}).forEach(([ln, li]) => {
      items().forEach(item => {
        const qty = parseInt(item.dept_quantities?.[dn]?.[ln]||0, 10);
        if (!qty) return;
        const del = getDelivered(dn, ln, item.id);
        rows.push([item.name, item.category||categorize(item.name), item.description||'', dn, ln, qty, del, li.bump_in||'', li.bump_out||'', itemTotal(item), item.lic_inventory||0, itemDeficit(item), item.notes||'']);
      });
    });
  });
  const csv = rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob([csv],{type:'text/csv'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href=url; a.download=`LIC_FFE_${(S.champ||'').toUpperCase()}_${S.year||''}.csv`; a.click();
  URL.revokeObjectURL(url);
  showToast('CSV exported','success');
}

// ── TOAST ──
let toastT;

function showProcurementModal() {
  const procItems = items()
    .filter(i => itemDeficit(i) > 0)
    .sort((a,b) => itemDeficit(b) - itemDeficit(a));

  if (!procItems.length) {
    showToast('No items need procurement', 'success');
    return;
  }

  const rows = procItems.map(item => `
    <tr class="proc-row">
      <td>${esc(item.name)}</td>
      <td style="text-align:center">${itemTotal(item)}</td>
      <td style="text-align:center">${itemAvail(item)}</td>
      <td style="text-align:center;color:var(--danger);font-weight:600">−${itemDeficit(item)}</td>
      <td style="color:var(--text-muted);font-size:12px">${esc(item.notes||'—')}</td>
    </tr>`).join('');

  const totalDeficit = procItems.reduce((s,i) => s + itemDeficit(i), 0);

  setModal(`
    <div class="modal-title">
      Needs Procurement — ${procItems.length} items
      <button class="modal-close" onclick="closeModal()">${icon('x',14)}</button>
    </div>
    <div style="padding:0 20px 16px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin:12px 0 10px">
        <span style="font-size:13px;color:var(--text-muted)">${totalDeficit} total units needed</span>
        <button class="btn btn-ghost" style="font-size:12px;padding:4px 10px" onclick="exportProcurementList()">${icon('download',13)} Export CSV</button>
      </div>
      <div style="max-height:420px;overflow-y:auto">
        <table style="width:100%;border-collapse:collapse">
          <thead>
            <tr style="font-size:12px;color:var(--text-muted);border-bottom:2px solid var(--border)">
              <th style="text-align:left;padding:6px 8px">Item</th>
              <th style="text-align:center;padding:6px 8px">Needed</th>
              <th style="text-align:center;padding:6px 8px">In Stock</th>
              <th style="text-align:center;padding:6px 8px">Deficit</th>
              <th style="text-align:left;padding:6px 8px">Notes</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>
  `);
}

function exportProcurementList() {
  const procItems = items()
    .filter(i => itemDeficit(i) > 0)
    .sort((a,b) => itemDeficit(b) - itemDeficit(a));

  const rows = [['Item','Category','Total Needed','LIC Stock','MOYS LIC','Aspire','Available','Deficit','Notes']];
  procItems.forEach(item => {
    rows.push([item.name, item.category||'', itemTotal(item), item.lic_inventory||0, item.moys_lic||0, item.aspire||0, itemAvail(item), itemDeficit(item), item.notes||'']);
  });
  const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], {type:'text/csv'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `LIC_FFE_Procurement_${(S.champ||'').toUpperCase()}_${S.year||''}.csv`; a.click();
  URL.revokeObjectURL(url);
  showToast('Procurement list exported', 'success');
}

// ── DEPT EXPORT ──
function exportDept(deptName) {
  const dept = cd().departments[deptName];
  if (!dept) return;
  const rows = [['Item','Category','Location','Qty Requested','Delivered','Bump In','Bump Out','LIC Stock','MOYS LIC','Aspire','Total Needed','Deficit','Notes']];
  Object.entries(dept.locations||{}).forEach(([locName, locInfo]) => {
    items().forEach(item => {
      const qty = parseInt(item.dept_quantities?.[deptName]?.[locName]||0, 10);
      if (!qty) return;
      const del = getDelivered(deptName, locName, item.id);
      rows.push([item.name, item.category||categorize(item.name), locName, qty, del, locInfo.bump_in||'', locInfo.bump_out||'', item.lic_inventory||0, item.moys_lic||0, item.aspire||0, itemTotal(item), itemDeficit(item), item.notes||'']);
    });
  });
  if (rows.length === 1) { showToast('No items in this department', 'error'); return; }
  const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], {type:'text/csv'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `LIC_FFE_${(S.champ||'').toUpperCase()}_${S.year||''}_${deptName.replace(/[^a-zA-Z0-9]/g,'_')}.csv`; a.click();
  URL.revokeObjectURL(url);
  showToast(`"${deptName}" exported`, 'success');
}

// ── ITEM NAME / ORDER MIGRATION ──
// Runs once: syncs all localStorage datasets so item names and order
// match the current INITIAL_DATA list.  Quantities, inventory values,
// dept_quantities, notes — all preserved by matching on item ID.
