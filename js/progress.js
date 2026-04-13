function renderProgress(container, section) {
  section = section || 'depts';
  const ds = depts();
  const ts = teams();
  const color = CHAMP_COLORS[S.champ]||'#e10600';

  let dTotalItems=0, dTotalDel=0;
  ds.forEach(([dn,dd]) => { const {total,del}=getDeptCounts(dn,Object.keys(dd.locations||{})); dTotalItems+=total; dTotalDel+=del; });
  let tTotalItems=0, tTotalDel=0;
  ts.forEach(([tn,td]) => { const {total,del}=getTeamCounts(tn,Object.keys(td.locations||{})); tTotalItems+=total; tTotalDel+=del; });

  const dPct = dTotalItems>0?Math.round(dTotalDel/dTotalItems*100):0;
  const tPct = tTotalItems>0?Math.round(tTotalDel/tTotalItems*100):0;

  let html = `
    <div class="stats-row" style="margin-bottom:20px">
      <div class="stat-card" style="--c:${color}">
        <div class="stat-label">Departments Progress</div>
        <div class="stat-value">${dPct}%</div>
        <div class="stat-sub">${dTotalDel} of ${dTotalItems} items</div>
        <div class="progress-bar" style="margin-top:12px"><div class="progress-bar-fill" style="width:${dPct}%;background:${color}"></div></div>
      </div>
      <div class="stat-card" style="--c:var(--accent)">
        <div class="stat-label">Teams Progress</div>
        <div class="stat-value">${tPct}%</div>
        <div class="stat-sub">${tTotalDel} of ${tTotalItems} items</div>
        <div class="progress-bar" style="margin-top:12px"><div class="progress-bar-fill" style="width:${tPct}%;background:var(--accent)"></div></div>
      </div>
      <div class="stat-card" style="--c:var(--success)">
        <div class="stat-label">Tracked</div>
        <div class="stat-value" style="font-size:18px">${ds.length} depts · ${ts.length} teams</div>
        <div class="stat-sub">${ds.reduce((s,[,d])=>s+Object.keys(d.locations||{}).length,0)} dept locs · ${ts.reduce((s,[,t])=>s+Object.keys(t.locations||{}).length,0)} team locs</div>
      </div>
    </div>
    <div style="display:flex;gap:8px;margin-bottom:16px">
      <button class="btn ${section==='depts'?'btn-primary':'btn-ghost'}" onclick="renderProgress(document.getElementById('main-content'),'depts')" style="font-size:13px">Departments</button>
      <button class="btn ${section==='teams'?'btn-primary':'btn-ghost'}" onclick="renderProgress(document.getElementById('main-content'),'teams')" style="font-size:13px">Teams</button>
    </div>`;

  if (section === 'depts') {
    html += `<div class="progress-grid">`;
    ds.forEach(([deptName, deptData], idx) => {
      const c = deptColor(idx);
      const locs = Object.entries(deptData.locations||{});
      const {total, del} = getDeptCounts(deptName, Object.keys(deptData.locations||{}));
      const pct = total>0?Math.round(del/total*100):0;
      html += `<div class="progress-card">
        <div class="progress-card-header">
          <div>
            <div class="progress-card-name">${esc(deptName)}</div>
            <div style="font-size:12px;color:var(--text-muted)">${locs.length} locations · ${total} items</div>
          </div>
          <div class="progress-pct" style="color:${pct===100?'var(--success)':pct>50?'var(--warning)':c}">${pct}%</div>
        </div>
        <div class="progress-bar"><div class="progress-bar-fill" style="width:${pct}%;background:${c}"></div></div>
        <div class="progress-locs">`;
      locs.forEach(([locName]) => {
        const {total:lt, del:ld} = getLocCounts(deptName, locName);
        const lp = lt>0?Math.round(ld/lt*100):0;
        const lc = lp===100?'var(--success)':lp>50?'var(--warning)':c;
        html += `<div class="progress-loc">
          <div class="progress-loc-header">
            <span class="progress-loc-name" title="${esc(locName)}">${esc(locName.length>34?locName.slice(0,34)+'…':locName)}</span>
            <span class="progress-loc-pct" style="color:${lc}">${lp}% (${ld}/${lt})</span>
          </div>
          <div class="progress-bar-sm"><div class="progress-bar-sm-fill" style="width:${lp}%;background:${lc}"></div></div>
        </div>`;
      });
      html += `</div></div>`;
    });
    html += `</div>`;
  } else {
    html += `<div class="progress-grid">`;
    if (!ts.length) {
      html += `<div style="color:var(--text-muted);font-size:14px;padding:24px">No teams added yet. Go to the Teams tab to add teams.</div>`;
    }
    ts.forEach(([teamName, teamData], idx) => {
      const c = DEPT_COLORS[(idx + 5) % DEPT_COLORS.length];
      const locs = Object.entries(teamData.locations||{});
      const {total, del} = getTeamCounts(teamName, Object.keys(teamData.locations||{}));
      const pct = total>0?Math.round(del/total*100):0;
      html += `<div class="progress-card">
        <div class="progress-card-header">
          <div>
            <div class="progress-card-name">${esc(teamName)}</div>
            <div style="font-size:12px;color:var(--text-muted)">Villa ${teamData.villa||'—'} · Pitbox ${teamData.pitbox||'—'} · ${locs.length} locations</div>
          </div>
          <div class="progress-pct" style="color:${pct===100?'var(--success)':pct>50?'var(--warning)':c}">${pct}%</div>
        </div>
        <div class="progress-bar"><div class="progress-bar-fill" style="width:${pct}%;background:${c}"></div></div>
        <div class="progress-locs">`;
      locs.forEach(([locName]) => {
        const {total:lt, del:ld} = getTeamLocCounts(teamName, locName);
        const lp = lt>0?Math.round(ld/lt*100):0;
        const lc = lp===100?'var(--success)':lp>50?'var(--warning)':c;
        html += `<div class="progress-loc">
          <div class="progress-loc-header">
            <span class="progress-loc-name" title="${esc(locName)}">${esc(locName.length>34?locName.slice(0,34)+'…':locName)}</span>
            <span class="progress-loc-pct" style="color:${lc}">${lp}% (${ld}/${lt})</span>
          </div>
          <div class="progress-bar-sm"><div class="progress-bar-sm-fill" style="width:${lp}%;background:${lc}"></div></div>
        </div>`;
      });
      html += `</div></div>`;
    });
    html += `</div>`;
  }

  container.innerHTML = html;
}

// ── TEAMS ──
