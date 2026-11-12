-- ════════════════════════════════════════════════════════════════
-- SOUS-TRAITANCE CIBLÉE (12/11/2026) — peut être relancé.
-- La flotte qui sous-traite choisit : tous les chauffeurs (comme avant) ou une sélection de chauffeurs.
--   • ride_targets : les flottes choisies pour une sous-traitance (aucune ligne = tout le monde)
--   • la sous-traitance n'est visible, notifiée et acceptable que par les flottes choisies
--   • api_fleet_directory : liste des flottes validées (nom, ville) pour la case à cocher
--   • api_subcontract_create : création + sélection en une seule transaction (personne d'autre n'est prévenu)
-- Prérequis : ride_rules.sql (fleet_can_serve, fleets_for_ride), luggage.sql (api_ride_create).
-- ════════════════════════════════════════════════════════════════

create table if not exists public.ride_targets (
  ride_id   uuid not null references public.rides(id) on delete cascade,
  driver_id uuid not null references auth.users(id) on delete cascade,
  primary key (ride_id, driver_id)
);
create index if not exists ride_targets_driver on public.ride_targets (driver_id);
alter table public.ride_targets enable row level security;
revoke all on public.ride_targets from anon, authenticated;
grant select on public.ride_targets to authenticated;
grant all on public.ride_targets to service_role;
-- Lecture : la flotte qui sous-traite (ses choix) et chaque flotte choisie (sa propre ligne)
drop policy if exists ride_targets_read on public.ride_targets;
create policy ride_targets_read on public.ride_targets for select to authenticated
  using (driver_id = auth.uid()
         or exists (select 1 from public.rides r where r.id = ride_id and r.client_id = auth.uid())
         or coalesce(auth.jwt() ->> 'email', '') = 'kb@bleenr.com');

-- La flotte connectée peut-elle voir / prendre cette sous-traitance ?
create or replace function public.ride_target_ok(p_ride uuid, p_uid uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select not exists (select 1 from ride_targets where ride_id = p_ride)
      or exists (select 1 from ride_targets where ride_id = p_ride and driver_id = p_uid);
$$;
revoke all on function public.ride_target_ok(uuid, uuid) from public, anon;
grant execute on function public.ride_target_ok(uuid, uuid) to authenticated;

-- Lecture des courses (ride_rules.sql) + sous-traitance réservée aux flottes choisies
drop policy if exists rides_select_scoped on public.rides;
create policy rides_select_scoped on public.rides
  for select to authenticated
  using (
       client_id = auth.uid()
    or driver_id = auth.uid()
    or (auth.jwt() ->> 'email') = 'kb@bleenr.com'
    or (status in ('waiting','offers') and public.is_fleet() and public.fleet_can_serve(vehicle_type, passengers)
        and (not coalesce(is_subcontract, false) or public.ride_target_ok(id)))
    or public.has_offer_on_ride(id)
  );

-- Acceptation (accept_subcontract ou toute autre écriture) : uniquement une flotte choisie
create or replace function public.trg_ride_target_check()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or coalesce(auth.jwt() ->> 'email', '') = 'kb@bleenr.com' then return new; end if;
  if coalesce(new.is_subcontract, false) and old.driver_id is null and new.driver_id = auth.uid()
     and not public.ride_target_ok(new.id, auth.uid()) then
    raise exception 'Cette sous-traitance est réservée à d''autres chauffeurs' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists rides_target_check on public.rides;
create trigger rides_target_check before update of driver_id on public.rides
  for each row execute function public.trg_ride_target_check();
revoke all on function public.trg_ride_target_check() from public, anon, authenticated;

-- Notifications (push et e-mails) : fleets qui peuvent assurer la course ET, pour une sous-traitance ciblée, choisies
create or replace function public.fleets_for_ride(p_ride uuid)
returns setof uuid language sql stable security definer set search_path = public as $$
  select distinct v.fleet_id from fleet_vehicles v, rides r
   where r.id = p_ride and coalesce(v.active, true) and coalesce(v.status, '') <> 'rejected'
     and (coalesce(r.vehicle_type, '') = '' or v.vehicle_class = any(coalesce(_class_vehicles(r.vehicle_type), array[r.vehicle_type])))
     and _veh_seats(v.seats, v.vehicle_class) >= greatest(coalesce(r.passengers, 1), 1)
     and public.ride_target_ok(p_ride, v.fleet_id);
$$;
revoke all on function public.fleets_for_ride(uuid) from public, anon, authenticated;
grant execute on function public.fleets_for_ride(uuid) to service_role;

-- Liste des autres flottes validées (pour la sélection) : nom et ville seulement
create or replace function public.api_fleet_directory()
returns table(id uuid, name text, city text)
language sql stable security definer set search_path = public as $$
  select p.id,
         coalesce(nullif(trim(p.company_name), ''), nullif(trim(concat_ws(' ', p.first_name, p.last_name)), ''), 'Chauffeur'),
         nullif(trim(p.address_city), '')
    from profiles p
   where public.is_validated_fleet()
     and p.role = 'driver' and p.fleet_verified = 'validated' and p.id <> auth.uid()
   order by 2;
$$;
revoke all on function public.api_fleet_directory() from public, anon;
grant execute on function public.api_fleet_directory() to authenticated;

-- Création d'une sous-traitance réservée à une sélection de flottes (même transaction : rien n'est visible avant)
create or replace function public.api_subcontract_create(p jsonb, p_targets uuid[])
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := _api_uid(); r jsonb; n int;
begin
  if coalesce((p ->> 'is_subcontract')::boolean, false) is not true then
    raise exception 'Réservé aux sous-traitances' using errcode = '22023';
  end if;
  select count(*) into n from profiles
   where id = any(coalesce(p_targets, '{}')) and id <> uid and role = 'driver' and fleet_verified = 'validated';
  if n = 0 then raise exception 'Choisissez au moins un chauffeur' using errcode = '22023'; end if;
  if n > 500 then raise exception 'Sélection trop grande' using errcode = '22023'; end if;
  r := public.api_ride_create(p);
  insert into ride_targets (ride_id, driver_id)
  select (r ->> 'id')::uuid, id from profiles
   where id = any(p_targets) and id <> uid and role = 'driver' and fleet_verified = 'validated'
  on conflict do nothing;
  return r || jsonb_build_object('targets', n);
end $$;
revoke all on function public.api_subcontract_create(jsonb, uuid[]) from public, anon;
grant execute on function public.api_subcontract_create(jsonb, uuid[]) to authenticated;

notify pgrst, 'reload schema';
