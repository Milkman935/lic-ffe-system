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
migrateItemNames();
loadYears();
initTheme();
</script>
