// ── EVENTS.JS — Local & International Circuit Events ──

const CIRCUIT = (() => {
  const pitBoxes = Array.from({length: 50}, (_, i) => `Pit Box ${i + 1}`);
  const villas = Array.from({length: 16}, (_, i) => {
    const n = i + 1;
    return {
      id: n,
      name: `Villa ${n}`,
      ground: `Villa ${n} - Ground Floor`,
      first: Array.from({length: 8}, (_, j) => `Villa ${n} - First Floor - Office ${j + 1}`)
    };
  });
  const raceControl = [
    'Race Control - Ground Floor',
    'Race Control - 1st Floor',
    'Race Control - 2nd Floor'
  ];
  return { pitBoxes, villas, raceControl };
})();

const EVT_CATEGORIES = [
  { id: 'non_motor',     label: 'Non Motor Events',           sub: '',                     icon: 'flag'     },
  { id: 'sanctioned',    label: 'Sanctioned Race',            sub: 'FIA · FIM',            icon: 'car'      },
  { id: 'local',         label: 'Local Events',               sub: 'Private · Commercial', icon: 'building' },
  { id: 'testing',       label: 'Testing / High Performance', sub: '',                     icon: 'gauge'    },
  { id: 'international', label: 'International Events',       sub: '',                     icon: 'globe'    },
  { id: 'regular',       label: 'Regular Events',             sub: '',                     icon: 'calendar' },
];

function evtCatalog() {
  const raw = INITIAL_DATA.championships.f1.items || [];
  const groups = {};
  raw.forEach(item => {
    if (!item.name || !item.name.trim()) return;
    const cat = item.category || 'Other';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(item);
  });
  Object.values(groups).forEach(arr => arr.sort((a, b) => a.name.localeCompare(b.name)));
  return groups;
}

const CAT_ORDER = ['Furniture','Appliances','Storage','AV Equipment','Waste Management','Accessories','Kitchen Supplies','Beverages','Tables','Other'];

function evtIcon(name, sz) {
  sz = sz || 16;
  const shapes = {
    car:      '<path d="M19 17H5"/><path d="M5 10l1.5-5.5A2 2 0 0 1 8.4 3h7.2a2 2 0 0 1 1.9 1.5L19 10"/><path d="M2 10h20"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/>',
    building: '<rect x="4" y="2" width="16" height="20" rx="1"/><path d="M9 22V12h6v10"/><path d="M8 7h1"/><path d="M8 11h1"/><path d="M15 7h1"/><path d="M15 11h1"/>',
    flag:     '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/>',
    calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
    user:     '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    note:     '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>',
    package:  '<path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z"/><path d="M12 22V12"/><path d="m3.3 7 8.7 5 8.7-5"/>',
    gauge:    '<path d="M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"/><path d="M12 6a6 6 0 0 1 6 6"/><path d="M6 12a6 6 0 0 1 6-6"/><path d="m12 6 2.5 4.5"/>',
    globe:    '<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>',
    search:   '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>',
  };
  const d = shapes[name] || '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${sz}" height="${sz}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;flex-shrink:0">${d}</svg>`;
}

// ── Persistence ──
function loadEventsDB() {
  try { const r = localStorage.getItem('lic_events'); if (r) return JSON.parse(r); } catch(e) {}
  return { events: [] };
}
function saveEventsDB() {
  try { localStorage.setItem('lic_events', JSON.stringify(EVT.db)); } catch(e) {}
}

// ── State ──
const EVT = {
  db: null,
  view: 'list',       // 'list' | 'category' | 'detail' | 'villa'
  categoryId: null,
  eventId: null,
  villaId: null,
  activeLoc: null,
  panelTab: 'catalog',
  sections: { pitBoxes: true, villas: true, raceControl: true },
  showNewForm: false,
  searchQuery: '',    // event search within a category
  itemSearch: '',     // item search within the location panel
};

function evtCurrentCategory() {
  return EVT_CATEGORIES.find(c => c.id === EVT.categoryId) || null;
}

function evtCurrentEvent() {
  return (EVT.db.events || []).find(e => e.id === EVT.eventId) || null;
}

// ── Entry / Exit ──
function openEventsSection() {
  EVT.db = loadEventsDB();
  EVT.view = 'list';
  EVT.categoryId = null;
  EVT.eventId = null;
  EVT.villaId = null;
  EVT.activeLoc = null;
  EVT.showNewForm = false;
  EVT.searchQuery = '';
  EVT.itemSearch = '';
  document.getElementById('events-overlay').classList.add('open');
  renderEventsMain();
}

function closeEventsSection() {
  document.getElementById('events-overlay').classList.remove('open');
  closeEvtLocPanel();
}

// ── Navigation ──
function evtNav(view, opts) {
  opts = opts || {};
  // Reset event search when moving between categories
  if (opts.categoryId !== undefined && opts.categoryId !== EVT.categoryId) EVT.searchQuery = '';
  if (view !== EVT.view) EVT.searchQuery = '';
  EVT.view = view;
  if (opts.categoryId !== undefined) EVT.categoryId = opts.categoryId;
  if (opts.eventId !== undefined) EVT.eventId = opts.eventId;
  if (opts.villaId !== undefined) EVT.villaId = opts.villaId;
  EVT.showNewForm = false;
  closeEvtLocPanel();
  renderEventsMain();
}

// ── Render root ──
function renderEventsMain() {
  renderEvtBreadcrumb();
  const c = document.getElementById('events-main');
  if (EVT.view === 'list')     c.innerHTML = buildEvtCategoriesHTML();
  if (EVT.view === 'category') c.innerHTML = buildEvtCategoryHTML();
  if (EVT.view === 'detail')   c.innerHTML = buildEvtDetailHTML();
  if (EVT.view === 'villa')    c.innerHTML = buildEvtVillaHTML();
}

function renderEvtBreadcrumb() {
  const bc = document.getElementById('evt-breadcrumb');
  const cat = evtCurrentCategory();
  const ev = evtCurrentEvent();
  let html = `<span class="evt-bc${EVT.view === 'list' ? ' active' : ''}" onclick="evtNav('list')">Events</span>`;
  if (cat) {
    html += `<span class="evt-bc-sep">›</span>`;
    html += `<span class="evt-bc${EVT.view === 'category' ? ' active' : ''}" onclick="evtNav('category',{categoryId:'${cat.id}'})">${esc(cat.label)}</span>`;
  }
  if (ev) {
    html += `<span class="evt-bc-sep">›</span>`;
    html += `<span class="evt-bc${EVT.view === 'detail' ? ' active' : ''}" onclick="evtNav('detail',{categoryId:'${EVT.categoryId}',eventId:'${EVT.eventId}'})">${esc(ev.name)}</span>`;
  }
  if (EVT.view === 'villa') {
    const v = CIRCUIT.villas[EVT.villaId - 1];
    html += `<span class="evt-bc-sep">›</span><span class="evt-bc active">${v ? v.name : ''}</span>`;
  }
  bc.innerHTML = html;
}

function evtLocCount(ev, locKeys) {
  let t = 0;
  (locKeys || []).forEach(k => {
    const l = ev.locations && ev.locations[k];
    if (l) Object.values(l).forEach(q => { t += parseInt(q) || 0; });
  });
  return t;
}

// ── CATEGORIES VIEW ──
function buildEvtCategoriesHTML() {
  const events = EVT.db.events || [];
  let h = `<div class="evt-list-top" style="margin-bottom:24px">
    <div class="evt-view-title">Events</div>
  </div>`;
  h += '<div class="evt-cat-grid">';
  EVT_CATEGORIES.forEach(cat => {
    const count = events.filter(e => e.categoryId === cat.id).length;
    h += `<div class="evt-cat-card" onclick="evtNav('category',{categoryId:'${cat.id}'})">
      <div class="evt-cat-body">
        <div class="evt-cat-label">${esc(cat.label)}</div>
        ${cat.sub ? `<div class="evt-cat-sub">${esc(cat.sub)}</div>` : ''}
        <div class="evt-cat-count">${count} event${count !== 1 ? 's' : ''}</div>
      </div>
      <div class="evt-cat-arrow">→</div>
    </div>`;
  });
  h += '</div>';
  return h;
}

// ── CATEGORY EVENTS VIEW ──
function buildEvtCategoryHTML() {
  const cat = evtCurrentCategory();
  if (!cat) return '';
  const allEvents = (EVT.db.events || []).filter(e => e.categoryId === cat.id);
  const q = EVT.searchQuery.toLowerCase().trim();
  const events = q
    ? allEvents.filter(e => e.name.toLowerCase().includes(q) || (e.client && e.client.toLowerCase().includes(q)))
    : allEvents;

  let h = `<div class="evt-list-top">
    <div class="evt-view-title">${esc(cat.label)}</div>
    <button class="evt-action-btn" onclick="evtToggleNewForm()">${EVT.showNewForm ? 'Cancel' : '+ New Event'}</button>
  </div>`;

  if (EVT.showNewForm) {
    h += `<div class="evt-new-form">
      <div class="evt-form-row">
        <div class="evt-form-col">
          <label class="evt-label">Event Name *</label>
          <input id="evf-name" class="evt-input" type="text" placeholder="e.g. Corporate Day 2026" autocomplete="off" onkeydown="if(event.key==='Enter')evtCreateEvent()">
        </div>
        <div class="evt-form-col">
          <label class="evt-label">Date</label>
          <input id="evf-date" class="evt-input" type="date">
        </div>
      </div>
      <div class="evt-form-row">
        <div class="evt-form-col">
          <label class="evt-label">Client / Organizer</label>
          <input id="evf-client" class="evt-input" type="text" placeholder="e.g. Qatar Foundation" autocomplete="off">
        </div>
        <div class="evt-form-col">
          <label class="evt-label">Notes</label>
          <input id="evf-notes" class="evt-input" type="text" placeholder="Optional" autocomplete="off">
        </div>
      </div>
      <div class="evt-form-actions">
        <button class="evt-btn-create" onclick="evtCreateEvent()">Create Event →</button>
      </div>
    </div>`;
  }

  // Search bar (only when there are events to search through)
  if (allEvents.length > 0) {
    h += `<div class="evt-search-wrap">
      <span class="evt-search-icon">${evtIcon('search', 14)}</span>
      <input class="evt-search" type="text" placeholder="Search events..."
        value="${esc(EVT.searchQuery)}"
        oninput="evtSetSearch(this.value)"
        autocomplete="off">
    </div>`;
  }

  if (!allEvents.length) {
    h += `<div class="evt-empty">
      <div class="evt-empty-icon">${evtIcon(cat.icon, 52)}</div>
      <div class="evt-empty-title">No events yet</div>
      <div class="evt-empty-sub">Create your first event in this category to manage FFE across pit boxes, villas, and race control at Lusail International Circuit.</div>
      ${!EVT.showNewForm ? `<button class="evt-action-btn" onclick="evtToggleNewForm()" style="margin-top:8px">+ New Event</button>` : ''}
    </div>`;
  } else if (!events.length) {
    h += `<div class="evt-empty" style="min-height:160px">
      <div class="evt-empty-title" style="font-size:14px">No events match "${esc(EVT.searchQuery)}"</div>
    </div>`;
  } else {
    h += '<div class="evt-cards">';
    events.forEach(ev => {
      let itemCount = 0, locCount = 0;
      if (ev.locations) {
        Object.values(ev.locations).forEach(loc => {
          const c = Object.values(loc).reduce((s, q) => s + (parseInt(q) || 0), 0);
          if (c > 0) { locCount++; itemCount += c; }
        });
      }
      const dateStr = ev.date ? new Date(ev.date + 'T00:00:00').toLocaleDateString('en-GB', {day:'numeric', month:'short', year:'numeric'}) : '';
      h += `<div class="evt-card" onclick="evtNav('detail',{categoryId:'${EVT.categoryId}',eventId:'${ev.id}'})">
        <div class="evt-card-body">
          <div class="evt-card-name">${esc(ev.name)}</div>
          <div class="evt-card-meta">
            ${dateStr ? `<span>${dateStr}</span>` : ''}
            ${ev.client ? `<span>${dateStr ? '· ' : ''}${esc(ev.client)}</span>` : ''}
          </div>
          <div class="evt-card-stats">${itemCount > 0 ? `${locCount} location${locCount !== 1 ? 's' : ''} · ${itemCount} item${itemCount !== 1 ? 's' : ''}` : 'No items added yet'}</div>
        </div>
        <div class="evt-card-chevron">→</div>
      </div>`;
    });
    h += '</div>';
  }
  return h;
}

// ── Search handlers ──
function evtSetSearch(val) {
  EVT.searchQuery = val;
  const c = document.getElementById('events-main');
  c.innerHTML = buildEvtCategoryHTML();
  const inp = c.querySelector('.evt-search');
  if (inp) { inp.focus(); inp.setSelectionRange(val.length, val.length); }
}

function evtSetItemSearch(val) {
  EVT.itemSearch = val;
  renderEvtLocItemsOnly();
}

// ── DETAIL VIEW ──
function buildEvtDetailHTML() {
  const ev = evtCurrentEvent();
  if (!ev) return '<div class="evt-empty"><div class="evt-empty-title">Event not found.</div></div>';

  const dateStr = ev.date ? new Date(ev.date + 'T00:00:00').toLocaleDateString('en-GB', {day:'numeric', month:'short', year:'numeric'}) : '';

  let h = `<div class="evt-detail-meta">
    ${dateStr ? `<span class="evt-meta-chip">${evtIcon('calendar',12)} ${dateStr}</span>` : ''}
    ${ev.client ? `<span class="evt-meta-chip">${evtIcon('user',12)} ${esc(ev.client)}</span>` : ''}
    ${ev.notes ? `<span class="evt-meta-chip">${evtIcon('note',12)} ${esc(ev.notes)}</span>` : ''}
    <div class="evt-detail-acts">
      <button class="evt-btn-sm" onclick="evtEditEvent()">Edit</button>
      <button class="evt-btn-sm evt-btn-del" onclick="evtDeleteEvent()">Delete</button>
    </div>
  </div>`;

  const pbOpen = EVT.sections.pitBoxes;
  const pbCount = evtLocCount(ev, CIRCUIT.pitBoxes);
  h += buildEvtSection('pitBoxes', evtIcon('car',16), 'Pit Boxes', '50 boxes', pbCount, pbOpen, pbOpen ? buildPitGrid(ev) : '');

  const vlOpen = EVT.sections.villas;
  const allVillaLocs = CIRCUIT.villas.flatMap(v => [v.ground, ...v.first]);
  const vlCount = evtLocCount(ev, allVillaLocs);
  h += buildEvtSection('villas', evtIcon('building',16), 'Villas', '16 villas · ground & first floor', vlCount, vlOpen, vlOpen ? buildVillaGrid(ev) : '');

  const rcOpen = EVT.sections.raceControl;
  const rcCount = evtLocCount(ev, CIRCUIT.raceControl);
  h += buildEvtSection('raceControl', evtIcon('flag',16), 'Race Control', '3 floors', rcCount, rcOpen, rcOpen ? buildRCGrid(ev) : '');

  return h;
}

function buildEvtSection(key, ico, title, sub, count, open, body) {
  return `<div class="evt-section">
    <div class="evt-sec-hdr" onclick="evtToggleSection('${key}')">
      <div class="evt-sec-left">
        <span class="evt-sec-icon">${ico}</span>
        <span class="evt-sec-title">${title}</span>
        <span class="evt-sec-sub">${sub}</span>
        ${count > 0 ? `<span class="evt-sec-badge">${count} items</span>` : ''}
      </div>
      <span class="evt-chevron">${open ? '▾' : '▸'}</span>
    </div>
    ${open ? `<div class="evt-sec-body">${body}</div>` : ''}
  </div>`;
}

function buildPitGrid(ev) {
  let h = '<div class="pit-grid">';
  CIRCUIT.pitBoxes.forEach((locKey, i) => {
    const loc = ev.locations && ev.locations[locKey];
    const count = loc ? Object.values(loc).reduce((s, q) => s + (parseInt(q) || 0), 0) : 0;
    h += `<div class="pit-cell${count > 0 ? ' has-items' : ''}" data-loc="${esc(locKey)}" onclick="openEvtLocPanel(this.dataset.loc)">
      <div class="pit-num">${i + 1}</div>
      ${count > 0 ? `<div class="pit-badge">${count}</div>` : ''}
    </div>`;
  });
  h += '</div><div class="pit-legend">Click any pit box to manage FFE items</div>';
  return h;
}

function buildVillaGrid(ev) {
  let h = '<div class="villa-grid">';
  CIRCUIT.villas.forEach(v => {
    const allLocs = [v.ground, ...v.first];
    const count = evtLocCount(ev, allLocs);
    h += `<div class="villa-card${count > 0 ? ' has-items' : ''}" onclick="evtNav('villa',{eventId:'${EVT.eventId}',villaId:${v.id}})">
      <div class="villa-icon-wrap">${evtIcon('building', 20)}</div>
      <div class="villa-n">${v.name}</div>
      <div class="villa-floors">Ground · First Floor</div>
      ${count > 0 ? `<div class="villa-badge">${count} items</div>` : '<div class="villa-cta">Manage →</div>'}
    </div>`;
  });
  h += '</div>';
  return h;
}

function buildRCGrid(ev) {
  const floors = [
    { key: CIRCUIT.raceControl[0], label: 'Ground Floor', tag: 'G' },
    { key: CIRCUIT.raceControl[1], label: '1st Floor',    tag: '1' },
    { key: CIRCUIT.raceControl[2], label: '2nd Floor',    tag: '2' },
  ];
  let h = '<div class="rc-grid">';
  floors.forEach(f => {
    const loc = ev.locations && ev.locations[f.key];
    const count = loc ? Object.values(loc).reduce((s, q) => s + (parseInt(q) || 0), 0) : 0;
    h += `<div class="rc-card${count > 0 ? ' has-items' : ''}" data-loc="${esc(f.key)}" onclick="openEvtLocPanel(this.dataset.loc)">
      <div class="rc-floor-tag">${f.tag}</div>
      <div class="rc-floor-label">${f.label}</div>
      ${count > 0 ? `<div class="rc-count">${count} items</div>` : '<div class="rc-cta">Add items →</div>'}
    </div>`;
  });
  h += '</div>';
  return h;
}

// ── VILLA DETAIL VIEW ──
function buildEvtVillaHTML() {
  const ev = evtCurrentEvent();
  const v = CIRCUIT.villas[EVT.villaId - 1];
  if (!ev || !v) return '';

  const buildOfficeGrid = (locs, floorName) => {
    let h = `<div class="villa-floor-section">
      <div class="villa-floor-hdr">${floorName}</div>
      <div class="office-grid">`;
    locs.forEach((locKey, i) => {
      const loc = ev.locations && ev.locations[locKey];
      const count = loc ? Object.values(loc).reduce((s, q) => s + (parseInt(q) || 0), 0) : 0;
      h += `<div class="office-cell${count > 0 ? ' has-items' : ''}" data-loc="${esc(locKey)}" onclick="openEvtLocPanel(this.dataset.loc)">
        <div class="office-label">Office ${i + 1}</div>
        ${count > 0 ? `<div class="office-count">${count} items</div>` : ''}
      </div>`;
    });
    h += '</div></div>';
    return h;
  };

  const groundKey = v.ground;
  const gLoc = ev.locations && ev.locations[groundKey];
  const gCount = gLoc ? Object.values(gLoc).reduce((s, q) => s + (parseInt(q) || 0), 0) : 0;

  let h = `<div class="villa-floor-section">
    <div class="villa-floor-hdr">Ground Floor</div>
    <div class="rc-grid">
      <div class="rc-card${gCount > 0 ? ' has-items' : ''}" data-loc="${esc(groundKey)}" onclick="openEvtLocPanel(this.dataset.loc)">
        <div class="rc-floor-tag">G</div>
        <div class="rc-floor-label">Ground Floor</div>
        ${gCount > 0 ? `<div class="rc-count">${gCount} items</div>` : '<div class="rc-cta">Add items →</div>'}
      </div>
    </div>
  </div>`;

  h += buildOfficeGrid(v.first, 'First Floor');
  return h;
}

// ── SECTION TOGGLE ──
function evtToggleSection(key) {
  EVT.sections[key] = !EVT.sections[key];
  renderEventsMain();
}

// ── LOCATION PANEL ──
function openEvtLocPanel(locKey) {
  EVT.activeLoc = locKey;
  EVT.itemSearch = '';
  const ev = evtCurrentEvent();
  const locData = (ev && ev.locations && ev.locations[locKey]) || {};
  const hasItems = Object.values(locData).some(q => (parseInt(q) || 0) > 0);
  EVT.panelTab = hasItems ? 'added' : 'catalog';

  document.getElementById('evt-loc-title').textContent = locKey;
  renderEvtLocPanel();
  document.getElementById('evt-loc-panel').classList.add('open');
}

function closeEvtLocPanel() {
  document.getElementById('evt-loc-panel').classList.remove('open');
  EVT.activeLoc = null;
}

function switchLocTab(tab) {
  EVT.panelTab = tab;
  EVT.itemSearch = '';
  renderEvtLocPanel();
}

function renderEvtLocPanel() {
  const ev = evtCurrentEvent();
  if (!ev || !EVT.activeLoc) return;
  const locData = (ev.locations && ev.locations[EVT.activeLoc]) || {};

  const addedItemIds = Object.keys(locData).filter(k => (parseInt(locData[k]) || 0) > 0);
  const addedCount = addedItemIds.length;

  // Tabs
  document.getElementById('evt-loc-tabs').innerHTML = `<div class="loc-tabs">
    <div class="loc-tab${EVT.panelTab === 'added' ? ' active' : ''}" onclick="switchLocTab('added')">
      Added${addedCount > 0 ? ` <span class="loc-tab-badge">${addedCount}</span>` : ''}
    </div>
    <div class="loc-tab${EVT.panelTab === 'catalog' ? ' active' : ''}" onclick="switchLocTab('catalog')">
      All Items
    </div>
  </div>`;

  // Search bar
  document.getElementById('evt-loc-search-wrap').innerHTML = `<div class="loc-search-wrap">
    <span class="loc-search-icon">${evtIcon('search', 13)}</span>
    <input class="loc-search" type="text" placeholder="Search items..."
      value="${esc(EVT.itemSearch)}"
      oninput="evtSetItemSearch(this.value)"
      autocomplete="off">
  </div>`;

  renderEvtLocItemsOnly();
}

function renderEvtLocItemsOnly() {
  const ev = evtCurrentEvent();
  if (!ev || !EVT.activeLoc) return;
  const locData = (ev.locations && ev.locations[EVT.activeLoc]) || {};
  const catalog = evtCatalog();
  const search = EVT.itemSearch.toLowerCase().trim();
  const orderedKeys = [...CAT_ORDER.filter(k => catalog[k]), ...Object.keys(catalog).filter(k => !CAT_ORDER.includes(k))];
  const itemsEl = document.getElementById('evt-loc-items');

  const qtyField = (item, qty) =>
    `<div class="qty-ctrl">
      <button class="qty-btn${qty <= 0 ? ' qty-dis' : ''}" onclick="evtAdjQty('${item.id}',-1)" ${qty <= 0 ? 'disabled' : ''}>−</button>
      <input type="text" inputmode="numeric" pattern="[0-9]*" class="evt-qty-input${qty > 0 ? ' evt-qty-input-active' : ''}" id="qv-${item.id}"
        value="${qty}"
        oninput="evtSetQty('${item.id}',this.value)"
        onfocus="this.select()">
      <button class="qty-btn" onclick="evtAdjQty('${item.id}',1)">+</button>
    </div>`;

  if (EVT.panelTab === 'added') {
    const addedItemIds = Object.keys(locData).filter(k => (parseInt(locData[k]) || 0) > 0);
    if (!addedItemIds.length) {
      itemsEl.innerHTML = `<div class="loc-added-empty">
        ${evtIcon('package', 32)}
        <div>No items added to this location yet.</div>
        <button class="loc-browse-btn" onclick="switchLocTab('catalog')">Browse All Items →</button>
      </div>`;
      return;
    }
    let h = '';
    orderedKeys.forEach(cat => {
      const catItems = (catalog[cat] || []).filter(item => {
        if ((parseInt(locData[item.id]) || 0) === 0) return false;
        if (search && !item.name.toLowerCase().includes(search)) return false;
        return true;
      });
      if (!catItems.length) return;
      h += `<div class="loc-cat">${esc(cat)}</div>`;
      catItems.forEach(item => {
        const qty = parseInt(locData[item.id]);
        h += `<div class="loc-row loc-row-added" id="locrow-${item.id}">
          <div class="loc-info">
            <div class="loc-name">${esc(item.name)}</div>
            ${item.description ? `<div class="loc-desc">${esc(item.description)}</div>` : ''}
          </div>
          ${qtyField(item, qty)}
        </div>`;
      });
    });
    itemsEl.innerHTML = h || `<div class="loc-added-empty" style="padding:30px 24px">
      <div style="font-size:13px;color:var(--text-dim)">No results for "${esc(EVT.itemSearch)}"</div>
    </div>`;
    return;
  }

  // Catalog tab
  let h = '';
  orderedKeys.forEach(cat => {
    const catItems = (catalog[cat] || []).filter(item => {
      if (search && !item.name.toLowerCase().includes(search)) return false;
      return true;
    });
    if (!catItems.length) return;
    h += `<div class="loc-cat">${esc(cat)}</div>`;
    catItems.forEach(item => {
      const qty = parseInt(locData[item.id] || 0);
      h += `<div class="loc-row${qty > 0 ? ' loc-row-active' : ''}" id="locrow-${item.id}">
        <div class="loc-info">
          <div class="loc-name">${esc(item.name)}</div>
          ${item.description ? `<div class="loc-desc">${esc(item.description)}</div>` : ''}
        </div>
        ${qtyField(item, qty)}
      </div>`;
    });
  });
  itemsEl.innerHTML = h || `<div style="padding:24px 20px;color:var(--text-dim);font-size:13px;text-align:center">No results for "${esc(EVT.itemSearch)}"</div>`;
}

function evtAdjQty(itemId, delta) {
  const ev = evtCurrentEvent();
  if (!ev || !EVT.activeLoc) return;
  if (!ev.locations) ev.locations = {};
  if (!ev.locations[EVT.activeLoc]) ev.locations[EVT.activeLoc] = {};

  const cur = parseInt(ev.locations[EVT.activeLoc][itemId] || 0);
  const next = Math.max(0, cur + delta);
  if (next === 0) delete ev.locations[EVT.activeLoc][itemId];
  else ev.locations[EVT.activeLoc][itemId] = next;
  saveEventsDB();

  renderEvtLocPanel();
  updateEvtCellBadge(EVT.activeLoc, ev);
}

function evtSetQty(itemId, val) {
  const ev = evtCurrentEvent();
  if (!ev || !EVT.activeLoc) return;
  if (!ev.locations) ev.locations = {};
  if (!ev.locations[EVT.activeLoc]) ev.locations[EVT.activeLoc] = {};

  const qty = Math.max(0, parseInt(String(val).replace(/[^0-9]/g, '')) || 0);
  if (qty === 0) delete ev.locations[EVT.activeLoc][itemId];
  else ev.locations[EVT.activeLoc][itemId] = qty;
  saveEventsDB();
  updateEvtCellBadge(EVT.activeLoc, ev);

  // Update tab badge count without re-rendering (preserves input focus)
  const locData = ev.locations[EVT.activeLoc] || {};
  const addedCount = Object.keys(locData).filter(k => (parseInt(locData[k]) || 0) > 0).length;
  const addedTab = document.querySelector('#evt-loc-tabs .loc-tab:first-child');
  if (addedTab) addedTab.innerHTML = `Added${addedCount > 0 ? ` <span class="loc-tab-badge">${addedCount}</span>` : ''}`;

  // Update the minus button disabled state
  const minusBtn = document.querySelector(`#locrow-${itemId} .qty-btn`);
  if (minusBtn) { minusBtn.disabled = qty <= 0; minusBtn.classList.toggle('qty-dis', qty <= 0); }

  // Update row highlight
  const row = document.getElementById(`locrow-${itemId}`);
  if (row && EVT.panelTab === 'catalog') row.classList.toggle('loc-row-active', qty > 0);

  // Update input highlight
  const inp = document.getElementById(`qv-${itemId}`);
  if (inp) inp.classList.toggle('evt-qty-input-active', qty > 0);
}

function updateEvtCellBadge(locKey, ev) {
  const cell = document.querySelector('[data-loc="' + locKey + '"]');
  if (!cell) return;
  const loc = ev.locations && ev.locations[locKey];
  const count = loc ? Object.values(loc).reduce((s, q) => s + (parseInt(q) || 0), 0) : 0;
  cell.classList.toggle('has-items', count > 0);

  if (cell.classList.contains('pit-cell')) {
    let badge = cell.querySelector('.pit-badge');
    if (count > 0) {
      if (!badge) { badge = document.createElement('div'); badge.className = 'pit-badge'; cell.appendChild(badge); }
      badge.textContent = count;
    } else if (badge) badge.remove();

  } else if (cell.classList.contains('office-cell')) {
    let badge = cell.querySelector('.office-count');
    if (count > 0) {
      if (!badge) { badge = document.createElement('div'); badge.className = 'office-count'; cell.appendChild(badge); }
      badge.textContent = count + ' items';
    } else if (badge) badge.remove();

  } else if (cell.classList.contains('rc-card')) {
    let el = cell.querySelector('.rc-count, .rc-cta');
    if (count > 0) {
      if (!el) { el = document.createElement('div'); el.className = 'rc-count'; cell.appendChild(el); }
      el.className = 'rc-count'; el.textContent = count + ' items';
    } else if (el) {
      el.className = 'rc-cta'; el.textContent = 'Add items →';
    }
  }
}

// ── EVENT CRUD ──
function evtToggleNewForm() {
  EVT.showNewForm = !EVT.showNewForm;
  renderEventsMain();
  if (EVT.showNewForm) setTimeout(() => { const el = document.getElementById('evf-name'); if (el) el.focus(); }, 50);
}

function evtCreateEvent() {
  const nameEl = document.getElementById('evf-name');
  const name = nameEl ? nameEl.value.trim() : '';
  if (!name) {
    if (nameEl) { nameEl.focus(); nameEl.style.borderColor = 'var(--danger)'; }
    return;
  }
  const ev = {
    id: 'evt_' + Date.now(),
    categoryId: EVT.categoryId,
    name,
    date: (document.getElementById('evf-date') || {}).value || '',
    client: ((document.getElementById('evf-client') || {}).value || '').trim(),
    notes: ((document.getElementById('evf-notes') || {}).value || '').trim(),
    createdAt: new Date().toISOString().slice(0, 10),
    locations: {}
  };
  EVT.db.events.push(ev);
  saveEventsDB();
  evtNav('detail', { eventId: ev.id });
}

function evtEditEvent() {
  const ev = evtCurrentEvent();
  if (!ev) return;
  const name = prompt('Event name:', ev.name);
  if (name === null) return;
  if (!name.trim()) { showToast('Name cannot be empty', 'error'); return; }
  ev.name = name.trim();
  const client = prompt('Client / Organizer:', ev.client || '');
  if (client !== null) ev.client = client.trim();
  const notes = prompt('Notes:', ev.notes || '');
  if (notes !== null) ev.notes = notes.trim();
  saveEventsDB();
  renderEventsMain();
}

function evtDeleteEvent() {
  const ev = evtCurrentEvent();
  if (!ev) return;
  if (!confirm(`Delete "${ev.name}"? This cannot be undone.`)) return;
  EVT.db.events = EVT.db.events.filter(e => e.id !== EVT.eventId);
  saveEventsDB();
  evtNav('category');
}
