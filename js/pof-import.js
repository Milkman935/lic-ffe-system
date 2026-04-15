/* ── POF Import Bridge ── */
/* Reads POF submissions from localStorage and applies them to the current matrix data.
   Called from the Teams tab via the "Import POF" button.
   Depends on: data.js, utils.js, toast.js */

const POF_KEY_PREFIX = 'POF_SUBMISSION_';

/* POF location keys → matrix location names */
const POF_LOC_MAP = {
  kitchen: 'Kitchen',
  office1: 'Office 1', office2: 'Office 2', office3: 'Office 3',
  office4: 'Office 4', office5: 'Office 5', office6: 'Office 6',
  office7: 'Office 7', office8: 'Office 8',
  pit: 'Pit',
};
const POF_LOCS = Object.keys(POF_LOC_MAP);

/* ── List all POF submissions for the current champ/year ── */
function getPOFSubmissionsForCurrent() {
  const champKey = S.champ;   // e.g. 'f1', 'wec', 'motogp'
  const year     = S.year;    // e.g. 2025

  const prefix = `${POF_KEY_PREFIX}${champKey.toUpperCase()}_${year}_`;
  const results = [];

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || !key.startsWith(prefix)) continue;
    try {
      const data = JSON.parse(localStorage.getItem(key));
      if (data) results.push(data);
    } catch(e) {}
  }
  return results.sort((a,b) => new Date(b.submittedAt||0) - new Date(a.submittedAt||0));
}

/* ── Show the POF import panel inside the Teams tab ── */
function showPOFImportPanel(container) {
  const subs = getPOFSubmissionsForCurrent();
  const champKey = S.champ;
  const year     = S.year;

  if (!subs.length) {
    container.innerHTML = `
      <div style="text-align:center;padding:32px;color:var(--text-dim);font-size:13px">
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"
          style="display:block;margin:0 auto 10px;opacity:.4">
          <rect x="3" y="4" width="18" height="18" rx="2"/>
          <path d="M16 2v4M8 2v4M3 10h18"/>
        </svg>
        No POF submissions found for <strong>${champKey.toUpperCase()} ${year}</strong>.<br>
        <span style="font-size:12px">Generate form links in the POF Admin (POF/index.html) and share with teams.</span>
      </div>`;
    return;
  }

  let html = `
    <div style="padding:12px 0 6px;font-size:12px;color:var(--text-muted);font-weight:600">
      ${subs.length} POF submission${subs.length!==1?'s':''} found for ${champKey.toUpperCase()} ${year}
    </div>
    <div style="display:flex;flex-direction:column;gap:8px">`;

  subs.forEach(sub => {
    const grand    = (sub.grandTotalQAR||0) + (sub.surchargeQAR||0);
    const dateStr  = sub.submittedAt
      ? new Date(sub.submittedAt).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})
      : 'Draft';
    const imported = sub.status === 'imported';
    const statusColor = imported ? 'var(--success)' : sub.status === 'submitted' ? 'var(--info)' : 'var(--text-dim)';

    html += `
      <div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:12px 16px;display:flex;align-items:center;gap:14px;flex-wrap:wrap">
        <div style="flex:1;min-width:160px">
          <div style="font-size:13px;font-weight:700;color:var(--text)">${escPOF(sub.teamName)}</div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:2px">Submitted: ${dateStr}</div>
        </div>
        <div style="font-size:13px;font-weight:700;min-width:90px;text-align:right">
          ${grand > 0 ? 'QAR ' + Math.round(grand).toLocaleString() : '—'}
        </div>
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:${statusColor}">
          ${sub.status}
        </div>
        <div style="display:flex;gap:6px;flex-shrink:0">
          <button class="btn btn-sm btn-ghost" onclick="previewPOFSubmission('${sub.teamSlug}','${champKey}',${year})">
            Preview
          </button>
          ${!imported ? `
          <button class="btn btn-sm btn-primary" onclick="importPOFSubmission('${sub.teamSlug}','${champKey}',${year})">
            Import
          </button>` : `
          <button class="btn btn-sm" style="background:rgba(0,200,83,0.1);color:var(--success);border:1px solid rgba(0,200,83,0.3)" disabled>
            ✓ Imported
          </button>`}
        </div>
      </div>`;
  });

  html += `</div>`;
  container.innerHTML = html;
}

/* ── Preview a submission (quick summary modal) ── */
function previewPOFSubmission(teamSlug, champKey, year) {
  const key = `${POF_KEY_PREFIX}${champKey.toUpperCase()}_${year}_${teamSlug}`;
  let sub;
  try { sub = JSON.parse(localStorage.getItem(key)); } catch(e) {}
  if (!sub) { showToast('Submission not found', 'error'); return; }

  const grand = (sub.grandTotalQAR||0) + (sub.surchargeQAR||0);

  const sectionLabels = {
    kitchen:'Kitchen Equipment', furniture:'Furniture & Fixtures',
    beverages:'Beverages', stationery:'Stationery', av:'Audio Visual',
    gases:'Gases & Chemicals', pit:'Pit Equipment', heavy:'Heavy Machinery', misc:'Miscellaneous',
  };

  const subtotalRows = Object.entries(sub.subtotals||{})
    .filter(([,v]) => v > 0)
    .map(([k,v]) => `
      <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:13px;border-bottom:1px solid var(--border)">
        <span style="color:var(--text-muted)">${sectionLabels[k]||k}</span>
        <span style="font-weight:700">QAR ${Math.round(v).toLocaleString()}</span>
      </div>`).join('');

  const modalHTML = `
    <div style="font-size:18px;font-weight:800;margin-bottom:4px">${escPOF(sub.teamName)}</div>
    <div style="font-size:12px;color:var(--text-muted);margin-bottom:20px">
      ${sub.championship} ${sub.year} · Submitted: ${sub.submittedAt ? new Date(sub.submittedAt).toLocaleString() : 'Draft'}
    </div>
    <div style="margin-bottom:16px">${subtotalRows || '<p style="color:var(--text-dim);font-size:13px">No items ordered.</p>'}</div>
    <div style="display:flex;justify-content:space-between;padding:10px 0;font-size:15px;font-weight:800;border-top:2px solid var(--border)">
      <span>Grand Total</span>
      <span style="color:var(--champ-color)">QAR ${Math.round(grand).toLocaleString()}</span>
    </div>
    ${sub.additionalRequest ? `<div style="margin-top:12px;padding:10px;background:var(--surface2);border-radius:8px;font-size:12px;color:var(--text-muted)"><strong>Additional request:</strong> ${escPOF(sub.additionalRequest)}</div>` : ''}
    <div style="margin-top:20px;display:flex;gap:8px">
      <button class="btn btn-ghost" onclick="closeModalOverlay(event)" style="flex:1">Close</button>
      ${sub.status !== 'imported' ? `<button class="btn btn-primary" onclick="importPOFSubmission('${teamSlug}','${champKey}',${year});closeModalOverlay(event)" style="flex:2">Import to Matrix</button>` : ''}
    </div>`;

  document.getElementById('modal-body').innerHTML = modalHTML;
  document.getElementById('modal-overlay').classList.remove('hidden');
}

/* ── Apply a submission to the current matrix data ── */
function importPOFSubmission(teamSlug, champKey, year) {
  const key = `${POF_KEY_PREFIX}${champKey.toUpperCase()}_${year}_${teamSlug}`;
  let sub;
  try { sub = JSON.parse(localStorage.getItem(key)); } catch(e) {}
  if (!sub) { showToast('Submission not found.', 'error'); return; }

  const cd = S.data;
  if (!cd) { showToast('Matrix data not loaded.', 'error'); return; }

  const teamName = sub.teamName;

  // ── Ensure team exists in matrix ──
  if (!cd.teams) cd.teams = {};

  // Find the team key — exact first, then case-insensitive trim fallback
  const resolvedKey = resolveTeamKey(cd.teams, teamName);
  const teamKey = resolvedKey || teamName;

  if (!resolvedKey) {
    cd.teams[teamKey] = { locations: {}, images: [] };
    showToast(`Created new team in matrix: ${teamKey}`, 'info');
  }

  const team = cd.teams[teamKey];
  if (!team.locations) team.locations = {};

  // Ensure standard villa locations exist
  Object.values(POF_LOC_MAP).forEach(locName => {
    if (!team.locations[locName]) {
      team.locations[locName] = { bump_in: '', bump_out: '', contact: '' };
    }
  });

  // ── Build item lookups ──
  if (!cd.items) cd.items = [];
  const byPofId = {};
  const byName  = {};
  cd.items.forEach(item => {
    if (item.pof_id) byPofId[item.pof_id] = item;
    if (item.name)   byName[item.name.toUpperCase().trim()] = item;
  });

  let updated = 0;
  let created = 0;

  // ── Apply grid (location-based) items ──
  Object.entries(sub.gridItems || {}).forEach(([pofId, locs]) => {
    const hasAny = POF_LOCS.some(l => (parseInt(locs[l], 10) || 0) > 0);
    if (!hasAny) return;

    // Resolve catalog name from the item
    const catalogName = resolvePOFItemName(pofId);
    if (!catalogName) return;

    let item = byPofId[pofId] || byName[catalogName.toUpperCase().trim()];

    if (!item) {
      // Create a new item in the matrix
      item = {
        id: `pof_${pofId}_${Date.now()}_${Math.random().toString(36).slice(2,5)}`,
        pof_id: pofId,
        name: catalogName,
        category: resolvePOFSectionName(pofId),
        lic_inventory: 0, moys_lic: 0, aspire: 0,
        dept_quantities: {}, team_quantities: {},
      };
      cd.items.push(item);
      byPofId[pofId] = item;
      byName[catalogName.toUpperCase().trim()] = item;
      created++;
    }

    if (!item.pof_id) item.pof_id = pofId;
    if (!item.team_quantities) item.team_quantities = {};
    if (!item.team_quantities[teamKey]) item.team_quantities[teamKey] = {};

    POF_LOCS.forEach(locKey => {
      const qty = parseInt(locs[locKey], 10) || 0;
      const locName = POF_LOC_MAP[locKey];
      if (qty > 0) {
        item.team_quantities[teamKey][locName] = qty;
        updated++;
      }
    });
  });

  // ── Apply heavy machinery items ──
  Object.entries(sub.heavyItems || {}).forEach(([pofId, state]) => {
    if (!((state.qty || 0) > 0)) return;

    const catalogName = resolvePOFItemName(pofId);
    if (!catalogName) return;

    let item = byPofId[pofId] || byName[catalogName.toUpperCase().trim()];

    if (!item) {
      item = {
        id: `pof_${pofId}_${Date.now()}_${Math.random().toString(36).slice(2,5)}`,
        pof_id: pofId,
        name: catalogName,
        category: 'Heavy Machinery',
        lic_inventory: 0, moys_lic: 0, aspire: 0,
        dept_quantities: {}, team_quantities: {},
      };
      cd.items.push(item);
      byPofId[pofId] = item;
      byName[catalogName.toUpperCase().trim()] = item;
      created++;
    }

    if (!item.pof_id) item.pof_id = pofId;
    if (!item.team_quantities) item.team_quantities = {};
    if (!item.team_quantities[teamKey]) item.team_quantities[teamKey] = {};

    item.team_quantities[teamKey]['Pit'] = state.qty;

    if (state.startDate || state.endDate || state.mast) {
      item.team_quantities[teamKey]['_pof_note'] =
        [state.mast, state.startDate, state.endDate ? '→ ' + state.endDate : ''].filter(Boolean).join(' · ');
    }
    updated++;
  });

  // ── Mark as imported in localStorage ──
  sub.status = 'imported';
  sub.importedAt = new Date().toISOString();
  localStorage.setItem(key, JSON.stringify(sub));

  // ── Save matrix ──
  save();

  showToast(`Imported ${updated} qty entries${created ? ' · Created ' + created + ' new items' : ''} for ${teamName}`, 'success');

  // Re-render teams tab if active
  if (S.tab === 'teams') switchTab('teams');
}

/* ── Catalog name resolvers (inline mini-catalog for the bridge) ── */
const _POF_NAMES = {
  K01:'SINGLE DOOR REFRIGERATOR',K02:'2 DOOR REFRIGERATOR (220L)',K03:'2 DOOR REFRIGERATOR (450L)',
  K04:'REFRIGERATED MERCHANDISER',K05:'CHEST FREEZER',K06:'WASHING UP LIQUID',
  K07:'KITCHEN ANTI-SLIP MATS (1500mm)',K08:'KITCHEN ANTI-SLIP MATS (900mm)',K09:'DISHWASHER FLUID',
  K10:'RINSE AID',K11:'ICE CUBES',K12:'DISHWASHER SALT',
  F01:'DESK (320cm)',F02:'DESK (160cm)',F03:'FOLDABLE TABLE',F04:'PATIO TABLE',F05:'SERVER TABLE',
  F06:'BISTRO TABLE',F07:'COFFEE TABLE',F08:'PLASTIC CHAIR',F09:'UPHOLSTERED CHAIR',
  F10:'OFFICE CHAIR ON WHEELS',F11:'BAR STOOL',F12:'CHAIR',F13:'VISITOR CHAIR',F14:'PATIO CHAIR',
  F15:'SOFA SET',F16:'TWO SEATER SOFA',F17:'INTERNAL WALL',F18:'INTERNAL DOOR',F19:'WASTE BIN',
  F20:'OSCILLATING FAN',F21:'WATER DISPENSER',F22:'WHEELY BIN',F23:'GREY CARPET',
  B01:'STILL WATER 500ml',B02:'STILL WATER 250ml',B03:'SPARKLING WATER 250ml',B04:'DISPENSER WATER 20L',
  B05:'COKE CANS',B06:'COKE LIGHT CANS',B07:'SPRITE CANS',B08:'FANTA CANS',B09:'GINGER ALE CANS',
  B10:'POCARI SWEAT',B11:'RED BULL ORIGINAL',B12:'ICE TEA LEMON',B13:'ICE TEA PEACH',B14:'PAPER CUPS',
  S01:'A4 PAPER',S02:'A3 PAPER',
  A01:'LED SCREEN 40"',A02:'ELECTRICAL EXTENSION 5M',A03:'TV STAND',
  G01:'NITROGEN INDUSTRIAL',G02:'NITROGEN HIGH GRADE',G03:'SYNTHETIC AIR',G04:'HYDROGEN',
  G05:'CARBON DIOXIDE',G06:'ARGON',G07:'REGULATOR BS3',G08:'REGULATOR BS4',
  P01:'CO2 5KG EXTINGUISHER',P02:'DRY CHEMICAL POWDER 9KG',P03:'AFFF 9LTR',P04:'WATER EXTINGUISHER 9LTR',
  P05:'BRAKE CLEANER 500ML',P06:'BRAKE CLEANER 20LTR',P07:'ACETONE 20L',P08:'DISTILLED WATER 20LTR',
  H01:'3T FORKLIFT CONTINUOUS',H02:'3T FORKLIFT PRE-EVENT',H03:'3T FORKLIFT LIVE-EVENT',H04:'3T FORKLIFT POST-EVENT',
  H05:'3T FORK EXTENSIONS 1.8M',H06:'3T FORK EXTENSIONS 2.1M',H07:'3T FORK EXTENSIONS 2.4M',
  H08:'5T FORKLIFT CONTINUOUS',H09:'5T FORKLIFT PRE-EVENT',H10:'5T FORKLIFT LIVE-EVENT',H11:'5T FORKLIFT POST-EVENT',
  H12:'5T FORK EXTENSIONS 1.8M',H13:'5T FORK EXTENSIONS 2.1M',H14:'5T FORK EXTENSIONS 2.4M',
  H15:'7T FORKLIFT CONTINUOUS',H16:'7T FORKLIFT PRE-EVENT',H17:'7T FORKLIFT LIVE-EVENT',H18:'7T FORKLIFT POST-EVENT',
  H19:'7T FORK EXTENSIONS 1.8M',H20:'7T FORK EXTENSIONS 2.1M',H21:'7T FORK EXTENSIONS 2.4M',
  H22:'10T FORKLIFT CONTINUOUS',H23:'10T FORKLIFT PRE-EVENT',H24:'10T FORKLIFT LIVE-EVENT',H25:'10T FORKLIFT POST-EVENT',
  H26:'10T FORK EXTENSIONS 1.8M',H27:'10T FORK EXTENSIONS 2.1M',H28:'10T FORK EXTENSIONS 2.4M',
  H29:'PALLET TROLLEY 2T',H30:'4-SEATER ELECTRIC CLUB CAR',H31:'6-SEATER ELECTRIC CLUB CAR',
  M01:'WINDOW FROSTING',
};

const _POF_SECTIONS = {
  K:'Kitchen Equipment', F:'Furniture, Fixtures & Equipment', B:'Beverages',
  S:'Stationery', A:'Audio Visual & Electrical', G:'Gases – Fuel – Chemicals',
  P:'Pit Equipment', H:'Heavy Machinery', M:'Miscellaneous',
};

function resolvePOFItemName(pofId) {
  return _POF_NAMES[pofId] || pofId;
}

function resolvePOFSectionName(pofId) {
  const prefix = pofId.replace(/[0-9]/g, '').toUpperCase();
  return _POF_SECTIONS[prefix] || 'Other';
}

/* ── Team key resolver ──
   Returns the existing key in teamsObj that matches teamName
   (exact → case-insensitive trim → partial). Returns null if no match. */
function resolveTeamKey(teamsObj, teamName) {
  if (!teamsObj || !teamName) return null;
  const keys = Object.keys(teamsObj);

  // 1. Exact match
  if (teamsObj[teamName]) return teamName;

  const norm = teamName.toUpperCase().trim();

  // 2. Case-insensitive + trim
  const ci = keys.find(k => k.toUpperCase().trim() === norm);
  if (ci) return ci;

  // 3. One contains the other (handles abbreviations like "FERRARI" vs "FERRARI AF CORSE")
  const partial = keys.find(k =>
    k.toUpperCase().trim().includes(norm) || norm.includes(k.toUpperCase().trim())
  );
  return partial || null;
}

/* ── Escape helper ── */
function escPOF(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
