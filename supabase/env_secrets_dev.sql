-- ════════════════════════════════════════════════════════════════
-- Coffre (vault) de la base de DÉVELOPPEMENT — à lancer dans le projet « bleenr-dev » uniquement.
-- Clé : la clé « anon » LEGACY du projet de dev (Settings › API Keys › onglet « Legacy API Keys », commence par eyJ…).
-- La clé « sb_publishable_… » ne suffit pas ici : la passerelle des Edge Functions attend un jeton JWT.
-- ════════════════════════════════════════════════════════════════
do $$
begin
  delete from vault.secrets where name in ('project_url', 'anon_key');
  perform vault.create_secret('https://bvkdolyczdqjbwntrsxj.supabase.co', 'project_url');
  perform vault.create_secret('REMPLACER-PAR-LA-CLE-ANON-LEGACY-DEV (eyJ…)', 'anon_key');
  -- secret partagé avec les Edge Functions (NOTIFY_HOOK_SECRET) : propre à ce projet
  if not exists (select 1 from vault.secrets where name = 'notify_hook_secret') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(24), 'hex'), 'notify_hook_secret');
  end if;
end $$;
-- À copier dans Edge Functions › Secrets du projet de dev (nom : NOTIFY_HOOK_SECRET)
select decrypted_secret as notify_hook_secret from vault.decrypted_secrets where name = 'notify_hook_secret';
