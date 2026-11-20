// Neon Coast Cover Studio — editor state, layouts, grades and surprise presets.
// All state is plain JSON-able data so undo/redo is a snapshot stack.

export const LAYOUTS = [
  { id: 'hero', name: 'Hero', panels: 1, hint: 'One big photo, full bleed' },
  { id: 'duo', name: 'Duo', panels: 2, hint: 'Two panels, side by side' },
  { id: 'trio', name: 'Trio', panels: 3, hint: 'Hero left, two stacked right' },
  { id: 'grid4', name: 'Grid 4', panels: 4, hint: 'Four-panel poster grid' },
  { id: 'hero3', name: 'Hero + 3', panels: 4, hint: 'Hero on top, three below' },
  { id: 'tilted', name: 'Tilted', panels: 3, hint: 'Tilted snapshots on a hero' },
];

export const GRADES = [
  { id: 'sunset', name: 'Sunset', swatch: 'linear-gradient(135deg,#ffd23e,#ff5e3a 55%,#ff2e88)' },
  { id: 'neon', name: 'Neon', swatch: 'linear-gradient(135deg,#22e6ff,#ff2e88 60%,#7b2eff)' },
  { id: 'dusk', name: 'Dusk', swatch: 'linear-gradient(135deg,#3b2d8f,#1b1035 60%,#0d0a1a)' },
  { id: 'mono', name: 'Mono', swatch: 'linear-gradient(135deg,#f2f2f2,#8a8a8a 60%,#111)' },
  { id: 'vice', name: 'Vice', swatch: 'linear-gradient(135deg,#19e3c2,#ff7ad9 60%,#2b0a3d)' },
];

export const SIZES = [
  { id: '1080x1080', label: 'Square', w: 1080, h: 1080 },
  { id: '1080x1350', label: 'Portrait', w: 1080, h: 1350 },
  { id: '1920x1080', label: 'Landscape', w: 1920, h: 1080 },
];

export const SAMPLE_PHOTOS = [
  { id: 'boulevard', name: 'Boulevard', src: 'samples/boulevard.jpg' },
  { id: 'pier', name: 'Pier', src: 'samples/pier.jpg' },
];

const ROLES = ['THE DRIVER', 'THE LOOKOUT', 'THE FIXER', 'THE GETAWAY'];

/** A fresh panel slot. `photo` is a photo id ('boulevard' | 'pier') or an upload key.
 * The vertical anchor sits high (0.10): faces sit in the top third of a photo,
 * so a wide hero crop keeps the whole face in frame instead of cutting it
 * across the eyes. The user can still drag any photo to reposition it. */
export function newPanel(photo, role) {
  return { photo, x: 0.5, y: 0.1, zoom: 1, role };
}

export function defaultState() {
  return {
    layout: 'hero3',
    grade: 'sunset',
    size: '1080x1080',
    title: 'SUNSET HEIST',
    script: 'a neon coast story',
    tagline: 'EVERY SUNSET HAS A PRICE',
    quote: 'The getaway of the year.',
    quoteBy: 'COAST WEEKLY',
    vol: 'VOL. 01',
    stamp: 'COMING SOON',
    selected: 0,
    panels: [
      newPanel('pier', ROLES[0]),
      newPanel('boulevard', ROLES[1]),
      newPanel('pier', ROLES[2]),
      newPanel('boulevard', ROLES[3]),
    ],
  };
}

export function cloneState(state) {
  return JSON.parse(JSON.stringify(state));
}

/** How many panels the current layout actually shows. */
export function panelCount(state) {
  const layout = LAYOUTS.find((l) => l.id === state.layout) || LAYOUTS[0];
  return layout.panels;
}

/** Clamp the selected panel index to the visible panels. */
export function clampSelection(state) {
  state.selected = Math.max(0, Math.min(panelCount(state) - 1, state.selected || 0));
  return state;
}

const TITLES = [
  'SUNSET HEIST', 'NEON GETAWAY', 'PIER PRESSURE', 'BOULEVARD QUEEN',
  'LAST SUNSET', 'VICE RUNNER', 'GOLDEN HOUR', 'MIDNIGHT COAST',
];
const SCRIPTS = [
  'a neon coast story', 'one last job', 'ride into the sunset',
  'every sunset has a price', 'the coast never sleeps', 'chase the light',
];
const TAGLINES = [
  'EVERY SUNSET HAS A PRICE', 'NO BRAKES. NO REGRETS.', 'STEAL THE GOLDEN HOUR',
  'THE COAST IS OURS TONIGHT', 'DRIVE FAST. SHINE BRIGHT.', 'OUTRUN THE NIGHT',
];
const QUOTES = [
  ['The getaway of the year.', 'COAST WEEKLY'],
  ['Pure sunset chaos, beautifully framed.', 'PALM PRESS'],
  ['The most wanted poster of the summer.', 'NEON TIMES'],
  ['A heist you can hang on the wall.', 'BOULEVARD DAILY'],
];
const STAMPS = ['COMING SOON', 'OUT NOW', 'WANTED', 'LIMITED RUN'];

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

/** A random, coherent cover: layout, grade, caption, photos and stamp. */
export function surpriseState(state) {
  const next = cloneState(state);
  const quote = pick(QUOTES);
  next.layout = pick(LAYOUTS).id;
  next.grade = pick(GRADES).id;
  next.title = pick(TITLES);
  next.script = pick(SCRIPTS);
  next.tagline = pick(TAGLINES);
  next.quote = quote[0];
  next.quoteBy = quote[1];
  next.stamp = pick(STAMPS);
  const photos = ['boulevard', 'pier'];
  next.panels = next.panels.map((panel, i) => ({
    ...panel,
    photo: photos[(i + Math.floor(Math.random() * 2)) % 2],
    x: 0.35 + Math.random() * 0.3,
    y: 0.35 + Math.random() * 0.3,
    zoom: 1 + Math.random() * 0.35,
    role: ROLES[i % ROLES.length],
  }));
  return clampSelection(next);
}
