-- ════════════════════════════════════════════════════════════════
-- SÉCURITÉ — profils lisibles sans connexion (corrigé le 19/10/2026)
-- Avant : 2 règles SELECT "true" pour le rôle public → toute la table
-- profiles lisible avec la clé anon, sans être connecté.
-- Après : on ne voit que son propre profil, ceux des personnes avec qui
-- on a une course / une offre en commun, et l'admin voit tout.
-- Le script peut être relancé sans risque.
-- ════════════════════════════════════════════════════════════════

-- 1) Fonction d'autorisation (security definer : évite les boucles RLS)
create or replace function public.can_see_profile(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    auth.uid() is not null and (
      target = auth.uid()
      or (auth.jwt() ->> 'email') = 'kb@bleenr.com'
      -- client ↔ fleet d'une même course
      or exists (
        select 1 from rides r
        where (r.client_id = auth.uid() and r.driver_id = target)
           or (r.driver_id = auth.uid() and r.client_id = target)
      )
      -- client ↔ fleet ayant fait une offre sur sa course
      or exists (
        select 1 from offers o join rides r on r.id = o.ride_id
        where (r.client_id = auth.uid() and o.driver_id = target)
           or (o.driver_id = auth.uid() and r.client_id = target)
      )
    );
$$;

revoke all on function public.can_see_profile(uuid) from public, anon;
grant execute on function public.can_see_profile(uuid) to authenticated;

-- 2) Suppression des règles trop ouvertes
alter table public.profiles enable row level security;
drop policy if exists "read_profiles"                on public.profiles;
drop policy if exists "Users can view all profiles"  on public.profiles;
drop policy if exists "profiles_select"              on public.profiles;

-- 3) Nouvelle règle de lecture (connectés uniquement)
drop policy if exists profiles_select_scoped on public.profiles;
create policy profiles_select_scoped on public.profiles
  for select to authenticated
  using (public.can_see_profile(id));

-- 4) Plus aucun accès anonyme direct à la table
revoke all on public.profiles from anon;

-- ════════════════════════════════════════════════════════════════
-- push_tokens : la règle UPDATE "true" permettait de modifier
-- le jeton de n'importe qui (détournement des notifications push)
-- ════════════════════════════════════════════════════════════════
drop policy if exists push_tokens_own_update on public.push_tokens;
create policy push_tokens_own_update on public.push_tokens
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ════════════════════════════════════════════════════════════════
-- fleet_vehicles : lisible par tout le monde (plaques) → connectés seulement
-- ════════════════════════════════════════════════════════════════
drop policy if exists fleet_vehicles_select on public.fleet_vehicles;
create policy fleet_vehicles_select on public.fleet_vehicles
  for select to authenticated
  using (true);

-- Recharge le cache de l'API
notify pgrst, 'reload schema';

-- ── Vérification (doit renvoyer 0 ligne) ─────────────────────────
-- select tablename, policyname, roles, cmd from pg_policies
--  where schemaname = 'public' and cmd = 'SELECT' and qual = 'true'
--    and roles::text like '%public%';
