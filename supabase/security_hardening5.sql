-- ════════════════════════════════════════════════════════════════
-- Sécurité 5 : nettoyage des avertissements du Security Advisor
--   1. Fonctions de déclencheur (returns trigger) : plus appelables via
--      /rest/v1/rpc par anon / authenticated (les déclencheurs continuent
--      de fonctionner : PostgreSQL ne vérifie pas EXECUTE au déclenchement).
--   2. search_path figé sur toutes les fonctions du schéma public qui n'en
--      ont pas (évite le détournement de search_path).
-- Idempotent : peut être relancé sans risque.
-- ════════════════════════════════════════════════════════════════

do $$
declare
  f record;
  n_trg int := 0;
  n_sp  int := 0;
begin
  -- 1. Fonctions de déclencheur : réservées à la base
  for f in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace ns on ns.oid = p.pronamespace
    where ns.nspname = 'public'
      and p.prorettype = 'pg_catalog.trigger'::regtype
      and not exists (select 1 from pg_depend d
                      where d.objid = p.oid and d.deptype = 'e')
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f.sig);
    n_trg := n_trg + 1;
  end loop;

  -- 2. search_path figé là où il manque
  for f in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace ns on ns.oid = p.pronamespace
    where ns.nspname = 'public'
      and p.prokind in ('f', 'p')
      and not exists (select 1 from unnest(coalesce(p.proconfig, '{}'::text[])) c
                      where c like 'search_path=%')
      and not exists (select 1 from pg_depend d
                      where d.objid = p.oid and d.deptype = 'e')
  loop
    execute format('alter function %s set search_path = public, extensions, pg_temp', f.sig);
    n_sp := n_sp + 1;
  end loop;

  raise notice 'Déclencheurs verrouillés : %, search_path figés : %', n_trg, n_sp;
end $$;
