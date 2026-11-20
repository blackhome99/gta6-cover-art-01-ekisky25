// Neon Coast Cover Studio — the cover renderer.
// Draws the whole poster on a 2D canvas at any export size: multi-panel layouts,
// Vice City sunset / neon grades, bold condensed lettering, poster chrome
// (stars, seal, barcode, stamp, tagline strip), grain and vignette.
// Everything here is original art: no Rockstar logo, artwork or font.

const FRAME = 0.02; // outer white frame, fraction of the short side
const GUTTER = 0.014; // white gutter between panels, fraction of the short side

export const GRADE_FILTERS = {
  sunset: 'saturate(1.3) contrast(1.1) sepia(0.22) brightness(1.03)',
  neon: 'saturate(1.7) contrast(1.18) hue-rotate(-14deg) brightness(1.02)',
  dusk: 'saturate(0.85) contrast(1.06) brightness(0.9) sepia(0.12) hue-rotate(-18deg)',
  mono: 'grayscale(1) contrast(1.18) brightness(1.05)',
  vice: 'saturate(1.45) contrast(1.12) hue-rotate(8deg)',
};

function titleGradient(ctx, grade, y0, y1) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  if (grade === 'mono') {
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.55, '#e8e8e8'); g.addColorStop(1, '#9a9a9a');
  } else if (grade === 'neon') {
    g.addColorStop(0, '#8ef6ff'); g.addColorStop(0.5, '#ff7ad9'); g.addColorStop(1, '#ff2e88');
  } else if (grade === 'dusk') {
    g.addColorStop(0, '#ffe9a8'); g.addColorStop(0.55, '#c9a7ff'); g.addColorStop(1, '#7b5cff');
  } else if (grade === 'vice') {
    g.addColorStop(0, '#7dffef'); g.addColorStop(0.5, '#ffd23e'); g.addColorStop(1, '#ff7ad9');
  } else {
    g.addColorStop(0, '#ffe259'); g.addColorStop(0.5, '#ff7a18'); g.addColorStop(1, '#ff2e88');
  }
  return g;
}

/** Panel rectangles for a layout, in canvas pixels. `tilt` panels are polaroids. */
export function layoutRects(layout, W, H) {
  const s = Math.min(W, H);
  const f = FRAME * s;
  const g = GUTTER * s;
  const x0 = f, y0 = f, x1 = W - f, y1 = H - f;
  const w = x1 - x0, h = y1 - y0;
  const R = (x, y, pw, ph, extra = {}) => ({ x, y, w: pw, h: ph, ...extra });
  switch (layout) {
    case 'duo':
      return [R(x0, y0, (w - g) / 2, h), R(x0 + (w + g) / 2, y0, (w - g) / 2, h)];
    case 'trio':
      return [
        R(x0, y0, w * 0.56 - g / 2, h),
        R(x0 + w * 0.56 + g / 2, y0, w * 0.44 - g / 2, (h - g) / 2),
        R(x0 + w * 0.56 + g / 2, y0 + (h + g) / 2, w * 0.44 - g / 2, (h - g) / 2),
      ];
    case 'grid4':
      return [
        R(x0, y0, (w - g) / 2, (h - g) / 2),
        R(x0 + (w + g) / 2, y0, (w - g) / 2, (h - g) / 2),
        R(x0, y0 + (h + g) / 2, (w - g) / 2, (h - g) / 2),
        R(x0 + (w + g) / 2, y0 + (h + g) / 2, (w - g) / 2, (h - g) / 2),
      ];
    case 'hero3': {
      const top = h * 0.6 - g / 2;
      const bot = h * 0.4 - g / 2;
      const cw = (w - 2 * g) / 3;
      return [
        R(x0, y0, w, top),
        R(x0, y0 + top + g, cw, bot),
        R(x0 + cw + g, y0 + top + g, cw, bot),
        R(x0 + 2 * (cw + g), y0 + top + g, cw, bot),
      ];
    }
    case 'tilted': {
      const pw = w * 0.34, ph = h * 0.4;
      return [
        R(x0, y0, w, h, { bg: true }),
        R(x0 + w * 0.56, y0 + h * 0.05, pw, ph, { tilt: -0.1, polaroid: true }),
        R(x0 + w * 0.5, y0 + h * 0.5, pw, ph, { tilt: 0.09, polaroid: true }),
      ];
    }
    case 'hero':
    default:
      return [R(x0, y0, w, h)];
  }
}

/** A deterministic hash of a string, for the barcode bars. */
function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let noisePattern = null;
function grainPattern(ctx) {
  if (noisePattern) return noisePattern;
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const g = c.getContext('2d');
  const img = g.createImageData(128, 128);
  const rnd = mulberry32(20261119);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.floor(rnd() * 255);
    img.data[i] = v; img.data[i + 1] = v; img.data[i + 2] = v; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  noisePattern = ctx.createPattern(c, 'repeat');
  return noisePattern;
}

function gradeOverlay(ctx, rect, grade) {
  const { x, y, w, h } = rect;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  const wash = (stops, mode, alpha) => {
    const g = ctx.createLinearGradient(x, y, x + w, y + h);
    for (const [at, color] of stops) g.addColorStop(at, color);
    ctx.globalCompositeOperation = mode;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  };
  if (grade === 'sunset') {
    wash([[0, 'rgba(255,140,40,0.55)'], [1, 'rgba(255,46,136,0.55)']], 'soft-light', 0.6);
  } else if (grade === 'neon') {
    wash([[0, 'rgba(255,46,136,0.6)'], [1, 'rgba(34,230,255,0.6)']], 'overlay', 0.5);
    wash([[0, 'rgba(0,0,0,0)'], [1, 'rgba(255,46,136,0.35)']], 'screen', 0.5);
  } else if (grade === 'dusk') {
    wash([[0, 'rgba(40,20,90,0.6)'], [1, 'rgba(10,8,30,0.6)']], 'multiply', 0.55);
    wash([[0, 'rgba(140,110,255,0.4)'], [1, 'rgba(0,0,0,0)']], 'screen', 0.4);
  } else if (grade === 'mono') {
    wash([[0, 'rgba(255,255,255,0.25)'], [1, 'rgba(0,0,0,0.25)']], 'overlay', 0.5);
  } else { // vice
    wash([[0, 'rgba(255,122,217,0.5)'], [1, 'rgba(0,0,0,0)']], 'screen', 0.55);
    wash([[0, 'rgba(0,0,0,0)'], [1, 'rgba(25,227,194,0.5)']], 'multiply', 0.5);
  }
  ctx.restore();
}

function drawPhoto(ctx, img, rect, panel, grade, W, H) {
  ctx.save();
  ctx.beginPath();
  const r = Math.max(2, Math.min(W, H) * 0.006);
  ctx.roundRect(rect.x, rect.y, rect.w, rect.h, r);
  ctx.clip();
  if (!img || !img.naturalWidth) {
    const g = ctx.createLinearGradient(rect.x, rect.y, rect.x + rect.w, rect.y + rect.h);
    g.addColorStop(0, '#3d2b63'); g.addColorStop(1, '#120a24');
    ctx.fillStyle = g;
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = `700 ${Math.max(14, H * 0.02)}px system-ui, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('ADD A PHOTO', rect.x + rect.w / 2, rect.y + rect.h / 2);
  } else {
    const iw = img.naturalWidth, ih = img.naturalHeight;
    const s = Math.max(rect.w / iw, rect.h / ih) * Math.max(1, panel.zoom || 1);
    const dw = iw * s, dh = ih * s;
    const dx = rect.x - (dw - rect.w) * (panel.x ?? 0.5);
    const dy = rect.y - (dh - rect.h) * (panel.y ?? 0.5);
    ctx.filter = GRADE_FILTERS[grade] || GRADE_FILTERS.sunset;
    ctx.drawImage(img, dx, dy, dw, dh);
    ctx.filter = 'none';
    gradeOverlay(ctx, rect, grade);
  }
  ctx.restore();
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(rect.x, rect.y, rect.w, rect.h, r);
  ctx.strokeStyle = 'rgba(0,0,0,0.28)';
  ctx.lineWidth = Math.max(1, Math.min(W, H) * 0.002);
  ctx.stroke();
  ctx.restore();
}

function drawRoleChip(ctx, rect, role, H) {
  if (!role) return;
  const size = Math.max(13, H * 0.017);
  ctx.save();
  ctx.font = `${size}px Anton, sans-serif`;
  const tw = ctx.measureText(role).width;
  const padX = size * 0.7, padY = size * 0.42;
  const bx = rect.x + size * 0.6, by = rect.y + rect.h - size * 0.6 - (size + padY * 2);
  ctx.fillStyle = 'rgba(8,4,18,0.88)';
  ctx.beginPath();
  ctx.roundRect(bx, by, tw + padX * 2, size + padY * 2, size * 0.25);
  ctx.fill();
  ctx.fillStyle = '#ffd23e';
  ctx.fillRect(bx, by, size * 0.22, size + padY * 2);
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillText(role, bx + padX + size * 0.22, by + (size + padY * 2) / 2 + size * 0.04);
  ctx.restore();
}

function drawPolaroid(ctx, img, rect, panel, grade, H) {
  const s = Math.min(rect.w, rect.h);
  const border = s * 0.055;
  const captionH = s * 0.16;
  ctx.save();
  ctx.translate(rect.x + rect.w / 2, rect.y + rect.h / 2);
  ctx.rotate(rect.tilt || 0);
  ctx.translate(-rect.w / 2, -rect.h / 2);
  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur = s * 0.08;
  ctx.shadowOffsetY = s * 0.03;
  ctx.fillStyle = '#fdfdf8';
  ctx.fillRect(-border, -border, rect.w + border * 2, rect.h + border * 2 + captionH);
  ctx.shadowColor = 'transparent';
  drawPhoto(ctx, img, { x: 0, y: 0, w: rect.w, h: rect.h }, panel, grade, rect.w + rect.h, rect.w + rect.h);
  ctx.fillStyle = '#1c1430';
  ctx.font = `${Math.max(13, s * 0.075)}px Anton, sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(panel.role || '', rect.w / 2, rect.h + border + captionH / 2);
  ctx.restore();
}

function fitTitle(ctx, title, maxW, startSize) {
  const set = (size) => { ctx.font = `${size}px Anton, sans-serif`; };
  let size = startSize;
  set(size);
  while (size > startSize * 0.42 && ctx.measureText(title).width > maxW) {
    size *= 0.92;
    set(size);
  }
  if (ctx.measureText(title).width <= maxW) return { lines: [title], size };
  const words = title.split(/\s+/).filter(Boolean);
  let best = null;
  for (let i = 1; i < words.length; i++) {
    const a = words.slice(0, i).join(' ');
    const b = words.slice(i).join(' ');
    const wa = ctx.measureText(a).width, wb = ctx.measureText(b).width;
    const score = Math.max(wa, wb) + Math.abs(wa - wb) * 0.25;
    if (!best || score < best.score) best = { a, b, score };
  }
  const two = best ? [best.a, best.b] : [title];
  size = startSize * 0.8;
  set(size);
  while (size > startSize * 0.36 && two.some((l) => ctx.measureText(l).width > maxW)) {
    size *= 0.92;
    set(size);
  }
  return { lines: two, size };
}

function drawSeal(ctx, cx, cy, r, stamp) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-0.21);
  ctx.strokeStyle = '#ffd23e';
  ctx.lineWidth = Math.max(2, r * 0.07);
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
  ctx.lineWidth = Math.max(1, r * 0.035);
  ctx.beginPath(); ctx.arc(0, 0, r * 0.78, 0, Math.PI * 2); ctx.stroke();
  const ring = '★ NEON COAST ★ 100% ORIGINAL ★ ';
  ctx.fillStyle = '#ffd23e';
  ctx.font = `${r * 0.21}px Anton, sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (let i = 0; i < ring.length; i++) {
    const a = (i / ring.length) * Math.PI * 2 - Math.PI / 2;
    ctx.save();
    ctx.rotate(a);
    ctx.translate(0, -r * 0.89);
    ctx.fillText(ring[i], 0, 0);
    ctx.restore();
  }
  ctx.fillStyle = '#fff';
  ctx.font = `${r * 0.52}px Anton, sans-serif`;
  ctx.fillText('100%', 0, -r * 0.1);
  ctx.font = `${r * 0.2}px Anton, sans-serif`;
  ctx.fillText(stamp || 'ORIGINAL', 0, r * 0.34);
  ctx.restore();
}

function drawBarcode(ctx, x, y, w, h, seedText) {
  const rnd = mulberry32(hashString(seedText || 'neon'));
  ctx.save();
  ctx.fillStyle = '#fff';
  ctx.fillRect(x - w * 0.06, y - h * 0.25, w * 1.12, h * 1.6);
  ctx.fillStyle = '#111';
  let bx = x;
  while (bx < x + w) {
    const bw = (1 + Math.floor(rnd() * 3)) * (w / 52);
    if (rnd() > 0.42) ctx.fillRect(bx, y, bw, h);
    bx += bw + w / 52;
  }
  ctx.font = `${Math.max(9, h * 0.32)}px system-ui, sans-serif`;
  ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  ctx.fillText('8 90206 2026 11', x, y + h * 1.08);
  ctx.restore();
}

function drawStamp(ctx, x, y, text, H) {
  const size = Math.max(13, H * 0.021);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.14);
  ctx.font = `${size}px Anton, sans-serif`;
  const tw = ctx.measureText(text).width;
  const padX = size * 0.8, padY = size * 0.4;
  ctx.strokeStyle = '#ff2e4d';
  ctx.lineWidth = Math.max(2, size * 0.12);
  ctx.strokeRect(-padX, -padY, tw + padX * 2, size + padY * 2);
  ctx.fillStyle = 'rgba(255,46,77,0.12)';
  ctx.fillRect(-padX, -padY, tw + padX * 2, size + padY * 2);
  ctx.fillStyle = '#ff2e4d';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, tw / 2, size * 0.06);
  ctx.restore();
}

function drawTitleBlock(ctx, W, H, state) {
  const landscape = W > H;
  const stripH = H * 0.062;
  const margin = W * 0.045;
  const maxW = W * 0.86;
  const startSize = H * (landscape ? 0.125 : 0.112);
  const { lines, size } = fitTitle(ctx, (state.title || 'UNTITLED').toUpperCase(), maxW, startSize);
  const lineH = size * 1.02;
  // A two-line title needs the band to start higher so every row still fits.
  const bandTop = H * (landscape || lines.length > 1 ? 0.64 : 0.7);

  // Sunset scrim so the lettering sits on the art.
  const scrim = ctx.createLinearGradient(0, bandTop - H * 0.08, 0, H - stripH);
  scrim.addColorStop(0, 'rgba(12,4,28,0)');
  scrim.addColorStop(0.35, 'rgba(12,4,28,0.55)');
  scrim.addColorStop(1, 'rgba(12,4,28,0.92)');
  ctx.fillStyle = scrim;
  ctx.fillRect(0, bandTop - H * 0.08, W, H - stripH - (bandTop - H * 0.08));

  let baseline = bandTop + size * (lines.length > 1 ? 0.85 : 0.92);
  ctx.save();
  ctx.rotate(-0.015);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';
  ctx.miterLimit = 2;
  lines.forEach((line, i) => {
    const y = baseline + i * lineH;
    ctx.font = `${size}px Anton, sans-serif`;
    ctx.shadowColor = 'rgba(0,0,0,0.55)';
    ctx.shadowBlur = size * 0.12;
    ctx.shadowOffsetY = size * 0.05;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = size * 0.085;
    ctx.strokeText(line, margin, y);
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    ctx.fillStyle = titleGradient(ctx, state.grade, y - size, y);
    ctx.fillText(line, margin, y);
  });
  ctx.restore();
  const titleBottom = baseline + (lines.length - 1) * lineH + size * 0.14;

  // One row under the title: quote + stars on the left, script on the right.
  const rowY = titleBottom + H * 0.034;
  ctx.save();
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.font = `italic 600 ${Math.max(13, H * 0.026)}px Georgia, serif`;
  const quote = state.quote ? `"${state.quote}"` : '';
  ctx.fillText(quote, margin, rowY);
  const qw = ctx.measureText(quote).width;
  ctx.font = `${Math.max(11, H * 0.018)}px Anton, sans-serif`;
  try { ctx.letterSpacing = `${Math.max(1, H * 0.002)}px`; } catch { /* older canvas */ }
  ctx.fillStyle = '#ffd23e';
  const byText = state.quoteBy ? `— ${state.quoteBy.toUpperCase()}` : '';
  const byX = margin + qw + W * 0.015;
  ctx.fillText(byText, byX, rowY);
  const byW = ctx.measureText(byText).width;
  try { ctx.letterSpacing = '0px'; } catch { /* ignore */ }
  ctx.font = `${Math.max(14, H * 0.03)}px system-ui, sans-serif`;
  ctx.fillStyle = '#ffd23e';
  ctx.fillText('★★★★★', byX + byW + W * 0.02, rowY);
  ctx.restore();
  if (state.script) {
    ctx.save();
    ctx.translate(W * 0.96, rowY);
    ctx.rotate(-0.07);
    ctx.font = `${H * 0.034}px Pacifico, cursive`;
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(255,46,136,0.9)';
    ctx.shadowBlur = H * 0.012;
    ctx.fillStyle = '#fff';
    ctx.fillText(state.script, 0, 0);
    ctx.restore();
  }

  // Barcode row: barcode + stamp left, seal right.
  const bcY = rowY + H * 0.032;
  drawBarcode(ctx, margin, bcY, W * 0.15, H * 0.03, state.title);
  drawStamp(ctx, margin + W * 0.24, bcY + H * 0.006, state.stamp || 'COMING SOON', H);
  drawSeal(ctx, W * 0.92, H - stripH - H * 0.04, H * 0.038, state.stamp === 'WANTED' ? 'WANTED' : 'ORIGINAL');

  // Tagline strip.
  ctx.fillStyle = '#0a0514';
  ctx.fillRect(0, H - stripH, W, stripH);
  ctx.fillStyle = '#ff5e3a';
  ctx.fillRect(0, H - stripH, W, Math.max(2, H * 0.004));
  ctx.save();
  ctx.font = `${Math.max(12, H * 0.024)}px Anton, sans-serif`;
  try { ctx.letterSpacing = `${Math.max(2, H * 0.004)}px`; } catch { /* ignore */ }
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText((state.tagline || '').toUpperCase(), W / 2, H - stripH / 2 + H * 0.002);
  ctx.restore();
}

function drawTopChrome(ctx, W, H, state) {
  const size = Math.max(13, H * 0.024);
  ctx.save();
  ctx.font = `${size}px Anton, sans-serif`;
  try { ctx.letterSpacing = `${Math.max(2, H * 0.003)}px`; } catch { /* ignore */ }
  ctx.textBaseline = 'alphabetic';
  ctx.shadowColor = 'rgba(0,0,0,0.65)';
  ctx.shadowBlur = H * 0.008;
  ctx.shadowOffsetY = H * 0.002;
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'left';
  ctx.fillText('NEON COAST', W * 0.045, H * 0.055);
  ctx.textAlign = 'right';
  ctx.fillText((state.vol || 'VOL. 01').toUpperCase(), W * 0.955, H * 0.055);
  ctx.restore();
}

/** Draw the cover described by `state` into `ctx` at W x H. `photos` maps id -> Image. */
export function drawCover(ctx, W, H, state, photos) {
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, W, H);
  const rects = layoutRects(state.layout, W, H);
  const count = rects.length;
  rects.forEach((rect, i) => {
    const panel = state.panels[i] || state.panels[0];
    const img = photos ? photos.get(panel.photo) : null;
    if (rect.polaroid) {
      drawPolaroid(ctx, img, rect, panel, state.grade, H);
    } else {
      drawPhoto(ctx, img, rect, panel, state.grade, W, H);
      if (!rect.bg) drawRoleChip(ctx, rect, panel.role, H);
    }
  });
  if (count > 1 && state.layout !== 'tilted') {
    // A thin sunset rule under the top chrome, poster style.
    const g = ctx.createLinearGradient(0, 0, W, 0);
    g.addColorStop(0, '#ffd23e'); g.addColorStop(0.5, '#ff5e3a'); g.addColorStop(1, '#ff2e88');
    ctx.fillStyle = g;
    ctx.fillRect(W * 0.045, H * 0.068, W * 0.18, Math.max(2, H * 0.005));
  }
  drawTopChrome(ctx, W, H, state);
  drawTitleBlock(ctx, W, H, state);

  // Grain + vignette.
  ctx.save();
  ctx.globalAlpha = 0.07;
  ctx.globalCompositeOperation = 'overlay';
  ctx.fillStyle = grainPattern(ctx);
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
  const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.42, W / 2, H / 2, Math.max(W, H) * 0.75);
  vg.addColorStop(0, 'rgba(10,0,24,0)');
  vg.addColorStop(1, 'rgba(10,0,24,0.34)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);
}

/** Render the cover to a fresh canvas at w x h and return it. */
export function renderCover(state, photos, w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  drawCover(canvas.getContext('2d'), w, h, state, photos);
  return canvas;
}
