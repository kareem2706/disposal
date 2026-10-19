-- ════════════════════════════════════════════════════════════════
-- SÉCURITÉ — table rides (19/10/2026)
-- Avant : tout compte connecté lisait TOUTES les courses (notes,
-- passagers, téléphones) et pouvait modifier toute course en attente.
-- Après :
--   lecture  : le client ses courses, la fleet ses missions + celles où
--              elle a fait une offre + le marketplace (waiting / offers),
--              l'admin tout.
--   écriture : la règle "n'importe qui modifie une course en attente"
--              est supprimée ; le passage en « offers » est fait par un
--              trigger quand une offre est créée.
-- Le script peut être relancé sans risque.
-- ════════════════════════════════════════════════════════════════

-- 1) Est-ce une fleet ? (security definer : profiles est protégée par RLS)
create or replace function public.is_fleet()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'driver');
$$;
revoke all on function public.is_fleet() from public, anon;
grant execute on function public.is_fleet() to authenticated;

-- 2) La fleet a-t-elle une offre sur cette course ?
create or replace function public.has_offer_on_ride(p_ride uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from offers where ride_id = p_ride and driver_id = auth.uid());
$$;
revoke all on function public.has_offer_on_ride(uuid) from public, anon;
grant execute on function public.has_offer_on_ride(uuid) to authenticated;

-- 3) Lecture des courses
alter table public.rides enable row level security;
drop policy if exists rides_select on public.rides;
drop policy if exists rides_select_scoped on public.rides;
create policy rides_select_scoped on public.rides
  for select to authenticated
  using (
       client_id = auth.uid()
    or driver_id = auth.uid()
    or (auth.jwt() ->> 'email') = 'kb@bleenr.com'
    or (status in ('waiting','offers') and public.is_fleet())
    or public.has_offer_on_ride(id)
  );

-- 4) Suppression de la règle "toute course en attente est modifiable par tous"
drop policy if exists driver_update_ride_status on public.rides;

-- 5) Passage automatique en « offers » à la création d'une offre
create or replace function public.trg_offer_sets_ride_offers()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  update rides set status = 'offers'
   where id = new.ride_id and status = 'waiting';
  return new;
end $$;

drop trigger if exists trg_offers_ride_status on public.offers;
create trigger trg_offers_ride_status
  after insert on public.offers
  for each row execute function public.trg_offer_sets_ride_offers();

-- 6) Compteur pour les références BLxx-MMAA### (le client ne voit plus
--    toutes les courses, il ne peut donc plus les compter lui-même)
create or replace function public.rides_count_since(p_since timestamptz)
returns bigint
language sql stable security definer set search_path = public
as $$
  select count(*) from rides where created_at >= p_since;
$$;
revoke all on function public.rides_count_since(timestamptz) from public, anon;
grant execute on function public.rides_count_since(timestamptz) to authenticated;

-- 7) Plus aucun accès anonyme
revoke all on public.rides from anon;

notify pgrst, 'reload schema';
