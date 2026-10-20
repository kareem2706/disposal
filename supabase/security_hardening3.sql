-- ════════════════════════════════════════════════════════════════
-- SÉCURITÉ — audit du 20/10/2026 (3e partie). Peut être relancé sans risque.
-- À exécuter APRÈS security_hardening2.sql et mobile_live_updates.sql.
--  1. Déroulé d'une course : seule la fleet attribuée passe « En chemin »,
--     « Pick up », « No Show » ; le client ne peut clôturer qu'une course
--     dont l'heure est passée ; seule une demande du client peut être
--     annulée par lui (la fleet ne peut pas annuler une course payée)
--  2. Offres : le véhicule et le chauffeur choisis doivent appartenir à la
--     fleet qui fait l'offre
--  3. Véhicules (plaques) : visibles uniquement par leur fleet, l'admin et
--     le client d'une course où ce véhicule est proposé / attribué
-- ════════════════════════════════════════════════════════════════

-- ────────────────────────────────────────────────────────────────
-- 1. DÉROULÉ D'UNE COURSE
-- ────────────────────────────────────────────────────────────────
create or replace function public.trg_rides_workflow_guard()
returns trigger language plpgsql set search_path = public as $$
declare jn jsonb := to_jsonb(new); jo jsonb := to_jsonb(old); k text; v_start timestamp;
begin
  if not public._is_user_not_admin() or old.status = 'personal' then return new; end if;

  -- Étapes de la mission : réservées à la fleet attribuée
  foreach k in array array['on_way_at','pickup_at','no_show_at'] loop
    if (jn ->> k) is distinct from (jo ->> k) and new.driver_id is distinct from auth.uid() then
      raise exception 'Étape de mission réservée au chauffeur attribué' using errcode = '42501';
    end if;
  end loop;

  if new.status is distinct from old.status then
    -- En cours : uniquement la fleet attribuée
    if new.status = 'active' and new.driver_id is distinct from auth.uid() then
      raise exception 'Seul le chauffeur attribué démarre la course' using errcode = '42501';
    end if;
    -- Terminée : la fleet, ou le client une fois l'heure de la course passée
    if new.status = 'done' and new.driver_id is distinct from auth.uid() then
      begin
        v_start := ((jn ->> 'ride_date')::date + coalesce((jn ->> 'ride_time')::time, '00:00'::time));
      exception when others then v_start := null;
      end;
      if new.client_id is distinct from auth.uid() or v_start is null
         or v_start + interval '30 minutes' > (now() at time zone 'Europe/Brussels') then
        raise exception 'La course ne peut pas encore être clôturée' using errcode = '42501';
      end if;
    end if;
    -- Annulation : uniquement par le client (la fleet retire son offre, elle n'annule pas)
    if new.status = 'cancelled' and new.client_id is distinct from auth.uid() then
      raise exception 'Seul le client peut annuler sa course' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists a_rides_workflow_guard on public.rides;
create trigger a_rides_workflow_guard
  before update on public.rides
  for each row execute function public.trg_rides_workflow_guard();

-- ────────────────────────────────────────────────────────────────
-- 2. OFFRES : véhicule / chauffeur de la fleet elle-même
-- (s'applique aussi à la fonction fleet_update_assignment)
-- ────────────────────────────────────────────────────────────────
create or replace function public.trg_offers_owned_assets()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not public._is_user_not_admin() then return new; end if;
  if new.vehicle_id is not null
     and (tg_op = 'INSERT' or new.vehicle_id is distinct from old.vehicle_id)
     and not exists (select 1 from fleet_vehicles v where v.id = new.vehicle_id and v.fleet_id = new.driver_id) then
    raise exception 'Ce véhicule n''appartient pas à votre flotte' using errcode = '42501';
  end if;
  if new.fleet_driver_id is not null
     and (tg_op = 'INSERT' or new.fleet_driver_id is distinct from old.fleet_driver_id)
     and not exists (select 1 from fleet_drivers d where d.id = new.fleet_driver_id and d.fleet_id = new.driver_id) then
    raise exception 'Ce chauffeur n''appartient pas à votre flotte' using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists b_offers_owned_assets on public.offers;
create trigger b_offers_owned_assets
  before insert or update on public.offers
  for each row execute function public.trg_offers_owned_assets();

-- ────────────────────────────────────────────────────────────────
-- 3. VÉHICULES : lecture limitée
-- ────────────────────────────────────────────────────────────────
create or replace function public.can_see_vehicle(p_vehicle uuid, p_fleet uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and (
       p_fleet = auth.uid()
    or (auth.jwt() ->> 'email') = 'kb@bleenr.com'
    or exists (select 1 from offers o join rides r on r.id = o.ride_id
                where o.vehicle_id = p_vehicle
                  and (r.client_id = auth.uid() or r.driver_id = auth.uid()))
  );
$$;
revoke all on function public.can_see_vehicle(uuid, uuid) from public, anon;
grant execute on function public.can_see_vehicle(uuid, uuid) to authenticated;

drop policy if exists fleet_vehicles_select on public.fleet_vehicles;
create policy fleet_vehicles_select on public.fleet_vehicles
  for select to authenticated
  using (public.can_see_vehicle(id, fleet_id));

notify pgrst, 'reload schema';
