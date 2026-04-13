function getOtherChampsData() {
  const results = [];
  ['f1','wec','motogp'].forEach(champ => {
    if (champ === S.champ) return;
    (S.years[champ] || []).forEach(year => {
      let data;
      try {
        const raw = localStorage.getItem(storageKey(champ, year));
        data = raw ? JSON.parse(raw) : JSON.parse(JSON.stringify(INITIAL_DATA.championships[champ] || INITIAL_DATA.championships.f1));
      } catch(e) {
        data = JSON.parse(JSON.stringify(INITIAL_DATA.championships[champ] || INITIAL_DATA.championships.f1));
      }
      results.push({ champ, year, data });
    });
  });
  return results;
}

function saveChampData(champ, year, data) {
  try { localStorage.setItem(storageKey(champ, year), JSON.stringify(data)); } catch(e) {}
}

function showSyncPanel(title, desc, applyFn) {
  const others = getOtherChampsData();
  if (!others.length) return; // no other championships exist yet
  _syncApplyFn = applyFn;
  document.getElementById('sync-panel')?.remove();
  const panel = document.createElement('div');
  panel.id = 'sync-panel';
  panel.className = 'sync-panel';
  panel.innerHTML = `
    <div class="sync-panel-title">Apply to other championships?</div>
    <div class="sync-panel-desc">${desc}</div>
    <div class="sync-champ-list">
      ${others.map((o,i) => `
        <label class="sync-champ-row">
          <input type="checkbox" id="sync-chk-${i}" checked>
          <span class="champ-dot ${o.champ}"></span>
          <strong>${CHAMP_NAMES[o.champ]}</strong>&nbsp;${o.year}
        </label>`).join('')}
    </div>
    <div class="sync-panel-btns">
      <button class="btn btn-primary" style="font-size:12px;padding:7px 14px" onclick="applySyncPanel()">Apply to selected</button>
      <button class="btn" style="font-size:12px;padding:7px 12px" onclick="document.getElementById('sync-panel')?.remove()">Skip</button>
    </div>`;
  document.body.appendChild(panel);
  // Auto-dismiss after 25s
  setTimeout(() => document.getElementById('sync-panel')?.remove(), 25000);
}

function applySyncPanel() {
  const panel = document.getElementById('sync-panel');
  if (!panel || !_syncApplyFn) return;
  const others = getOtherChampsData();
  let applied = 0;
  panel.querySelectorAll('input[type="checkbox"]').forEach((chk, i) => {
    if (chk.checked && others[i]) {
      const { champ, year, data } = others[i];
      _syncApplyFn(data);
      recalcAllDeficitsForData(data);
      saveChampData(champ, year, data);
      applied++;
    }
  });
  panel.remove();
  if (applied) showToast(`Applied to ${applied} other championship${applied > 1 ? 's' : ''}`, 'success');
}

function recalcAllDeficitsForData(data) {
  (data.items || []).forEach(item => {
    const avail = (item.lic_inventory||0)+(item.moys_lic||0)+(item.aspire||0);
    item.deficit = Math.max(0, (item.total_needed||0)-avail);
  });
}

// Load F1 items (from localStorage or INITIAL_DATA)
function getF1Items() {
  const f1Years = S.years['f1'] || [];
  for (let i = f1Years.length - 1; i >= 0; i--) {
    const raw = localStorage.getItem(storageKey('f1', f1Years[i]));
    if (raw) { try { return JSON.parse(raw).items || []; } catch(e) {} }
  }
  return (INITIAL_DATA.championships.f1 || {}).items || [];
}

// Show import banner inside master view container if current champ has fewer items than F1
function maybeShowImportBanner(container) {
  if (S.champ === 'f1') return;
  const f1Items = getF1Items();
  const currentIds = new Set(items().map(i => i.id));
  const missing = f1Items.filter(i => !currentIds.has(i.id));
  if (missing.length < 3) return; // close enough, no banner
  const banner = document.createElement('div');
  banner.className = 'sync-import-banner';
  banner.id = 'import-banner';
  banner.innerHTML = `
    <span><strong>${CHAMP_NAMES[S.champ]}</strong> is missing <strong>${missing.length}</strong> items that exist in F1's list.</span>
    <button class="btn btn-primary" style="font-size:12px;padding:6px 12px" onclick="importItemsFromF1()">Import from F1</button>
    <button class="sync-import-dismiss" onclick="document.getElementById('import-banner')?.remove()" title="Dismiss">${icon('x',12)}</button>`;
  container.prepend(banner);
}

function importItemsFromF1() {
  const f1Items = getF1Items();
  const existingIds = new Set(items().map(i => i.id));
  let added = 0;
  f1Items.forEach(f1item => {
    if (!existingIds.has(f1item.id)) {
      cd().items.push({
        id: f1item.id,
        name: f1item.name,
        category: f1item.category || '',
        description: f1item.description || '',
        dept_quantities: {},
        total_needed: 0,
        lic_inventory: f1item.lic_inventory || 0,
        moys_lic: f1item.moys_lic || 0,
        aspire: f1item.aspire || 0,
        deficit: 0,
        notes: f1item.notes || ''
      });
      added++;
    }
  });
  recalcAllDeficits();
  save();
  renderTab('master');
  showToast(`Imported ${added} items from F1`, 'success');
}
