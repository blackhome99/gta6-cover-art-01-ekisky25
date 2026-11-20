// Neon Coast Cover Studio — the entry program (Node 22, standard library only).
// It hands the app in: copies app/ and screenshots/ from beside this file to
// the output directory and writes /output/dossier.json with the kit's vendored
// make.fun library (vendor/makefun-app.ts, unchanged). Outside the grader,
// MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The app itself: static files under app/, index.html at its root.
mkdirSync(out, { recursive: true });
cpSync(join(here, 'app'), join(out, 'app'), { recursive: true });

// The screenshots: 3 or 4 JPEGs, the first by name the cover. An empty
// screenshots/ still goes in so the dossier builder can report it plainly.
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

// The gate's own caps (reference/gate.json): only text_max_bytes shapes the
// dossier's bytes. The rest refuse an entry the scorer would refuse — more
// than 4 screenshots or one over 256 KiB, more than 993 entries in app/ or
// 48 MiB of app files in all, or a path under app/ over 1000 bytes — so the
// program fails here exactly where the scorer would.
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    app_max_files: 993,
    app_max_bytes: 50331648,
    app_path_max_bytes: 1000,
  }),
);

console.log(`neon-coast cover studio handed in to ${out}`);
