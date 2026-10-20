-- ════════════════════════════════════════════════════════════════
-- CONTRÔLE DE SÉCURITÉ — LECTURE SEULE (ne modifie rien)
-- Liste les règles d'accès réellement en place dans la base, pour vérifier
-- celles qui ne sont pas dans les scripts du dépôt (offres, notifications,
-- factures, coordonnées bancaires, positions GPS, documents…).
-- Résultat : Supabase → SQL Editor → Run, puis « Export » → CSV.
-- ════════════════════════════════════════════════════════════════
with
no_rls as (
  select '1. TABLE SANS RLS' as section, c.relname::text as objet, '⚠ RLS désactivée' as detail
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
),
pols as (
  select '2. REGLE' as section,
         tablename || ' · ' || policyname as objet,
         cmd || ' | rôles=' || array_to_string(roles, ',') ||
         ' | using=' || coalesce(qual, '—') || ' | check=' || coalesce(with_check, '—') as detail
    from pg_policies where schemaname in ('public', 'storage')
),
anon_grants as (
  select '3. DROIT ANON' as section, table_name::text as objet, string_agg(privilege_type, ',') as detail
    from information_schema.role_table_grants
   where grantee = 'anon' and table_schema = 'public'
   group by table_name
),
definer as (
  select '4. FONCTION SECURITY DEFINER' as section,
         p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' as objet,
         case when has_function_privilege('anon', p.oid, 'execute') then '⚠ exécutable SANS connexion · '
              when has_function_privilege('authenticated', p.oid, 'execute') then 'exécutable par les connectés · '
              else 'serveur uniquement · ' end ||
         case when p.proname in ('apply_signup_role','fleet_update_assignment','invoice_number',
                                 'invoice_parties','update_driver_rating')
              then pg_get_functiondef(p.oid) else '' end as detail
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.prosecdef and p.prorettype <> 'trigger'::regtype
),
buckets as (
  select '5. STOCKAGE' as section, id::text as objet, case when public then '⚠ PUBLIC' else 'privé' end as detail
    from storage.buckets
)
select * from no_rls
union all select * from pols
union all select * from anon_grants
union all select * from definer
union all select * from buckets
order by 1, 2;
