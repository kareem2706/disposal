-- ════════════════════════════════════════════════════════════════
-- OFFRE PÉRIMÉE APRÈS MODIFICATION DE LA DEMANDE — 30/10/2026. Peut être relancé sans risque.
-- À exécuter APRÈS server_actions.sql et vehicle_class_filter.sql.
--  • offers.outdated_at / outdated_reason : la demande a changé après l'offre
--    (trajet ajouté / supprimé, date, heure, adresses, gamme…)
--  • api_ride_update marque les offres en attente et prévient les fleets (cloche)
--  • api_offer_submit : une offre mise à jour redevient valable
--  • une offre périmée ne peut pas être acceptée (trigger) ; create-checkout la refuse aussi
-- ════════════════════════════════════════════════════════════════

alter table public.offers add column if not exists outdated_at timestamptz;
alter table public.offers add column if not exists outdated_reason text;

create or replace function public.api_ride_update(p_ride uuid, p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := _api_uid(); r rides%rowtype; n rides%rowtype; d jsonb; v_offer text; v_res jsonb; v_old int; v_new int; v_reason text; v_drv uuid;
begin
  select * into r from rides where id = p_ride for update;
  if not found or r.client_id is distinct from uid then raise exception 'Demande introuvable' using errcode = '42501'; end if;
  if r.status not in ('waiting','offers','confirmed','pending_payment') or r.on_way_at is not null or r.pickup_at is not null then
    raise exception 'Cette demande ne peut plus être modifiée' using errcode = '42501';
  end if;
  d := _api_cols('public.rides', p, array['trip_type','from_address','to_address','ride_date','ride_time',
                                          'passengers','vehicle_type','notes','final_price']);
  if d ? 'trip_type' and d ->> 'trip_type' not in ('ab','disposal','mixed') then raise exception 'Type de course invalide' using errcode = '22023'; end if;
  if d ? 'from_address' and _api_txt(d ->> 'from_address', 300) is null then raise exception 'Adresse de départ requise' using errcode = '22023'; end if;
  if d ? 'passengers' and coalesce((d ->> 'passengers')::int, 1) not between 1 and 60 then raise exception 'Nombre de passagers invalide' using errcode = '22023'; end if;
  if d ? 'notes' then
    -- la note de la fleet au client (|offer_note:) n'est jamais écrite par le client
    v_offer := (regexp_match(coalesce(r.notes,''), '(\|offer_note:[^|]*)'))[1];
    d := jsonb_set(d, '{notes}', coalesce(to_jsonb(nullif(left(regexp_replace(coalesce(d ->> 'notes',''), '\|offer_note:[^|]*', '', 'g'), 4000)
                                                     || coalesce(v_offer, ''), '')), 'null'::jsonb));
  end if;
  if not (coalesce(r.is_subcontract, false) and r.status in ('waiting','offers')) then d := d - 'final_price'; end if;
  v_res := _api_update('public.rides', p_ride::text, d);

  -- Demande modifiée alors que des offres sont en attente : elles ne sont plus à jour
  select * into n from rides where id = p_ride;
  if r.status in ('waiting','offers') and exists (select 1 from offers where ride_id = p_ride and status = 'pending')
     and (row(n.trip_type, n.from_address, n.to_address, n.ride_date, n.ride_time, n.passengers, n.vehicle_type,
              regexp_replace(coalesce(n.notes,''), '\|[a-z_]{3,}:[^|]*', '', 'g'))
          is distinct from
          row(r.trip_type, r.from_address, r.to_address, r.ride_date, r.ride_time, r.passengers, r.vehicle_type,
              regexp_replace(coalesce(r.notes,''), '\|[a-z_]{3,}:[^|]*', '', 'g'))) then
    v_old := case when r.trip_type = 'mixed' then (select count(*) from regexp_matches(coalesce(r.notes,''), '(A>B|Disposition)[@:]', 'g')) else 1 end;
    v_new := case when n.trip_type = 'mixed' then (select count(*) from regexp_matches(coalesce(n.notes,''), '(A>B|Disposition)[@:]', 'g')) else 1 end;
    v_reason := case
      when v_new = v_old + 1 then 'Un trajet a été ajouté'
      when v_new > v_old then (v_new - v_old) || ' trajets ont été ajoutés'
      when v_new = v_old - 1 then 'Un trajet a été supprimé'
      when v_new < v_old then (v_old - v_new) || ' trajets ont été supprimés'
      else 'La demande a été modifiée (date, heure, adresses, gamme ou trajets)' end;
    perform _api_trusted(true);
    update offers set outdated_at = now(), outdated_reason = v_reason where ride_id = p_ride and status = 'pending';
    perform _api_trusted(false);
    for v_drv in select distinct driver_id from offers where ride_id = p_ride and status = 'pending' loop
      perform _api_notify(v_drv, 'ride_updated', 'Demande modifiée — offre à mettre à jour',
        'La demande ' || coalesce(n.booking_code, left(n.id::text, 8)) || ' a été modifiée par le client : ' || lower(left(v_reason,1)) || substr(v_reason,2) ||
        '. Votre offre n’est plus à jour : vérifiez la demande et mettez votre offre à jour.', p_ride);
    end loop;
  end if;
  return v_res;
end $$;

create or replace function public.api_offer_submit(p_ride uuid, p_price numeric, p_message text, p_vehicle uuid, p_km jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := _api_uid(); o offers%rowtype; d jsonb; v_req text;
begin
  if p_price is null or p_price <= 0 or p_price > 100000 then raise exception 'Prix invalide' using errcode = '22023'; end if;
  if p_vehicle is not null and not exists (select 1 from fleet_vehicles where id = p_vehicle and fleet_id = uid) then
    raise exception 'Ce véhicule n''appartient pas à votre flotte' using errcode = '42501';
  end if;
  select vehicle_type into v_req from rides where id = p_ride;
  if exists (select 1 from rides where id = p_ride and coalesce(is_subcontract, false)) then
    raise exception 'Une sous-traitance s''accepte au prix fixé, sans offre' using errcode = '42501';
  end if;
  if not fleet_can_serve(v_req) then
    raise exception 'Votre flotte n''a pas de véhicule de la gamme demandée' using errcode = '42501';
  end if;
  d := _api_cols('public.offers', jsonb_build_object('price', round(p_price, 2), 'message', _api_txt(p_message, 1000),
                                                     'vehicle_id', p_vehicle, 'included_km', p_km),
                 array['price','message','vehicle_id','included_km']);
  select * into o from offers where ride_id = p_ride and driver_id = uid for update;
  if found then
    if o.status <> 'pending' then raise exception 'Offre déjà traitée' using errcode = '42501'; end if;
    perform _api_update('public.offers', o.id::text, d);
    -- offre remise à jour par la fleet : elle redevient valable
    perform _api_trusted(true);
    update offers set outdated_at = null, outdated_reason = null where id = o.id;
    perform _api_trusted(false);
    return (select to_jsonb(x) from offers x where x.id = o.id);
  end if;
  return _api_insert('public.offers', d || jsonb_build_object('ride_id', p_ride, 'driver_id', uid, 'status', 'pending'));
end $$;
revoke all on function public.api_offer_submit(uuid, numeric, text, uuid, jsonb) from public, anon;
grant execute on function public.api_offer_submit(uuid, numeric, text, uuid, jsonb) to authenticated;

-- Une offre périmée ne peut pas être confirmée (paiement par carte ou virement)
create or replace function public.trg_offers_no_stale_accept()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.status = 'accepted' and old.status is distinct from 'accepted' and old.outdated_at is not null then
    raise exception 'Cette offre n''est plus à jour : la demande a été modifiée après l''offre' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists b_offers_no_stale_accept on public.offers;
create trigger b_offers_no_stale_accept before update on public.offers
  for each row execute function public.trg_offers_no_stale_accept();

notify pgrst, 'reload schema';
