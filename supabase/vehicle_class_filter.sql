-- ════════════════════════════════════════════════════════════════
-- GAMME DE VÉHICULE — 20/10/2026. Peut être relancé sans risque.
-- À exécuter APRÈS server_actions.sql.
--
-- Une demande n'est visible (site, app iOS, notifications) que par les
-- fleets qui ont au moins un véhicule de la gamme demandée ou supérieure :
--   Economy  → tous les véhicules (Economy, Business, Van, Luxe)
--   Business → Business, Van, Luxe
--   Van      → Van
--   Luxe     → Luxe
-- Seuls ces véhicules peuvent être proposés dans l'offre ou attribués.
-- Véhicules pris en compte : actifs et non refusés.
-- ════════════════════════════════════════════════════════════════

-- Classes de véhicule acceptées pour une gamme demandée (null = toutes)
create or replace function public._class_vehicles(p_class text)
returns text[] language sql immutable as $$
  select case p_class
    when 'lowcost'  then array['lowcost','business','van','luxe']
    when 'business' then array['business','van','luxe']
    when 'van'      then array['van']
    when 'luxe'     then array['luxe']
    else null end;
$$;

-- La fleet connectée peut-elle assurer cette gamme ?
create or replace function public.fleet_can_serve(p_class text)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(nullif(p_class, ''), '') = '' and exists (
           select 1 from fleet_vehicles v where v.fleet_id = auth.uid() and coalesce(v.active, true) and coalesce(v.status, '') <> 'rejected')
      or exists (
           select 1 from fleet_vehicles v
            where v.fleet_id = auth.uid() and coalesce(v.active, true) and coalesce(v.status, '') <> 'rejected'
              and v.vehicle_class = any(coalesce(_class_vehicles(p_class), array[p_class])));
$$;
revoke all on function public.fleet_can_serve(text) from public, anon;
grant execute on function public.fleet_can_serve(text) to authenticated;

-- Lecture des courses : la marketplace ne montre que les gammes que la fleet peut assurer
drop policy if exists rides_select_scoped on public.rides;
create policy rides_select_scoped on public.rides
  for select to authenticated
  using (
       client_id = auth.uid()
    or driver_id = auth.uid()
    or (auth.jwt() ->> 'email') = 'kb@bleenr.com'
    or (status in ('waiting','offers') and public.is_fleet() and public.fleet_can_serve(vehicle_type))
    or public.has_offer_on_ride(id)
  );

-- Offre / attribution : le véhicule doit être de la bonne gamme (offre et fleet_update_assignment)
create or replace function public.trg_offers_vehicle_class()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_req text; v_cls text;
begin
  if not public._is_user_not_admin() or new.vehicle_id is null
     or (tg_op = 'UPDATE' and new.vehicle_id is not distinct from old.vehicle_id) then
    return new;
  end if;
  select vehicle_type into v_req from rides where id = new.ride_id;
  select vehicle_class into v_cls from fleet_vehicles where id = new.vehicle_id;
  if coalesce(v_req, '') <> '' and not (v_cls = any(coalesce(_class_vehicles(v_req), array[v_req]))) then
    raise exception 'Ce véhicule n''est pas de la gamme demandée' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists b_offers_vehicle_class on public.offers;
create trigger b_offers_vehicle_class before insert or update on public.offers
  for each row execute function public.trg_offers_vehicle_class();

create or replace function public.api_offer_submit(p_ride uuid, p_price numeric, p_message text, p_vehicle uuid, p_km jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := _api_uid(); o offers%rowtype; d jsonb; v_req text;
begin
  if p_price is null or p_price <= 0 or p_price > 100000 then raise exception 'Prix invalide' using errcode = '22023'; end if;
  if p_vehicle is not null and not exists (select 1 from fleet_vehicles where id = p_vehicle and fleet_id = uid) then
    raise exception 'Ce véhicule n''appartient pas à votre flotte' using errcode = '42501';
  end if;
  select vehicle_type into v_req from rides where id = p_ride;
  if not fleet_can_serve(v_req) then
    raise exception 'Votre flotte n''a pas de véhicule de la gamme demandée' using errcode = '42501';
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

-- Pour les notifications push et les e-mails (Edge Functions) : fleets pouvant assurer une gamme
create or replace function public.fleets_for_class(p_class text)
returns setof uuid language sql stable security definer set search_path = public as $$
  select distinct v.fleet_id from fleet_vehicles v
   where coalesce(v.active, true) and coalesce(v.status, '') <> 'rejected'
     and (coalesce(p_class, '') = '' or v.vehicle_class = any(coalesce(_class_vehicles(p_class), array[p_class])));
$$;
revoke all on function public.fleets_for_class(text) from public, anon, authenticated;
grant execute on function public.fleets_for_class(text) to service_role;

notify pgrst, 'reload schema';
