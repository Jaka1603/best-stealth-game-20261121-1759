// MOONLIT ESTATE — the hand-in program (Node 22+, standard library only).
//
// The game itself is this directory's game/ folder: plain static files a
// desktop browser loads offline — game/index.html and its ES modules, no
// library, no network request. This program gathers game/ and screenshots/
// from beside itself into the output directory and writes dossier.json
// there, the summary the judge reads, using the vendored make.fun
// library to build it.
//
// Play it locally first: `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for
// /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const rootDir = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

function copyTree(from, to) {
  cpSync(join(rootDir, from), join(outDir, to), { recursive: true });
}

mkdirSync(outDir, { recursive: true });
copyTree('game', 'game');
mkdirSync(join(outDir, 'screenshots'), { recursive: true });
if (existsSync(join(rootDir, 'screenshots'))) {
  copyTree('screenshots', 'screenshots');
}

// The scorer's own caps, as the kit states them: at most 4 screenshots of
// 256 KiB each, at most 993 files and 48 MiB under game/, no game/ path
// over 1000 bytes, and the dossier text capped at 160 KiB.
const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(outDir, 'dossier.json'), dossier);
