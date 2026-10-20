-- ════════════════════════════════════════════════════════════════
-- ACTIONS SERVEUR — étape 2 sur 2 : VERROUILLAGE
-- À exécuter UNIQUEMENT quand :
--   1. server_actions.sql a été exécuté,
--   2. le site est à jour (rechargé),
--   3. la nouvelle version de l'app iOS est installée sur les téléphones
--      (une ancienne version ne pourra plus rien enregistrer).
--
-- Effet : plus aucune écriture directe dans les tables depuis le site,
-- l'app ou une requête forgée avec la clé publique. Toute modification
-- passe par les fonctions serveur api_* (et les Edge Functions).
-- La lecture reste encadrée par les règles d'accès existantes.
-- Peut être relancé sans risque. Retour arrière : voir tout en bas.
-- ════════════════════════════════════════════════════════════════

do $$
declare t record;
begin
  for t in select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
            where n.nspname = 'public' and c.relkind in ('r','p') loop
    execute format('revoke insert, update, delete, truncate on public.%I from anon, authenticated', t.relname);
  end loop;
end $$;

-- Les futures tables seront fermées de la même façon
alter default privileges in schema public revoke insert, update, delete, truncate on tables from anon, authenticated;

notify pgrst, 'reload schema';

-- ── Vérification : doit renvoyer 0 ligne ─────────────────────────
select table_name, grantee, string_agg(privilege_type, ', ') as droits_restants
  from information_schema.role_table_grants
 where table_schema = 'public' and grantee in ('anon','authenticated')
   and privilege_type in ('INSERT','UPDATE','DELETE','TRUNCATE')
 group by table_name, grantee;

-- ── Retour arrière (en cas de problème urgent seulement) ─────────
-- do $$ declare t record; begin
--   for t in select tablename from pg_tables where schemaname = 'public' loop
--     execute format('grant insert, update, delete on public.%I to authenticated', t.tablename);
--   end loop; end $$;
