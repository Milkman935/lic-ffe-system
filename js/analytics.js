function destroyChart(key) {
  if (S.charts[key]) { try { S.charts[key].destroy(); } catch(e){} S.charts[key] = null; }
}

function toggleChartDetail(btn) {
  const card = btn.closest('.chart-card');
  const detail = card.querySelector('.chart-detail');
  if (!detail) return;
  const open = detail.style.display !== 'none';
  detail.style.display = open ? 'none' : 'block';
  btn.innerHTML = open ? icon('chevron-u',12)+' Details' : icon('chevron-d',12)+' Details';
}

// ── DEPT × CATEGORY COVERAGE HEATMAP ──
// Reuses the app's existing tri-color status scale (success/warning/danger)
// for consistency with every other % indicator in the app, rather than a new
// sequential ramp — this app already treats that triad as its status palette.
function buildDeptCategoryCoverage(ds, its) {
  const cells = {}; // "dept|cat" -> {need, stock}
  const deptNeed = {};
  const catNeed = {};
  its.forEach(item => {
    const cat = categorize(item.name || '');
    Object.entries(item.dept_quantities || {}).forEach(([dept, dq]) => {
      let need = 0;
      Object.values(dq || {}).forEach(q => { need += parseInt(q, 10) || 0; });
      if (need <= 0) return;
      const key = dept + '|' + cat;
      if (!cells[key]) cells[key] = { need: 0, stock: 0 };
      cells[key].need += need;
      cells[key].stock += Math.min(need, itemAvail(item));
      deptNeed[dept] = (deptNeed[dept] || 0) + need;
      catNeed[cat] = (catNeed[cat] || 0) + need;
    });
  });
  // Keep it legible: top 8 departments by total need, only categories that
  // actually appear for one of them, in the app's canonical category order.
  const topDepts = Object.entries(deptNeed).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([d]) => d);
  const cats = CATEGORY_ORDER.filter(c => catNeed[c] && topDepts.some(d => cells[d + '|' + c]));
  return { depts: topDepts, cats, cells };
}
function renderCoverageHeatmap(ds, its) {
  const { depts: hDepts, cats, cells } = buildDeptCategoryCoverage(ds, its);
  if (!hDepts.length || !cats.length) return '';
  const cellColor = pct => pct >= 80 ? 'var(--success)' : pct >= 50 ? 'var(--warning)' : 'var(--danger)';
  let html = `<div class="heatmap-scroll"><table class="heatmap-table"><thead><tr><th></th>${cats.map(c => `<th>${esc(c.length>14?c.slice(0,14):c)}</th>`).join('')}</tr></thead><tbody>`;
  hDepts.forEach(dept => {
    html += `<tr><th class="heatmap-rowlabel">${esc(dept.length>22?dept.slice(0,22)+'…':dept)}</th>`;
    cats.forEach(cat => {
      const c = cells[dept + '|' + cat];
      if (!c) { html += `<td class="heatmap-cell empty">—</td>`; return; }
      const pct = c.need > 0 ? Math.floor(Math.min(c.stock, c.need) / c.need * 100) : 0;
      html += `<td class="heatmap-cell" style="background:color-mix(in srgb,${cellColor(pct)} 22%,transparent);color:${cellColor(pct)}" title="${esc(dept)} · ${esc(cat)}: ${c.stock} of ${c.need} covered">${pct}%</td>`;
    });
    html += `</tr>`;
  });
  html += `</tbody></table></div>`;
  return html;
}

function renderAnalytics(container) {
  const its = items();
  const ds = depts();
  const totalNeeded = its.reduce((s,i)=>s+itemTotal(i),0);
  const totalLIC    = its.reduce((s,i)=>s+(i.lic_inventory||0),0);
  const totalMOYS   = its.reduce((s,i)=>s+(i.moys_lic||0),0);
  const totalAspire = its.reduce((s,i)=>s+(i.aspire||0),0);
  const totalInv    = totalLIC + totalMOYS + totalAspire;
  const totalDef    = its.reduce((s,i)=>s+itemDeficit(i),0);
  const defItems    = its.filter(i=>itemDeficit(i)>0).length;
  const covPct      = totalNeeded > 0 ? Math.floor(Math.min(totalInv/totalNeeded*100,100)) : 0;
  const color       = CHAMP_COLORS[S.champ]||'#e10600';
  const isDark      = !document.body.classList.contains('light');
  const tickColor   = isDark ? '#7070a0' : '#6b7280';
  const gridColor   = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)';

  // Dept delivery stats
  const deptDelivery = ds.map(([dn,dd]) => {
    const locs = Object.keys(dd.locations||{});
    const {total,del} = getDeptCounts(dn,locs);
    return {name:dn, total, del, pending:total-del, pct:total>0?Math.floor(del/total*100):0};
  }).sort((a,b)=>b.pct-a.pct);

  // Procurement priority (top items by deficit)
  const procItems = [...its].filter(i=>itemDeficit(i)>0).sort((a,b)=>itemDeficit(b)-itemDeficit(a)).slice(0,12);
  const procMax   = procItems.length ? itemDeficit(procItems[0]) : 1;

  // Dept coverage (inventory vs demand per dept)
  const deptCoverage = ds.map(([dn])=>{
    let need=0, stock=0;
    its.forEach(item=>{
      const dq=item.dept_quantities?.[dn]; if(!dq) return;
      Object.values(dq).forEach(q=>{ const qq=parseInt(q, 10)||0; if(qq>0){need+=qq; stock+=Math.min(qq,itemAvail(item));} });
    });
    return {name:dn, need, stock, pct:need>0?Math.floor(stock/need*100):100};
  }).sort((a,b)=>a.pct-b.pct);

  const deptTotals = ds.map(([n])=>({name:n,total:getDeptTotal(n)})).sort((a,b)=>b.total-a.total);
  const topItems   = [...its].sort((a,b)=>itemTotal(b)-itemTotal(a)).slice(0,8);
  const topMax     = topItems.length ? itemTotal(topItems[0]) : 1;
  const palette    = champLedPalette(['#e10600','#0067ff','#ff6900','#00c853','#aa00ff','#ffab00','#00bcd4','#ff4081'], color);

  const topListHtml = topItems.map((item,i)=>`
    <li>
      <span class="top-list-rank">${i+1}</span>
      <span style="flex:1;font-size:12px;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:130px" title="${esc(item.name)}">${esc(item.name.length>20?item.name.slice(0,20)+'…':item.name)}</span>
      <div class="top-list-bar-wrap"><div class="top-list-bar" style="width:${Math.round(itemTotal(item)/topMax*100)}%;background:${palette[i%palette.length]}"></div></div>
      <span class="top-list-val">${itemTotal(item)}</span>
    </li>`).join('');

  // Detail tables for expandable sections
  const procDetailHtml = procItems.map(item=>{
    const avail=itemAvail(item);
    const def=itemDeficit(item);
    return `<tr class="proc-row"><td>${esc(item.name)}</td><td style="text-align:right">${itemTotal(item)}</td><td style="text-align:right">${avail}</td><td style="text-align:right;color:var(--danger);font-weight:700">−${def}</td></tr>`;
  }).join('');

  const covDetailHtml = deptCoverage.map(d=>{
    const c=d.pct>=80?'var(--success)':d.pct>=50?'var(--warning)':'var(--danger)';
    return `<tr class="proc-row"><td>${esc(d.name.length>22?d.name.slice(0,22)+'…':d.name)}</td><td style="text-align:right">${d.need}</td><td style="text-align:right">${d.stock}</td><td style="text-align:right;font-weight:700;color:${c}">${d.pct}%</td></tr>`;
  }).join('');

  const delivDetailHtml = deptDelivery.map(d=>{
    const c=d.pct===100?'var(--success)':d.pct>50?'var(--warning)':'var(--danger)';
    return `<tr class="proc-row"><td>${esc(d.name.length>22?d.name.slice(0,22)+'…':d.name)}</td><td style="text-align:right">${d.del}</td><td style="text-align:right">${d.pending}</td><td style="text-align:right;font-weight:700;color:${c}">${d.pct}%</td></tr>`;
  }).join('');

  const deptDetailHtml = deptTotals.slice(0,12).map(d=>`<tr class="proc-row"><td>${esc(d.name)}</td><td style="text-align:right;font-weight:700">${d.total}</td></tr>`).join('');

  const detailTableStyle = `width:100%;border-collapse:collapse;font-size:12px;margin-top:12px`;
  const detailThStyle   = `text-align:left;padding:5px 6px;color:var(--text-muted);border-bottom:1px solid var(--border);font-weight:600`;

  container.innerHTML = `
    <div class="stats-row">
      <div class="stat-card" style="--c:${color}"><div class="stat-label">Total Items Needed</div><div class="stat-value">${totalNeeded.toLocaleString()}</div><div class="stat-sub">${its.length} unique types</div></div>
      <div class="stat-card" style="--c:var(--success)"><div class="stat-label">Total Inventory</div><div class="stat-value">${totalInv.toLocaleString()}</div><div class="stat-sub">LIC + MOYS + Aspire</div></div>
      <div class="stat-card" style="--c:var(--danger)"><div class="stat-label">Procurement Needed</div><div class="stat-value">${totalDef.toLocaleString()}</div><div class="stat-sub">${defItems} items have deficit</div></div>
      <div class="stat-card" style="--c:var(--info)"><div class="stat-label">Coverage Rate</div><div class="stat-value">${covPct}%</div><div class="stat-sub">${ds.length} depts · ${ds.reduce((s,[,d])=>s+Object.keys(d.locations||{}).length,0)} locations</div></div>
    </div>
    <div class="analytics-grid">

      <!-- Inventory Coverage Gauge -->
      <div class="chart-card">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:3px">
          <div class="chart-title">Inventory Coverage</div>
          <button class="btn btn-ghost" style="font-size:11px;padding:3px 8px" onclick="toggleChartDetail(this)">${icon('chevron-d',12)} Details</button>
        </div>
        <div class="chart-subtitle">Stock vs total demand</div>
        <div class="gauge-wrap">
          <div class="gauge-ring"><canvas id="ch-gauge"></canvas><div class="gauge-label"><span class="gauge-pct">${covPct}%</span><span class="gauge-sub">covered</span></div></div>
          <div class="gauge-stats">
            <div class="gauge-stat"><strong style="color:var(--success)">${totalLIC.toLocaleString()}</strong> LIC Inventory</div>
            <div class="gauge-stat"><strong style="color:#0067ff">${totalMOYS.toLocaleString()}</strong> MOYS / LIC</div>
            <div class="gauge-stat"><strong style="color:#ff6900">${totalAspire.toLocaleString()}</strong> Aspire</div>
            <div class="gauge-stat"><strong style="color:var(--danger)">${totalDef.toLocaleString()}</strong> Deficit</div>
          </div>
        </div>
        <div class="chart-detail" style="display:none">
          <table style="${detailTableStyle}"><thead><tr><th style="${detailThStyle}">Source</th><th style="${detailThStyle};text-align:right">Qty</th><th style="${detailThStyle};text-align:right">% of Demand</th></tr></thead><tbody>
            ${[['LIC Inventory',totalLIC,'#00c853'],['MOYS/LIC',totalMOYS,'#0067ff'],['Aspire',totalAspire,'#ff6900']].map(([l,v,c])=>`<tr class="proc-row"><td>${l}</td><td style="text-align:right;font-weight:700">${v.toLocaleString()}</td><td style="text-align:right;color:${c}">${totalNeeded>0?Math.floor(isFinite(v/totalNeeded)?v/totalNeeded*100:0):0}%</td></tr>`).join('')}
          </tbody></table>
        </div>
      </div>

      <!-- Procurement Priority (replaces Items by Category) -->
      <div class="chart-card">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:3px">
          <div class="chart-title">Procurement Priority</div>
          <button class="btn btn-ghost" style="font-size:11px;padding:3px 8px" onclick="toggleChartDetail(this)">${icon('chevron-d',12)} Details</button>
        </div>
        <div class="chart-subtitle">Top items with highest deficit — urgent procurement needed</div>
        <div class="chart-wrap"><canvas id="ch-proc"></canvas></div>
        <div class="chart-detail" style="display:none">
          <table style="${detailTableStyle}"><thead><tr><th style="${detailThStyle}">Item</th><th style="${detailThStyle};text-align:right">Needed</th><th style="${detailThStyle};text-align:right">In Stock</th><th style="${detailThStyle};text-align:right">Deficit</th></tr></thead><tbody>${procDetailHtml}</tbody></table>
        </div>
      </div>

      <!-- Department Delivery Progress -->
      <div class="chart-card wide">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:3px">
          <div class="chart-title">Department Delivery Progress</div>
          <button class="btn btn-ghost" style="font-size:11px;padding:3px 8px" onclick="toggleChartDetail(this)">${icon('chevron-d',12)} Details</button>
        </div>
        <div class="chart-subtitle">Delivered vs pending items per department</div>
        <div class="chart-wrap tall"><canvas id="ch-delivery"></canvas></div>
        <div class="chart-detail" style="display:none">
          <table style="${detailTableStyle}"><thead><tr><th style="${detailThStyle}">Department</th><th style="${detailThStyle};text-align:right">Delivered</th><th style="${detailThStyle};text-align:right">Pending</th><th style="${detailThStyle};text-align:right">Complete</th></tr></thead><tbody>${delivDetailHtml}</tbody></table>
        </div>
      </div>

      <!-- Department Requirements -->
      <div class="chart-card">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:3px">
          <div class="chart-title">Department Requirements</div>
          <button class="btn btn-ghost" style="font-size:11px;padding:3px 8px" onclick="toggleChartDetail(this)">${icon('chevron-d',12)} Details</button>
        </div>
        <div class="chart-subtitle">Total items requested per department</div>
        <div class="chart-wrap"><canvas id="ch-dept"></canvas></div>
        <div class="chart-detail" style="display:none">
          <table style="${detailTableStyle}"><thead><tr><th style="${detailThStyle}">Department</th><th style="${detailThStyle};text-align:right">Total Items</th></tr></thead><tbody>${deptDetailHtml}</tbody></table>
        </div>
      </div>

      <!-- Department Coverage (replaces Deficit by Category) -->
      <div class="chart-card">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:3px">
          <div class="chart-title">Department Stock Coverage</div>
          <button class="btn btn-ghost" style="font-size:11px;padding:3px 8px" onclick="toggleChartDetail(this)">${icon('chevron-d',12)} Details</button>
        </div>
        <div class="chart-subtitle">How much of each dept's needs is covered by current stock</div>
        <div class="chart-wrap"><canvas id="ch-deptcov"></canvas></div>
        <div class="chart-detail" style="display:none">
          <table style="${detailTableStyle}"><thead><tr><th style="${detailThStyle}">Department</th><th style="${detailThStyle};text-align:right">Needed</th><th style="${detailThStyle};text-align:right">Covered</th><th style="${detailThStyle};text-align:right">Rate</th></tr></thead><tbody>${covDetailHtml}</tbody></table>
        </div>
      </div>

      <!-- Inventory Sources -->
      <div class="chart-card">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:3px">
          <div class="chart-title">Inventory Sources</div>
          <button class="btn btn-ghost" style="font-size:11px;padding:3px 8px" onclick="toggleChartDetail(this)">${icon('chevron-d',12)} Details</button>
        </div>
        <div class="chart-subtitle">Stock breakdown by source vs total demand</div>
        <div class="chart-wrap"><canvas id="ch-inv"></canvas></div>
        <div class="chart-detail" style="display:none">
          <table style="${detailTableStyle}"><thead><tr><th style="${detailThStyle}">Source</th><th style="${detailThStyle};text-align:right">Qty</th></tr></thead><tbody>
            ${[['Total Needed',totalNeeded],['LIC Inventory',totalLIC],['MOYS/LIC',totalMOYS],['Aspire',totalAspire]].map(([l,v])=>`<tr class="proc-row"><td>${l}</td><td style="text-align:right;font-weight:700">${v.toLocaleString()}</td></tr>`).join('')}
          </tbody></table>
        </div>
      </div>

      <!-- Top 8 High-Demand Items -->
      <div class="chart-card">
        <div class="chart-title" style="margin-bottom:3px">Top 8 High-Demand Items</div>
        <div class="chart-subtitle">Highest quantity requirements</div>
        <ul class="top-list" style="margin-top:8px">${topListHtml}</ul>
      </div>

      ${(() => { const hm = renderCoverageHeatmap(ds, its); return hm ? `
      <!-- Dept × Category Coverage Heatmap -->
      <div class="chart-card wide">
        <div class="chart-title" style="margin-bottom:3px">Coverage by Department &amp; Category</div>
        <div class="chart-subtitle">Where stock is short, broken down by item category — top 8 departments by demand</div>
        ${hm}
      </div>` : ''; })()}

    </div>`;

  // ─ Gauge ─
  destroyChart('gauge');
  S.charts.gauge = new Chart(document.getElementById('ch-gauge'),{
    type:'doughnut',
    data:{labels:['Covered','Uncovered'],datasets:[{data:[Math.min(totalInv,totalNeeded),Math.max(0,totalNeeded-totalInv)],backgroundColor:[covPct>=80?'#00c853':covPct>=50?'#ffab00':'#ff1744','rgba(128,128,128,0.15)'],borderWidth:0,cutout:'72%'}]},
    options:{responsive:true,maintainAspectRatio:true,plugins:{legend:{display:false},tooltip:{enabled:false}}}
  });

  // ─ Procurement Priority (top deficit items) ─
  destroyChart('proc');
  S.charts.proc = new Chart(document.getElementById('ch-proc'),{
    type:'bar',
    data:{labels:procItems.map(i=>i.name.length>18?i.name.slice(0,18)+'…':i.name),datasets:[{label:'Deficit',data:procItems.map(i=>i.deficit||0),backgroundColor:'#ff174477',borderColor:'#ff1744',borderWidth:2,borderRadius:4}]},
    options:{responsive:true,maintainAspectRatio:false,indexAxis:'y',plugins:{legend:{display:false}},scales:{x:{ticks:{color:tickColor},grid:{color:gridColor}},y:{ticks:{color:tickColor,font:{size:11}},grid:{color:gridColor}}}}
  });

  // ─ Dept delivery stacked bar ─
  destroyChart('delivery');
  S.charts.delivery = new Chart(document.getElementById('ch-delivery'),{
    type:'bar',
    data:{labels:deptDelivery.map(d=>d.name.length>18?d.name.slice(0,18)+'…':d.name),datasets:[
      {label:'Delivered',data:deptDelivery.map(d=>d.del),backgroundColor:'#00c85388',borderColor:'#00c853',borderWidth:1,borderRadius:{topLeft:3,topRight:3},stack:'s'},
      {label:'Pending', data:deptDelivery.map(d=>d.pending),backgroundColor:'rgba(128,128,168,0.2)',borderColor:'rgba(128,128,168,0.4)',borderWidth:1,borderRadius:{topLeft:3,topRight:3},stack:'s'}
    ]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{color:tickColor}},tooltip:{callbacks:{afterLabel:(ctx)=>{const d=deptDelivery[ctx.dataIndex];return `${d.pct}% complete`;} }}},scales:{x:{ticks:{color:tickColor,maxRotation:45},grid:{color:gridColor},stacked:true},y:{ticks:{color:tickColor},grid:{color:gridColor},stacked:true}}}
  });

  // ─ Dept demand ─
  destroyChart('dept');
  S.charts.dept = new Chart(document.getElementById('ch-dept'),{
    type:'bar',
    data:{labels:deptTotals.slice(0,12).map(d=>d.name.length>16?d.name.slice(0,16)+'…':d.name),datasets:[{label:'Items',data:deptTotals.slice(0,12).map(d=>d.total),backgroundColor:color+'77',borderColor:color,borderWidth:2,borderRadius:4}]},
    options:{responsive:true,maintainAspectRatio:false,indexAxis:'y',plugins:{legend:{display:false}},scales:{x:{ticks:{color:tickColor},grid:{color:gridColor}},y:{ticks:{color:tickColor,font:{size:11}},grid:{color:gridColor}}}}
  });

  // ─ Dept stock coverage ─
  destroyChart('deptcov');
  S.charts.deptcov = new Chart(document.getElementById('ch-deptcov'),{
    type:'bar',
    data:{labels:deptCoverage.map(d=>d.name.length>16?d.name.slice(0,16)+'…':d.name),datasets:[{label:'Coverage %',data:deptCoverage.map(d=>d.pct),backgroundColor:deptCoverage.map(d=>d.pct>=80?'#00c85377':d.pct>=50?'#ffab0077':'#ff174477'),borderColor:deptCoverage.map(d=>d.pct>=80?'#00c853':d.pct>=50?'#ffab00':'#ff1744'),borderWidth:2,borderRadius:4}]},
    options:{responsive:true,maintainAspectRatio:false,indexAxis:'y',plugins:{legend:{display:false}},scales:{x:{min:0,max:100,ticks:{color:tickColor,callback:v=>v+'%'},grid:{color:gridColor}},y:{ticks:{color:tickColor,font:{size:11}},grid:{color:gridColor}}}}
  });

  // ─ Inventory sources vs demand ─
  destroyChart('inv');
  S.charts.inv = new Chart(document.getElementById('ch-inv'),{
    type:'bar',
    data:{labels:['Total Needed','LIC Inventory','MOYS/LIC','Aspire'],datasets:[{label:'Qty',data:[totalNeeded,totalLIC,totalMOYS,totalAspire],backgroundColor:['#e1060077','#00c85377','#0067ff77','#ff690077'],borderColor:['#e10600','#00c853','#0067ff','#ff6900'],borderWidth:2,borderRadius:6}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{ticks:{color:tickColor},grid:{color:gridColor}},y:{ticks:{color:tickColor},grid:{color:gridColor}}}}
  });

  // ── Team Analytics ──
  const teamList = teams();
  if (teamList.length === 0) {
    const noTeamSec = document.createElement('div');
    noTeamSec.innerHTML = `<div style="margin:28px 0 14px;font-size:17px;font-weight:800;color:var(--text);padding-bottom:8px;border-bottom:1px solid var(--border)">Teams Analytics</div>` + emptyState('flag','No teams added yet','Click "+ Team" in the top bar to add a team');
    container.appendChild(noTeamSec);
  } else if (teamList.length > 0) {
    const isDarkT = !document.body.classList.contains('light');
    const tickColorT = isDarkT ? '#7070a0' : '#6b7280';
    const gridColorT = isDarkT ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)';
    const palT = champLedPalette(['#e10600','#0067ff','#ff6900','#00c853','#aa00ff','#ffab00','#00bcd4','#ff4081','#64dd17','#f06292','#29b6f6','#ff7043','#9ccc65','#ab47bc','#26c6da'], CHAMP_COLORS[S.champ]||'#e10600');

    // ── build per-team stats ──
    const tStats = teamList.map(([tn, td], idx) => {
      const locs = Object.keys(td.locations || {});
      const { total, del } = getTeamCounts(tn, locs);
      const pct = total > 0 ? Math.round(del / total * 100) : 0;
      let itemCount = 0;
      const catBreakdown = {};
      items().forEach(item => {
        Object.values(item.team_quantities?.[tn] || {}).forEach(q => {
          const qty = parseInt(q, 10) || 0;
          if (qty > 0) {
            itemCount += qty;
            const cat = item.category || 'OTHERS';
            catBreakdown[cat] = (catBreakdown[cat] || 0) + qty;
          }
        });
      });
      return { name: tn, total, del, pct, itemCount, locs: locs.length, catBreakdown, color: palT[idx % palT.length] };
    });

    const tDelivery  = [...tStats].sort((a,b) => b.total - a.total).slice(0, 16);
    const tTotals    = [...tStats].sort((a,b) => b.itemCount - a.itemCount).slice(0, 16);
    const tLocCount  = [...tStats].sort((a,b) => b.locs - a.locs).slice(0, 16);
    const tComplete  = tStats.filter(d => d.pct === 100).length;
    const tInProgress= tStats.filter(d => d.pct > 0 && d.pct < 100).length;
    const tNotStarted= tStats.filter(d => d.pct === 0).length;

    // aggregate category breakdown across all teams
    const allCatTotals = {};
    tStats.forEach(t => { Object.entries(t.catBreakdown).forEach(([c,v]) => { allCatTotals[c] = (allCatTotals[c]||0) + v; }); });
    const catEntries = Object.entries(allCatTotals).sort((a,b) => b[1]-a[1]).slice(0,10);

    // ── summary stat cards ──
    const summaryHtml = `
      <div class="inv-stats-row" style="margin-bottom:20px">
        <div class="inv-stat-card" style="--c:var(--champ-color)">
          <div class="stat-label">Total Teams</div>
          <div class="stat-value">${tStats.length}</div>
          <div class="stat-sub">${tStats.reduce((s,t)=>s+t.locs,0)} locations across all teams</div>
        </div>
        <div class="inv-stat-card" style="--c:var(--success)">
          <div class="stat-label">Fully Delivered</div>
          <div class="stat-value" style="color:var(--success)">${tComplete}</div>
          <div class="stat-sub">teams at 100%</div>
        </div>
        <div class="inv-stat-card" style="--c:var(--warning)">
          <div class="stat-label">In Progress</div>
          <div class="stat-value" style="color:var(--warning)">${tInProgress}</div>
          <div class="stat-sub">teams partially delivered</div>
        </div>
        <div class="inv-stat-card" style="--c:var(--danger)">
          <div class="stat-label">Not Started</div>
          <div class="stat-value" style="color:var(--danger)">${tNotStarted}</div>
          <div class="stat-sub">teams with 0% delivery</div>
        </div>
        <div class="inv-stat-card" style="--c:#aa00ff">
          <div class="stat-label">Total Items Assigned</div>
          <div class="stat-value">${tStats.reduce((s,t)=>s+t.itemCount,0).toLocaleString()}</div>
          <div class="stat-sub">across all teams & locations</div>
        </div>
      </div>`;

    // ── detail tables ──
    const tDelivDetail = tDelivery.map(d => {
      const c = d.pct===100?'var(--success)':d.pct>50?'var(--warning)':'var(--danger)';
      const bar = `<div style="height:4px;background:var(--surface3);border-radius:2px;margin-top:3px"><div style="height:100%;width:${d.pct}%;background:${d.pct===100?'var(--success)':d.pct>50?'var(--warning)':'var(--danger)'};border-radius:2px"></div></div>`;
      return `<tr class="proc-row"><td>${esc(d.name.length>24?d.name.slice(0,24)+'…':d.name)}</td><td style="text-align:right">${d.del}</td><td style="text-align:right">${d.total-d.del}</td><td style="text-align:right;font-weight:700;color:${c}">${d.pct}%${bar}</td></tr>`;
    }).join('');

    const tTotalsDetail = tTotals.map(d =>
      `<tr class="proc-row"><td>${esc(d.name.length>24?d.name.slice(0,24)+'…':d.name)}</td><td style="text-align:right">${d.locs}</td><td style="text-align:right;font-weight:700">${d.itemCount}</td></tr>`
    ).join('');

    const tLocDetail = tLocCount.map(d =>
      `<tr class="proc-row"><td>${esc(d.name.length>24?d.name.slice(0,24)+'…':d.name)}</td><td style="text-align:right;font-weight:700">${d.locs}</td></tr>`
    ).join('');

    const catDetail = catEntries.map(([c,v]) =>
      `<tr class="proc-row"><td>${esc(c)}</td><td style="text-align:right;font-weight:700">${v}</td></tr>`
    ).join('');

    const teamSec = document.createElement('div');
    teamSec.innerHTML =
      `<div style="margin:28px 0 14px;font-size:17px;font-weight:800;color:var(--text);padding-bottom:8px;border-bottom:1px solid var(--border)">Teams Analytics</div>`
      + summaryHtml
      + `<div class="analytics-grid">`

      // Chart 1: Delivery progress stacked bar (wide)
      + `<div class="chart-card wide"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:3px"><div class="chart-title">Delivery Progress per Team</div><button class="btn btn-ghost" style="font-size:11px;padding:3px 8px" onclick="toggleChartDetail(this)">Details &#9662;</button></div><div class="chart-subtitle">Delivered vs remaining items by team</div><div class="chart-wrap tall"><canvas id="ch-team-del"></canvas></div><div class="chart-detail" style="display:none"><table style="width:100%;border-collapse:collapse;font-size:12px;margin-top:12px"><thead><tr><th style="text-align:left;padding:5px 8px;color:var(--text-muted);border-bottom:1px solid var(--border)">Team</th><th style="text-align:right;padding:5px 8px;color:var(--text-muted);border-bottom:1px solid var(--border)">Delivered</th><th style="text-align:right;padding:5px 8px;color:var(--text-muted);border-bottom:1px solid var(--border)">Pending</th><th style="text-align:right;padding:5px 8px;color:var(--text-muted);border-bottom:1px solid var(--border)">Complete</th></tr></thead><tbody>${tDelivDetail}</tbody></table></div></div>`

      // Chart 2: Total items requested (horizontal bar)
      + `<div class="chart-card"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:3px"><div class="chart-title">Total Items per Team</div><button class="btn btn-ghost" style="font-size:11px;padding:3px 8px" onclick="toggleChartDetail(this)">Details &#9662;</button></div><div class="chart-subtitle">Sum of all quantities assigned per team</div><div class="chart-wrap tall"><canvas id="ch-team-tot"></canvas></div><div class="chart-detail" style="display:none"><table style="width:100%;border-collapse:collapse;font-size:12px;margin-top:12px"><thead><tr><th style="text-align:left;padding:5px 8px;color:var(--text-muted);border-bottom:1px solid var(--border)">Team</th><th style="text-align:right;padding:5px 8px;color:var(--text-muted);border-bottom:1px solid var(--border)">Locs</th><th style="text-align:right;padding:5px 8px;color:var(--text-muted);border-bottom:1px solid var(--border)">Total Items</th></tr></thead><tbody>${tTotalsDetail}</tbody></table></div></div>`

      // Chart 3: Completion % donut
      + `<div class="chart-card"><div class="chart-title">Overall Team Readiness</div><div class="chart-subtitle">Breakdown by completion status</div><div class="chart-wrap"><canvas id="ch-team-ready"></canvas></div></div>`

      // Chart 4: Category demand across teams (doughnut)
      + `<div class="chart-card"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:3px"><div class="chart-title">Item Categories Demanded</div><button class="btn btn-ghost" style="font-size:11px;padding:3px 8px" onclick="toggleChartDetail(this)">Details &#9662;</button></div><div class="chart-subtitle">Total quantities by category across all teams</div><div class="chart-wrap"><canvas id="ch-team-cats"></canvas></div><div class="chart-detail" style="display:none"><table style="width:100%;border-collapse:collapse;font-size:12px;margin-top:12px"><thead><tr><th style="text-align:left;padding:5px 8px;color:var(--text-muted);border-bottom:1px solid var(--border)">Category</th><th style="text-align:right;padding:5px 8px;color:var(--text-muted);border-bottom:1px solid var(--border)">Qty</th></tr></thead><tbody>${catDetail}</tbody></table></div></div>`

      // Chart 5: Locations per team (horizontal bar)
      + `<div class="chart-card"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:3px"><div class="chart-title">Locations per Team</div><button class="btn btn-ghost" style="font-size:11px;padding:3px 8px" onclick="toggleChartDetail(this)">Details &#9662;</button></div><div class="chart-subtitle">How many locations each team occupies</div><div class="chart-wrap"><canvas id="ch-team-locs"></canvas></div><div class="chart-detail" style="display:none"><table style="width:100%;border-collapse:collapse;font-size:12px;margin-top:12px"><thead><tr><th style="text-align:left;padding:5px 8px;color:var(--text-muted);border-bottom:1px solid var(--border)">Team</th><th style="text-align:right;padding:5px 8px;color:var(--text-muted);border-bottom:1px solid var(--border)">Locations</th></tr></thead><tbody>${tLocDetail}</tbody></table></div></div>`

      // Chart 6: Completion % per team (line / radar-style horizontal bar)
      + `<div class="chart-card wide"><div class="chart-title">Completion Rate per Team</div><div class="chart-subtitle">Percentage of items fully delivered</div><div class="chart-wrap"><canvas id="ch-team-pct"></canvas></div></div>`

      + `</div>`;
    container.appendChild(teamSec);

    // ── Render Chart 1: delivery stacked bar ──
    destroyChart('teamDel');
    S.charts['teamDel'] = new Chart(document.getElementById('ch-team-del'), {
      type: 'bar',
      data: {
        labels: tDelivery.map(d => d.name.length>14 ? d.name.slice(0,14)+'…' : d.name),
        datasets: [
          { label: 'Delivered', data: tDelivery.map(d => d.del),         backgroundColor: 'rgba(0,200,83,0.75)',  borderRadius: 4 },
          { label: 'Pending',   data: tDelivery.map(d => d.total-d.del), backgroundColor: 'rgba(255,171,0,0.55)', borderRadius: 4 }
        ]
      },
      options: { responsive:true, maintainAspectRatio:false, scales:{ x:{stacked:true,ticks:{color:tickColorT,font:{size:10}},grid:{color:gridColorT}}, y:{stacked:true,ticks:{color:tickColorT},grid:{color:gridColorT}} }, plugins:{legend:{labels:{color:tickColorT}}} }
    });

    // ── Render Chart 2: total items horizontal bar ──
    destroyChart('teamTot');
    S.charts['teamTot'] = new Chart(document.getElementById('ch-team-tot'), {
      type: 'bar',
      data: {
        labels: tTotals.map(d => d.name.length>14 ? d.name.slice(0,14)+'…' : d.name),
        datasets: [{ label: 'Items', data: tTotals.map(d => d.itemCount), backgroundColor: tTotals.map((_,i) => palT[i%palT.length]+'bb'), borderRadius: 4 }]
      },
      options: { responsive:true, maintainAspectRatio:false, indexAxis:'y', plugins:{legend:{display:false}}, scales:{x:{ticks:{color:tickColorT},grid:{color:gridColorT}},y:{ticks:{color:tickColorT,font:{size:10}},grid:{color:gridColorT}}} }
    });

    // ── Render Chart 3: readiness doughnut ──
    destroyChart('teamReady');
    S.charts['teamReady'] = new Chart(document.getElementById('ch-team-ready'), {
      type: 'doughnut',
      data: {
        labels: ['Fully Delivered','In Progress','Not Started'],
        datasets: [{ data: [tComplete, tInProgress, tNotStarted], backgroundColor: ['rgba(0,200,83,0.8)','rgba(255,171,0,0.8)','rgba(255,23,68,0.8)'], borderColor: ['#00c853','#ffab00','#ff1744'], borderWidth: 2 }]
      },
      options: { responsive:true, maintainAspectRatio:false, plugins:{ legend:{ position:'bottom', labels:{color:tickColorT,font:{size:11},padding:12} }, tooltip:{ callbacks:{ label: ctx => ` ${ctx.label}: ${ctx.raw} team${ctx.raw!==1?'s':''}` } } }, cutout:'65%' }
    });

    // ── Render Chart 4: categories doughnut ──
    destroyChart('teamCats');
    S.charts['teamCats'] = new Chart(document.getElementById('ch-team-cats'), {
      type: 'doughnut',
      data: {
        labels: catEntries.map(([c]) => c.length>20 ? c.slice(0,20)+'…' : c),
        datasets: [{ data: catEntries.map(([,v]) => v), backgroundColor: palT.map(c => c+'bb'), borderColor: palT, borderWidth: 1 }]
      },
      options: { responsive:true, maintainAspectRatio:false, plugins:{ legend:{ position:'bottom', labels:{color:tickColorT,font:{size:10},padding:8,boxWidth:12} } }, cutout:'55%' }
    });

    // ── Render Chart 5: locations per team ──
    destroyChart('teamLocs');
    S.charts['teamLocs'] = new Chart(document.getElementById('ch-team-locs'), {
      type: 'bar',
      data: {
        labels: tLocCount.map(d => d.name.length>14 ? d.name.slice(0,14)+'…' : d.name),
        datasets: [{ label: 'Locations', data: tLocCount.map(d => d.locs), backgroundColor: tLocCount.map((_,i) => palT[i%palT.length]+'99'), borderColor: tLocCount.map((_,i) => palT[i%palT.length]), borderWidth: 1, borderRadius: 4 }]
      },
      options: { responsive:true, maintainAspectRatio:false, indexAxis:'y', plugins:{legend:{display:false}}, scales:{x:{ticks:{color:tickColorT,stepSize:1},grid:{color:gridColorT}},y:{ticks:{color:tickColorT,font:{size:10}},grid:{color:gridColorT}}} }
    });

    // ── Render Chart 6: completion % per team (wide horizontal bar) ──
    const tPct = [...tStats].sort((a,b) => b.pct - a.pct);
    destroyChart('teamPct');
    S.charts['teamPct'] = new Chart(document.getElementById('ch-team-pct'), {
      type: 'bar',
      data: {
        labels: tPct.map(d => d.name.length>16 ? d.name.slice(0,16)+'…' : d.name),
        datasets: [{ label: 'Complete %', data: tPct.map(d => d.pct), backgroundColor: tPct.map(d => d.pct===100?'rgba(0,200,83,0.8)':d.pct>50?'rgba(255,171,0,0.75)':'rgba(255,23,68,0.7)'), borderRadius: 4 }]
      },
      options: { responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}, tooltip:{callbacks:{label:ctx=>` ${ctx.raw}% complete`}}}, scales:{x:{ticks:{color:tickColorT,font:{size:10}},grid:{color:gridColorT}},y:{min:0,max:100,ticks:{color:tickColorT,callback:v=>v+'%'},grid:{color:gridColorT}}} }
    });
  }
}

// ── PROGRESS ──
