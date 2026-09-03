function teams() { return Object.entries(cd().teams || {}); }
function teamSlug(s) { return 'TM_' + slug(s); }

// Team delivery — stored in blob under S.data.deliveries with TEAM prefix
function dBlobKeyTeam(teamName, locName, itemId) {
  return `TEAM||${teamName}||${locName}||${itemId}`;
}
function getTeamDelivered(teamName, locName, itemId) {
  if (!S.data) return 0;
  if (!S.data.deliveries) S.data.deliveries = {};
  return S.data.deliveries[dBlobKeyTeam(teamName, locName, itemId)] || 0;
}
function setTeamDelivered(teamName, locName, itemId, qty) {
  if (!S.data) return;
  if (!S.data.deliveries) S.data.deliveries = {};
  if (qty === 0) {
    delete S.data.deliveries[dBlobKeyTeam(teamName, locName, itemId)];
  } else {
    S.data.deliveries[dBlobKeyTeam(teamName, locName, itemId)] = qty;
  }
  debouncedSave();
}
function getTeamLocCounts(teamName, locName) {
  let total = 0, del = 0;
  items().forEach(item => {
    const q = parseInt(item.team_quantities?.[teamName]?.[locName]||0, 10);
    if (q > 0) { total += q; del += Math.min(getTeamDelivered(teamName, locName, item.id), q); }
  });
  return { total, del };
}
function getTeamCounts(teamName, locs) {
  let total = 0, del = 0;
  (locs||[]).forEach(loc => { const c = getTeamLocCounts(teamName, loc); total += c.total; del += c.del; });
  return { total, del };
}
function getTeamItemTotal(teamName) {
  let t = 0;
  items().forEach(item => {
    const tq = item.team_quantities?.[teamName];
    if (tq) Object.values(tq).forEach(q => t += (parseInt(q, 10)||0));
  });
  return t;
}

// ── TEAM IMAGES ──
function renderTeamImages(teamName, teamData, tid) {
  const imgs = teamData.images || [];
  let h = '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:10px 16px;border-top:1px solid var(--border);background:var(--surface)">';
  h += '<button class="btn btn-ghost edit-only" style="font-size:12px;padding:5px 10px;flex-shrink:0" onclick="uploadTeamImage(\''+tid+'\',\''+escJs(teamName)+'\')">+ File</button>';
  imgs.forEach((img, idx) => {
    h += '<div style="position:relative;display:inline-flex">';
    if (img.dataUrl) {
      h += '<img src="'+img.dataUrl+'" style="height:60px;width:auto;max-width:100px;object-fit:cover;border-radius:6px;border:1px solid var(--border);cursor:pointer" onclick="viewTeamImage(\''+escJs(teamName)+'\','+idx+')" title="'+esc(img.caption||'')+'">';
    } else {
      h += '<div onclick="viewTeamImage(\''+escJs(teamName)+'\','+idx+')" style="height:60px;width:80px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;border-radius:6px;border:1px solid var(--border);background:var(--surface3);cursor:pointer" title="'+esc(img.caption||'')+'">'+icon('file',22)+'<span style="font-size:9px;color:var(--text-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:72px">'+esc(img.caption||'file')+'</span></div>';
    }
    h += '<button class="edit-only" onclick="removeTeamImage(\''+tid+'\',\''+escJs(teamName)+'\','+idx+')" style="position:absolute;top:-6px;right:-6px;background:#ff1744;color:#fff;border:none;border-radius:50%;width:16px;height:16px;font-size:10px;cursor:pointer;padding:0;line-height:1">x</button>';
    h += '</div>';
  });
  if (!imgs.length) h += '<span style="font-size:12px;color:var(--text-dim)">No files attached yet</span>';
  h += '</div>';
  return h;
}

function uploadTeamImage(tid, teamName) {
  const input = document.createElement('input');
  input.type = 'file'; input.accept = '*/*'; input.multiple = true;
  input.onchange = e => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    // Disable upload button during processing
    const btn = document.querySelector(`#team-${tid} .edit-only[onclick*="uploadTeamImage"]`);
    if (btn) { btn.disabled = true; btn.textContent = 'Uploading…'; }
    let loaded = 0;
    const finish = () => {
      loaded++;
      if (loaded === files.length) {
        if (btn) { btn.disabled = false; btn.textContent = '+ File'; }
        const sec = document.getElementById('timages-' + tid);
        if (sec) sec.innerHTML = renderTeamImages(teamName, cd().teams[teamName], tid);
      }
    };
    files.forEach(file => {
      if (file.size > 1_500_000) {
        showToast(`"${file.name}" too large (max ~1 MB). Compress or use a smaller file.`, 'error');
        finish();
        return;
      }
      const teamData = cd().teams[teamName];
      if (!teamData) { finish(); return; }
      if (!teamData.images) teamData.images = [];
      if (file.type.startsWith('image/')) {
        const img = new Image();
        const objectUrl = URL.createObjectURL(file);
        img.onload = () => {
          URL.revokeObjectURL(objectUrl);
          const MAX_W = 800;
          const scale = img.width > MAX_W ? MAX_W / img.width : 1;
          const canvas = document.createElement('canvas');
          canvas.width = Math.round(img.width * scale);
          canvas.height = Math.round(img.height * scale);
          canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
          teamData.images.push({ dataUrl, caption: file.name });
          save();
          showToast(`File attached: ${file.name}`, 'success');
          finish();
        };
        img.onerror = () => { URL.revokeObjectURL(objectUrl); finish(); };
        img.src = objectUrl;
      } else {
        // Non-image: store metadata only, no base64
        teamData.images.push({ dataUrl: null, caption: file.name, meta: { name: file.name, size: file.size, type: file.type } });
        save();
        showToast(`File attached: ${file.name}`, 'success');
        finish();
      }
    });
  };
  input.click();
}

function removeTeamImage(tid, teamName, idx) {
  const teamData = cd().teams[teamName];
  if (!teamData || !teamData.images) return;
  teamData.images.splice(idx, 1);
  save();
  const sec = document.getElementById('timages-' + tid);
  if (sec) sec.innerHTML = renderTeamImages(teamName, cd().teams[teamName], tid);
}

function viewTeamImage(teamName, idx) {
  const teamData = cd().teams[teamName];
  const img = teamData && teamData.images && teamData.images[idx];
  if (!img) return;
  setModal('<div class="modal-title">' + esc(img.caption || 'Photo') + '<button class="modal-close" onclick="closeModal()">x</button></div><div style="padding:16px;text-align:center"><img src="' + img.dataUrl + '" style="max-width:100%;max-height:72vh;border-radius:8px;object-fit:contain"><div style="margin-top:10px;font-size:12px;color:var(--text-muted)">' + esc(img.caption || '') + '</div></div>');
}

// Context store for team loc panels (mirrors _ctx for depts)
const _tctx = {}; // tid -> { teamName, locName }

function renderTeams(container) {
  const ts = teams();
  const color = CHAMP_COLORS[S.champ]||'#e10600';
  let html = `
    <div class="toolbar">
      <input class="search-box" id="tm-search" placeholder="Search teams…" oninput="filterTeams(this.value)">
      <button class="btn btn-ghost" style="font-size:12px;padding:5px 12px;margin-left:auto" onclick="togglePOFPanel()">
        ${icon('download',13)} POF Import
      </button>
    </div>
    <div id="pof-import-panel" style="display:none;border:1px solid var(--border);border-radius:10px;padding:14px 16px;margin:0 0 12px;background:var(--surface2)">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
        <span style="font-size:13px;font-weight:700;color:var(--text)">POF Submissions — ${(S.champ||'').toUpperCase()} ${S.year}</span>
        <button class="btn btn-ghost" style="font-size:11px;padding:3px 8px" onclick="refreshPOFPanel()">↺ Refresh</button>
      </div>
      <div id="pof-panel-content"></div>
    </div>
    <div class="dept-accordion" id="team-accordion">`;

  if (!ts.length) {
    html += `<div style="padding:40px;text-align:center;color:var(--text-muted)">
      <div style="margin-bottom:12px;display:flex;justify-content:center">${icon('flag',32)}</div>
      <div style="font-size:15px;font-weight:600;margin-bottom:6px">No teams yet</div>
      <div style="font-size:13px">Click <strong>+ Team</strong> in the top bar to add a team.</div>
    </div>`;
  }

  ts.forEach(([teamName, teamData], idx) => {
    const c = DEPT_COLORS[(idx + 5) % DEPT_COLORS.length];
    const locs = Object.keys(teamData.locations||{});
    const { total, del } = getTeamCounts(teamName, locs);
    const pct = total > 0 ? Math.round(del/total*100) : 0;
    const tid = teamSlug(teamName);
    const isOpen = S.openTeam === tid;
    html += `
      <div class="dept-block${isOpen?' open':''}" id="team-${tid}" data-team="${esc(teamName)}">
        <div class="dept-header" onclick="toggleTeam('${tid}','${escJs(teamName)}')">
          <span class="dept-chevron">${icon('chevron-r',14)}</span>
          <span class="dept-color-dot" style="background:${c}"></span>
          <input id="team-name-input-${tid}" value="${esc(teamName)}" onclick="event.stopPropagation()" onblur="renameTeam('${tid}','${escJs(teamName)}',this.value)" onkeydown="if(event.key==='Enter'){event.preventDefault();this.blur()}else if(event.key==='Escape'){this.value='${escJs(teamName)}';this.blur()}" style="font-weight:700;font-size:14px;flex:1;background:transparent;border:none;border-bottom:1px dashed var(--border);color:var(--text);cursor:text;padding:0 0 1px;outline:none;min-width:0" class="team-name-edit edit-only">
          <span class="view-only-name" style="font-weight:700;font-size:14px;flex:1">${esc(teamName)}</span>
          <div class="dept-stats">
            <span class="dept-stat" style="color:var(--text-muted);font-size:11px">Villa <strong>${teamData.villa||'—'}</strong></span>
            <span class="dept-stat" style="color:var(--text-muted);font-size:11px">Pitbox <strong>${teamData.pitbox||'—'}</strong></span>
            <span class="dept-stat"><strong>${locs.length}</strong> locs</span>
            <span class="dept-stat"><strong>${total}</strong> items</span>
            <span class="dept-stat" style="color:${pct===100?'var(--success)':pct>50?'var(--warning)':'var(--text-muted)'}"><strong>${pct}%</strong> done</span>
          </div>
          <div class="dept-header-btns" onclick="event.stopPropagation()">
            <button class="dept-export-btn" onclick="exportTeam('${escJs(teamName)}')">${icon('download',13)} Export</button>
            <button class="dept-add-loc-btn" onclick="showAddTeamLocModal('${escJs(teamName)}')">+ Location</button>
            <button class="dept-add-loc-btn" style="background:var(--surface3)" onclick="showEditTeamModal('${escJs(teamName)}')">${icon('pencil',13)} Edit</button>
            <button class="dept-del-btn" onclick="deleteTeam('${escJs(teamName)}')">${icon('trash',13)} Delete</button>
          </div>
        </div>
        <div class="dept-body" id="team-body-${tid}">
          ${renderTeamBody(teamName, teamData, tid, c)}
        </div>
      </div>`;
  });

  html += `</div>`;
  container.innerHTML = html;
}

function filterTeams(q) {
  q = (q||'').toLowerCase();
  document.querySelectorAll('#team-accordion .dept-block').forEach(el => {
    const name = (el.dataset.team||'').toLowerCase();
    el.style.display = (!q || name.includes(q)) ? '' : 'none';
  });
}

function togglePOFPanel() {
  const panel = document.getElementById('pof-import-panel');
  if (!panel) return;
  const isOpen = panel.style.display !== 'none';
  panel.style.display = isOpen ? 'none' : '';
  if (!isOpen) refreshPOFPanel();
}

function refreshPOFPanel() {
  const content = document.getElementById('pof-panel-content');
  if (!content) return;
  if (typeof showPOFImportPanel === 'function') {
    showPOFImportPanel(content);
  } else {
    content.innerHTML = '<p style="font-size:12px;color:var(--text-muted)">POF import module not loaded. Ensure js/pof-import.js is included.</p>';
  }
}

function toggleTeam(tid, teamName) {
  const el = document.getElementById(`team-${tid}`);
  if (el.classList.contains('open')) {
    el.classList.remove('open');
    S.openTeam = null;
  } else {
    document.querySelectorAll('#team-accordion .dept-block.open').forEach(d => d.classList.remove('open'));
    el.classList.add('open');
    S.openTeam = tid;
  }
}

function renderTeamBody(teamName, teamData, tid, color) {
  const locs = Object.entries(teamData.locations||{});
  if (!locs.length) return `<div style="padding:20px;color:var(--text-muted);font-size:13px">No locations yet — click "+ Location" to add one (e.g. "Villa 3 GF", "Pitbox 7").</div>`;

  const activeLoc = S.activeTeamLoc[tid] && teamData.locations[S.activeTeamLoc[tid]]
    ? S.activeTeamLoc[tid]
    : locs[0][0];
  if (!S.activeTeamLoc[tid]) S.activeTeamLoc[tid] = activeLoc;

  const isSummary = activeLoc === '_summary';
  let html = `<div class="loc-tabs-bar" id="tloc-tabs-${tid}">`;
  html += `<div class="loc-tab${isSummary?' active':''}" id="tlt-${tid}-_summary" data-team="${esc(teamName)}" data-loc="_summary" data-tid="${tid}" onclick="handleTeamLocTabClick(this)" style="font-style:italic">
    <span>${icon('chart',13)} All Items</span>
  </div>`;
  locs.forEach(([locName]) => {
    const { total, del } = getTeamLocCounts(teamName, locName);
    const isActive = !isSummary && locName === activeLoc;
    html += `<div class="loc-tab${isActive?' active':''}" id="tlt-${tid}-${slug(locName)}" data-team="${esc(teamName)}" data-loc="${esc(locName)}" data-tid="${tid}" onclick="handleTeamLocTabClick(this)">
      <span>${esc(locName.length>26?locName.slice(0,26)+'…':locName)}</span>
      <span class="loc-tab-count" style="color:${del===total&&total>0?'var(--success)':'var(--text-muted)'}">(${del}/${total})</span>
      <button class="loc-tab-del" onclick="event.stopPropagation();deleteTeamLocByTab(this)" title="Delete location">${icon('x',14)}</button>
    </div>`;
  });
  html += `</div>`;
  const detailContent = isSummary
    ? renderTeamSummary(teamName, teamData, tid)
    : renderTeamLocDetail(teamName, activeLoc, teamData.locations[activeLoc]||{}, tid);
  html += `<div class="loc-detail" id="tloc-detail-${tid}">${detailContent}</div>`;
  html += `<div class="team-images-section" id="timages-${tid}">${renderTeamImages(teamName, teamData, tid)}</div>`;
  return html;
}

function handleTeamLocTabClick(el) {
  const teamName = el.dataset.team;
  const locName = el.dataset.loc;
  const tid = el.dataset.tid;
  switchTeamLoc(tid, teamName, locName);
}

function switchTeamLoc(tid, teamName, locName) {
  S.activeTeamLoc[tid] = locName;
  const tabsBar = document.getElementById(`tloc-tabs-${tid}`);
  if (tabsBar) {
    tabsBar.querySelectorAll('.loc-tab').forEach(t => t.classList.remove('active'));
    const tabId = locName === '_summary' ? `tlt-${tid}-_summary` : `tlt-${tid}-${slug(locName)}`;
    const target = document.getElementById(tabId);
    if (target) target.classList.add('active');
  }
  const detail = document.getElementById(`tloc-detail-${tid}`);
  const teamData = cd().teams[teamName];
  if (detail && teamData) {
    if (locName === '_summary') {
      detail.innerHTML = renderTeamSummary(teamName, teamData, tid);
    } else {
      detail.innerHTML = renderTeamLocDetail(teamName, locName, teamData.locations[locName]||{}, tid);
    }
  }
}

function renderTeamSummary(teamName, teamData, tid) {
  const locs = Object.keys(teamData.locations||{});
  const its = items();
  const rows = [];
  its.forEach(item => {
    const tq = item.team_quantities?.[teamName];
    if (!tq) return;
    let teamTotal = 0;
    const locBreakdown = [];
    locs.forEach(loc => {
      const q = parseInt(tq[loc]||0, 10);
      if (q > 0) { teamTotal += q; locBreakdown.push({loc, q}); }
    });
    if (teamTotal === 0) return;
    const totalStock = (item.lic_inventory||0) + (item.moys_lic||0) + (item.aspire||0);
    const coverPct = totalStock > 0 ? Math.round(Math.min(teamTotal, totalStock) / teamTotal * 100) : 0;
    const covered = totalStock >= teamTotal;
    rows.push({item, teamTotal, totalStock, coverPct, covered, locBreakdown});
  });
  rows.sort((a,b) => b.teamTotal - a.teamTotal);
  if (!rows.length) return `<div style="padding:24px;color:var(--text-muted);font-size:13px">No items assigned to this team.</div>`;

  let html = `<div style="padding:12px 16px">
    <div style="margin-bottom:12px;font-size:12px;color:var(--text-muted)">Team need vs available LIC stock.</div>
    <div style="overflow-x:auto">
    <table class="dept-summary-table">
      <thead><tr>
        <th>Item</th><th>Category</th>
        <th style="text-align:right">Team Needs</th>
        <th style="text-align:right">LIC Stock</th>
        <th style="text-align:right">Surplus / Shortfall</th>
        <th>Coverage</th><th>Locations</th>
      </tr></thead><tbody>`;
  rows.forEach(({item, teamTotal, totalStock, coverPct, covered, locBreakdown}) => {
    const cat = item.category || categorize(item.name);
    const diff = totalStock - teamTotal;
    const diffColor = diff >= 0 ? 'var(--success)' : 'var(--danger)';
    const barColor = covered ? 'var(--success)' : coverPct > 50 ? 'var(--warning)' : 'var(--danger)';
    html += `<tr>
      <td style="font-weight:600;max-width:180px">${esc(item.name)}</td>
      <td><span class="cat-badge">${esc(cat)}</span></td>
      <td style="text-align:right;font-weight:700;font-size:13px">${teamTotal}</td>
      <td style="text-align:right;font-weight:600">${totalStock}</td>
      <td style="text-align:right;font-weight:700;color:${diffColor}">${diff>=0?'+':''}${diff}</td>
      <td style="white-space:nowrap">
        <span style="font-weight:700;font-size:12px;color:${barColor};min-width:36px;display:inline-block">${coverPct}%</span>
        <span class="usage-bar-wrap"><span class="usage-bar-fill" style="width:${Math.min(coverPct,100)}%;background:${barColor};display:block;height:100%"></span></span>
      </td>
      <td style="font-size:11px;color:var(--text-muted)">
        ${locBreakdown.map(({loc,q})=>`<span style="display:inline-block;background:var(--surface3);padding:1px 5px;border-radius:3px;margin:1px;white-space:nowrap">${esc(loc.length>16?loc.slice(0,16)+'…':loc)}: <strong>${q}</strong></span>`).join('')}
      </td>
    </tr>`;
  });
  const gTeam = rows.reduce((s,r)=>s+r.teamTotal,0);
  const gStock = rows.reduce((s,r)=>s+r.totalStock,0);
  const gDiff = gStock - gTeam;
  html += `</tbody><tfoot><tr style="background:var(--surface2)">
    <td colspan="2" style="font-weight:700;padding:8px 10px">Total</td>
    <td style="text-align:right;font-weight:700;padding:8px 10px">${gTeam}</td>
    <td style="text-align:right;font-weight:700;padding:8px 10px">${gStock}</td>
    <td style="text-align:right;font-weight:700;padding:8px 10px;color:${gDiff>=0?'var(--success)':'var(--danger)'}">${gDiff>=0?'+':''}${gDiff}</td>
    <td colspan="2" style="padding:8px 10px;color:var(--text-muted);font-size:11px">${rows.length} item types · ${locs.length} location${locs.length!==1?'s':''}</td>
  </tr></tfoot></table></div></div>`;
  return html;
}

// Exact group order and item names from WEC & TEAMS order.code matrix.xlsx
// Keys are lowercased actual item names from INITIAL_DATA — do not change order
const GROUP_ORDER = [
  'KITCHEN ITEMS','TABLES','CHAIRS','SOFA','OTHERS','WATER','BEVERAGES',
  'PRINTING PAPER','AUDIO VISUAL & ELECTRICAL','GASES - FUEL - CHEMICALS',
  'HEAVY MACHINERY AND VEHICLES','IT & NETWORK',
];

const EXCEL_GROUP_ITEMS = {
  'KITCHEN ITEMS': [
    'single-door standard refrigerator (220l)','2 door standard refrigerator (220l)',
    '2 door 450l refrigerator','double-door refrigerated merchandiser',
    'chest freezer 150-200l','washing up liquid',
    'kitchen anti-slip mat 1500x900mm','kitchen anti-slip mat 900x700mm',
    'dishwasher fluid','rinse aid','ice cubes','dishwasher salt',
  ],
  'TABLES': [
    'foldable table','patio table','nova desk bench','white standard desk',
    'server high table','vitra bistro high tables','bella coffee table',
  ],
  'CHAIRS': [
    'plastic chair','upholstered chair','office chair on wheels',
    'barstool','hospitality chair','visitor chair','patio chair',
  ],
  'SOFA': ['sofa set','two seater sofa'],
  'OTHERS': [
    'internal wall partition','internal door','waste bin 15 liters',
    'oscillating fan free standing','wheely bin 240 liters','grey carpet',
  ],
  'WATER': [
    'still water \u2014 glass bottles 500ml','still water \u2014 glass bottles 250ml',
    'sparkling water \u2014 glass bottles 250ml','dispenser water','dispenser water 20l',
  ],
  'BEVERAGES': [
    'coke \u2014 cans','coke light \u2014 cans','sprite \u2014 cans','fanta \u2014 cans',
    'ginger ale \u2014 cans','pocari sweat \u2014 cans','red bull original',
    'ice tea lemon \u2014 cans','ice tea peach \u2014 cans','paper cups',
  ],
  'PRINTING PAPER': ['a4 paper','a3 paper'],
  'AUDIO VISUAL & ELECTRICAL': ['led screen 40\u201d tv','extension cable 5m length','tv stands'],
  'GASES - FUEL - CHEMICALS': [
    'nitrogen \u2014 industrial grade','nitrogen \u2014 high grade 99.998%',
    'synthetic air \u2014 zero grade','hydrogen','carbon dioxide 99.9%','argon',
    'regulator (purchase only) \u2014 bs3 outlet','regulator (purchase only) \u2014 bs4 outlet',
    'dry ice 25kg \u2014 thursday','dry ice 25kg \u2014 friday',
    'dry ice 25kg \u2014 saturday','dry ice 25kg \u2014 sunday',
    'dry ice storage box rental','co2 fire extinguisher',
    'dry chemical powder extinguisher','afff fire extinguisher','water fire extinguisher',
    'brake cleaner \u2014 cans','brake cleaner','acetone','distilled water',
  ],
  'HEAVY MACHINERY AND VEHICLES': [
    '3t forklift 1.2m forks \u2014 continuous rental','3t forklift 1.2m forks \u2014 pre-event',
    '3t forklift 1.2m forks \u2014 live event','3t forklift 1.2m forks \u2014 post-event',
    '3t fork extensions 1.8m','3t fork extensions 2.1m','3t fork extensions 2.4m',
    '5t forklift 1.2m forks \u2014 continuous rental','5t forklift 1.2m forks \u2014 pre-event',
    '5t forklift 1.2m forks \u2014 live event','5t forklift 1.2m forks \u2014 post-event',
    '5t fork extensions 1.8m','5t fork extensions 2.1m','5t fork extensions 2.4m',
    '7t forklift 2.1m forks \u2014 continuous rental','7t forklift 2.1m forks \u2014 pre-event',
    '7t forklift 2.1m forks \u2014 live event','7t forklift 2.1m forks \u2014 post-event',
    '7t fork extensions 1.8m','7t fork extensions 2.1m','7t fork extensions 2.4m',
    '10t forklift \u2014 continuous rental','10t forklift \u2014 pre-event',
    '10t forklift \u2014 live event','10t forklift \u2014 post-event',
    '10t fork extensions 1.8m','10t fork extensions 2.1m','10t fork extensions 2.4m',
    'pallet trolley 2t','4-seater electric club car','6-seater electric club car','window frosting',
  ],
  'IT & NETWORK': [
    'business broadband 50/100 mbps','business broadband 125/250 mbps',
    'business broadband 250/500 mbps','business broadband 500mbps/1gbps',
    'idd landline (international access)',
    'fibre 1 day','fibre 2 days','fibre 3 days','fibre 4 days',
    'fibre 5 days','fibre 6 days','fibre 7 days',
  ],
};

// Reverse lookup: lowercase item name → group (built once at load time)
const _ITEM_GROUP_MAP = {};
for (const [group, names] of Object.entries(EXCEL_GROUP_ITEMS)) {
  names.forEach(n => { _ITEM_GROUP_MAP[n] = group; });
}

function _matchExcelGroup(itemName) {
  return _ITEM_GROUP_MAP[(itemName || '').toLowerCase().trim()] || 'OTHER';
}

function buildTeamsMenuOptions(locItems) {
  const allItems = items();
  const locItemIds = new Set(locItems.map(li => li.id));

  const grouped = {};
  allItems.forEach(item => {
    if (locItemIds.has(item.id)) return;
    const group = _matchExcelGroup(item.name);
    if (!grouped[group]) grouped[group] = [];
    grouped[group].push(item);
  });

  if (!Object.keys(grouped).length) return '';

  // Sort items within each group to match Excel row order
  for (const group of GROUP_ORDER) {
    if (!grouped[group]) continue;
    const orderList = EXCEL_GROUP_ITEMS[group] || [];
    grouped[group].sort((a, b) => {
      const ai = orderList.indexOf(a.name.toLowerCase().trim());
      const bi = orderList.indexOf(b.name.toLowerCase().trim());
      return (ai === -1 ? 9999 : ai) - (bi === -1 ? 9999 : bi);
    });
  }

  // Render optgroups in Excel order, then any unrecognised items
  const rendered = [];
  [...GROUP_ORDER, ...Object.keys(grouped).filter(g => !GROUP_ORDER.includes(g))].forEach(group => {
    if (!grouped[group] || !grouped[group].length) return;
    const opts = grouped[group].map(i =>
      '<option value="' + i.id + '">' + esc(i.name) + '</option>'
    ).join('');
    rendered.push('<optgroup label="' + esc(group) + '">' + opts + '</optgroup>');
  });
  return rendered.join('');
}

function renderTeamLocDetail(teamName, locName, locInfo, tid) {
  _tctx[tid] = { teamName, locName };
  const its = items();
  const locItems = its.filter(i => (parseInt(i.team_quantities?.[teamName]?.[locName], 10)||0) > 0);
  const { total, del } = getTeamLocCounts(teamName, locName);

  let html = `
    <div class="loc-meta">
      <div class="loc-meta-item">
        <div class="loc-meta-label">Location</div>
        <input class="loc-meta-input" value="${esc(locName)}" style="min-width:180px" onblur="renameTeamLocCtx('${tid}',this.value)">
      </div>
      <div class="loc-meta-item">
        <div class="loc-meta-label">Bump In</div>
        <input class="loc-meta-input" type="date" value="${locInfo.bump_in||''}" onchange="updateTeamLocMetaCtx('${tid}','bump_in',this.value)">
      </div>
      <div class="loc-meta-item">
        <div class="loc-meta-label">Bump Out</div>
        <input class="loc-meta-input" type="date" value="${locInfo.bump_out||''}" onchange="updateTeamLocMetaCtx('${tid}','bump_out',this.value)">
      </div>
      <div class="loc-meta-item" style="margin-left:auto;justify-content:flex-end">
        <div class="loc-meta-label">Delivery</div>
        <div style="display:flex;align-items:center;gap:8px">
          <span id="tdel-counter-${tid}" style="font-size:13px;font-weight:700;color:${del===total&&total>0?'var(--success)':del>0?'var(--warning)':'var(--text-muted)'}">${del}/${total}</span>
          <button class="done-loc-btn" onclick="markTeamLocDoneCtx('${tid}')">${icon('check',13)} Done</button>
        </div>
      </div>
    </div>
    <div class="items-table-wrap">
      <table class="items-table">
        <thead><tr>
          <th>Item</th><th>Desc / Dimensions</th><th>Category</th><th>Qty Requested</th><th>Delivered</th><th>Status</th><th></th>
        </tr></thead>
        <tbody id="tloc-items-${tid}">`;

  locItems.forEach(item => {
    const qty = parseInt(item.team_quantities[teamName][locName], 10)||0;
    const dval = getTeamDelivered(teamName, locName, item.id);
    const pct = qty > 0 ? Math.round(dval/qty*100) : 0;
    const sc = pct===100?'var(--success)':pct>0?'var(--warning)':'var(--text-muted)';
    const cat = item.category||categorize(item.name);
    // POF heavy-machinery submissions attach a mast/date note on the team_quantities
    // map itself (see pof-import.js) — surface it here instead of leaving it hidden.
    const pofNote = item.team_quantities[teamName]['_pof_note'];
    const descHtml = esc(item.description||'—') + (pofNote ? `<div style="color:var(--warning);margin-top:2px">${esc(pofNote)}</div>` : '');
    html += `<tr data-item-id="${item.id}" data-qty="${qty}">
      <td style="font-weight:600;max-width:160px">${esc(item.name)}</td>
      <td style="color:var(--text-muted);font-size:12px;max-width:150px">${descHtml}</td>
      <td><span class="cat-badge">${esc(cat)}</span></td>
      <td><input class="qty-input qty-req" type="number" min="0" value="${qty}" oninput="updateTeamQtyCtx('${tid}','${item.id}',this.value,this)"></td>
      <td><input class="qty-input qty-del" type="number" min="0" max="${qty}" value="${dval}" oninput="updateTeamDelCtx('${tid}','${item.id}',this.value,this)"></td>
      <td class="status-cell" style="min-width:80px">
        <div class="status-pct" style="color:${sc};font-size:12px;font-weight:600">${pct}%</div>
        <div class="progress-mini"><div class="progress-mini-fill" style="width:${pct}%;background:${sc}"></div></div>
      </td>
      <td><button class="del-row-btn" onclick="removeTeamItemCtx('${tid}','${item.id}')">${icon('x',12)}</button></td>
    </tr>`;
  });

  html += `</tbody></table>
    <div class="add-item-row">
      <select class="add-item-select" id="tadd-sel-${tid}">
        <option value="">— Add item to this location —</option>
        ${buildTeamsMenuOptions(locItems)}
      </select>
      <input class="qty-input" type="number" min="1" value="1" id="tadd-qty-${tid}">
      <button class="btn btn-primary" style="font-size:12px;padding:7px 12px" onclick="addItemToTeamLocCtx('${tid}')">Add</button>
    </div>
  </div>`;
  return html;
}

// ── TEAM CTX HANDLERS ──
function updateTeamQtyCtx(tid, itemId, val, input) {
  const {teamName, locName} = _tctx[tid]||{};
  if (!teamName) return;
  const qty = parseQty(val);
  const item = items().find(i=>i.id===itemId);
  if (!item) return;
  if (!item.team_quantities) item.team_quantities = {};
  if (!item.team_quantities[teamName]) item.team_quantities[teamName] = {};
  item.team_quantities[teamName][locName] = qty;
  recalcTotalNeeded(item);
  recalcDeficit(item);
  refreshDeficitPill(itemId);
  refreshTeamTotalCell(itemId);
  debouncedSave();
}

function updateTeamDelCtx(tid, itemId, val, input) {
  const {teamName, locName} = _tctx[tid]||{};
  if (!teamName) return;
  const item = items().find(i=>i.id===itemId);
  const qty = parseInt(item?.team_quantities?.[teamName]?.[locName]||0, 10);
  const d = Math.min(parseQty(val), qty);
  if (input) input.value = d;
  setTeamDelivered(teamName, locName, itemId, d);
  const row = input?.closest('tr');
  if (row) {
    const pct = qty > 0 ? Math.round(d/qty*100) : 0;
    const sc = pct===100?'var(--success)':pct>0?'var(--warning)':'var(--text-muted)';
    const sp = row.querySelector('.status-pct');
    const bar = row.querySelector('.progress-mini-fill');
    if (sp) { sp.textContent = pct+'%'; sp.style.color = sc; }
    if (bar) { bar.style.width = pct+'%'; bar.style.background = sc; }
  }
  refreshTeamDelCounter(tid, teamName, locName);
  refreshTeamLocTabCount(tid, teamName, locName);
  refreshTeamStats(tid, teamName);
}

function removeTeamItemCtx(tid, itemId) {
  const {teamName, locName} = _tctx[tid]||{};
  if (!teamName) return;
  const item = items().find(i=>i.id===itemId);
  if (!item) return;
  delete item.team_quantities[teamName][locName];
  recalcTotalNeeded(item);
  recalcDeficit(item);
  refreshDeficitPill(itemId);
  refreshTeamTotalCell(itemId);
  save();
  reRenderTeamDetail(tid);
  showToast('Item removed','success');
}

function addItemToTeamLocCtx(tid) {
  const {teamName, locName} = _tctx[tid]||{};
  if (!teamName) return;
  const sel = document.getElementById(`tadd-sel-${tid}`);
  const qtyEl = document.getElementById(`tadd-qty-${tid}`);
  const itemId = sel?.value;
  if (!itemId) return showToast('Select an item first','error');
  const qty = Math.max(1, parseInt(qtyEl?.value, 10)||1);
  const item = items().find(i=>i.id===itemId);
  if (!item) return;
  if (!item.team_quantities) item.team_quantities = {};
  if (!item.team_quantities[teamName]) item.team_quantities[teamName] = {};
  item.team_quantities[teamName][locName] = qty;
  recalcTotalNeeded(item);
  recalcDeficit(item);
  refreshDeficitPill(item.id);
  refreshTeamTotalCell(item.id);
  save();
  reRenderTeamDetail(tid);
  showToast(`${item.name} added`,'success');
}

function markTeamLocDoneCtx(tid) {
  const {teamName, locName} = _tctx[tid]||{};
  if (!teamName) return;
  const {total, del} = getTeamLocCounts(teamName, locName);
  const allDone = total > 0 && del === total;
  items().forEach(item => {
    const qty = parseInt(item.team_quantities?.[teamName]?.[locName]||0, 10);
    if (qty > 0) setTeamDelivered(teamName, locName, item.id, allDone ? 0 : qty);
  });
  reRenderTeamDetail(tid);
  refreshTeamLocTabCount(tid, teamName, locName);
  refreshTeamStats(tid, teamName);
  showToast(allDone ? 'Delivery reset to 0' : 'All items marked as delivered ✓', allDone ? 'error' : 'success');
}

function updateTeamLocMetaCtx(tid, field, value) {
  const {teamName, locName} = _tctx[tid]||{};
  if (!teamName) return;
  const team = cd().teams[teamName];
  if (team?.locations?.[locName]) { team.locations[locName][field] = value; save(); }
}

function renameTeamLocCtx(tid, newName) {
  const {teamName, locName} = _tctx[tid]||{};
  if (!teamName) return;
  newName = newName.trim();
  if (!newName || newName === locName) return;
  const team = cd().teams[teamName];
  if (!team?.locations?.[locName]) return;
  team.locations[newName] = team.locations[locName];
  delete team.locations[locName];
  items().forEach(item => {
    if (item.team_quantities?.[teamName]?.[locName] !== undefined) {
      item.team_quantities[teamName][newName] = item.team_quantities[teamName][locName];
      delete item.team_quantities[teamName][locName];
    }
  });
  _tctx[tid].locName = newName;
  S.activeTeamLoc[tid] = newName;
  save();
  const idx = teams().findIndex(([k])=>k===teamName);
  const bodyEl = document.getElementById(`team-body-${tid}`);
  if (bodyEl) bodyEl.innerHTML = renderTeamBody(teamName, team, tid, DEPT_COLORS[(idx+5)%DEPT_COLORS.length]);
  showToast('Location renamed','success');
}

function deleteTeamLocByTab(btn) {
  const tab = btn.closest('.loc-tab');
  if (!tab) return;
  const teamName = tab.dataset.team;
  const locName  = tab.dataset.loc;
  const tid      = tab.dataset.tid;
  if (!confirm(`Delete location "${locName}"?`)) return;
  const team = cd().teams[teamName];
  if (!team) return;
  delete team.locations[locName];
  items().forEach(item => { if (item.team_quantities?.[teamName]) delete item.team_quantities[teamName][locName]; });
  // Remove delivery entries for this team+loc
  if (S.data.deliveries) {
    const pfx = `TEAM||${teamName}||${locName}||`;
    Object.keys(S.data.deliveries).forEach(k => { if (k.startsWith(pfx)) delete S.data.deliveries[k]; });
  }
  if (S.activeTeamLoc[tid] === locName) delete S.activeTeamLoc[tid];
  if (_tctx[tid]?.locName === locName) delete _tctx[tid];
  save();
  const idx = teams().findIndex(([k])=>k===teamName);
  const bodyEl = document.getElementById(`team-body-${tid}`);
  if (bodyEl) bodyEl.innerHTML = renderTeamBody(teamName, team, tid, DEPT_COLORS[(idx+5)%DEPT_COLORS.length]);
  showToast('Location deleted','success');
}

function reRenderTeamDetail(tid) {
  const {teamName, locName} = _tctx[tid]||{};
  if (!teamName) return;
  const teamData = cd().teams[teamName];
  const detail = document.getElementById(`tloc-detail-${tid}`);
  if (detail && teamData) detail.innerHTML = renderTeamLocDetail(teamName, locName, teamData.locations[locName]||{}, tid);
}

function refreshTeamDelCounter(tid, teamName, locName) {
  const {total, del} = getTeamLocCounts(teamName, locName);
  const el = document.getElementById(`tdel-counter-${tid}`);
  if (el) { el.textContent = `${del}/${total}`; el.style.color = del===total&&total>0?'var(--success)':del>0?'var(--warning)':'var(--text-muted)'; }
}

function refreshTeamLocTabCount(tid, teamName, locName) {
  const { total, del } = getTeamLocCounts(teamName, locName);
  const tabEl = document.getElementById(`tlt-${tid}-${slug(locName)}`);
  if (tabEl) {
    const span = tabEl.querySelector('.loc-tab-count');
    if (span) { span.textContent = `(${del}/${total})`; span.style.color = del===total&&total>0?'var(--success)':'var(--text-muted)'; }
  }
}

function refreshTeamStats(tid, teamName) {
  const teamData = cd().teams[teamName];
  const locs = Object.keys(teamData?.locations||{});
  const { total, del } = getTeamCounts(teamName, locs);
  const pct = total > 0 ? Math.round(del/total*100) : 0;
  const block = document.getElementById(`team-${tid}`);
  if (block) {
    const statEls = block.querySelectorAll('.dept-stat');
    // Last stat is pct — it's the 5th element (0-indexed: 4)
    if (statEls[4]) {
      statEls[4].style.color = pct===100?'var(--success)':pct>50?'var(--warning)':'var(--text-muted)';
      statEls[4].innerHTML = `<strong>${pct}%</strong> done`;
    }
  }
}

function refreshTeamTotalCell(itemId) {
  // Update the teams total cell in master view for this item if visible
  const row = document.querySelector(`#inv-tbody tr[data-item-id="${itemId}"]`);
  if (!row) return;
  const item = items().find(i=>i.id===itemId);
  if (!item) return;
  let teamsTotal = 0;
  Object.values(item.team_quantities||{}).forEach(tq => Object.values(tq).forEach(q => teamsTotal += (parseInt(q, 10)||0)));
  // Teams column is index 3 (0=name,1=cat,2=depts,3=teams,4=total)
  const cells = row.querySelectorAll('td');
  if (cells[3]) cells[3].textContent = teamsTotal;
  if (cells[4]) cells[4].textContent = item.total_needed||0;
  row.dataset.teamtotal = teamsTotal;
  row.dataset.total = item.total_needed||0;
}

function deleteTeam(teamName) {
  if (!confirm(`Delete team "${teamName}" and all its data?`)) return;
  delete cd().teams[teamName];
  items().forEach(item => { if (item.team_quantities) delete item.team_quantities[teamName]; recalcTotalNeeded(item); recalcDeficit(item); });
  // Remove all delivery entries for this team
  if (S.data.deliveries) {
    const pfx = `TEAM||${teamName}||`;
    Object.keys(S.data.deliveries).forEach(k => { if (k.startsWith(pfx)) delete S.data.deliveries[k]; });
  }
  save();
  renderTab('teams');
  showToast(`Team "${teamName}" deleted`,'success');
}

// ── TEAM MODALS ──

function renameTeam(tid, oldName, newName) {
  newName = (newName || '').trim();
  if (!newName || newName === oldName) {
    // revert input
    const inp = document.getElementById('team-name-input-' + tid);
    if (inp) inp.value = oldName;
    return;
  }
  if (cd().teams[newName]) {
    showToast('A team named "' + newName + '" already exists', 'error');
    const inp = document.getElementById('team-name-input-' + tid);
    if (inp) inp.value = oldName;
    return;
  }
  // 1. Rename in teams object
  cd().teams[newName] = cd().teams[oldName];
  delete cd().teams[oldName];
  // 2. Rename in item.team_quantities
  items().forEach(item => {
    if (item.team_quantities && item.team_quantities[oldName] !== undefined) {
      item.team_quantities[newName] = item.team_quantities[oldName];
      delete item.team_quantities[oldName];
    }
  });
  // 3. Rename delivery blob keys: TEAM||{teamName}||... → TEAM||{newName}||...
  if (S.data.deliveries) {
    const oldPfx = `TEAM||${oldName}||`;
    const newBlobPfx = `TEAM||${newName}||`;
    const toRename = Object.keys(S.data.deliveries).filter(k => k.startsWith(oldPfx));
    toRename.forEach(k => {
      S.data.deliveries[newBlobPfx + k.slice(oldPfx.length)] = S.data.deliveries[k];
      delete S.data.deliveries[k];
    });
  }
  // 4. Update S.openTeam if it was this team
  if (S.openTeam === tid) S.openTeam = teamSlug(newName);
  save();
  renderTab(S.tab);
  showToast('Team renamed to "' + newName + '"', 'success');
}

function showAddTeamModal() {
  setModal(`
    <div class="modal-title">Add Team<button class="modal-close" onclick="closeModal()">${icon('x',14)}</button></div>
    <div style="padding:20px;display:flex;flex-direction:column;gap:14px">
      <div>
        <div class="loc-meta-label" style="margin-bottom:4px">Team Name</div>
        <input class="loc-meta-input" id="new-team-name" style="width:100%" placeholder="e.g. FERRARI AF CORSE">
      </div>
      <div style="display:flex;gap:12px">
        <div style="flex:1">
          <div class="loc-meta-label" style="margin-bottom:4px">Villa # (1–16)</div>
          <input class="loc-meta-input" id="new-team-villa" type="number" min="1" max="16" style="width:100%" placeholder="e.g. 3">
        </div>
        <div style="flex:1">
          <div class="loc-meta-label" style="margin-bottom:4px">Pitbox # (1–50)</div>
          <input class="loc-meta-input" id="new-team-pitbox" type="number" min="1" max="50" style="width:100%" placeholder="e.g. 12">
        </div>
      </div>
      <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer">
        <input type="checkbox" id="new-team-autoloc" checked>
        Auto-create standard locations (GF, Offices 1–8, Pitbox)
      </label>
      <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:4px">
        <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
        <button class="btn btn-primary" onclick="addTeam()">Add Team</button>
      </div>
    </div>
  `);
  setTimeout(() => document.getElementById('new-team-name')?.focus(), 80);
}

function addTeam() {
  const name = document.getElementById('new-team-name')?.value.trim();
  if (!name) return showToast('Enter a team name','error');
  if (!cd().teams) cd().teams = {};
  if (cd().teams[name]) return showToast('Team already exists','error');
  const villa  = parseInt(document.getElementById('new-team-villa')?.value, 10)||0;
  const pitbox = parseInt(document.getElementById('new-team-pitbox')?.value, 10)||0;
  const autoLoc = document.getElementById('new-team-autoloc')?.checked;
  const locations = {};
  if (autoLoc) {
    locations[`Villa ${villa||'?'} - GF`] = { bump_in:'', bump_out:'' };
    for (let i = 1; i <= 8; i++) locations[`Villa ${villa||'?'} - Office ${i}`] = { bump_in:'', bump_out:'' };
    if (pitbox) locations[`Pitbox ${pitbox}`] = { bump_in:'', bump_out:'' };
  }
  cd().teams[name] = { villa, pitbox, locations };
  save();
  closeModal();
  renderTab('teams');
  showToast(`Team "${name}" added`,'success');
}

function showEditTeamModal(teamName) {
  const team = cd().teams[teamName];
  if (!team) return;
  setModal(`
    <div class="modal-title">Edit Team — ${esc(teamName)}<button class="modal-close" onclick="closeModal()">${icon('x',14)}</button></div>
    <div style="padding:20px;display:flex;flex-direction:column;gap:14px">
      <div style="display:flex;gap:12px">
        <div style="flex:1">
          <div class="loc-meta-label" style="margin-bottom:4px">Villa # (1–16)</div>
          <input class="loc-meta-input" id="edit-team-villa" type="number" min="1" max="16" value="${team.villa||''}" style="width:100%">
        </div>
        <div style="flex:1">
          <div class="loc-meta-label" style="margin-bottom:4px">Pitbox # (1–50)</div>
          <input class="loc-meta-input" id="edit-team-pitbox" type="number" min="1" max="50" value="${team.pitbox||''}" style="width:100%">
        </div>
      </div>
      <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:4px">
        <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
        <button class="btn btn-primary" onclick="saveTeamMeta('${escJs(teamName)}')">Save</button>
      </div>
    </div>
  `);
}

function saveTeamMeta(teamName) {
  const team = cd().teams[teamName];
  if (!team) return;
  team.villa  = parseInt(document.getElementById('edit-team-villa')?.value, 10)||0;
  team.pitbox = parseInt(document.getElementById('edit-team-pitbox')?.value, 10)||0;
  save();
  closeModal();
  renderTab('teams');
  showToast('Team updated','success');
}

function showAddTeamLocModal(teamName) {
  const team = cd().teams[teamName];
  if (!team) return;
  const v = team.villa||'?';
  const p = team.pitbox||'?';
  const suggestions = [
    `Villa ${v} - GF`,
    `Villa ${v} - Office 1`, `Villa ${v} - Office 2`, `Villa ${v} - Office 3`,
    `Villa ${v} - Office 4`, `Villa ${v} - Office 5`, `Villa ${v} - Office 6`,
    `Villa ${v} - Office 7`, `Villa ${v} - Office 8`,
    `Pitbox ${p}`
  ].filter(s => !team.locations[s]);

  setModal(`
    <div class="modal-title">Add Location — ${esc(teamName)}<button class="modal-close" onclick="closeModal()">${icon('x',14)}</button></div>
    <div style="padding:20px;display:flex;flex-direction:column;gap:14px">
      <div>
        <div class="loc-meta-label" style="margin-bottom:4px">Location Name</div>
        <input class="loc-meta-input" id="new-tloc-name" style="width:100%" placeholder="e.g. Villa 3 - GF or Pitbox 7"
          onkeydown="if(event.key==='Enter')addTeamLocation('${escJs(teamName)}')">
      </div>
      ${suggestions.length ? `<div style="font-size:12px;color:var(--text-muted)">Quick-add: ${suggestions.map(s=>`<button class="btn btn-ghost" style="font-size:11px;padding:3px 8px;margin:2px" onclick="document.getElementById('new-tloc-name').value='${escJs(s)}'">${esc(s)}</button>`).join('')}</div>` : ''}
      <div style="display:flex;gap:10px;justify-content:flex-end">
        <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
        <button class="btn btn-primary" onclick="addTeamLocation('${escJs(teamName)}')">Add</button>
      </div>
    </div>
  `);
  setTimeout(() => document.getElementById('new-tloc-name')?.focus(), 80);
}

function addTeamLocation(teamName) {
  const name = document.getElementById('new-tloc-name')?.value.trim();
  if (!name) return showToast('Enter a location name','error');
  const team = cd().teams[teamName];
  if (!team) return;
  if (team.locations[name]) return showToast('Location already exists','error');
  team.locations[name] = { bump_in:'', bump_out:'' };
  save();
  closeModal();
  const tid = teamSlug(teamName);
  S.activeTeamLoc[tid] = name;
  const idx = teams().findIndex(([k])=>k===teamName);
  const bodyEl = document.getElementById(`team-body-${tid}`);
  if (bodyEl) bodyEl.innerHTML = renderTeamBody(teamName, team, tid, DEPT_COLORS[(idx+5)%DEPT_COLORS.length]);
  showToast(`Location "${name}" added`,'success');
}

// ── TEAM EXPORT ──
function exportTeam(teamName) {
  const team = cd().teams[teamName];
  if (!team) return;
  const rows = [['Item','Category','Location','Qty Requested','Delivered','Bump In','Bump Out','LIC Stock','MOYS LIC','Aspire','Total Needed','Deficit','Notes']];
  Object.entries(team.locations||{}).forEach(([locName, locInfo]) => {
    items().forEach(item => {
      const qty = parseInt(item.team_quantities?.[teamName]?.[locName]||0, 10);
      if (!qty) return;
      const del = getTeamDelivered(teamName, locName, item.id);
      const avail = (item.lic_inventory||0) + (item.moys_lic||0) + (item.aspire||0);
      rows.push([item.name, item.category||categorize(item.name), locName, qty, del, locInfo.bump_in||'', locInfo.bump_out||'', item.lic_inventory||0, item.moys_lic||0, item.aspire||0, item.total_needed||0, item.deficit||0, item.notes||'']);
    });
  });
  if (rows.length === 1) { showToast('No items in this team','error'); return; }
  const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], {type:'text/csv'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `LIC_FFE_${(S.champ||'').toUpperCase()}_${S.year||''}_TEAM_${teamName.replace(/[^a-zA-Z0-9]/g,'_')}.csv`; a.click();
  URL.revokeObjectURL(url);
  showToast(`"${teamName}" exported`,'success');
}

// ── EXPORT ──
