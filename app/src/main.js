// Neon Coast Cover Studio — the editor: photos, panels, captions, export.
// Vanilla ES modules, no build step, no network: every file it loads lives
// under app/, photos are read on the user's own machine and never uploaded.

import { LAYOUTS, GRADES, SIZES, SAMPLE_PHOTOS, defaultState, cloneState, panelCount, clampSelection, surpriseState } from './state.js';
import { drawCover, renderCover, layoutRects } from './cover.js';
import { applyShot } from './shots.js';

const $ = (id) => document.getElementById(id);
const preview = $('preview');
const pctx = preview.getContext('2d');

let state = defaultState();
let shot = { mode: null, w: 0, h: 0 };
const photos = new Map(); // photo id -> HTMLImageElement
const uploads = []; // { id, name } in load order
let uploadSeq = 0;
let undoStack = [];
let redoStack = [];
let renderQueued = false;

function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

async function loadSamples() {
  for (const sample of SAMPLE_PHOTOS) {
    const img = await loadImage(sample.src);
    if (img) photos.set(sample.id, img);
  }
  queueRender();
}

function pushUndo() {
  undoStack.push(cloneState(state));
  if (undoStack.length > 40) undoStack.shift();
  redoStack = [];
  syncUndoButtons();
}

function applySnapshot(next) {
  state = clampSelection(next);
  syncUI();
  queueRender();
}

function undo() {
  if (!undoStack.length) return;
  redoStack.push(cloneState(state));
  applySnapshot(undoStack.pop());
  syncUndoButtons();
}

function redo() {
  if (!redoStack.length) return;
  undoStack.push(cloneState(state));
  applySnapshot(redoStack.pop());
  syncUndoButtons();
}

function syncUndoButtons() {
  $('undoBtn').disabled = undoStack.length === 0;
  $('redoBtn').disabled = redoStack.length === 0;
}

/** Size the preview canvas for the current export size and draw the cover. */
function render() {
  renderQueued = false;
  if (shot.mode === 'cover') {
    preview.width = shot.w;
    preview.height = shot.h;
    preview.style.aspectRatio = `${shot.w} / ${shot.h}`;
    drawCover(pctx, shot.w, shot.h, state, photos);
    return;
  }
  const size = SIZES.find((s) => s.id === state.size) || SIZES[0];
  const scale = Math.min(1, 960 / Math.max(size.w, size.h));
  preview.width = Math.round(size.w * scale);
  preview.height = Math.round(size.h * scale);
  preview.style.aspectRatio = `${size.w} / ${size.h}`;
  drawCover(pctx, preview.width, preview.height, state, photos);
  updatePanelHint();
}

function queueRender() {
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(render);
}

function selectedPanel() {
  return state.panels[state.selected] || state.panels[0];
}

function updatePanelHint() {
  const hint = $('panelHint');
  const n = panelCount(state);
  const panel = selectedPanel();
  hint.textContent = n > 1
    ? `Panel ${state.selected + 1} of ${n} — ${panel.role}: drag the photo to move it, scroll or use Zoom to crop.`
    : 'Drag the photo to move it, scroll or use Zoom to crop.';
  $('zoomRange').value = String(Math.round((panel.zoom || 1) * 100));
  $('zoomVal').textContent = `${Math.round((panel.zoom || 1) * 100)}%`;
}

function syncUI() {
  document.querySelectorAll('[data-layout]').forEach((b) => b.classList.toggle('active', b.dataset.layout === state.layout));
  document.querySelectorAll('[data-grade]').forEach((b) => b.classList.toggle('active', b.dataset.grade === state.grade));
  document.querySelectorAll('[data-size]').forEach((b) => b.classList.toggle('active', b.dataset.size === state.size));
  $('titleInput').value = state.title;
  $('scriptInput').value = state.script;
  $('taglineInput').value = state.tagline;
  $('quoteInput').value = state.quote;
  $('quoteByInput').value = state.quoteBy;
  $('volInput').value = state.vol;
  $('stampInput').value = state.stamp;
  $('roleInput').value = selectedPanel().role || '';
  $('roleLabel').textContent = `Role — panel ${state.selected + 1}`;
  document.querySelectorAll('[data-photo]').forEach((b) => b.classList.toggle('active', b.dataset.photo === selectedPanel().photo));
  updatePanelHint();
  $('layoutHint').textContent = (LAYOUTS.find((l) => l.id === state.layout) || {}).hint || '';
}

function toast(msg) {
  const el = $('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove('show'), 2600);
}

function exportPNG() {
  const size = SIZES.find((s) => s.id === state.size) || SIZES[0];
  const canvas = renderCover(state, photos, size.w, size.h);
  canvas.toBlob((blob) => {
    if (!blob) { toast('Export failed — try again.'); return; }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `neon-coast-cover-${size.w}x${size.h}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    toast(`Exported ${size.w} × ${size.h} PNG — share it!`);
  }, 'image/png');
}

function setPhotoForSelected(photoId) {
  pushUndo();
  selectedPanel().photo = photoId;
  queueRender();
  syncUI();
}

function addUpload(file) {
  if (!file || !file.type.startsWith('image/')) { toast('That file is not an image.'); return; }
  const id = `up-${++uploadSeq}`;
  const url = URL.createObjectURL(file);
  loadImage(url).then((img) => {
    if (!img) { toast('Could not read that image.'); return; }
    photos.set(id, img);
    uploads.push({ id, name: file.name.replace(/\.[^.]+$/, '').slice(0, 18) || 'Photo' });
    renderPhotoStrip();
    pushUndo();
    selectedPanel().photo = id;
    queueRender();
    syncUI();
    toast(`Loaded ${file.name} — it never leaves this machine.`);
  });
}

function renderPhotoStrip() {
  const strip = $('photoStrip');
  strip.querySelectorAll('[data-photo^="up-"]').forEach((b) => b.remove());
  for (const up of uploads) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip';
    b.dataset.photo = up.id;
    b.textContent = up.name;
    b.addEventListener('click', () => setPhotoForSelected(up.id));
    strip.appendChild(b);
  }
}

/** Map a pointer event on the preview to canvas pixels. */
function previewPoint(e) {
  const r = preview.getBoundingClientRect();
  return {
    x: (e.clientX - r.left) * (preview.width / r.width),
    y: (e.clientY - r.top) * (preview.height / r.height),
  };
}

function panelAt(point) {
  const rects = layoutRects(state.layout, preview.width, preview.height);
  for (let i = rects.length - 1; i >= 0; i--) {
    const r = rects[i];
    if (point.x >= r.x && point.x <= r.x + r.w && point.y >= r.y && point.y <= r.y + r.h) return i;
  }
  return -1;
}

function fitNumbers(rect, panel) {
  const img = photos.get(panel.photo);
  if (!img || !img.naturalWidth) return null;
  const s = Math.max(rect.w / img.naturalWidth, rect.h / img.naturalHeight) * Math.max(1, panel.zoom || 1);
  return { dw: img.naturalWidth * s, dh: img.naturalHeight * s };
}

let drag = null;
preview.addEventListener('pointerdown', (e) => {
  const point = previewPoint(e);
  const idx = panelAt(point);
  if (idx < 0) return;
  if (idx !== state.selected) {
    state.selected = idx;
    syncUI();
  }
  const rects = layoutRects(state.layout, preview.width, preview.height);
  drag = { start: point, panel: selectedPanel(), rect: rects[idx], moved: false };
  preview.setPointerCapture(e.pointerId);
  preview.style.cursor = 'grabbing';
});
preview.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const point = previewPoint(e);
  const dx = point.x - drag.start.x;
  const dy = point.y - drag.start.y;
  if (Math.abs(dx) + Math.abs(dy) > 2) drag.moved = true;
  const fit = fitNumbers(drag.rect, drag.panel);
  if (!fit) return;
  if (fit.dw > drag.rect.w) {
    drag.panel.x = Math.max(0, Math.min(1, drag.panel.x - dx / (fit.dw - drag.rect.w)));
  }
  if (fit.dh > drag.rect.h) {
    drag.panel.y = Math.max(0, Math.min(1, drag.panel.y - dy / (fit.dh - drag.rect.h)));
  }
  drag.start = point;
  queueRender();
  updatePanelHint();
});
preview.addEventListener('pointerup', () => {
  if (drag && drag.moved) pushUndo();
  drag = null;
  preview.style.cursor = 'grab';
});
preview.addEventListener('wheel', (e) => {
  e.preventDefault();
  const panel = selectedPanel();
  panel.zoom = Math.max(1, Math.min(3.5, (panel.zoom || 1) * Math.exp(-e.deltaY * 0.0012)));
  queueRender();
  updatePanelHint();
}, { passive: false });

function bindControls() {
  document.querySelectorAll('[data-layout]').forEach((b) => b.addEventListener('click', () => {
    if (b.dataset.layout === state.layout) return;
    pushUndo();
    state.layout = b.dataset.layout;
    clampSelection(state);
    syncUI();
    queueRender();
  }));
  document.querySelectorAll('[data-grade]').forEach((b) => b.addEventListener('click', () => {
    if (b.dataset.grade === state.grade) return;
    pushUndo();
    state.grade = b.dataset.grade;
    syncUI();
    queueRender();
  }));
  document.querySelectorAll('[data-size]').forEach((b) => b.addEventListener('click', () => {
    if (b.dataset.size === state.size) return;
    pushUndo();
    state.size = b.dataset.size;
    syncUI();
    queueRender();
  }));
  document.querySelectorAll('[data-photo]').forEach((b) => b.addEventListener('click', () => setPhotoForSelected(b.dataset.photo)));

  const bindText = (id, key) => {
    $(id).addEventListener('input', (e) => { state[key] = e.target.value; queueRender(); });
    $(id).addEventListener('change', () => pushUndo());
  };
  bindText('titleInput', 'title');
  bindText('scriptInput', 'script');
  bindText('taglineInput', 'tagline');
  bindText('quoteInput', 'quote');
  bindText('quoteByInput', 'quoteBy');
  bindText('volInput', 'vol');
  bindText('stampInput', 'stamp');
  $('roleInput').addEventListener('input', (e) => { selectedPanel().role = e.target.value.toUpperCase(); queueRender(); });
  $('roleInput').addEventListener('change', () => pushUndo());

  $('zoomRange').addEventListener('input', (e) => {
    selectedPanel().zoom = Number(e.target.value) / 100;
    queueRender();
    updatePanelHint();
  });
  $('zoomRange').addEventListener('change', () => pushUndo());
  $('resetCropBtn').addEventListener('click', () => {
    pushUndo();
    const p = selectedPanel();
    p.x = 0.5; p.y = 0.5; p.zoom = 1;
    queueRender();
    updatePanelHint();
  });
  $('allPanelsBtn').addEventListener('click', () => {
    pushUndo();
    const photo = selectedPanel().photo;
    state.panels.forEach((p) => { p.photo = photo; });
    queueRender();
    syncUI();
    toast('Same photo in every panel.');
  });

  $('uploadBtn').addEventListener('click', () => $('fileInput').click());
  $('fileInput').addEventListener('change', (e) => {
    if (e.target.files[0]) addUpload(e.target.files[0]);
    e.target.value = '';
  });
  const drop = $('dropZone');
  ['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('over'); }));
  drop.addEventListener('drop', (e) => {
    if (e.dataTransfer.files[0]) addUpload(e.dataTransfer.files[0]);
  });

  $('surpriseBtn').addEventListener('click', () => {
    pushUndo();
    applySnapshot(surpriseState(state));
    toast('Surprise! A fresh cover, ready to export.');
  });
  $('undoBtn').addEventListener('click', undo);
  $('redoBtn').addEventListener('click', redo);
  $('exportBtn').addEventListener('click', exportPNG);
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
    else if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) { e.preventDefault(); redo(); }
    else if (e.key.startsWith('Arrow') && document.activeElement === preview) {
      const p = selectedPanel();
      const step = 0.03;
      if (e.key === 'ArrowLeft') p.x = Math.max(0, p.x - step);
      if (e.key === 'ArrowRight') p.x = Math.min(1, p.x + step);
      if (e.key === 'ArrowUp') p.y = Math.max(0, p.y - step);
      if (e.key === 'ArrowDown') p.y = Math.min(1, p.y + step);
      e.preventDefault();
      queueRender();
    }
  });
}

async function init() {
  const result = applyShot(state);
  shot = result;
  if (result.mode) {
    state = clampSelection(result.state);
    if (result.mode === 'cover') document.body.classList.add('shot-cover');
    if (result.mode === 'editor') document.body.classList.add('shot-editor');
  }
  bindControls();
  syncUI();
  syncUndoButtons();
  await loadSamples();
  try {
    await Promise.all([document.fonts.load('40px Anton'), document.fonts.load('40px Pacifico')]);
  } catch { /* fonts fall back to system sans; the cover still draws */ }
  queueRender();
  if (document.fonts) document.fonts.ready.then(() => queueRender());
  window.__neonCoast = { get state() { return state; }, render: queueRender, exportPNG, photos };
}

init();
