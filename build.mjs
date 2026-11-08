// Construction du site : assemble les sources en un site statique dans _site/
//   css/*.css  → app.css   (dans l'ordre des noms de fichiers)
//   core/*.ts  → BleenrCore (logique partagée avec l'app iOS), placé en tête de app.js
//   js/*.js    → app.js    (idem : un seul script, comme avant le découpage)
//   index.html → index.html (?v=__V__ remplacé par la version, pour vider le cache des navigateurs)
// Seuls les fichiers du site sont publiés (pas supabase/, ni les sources).
// Usage : npm run build   (GitHub Actions le lance à chaque envoi sur main, après npm test)
import fs from 'node:fs';
import { buildSync } from 'esbuild';
import path from 'node:path';
import { execSync } from 'node:child_process';

const root = path.dirname(new URL(import.meta.url).pathname);
const out = path.join(root, '_site');
let ver = process.env.GITHUB_SHA ? process.env.GITHUB_SHA.slice(0, 8) : '';
if (!ver) { try { ver = execSync('git rev-parse --short=8 HEAD', { cwd: root }).toString().trim(); } catch { ver = String(Date.now()); } }

const concat = (dir, ext) => fs.readdirSync(path.join(root, dir)).filter((f) => f.endsWith(ext)).sort()
  .map((f) => fs.readFileSync(path.join(root, dir, f), 'utf8')).join('');

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'app.css'), concat('css', '.css'));
// Core : bundle IIFE exposé en global « BleenrCore » (ES2019 pour les navigateurs plus anciens)
const core = buildSync({ entryPoints: [path.join(root, 'core', 'index.ts')], bundle: true, format: 'iife', globalName: 'BleenrCore', target: 'es2019', write: false, legalComments: 'none' }).outputFiles[0].text
  // « use strict » d'esbuild retiré : en tête de app.js il rendrait TOUT le script strict (changement de comportement)
  .replace(/^\s*["']use strict["'];?\s*/, '');
if (/^\s*["']use strict/.test(core)) throw new Error('core: directive use strict non retirée');
fs.writeFileSync(path.join(out, 'app.js'), '// ── core (core/*.ts, partagé avec l’app iOS) ──\n' + core + concat('js', '.js'));
fs.writeFileSync(path.join(out, 'index.html'), fs.readFileSync(path.join(root, 'index.html'), 'utf8').replaceAll('__V__', ver));
for (const p of ['assets', 'i18n', 'logo.png', 'logo_text.png', 'logo_text_light.png']) {
  if (fs.existsSync(path.join(root, p))) fs.cpSync(path.join(root, p), path.join(out, p), { recursive: true });
}
console.log('Site construit dans _site/ (version ' + ver + ')');
