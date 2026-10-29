(() => {
  'use strict';

  const STORAGE_KEY = 'dawa-saathi-github-v1';
  const PROFILES_KEY = 'dawa-saathi-local-profiles-v1';
  const app = document.getElementById('app');
  const dialog = document.getElementById('editor');
  const form = document.getElementById('editor-form');
  const toastBox = document.getElementById('toast');
  const profileLabel = document.getElementById('profile-label');
  const newBatchButton = document.getElementById('new-batch');
  const logoutButton = document.getElementById('logout');
  const prescriptionPicker = document.getElementById('prescription-file');
  const pdfViewer = document.getElementById('pdf-viewer');
  const pdfFrame = document.getElementById('pdf-frame');
  const cameraDialog = document.getElementById('camera-dialog');
  const cameraVideo = document.getElementById('camera-video');
  const cameraPlaceholder = document.getElementById('camera-placeholder');
  const cameraError = document.getElementById('camera-error');
  const cameraCapture = document.getElementById('camera-capture');
  const cameraChooseFile = document.getElementById('camera-choose-file');
  const cameraClose = document.getElementById('camera-close');
  let pendingPrescriptionFile = null;
  let pendingPreviewUrl = '';
  let openPdfUrl = '';
  let cameraStream = null;
  let activeEmail = '';
  let batches = [];
  let page = { type: 'home', batchId: '', medId: '' };
  let toastTimer;

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[char]));
  }

  function loadBatches(key = STORAGE_KEY) {
    try {
      const saved = JSON.parse(localStorage.getItem(key) || '[]');
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
      localStorage.setItem(`${STORAGE_KEY}:${encodeURIComponent(activeEmail)}`, JSON.stringify(batches));
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
    if (!activeEmail) return showAuth();
    newBatchButton.hidden = false;
    logoutButton.hidden = false;
    profileLabel.textContent = activeEmail;
    if (page.type === 'prescriptions') return renderPrescriptions();
    if (page.type === 'batch') return renderBatch(page.batchId);
    if (page.type === 'medicine') return renderMedicine(page.batchId, page.medId);
    renderHome();
  }

  function renderHome() {
    const expiredCount = batches.reduce((count, batch) => count + batch.meds.filter((med) => expiryStatus(med.expiry).className === 'danger').length, 0);
    const search = new URLSearchParams(location.hash.slice(1)).get('q') || '';
    const normalizedSearch = search.trim().toLowerCase();
    const shownBatches = batches.filter((batch) => !normalizedSearch || [batch.name, batch.note, ...batch.meds.flatMap((med) => [med.name, med.purpose, med.strength])].some((value) => String(value || '').toLowerCase().includes(normalizedSearch)));
    app.innerHTML = `
      <div class="page-heading">
        <div><p class="eyebrow">YOUR MEDICINE CABINET</p><h1>My batches</h1><p class="muted">Keep each pharmacy visit or prescription together.</p></div>
        <div class="button-row"><button class="button button-secondary" data-action="prescriptions">▤ <span>Prescriptions</span></button><button class="button button-secondary" data-action="export-backup">↓ <span>Export backup</span></button><button class="button button-primary" data-action="add-batch">＋ <span>New batch</span></button></div>
      </div>
      ${expiredCount ? `<div class="notice"><span class="notice-icon">!</span><span><strong>${expiredCount} expired ${expiredCount === 1 ? 'medicine' : 'medicines'}</strong> in your batches. Check the details with your pharmacist.</span></div>` : ''}
      ${batches.length ? `<label class="search-box"><span>⌕</span><input id="batch-search" type="search" placeholder="Search batches or medicines" value="${escapeHtml(search)}" aria-label="Search batches or medicines"></label>` : ''}
      ${shownBatches.length ? `<div class="batch-grid">${shownBatches.map((batch) => `
        <article class="batch-card">
          <button class="card-open" data-action="open-batch" data-id="${escapeHtml(batch.id)}">
            <span class="card-icon">▦</span><span class="card-title">${escapeHtml(batch.name)}</span>
            <span class="card-note">${escapeHtml(batch.note || 'No note added')}</span>
            <span class="card-count">${batch.meds.length} ${batch.meds.length === 1 ? 'medicine' : 'medicines'}</span><span class="card-arrow">→</span>
          </button>
          <button class="card-edit" data-action="edit-batch" data-id="${escapeHtml(batch.id)}" aria-label="Edit ${escapeHtml(batch.name)}">•••</button>
      </article>`).join('')}</div>` : batches.length ? '<section class="empty-state compact"><h2>No matches found</h2><p>Try another batch or medicine name.</p></section>' : `
        <section class="empty-state"><div class="empty-art">＋</div><h2>Your list starts here</h2><p>Add your first batch to keep medicines from one visit together.</p><button class="button button-primary" data-action="add-batch">Create first batch</button></section>`}
      <p class="privacy-note">Your medicine list is saved on this device in this browser. It does not sync to other devices.</p>`;
  }

  function openPrescriptionDb() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('dawa-saathi-files-v1', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('prescriptions', { keyPath: 'id' });
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function prescriptionDb(action, record) {
    const db = await openPrescriptionDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('prescriptions', action === 'get' || action === 'list' ? 'readonly' : 'readwrite');
      const store = tx.objectStore('prescriptions');
      let req;
      if (action === 'list') req = store.getAll();
      else if (action === 'get') req = store.get(record);
      else if (action === 'put') req = store.put(record);
      else req = store.delete(record);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
      tx.oncomplete = () => db.close();
      tx.onerror = () => { db.close(); reject(tx.error); };
    });
  }

  async function renderPrescriptions() {
    app.innerHTML = `<button class="back-link" data-action="home">← My batches</button><div class="page-heading"><div><p class="eyebrow">DOCUMENT LIBRARY</p><h1>Prescriptions</h1><p class="muted">Capture, organize, and keep prescription PDFs together.</p></div><div class="button-row"><button class="button button-secondary" data-action="take-photo">▣ <span>Scan with camera</span></button><button class="button button-primary" data-action="upload-prescription">↑ <span>Upload file</span></button></div></div><section id="prescription-preview" class="prescription-preview" hidden></section><div id="prescription-list" class="prescription-list"><p class="muted">Loading files…</p></div><p class="privacy-note">Files stay in this browser on this device. Export important documents for backup.</p>`;
    const host = document.getElementById('prescription-list');
    renderPrescriptionPreview();
    try {
      const records = (await prescriptionDb('list')).filter((item) => item.profile === activeEmail).sort((a, b) => b.createdAt - a.createdAt);
      if (page.type !== 'prescriptions' || !host.isConnected) return;
      if (!records.length) { host.innerHTML = `<section class="empty-state compact"><div class="empty-art">▤</div><h2>No prescriptions yet</h2><p>Take a photo of a paper prescription or choose an image or PDF.</p></section>`; return; }
      host.innerHTML = records.map((item) => `<article class="prescription-card"><span class="file-icon">PDF</span><div class="file-info"><strong>${escapeHtml(item.name)}</strong><span>${new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(item.createdAt))} · PDF document</span></div><button class="button button-secondary" data-action="view-prescription" data-id="${escapeHtml(item.id)}">View</button><button class="button button-secondary" data-action="download-prescription" data-id="${escapeHtml(item.id)}">Download</button><button class="icon-delete" aria-label="Delete ${escapeHtml(item.name)}" data-action="delete-prescription" data-id="${escapeHtml(item.id)}">×</button></article>`).join('');
    } catch { if (host.isConnected) host.innerHTML = `<p class="form-error">Browser file storage is unavailable. Try a current browser over HTTPS.</p>`; }
  }

  function renderPrescriptionPreview() {
    const panel = document.getElementById('prescription-preview');
    if (!panel) return;
    if (!pendingPrescriptionFile) { panel.hidden = true; panel.innerHTML = ''; return; }
    if (pendingPreviewUrl) URL.revokeObjectURL(pendingPreviewUrl);
    pendingPreviewUrl = URL.createObjectURL(pendingPrescriptionFile);
    const isPdf = pendingPrescriptionFile.type === 'application/pdf' || pendingPrescriptionFile.name.toLowerCase().endsWith('.pdf');
    panel.hidden = false;
    panel.innerHTML = `<div class="preview-content"><div class="preview-heading"><div><p class="eyebrow">READY TO SAVE</p><h2>Check your prescription</h2><p class="muted">${isPdf ? 'PDF selected' : 'Photo will be converted into a PDF document.'} · ${(pendingPrescriptionFile.size / 1024 / 1024).toFixed(2)} MB</p></div><button class="icon-delete" data-action="cancel-prescription" aria-label="Cancel">×</button></div><div class="preview-paper">${isPdf ? `<iframe src="${pendingPreviewUrl}" title="Selected prescription preview"></iframe>` : `<img src="${pendingPreviewUrl}" alt="Selected prescription photo preview">`}</div><div class="preview-controls"><label>Document name<input id="prescription-name" maxlength="100" value="${escapeHtml(pendingPrescriptionFile.name.replace(/\.[^.]+$/, ''))}"></label><div class="button-row"><button class="button button-secondary" data-action="cancel-prescription">Cancel</button><button class="button button-primary" data-action="save-prescription">Save to library</button></div></div></div>`;
  }

  async function imageToPdf(file) {
    const image = await createImageBitmap(file);
    const maxWidth = 1500, maxHeight = 2100;
    const scale = Math.min(1, maxWidth / image.width, maxHeight / image.height);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(image.width * scale); canvas.height = Math.round(image.height * scale);
    canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
    image.close();
    const jpeg = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.88));
    if (!jpeg) throw new Error('Could not convert this image to PDF.');
    const jpg = new Uint8Array(await jpeg.arrayBuffer());
    const pageW = 595.28, pageH = 841.89, margin = 24;
    const ratio = Math.min((pageW - margin * 2) / canvas.width, (pageH - margin * 2) / canvas.height);
    const drawW = canvas.width * ratio, drawH = canvas.height * ratio;
    const x = (pageW - drawW) / 2, y = (pageH - drawH) / 2;
    const content = `q\n${drawW.toFixed(2)} 0 0 ${drawH.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)} cm\n/Im0 Do\nQ\n`;
    const enc = (text) => new TextEncoder().encode(text);
    const objects = [
      enc('<< /Type /Catalog /Pages 2 0 R >>'),
      enc('<< /Type /Pages /Kids [3 0 R] /Count 1 >>'),
      enc(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW.toFixed(2)} ${pageH.toFixed(2)}] /Resources << /XObject << /Im0 5 0 R >> >> /Contents 4 0 R >>`),
      concatBytes([enc(`<< /Length ${enc(content).length} >>\nstream\n`), enc(content), enc('endstream')]),
      concatBytes([enc(`<< /Type /XObject /Subtype /Image /Width ${canvas.width} /Height ${canvas.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpg.length} >>\nstream\n`), jpg, enc('\nendstream')])
    ];
    const chunks = [enc('%PDF-1.4\n%âãÏÓ\n')]; let length = chunks[0].length; const offsets = [0];
    objects.forEach((object, index) => { offsets.push(length); const start = enc(`${index + 1} 0 obj\n`), end = enc('\nendobj\n'); chunks.push(start, object, end); length += start.length + object.length + end.length; });
    const xrefOffset = length;
    let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    for (let i = 1; i < offsets.length; i++) xref += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
    xref += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
    chunks.push(enc(xref));
    return new Blob([concatBytes(chunks)], { type: 'application/pdf' });
  }

  function concatBytes(parts) {
    const total = parts.reduce((sum, part) => sum + part.length, 0);
    const result = new Uint8Array(total); let offset = 0;
    parts.forEach((part) => { result.set(part, offset); offset += part.length; });
    return result;
  }

  function exportBackup() {
    const payload = { app: 'Dawa Saathi', version: 1, exportedAt: new Date().toISOString(), batches };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'dawa-saathi-backup.json';
    document.body.append(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 30000);
    notify('Medicine list backup downloaded. Prescription PDFs are exported separately.');
  }

  async function importPrescription(file, documentName = '') {
    if (!file) return;
    try {
      let pdf;
      if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) pdf = file;
      else if (file.type.startsWith('image/') || /\.(jpe?g|png|webp|gif|bmp|heic)$/i.test(file.name)) pdf = await imageToPdf(file);
      else throw new Error('Choose a PDF or an image file.');
      if (pdf.size > 25 * 1024 * 1024) throw new Error('This file is over the 25 MB limit.');
      const name = documentName.trim() || file.name.replace(/\.[^.]+$/, '') || `Prescription ${new Date().toLocaleDateString()}`;
      await prescriptionDb('put', { id: makeId(), profile: activeEmail, name, createdAt: Date.now(), blob: pdf });
      notify('Prescription saved as PDF.');
      pendingPrescriptionFile = null;
      if (pendingPreviewUrl) URL.revokeObjectURL(pendingPreviewUrl);
      pendingPreviewUrl = '';
      page = { type: 'prescriptions' }; renderPrescriptions();
    } catch (error) { notify(error.message || 'Could not save this prescription.'); }
  }

  function queuePrescription(file) {
    if (!file) return;
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    const isImage = file.type.startsWith('image/') || /\.(jpe?g|png|webp|gif|bmp|heic)$/i.test(file.name);
    if (!isPdf && !isImage) { notify('Choose a PDF or an image file.'); return; }
    if (file.size > 25 * 1024 * 1024) { notify('This file is over the 25 MB limit.'); return; }
    pendingPrescriptionFile = file;
    renderPrescriptions();
    document.getElementById('prescription-name')?.focus();
  }

  function stopCamera() {
    if (cameraStream) cameraStream.getTracks().forEach((track) => track.stop());
    cameraStream = null;
    cameraVideo.srcObject = null;
    cameraCapture.disabled = true;
    cameraPlaceholder.hidden = false;
    cameraPlaceholder.textContent = 'Camera is closed.';
  }

  async function startCamera() {
    cameraError.textContent = '';
    cameraPlaceholder.textContent = 'Starting camera…';
    cameraPlaceholder.hidden = false;
    cameraCapture.disabled = true;
    cameraDialog.showModal();
    if (!navigator.mediaDevices?.getUserMedia) {
      cameraError.textContent = 'Camera access needs a supported browser over HTTPS or localhost. You can choose a photo instead.';
      cameraPlaceholder.textContent = 'Camera unavailable';
      return;
    }
    try {
      cameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      cameraVideo.srcObject = cameraStream;
      await cameraVideo.play();
      cameraPlaceholder.hidden = true;
      cameraCapture.disabled = false;
    } catch (error) {
      cameraPlaceholder.textContent = 'Camera unavailable';
      cameraError.textContent = error.name === 'NotAllowedError'
        ? 'Camera permission was denied. Allow camera access in your browser, or choose a photo instead.'
        : 'Could not open a camera. Check that your device has a camera, or choose a photo instead.';
      stopCamera();
      cameraPlaceholder.textContent = 'Camera unavailable';
    }
  }

  async function captureCameraPhoto() {
    if (!cameraVideo.videoWidth || !cameraVideo.videoHeight) {
      cameraError.textContent = 'Camera is still starting. Please wait a moment and try again.';
      return;
    }
    const canvas = document.createElement('canvas');
    canvas.width = cameraVideo.videoWidth;
    canvas.height = cameraVideo.videoHeight;
    canvas.getContext('2d').drawImage(cameraVideo, 0, 0);
    const photo = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
    if (!photo) {
      cameraError.textContent = 'Could not capture the photo. Please try again.';
      return;
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const file = new File([photo], `prescription-${timestamp}.jpg`, { type: 'image/jpeg' });
    cameraDialog.close();
    queuePrescription(file);
  }

  async function downloadPrescription(id) {
    try {
      const item = await prescriptionDb('get', id);
      if (!item || item.profile !== activeEmail) throw new Error('File not found.');
      const url = URL.createObjectURL(item.blob);
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = `${item.name.replace(/[\\/:*?"<>|]/g, '-')}.pdf`;
      document.body.append(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 30000);
    } catch (error) { notify(error.message || 'Could not download this file.'); }
  }

  async function viewPrescription(id) {
    try {
      const item = await prescriptionDb('get', id);
      if (!item || item.profile !== activeEmail) throw new Error('File not found.');
      if (openPdfUrl) URL.revokeObjectURL(openPdfUrl);
      openPdfUrl = URL.createObjectURL(item.blob);
      document.getElementById('viewer-title').textContent = item.name;
      pdfFrame.src = openPdfUrl;
      pdfViewer.showModal();
    } catch (error) { notify(error.message || 'Could not open this file.'); }
  }

  function showAuth(mode = 'login', error = '') {
    newBatchButton.hidden = true;
    logoutButton.hidden = true;
    profileLabel.textContent = 'Private to this browser';
    const registering = mode === 'register';
    app.innerHTML = `<section class="auth-layout"><div class="auth-brand"><div class="brand-mark big">＋</div><p class="eyebrow">DAWA SAATHI · PERSONAL HEALTH ORGANIZER</p><h1>Feel more in control of your medicine routine.</h1><p class="muted">Keep your medicine batches, expiry dates, and prescriptions together in one calm, easy-to-use place.</p><div class="auth-benefits"><div><span>01</span><p><strong>Stay organized</strong><small>Group medicines by visit or prescription.</small></p></div><div><span>02</span><p><strong>Keep an eye on expiry</strong><small>See status at a glance.</small></p></div><div><span>03</span><p><strong>Keep documents close</strong><small>Save prescription PDFs on this device.</small></p></div></div><div class="demo-tag"><span class="demo-dot"></span> DEMO · DATA STAYS IN THIS BROWSER</div></div><div class="auth-card"><div class="auth-card-icon">⌑</div><p class="eyebrow">YOUR PERSONAL SPACE</p><h2>${registering ? 'Create your profile' : 'Welcome back'}</h2><p class="muted">${registering ? 'Set up a local profile to try Dawa Saathi.' : 'Enter your details to unlock this browser profile.'}</p><form id="auth-form" class="auth-form" data-mode="${registering ? 'register' : 'login'}"><label>Email address<input name="email" type="email" autocomplete="email" placeholder="you@example.com" required></label><label>Passphrase<span class="password-field"><input id="auth-password" name="password" type="password" autocomplete="${registering ? 'new-password' : 'current-password'}" placeholder="${registering ? 'At least 8 characters' : 'Your passphrase'}" minlength="8" maxlength="256" required><button type="button" class="password-toggle" data-toggle-password aria-label="Show passphrase">Show</button></span></label><p class="form-error" role="alert">${escapeHtml(error)}</p><button class="button button-primary auth-submit" type="submit">${registering ? 'Create local profile' : 'Unlock profile'} <span aria-hidden="true">→</span></button></form><p class="switch-auth">${registering ? 'Already set up?' : 'New to Dawa Saathi?'} <button type="button" class="text-button" data-mode="${registering ? 'login' : 'register'}">${registering ? 'Sign in' : 'Create a profile'}</button></p><div class="local-auth-note"><strong>Testing mode</strong><span>This profile is stored only in this browser. It is not a secure online account and does not sync.</span></div></div></section>`;
  }

  function readProfiles() {
    try { const value = JSON.parse(localStorage.getItem(PROFILES_KEY) || '[]'); return Array.isArray(value) ? value : []; }
    catch { return []; }
  }

  async function derivePassword(password, salt) {
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: Uint8Array.from(atob(salt), (char) => char.charCodeAt(0)), iterations: 180000, hash: 'SHA-256' }, key, 256);
    return btoa(String.fromCharCode(...new Uint8Array(bits)));
  }

  async function submitAuth(authForm) {
    const button = authForm.querySelector('[type="submit"]');
    const error = authForm.querySelector('.form-error');
    const data = new FormData(authForm);
    const email = String(data.get('email') || '').trim().toLowerCase();
    const password = String(data.get('password') || '');
    button.disabled = true; error.textContent = '';
    try {
      if (!crypto?.subtle) throw new Error('Secure local profile setup requires a modern browser on HTTPS or localhost.');
      const profiles = readProfiles();
      let profile = profiles.find((item) => item.email === email);
      if (authForm.dataset.mode === 'register') {
        if (profile) throw new Error('A profile with this email already exists on this browser.');
        const saltBytes = crypto.getRandomValues(new Uint8Array(16));
        const salt = btoa(String.fromCharCode(...saltBytes));
        profile = { email, salt, passwordHash: await derivePassword(password, salt) };
        profiles.push(profile);
        localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles));
        // Keep any medicine list made before local profiles were added.
        if (profiles.length === 1 && localStorage.getItem(STORAGE_KEY) && !localStorage.getItem(`${STORAGE_KEY}:${encodeURIComponent(email)}`)) {
          localStorage.setItem(`${STORAGE_KEY}:${encodeURIComponent(email)}`, localStorage.getItem(STORAGE_KEY));
        }
      } else {
        if (!profile || await derivePassword(password, profile.salt) !== profile.passwordHash) throw new Error('Email or passphrase is incorrect.');
      }
      activeEmail = email;
      sessionStorage.setItem('dawa-saathi-active-profile', email);
      batches = loadBatches(`${STORAGE_KEY}:${encodeURIComponent(email)}`);
      page = { type: 'home' };
      render();
    } catch (cause) { error.textContent = cause.message || 'Could not open the local profile.'; button.disabled = false; }
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
    const passwordToggle = event.target.closest('[data-toggle-password]');
    if (passwordToggle) {
      const input = document.getElementById('auth-password');
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      passwordToggle.textContent = show ? 'Hide' : 'Show';
      passwordToggle.setAttribute('aria-label', `${show ? 'Hide' : 'Show'} passphrase`);
      input.focus();
      return;
    }
    const modeButton = event.target.closest('button[data-mode]');
    if (modeButton) { showAuth(modeButton.dataset.mode); return; }
    const target = event.target.closest('[data-action]');
    if (!target) return;
    event.preventDefault();
    switch (target.dataset.action) {
      case 'home': page = { type: 'home' }; render(); break;
      case 'add-batch': addBatch(); break;
      case 'prescriptions': page = { type: 'prescriptions' }; renderPrescriptions(); break;
      case 'export-backup': exportBackup(); break;
      case 'upload-prescription': prescriptionPicker.click(); break;
      case 'take-photo': startCamera(); break;
      case 'save-prescription': {
        const name = document.getElementById('prescription-name')?.value || '';
        importPrescription(pendingPrescriptionFile, name);
        break;
      }
      case 'cancel-prescription':
        pendingPrescriptionFile = null;
        if (pendingPreviewUrl) URL.revokeObjectURL(pendingPreviewUrl);
        pendingPreviewUrl = '';
        renderPrescriptions();
        break;
      case 'view-prescription': viewPrescription(target.dataset.id); break;
      case 'download-prescription': downloadPrescription(target.dataset.id); break;
      case 'delete-prescription': {
        if (confirm('Delete this saved prescription?')) prescriptionDb('delete', target.dataset.id).then(() => { notify('Prescription deleted.'); renderPrescriptions(); }).catch(() => notify('Could not delete this file.'));
        break;
      }
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
  app.addEventListener('input', (event) => {
    if (event.target.id !== 'batch-search') return;
    const value = event.target.value;
    history.replaceState(null, '', value ? `#q=${encodeURIComponent(value)}` : location.pathname + location.search);
    renderHome();
    const searchInput = document.getElementById('batch-search');
    if (searchInput) { searchInput.focus(); searchInput.setSelectionRange(value.length, value.length); }
  });
  document.querySelector('.topbar').addEventListener('click', (event) => {
    if (event.target.closest('[data-action="home"]')) { event.preventDefault(); page = { type: 'home' }; render(); }
  });
  app.addEventListener('submit', (event) => {
    if (event.target.id !== 'auth-form') return;
    event.preventDefault();
    submitAuth(event.target);
  });
  logoutButton.addEventListener('click', () => {
    activeEmail = ''; batches = []; sessionStorage.removeItem('dawa-saathi-active-profile');
    showAuth(readProfiles().length ? 'login' : 'register');
  });
  prescriptionPicker.addEventListener('change', () => { queuePrescription(prescriptionPicker.files?.[0]); prescriptionPicker.value = ''; });
  cameraClose.addEventListener('click', () => cameraDialog.close());
  cameraCapture.addEventListener('click', captureCameraPhoto);
  cameraChooseFile.addEventListener('click', () => { cameraDialog.close(); prescriptionPicker.click(); });
  cameraDialog.addEventListener('close', stopCamera);
  document.getElementById('close-viewer').addEventListener('click', () => pdfViewer.close());
  pdfViewer.addEventListener('close', () => {
    pdfFrame.removeAttribute('src');
    if (openPdfUrl) URL.revokeObjectURL(openPdfUrl);
    openPdfUrl = '';
  });
  const rememberedEmail = sessionStorage.getItem('dawa-saathi-active-profile');
  if (rememberedEmail && readProfiles().some((profile) => profile.email === rememberedEmail)) {
    activeEmail = rememberedEmail;
    batches = loadBatches(`${STORAGE_KEY}:${encodeURIComponent(activeEmail)}`);
    render();
  } else {
    sessionStorage.removeItem('dawa-saathi-active-profile');
    showAuth(readProfiles().length ? 'login' : 'register');
  }
})();
