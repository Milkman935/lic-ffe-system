function showUndoToast(msg) {
  clearTimeout(_undoTimer);
  cancelAnimationFrame(_undoRafId);
  const el = document.getElementById('undo-toast');
  const fill = document.getElementById('undo-progress-fill');
  const msgEl = document.getElementById('undo-toast-msg');
  msgEl.textContent = msg;
  fill.style.transition = 'none';
  fill.style.width = '100%';
  el.classList.add('show');
  // Start countdown bar
  const start = performance.now();
  const tick = (now) => {
    const elapsed = now - start;
    const pct = Math.max(0, 100 - (elapsed / UNDO_DURATION) * 100);
    fill.style.transition = 'none';
    fill.style.width = pct + '%';
    if (pct > 0) _undoRafId = requestAnimationFrame(tick);
  };
  _undoRafId = requestAnimationFrame(tick);
  // Auto-dismiss
  _undoTimer = setTimeout(() => {
    el.classList.remove('show');
    _deletedItem = null;
  }, UNDO_DURATION);
}

function undoDelete() {
  if (!_deletedItem) return;
  clearTimeout(_undoTimer);
  cancelAnimationFrame(_undoRafId);
  document.getElementById('undo-toast').classList.remove('show');
  // Only act if still on same champ+year
  if (S.champ === _deletedItem.champ && S.year === _deletedItem.year) {
    const arr = cd().items;
    if (_deletedItem._undoAdd) {
      // Undo an add: remove the item that was just added
      const i = arr.findIndex(it => it.id === _deletedItem.item.id);
      if (i !== -1) arr.splice(i, 1);
      if (S.data.deliveries) {
        Object.keys(S.data.deliveries).forEach(k => { if (k.endsWith(`||${_deletedItem.item.id}`)) delete S.data.deliveries[k]; });
      }
      save();
      renderTab('master');
      showToast(`"${_deletedItem.item.name}" removed`, 'success');
    } else {
      // Undo a delete: restore the item
      const insertAt = Math.min(_deletedItem.idx, arr.length);
      arr.splice(insertAt, 0, _deletedItem.item);
      save();
      renderTab('master');
      showToast(`"${_deletedItem.item.name}" restored`, 'success');
    }
  } else {
    showToast('Cannot undo — championship has changed', 'error');
  }
  _deletedItem = null;
}
let _popoverEl = null;

function showToast(msg, type='success') {
  const el = document.getElementById('toast');
  el.textContent = msg; el.className = `show ${type}`;
  clearTimeout(toastT); toastT = setTimeout(()=>{el.className='';}, 2500);
}

// ── ROLE MODAL ──
let _pendingChamp = null, _pendingYear = null;

