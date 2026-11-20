// Neon Coast Cover Studio — screenshot scenes (?shot=...).
// The same app the user edits also draws its own screenshot scenes, so every
// screenshot is the app's own drawing, never edited or composited:
//   ?shot=cover&photo=pier&caption=Sunset%20Heist&w=1920&h=1080
//       full-frame exported cover at the requested export size
//   ?shot=editor&photo=boulevard&caption=Boulevard%20Queen
//       the editor with a sample photo loaded, panels and controls visible
// Optional: &layout=hero3&grade=sunset&size=1080x1350&tagline=...&script=...

import { LAYOUTS, GRADES, SIZES, clampSelection } from './state.js';

function param(search, name) {
  const v = search.get(name);
  return v === null ? null : v;
}

/**
 * Read the shot parameters and fold them into a copy of `state`.
 * Returns { mode: 'cover' | 'editor' | null, w, h } — null when no ?shot= is set.
 */
export function applyShot(state, search = new URLSearchParams(location.search)) {
  const mode = param(search, 'shot');
  if (mode !== 'cover' && mode !== 'editor') return { mode: null, w: 0, h: 0 };
  const next = JSON.parse(JSON.stringify(state));
  const photo = param(search, 'photo');
  if (photo === 'boulevard' || photo === 'pier') {
    next.panels = next.panels.map((p) => ({ ...p, photo }));
  }
  // Per-panel photos, e.g. &photos=boulevard,pier,boulevard,pier — a mixed
  // grid instead of the same photo in every panel. Unknown ids keep the
  // panel's own photo; a short list wraps around.
  const photos = param(search, 'photos');
  if (photos) {
    const ids = photos.split(',').map((s) => s.trim());
    next.panels = next.panels.map((p, i) => {
      const id = ids[i % ids.length];
      return (id === 'boulevard' || id === 'pier') ? { ...p, photo: id } : p;
    });
  }
  const caption = param(search, 'caption');
  if (caption) next.title = caption.toUpperCase();
  const layout = param(search, 'layout');
  if (layout && LAYOUTS.some((l) => l.id === layout)) next.layout = layout;
  const grade = param(search, 'grade');
  if (grade && GRADES.some((g) => g.id === grade)) next.grade = grade;
  const tagline = param(search, 'tagline');
  if (tagline) next.tagline = tagline.toUpperCase();
  const script = param(search, 'script');
  if (script) next.script = script;
  const sizeId = param(search, 'size');
  const size = SIZES.find((s) => s.id === sizeId);
  if (size) next.size = size.id;
  clampSelection(next);

  let w = size ? size.w : 1080;
  let h = size ? size.h : 1080;
  const pw = Number(param(search, 'w'));
  const ph = Number(param(search, 'h'));
  if (Number.isInteger(pw) && pw >= 240 && pw <= 3840) w = pw;
  if (Number.isInteger(ph) && ph >= 240 && ph <= 3840) h = ph;
  return { mode, w, h, state: next };
}
