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
js/               Code de l'application, assemblé dans l'ordre des noms de fichiers
  01-payment-return.js … 25-admin.js   (un fichier par domaine : connexion, courses,
                                        offres, missions, documents, calendrier, fleet, admin…)
i18n/             Traductions (fr = référence, en, es)
assets/           Images
supabase/         Base de données (SQL) et fonctions serveur (Edge Functions) — non publié sur le site
build.mjs         Construction du site dans _site/
```

Les fichiers de `js/` forment **un seul script** une fois assemblés (`app.js`) : l'ordre des fichiers
compte et les fonctions restent globales (elles sont appelées depuis les `onclick` du HTML).

## Construire / tester en local

```
node build.mjs          # crée _site/ (app.css, app.js, index.html, assets, i18n)
cd _site && python3 -m http.server 8000   # puis http://localhost:8000
```

## Mise en ligne

Chaque envoi sur `main` lance GitHub Actions (`.github/workflows/static.yml`) :
`node build.mjs` puis publication de `_site/` sur GitHub Pages.
Les `?v=__V__` de `index.html` sont remplacés par la version (commit) : plus besoin de les augmenter à la main.

## Sécurité

Aucune clé secrète dans le site : seule la clé publique Supabase (anon) y figure.
Toutes les écritures passent par des fonctions serveur (`api_*` en base, ou Edge Functions).
