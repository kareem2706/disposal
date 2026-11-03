-- ════════════════════════════════════════════════════════════════
-- RÈGLES DES DEMANDES — 03/11/2026. Peut être relancé sans risque.
-- À exécuter APRÈS vehicle_class_filter.sql.
--
-- 1. Délai minimum : une demande (client ou sous-traitance d'une fleet) doit
--    commencer au moins 1 h après sa publication. Vérifié à la création et à
--    chaque changement de date / heure (chaque trajet d'un trajet mixte inclus).
-- 2. Gamme « Peu importe » (vehicle_type = 'any') : la demande est visible par
--    toutes les fleets qui ont un véhicule assez grand.
-- 3. Places assises : une fleet ne voit une demande (et ne peut proposer un
--    véhicule) que si le véhicule a au moins autant de places que de passagers.
--    Ex. 5 passagers en Economy → uniquement les Economy de 7 places.
-- 4. Gamme cohérente avec le nombre de passagers :
--      1 à 3  → toutes les gammes
--      4 à 7  → Peu importe, Economy, Van (Bus accepté, ex. événement)
--      8 et + → Bus uniquement
-- ════════════════════════════════════════════════════════════════

-- ── Gammes ───────────────────────────────────────────────────────
create or replace function public._class_vehicles(p_class text)
returns text[] language sql immutable as $$
  select case p_class
    when 'any'      then array['lowcost','business','van','luxe','bus']
    when 'lowcost'  then array['lowcost','business','van','luxe']
    when 'business' then array['business','van','luxe']
    when 'van'      then array['van']
    when 'luxe'     then array['luxe']
    when 'bus'      then array['bus']
    else null end;
$$;

-- Places d'un véhicule (valeur par défaut selon la gamme si non renseignée)
create or replace function public._veh_seats(p_seats int, p_class text)
returns int language sql immutable as $$
  select coalesce(p_seats, case p_class when 'van' then 7 when 'bus' then 50 else 3 end);
$$;

-- La fleet connectée a-t-elle un véhicule de la gamme ET assez de places ?
create or replace function public.fleet_can_serve(p_class text, p_pax int)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from fleet_vehicles v
     where v.fleet_id = auth.uid() and coalesce(v.active, true) and coalesce(v.status, '') <> 'rejected'
       and (coalesce(p_class, '') = '' or v.vehicle_class = any(coalesce(_class_vehicles(p_class), array[p_class])))
       and _veh_seats(v.seats, v.vehicle_class) >= greatest(coalesce(p_pax, 1), 1));
$$;
revoke all on function public.fleet_can_serve(text, int) from public, anon;
grant execute on function public.fleet_can_serve(text, int) to authenticated;

create or replace function public.fleet_can_serve(p_class text)
returns boolean language sql stable security definer set search_path = public as $$
  select public.fleet_can_serve(p_class, 1);
$$;

-- Lecture des courses : gamme + places
drop policy if exists rides_select_scoped on public.rides;
create policy rides_select_scoped on public.rides
  for select to authenticated
  using (
       client_id = auth.uid()
    or driver_id = auth.uid()
    or (auth.jwt() ->> 'email') = 'kb@bleenr.com'
    or (status in ('waiting','offers') and public.is_fleet() and public.fleet_can_serve(vehicle_type, passengers))
    or public.has_offer_on_ride(id)
  );

-- Offre / attribution : véhicule de la bonne gamme et assez de places
create or replace function public.trg_offers_vehicle_class()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_req text; v_pax int; v_cls text; v_seats int;
begin
  if not public._is_user_not_admin() or new.vehicle_id is null
     or (tg_op = 'UPDATE' and new.vehicle_id is not distinct from old.vehicle_id) then
    return new;
  end if;
  select vehicle_type, passengers into v_req, v_pax from rides where id = new.ride_id;
  select vehicle_class, seats into v_cls, v_seats from fleet_vehicles where id = new.vehicle_id;
  if coalesce(v_req, '') <> '' and not (v_cls = any(coalesce(_class_vehicles(v_req), array[v_req]))) then
    raise exception 'Ce véhicule n''est pas de la gamme demandée' using errcode = '42501';
  end if;
  if _veh_seats(v_seats, v_cls) < greatest(coalesce(v_pax, 1), 1) then
    raise exception 'Ce véhicule n''a pas assez de places pour % passagers', v_pax using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists b_offers_vehicle_class on public.offers;
create trigger b_offers_vehicle_class before insert or update on public.offers
  for each row execute function public.trg_offers_vehicle_class();

create or replace function public.api_offer_submit(p_ride uuid, p_price numeric, p_message text, p_vehicle uuid, p_km jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := _api_uid(); o offers%rowtype; d jsonb; v_req text; v_pax int;
begin
  if p_price is null or p_price <= 0 or p_price > 100000 then raise exception 'Prix invalide' using errcode = '22023'; end if;
  if p_vehicle is not null and not exists (select 1 from fleet_vehicles where id = p_vehicle and fleet_id = uid) then
    raise exception 'Ce véhicule n''appartient pas à votre flotte' using errcode = '42501';
  end if;
  select vehicle_type, passengers into v_req, v_pax from rides where id = p_ride;
  if exists (select 1 from rides where id = p_ride and coalesce(is_subcontract, false)) then
    raise exception 'Une sous-traitance s''accepte au prix fixé, sans offre' using errcode = '42501';
  end if;
  if not fleet_can_serve(v_req, v_pax) then
    raise exception 'Votre flotte n''a pas de véhicule de la gamme demandée avec assez de places' using errcode = '42501';
  end if;
  d := _api_cols('public.offers', jsonb_build_object('price', round(p_price, 2), 'message', _api_txt(p_message, 1000),
                                                     'vehicle_id', p_vehicle, 'included_km', p_km),
                 array['price','message','vehicle_id','included_km']);
  select * into o from offers where ride_id = p_ride and driver_id = uid for update;
  if found then
    if o.status <> 'pending' then raise exception 'Offre déjà traitée' using errcode = '42501'; end if;
    return _api_update('public.offers', o.id::text, d);
  end if;
  return _api_insert('public.offers', d || jsonb_build_object('ride_id', p_ride, 'driver_id', uid, 'status', 'pending'));
end $$;
revoke all on function public.api_offer_submit(uuid, numeric, text, uuid, jsonb) from public, anon;
grant execute on function public.api_offer_submit(uuid, numeric, text, uuid, jsonb) to authenticated;

create or replace function public.accept_subcontract(p_ride uuid)
returns boolean
language plpgsql security definer set search_path = public
as $$
begin
  if not is_validated_fleet() then
    raise exception 'Votre flotte doit être validée par Bleenr' using errcode = '42501';
  end if;
  if not fleet_can_serve((select vehicle_type from rides where id = p_ride), (select passengers from rides where id = p_ride)) then
    raise exception 'Votre flotte n''a pas de véhicule de la gamme demandée avec assez de places' using errcode = '42501';
  end if;
  update rides set status = 'confirmed', driver_id = auth.uid()
   where id = p_ride
     and is_subcontract = true
     and status in ('waiting','offers')
     and client_id <> auth.uid();
  if not found then return false; end if;
  insert into offers (ride_id, driver_id, price, status)
  select p_ride, auth.uid(), (select final_price from rides where id = p_ride), 'accepted'
   where not exists (select 1 from offers where ride_id = p_ride and status = 'accepted');
  return true;
end $$;
revoke all on function public.accept_subcontract(uuid) from public, anon;
grant execute on function public.accept_subcontract(uuid) to authenticated;

-- Notifications push / e-mails (Edge Functions) : fleets pouvant assurer une demande (gamme + places)
create or replace function public.fleets_for_ride(p_ride uuid)
returns setof uuid language sql stable security definer set search_path = public as $$
  select distinct v.fleet_id from fleet_vehicles v, rides r
   where r.id = p_ride and coalesce(v.active, true) and coalesce(v.status, '') <> 'rejected'
     and (coalesce(r.vehicle_type, '') = '' or v.vehicle_class = any(coalesce(_class_vehicles(r.vehicle_type), array[r.vehicle_type])))
     and _veh_seats(v.seats, v.vehicle_class) >= greatest(coalesce(r.passengers, 1), 1);
$$;
revoke all on function public.fleets_for_ride(uuid) from public, anon, authenticated;
grant execute on function public.fleets_for_ride(uuid) to service_role;

-- ── Contrôles à la création / modification d'une demande ─────────
-- Début d'un trajet (heure de Bruxelles)
create or replace function public._ride_start(p_date date, p_time text)
returns timestamptz language sql immutable as $$
  select (p_date + coalesce(nullif(substring(coalesce(p_time, '') from '^\d{1,2}:\d{2}'), '')::time, '00:00'::time))
         at time zone 'Europe/Brussels';
$$;

-- Date + heure de chaque trajet d'un trajet mixte (« A>B@HH:MM:…|d:AAAA-MM-JJ »)
create or replace function public._mixed_starts(p_notes text)
returns setof timestamptz language sql immutable as $$
  select _ride_start(substring(s from '\|d:(\d{4}-\d{2}-\d{2})')::date, substring(s from '^(?:A>B|Disposition)@(\d{1,2}:\d{2})'))
    from regexp_split_to_table(regexp_replace(coalesce(p_notes, ''), '^Mixte:\s*', ''), '\s*\|\s*(?=A>B|Disposition)') s
   where s ~ '^(A>B|Disposition)@\d{1,2}:\d{2}' and s ~ '\|d:\d{4}-\d{2}-\d{2}';
$$;

create or replace function public.trg_rides_rules()
returns trigger language plpgsql set search_path = public as $$
declare v_min timestamptz := now() + interval '1 hour' - interval '2 minutes';   -- 2 min de marge (saisie)
        v_pax int; v_cls text;
begin
  if not public._is_user_not_admin() or new.status not in ('waiting','offers') then return new; end if;

  -- 1. Délai minimum (création, ou date / heure modifiée)
  if (tg_op = 'INSERT' or new.ride_date is distinct from old.ride_date or new.ride_time is distinct from old.ride_time)
     and new.ride_date is not null and coalesce(new.trip_type, '') <> 'mixed'
     and _ride_start(new.ride_date, new.ride_time) < v_min then
    raise exception 'La demande doit commencer au moins 1 heure après sa publication.' using errcode = '22023';
  end if;
  if new.trip_type = 'mixed' and (tg_op = 'INSERT' or new.notes is distinct from old.notes) then
    -- seuls les trajets nouveaux ou dont la date / l'heure a changé sont contrôlés
    if exists (select 1 from _mixed_starts(new.notes) t
                where t < v_min
                  and (tg_op = 'INSERT' or t not in (select * from _mixed_starts(old.notes)))) then
      raise exception 'Chaque trajet doit commencer au moins 1 heure après la publication de la demande.' using errcode = '22023';
    end if;
  end if;

  -- 2. Gamme cohérente avec le nombre de passagers
  if tg_op = 'INSERT' or new.passengers is distinct from old.passengers or new.vehicle_type is distinct from old.vehicle_type then
    v_pax := coalesce(new.passengers, 1); v_cls := coalesce(new.vehicle_type, '');
    if v_cls <> '' and v_cls not in ('any','lowcost','business','van','luxe','bus') then
      raise exception 'Gamme de véhicule invalide' using errcode = '22023';
    end if;
    if v_pax between 4 and 7 and v_cls in ('business','luxe') then
      raise exception 'Pour % passagers, choisissez Peu importe, Economy ou Van.', v_pax using errcode = '22023';
    end if;
    if v_pax >= 8 and v_cls <> 'bus' then
      raise exception 'Pour 8 passagers ou plus, choisissez un Bus.' using errcode = '22023';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists b_rides_rules on public.rides;
create trigger b_rides_rules before insert or update on public.rides
  for each row execute function public.trg_rides_rules();

notify pgrst, 'reload schema';
