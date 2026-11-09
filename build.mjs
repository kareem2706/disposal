// Construction du site : assemble les sources en un site statique dans _site/
//   css/*.css  → app.css   (dans l'ordre des noms de fichiers)
//   core/*.ts  → BleenrCore (logique partagée avec l'app iOS), placé en tête de app.js
//   js/landing/*.js → landing.js (page d'accueil, toujours chargée, avec le core)
//   js/*.js    → app.js    (l'application : tout de suite si session, sinon à la demande)
//   js/admin/*.js → admin.js (chargé à la demande, seulement quand un admin ouvre une page d'admin)
//   index.html → index.html (?v=__V__ remplacé par la version, pour vider le cache des navigateurs)
// Seuls les fichiers du site sont publiés (pas supabase/, ni les sources).
// Usage : npm run build   (GitHub Actions le lance à chaque envoi sur main, après npm test)
import fs from 'node:fs';
import { buildSync } from 'esbuild';
import path from 'node:path';
import { execSync } from 'node:child_process';

const root = path.dirname(new URL(import.meta.url).pathname);
const out = path.join(root, '_site');
let ver = (process.env.CF_PAGES_COMMIT_SHA || process.env.GITHUB_SHA || '').slice(0, 8);
if (!ver) { try { ver = execSync('git rev-parse --short=8 HEAD', { cwd: root }).toString().trim(); } catch { ver = String(Date.now()); } }

const concat = (dir, ext) => fs.readdirSync(path.join(root, dir)).filter((f) => f.endsWith(ext)).sort()
  .map((f) => fs.readFileSync(path.join(root, dir, f), 'utf8')).join('');

// ── Environnement : production (branche main) ou développement (toute autre branche) ──
//   BLEENR_ENV=prod|dev force le choix ; sinon branche Cloudflare Pages / GitHub / git locale.
const site = JSON.parse(fs.readFileSync(path.join(root, 'site.json'), 'utf8'));
let branch = process.env.CF_PAGES_BRANCH || process.env.GITHUB_REF_NAME || '';
if (!branch) { try { branch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: root }).toString().trim(); } catch { branch = 'main'; } }
const envName = process.env.BLEENR_ENV || (branch === 'main' ? 'prod' : 'dev');
const env = site.envs[envName];
if (!env) throw new Error('Environnement inconnu : ' + envName);
if (!env.supabase_url || !env.supabase_anon_key) throw new Error('site.json › envs.' + envName + ' : supabase_url / supabase_anon_key à compléter');
site.env = envName;
site.url = env.url;
const isProd = envName === 'prod';
// Développement : bandeau « DEV » et pages exclues des moteurs de recherche
site.env_head = isProd ? '' : '<meta name="robots" content="noindex,nofollow"><style>#bleenr-env{position:fixed;left:10px;bottom:10px;z-index:2147483647;background:#C77A10;color:#fff;font:700 11px/1 system-ui,sans-serif;letter-spacing:.08em;padding:6px 9px;border-radius:7px;box-shadow:0 2px 8px rgba(0,0,0,.25);pointer-events:none}</style>';
site.env_badge = isProd ? '' : '<div id="bleenr-env">DEV · ' + branch.replace(/[<>&"]/g, '') + '</div>';
const envJs = 'var BLEENR_ENV=' + JSON.stringify({ name: envName, siteUrl: env.url, supabaseUrl: env.supabase_url, supabaseAnonKey: env.supabase_anon_key }) + ';\n';

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'app.css'), concat('css', '.css'));
// Core : bundle IIFE exposé en global « BleenrCore » (ES2019 pour les navigateurs plus anciens)
const core = buildSync({ entryPoints: [path.join(root, 'core', 'index.ts')], bundle: true, format: 'iife', globalName: 'BleenrCore', target: 'es2019', write: false, legalComments: 'none' }).outputFiles[0].text
  // « use strict » d'esbuild retiré : en tête de app.js il rendrait TOUT le script strict (changement de comportement)
  .replace(/^\s*["']use strict["'];?\s*/, '');
if (/^\s*["']use strict/.test(core)) throw new Error('core: directive use strict non retirée');
// landing.js : core + page d'accueil (toujours chargé) ; app.js : l'application (chargée tout de suite ou à la demande)
fs.writeFileSync(path.join(out, 'landing.js'), (envJs + '// ── core (core/*.ts, partagé avec l’app iOS) ──\n' + core + concat(path.join('js', 'landing'), '.js')).replaceAll('__V__', ver));
fs.writeFileSync(path.join(out, 'app.js'), concat('js', '.js').replaceAll('__V__', ver));
fs.writeFileSync(path.join(out, 'admin.js'), concat(path.join('js', 'admin'), '.js').replaceAll('__V__', ver));
// Informations de la société / adresse du site (site.json) : {{url}}, {{company.name}}, {{company.vat}}…
const fill = (txt, file) => txt.replaceAll('__V__', ver).replace(/\{\{\s*([\w.]+)\s*\}\}/g, (m, key) => {
  const v = key.split('.').reduce((o, k) => (o == null ? undefined : o[k]), site);
  if (v == null) throw new Error(file + ' : valeur inconnue {{' + key + '}} (site.json)');
  return String(v);
});
const page = (src, dst = src) => {
  fs.mkdirSync(path.dirname(path.join(out, dst)), { recursive: true });
  fs.writeFileSync(path.join(out, dst), fill(fs.readFileSync(path.join(root, src), 'utf8'), src));
};
page('index.html');
for (const f of ['404.html', 'sitemap.xml', 'manifest.webmanifest', '_headers']) page(f);
// robots.txt : tout autorisé en production, tout interdit en développement
if (isProd) page('robots.txt'); else fs.writeFileSync(path.join(out, 'robots.txt'), 'User-agent: *\nDisallow: /\n');
for (const f of fs.readdirSync(path.join(root, 'legal'))) page(path.join('legal', f));
for (const p of ['assets', 'i18n', 'logo.png', 'logo_text.png', 'logo_text_light.png', 'favicon.ico']) {
  if (fs.existsSync(path.join(root, p))) fs.cpSync(path.join(root, p), path.join(out, p), { recursive: true });
}
console.log('Site construit dans _site/ (version ' + ver + ', environnement ' + envName + ', branche ' + branch + ')');
