function showRoleModal(champ, year) {
  document.getElementById('year-picker').classList.remove('open');
  _pendingChamp = champ; _pendingYear = year;
  const icons = { f1: icon('zap',36), wec: icon('car',36), motogp: icon('zap',36) };
  const el = document.getElementById('role-champ-icon');
  const tl = document.getElementById('role-title');
  if (el) el.innerHTML = (icons[champ] || icon('flag',36));
  if (tl) tl.textContent = (CHAMP_NAMES[champ] || champ.toUpperCase()) + ' — ' + year;
  const lf = document.getElementById('role-login-form');
  const er = document.getElementById('role-err');
  const pw = document.getElementById('role-password');
  const un = document.getElementById('role-username');
  if (lf) lf.style.display = 'none';
  if (er) er.textContent = '';
  if (pw) pw.value = '';
  if (un) un.value = '';
  document.getElementById('role-modal').style.display = 'flex';
}

function closeRoleModal() {
  document.getElementById('role-modal').style.display = 'none';
  document.getElementById('year-picker').classList.add('open');
}

function enterAsViewer() {
  document.getElementById('role-modal').style.display = 'none';
  document.body.classList.remove('edit-mode');
  const ri = document.getElementById('role-indicator');
  if (ri) { ri.innerHTML = icon('eye',13) + ' Viewer'; ri.style.color = 'var(--text-muted)'; }
  enterApp(_pendingChamp, _pendingYear);
}

function showUserLogin() {
  const lf = document.getElementById('role-login-form');
  if (lf) lf.style.display = 'block';
  setTimeout(() => document.getElementById('role-username')?.focus(), 80);
}

function submitUserLogin() {
  const u = (document.getElementById('role-username')?.value || '').trim();
  const p = document.getElementById('role-password')?.value || '';
  if (u === 'admin' && p === 'Milkman935') {
    document.getElementById('role-modal').style.display = 'none';
    document.body.classList.add('edit-mode');
    const ri = document.getElementById('role-indicator');
    if (ri) { ri.innerHTML = icon('pencil',13) + ' Editing'; ri.style.color = 'var(--success)'; }
    enterApp(_pendingChamp, _pendingYear);
    showToast('Edit mode — welcome, admin', 'success');
  } else {
    const er = document.getElementById('role-err');
    if (er) er.textContent = 'Incorrect username or password';
    const pw = document.getElementById('role-password');
    if (pw) { pw.value = ''; pw.focus(); }
  }
}

// Legacy stubs kept for safety
function promptEditMode() {}
function checkPin() {}

// ── PROCUREMENT POPUP ──
