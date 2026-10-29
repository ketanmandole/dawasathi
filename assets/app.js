(() => {
  'use strict';

  const STORAGE_KEY = 'dawa-saathi-github-v1';
  const app = document.getElementById('app');
  const dialog = document.getElementById('editor');
  const form = document.getElementById('editor-form');
  const toastBox = document.getElementById('toast');
  let batches = loadBatches();
  let page = { type: 'home', batchId: '', medId: '' };
  let toastTimer;

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[char]));
  }

  function loadBatches() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      if (!Array.isArray(saved)) return [];
      return saved.filter((batch) => batch && typeof batch === 'object').map((batch) => ({
        id: String(batch.id || makeId()),
        name: String(batch.name || 'Untitled batch'),
        note: String(batch.note || ''),
        meds: Array.isArray(batch.meds) ? batch.meds.filter((med) => med && typeof med === 'object').map((med) => ({
          ...med,
          id: String(med.id || makeId()),
          name: String(med.name || 'Untitled medicine')
        })) : []
      }));
    } catch {
      return [];
    }
  }

  function saveBatches() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(batches));
      return true;
    } catch {
      notify('Could not save. Check your browser storage settings.');
      return false;
    }
  }

  function makeId() {
    return globalThis.crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function notify(message) {
    toastBox.textContent = message;
    toastBox.classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastBox.classList.remove('visible'), 2600);
  }

  function expiryStatus(expiry) {
    if (!expiry) return { label: 'Expiry not added', className: 'neutral' };
    const [year, month] = expiry.split('-').map(Number);
    if (!year || !month) return { label: 'Expiry not added', className: 'neutral' };
    const lastDay = new Date(year, month, 0, 23, 59, 59);
    const daysLeft = Math.ceil((lastDay.getTime() - Date.now()) / 86400000);
    if (daysLeft < 0) return { label: 'Expired', className: 'danger' };
    if (daysLeft <= 45) return { label: `Expires soon · ${daysLeft} days`, className: 'warning' };
    return {
      label: `Good until ${new Intl.DateTimeFormat(undefined, { month: 'short', year: 'numeric' }).format(lastDay)}`,
      className: 'success'
    };
  }

  function statusChip(expiry) {
    const status = expiryStatus(expiry);
    return `<span class="chip ${status.className}">${escapeHtml(status.label)}</span>`;
  }

  function getBatch(batchId) {
    return batches.find((batch) => batch.id === batchId) || null;
  }

  function getMedicine(batchId, medId) {
    return getBatch(batchId)?.meds.find((medicine) => medicine.id === medId) || null;
  }

  function render() {
    if (page.type === 'batch') return renderBatch(page.batchId);
    if (page.type === 'medicine') return renderMedicine(page.batchId, page.medId);
    renderHome();
  }

  function renderHome() {
    const expiredCount = batches.reduce((count, batch) => count + batch.meds.filter((med) => expiryStatus(med.expiry).className === 'danger').length, 0);
    app.innerHTML = `
      <div class="page-heading">
        <div><p class="eyebrow">YOUR MEDICINE CABINET</p><h1>My batches</h1><p class="muted">Keep each pharmacy visit or prescription together.</p></div>
        <button class="button button-primary" data-action="add-batch">＋ <span>New batch</span></button>
      </div>
      ${expiredCount ? `<div class="notice"><span class="notice-icon">!</span><span><strong>${expiredCount} expired ${expiredCount === 1 ? 'medicine' : 'medicines'}</strong> in your batches. Check the details with your pharmacist.</span></div>` : ''}
      ${batches.length ? `<div class="batch-grid">${batches.map((batch) => `
        <article class="batch-card">
          <button class="card-open" data-action="open-batch" data-id="${escapeHtml(batch.id)}">
            <span class="card-icon">▦</span><span class="card-title">${escapeHtml(batch.name)}</span>
            <span class="card-note">${escapeHtml(batch.note || 'No note added')}</span>
            <span class="card-count">${batch.meds.length} ${batch.meds.length === 1 ? 'medicine' : 'medicines'}</span><span class="card-arrow">→</span>
          </button>
          <button class="card-edit" data-action="edit-batch" data-id="${escapeHtml(batch.id)}" aria-label="Edit ${escapeHtml(batch.name)}">•••</button>
        </article>`).join('')}</div>` : `
        <section class="empty-state"><div class="empty-art">＋</div><h2>Your list starts here</h2><p>Add your first batch to keep medicines from one visit together.</p><button class="button button-primary" data-action="add-batch">Create first batch</button></section>`}
      <p class="privacy-note">Your medicine list is saved on this device in this browser. It does not sync to other devices.</p>`;
  }

  function renderBatch(batchId) {
    const batch = getBatch(batchId);
    if (!batch) { page = { type: 'home' }; return renderHome(); }
    app.innerHTML = `
      <button class="back-link" data-action="home">← All batches</button>
      <div class="page-heading detail-heading">
        <div><p class="eyebrow">MEDICINE BATCH</p><h1>${escapeHtml(batch.name)}</h1><p class="muted">${escapeHtml(batch.note || 'No note added')}</p></div>
        <div class="button-row"><button class="button button-secondary" data-action="edit-batch" data-id="${escapeHtml(batch.id)}">Edit batch</button><button class="button button-primary" data-action="add-medicine">＋ <span>Add medicine</span></button></div>
      </div>
      ${batch.meds.length ? `<div class="medicine-list">${batch.meds.map((medicine) => `
        <button class="medicine-row" data-action="open-medicine" data-id="${escapeHtml(medicine.id)}">
          <span class="medicine-symbol">✳</span><span class="medicine-main"><strong>${escapeHtml(medicine.name)}</strong><span>${escapeHtml(medicine.strength || 'Strength not added')}${medicine.purpose ? ` · ${escapeHtml(medicine.purpose)}` : ''}</span></span>
          ${statusChip(medicine.expiry)}<span class="row-arrow">→</span>
        </button>`).join('')}</div>` : `
        <section class="empty-state compact"><div class="empty-art">✳</div><h2>No medicines in this batch</h2><p>Add a medicine and its expiry details.</p><button class="button button-primary" data-action="add-medicine">Add medicine</button></section>`}`;
  }

  function renderMedicine(batchId, medId) {
    const batch = getBatch(batchId);
    const medicine = getMedicine(batchId, medId);
    if (!batch || !medicine) { page = { type: 'batch', batchId }; return renderBatch(batchId); }
    const expiryLabel = medicine.expiry
      ? new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(new Date(`${medicine.expiry}-01T12:00:00`))
      : 'Not added';
    const details = [
      ['Strength', medicine.strength], ['Used for', medicine.purpose], ['When to take', medicine.when],
      ['Expiry', expiryLabel], ['Batch number', medicine.batchNumber], ['Notes', medicine.notes]
    ];
    app.innerHTML = `
      <button class="back-link" data-action="open-batch" data-id="${escapeHtml(batch.id)}">← ${escapeHtml(batch.name)}</button>
      <section class="medicine-detail">
        <div class="detail-top"><span class="medicine-symbol large">✳</span><div><p class="eyebrow">MEDICINE DETAILS</p><h1>${escapeHtml(medicine.name)}</h1>${statusChip(medicine.expiry)}</div></div>
        <dl class="details-list">${details.map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value || 'Not added')}</dd></div>`).join('')}</dl>
        <div class="button-row"><button class="button button-primary" data-action="edit-medicine">Edit details</button><button class="button button-danger" data-action="delete-medicine">Delete medicine</button></div>
      </section>`;
  }

  function openEditor({ title, fields, values = {}, onSave, onDelete }) {
    form.innerHTML = `
      <div class="dialog-heading"><div><p class="eyebrow">DAWA SAATHI</p><h2>${escapeHtml(title)}</h2></div><button type="button" class="close-button" aria-label="Close" data-close>×</button></div>
      <div class="fields">${fields.map((field) => `<label>${escapeHtml(field.label)}${field.type === 'textarea'
        ? `<textarea name="${escapeHtml(field.name)}" rows="3" ${field.required ? 'required' : ''} maxlength="${field.maxlength || 1000}">${escapeHtml(values[field.name] || '')}</textarea>`
        : `<input name="${escapeHtml(field.name)}" type="${escapeHtml(field.type || 'text')}" value="${escapeHtml(values[field.name] || '')}" ${field.required ? 'required' : ''} ${field.maxlength ? `maxlength="${field.maxlength}"` : ''}>`}</label>`).join('')}</div>
      <div class="dialog-actions">${onDelete ? '<button type="button" class="button button-danger" data-delete>Delete</button>' : ''}<span class="action-spacer"></span><button type="button" class="button button-secondary" data-close>Cancel</button><button type="submit" class="button button-primary">Save</button></div>`;
    form.onsubmit = (event) => {
      event.preventDefault();
      const valuesToSave = Object.fromEntries(fields.map((field) => [field.name, String(new FormData(form).get(field.name) || '').trim()]));
      onSave(valuesToSave);
      dialog.close();
    };
    form.querySelectorAll('[data-close]').forEach((button) => button.addEventListener('click', () => dialog.close()));
    const deleteButton = form.querySelector('[data-delete]');
    if (deleteButton) deleteButton.addEventListener('click', () => {
      if (confirm('Delete this item? This cannot be undone.')) { onDelete(); dialog.close(); }
    });
    dialog.showModal();
    form.querySelector('input, textarea')?.focus();
  }

  const batchFields = [
    { name: 'name', label: 'Batch name', required: true, maxlength: 80 },
    { name: 'note', label: 'Note (optional)', maxlength: 240 }
  ];
  const medicineFields = [
    { name: 'name', label: 'Medicine name', required: true, maxlength: 100 },
    { name: 'strength', label: 'Strength (for example 500 mg)', maxlength: 80 },
    { name: 'purpose', label: 'Used for', maxlength: 120 },
    { name: 'when', label: 'When to take it', maxlength: 100 },
    { name: 'expiry', label: 'Expiry month', type: 'month' },
    { name: 'batchNumber', label: 'Batch number', maxlength: 80 },
    { name: 'notes', label: 'Notes', type: 'textarea', maxlength: 1000 }
  ];

  function addBatch() {
    openEditor({ title: 'New batch', fields: batchFields, onSave: (values) => {
      batches.unshift({ id: makeId(), name: values.name, note: values.note, meds: [] });
      saveBatches(); render(); notify('Batch created.');
    } });
  }

  function editBatch(batch) {
    openEditor({ title: 'Edit batch', fields: batchFields, values: batch, onSave: (values) => {
      Object.assign(batch, values); saveBatches(); render(); notify('Batch saved.');
    }, onDelete: () => {
      batches = batches.filter((item) => item.id !== batch.id); page = { type: 'home' };
      saveBatches(); render(); notify('Batch deleted.');
    } });
  }

  function addMedicine() {
    const batch = getBatch(page.batchId);
    if (!batch) return;
    openEditor({ title: 'Add medicine', fields: medicineFields, onSave: (values) => {
      batch.meds.push({ ...values, id: makeId() }); saveBatches(); render(); notify('Medicine added.');
    } });
  }

  function editMedicine(medicine) {
    openEditor({ title: 'Edit medicine', fields: medicineFields, values: medicine, onSave: (values) => {
      Object.assign(medicine, values); saveBatches(); render(); notify('Medicine saved.');
    }, onDelete: () => {
      const batch = getBatch(page.batchId);
      batch.meds = batch.meds.filter((item) => item.id !== medicine.id);
      page = { type: 'batch', batchId: batch.id }; saveBatches(); render(); notify('Medicine deleted.');
    } });
  }

  app.addEventListener('click', (event) => {
    const target = event.target.closest('[data-action]');
    if (!target) return;
    event.preventDefault();
    switch (target.dataset.action) {
      case 'home': page = { type: 'home' }; render(); break;
      case 'add-batch': addBatch(); break;
      case 'open-batch': page = { type: 'batch', batchId: target.dataset.id }; render(); break;
      case 'edit-batch': { const batch = getBatch(target.dataset.id); if (batch) editBatch(batch); break; }
      case 'add-medicine': addMedicine(); break;
      case 'open-medicine': page = { ...page, type: 'medicine', medId: target.dataset.id }; render(); break;
      case 'edit-medicine': { const medicine = getMedicine(page.batchId, page.medId); if (medicine) editMedicine(medicine); break; }
      case 'delete-medicine': {
        const medicine = getMedicine(page.batchId, page.medId);
        if (medicine && confirm(`Delete ${medicine.name}?`)) {
          const batch = getBatch(page.batchId);
          batch.meds = batch.meds.filter((item) => item.id !== medicine.id);
          page = { type: 'batch', batchId: batch.id }; saveBatches(); render(); notify('Medicine deleted.');
        }
        break;
      }
    }
  });

  document.getElementById('new-batch').addEventListener('click', addBatch);
  document.querySelector('.topbar').addEventListener('click', (event) => {
    if (event.target.closest('[data-action="home"]')) { event.preventDefault(); page = { type: 'home' }; render(); }
  });
  render();
})();
