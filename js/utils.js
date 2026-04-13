function icon(name, sz, extra) {
  sz = sz || 14;
  const d = {
    lock:          '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    unlock:        '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/>',
    eye:           '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
    pencil:        '<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>',
    trash:         '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>',
    download:      '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>',
    search:        '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    chart:         '<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/>',
    check:         '<polyline points="20 6 9 17 4 12"/>',
    x:             '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    'chevron-r':   '<path d="m9 18 6-6-6-6"/>',
    'chevron-d':   '<path d="m6 9 6 6 6-6"/>',
    'chevron-u':   '<path d="m18 15-6-6-6 6"/>',
    moon:          '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
    sun:           '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',
    flag:          '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/>',
    car:           '<path d="M19 17H5"/><path d="M5 10l1.5-5.5A2 2 0 0 1 8.4 3h7.2a2 2 0 0 1 1.9 1.5L19 10"/><path d="M2 10h20"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/>',
    zap:           '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
    file:          '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/>',
    image:         '<rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>',
    'arrow-left':  '<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>',
    users:         '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    'map-pin':     '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
    plus:          '<path d="M5 12h14"/><path d="M12 5v14"/>',
    home:          '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
    'alert-tri':   '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  };
  const paths = d[name] || '';
  return '<svg xmlns="http://www.w3.org/2000/svg" width="' + sz + '" height="' + sz + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;flex-shrink:0' + (extra ? ';' + extra : '') + '">' + paths + '</svg>';
}


function cd() { return S.data; }
function depts() {
  return Object.entries(cd().departments || {}).filter(([k]) =>
    !['Total Needs','LIC Inventory','MOYS/LIC','ASPIRE','DEFICIT','Notes'].includes(k));
}
function items() { return cd().items || []; }
function slug(s) { return String(s).replace(/[^a-z0-9]/gi,'_').toLowerCase(); }
function esc(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
function deptColor(idx) { return DEPT_COLORS[idx % DEPT_COLORS.length]; }
function categorize(n) {
  n = (n||'').toLowerCase();
  // Categories follow the Excel "WEC & TEAMS order.code matrix" sheet exactly
  if (/fridge|freezer|refrigerator|washing.*up|dishwasher|rinse|ice.*cube|kitchen|coffee.*mach|microwave|kettle|dispenser.*water|water.*dispenser/.test(n)) return 'KITCHEN ITEMS';
  if (/^table|dining table|patio table|server.*high|bistro.*table|coffee table|nova desk bench|white standard desk|foldable table/.test(n)) return 'TABLES';
  if (/^sofa|two.seater|three.seater|sofa set/.test(n)) return 'SOFA';
  if (/chair|stool|seater|seat/.test(n)) return 'CHAIRS';
  if (/still water|sparkling water|dispenser water|water.*glass|water.*bottle|coke|sprite|fanta|ginger ale|pocari|red bull|ice tea|paper cup/.test(n)) return 'BEVERAGES';
  if (/printing paper|a4.*paper|a3.*paper|ream/.test(n)) return 'PRINTING PAPER';
  if (/tv|screen|monitor|led.*screen|television|extension cable|tv stand|hdmi|projector/.test(n)) return 'AUDIO VISUAL & ELECTRICAL';
  if (/gas|fuel|chemical|fire ext|lpg|petrol|diesel/.test(n)) return 'GASES - FUEL - CHEMICALS';
  if (/forklift|fork.*ext|pallet.*troll|golf.*buggy|club.*car|scissor.*lift|cherry.*pick|crane|truck|trailer|vehicle/.test(n)) return 'HEAVY MACHINERY AND VEHICLES';
  if (/table|desk|bench/.test(n)) return 'TABLES';
  return 'OTHERS';
}

// Delivery tracking per item per location
function dKey(dept, loc, itemId) {
  return `${S.champ}_${S.year}_${dept}_${loc}_${itemId}_del`;
}
function getDelivered(dept, loc, itemId) {
  return parseInt(localStorage.getItem(dKey(dept, loc, itemId))||'0');
}
function setDelivered(dept, loc, itemId, qty) {
  localStorage.setItem(dKey(dept, loc, itemId), String(qty));
}
function getLocCounts(dept, loc) {
  let total = 0, del = 0;
  items().forEach(item => {
    const q = parseInt(item.dept_quantities?.[dept]?.[loc]||0);
    if (q > 0) { total += q; del += Math.min(getDelivered(dept, loc, item.id), q); }
  });
  return { total, del };
}
function getDeptCounts(dept, locs) {
  let total = 0, del = 0;
  (locs||[]).forEach(loc => { const c = getLocCounts(dept, loc); total += c.total; del += c.del; });
  return { total, del };
}

// ── MASTER VIEW ──
