# LIC FFE System — Improvement Plan
**Token Utilization + UX/UI Overhaul + Component Architecture + Calculation Accuracy**

---

## Context

The LIC FFE Management System is a vanilla JS/HTML/CSS SPA with no build step. After the component-based file-split refactor, the codebase is cleanly separated into `css/` and `js/` modules, but four categories of problems remain:

1. **Token/Storage Waste** — localStorage is bloated, charts leak memory, delivery data is fragmented across hundreds of individual keys, base64 images have no size guard, and saves are full-blob serializations on every keystroke.
2. **UX/UI Gaps** — no loading states, no empty states, weak mobile layout, repeated inline styles instead of CSS classes, small touch targets, inconsistent feedback patterns, and DRY violations in HTML templates.
3. **No JS Component Architecture** — all render functions use raw `innerHTML` replacement and inline `onclick` string attributes. Every tab switch is a full DOM rebuild. No reuse, no lifecycle, no event delegation.
4. **Calculation Drift & Logic Bugs** — `total_needed`, `deficit`, and `category` can silently drift from source of truth. Orphaned `dept_quantities` entries accumulate. `parseInt` missing radix. Delivery counts can exceed requested qty. No input sanitization on numeric fields.

---

## Critical Files

| File | Role |
|------|------|
| `js/data.js` | Save/load, INITIAL_DATA blob, S state |
| `js/utils.js` | icon(), esc(), slug(), categorize(), delivery helpers |
| `js/analytics.js` | 12 Chart.js instances, all computed per render |
| `js/teams.js` | 896 lines — largest file, base64 image store |
| `js/departments.js` | 630 lines — mirrors teams patterns |
| `js/progress.js` | Full re-render on every call |
| `js/master.js` | Full table re-render, filterInv, sortInv |
| `css/variables.css` | Design tokens |
| `css/departments.css` | Shared table/accordion styles |
| `css/master.css` | Inventory table, sync panel |
| `css/analytics.css` | Chart cards, gauges |
| `css/modal.css` | Toasts, modals |
| `css/layout.css` | Buttons, tabs, topbar |

---

## Phase 1 — Storage & Token Efficiency

### 1.1 Fix Chart Memory Leak (analytics.js)
**Problem:** `S.charts.gauge = new Chart(...)` overwrites reference without calling `.destroy()` first. Canvas contexts accumulate.
**Fix:** Before every `new Chart(ctx, cfg)` call, add:
```js
if (S.charts.gauge) { S.charts.gauge.destroy(); S.charts.gauge = null; }
```
Do this for all 12 chart keys: `gauge, proc, delivery, dept, deptCov, inv, teamDel, teamTot, teamReady, teamCats, teamLocs, teamPct`.
**File:** `js/analytics.js` — top of `renderAnalytics()` and team chart section.

### 1.2 Guard Base64 Image Storage (teams.js)
**Problem:** `reader.readAsDataURL(file)` stores unlimited base64 in the main save blob. A single 2MB photo = localStorage quota exceeded.
**Fix:**
- Before storing, check `file.size > 1_500_000` → show toast error "File too large (max ~1 MB). Please compress or use a smaller file."
- For image files (`file.type.startsWith('image/')`), downscale via Canvas API to max 800px wide before base64 encoding.
- For non-image files, store only metadata `{name, size, type}` and show a file-icon placeholder instead of `<img>`.
**File:** `js/teams.js` — `uploadTeamImage()` function (~line 51).

### 1.3 Consolidate Delivery Data Into Main Blob (utils.js + data.js)
**Problem:** Each delivered quantity is stored as a separate localStorage key (`{champ}_{year}_{dept}_{loc}_{itemId}_del`). With 182 items × 127 locations, this can be thousands of keys. Each `getLocCounts()` call does multiple `localStorage.getItem()` reads.
**Fix:** 
- Add `deliveries: {}` object inside each championship's save blob (keyed as `"dept||loc||itemId" → qty`).
- Update `getDelivered(dept, loc, itemId)` and `setDelivered(dept, loc, itemId, qty)` in `utils.js` to read/write from `S.data.deliveries` instead of direct localStorage.
- In `save()` (`data.js`), deliveries are automatically serialized with the blob.
- Add one-time migration in `migrate.js` (gate with `lic_ffe_migrated_v6`) that reads all `_del` keys from localStorage, moves them into the blob, then deletes the old keys.
**Files:** `js/utils.js` (getDelivered/setDelivered/dKey), `js/data.js` (loadData init), `js/migrate.js` (new migration step).

### 1.4 Remove Orphaned Delivery Keys on Item/Location Delete
**Problem:** When an item or location is deleted, its `_del` localStorage keys are never cleaned up. After Phase 1.3 they'll be in the blob, so this becomes: when deleting an item or location, remove its entries from `S.data.deliveries`.
**Fix:** In `deleteItem()` (`master.js`), after splicing the item, delete all `deliveries` entries matching that `itemId`. In `deleteLocation()` (`departments.js`/`teams.js`), delete all entries matching that `dept||loc` prefix.

### 1.5 Reduce Auto-Save Frequency
**Problem:** `setInterval` auto-saves every 5 seconds even when nothing changed.
**Fix:** Track a dirty flag `S._dirty = false`. Set `S._dirty = true` inside `debouncedSave()`. In the interval, only save if `S._dirty`. Reset to false after each save.
**File:** `js/data.js`.

### 1.6 Memoize Analytics Computations
**Problem:** Every `renderAnalytics()` call re-runs all nested loops (O(items × depts × locations)).
**Fix:** Compute `_analyticsCache` once, invalidate only when `S._dirty` was true at last render. Cache: `{deptStats, teamStats, topItems, totalNeeded, totalDeficit, coverage}`.
**File:** `js/analytics.js` — add `let _analyticsCache = null; let _analyticsDirtyKey = null;` at top. Skip recompute if `S.champ + S.year + S._lastSaveTs === _analyticsDirtyKey`.

### 1.7 Debounce Search/Filter Inputs
**Problem:** `oninput="filterInv()"` and `oninput="filterMatrix()"` run on every keypress with no debounce, iterating all DOM rows.
**Fix:** Wrap filter handlers in a 120ms debounce using the same pattern as `debouncedSave`.
**Files:** `js/master.js` (filterInv), `js/departments.js` (filterMatrix).

---

## Phase 2 — UX/UI Improvements

### 2.1 Add HTML Template Helpers to utils.js (DRY)
**Problem:** 10+ identical patterns repeated across teams.js and departments.js — status cells, loc-meta rows, detail table wrappers, progress mini bars.
**Fix:** Add these helpers to `js/utils.js`:
```js
function statusCell(pct) { /* returns status % + mini progress bar HTML */ }
function locMetaRow(label, value, inputAttrs) { /* returns .loc-meta-item HTML */ }
function detailTable(headers, rows) { /* returns styled table HTML */ }
function emptyState(icon, msg, sub) { /* returns centered empty state HTML */ }
```
Then replace all inline duplicates in teams.js, departments.js, analytics.js, progress.js.

### 2.2 Extract Inline Styles to CSS Classes
**Problem:** Hundreds of `style="display:flex;gap:10px;..."` attributes scattered across JS render functions. Hard to maintain, can't be overridden by themes.
**Fix:** Audit the 15 most-repeated inline style blocks across teams.js and departments.js. Extract each to a named class in the appropriate CSS file. Key targets:
- `.team-header-meta` — flex row for villa/pitbox/count
- `.loc-meta-row` — 3-col meta grid
- `.item-status-cell` — status % + mini-bar
- `.panel-section` — common padded section divider
- `.add-row` — bottom add-item row in location tables
- `.detail-table` — analytics/dept inline tables
**Files:** CSS updates in `css/departments.css`, `css/master.css`. JS updates to remove inline style attrs.

### 2.3 Loading States for File Upload & Async Actions
**Problem:** File uploads (teams.js) give zero feedback — button stays active, no spinner, no confirmation.
**Fix:**
- On upload start: disable the `+ File` button, change text to "Uploading…"
- On each file complete: re-enable, show toast "File attached: {filename}"
- On error (size exceeded): show error toast
- Apply same pattern to Export button: show "Exporting…" during CSV Blob creation.
**File:** `js/teams.js` (`uploadTeamImage`), `js/export.js` (`exportData`).

### 2.4 Empty States for All Views
**Problem:** Analytics tab shows blank canvas areas when no teams exist. Progress/Teams tabs show nothing useful when no data.
**Fix:** Use the `emptyState()` helper (2.1) in:
- `renderAnalytics()` — if `teamList.length === 0`, show "No teams added yet" below dept charts
- `renderTeams()` — if `teams().length === 0`, show "No teams yet — add one to get started"
- `renderProgress()` — if no items tracked, show "No deliveries recorded yet"
- `renderMaster()` — if `items().length === 0`, show empty state
**Files:** `js/analytics.js`, `js/teams.js`, `js/progress.js`, `js/master.js`.

### 2.5 Increase Touch Target Sizes
**Problem:** Delete buttons (`.del-row-btn`, `.loc-tab-del`, team image remove buttons) are 15×15px — too small for touch.
**Fix:** In CSS, set minimum touch target:
```css
.del-row-btn, .loc-tab-del { min-width: 28px; min-height: 28px; }
```
Use padding instead of fixed size so text/icons remain centered. 
**Files:** `css/departments.css`, `css/master.css`.

### 2.6 Mobile Responsive Breakpoints
**Problem:** No explicit `@media` queries. Grid/flex layouts rely on auto-collapse which breaks unevenly on narrow screens.
**Fix:** Add breakpoints in `css/layout.css` and `css/landing.css`:
```css
@media (max-width: 768px) {
  .champ-grid { grid-template-columns: 1fr; gap: 14px; }
  .topbar { flex-wrap: wrap; height: auto; padding: 10px; }
  .tabs-bar { font-size: 13px; }
  .inv-stats-row { grid-template-columns: 1fr 1fr; }
}
@media (max-width: 480px) {
  .inv-stats-row { grid-template-columns: 1fr; }
  .toolbar { flex-direction: column; }
}
```
**Files:** `css/layout.css`, `css/landing.css`, `css/master.css`.

### 2.7 Championship Colors as CSS Variables
**Problem:** F1 `#e10600`, WEC `#0067ff`, MotoGP `#ff6900` are hardcoded in landing.css and JS. When champ-color changes, only the active one updates.
**Fix:** Add to `css/variables.css`:
```css
--f1-color: #e10600;
--wec-color: #0067ff;
--motogp-color: #ff6900;
```
Reference in landing.css via `.champ-card.f1 { --champ-card-color: var(--f1-color); }` pattern. JS `CHAMP_COLORS` in `data.js` remains the source of truth for dynamic use.

### 2.8 Consistent Toast Feedback Pattern
**Problem:** Some actions show toast (delete, add), others are silent (deliver done, rename, inventory update). Users don't know if action succeeded.
**Fix:** Add toast calls to:
- `markLocDoneCtx()` — "Location marked complete" / "Location cleared"
- `renameTeamLocCtx()` / `renameLoc()` — "Location renamed"
- `updateItemName()` — "Item renamed"
- Inventory save (after debounce settles) — subtle "Saved" toast (1.5s auto-dismiss)
**Files:** `js/teams.js`, `js/departments.js`, `js/master.js`. Use existing `showToast()` from `js/toast.js`.

### 2.9 Analytics Chart Update-in-Place
**Problem:** Switching to analytics tab always destroys and recreates all 12 charts. Even if data hasn't changed, full teardown/rebuild happens.
**Fix:** 
- After Phase 1.1 (destroy fix), add check: if chart already exists AND data hasn't changed (use dirty flag from 1.5), call `chart.update()` instead of recreating.
- Pattern: `if (S.charts.gauge && !S._dirty) { /* just show, no rebuild */ return; }`
- Reset `S._dirty = false` after analytics render.
**File:** `js/analytics.js`.

### 2.10 Search Result Count Display
**Problem:** Filter inputs in Master and Departments views give no feedback on how many results match.
**Fix:** After `filterInv()` runs, count visible rows and update the existing item-count span: `"14 of 182 items"`. Same for `filterMatrix()`.
**Files:** `js/master.js` (filterInv — update the `${its.length} items` span), `js/departments.js` (filterMatrix).

### 2.11 Progress Tab Visual Improvements
**Problem:** Progress cards are functional but visually dense. No summary ring/gauge. No distinction between 0% and "not started".
**Fix:**
- Add a summary row at top with two large circular progress indicators (CSS-only rings, no Chart.js) for Departments and Teams overall %.
- Color-code card backgrounds subtly: `rgba(--success, 0.05)` for 100%, `rgba(--danger, 0.05)` for 0%.
- Add "Not Started / In Progress / Complete" legend with count chips.
**File:** `js/progress.js`, `css/analytics.css` (reuse `.gauge` styles).

---

## Phase 3 — Code Quality

### 3.1 Standardize Template Literals
**Problem:** Mix of string concatenation (`html += '<div>' + val + '</div>'`) and template literals. Inconsistent across files.
**Fix:** In teams.js and departments.js, convert all `+` concatenation to template literals. Use `html += \`...\`` consistently. No logic change.

### 3.2 Category Field Sync in Migrate
**Problem:** `categorize()` in utils.js uses regex but items also store a `category` field that can drift from the live computation.
**Fix:** In `migrateItemNames()` (`migrate.js`), after restoring item names, re-run `item.category = categorize(item.name)` for all items.

---

## Phase 4 — JS Component Architecture

The file-split refactor separated CSS and JS into modules. This phase makes the JS itself component-based: reusable render functions, event delegation, and mount/update separation — all in vanilla JS with no framework.

### 4.1 Introduce `h()` Micro-Helper (utils.js)
**Problem:** All rendering uses raw string concatenation producing unreadable, hard-to-maintain HTML blobs. Inline `onclick="fn('${esc(val)}')"` string attributes are an XSS risk and break when values contain special chars that `esc()` doesn't cover in attribute context.
**Fix:** Add a lightweight DOM-builder helper to `js/utils.js`:
```js
// h(tag, attrs, ...children) → HTMLElement
function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'cls') el.className = v;
    else el.setAttribute(k, v);
  }
  children.flat().forEach(c => el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c));
  return el;
}
```
Use for new component renders. Existing string-concat renders are migrated incrementally (Phase 4.3+).

### 4.2 Event Delegation on `#main-content` (navigation.js)
**Problem:** Every rendered element has its own inline `onclick` string. When the DOM is replaced, all handlers are re-registered implicitly. No central point of control.
**Fix:** In `js/navigation.js`, after the app shell is mounted, attach a single delegated listener:
```js
document.getElementById('main-content').addEventListener('click', e => {
  const t = e.target.closest('[data-action]');
  if (!t) return;
  const action = t.dataset.action;
  const params = t.dataset; // all data-* attrs available
  ACTIONS[action]?.(params, e);
});
```
Define `const ACTIONS = { 'delete-item': ({id}) => deleteItem(id), 'add-loc': ({dept}) => showAddLocModal(dept), ... }` in a central registry. Migrate inline `onclick` attrs to `data-action="..."` + `data-*` params incrementally.

### 4.3 Standardized Component Signature
**Problem:** Every render function has a different signature (`renderMaster(container)`, `renderTeams(container)`, `renderLocDetail(teamName, locName, locInfo, tid)`). No consistent interface.
**Fix:** Enforce this contract for all render functions going forward:
```js
// renderX(container, props) — always takes a DOM element + props object
// Returns nothing; writes to container.innerHTML or appends children
function renderX(container, props = {}) { ... }
```
Update callers in `navigation.js` `renderTab()` to pass props. Existing functions are adapted to this signature one file at a time.

### 4.4 Master View — Incremental Row Updates (master.js)
**Problem:** Any inventory edit (`updateInv`) or item rename triggers `renderTab('master')` → full table re-render of all 182 rows.
**Fix:** Keep the table in the DOM across updates. Only patch the specific row:
- `updateInv()` already calls `refreshDeficitPill(itemId)` — extend this to also update the inventory input values in-place without re-render.
- `updateItemName()` — update only the name input's value in the matching `tr`, not the whole table.
- Only call `renderTab('master')` when items are added or deleted (structural change).

### 4.5 Departments — Patch-in-Place for Qty/Delivery Updates (departments.js)
**Problem:** `updateQtyCtx()` and `updateDelCtx()` both call `debouncedSave()` then re-render the counter display by targeting a specific element — this part is already correct. But `switchTab()` and `switchLoc()` do full innerHTML replacement of the panel.
**Fix:**
- Extract location panel rendering into `mountLocPanel(container, dept, loc)` — called once on first load.
- On `switchLoc()`, if the panel was already mounted for that loc, just toggle visibility (CSS `display`) instead of re-rendering.
- Cache mounted panels in `_ctx[tid].panels = { locName: HTMLElement }`.

### 4.6 Teams — Same Patch-in-Place Pattern (teams.js)
**Problem:** Same issue as departments — `switchTeamLoc()` does full innerHTML replacement.
**Fix:** Mirror the dept pattern: cache team location panels in `_tctx[tid].panels`, toggle display on switch, only re-mount when a new location is first opened.

### 4.7 Analytics — Component Mount Once, Update on Dirty (analytics.js)
**Problem:** Full chart teardown/rebuild on every analytics tab visit (12 Chart.js instances).
**Fix:** (Builds on 1.1 and 2.9)
- `mountAnalytics(container)` — called once, creates canvas elements and chart instances, stores in `S.charts`.
- `updateAnalytics()` — called on subsequent visits, updates `chart.data` and calls `chart.update()` if `S._dirty`, otherwise no-ops.
- `renderTab('analytics')` checks if `#analytics-root` exists in container → calls `updateAnalytics()` instead of `mountAnalytics()`.

### 4.8 Progress — Patch Cards Instead of Full Re-render (progress.js)
**Problem:** Clicking "Departments" / "Teams" toggle calls `renderProgress(container, mode)` → full innerHTML replacement.
**Fix:** Render both dept and team card grids once on mount, hidden via CSS. Toggle button switches `display` between them. Progress bar values are updated in-place via `el.style.width = pct + '%'` when data changes.

---

## Phase 5 — Calculation Accuracy & Logic Precision

### 5.1 Single Source of Truth for `total_needed` (data.js + utils.js)
**Problem:** `item.total_needed` is stored in the blob but computed from `dept_quantities + team_quantities`. On import/migrate it can drift. Line 73 in master.js explicitly notes "never trust stored value" and recomputes on every render — but the stored value is still written back, causing drift in exports and analytics that read from `item.total_needed` directly.
**Fix:**
- Remove `item.total_needed` as a stored field. Make it a computed getter: `function itemTotal(item) { return deptTotal(item) + teamTotal(item); }` in `utils.js`.
- Everywhere `item.total_needed` is read, replace with `itemTotal(item)`.
- On export (`export.js`), call `itemTotal(item)` — never read stored value.
- Remove `recalcTotalNeeded()` from master.js (no longer needed).
- In migrate.js v7, delete `total_needed` from all stored items to clean up.

### 5.2 Single Source of Truth for `deficit` (utils.js)
**Problem:** Same drift issue as `total_needed`. `item.deficit` is stored but recalculated live in master.js render. Analytics and progress read the stored value, which may lag.
**Fix:**
- `function itemDeficit(item) { return Math.max(0, itemTotal(item) - itemAvail(item)); }` in `utils.js` where `itemAvail(item) = (item.lic_inventory||0) + (item.moys_lic||0) + (item.aspire||0)`.
- Remove `item.deficit` as a stored field. Replace all reads with `itemDeficit(item)`.
- Remove `recalcDeficit()`, `recalcAllDeficits()` from master.js (no longer needed).
- `refreshDeficitPill()` calls `itemDeficit(item)` directly.

### 5.3 Fix `parseInt` Missing Radix (all JS files)
**Problem:** `parseInt(val)` without a radix defaults to base-10 in modern JS but is technically ambiguous and a lint error. 23 occurrences across the codebase.
**Fix:** Global replace `parseInt(` → `parseInt(` with explicit `, 10)` added. Use `grep` to find all occurrences across `js/*.js` and patch each one. Alternatively, replace with `Number(val) || 0` where a float could be valid (e.g., quantities are always integers so `parseInt(val, 10)` is correct).

### 5.4 Delivery Cannot Exceed Requested Quantity
**Problem:** `updateDelCtx()` in departments.js and `updateTeamQtyCtx()` in teams.js use `Math.min(getDelivered(...), qty)` when displaying, but the stored delivery value can still be set above the requested quantity via direct input — no server-side cap.
**Fix:**
- In `updateDelCtx()` and the team equivalent, clamp the value on write: `const clamped = Math.max(0, Math.min(parseInt(val, 10)||0, requestedQty));`
- If user enters a value above requested, silently clamp to max and visually update the input to show the clamped value.
- Also validate that `requestedQty > 0` before allowing any delivery input (no delivery on unquantified items).

### 5.5 Orphaned `dept_quantities` Cleanup
**Problem:** When a department or location is deleted, the corresponding keys inside `item.dept_quantities[deptName][locName]` are never removed. These phantom keys accumulate and inflate `deptsTotal` calculations.
**Fix:**
- In `deleteLocation()` (`departments.js`) — after removing the location from `cd().departments`, iterate all items and delete `item.dept_quantities[deptName][locName]` if it exists. Then call `debouncedSave()`.
- In `deleteDept()` (`departments.js`) — same but delete entire `item.dept_quantities[deptName]` key.
- Mirror for team quantities in `deleteTeamLocation()` and `deleteTeam()` (`teams.js`).
- In migrate.js (v7), run a cleanup pass: for each item's `dept_quantities`, remove any dept key that doesn't exist in `cd().departments`.

### 5.6 Numeric Input Sanitization
**Problem:** Inventory inputs (`updateInv`), quantity inputs (`updateQtyCtx`, `updateTeamQtyCtx`), and delivery inputs all accept raw string values. `parseInt(val)||0` masks `NaN` as `0` silently. A blank input saves `0` which is correct, but a value like `"5abc"` silently becomes `5`.
**Fix:** Centralize numeric parsing in a single utility:
```js
function parseQty(val, max = Infinity) {
  const n = parseInt(val, 10);
  if (isNaN(n) || n < 0) return 0;
  return Math.min(n, max);
}
```
Replace all `parseInt(val)||0` and `Math.max(0, parseInt(val)||0)` patterns with `parseQty(val)` or `parseQty(val, max)`.
**File:** `js/utils.js` (add `parseQty`), then replace across all JS files.

### 5.7 Item ID Collision Guard
**Problem:** New items get IDs like `new_${Date.now()}`. If two items are added within the same millisecond (e.g., bulk import), IDs collide.
**Fix:** Change to `new_${Date.now()}_${Math.random().toString(36).slice(2,7)}` — 5 random chars appended makes collision probability negligible.
**File:** `js/modal.js` (addItem function), `js/teams.js` (addItemToTeamLocCtx).

### 5.8 Cross-Championship Sync Integrity
**Problem:** `showSyncPanel()` applies a transform function to other championship blobs. If the transform throws (e.g., item not found), the sync is partially applied or silently fails.
**Fix:** Wrap each sync apply in a `try/catch`. On error, show a warning toast "Sync failed for [champ] — data unchanged" and do not write the partially-modified blob to localStorage.
**File:** `js/sync.js`.

### 5.9 Analytics Calculation Precision
**Problem:** Coverage % calculations use `Math.round()` which can show 100% when slightly below (e.g., 99.6% rounds to 100%). Deficit pills show `✓ 0` when surplus exists. Progress percentages can show `NaN%` if `total === 0`.
**Fix:**
- Coverage %: use `Math.floor()` for display so 99.6% shows as 99%, not 100%.
- Guard all `(del/total * 100)` calculations: `total > 0 ? Math.floor(del/total*100) : 0`.
- Deficit pill: distinguish surplus correctly — show `+N surplus` when `avail > total_needed`, not `✓ 0`.
- All percentage displays: `isFinite(pct) ? pct : 0` guard.
**File:** `js/analytics.js`, `js/master.js` (`dLabel` calculation), `js/progress.js`.

---

## Execution Order (Updated)

| Step | Task | Files | Priority | Status |
|------|------|-------|----------|--------|
| 0 | ~~Write plan to `.claude/PLAN.md`~~ | — | — | ✓ Done |
| 1 | ~~Fix chart destroy (1.1)~~ | analytics.js | Critical | ✓ Done |
| 2 | ~~Guard base64 images (1.2)~~ | teams.js | Critical | ✓ Done |
| 3 | ~~`parseQty()` + parseInt radix (5.3, 5.6)~~ | utils.js + all JS | Critical | ✓ Done |
| 4 | ~~`itemTotal()` + `itemDeficit()` (5.1, 5.2)~~ | utils.js, master.js, analytics.js, export.js | Critical | ✓ Done |
| 5 | ~~Delivery clamp (5.4)~~ | departments.js, teams.js | High | ✓ Already done |
| 6 | ~~Dirty flag + reduce auto-save (1.5)~~ | data.js | High | ✓ Done |
| 7 | ~~Consolidate delivery into blob (1.3)~~ | utils.js, data.js, migrate.js | High | ✓ Done |
| 8 | ~~Orphaned delivery cleanup on delete (1.4, 5.5)~~ | master.js, departments.js, teams.js | High | ✓ Done |
| 9 | ~~HTML helpers + h() (2.1, 4.1)~~ | utils.js | High | ✓ Done |
| 10 | ~~Analytics precision fixes (5.9)~~ | analytics.js, progress.js | High | ✓ Done |
| 11 | ~~Touch targets + mobile breakpoints + CSS classes (2.2, 2.5, 2.6)~~ | CSS files | Medium | ✓ Done |
| 12 | ~~Empty states (2.4) + toast feedback (2.8) + sync guard (5.8) + ID collision (5.7)~~ | multiple | Medium | ✓ Done |
| 13 | ~~Debounce search + result count (1.7, 2.10)~~ | master.js, departments.js | Medium | ✓ Done |
| 14 | ~~Championship CSS vars (2.7) + category sync (3.2)~~ | variables.css, migrate.js | Low | ✓ Done |
| 15 | Event delegation setup (4.2) | navigation.js | High | Pending |
| 16 | Standardize component signature (4.3) | all render JS files | High | Pending |
| 17 | Master view incremental updates (4.4) | master.js | Medium | Pending |
| 18 | Dept patch-in-place (4.5) | departments.js | Medium | Pending |
| 19 | Teams patch-in-place (4.6) | teams.js | Medium | Pending |
| 20 | Analytics mount-once/update (4.7) | analytics.js | Medium | Pending |
| 21 | Progress patch-cards (4.8) | progress.js | Medium | Pending |
| 22 | Loading states for export (2.3) | export.js | Medium | Pending |
| 23 | Analytics cache (1.6) | analytics.js | Medium | Pending |
| 24 | Progress tab visual (2.11) | progress.js | Low | Pending |
| 25 | Standardize template literals (3.1) | teams.js, departments.js | Low | Pending |

---

## Verification

After implementation:
1. Open `http://localhost:8000` — landing loads in light mode
2. Enter any championship/year → DevTools > Application > localStorage: confirm no `_del` keys, only one main blob per champ/year
3. Upload image in Teams → toast "File attached"; upload 3MB image → error toast "File too large"
4. Edit inventory on 5 items rapidly → only 1 save fires after 400ms silence; auto-save only triggers when dirty
5. Open Analytics tab 5× → DevTools Memory heap stays flat (no chart leak)
6. Resize to 375px → all tabs readable, no unintended horizontal scroll
7. Set delivery > requested qty → value clamps to requested, no overcount in progress
8. Check `itemTotal()` vs old `total_needed` for 3 items in console — must match exactly
9. Delete a department → verify no orphaned qty keys remain on items
10. Add two items rapidly → verify no ID collisions in `cd().items`
11. Analytics coverage at 99 units delivered / 100 requested → shows 99% not 100%
12. Sync an inventory change to WEC while on F1 → if sync fails, toast warning shown, WEC data unchanged

---

## Dev Rules
1. No frameworks, no build step — vanilla JS/HTML/CSS only
2. All JS in global scope — load order in index.html matters
3. Never break existing data model — backward compat via migrate.js versioning (currently v6, next is v7)
4. DRY: use utils.js helpers (`h()`, `statusCell()`, `parseQty()`, etc.), never repeat HTML patterns
5. Always `debouncedSave()` on hot-path inputs, never `save()` directly
6. `itemTotal(item)` and `itemDeficit(item)` are the only sources of truth — never read stored `total_needed` or `deficit`
7. All render functions use signature `renderX(container, props = {})` 
8. Event handlers via `data-action` delegation — no new inline `onclick` string attrs
9. Test light + dark mode for every visual change
