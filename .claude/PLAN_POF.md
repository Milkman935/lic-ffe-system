# LIC-FFE — Paddock Order Form (POF) Project Plan

**Separate web app that lets teams fill their requirements online, syncing back to the main FFE matrix.**

---

## What This Is

A standalone HTML/CSS/JS web app (no build step, no framework — matches the main project's stack) that:

1. Admin opens `index.html` → generates a shareable link per team (copy & send)
2. Team opens `form.html?champ=WEC&year=2026&team=akkodis-asp-team`
3. Team fills in quantities across the catalog (Kitchen · Offices 1–8 · Pit)
4. Team submits → saved to `localStorage` as `POF_[CHAMP]_[YEAR]_[SLUG]`
5. Admin opens `index.html` → sees all submissions → clicks "Import to Matrix"
6. Import bridge in the main System project reads those localStorage entries and updates `team_quantities` for that team/year/champ

---

## Project Location

```
/Users/youssef/Desktop/POF/          ← Separate VS Code folder
/Users/youssef/Desktop/System/       ← Main matrix project
```

Assets (logos) are referenced as `../System/assets/images/` since they share the Desktop parent.

---

## File Structure

```
POF/
├── index.html              Admin dashboard
├── form.html               Team order form (URL params: ?champ=&year=&team=)
├── css/
│   ├── variables.css       Design tokens (mirrors main project)
│   ├── base.css            Reset + typography
│   ├── form.css            Form layout, location grid, heavy machinery
│   └── admin.css           Admin dashboard cards and table
├── js/
│   ├── catalog.js          Full service catalog (K01–M01, H01–H31)
│   ├── config.js           Championships, years, teams, cutoff dates
│   ├── storage.js          localStorage read/write + JSON export helpers
│   ├── form.js             Form rendering, real-time calculations, submit
│   └── admin.js            Admin dashboard: generate links, view submissions
└── assets/
    └── images/ → ../System/assets/images/  (relative path, same Desktop)
```

**Main project additions:**
```
System/js/pof-import.js     Reads POF localStorage submissions → updates matrix team_quantities
```
Plus an "Import POF" button wired into the Teams tab.

---

## URL Routing

No server needed — pure query string params:

| URL | Purpose |
|-----|---------|
| `form.html?champ=WEC&year=2026&team=akkodis-asp-team` | Team fills their order |
| `index.html` | Admin: generate links + view/import submissions |

Admin copies the generated link and emails/messages it to the team. Teams open it in their browser (works fully offline — no internet required once HTML is loaded).

---

## Data Flow

```
[Team fills form.html]
       ↓
localStorage["POF_WEC_2026_akkodis-asp-team"] = { submission JSON }
       ↓
[Admin opens index.html] → sees submission → clicks "Import to Matrix"
       ↓
pof-import.js reads localStorage entry
       ↓
For each catalog item with qty > 0:
  matrix.team_quantities[teamName][locName] = qty
  (creates the team + locations in the matrix if they don't exist)
       ↓
debouncedSave() in main matrix project
       ↓
Matrix teams tab shows updated requirements
```

---

## Catalog Sections

| Section | ID Range | Layout |
|---------|----------|--------|
| Kitchen Equipment | K01–K12 | Location grid (10 cols) |
| Furniture, Fixtures & Equipment | F01–F23 | Location grid |
| Beverages | B01–B14 | Location grid |
| Stationery | S01–S02 | Location grid |
| Audio Visual & Electrical | A01–A03 | Location grid |
| Gases – Fuel – Chemicals | G01–G08 | Location grid |
| Pit Equipment | P01–P08 | Location grid |
| Heavy Machinery & Vehicles | H01–H31 | Rental/flat special layout |
| Miscellaneous | M01 | Location grid |

**Location grid columns:** KITCHEN · OFF 1 · OFF 2 · OFF 3 · OFF 4 · OFF 5 · OFF 6 · OFF 7 · OFF 8 · PIT

**Heavy machinery rental columns:** QTY · MAST · START DATE · END DATE · DAYS · TRANSPORT · QAR/DAY · TOTAL

---

## Matrix Integration Mapping

POF location keys → matrix `locName`:

| POF key | Matrix locName |
|---------|---------------|
| `kitchen` | `Kitchen` |
| `office1` | `Office 1` |
| `office2` | `Office 2` |
| … | … |
| `office8` | `Office 8` |
| `pit` | `Pit` |

Import creates these locations under the team if they don't exist yet.

Item matching: by catalog ID (`K01`, `F01`, etc.) stored in `item.pof_id` field, with fallback to name-matching.

---

## Key Implementation Notes

1. **Real-time calc**: Every input triggers `recalc()` — updates TOTAL, LINE TOTAL, subtotals, grand total in < 16ms via direct DOM patching (no full re-render)
2. **Heavy machinery**: Rental items auto-compute `days = endDate − startDate + 1`; TOTAL = `(qarPerDay × days × qty) + (transport × qty)`; flat items = `price × qty`
3. **Surcharge**: If `new Date() > cutoffDate` → show 10% surcharge warning banner + adjusted totals
4. **Submission**: Validation → confirmation modal → save to localStorage → offer JSON download → show success screen with bank details
5. **Import bridge**: `pof-import.js` loaded in main System project; reads `POF_*` keys from localStorage; maps by `pof_id` on items; creates missing team locations
6. **Theme**: Respects light/dark mode from `body.light` class (same as main project)

---

## Championships Supported

| Key | Name | Color |
|-----|------|-------|
| `wec` | FIA World Endurance Championship | #0067ff |
| `f1` | Formula 1 | #e10600 |
| `motogp` | MotoGP | #ff6900 |

---

## Dev Rules (inherits from main project)

- No frameworks, no build step — vanilla JS/HTML/CSS only
- All JS in global scope — load order in HTML matters
- Same CSS variable tokens as main project
- `debouncedSave()` pattern for performance
- Light + dark mode for every visual change
