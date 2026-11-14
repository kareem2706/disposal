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
let ver = (process.env.WORKERS_CI_COMMIT_SHA || process.env.CF_PAGES_COMMIT_SHA || process.env.GITHUB_SHA || '').slice(0, 8);
if (!ver) { try { ver = execSync('git rev-parse --short=8 HEAD', { cwd: root }).toString().trim(); } catch { ver = String(Date.now()); } }

const concat = (dir, ext) => fs.readdirSync(path.join(root, dir)).filter((f) => f.endsWith(ext)).sort()
  .map((f) => fs.readFileSync(path.join(root, dir, f), 'utf8')).join('');

// ── Environnement : production (branche main) ou développement (toute autre branche) ──
//   BLEENR_ENV=prod|dev force le choix ; sinon branche Cloudflare (Workers / Pages) / GitHub / git locale.
const site = JSON.parse(fs.readFileSync(path.join(root, 'site.json'), 'utf8'));
let branch = process.env.WORKERS_CI_BRANCH || process.env.CF_PAGES_BRANCH || process.env.GITHUB_REF_NAME || '';
if (!branch) { try { branch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: root }).toString().trim(); } catch { branch = 'main'; } }
const envName = process.env.BLEENR_ENV || (branch === 'main' ? 'prod' : 'dev');
const env = site.envs[envName];
if (!env) throw new Error('Environnement inconnu : ' + envName);
if (!env.supabase_url || !env.supabase_anon_key) throw new Error('site.json › envs.' + envName + ' : supabase_url / supabase_anon_key à compléter');
site.env = envName;
site.url = env.url;
site.supabase_url = env.supabase_url;            // clé anon : publique (lecture des coordonnées officielles)
site.supabase_anon_key = env.supabase_anon_key;
const isProd = envName === 'prod';
// Développement : bandeau « DEV » et pages exclues des moteurs de recherche
site.env_head = isProd ? '' : '<meta name="robots" content="noindex,nofollow"><style>#bleenr-env{position:fixed;left:10px;bottom:10px;z-index:2147483647;background:#C77A10;color:#fff;font:700 11px/1 system-ui,sans-serif;letter-spacing:.08em;padding:6px 9px;border-radius:7px;box-shadow:0 2px 8px rgba(0,0,0,.25);pointer-events:none}</style>';
site.env_badge = isProd ? '' : '<div id="bleenr-env">DEV · ' + branch.replace(/[<>&"]/g, '') + '</div>';
const envJs = 'var BLEENR_ENV=' + JSON.stringify({ name: envName, siteUrl: env.url, supabaseUrl: env.supabase_url, supabaseAnonKey: env.supabase_anon_key, googleClientId: env.google_client_id || '' }) + ';\n';

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

// Pages services / villes (référencement) : données et gabarit
const { PAGES, LANGS, pagePath, render } = await import('./seo/render.mjs');

// ── Page d'accueil en anglais et en espagnol (référencement) : _site/en/index.html, _site/es/index.html ──
// Même page, textes de la page d'accueil déjà traduits dans le HTML (lisibles par Google sans JavaScript),
// balises <title>, description, aperçus de partage, adresse canonique et données structurées dans la langue.
// <base href="/"> (index.html) : les fichiers (css, js, images…) restent ceux de la racine.
const vm = await import('node:vm');
const dict = (l) => { const ctx = { window: {} }; vm.runInNewContext(fs.readFileSync(path.join(root, 'i18n', l + '.js'), 'utf8'), ctx); return ctx.window.I18N[l]; };
const esc = (v) => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const attr = (v) => esc(v).replace(/"/g, '&quot;');
const rootHtml = fs.readFileSync(path.join(out, 'index.html'), 'utf8');
const LOC = { en: 'en_GB', es: 'es_ES' };
for (const l of ['en', 'es']) {
  const D = dict(l), F = dict('fr');
  const tr = (k) => { if (D[k] == null) throw new Error('i18n/' + l + '.js : clé manquante ' + k); return D[k]; };
  const url = site.url + l + '/';
  let h = rootHtml;
  const a = h.indexOf('<div id="screen-landing"'), b = h.indexOf('<div id="screen-auth"');
  if (a < 0 || b < a) throw new Error('index.html : #screen-landing / #screen-auth introuvables');
  let land = h.slice(a, b);
  land = land.replace(/(<(\w+)\b[^>]*\bdata-i18n(-html)?="([^"]+)"[^>]*>)([\s\S]*?)(<\/\2>)/g, (m, open, tag, isHtml, k, inner, close) =>
    D[k] == null ? m : open + (isHtml ? D[k] : esc(D[k])) + close);
  land = land.replace(/(<[^>]*\bdata-i18n-ph="([^"]+)"[^>]*>)/g, (m, el, k) => D[k] == null ? m : el.replace(/placeholder="[^"]*"/, 'placeholder="' + attr(D[k]) + '"'));
  // Liens vers les pages services / villes : version de la langue
  for (const p of PAGES) land = land.split('href="' + pagePath(p, 'fr') + '"').join('href="' + pagePath(p, l) + '"');
  h = h.slice(0, a) + land + h.slice(b);
  const rep = (from, to) => { if (!h.includes(from)) throw new Error('page ' + l + ' : introuvable « ' + from.slice(0, 60) + ' »'); h = h.replace(from, to); };
  rep('<html lang="fr">', '<html lang="' + l + '">');
  rep('<title>' + F['seo.title'] + '</title>', '<title>' + esc(tr('seo.title')) + '</title>');
  rep('<meta name="description" content="' + F['seo.desc'] + '">', '<meta name="description" content="' + attr(tr('seo.desc')) + '">');
  rep('<link rel="canonical" href="' + site.url + '">', '<link rel="canonical" href="' + url + '">');
  rep('<meta property="og:locale" content="fr_BE">', '<meta property="og:locale" content="' + LOC[l] + '">');
  rep('<meta property="og:url" content="' + site.url + '">', '<meta property="og:url" content="' + url + '">');
  rep('<meta property="og:title" content="' + F['seo.title'] + '">', '<meta property="og:title" content="' + attr(tr('seo.title')) + '">');
  rep('<meta property="og:description" content="' + F['seo.og_desc'] + '">', '<meta property="og:description" content="' + attr(tr('seo.og_desc')) + '">');
  rep('<meta property="og:image:alt" content="' + F['seo.og_alt'] + '">', '<meta property="og:image:alt" content="' + attr(tr('seo.og_alt')) + '">');
  // Données structurées : service et FAQ dans la langue de la page
  h = h.replace(/<script type="application\/ld\+json">(.*?)<\/script>/g, (m, js) => {
    const d = JSON.parse(js);
    if (d['@type'] === 'TaxiService') { d.name = tr('seo.svc_name'); d.serviceType = tr('seo.svc_type'); d.description = tr('seo.og_desc'); d.url = url; }
    if (d['@type'] === 'FAQPage') {
      d['@id'] = url + '#faq'; d.inLanguage = l;
      d.mainEntity = d.mainEntity.map((q, i) => ({ ...q, name: tr('ld.faq_q' + (i + 1)), acceptedAnswer: { ...q.acceptedAnswer, text: tr('ld.faq_a' + (i + 1)) } }));
    }
    return '<script type="application/ld+json">' + JSON.stringify(d) + '</script>';
  });
  fs.mkdirSync(path.join(out, l), { recursive: true });
  fs.writeFileSync(path.join(out, l, 'index.html'), h);
}
for (const f of ['404.html', 'sitemap.xml', 'manifest.webmanifest', '_headers']) page(f);

// ── Pages de référencement (services et villes) : seo/pages.mjs + seo/render.mjs → /<slug>/, /en/<slug>/, /es/<slug>/ ──
site.ver = ver;
fs.copyFileSync(path.join(root, 'seo', 'seo.css'), path.join(out, 'seo.css'));
let smx = '';
for (const p of PAGES) {
  const alts = LANGS.map((x) => `<xhtml:link rel="alternate" hreflang="${x}" href="${site.url.replace(/\/$/, '') + pagePath(p, x)}"/>`).join('')
    + `<xhtml:link rel="alternate" hreflang="x-default" href="${site.url.replace(/\/$/, '') + pagePath(p, 'fr')}"/>`;
  for (const l of LANGS) {
    const dst = path.join(out, pagePath(p, l), 'index.html');
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.writeFileSync(dst, render(p, l, site));
    smx += `  <url><loc>${site.url.replace(/\/$/, '') + pagePath(p, l)}</loc>${alts}<changefreq>monthly</changefreq><priority>0.8</priority></url>\n`;
  }
}
{ const f = path.join(out, 'sitemap.xml'); fs.writeFileSync(f, fs.readFileSync(f, 'utf8').replace('</urlset>', smx + '</urlset>')); }
// robots.txt : tout autorisé en production, tout interdit en développement
if (isProd) page('robots.txt'); else fs.writeFileSync(path.join(out, 'robots.txt'), 'User-agent: *\nDisallow: /\n');
for (const f of fs.readdirSync(path.join(root, 'legal'))) page(path.join('legal', f));
for (const p of ['assets', 'i18n', 'logo.png', 'logo_text.png', 'logo_text_light.png', 'logo_text_dark.png', 'favicon.ico']) {
  if (fs.existsSync(path.join(root, p))) fs.cpSync(path.join(root, p), path.join(out, p), { recursive: true });
}
console.log('Site construit dans _site/ (version ' + ver + ', environnement ' + envName + ', branche ' + branch + ')');
