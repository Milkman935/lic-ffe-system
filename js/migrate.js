// ── MIGRATION v6: Move _del localStorage keys into blob deliveries ──
function migrateDeliveriesToBlob() {
  const FLAG = 'lic_ffe_migrated_v6_deliveries';
  if (localStorage.getItem(FLAG)) return;

  // Collect all _del keys
  const delKeys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.endsWith('_del')) delKeys.push(k);
  }

  // Group by champ+year blob key
  const byBlob = {};
  delKeys.forEach(k => {
    // Format: {champ}_{year}_{dept}_{loc}_{itemId}_del  OR {champ}_{year}_TEAM_{teamName}_{loc}_{itemId}_del
    // We need to figure out which blob this belongs to
    const champYearMatch = k.match(/^(lic_ffe_)?(f1|wec|motogp)_(\d{4})_/);
    if (!champYearMatch) return;
    const champ = champYearMatch[2];
    const year = champYearMatch[3];
    const blobKey = `lic_ffe_${champ}_${year}`;
    if (!byBlob[blobKey]) byBlob[blobKey] = { champ, year, entries: [] };
    byBlob[blobKey].entries.push(k);
  });

  // For each blob, load it, add the deliveries, and save
  Object.values(byBlob).forEach(({ champ, year, entries }) => {
    const blobKey = `lic_ffe_${champ}_${year}`;
    try {
      const raw = localStorage.getItem(blobKey);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (!data || !data.items) return;
      if (!data.deliveries) data.deliveries = {};

      entries.forEach(k => {
        const qty = parseInt(localStorage.getItem(k)||'0', 10);
        if (!qty) return;
        // Determine if team or dept delivery
        const suffix = k.slice(`lic_ffe_${champ}_${year}_`.length).replace(/_del$/, '');
        if (suffix.startsWith('TEAM_')) {
          // TEAM_{teamName}_{locName}_{itemId}
          const rest = suffix.slice('TEAM_'.length);
          // itemId is last segment, locName is second-to-last, teamName is everything before
          const parts = rest.split('_');
          if (parts.length < 3) return;
          const itemId = parts[parts.length - 1];
          const locName = parts[parts.length - 2];
          const teamName = parts.slice(0, -2).join('_');
          const bk = `TEAM||${teamName}||${locName}||${itemId}`;
          data.deliveries[bk] = qty;
        } else {
          // {dept}_{loc}_{itemId}
          const parts = suffix.split('_');
          if (parts.length < 3) return;
          const itemId = parts[parts.length - 1];
          const locName = parts[parts.length - 2];
          const dept = parts.slice(0, -2).join('_');
          const bk = `${dept}||${locName}||${itemId}`;
          data.deliveries[bk] = qty;
        }
      });

      localStorage.setItem(blobKey, JSON.stringify(data));
      // Remove old keys
      entries.forEach(k => localStorage.removeItem(k));
    } catch(e) {}
  });

  try { localStorage.setItem(FLAG, '1'); } catch(e) {}
}

function migrateItemNames() {
  const FLAG = 'lic_ffe_migrated_v5';
  if (localStorage.getItem(FLAG)) return;

  const champsInStorage = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k || !k.startsWith('lic_ffe_') || k === 'lic_ffe_years') continue;
    // key format: lic_ffe_{champ}_{year}
    const rest = k.slice('lic_ffe_'.length);          // e.g. "f1_2025"
    const sepIdx = rest.indexOf('_');
    if (sepIdx === -1) continue;
    const champ = rest.slice(0, sepIdx);
    const year  = rest.slice(sepIdx + 1);
    if (!INITIAL_DATA.championships[champ]) continue;
    champsInStorage.push({ key: k, champ, year });
  }

  champsInStorage.forEach(({ key, champ }) => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (!saved || !Array.isArray(saved.items)) return;

      const canonical = INITIAL_DATA.championships[champ].items;

      // Build lookup of saved items by ID
      const byId = {};
      saved.items.forEach(item => { byId[item.id] = item; });

      // Rebuild items list: canonical order + names, but saved data for each
      const newItems = canonical.map(ci => {
        const existing = byId[ci.id];
        const merged = existing
          ? Object.assign({}, existing, { name: ci.name })
          : Object.assign({}, ci);
        // Ensure team_quantities exists
        if (!merged.team_quantities) merged.team_quantities = {};
        // Re-sync category from live categorize()
        merged.category = categorize(merged.name);
        return merged;
      });

      saved.items = newItems;

      // Ensure teams object exists in saved data
      if (!saved.teams) saved.teams = {};
      localStorage.setItem(key, JSON.stringify(saved));
    } catch(e) {}
  });

  try { localStorage.setItem(FLAG, '1'); } catch(e) {}
}

// ── INIT ──
migrateDeliveriesToBlob();
migrateItemNames();
loadYears();
initTheme();
</script>
