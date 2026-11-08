-- ════════════════════════════════════════════════════════════════
-- Coffre (vault) de la PRODUCTION : adresse du projet et clé publique « anon »
-- (utilisées par _edge_post, voir edge_calls.sql). À lancer UNIQUEMENT sur la production.
-- Pour la base de développement : env_secrets_dev.sql avec les valeurs du projet de dev.
-- ════════════════════════════════════════════════════════════════
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'project_url') then
    perform vault.create_secret('https://tuzfoqdxmxzjjhvlxsgb.supabase.co', 'project_url');
  end if;
  if not exists (select 1 from vault.secrets where name = 'anon_key') then
    perform vault.create_secret('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1emZvcWR4bXh6ampodmx4c2diIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0MzIyNDcsImV4cCI6MjA5MDAwODI0N30.xJU8CmI0KGiEl-YA87Rtv8yrrFkPU8_dAlUrY85DDzs', 'anon_key');
  end if;
end $$;
select name, left(decrypted_secret, 40) as valeur from vault.decrypted_secrets where name in ('project_url', 'anon_key');
