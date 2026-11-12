// Gabarit des pages de référencement (services et villes) — appelé par build.mjs.
// Page légère : HTML + seo.css, sans le code de l'application (rapide à charger, lisible par Google sans JavaScript).
import { COMMON, PAGES } from './pages.mjs';

const esc = (v) => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const strip = (v) => String(v).replace(/<[^>]+>/g, '');
export const LANGS = ['fr', 'en', 'es'];
export const pagePath = (p, l) => (l === 'fr' ? '/' : '/' + l + '/') + p.slug[l] + '/';

// Lien du bouton « Recevoir des offres » : page d'accueil de la langue, formulaire prérempli
const bookHref = (p, l) => {
  const q = new URLSearchParams();
  if (p.prefill.from) q.set('from', p.prefill.from);
  if (p.prefill.to) q.set('to', p.prefill.to);
  if (p.prefill.mode) q.set('mode', p.prefill.mode);
  const s = q.toString();
  return COMMON[l].home + (s ? '?' + s : '') + '#ld-hero';
};

export function render(p, l, site) {
  const C = COMMON[l], T = p[l], base = site.url.replace(/\/$/, ''), url = base + pagePath(p, l), co = site.company;
  const alt = LANGS.map((x) => `<link rel="alternate" hreflang="${x}" href="${base + pagePath(p, x)}">`).join('\n')
    + `\n<link rel="alternate" hreflang="x-default" href="${base + pagePath(p, 'fr')}">`;
  const ld = [
    { '@context': 'https://schema.org', '@type': 'TaxiService', name: strip(T.h1), description: T.desc, url, serviceType: T.short,
      provider: { '@type': 'Organization', '@id': site.url + '#org', name: co.name, url: site.url },
      areaServed: { '@type': 'Country', name: l === 'fr' ? 'Belgique' : l === 'es' ? 'Bélgica' : 'Belgium' } },
    { '@context': 'https://schema.org', '@type': 'FAQPage', inLanguage: l, mainEntity: T.faq.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) },
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: C.crumb, item: base + C.home },
      { '@type': 'ListItem', position: 2, name: T.short, item: url }] }
  ].map((x) => '<script type="application/ld+json">' + JSON.stringify(x) + '</script>').join('\n');
  const book = bookHref(p, l);
  const langs = LANGS.map((x) => `<a href="${pagePath(p, x)}" hreflang="${x}"${x === l ? ' class="on" aria-current="page"' : ''}>${x.toUpperCase()}</a>`).join('');
  const more = PAGES.filter((o) => o.id !== p.id).map((o) => `<a href="${pagePath(o, l)}">${esc(o[l].short)}<span>&rarr;</span></a>`).join('');
  const legalHref = ['legal/mentions-legales.html', 'legal/conditions.html', 'legal/confidentialite.html'];
  return `<!DOCTYPE html>
<html lang="${l}">
<head>
<meta charset="UTF-8">
${site.env_head}
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(T.title)}</title>
<meta name="description" content="${esc(T.desc)}">
<link rel="canonical" href="${url}">
${alt}
<meta name="theme-color" content="#0E1410">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Bleenr">
<meta property="og:locale" content="${C.locale}">
<meta property="og:url" content="${url}">
<meta property="og:title" content="${esc(T.title)}">
<meta property="og:description" content="${esc(T.desc)}">
<meta property="og:image" content="${site.url}assets/og-image.jpg">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" type="image/png" sizes="32x32" href="/assets/icons/favicon-32.png">
<link rel="apple-touch-icon" href="/assets/icons/apple-touch-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;1,400&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&display=swap" rel="stylesheet">
<link rel="preload" as="image" href="/assets/landing/${p.img}">
<link rel="stylesheet" href="/seo.css?v=${site.ver}">
${ld}
</head>
<body>${site.env_badge}
<header class="sx-nav"><div class="sx-w">
  <a class="sx-logo" href="${C.home}"><img src="/logo_text_light.png" alt="Bleenr" width="120" height="30"></a>
  <nav class="sx-nr"><div class="sx-lang" aria-label="${esc(C.lang_label)}">${langs}</div><a class="sx-btn lime sm" href="${book}">${esc(C.nav_book)}</a></nav>
</div></header>

<section class="sx-hero" style="--img:url('/assets/landing/${p.img}')">
  <div class="sx-w">
    <nav class="sx-crumb" aria-label="breadcrumb"><a href="${C.home}">${esc(C.crumb)}</a><span>/</span><span>${esc(T.short)}</span></nav>
    <p class="sx-eye">${esc(T.eye)}</p>
    <h1>${esc(T.h1)}</h1>
    <p class="sx-lead">${esc(T.lead)}</p>
    <div class="sx-cta"><a class="sx-btn lime" href="${book}">${esc(C.book)} &rarr;</a><a class="sx-btn ghost" href="#how">${esc(C.how)}</a></div>
  </div>
</section>

<main>
  <section class="sx-sec"><div class="sx-w sx-cols">
${T.sections.map(([h, ps]) => `    <article><h2>${esc(h)}</h2>${ps.map((x) => `<p>${esc(x)}</p>`).join('')}</article>`).join('\n')}
  </div></section>

  <section class="sx-sec sx-how" id="how"><div class="sx-w">
    <h2 class="sx-h">${C.how_t}</h2>
    <ol class="sx-steps">${C.steps.map(([h, x], i) => `<li><span>${i + 1}</span><h3>${esc(h)}</h3><p>${esc(x)}</p></li>`).join('')}</ol>
    <a class="sx-btn dark" href="${book}">${esc(C.book)} &rarr;</a>
  </div></section>

  <section class="sx-sec"><div class="sx-w">
    <h2 class="sx-h">${C.why_t}</h2>
    <div class="sx-why">${C.why.map(([h, x]) => `<div><h3>${esc(h)}</h3><p>${esc(x)}</p></div>`).join('')}</div>
  </div></section>

  <section class="sx-sec sx-faq"><div class="sx-w sx-faq-g">
    <h2 class="sx-h">${C.faq_t}</h2>
    <div>${T.faq.map(([q, a], i) => `<details${i === 0 ? ' open' : ''}><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('')}</div>
  </div></section>

  <section class="sx-sec"><div class="sx-w">
    <h2 class="sx-h sm">${esc(C.more_t)}</h2>
    <div class="sx-more">${more}</div>
  </div></section>

  <section class="sx-final"><div class="sx-w">
    <h2>${C.final_t}</h2><p>${esc(C.final_p)}</p>
    <a class="sx-btn lime" href="${book}">${esc(C.book)} &rarr;</a>
  </div></section>
</main>

<footer class="sx-foot"><div class="sx-w">
  <div class="sx-fg"><div><img src="/logo_text_light.png" alt="Bleenr" width="104" height="26"><p>${esc(C.tagline)}</p></div>
  <div class="sx-fl">${legalHref.map((h, i) => `<a href="/${h}">${esc(C.legal[i])}</a>`).join('')}<a href="mailto:${esc(co.email)}">${esc(co.email)}</a></div></div>
  <div class="sx-fb">&copy; ${site.year} ${esc(co.name)} &mdash; ${l === 'en' ? 'VAT' : l === 'es' ? 'IVA' : 'TVA'} ${esc(co.vat)} &middot; ${esc(co.street)}, ${esc(co.postal)} ${esc(co.city)}</div>
</div></footer>
</body>
</html>
`;
}
export { PAGES };
