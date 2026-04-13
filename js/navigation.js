function selectChamp(id) {
  pendingChamp = id;
  const picker = document.getElementById('year-picker');
  document.getElementById('year-modal-title').textContent = `${CHAMP_NAMES[id]} — Select Year`;
  document.getElementById('year-modal-sub').textContent = 'Choose the event year or add a new one';
  renderYearGrid(id);
  picker.classList.add('open');
  document.documentElement.style.setProperty('--champ-color', CHAMP_COLORS[id]);
}
function renderYearGrid(champ) {
  const years = S.years[champ] || [2025];
  const grid = document.getElementById('year-grid');
  grid.innerHTML = years.map(y => `
    <button class="year-btn" onclick="showRoleModal('${champ}',${y})">${y}</button>
  `).join('');
}
function addYear() {
  const y = prompt('Enter year (e.g. 2028):');
  if (!y || isNaN(parseInt(y, 10))) return;
  const yr = parseInt(y, 10);
  if (!S.years[pendingChamp]) S.years[pendingChamp] = [];
  if (!S.years[pendingChamp].includes(yr)) {
    S.years[pendingChamp].push(yr);
    S.years[pendingChamp].sort();
    try { localStorage.setItem('lic_ffe_years', JSON.stringify(S.years)); } catch(e){}
  }
  renderYearGrid(pendingChamp);
}
function closeYearPicker() {
  document.getElementById('year-picker').classList.remove('open');
  pendingChamp = null;
  document.documentElement.style.setProperty('--champ-color', S.champ ? CHAMP_COLORS[S.champ] : '#e10600');
}
function enterApp(champ, year) {
  S.champ = champ; S.year = year;
  S.data = loadData(champ, year);
  S.tab = 'master'; S.openDept = null; S.activeLoc = {};
  recalcAllDeficits();
  save(); // persist recalc immediately so next load always has clean deficit values
  document.getElementById('year-picker').classList.remove('open');
  document.getElementById('landing').style.display = 'none';
  document.getElementById('app').style.display = 'flex';
  document.documentElement.style.setProperty('--champ-color', CHAMP_COLORS[champ]);
  document.getElementById('topbar-title').textContent = `${CHAMP_NAMES[champ]} — FFE Matrix`;
  document.getElementById('champ-badge').textContent = champ.toUpperCase();
  document.getElementById('year-badge').textContent = year;
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === 'master'));
  renderTab('master');
}
function backToLanding() {
  save();
  S.champ = null; S.year = null; S.data = null;
  destroyCharts();
  document.body.classList.remove('edit-mode');
  const ri = document.getElementById('role-indicator');
  if (ri) { ri.innerHTML = icon('eye',13) + ' Viewer'; ri.style.color = 'var(--text-muted)'; }
  document.getElementById('app').style.display = 'none';
  document.getElementById('landing').style.display = 'flex';
}

// ── TAB SWITCHING ──
function switchTab(tab) {
  save(); // persist before leaving current tab
  S.tab = tab;
  destroyCharts();
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
  renderTab(tab);
}
function renderTab(tab) {
  const c = document.getElementById('main-content');
  if (tab === 'master') renderMaster(c);
  else if (tab === 'matrix') renderMatrix(c);
  else if (tab === 'teams') renderTeams(c);
  else if (tab === 'analytics') renderAnalytics(c);
  else if (tab === 'progress') renderProgress(c);
}
function destroyCharts() {
  Object.values(S.charts).forEach(ch => { try { ch.destroy(); } catch(e){} });
  S.charts = {};
}

// ── HELPERS ──
