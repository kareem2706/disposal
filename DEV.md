# Environnement de développement

| | Développement | Production |
|---|---|---|
| Branche Git | `dev` (ou toute autre branche) | `main` |
| Site | `dev.bleenr.com` + une adresse de prévisualisation par branche | `bleenr.com` |
| Base Supabase | projet **bleenr-dev** | projet actuel |
| Paiements | Stripe **mode test** | Stripe réel |
| App iOS | `npm run start:dev` (badge « DEV ») | `npx expo start` |

Le choix est automatique : `build.mjs` lit la branche (`main` → production, sinon développement) et prend
l'adresse et la clé publique Supabase dans `site.json › envs`. Un site de développement affiche un badge
« DEV » et n'est pas référencé (noindex, robots.txt fermé).

---

## 1. Préparer la production (une fois)

Dans le **SQL Editor du projet de production**, lancer dans l'ordre :

1. `supabase/edge_calls.sql` — la base n'a plus l'adresse des fonctions en dur : elle la lit dans le coffre.
2. `supabase/env_secrets_prod.sql` — enregistre l'adresse et la clé publique de la production dans le coffre.

Rien ne change pour les utilisateurs (mêmes e-mails, mêmes notifications).

## 2. Créer le projet de développement

1. [supabase.com](https://supabase.com) › **New project** › nom `bleenr-dev`, région **Europe (Frankfurt ou Paris)**, mot de passe de base à garder.
2. **Settings › API** : copier le **Project URL** et la clé **anon public** (jamais la clé `service_role`).
3. Les ajouter dans `site.json › envs.dev` (`supabase_url`, `supabase_anon_key`) — ou me les envoyer.

## 3. Copier la structure de la production vers le dev

Il faut **Docker Desktop** démarré (le CLI Supabase s'en sert pour `db dump`). Dans le dossier `disposal` :

```cmd
supabase link --project-ref tuzfoqdxmxzjjhvlxsgb
supabase db dump -f supabase\schema.sql
supabase db dump --data-only -f supabase\seed_config.sql --schema public --table public.billing_settings
```

- `schema.sql` : tables, règles de sécurité (RLS), fonctions, déclencheurs — **sans aucune donnée client**.
- `seed_config.sql` : uniquement les réglages de facturation (taux, délais).

Puis appliquer au projet de dev (remplacer `bvkdolyczdqjbwntrsxj` et le mot de passe) :

```cmd
supabase link --project-ref bvkdolyczdqjbwntrsxj
psql "postgresql://postgres:MOT_DE_PASSE@db.bvkdolyczdqjbwntrsxj.supabase.co:5432/postgres" -f supabase\schema.sql
psql "postgresql://postgres:MOT_DE_PASSE@db.bvkdolyczdqjbwntrsxj.supabase.co:5432/postgres" -f supabase\seed_config.sql
```

Sans `psql` : ouvrir les deux fichiers et les coller dans le SQL Editor du projet de dev.

Ensuite, toujours dans le SQL Editor **du dev** :

1. `supabase/env_secrets_dev.sql` après y avoir mis l'adresse et la clé du projet de dev → copier le
   `notify_hook_secret` affiché.
2. Les tâches planifiées : relancer la fin de `supabase/mission_changes.sql` (bloc `cron.schedule`),
   après avoir activé l'extension **pg_cron** (Database › Extensions).

## 4. Réglages du projet de dev (tableau de bord)

- **Storage** : créer le bucket privé `fleet-docs`.
- **Authentication › URL Configuration** : Site URL `https://dev.bleenr.com`, Redirect URLs
  `https://dev.bleenr.com/**` et `https://*.bleenr.pages.dev/**` (prévisualisations).
- **Authentication › Providers** : Google / Microsoft avec les mêmes identifiants (ajouter l'URL de rappel du dev chez Google / Microsoft).
- **Authentication › Hooks** : « Send Email » → fonction `auth-email-hook`.

## 5. Fonctions serveur du dev

```cmd
supabase functions deploy --project-ref bvkdolyczdqjbwntrsxj
supabase functions deploy auth-email-hook --no-verify-jwt --project-ref bvkdolyczdqjbwntrsxj
```

Secrets (Edge Functions › Secrets du **dev**) — valeurs de test :

| Secret | Valeur en dev |
|---|---|
| `APP_URL` | `https://dev.bleenr.com` |
| `NOTIFY_HOOK_SECRET` | valeur affichée à l'étape 3 |
| `SEND_EMAIL_HOOK_SECRET` | celle du hook « Send Email » du dev |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | clés **test** Stripe (`sk_test_…`, webhook vers le dev) |
| `RESEND_API_KEY`, `MAIL_FROM` | même clé ; expéditeur `Bleenr DEV <noreply@bleenr.com>` |
| `MAIL_REDIRECT_ALL` | ton adresse : **tous** les e-mails du dev t'arrivent (destinataire réel indiqué dans l'objet) |
| `ANTHROPIC_API_KEY`, `AERODATABOX_KEY` | mêmes clés (ou laisser vide pour désactiver) |

## 6. Hébergement (Cloudflare Pages)

1. [dash.cloudflare.com](https://dash.cloudflare.com) › Workers & Pages › **Create › Pages › Connect to Git** › dépôt `disposal`.
2. Build command `npm run build`, output `_site`, variable `NODE_VERSION = 20`. Branche de production : `main`.
3. **Custom domains** : `bleenr.com` (et `www`) pour la production ; `dev.bleenr.com` relié à la branche `dev`.
4. Google Cloud › clé Google Maps : ajouter `https://bleenr.com/*`, `https://dev.bleenr.com/*` et `https://*.pages.dev/*` aux sites autorisés.
5. Quand bleenr.com répond : mettre `envs.prod.url` à `https://bleenr.com/` dans `site.json`, le secret `APP_URL` de la production à `https://bleenr.com`, et ajouter l'adresse dans Authentication › URL Configuration de la production.

## Au quotidien

1. Les modifications sont faites sur la branche `dev` → publiées sur `dev.bleenr.com`.
2. Le SQL est d'abord lancé sur le projet **dev**, puis sur la production une fois validé.
3. Validation → fusion `dev` → `main` → mise en ligne sur bleenr.com.
4. App iOS : `npm run start:dev` pour tester sur la base de dev, `npx expo start` pour la production.
