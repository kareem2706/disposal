# Bleenr — site web

Plateforme de réservation de chauffeurs privés (clients, fleets / chauffeurs, admin).

## Structure

```
index.html        Structure HTML des écrans (landing, connexion, application, fenêtres)
css/              Styles, assemblés dans l'ordre des noms de fichiers
  01-base.css         variables, écrans, connexion
  02-app.css          barre latérale, pages, cartes, boutons, formulaires, fenêtres
  03-responsive.css   adaptations mobile
  04-landing.css      page d'accueil
  05-components.css   thème et composants (fiches, calendrier, pastilles…)
js/landing/       Page d'accueil → landing.js (toujours chargé, avec le core) : démarrage (_loadApp, _onReady),
                  configuration, traductions, adresses Google, animations et démo de la landing
js/               Code de l'application → app.js : chargé tout de suite si une session existe (ou démo,
                  retour de paiement / connexion), sinon à la demande (« Se connecter », « Créer un compte »…)
  01-payment-return.js … 25-invoices-passengers.js   (un fichier par domaine : connexion, courses,
                                        offres, missions, documents, calendrier, fleet…)
  admin/          Administration → admin.js, chargé seulement quand un admin ouvre une page d'admin
                  (fonction _withAdmin dans 09-navigation-pages.js)
core/             Logique partagée avec l'app iOS (TypeScript) : trajets mixtes, notes, bagages, gammes, dates
                  + tests (core.test.ts). Exposée sur le site en global « BleenrCore ».
i18n/             Traductions (fr = référence, en, es)
legal/            Mentions légales, conditions générales, politique de confidentialité
site.json         Coordonnées de la société et adresse du site : reportées partout via {{…}} à la construction
404.html, robots.txt, sitemap.xml, manifest.webmanifest, favicon.ico, assets/icons/, assets/og-image.jpg
assets/           Images
supabase/         Base de données (SQL) et fonctions serveur (Edge Functions) — non publié sur le site
build.mjs         Construction du site dans _site/
worker.js         Worker Cloudflare : sert _site/ et reçoit le retour de la connexion Google (/auth/google)
```

Les fichiers de `js/` forment **un seul script** une fois assemblés (`app.js`) : l'ordre des fichiers
compte et les fonctions restent globales (elles sont appelées depuis les `onclick` du HTML).
Le code de `js/admin/` ne doit être appelé que depuis les pages d'admin, ou via `_withAdmin(function(){ … })`.
Remarque : `admin.js` reste un fichier public (site statique) ; la sécurité de l'admin repose sur le serveur
(RLS et fonctions `api_*` qui vérifient le rôle), pas sur le fait de cacher ce fichier.

## Construire / tester en local

```
npm install             # une seule fois (esbuild, typescript)
npm test                # tests du core
npm run build           # crée _site/ (app.css, app.js, index.html, assets, i18n)
cd _site && python3 -m http.server 8000   # puis http://localhost:8000
```

## Environnements

Production (branche `main`) et développement (autres branches) : voir **DEV.md**.
Adresse et clé publique Supabase de chaque environnement : `site.json › envs`.

## Mise en ligne

Le site est hébergé par **Cloudflare** (Worker « bleenr », `wrangler.jsonc`) sur **https://www.bleenr.com**.
Chaque envoi sur `main` lance la construction Cloudflare : `npm test && npm run build` (si un test échoue,
rien n'est publié), puis `npx wrangler deploy` publie `_site/`.
L'ancienne adresse GitHub Pages (`kareem2706.github.io/disposal`) ne fait plus que rediriger vers bleenr.com
(`.github/workflows/static.yml` + `scripts/gh-redirect.mjs`), en gardant le chemin, les paramètres et le `#…`.
Les `?v=__V__` de `index.html` sont remplacés par la version (commit) : plus besoin de les augmenter à la main.

## Core partagé avec l'app iOS

`core/` est la seule source de vérité. Après une modification : `npm test` ici, puis dans le dépôt
`bleenr-chauffeur` : `node scripts/sync-core.mjs` (recopie dans `src/core/`).

## Sécurité

Aucune clé secrète dans le site : seule la clé publique Supabase (anon) y figure.
Toutes les écritures passent par des fonctions serveur (`api_*` en base, ou Edge Functions).
