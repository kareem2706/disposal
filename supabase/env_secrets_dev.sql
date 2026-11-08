-- ════════════════════════════════════════════════════════════════
-- Coffre (vault) de la base de DÉVELOPPEMENT — à lancer dans le projet « bleenr-dev » uniquement.
-- Remplacer les deux valeurs par celles du projet de dev (Settings › API).
-- ════════════════════════════════════════════════════════════════
do $$
begin
  delete from vault.secrets where name in ('project_url', 'anon_key');
  perform vault.create_secret('https://REMPLACER-PAR-LE-REF-DEV.supabase.co', 'project_url');
  perform vault.create_secret('REMPLACER-PAR-LA-CLE-ANON-DEV', 'anon_key');
  -- secret partagé avec les Edge Functions (NOTIFY_HOOK_SECRET) : propre à ce projet
  if not exists (select 1 from vault.secrets where name = 'notify_hook_secret') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(24), 'hex'), 'notify_hook_secret');
  end if;
end $$;
-- À copier dans Edge Functions › Secrets du projet de dev (nom : NOTIFY_HOOK_SECRET)
select decrypted_secret as notify_hook_secret from vault.decrypted_secrets where name = 'notify_hook_secret';
