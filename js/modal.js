function showAddLocModal(deptName) {
  setModal(`
    <div class="modal-title">Add Location — ${esc(deptName)}<button class="modal-close" onclick="closeModal()">${icon('x',14)}</button></div>
    <div class="form-group"><label class="form-label">Location Name</label><input class="form-input" id="ml-name" placeholder="e.g. Team Villa 7"></div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Bump In</label><input class="form-input" id="ml-in" type="date"></div>
      <div class="form-group"><label class="form-label">Bump Out</label><input class="form-input" id="ml-out" type="date"></div>
    </div>
    <div class="form-group"><label class="form-label">Contact Person</label><input class="form-input" id="ml-contact" placeholder="Name"></div>
    <div class="modal-actions">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="addLocation('${esc(deptName)}')">Add</button>
    </div>`);
}
function addLocation(deptName) {
  const name = document.getElementById('ml-name')?.value?.trim();
  if (!name) return showToast('Name required','error');
  const dept = cd().departments[deptName];
  if (!dept) return;
  if (!dept.locations) dept.locations = {};
  if (dept.locations[name]) return showToast('Already exists','error');
  dept.locations[name] = {
    bump_in: document.getElementById('ml-in')?.value||'',
    bump_out: document.getElementById('ml-out')?.value||'',
    contact: document.getElementById('ml-contact')?.value||''
  };
  save();
  closeModal();
  showToast(`"${name}" added`,'success');
  renderTab('matrix');
}

function showAddDeptModal() {
  setModal(`
    <div class="modal-title">Add Department<button class="modal-close" onclick="closeModal()">${icon('x',14)}</button></div>
    <div class="form-group"><label class="form-label">Department Name</label><input class="form-input" id="md-name" placeholder="e.g. Sustainability"></div>
    <div class="modal-actions">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="addDept()">Add</button>
    </div>`);
}
function addDept() {
  const name = document.getElementById('md-name')?.value?.trim();
  if (!name) return showToast('Name required','error');
  if (cd().departments[name]) return showToast('Already exists','error');
  cd().departments[name] = { locations: {} };
  save();
  closeModal();
  showToast(`Department "${name}" added`,'success');
  renderTab('matrix');
}

function showAddItemModal() {
  setModal(`
    <div class="modal-title">Add Item to Master List<button class="modal-close" onclick="closeModal()">${icon('x',14)}</button></div>
    <div class="form-group"><label class="form-label">Item Name</label><input class="form-input" id="mi-name" placeholder="e.g. Ergonomic office chair"></div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Category</label>
        <select class="form-input" id="mi-cat">
          <option>Tables</option><option>Seating</option><option>Appliances</option>
          <option>Storage</option><option>Waste Mgmt</option><option>AV</option><option>Other</option>
        </select>
      </div>
      <div class="form-group"><label class="form-label">LIC Inventory</label><input class="form-input" id="mi-inv" type="number" min="0" value="0"></div>
    </div>
    <div class="form-group"><label class="form-label">Description / Dimensions</label><input class="form-input" id="mi-desc" placeholder="e.g. (w) 60 x (l) 120 x (h) 75"></div>
    <div class="form-group"><label class="form-label">Notes</label><input class="form-input" id="mi-notes" placeholder="Additional notes"></div>
    <div class="modal-actions">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="addNewItem()">Add Item</button>
    </div>`);
}
function addNewItem() {
  const name = document.getElementById('mi-name')?.value?.trim();
  if (!name) return showToast('Name required','error');
  const item = {
    id: 'item_'+Date.now(), name,
    category: document.getElementById('mi-cat')?.value||'Other',
    description: document.getElementById('mi-desc')?.value||'',
    lic_inventory: parseInt(document.getElementById('mi-inv')?.value||'0'),
    moys_lic:0, aspire:0, total_needed:0, deficit:0,
    notes: document.getElementById('mi-notes')?.value||'',
    dept_quantities:{}
  };
  cd().items.push(item);
  save();
  closeModal();
  showToast(`"${name}" added`,'success');
}

function setModal(html) {
  document.getElementById('modal-body').innerHTML = html;
  document.getElementById('modal-overlay').classList.remove('hidden');
}
function closeModal() { document.getElementById('modal-overlay').classList.add('hidden'); }
function closeModalOverlay(e) { if (e.target === document.getElementById('modal-overlay')) closeModal(); }

function closeModalOverlay(e) { if (e.target === document.getElementById('modal-overlay')) closeModal(); }

// ── ANALYTICS ──
