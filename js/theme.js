function _applyMotoGPLogo(isLight) {
  const el = document.getElementById('motogp-logo') || document.querySelector('.champ-card.motogp .champ-logo-img');
  if (el) el.src = isLight ? 'assets/images/MOTO gp .png' : 'assets/images/MOTO GP Dark.png';
}

function toggleTheme() {
  document.body.classList.toggle('light');
  const isLight = document.body.classList.contains('light');
  document.getElementById('theme-btn').innerHTML = isLight ? icon('moon',20) : icon('sun',20);
  document.getElementById('theme-btn2').innerHTML = isLight ? icon('moon',18) : icon('sun',18);
  _applyMotoGPLogo(isLight);
  try { localStorage.setItem('lic_theme_v2', isLight ? 'light' : 'dark'); } catch(e){}
}

function initTheme() {
  // Use versioned key so old 'dark' values from previous defaults don't interfere
  const saved = localStorage.getItem('lic_theme_v2');
  // null = first visit → light; 'light' → light; 'dark' → dark
  const isLight = saved !== 'dark';
  document.body.classList.toggle('light', isLight);
  document.getElementById('theme-btn').innerHTML = isLight ? icon('moon',20) : icon('sun',20);
  document.getElementById('theme-btn2').innerHTML = isLight ? icon('moon',18) : icon('sun',18);
  _applyMotoGPLogo(isLight);
}

// ── LANDING & YEAR PICKER ──
let pendingChamp = null;
