// Déploie les Edge Functions Supabase en une commande (Windows, Mac, Linux).
//   npm run deploy:functions                 → toutes les fonctions du dossier supabase/functions
//   npm run deploy:functions -- send-mail campaign   → seulement celles-ci
// Les fonctions qui vérifient elles-mêmes l'appelant (hook, webhook Stripe, campagnes) sont déployées sans contrôle JWT.
// Nécessite la CLI Supabase connectée au projet (supabase login + supabase link).
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const NO_JWT = new Set(['auth-email-hook', 'stripe-webhook', 'campaign']);
const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'supabase', 'functions');
const all = fs.readdirSync(dir).filter((n) => !n.startsWith('_') && fs.existsSync(path.join(dir, n, 'index.ts')));
const want = process.argv.slice(2);
const list = want.length ? want : all;
const unknown = list.filter((n) => !all.includes(n));
if (unknown.length) { console.error('Fonction inconnue : ' + unknown.join(', ') + '\nDisponibles : ' + all.join(', ')); process.exit(1); }

const failed = [];
for (const name of list) {
  const cmd = `supabase functions deploy ${name} --use-api${NO_JWT.has(name) ? ' --no-verify-jwt' : ''}`;
  console.log('\n▶ ' + cmd);
  try { execSync(cmd, { stdio: 'inherit' }); } catch { failed.push(name); }
}
console.log(failed.length ? '\n✗ Échec : ' + failed.join(', ') : '\n✓ ' + list.length + ' fonction(s) déployée(s)');
process.exit(failed.length ? 1 : 0);
