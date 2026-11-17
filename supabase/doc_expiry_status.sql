-- Documents expirés (17/11/2026)
--  • un document de chauffeur ou de véhicule dont la date de validité est dépassée
--    remet le chauffeur / le véhicule au statut « pending » (non vérifié) ;
--    l'administrateur le revalide après mise à jour du document ;
--  • une fleet sans véhicule vérifié ou sans chauffeur vérifié ne peut plus
--    faire d'offre ni accepter de sous-traitance (contrôle serveur).

create or replace function public.expire_fleet_documents()
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_today date := (now() at time zone 'Europe/Brussels')::date; nd int; nv int;
begin
  perform _api_trusted(true);
  update fleet_drivers d set status = 'pending'
   where d.status = 'validated'
     and exists (select 1 from driver_documents x
                  where x.driver_id = d.id and x.expires_at is not null and x.expires_at::date < v_today);
  get diagnostics nd = row_count;
  update fleet_vehicles v set status = 'pending'
   where v.status = 'validated'
     and exists (select 1 from vehicle_documents x
                  where x.vehicle_id = v.id and x.expires_at is not null and x.expires_at::date < v_today);
  get diagnostics nv = row_count;
  perform _api_trusted(false);
  return jsonb_build_object('drivers', nd, 'vehicles', nv);
end $$;
revoke all on function public.expire_fleet_documents() from public, anon, authenticated;

-- Contrôle toutes les heures
select cron.unschedule(jobid) from cron.job where jobname = 'bleenr_expire_fleet_docs';
select cron.schedule('bleenr_expire_fleet_docs', '7 * * * *', 'select public.expire_fleet_documents()');

-- La fleet connectée a-t-elle au moins un véhicule ET un chauffeur vérifiés ?
create or replace function public.fleet_assets_ready()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from fleet_vehicles where fleet_id = auth.uid() and coalesce(active, true) and status = 'validated')
     and exists (select 1 from fleet_drivers  where fleet_id = auth.uid() and coalesce(active, true) and status = 'validated');
$$;
revoke execute on function public.fleet_assets_ready() from public, anon;
grant execute on function public.fleet_assets_ready() to authenticated;

create or replace function public.api_offer_submit(p_ride uuid, p_price numeric, p_message text, p_vehicle uuid, p_km jsonb)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare uid uuid := _api_uid(); o offers%rowtype; d jsonb; v_req text; v_pax int;
begin
  if p_price is null or p_price <= 0 or p_price > 100000 then raise exception 'Prix invalide' using errcode = '22023'; end if;
  if not fleet_assets_ready() then
    raise exception 'Vous devez avoir au moins un véhicule et un chauffeur vérifiés pour faire une offre (documents à jour)' using errcode = '42501';
  end if;
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
    perform _api_update('public.offers', o.id::text, d);
    -- offre remise à jour par la fleet : elle redevient valable (offer_outdated.sql)
    perform _api_trusted(true);
    update offers set outdated_at = null, outdated_reason = null where id = o.id;
    perform _api_trusted(false);
    return (select to_jsonb(x) from offers x where x.id = o.id);
  end if;
  return _api_insert('public.offers', d || jsonb_build_object('ride_id', p_ride, 'driver_id', uid, 'status', 'pending'));
end $function$;

create or replace function public.accept_subcontract(p_ride uuid)
 RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
begin
  if not is_validated_fleet() then
    raise exception 'Votre flotte doit être validée par Bleenr' using errcode = '42501';
  end if;
  if not fleet_assets_ready() then
    raise exception 'Vous devez avoir au moins un véhicule et un chauffeur vérifiés pour accepter une course (documents à jour)' using errcode = '42501';
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
end $function$;

-- Premier passage immédiat
select public.expire_fleet_documents();
