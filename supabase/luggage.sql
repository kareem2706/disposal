-- ════════════════════════════════════════════════════════════════
-- BAGAGES — 03/11/2026. Peut être relancé sans risque.
-- À exécuter APRÈS offer_outdated.sql et ride_rules.sql.
--  • rides.luggage_large (grandes valises) / rides.luggage_small (bagages cabine, sacs) : 0 à 50
--  • api_ride_create / api_ride_update acceptent ces deux champs (contrôle 0 à 50)
--  • trajet mixte : bagages de chaque trajet dans la note (|lg:valises/sacs) ; la demande garde le maximum
--  • changement de bagages : simple notification aux fleets (l'offre reste valable)
--  • la fleet ne peut pas modifier les bagages de la demande du client
-- ════════════════════════════════════════════════════════════════

alter table public.rides add column if not exists luggage_large int;
alter table public.rides add column if not exists luggage_small int;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'rides_luggage_chk') then
    alter table public.rides add constraint rides_luggage_chk
      check (coalesce(luggage_large, 0) between 0 and 50 and coalesce(luggage_small, 0) between 0 and 50);
  end if;
end $$;

create or replace function public.api_ride_create(p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := _api_uid(); d jsonb; r jsonb; v_sub boolean := coalesce((p ->> 'is_subcontract')::boolean, false);
        v_now timestamp := _now_bxl(); v_code text; v_n bigint;
begin
  if (select count(*) from rides where client_id = uid and created_at > now() - interval '1 hour') >= 30 then
    raise exception 'Trop de demandes en peu de temps, réessayez plus tard' using errcode = '42501';
  end if;
  d := _api_cols('public.rides', p, array['trip_type','from_address','to_address','ride_date','ride_time',
                                          'passengers','vehicle_type','notes','final_price','luggage_large','luggage_small']);
  if coalesce(d ->> 'trip_type','') not in ('ab','disposal','mixed') then raise exception 'Type de course invalide' using errcode = '22023'; end if;
  if _api_txt(d ->> 'from_address', 300) is null then raise exception 'Adresse de départ requise' using errcode = '22023'; end if;
  if (d ->> 'ride_date') is null or (d ->> 'ride_date')::date < current_date - 1 then raise exception 'Date invalide' using errcode = '22023'; end if;
  if coalesce((d ->> 'passengers')::int, 1) not between 1 and 60 then raise exception 'Nombre de passagers invalide' using errcode = '22023'; end if;
  if coalesce((d ->> 'luggage_large')::int, 0) not between 0 and 50 or coalesce((d ->> 'luggage_small')::int, 0) not between 0 and 50 then
    raise exception 'Nombre de bagages invalide (0 à 50)' using errcode = '22023';
  end if;
  d := d || jsonb_build_object('from_address', left(d ->> 'from_address', 300),
                               'notes', nullif(left(regexp_replace(coalesce(d ->> 'notes',''), '\|offer_note:[^|]*', '', 'g'), 4000), ''),
                               'client_id', uid, 'status', 'waiting');
  if v_sub then
    if not is_validated_fleet() then raise exception 'Votre flotte doit être validée par Bleenr' using errcode = '42501'; end if;
    if coalesce((d ->> 'final_price')::numeric, 0) <= 0 then raise exception 'Prix de la sous-traitance requis' using errcode = '22023'; end if;
    d := d || '{"is_subcontract": true}'::jsonb;
  else
    d := d - 'final_price';
  end if;
  r := _api_insert('public.rides', _api_cols('public.rides', d, array['client_id','status','trip_type','from_address','to_address',
         'ride_date','ride_time','passengers','vehicle_type','notes','final_price','is_subcontract','luggage_large','luggage_small']));

  -- Référence BLxx-MMAA### (compteur du mois, calculé par le serveur)
  perform pg_advisory_xact_lock(hashtext('bleenr_booking_code'));
  select count(*) into v_n from rides where created_at >= date_trunc('month', v_now) at time zone 'Europe/Brussels';
  v_code := 'BL' || case d ->> 'trip_type' when 'ab' then 'AB' when 'disposal' then 'DI' else 'MX' end || '-' ||
            to_char(v_now, 'MMYY') || lpad(greatest(v_n, 1)::text, 3, '0');
  update rides set booking_code = v_code where id = (r ->> 'id')::uuid;
  return jsonb_build_object('id', r ->> 'id', 'booking_code', v_code);
end $$;

create or replace function public.api_ride_update(p_ride uuid, p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := _api_uid(); r rides%rowtype; n rides%rowtype; d jsonb; v_offer text; v_res jsonb; v_old int; v_new int; v_reason text; v_drv uuid; v_sig_o text; v_sig_n text;
begin
  select * into r from rides where id = p_ride for update;
  if not found or r.client_id is distinct from uid then raise exception 'Demande introuvable' using errcode = '42501'; end if;
  if r.status not in ('waiting','offers','confirmed','pending_payment') or r.on_way_at is not null or r.pickup_at is not null then
    raise exception 'Cette demande ne peut plus être modifiée' using errcode = '42501';
  end if;
  d := _api_cols('public.rides', p, array['trip_type','from_address','to_address','ride_date','ride_time',
                                          'passengers','vehicle_type','notes','final_price','luggage_large','luggage_small']);
  if d ? 'trip_type' and d ->> 'trip_type' not in ('ab','disposal','mixed') then raise exception 'Type de course invalide' using errcode = '22023'; end if;
  if d ? 'from_address' and _api_txt(d ->> 'from_address', 300) is null then raise exception 'Adresse de départ requise' using errcode = '22023'; end if;
  if d ? 'passengers' and coalesce((d ->> 'passengers')::int, 1) not between 1 and 60 then raise exception 'Nombre de passagers invalide' using errcode = '22023'; end if;
  if coalesce((d ->> 'luggage_large')::int, 0) not between 0 and 50 or coalesce((d ->> 'luggage_small')::int, 0) not between 0 and 50 then
    raise exception 'Nombre de bagages invalide (0 à 50)' using errcode = '22023';
  end if;
  if d ? 'notes' then
    -- la note de la fleet au client (|offer_note:) n'est jamais écrite par le client
    v_offer := (regexp_match(coalesce(r.notes,''), '(\|offer_note:[^|]*)'))[1];
    d := jsonb_set(d, '{notes}', coalesce(to_jsonb(nullif(left(regexp_replace(coalesce(d ->> 'notes',''), '\|offer_note:[^|]*', '', 'g'), 4000)
                                                     || coalesce(v_offer, ''), '')), 'null'::jsonb));
  end if;
  if not (coalesce(r.is_subcontract, false) and r.status in ('waiting','offers')) then d := d - 'final_price'; end if;
  v_res := _api_update('public.rides', p_ride::text, d);

  -- Demande modifiée alors que des offres sont en attente.
  --  • offre périmée (blocage + nouvelle offre) : trajet ajouté / supprimé, ou départ, arrivée, date, heure, durée de mise à disposition, gamme modifiés
  --  • simple notification : autre changement (passagers, instructions, vol / train…)
  select * into n from rides where id = p_ride;
  if r.status in ('waiting','offers') and exists (select 1 from offers where ride_id = p_ride and status = 'pending') then
    -- trajets d'une course mixte réduits à : type, heure, départ > arrivée, date, gamme
    v_sig_o := case when r.trip_type = 'mixed' then regexp_replace(regexp_replace(coalesce(r.notes,''), '\|[a-z_]{3,}:[^|]*', '', 'g'),
                 '\|(p|n|fl|tr|fl2|tr2|pn|pt|lg):[^|]*', '', 'g') else '' end;
    v_sig_n := case when n.trip_type = 'mixed' then regexp_replace(regexp_replace(coalesce(n.notes,''), '\|[a-z_]{3,}:[^|]*', '', 'g'),
                 '\|(p|n|fl|tr|fl2|tr2|pn|pt|lg):[^|]*', '', 'g') else '' end;
    v_old := case when r.trip_type = 'mixed' then (select count(*) from regexp_matches(coalesce(r.notes,''), '(A>B|Disposition)[@:]', 'g')) else 1 end;
    v_new := case when n.trip_type = 'mixed' then (select count(*) from regexp_matches(coalesce(n.notes,''), '(A>B|Disposition)[@:]', 'g')) else 1 end;
    if row(n.trip_type, n.from_address, n.to_address, n.ride_date, n.ride_time, n.vehicle_type, v_sig_n, (regexp_match(coalesce(n.notes,''), 'Durée:([^\s|,]+)'))[1])
       is distinct from row(r.trip_type, r.from_address, r.to_address, r.ride_date, r.ride_time, r.vehicle_type, v_sig_o, (regexp_match(coalesce(r.notes,''), 'Durée:([^\s|,]+)'))[1]) then
      v_reason := case
        when v_new = v_old + 1 then 'Un trajet a été ajouté'
        when v_new > v_old then (v_new - v_old) || ' trajets ont été ajoutés'
        when v_new = v_old - 1 then 'Un trajet a été supprimé'
        when v_new < v_old then (v_old - v_new) || ' trajets ont été supprimés'
        else 'Départ, arrivée, date, heure, durée ou gamme modifiés' end;
      perform _api_trusted(true);
      update offers set outdated_at = now(), outdated_reason = v_reason where ride_id = p_ride and status = 'pending';
      perform _api_trusted(false);
      for v_drv in select distinct driver_id from offers where ride_id = p_ride and status = 'pending' loop
        perform _api_notify(v_drv, 'ride_updated', 'Demande modifiée — offre à mettre à jour',
          'La demande ' || coalesce(n.booking_code, left(n.id::text, 8)) || ' a été modifiée par le client : ' || lower(left(v_reason,1)) || substr(v_reason,2) ||
          '. Votre offre n’est plus à jour : vérifiez la demande et mettez votre offre à jour.', p_ride);
      end loop;
    elsif row(n.passengers, n.luggage_large, n.luggage_small, regexp_replace(coalesce(n.notes,''), '\|(pax|tel|pemail|pref|note_drv|offer_note):[^|]*', '', 'g'))
          is distinct from row(r.passengers, r.luggage_large, r.luggage_small, regexp_replace(coalesce(r.notes,''), '\|(pax|tel|pemail|pref|note_drv|offer_note):[^|]*', '', 'g')) then
      v_reason := case when n.passengers is distinct from r.passengers
                       then 'nombre de passagers : ' || coalesce(r.passengers::text,'—') || ' → ' || coalesce(n.passengers::text,'—')
                       when row(n.luggage_large, n.luggage_small) is distinct from row(r.luggage_large, r.luggage_small)
                       then 'bagages : ' || coalesce(n.luggage_large, 0) || ' valise(s), ' || coalesce(n.luggage_small, 0) || ' sac(s)'
                       else 'informations de la demande mises à jour (passagers, bagages, instructions, vol / train…)' end;
      for v_drv in select distinct driver_id from offers where ride_id = p_ride and status = 'pending' loop
        perform _api_notify(v_drv, 'ride_updated', 'Demande mise à jour',
          'La demande ' || coalesce(n.booking_code, left(n.id::text, 8)) || ' a été mise à jour par le client (' || v_reason ||
          '). Votre offre reste valable, aucune action n’est nécessaire.', p_ride);
      end loop;
    end if;
  end if;
  return v_res;
end $$;

create or replace function public.trg_rides_driver_fields_guard()
returns trigger language plpgsql set search_path = public as $$
declare jn jsonb := to_jsonb(new); jo jsonb := to_jsonb(old); k text;
begin
  if not public._is_user_not_admin() or old.status = 'personal'
     or old.driver_id is distinct from auth.uid() or old.client_id = auth.uid() then
    return new;
  end if;
  foreach k in array array['from_address','to_address','ride_date','ride_time','passengers',
                           'vehicle_type','trip_type','booking_code','is_subcontract','luggage_large','luggage_small'] loop
    if (jn -> k) is distinct from (jo -> k) then
      raise exception 'Seul le client peut modifier les détails de sa demande' using errcode = '42501';
    end if;
  end loop;
  return new;
end $$;

notify pgrst, 'reload schema';
