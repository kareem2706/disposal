// Construit _redirect/ : l'ancienne adresse GitHub Pages (kareem2706.github.io/disposal/…) renvoie vers bleenr.com
// en gardant le chemin, les paramètres (?payment=…, ?code=…) et le #… (liens de connexion, #course).
import fs from 'node:fs';
const target = JSON.parse(fs.readFileSync('site.json', 'utf8')).envs.prod.url.replace(/\/+$/, '');
const page = `<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8">
<title>Bleenr — nouvelle adresse</title>
<meta name="robots" content="noindex">
<link rel="canonical" href="${target}/">
<script>
(function(){var p=location.pathname.replace(/^\\/disposal(\\/|$)/,'/');
location.replace(${JSON.stringify(target)}+p+location.search+location.hash);})();
</script>
<noscript><meta http-equiv="refresh" content="0;url=${target}/"></noscript>
</head><body style="font-family:sans-serif;padding:40px">
Bleenr a déménagé : <a href="${target}/">${target.replace('https://', '')}</a>
</body></html>
`;
fs.rmSync('_redirect', { recursive: true, force: true });
fs.mkdirSync('_redirect');
for (const f of ['index.html', '404.html']) fs.writeFileSync('_redirect/' + f, page);
fs.writeFileSync('_redirect/robots.txt', 'User-agent: *\nDisallow: /\n');
console.log('_redirect → ' + target);
