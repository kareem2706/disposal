-- ════════════════════════════════════════════════════════════════
-- EMAILS AU CLIENT DÉCLENCHÉS PAR LA BASE (site ET app iOS)
-- Remplace ride_completed_email.sql (qu'il inclut). Peut être relancé.
-- Prérequis : security_hardening.sql (secret notify_hook_secret) + send-mail déployée.
--
--   course « en chemin »            → driver_on_way
--   course clôturée en No Show       → ride_no_show
--   course terminée                  → ride_completed (sauf No Show / sous-traitance)
--   nouvelle offre d'une fleet       → offer_received
--   note de la fleet au client       → driver_note
--   véhicule / chauffeur modifié     → assignment_changed
-- ════════════════════════════════════════════════════════════════

-- Envoi via l'Edge Function send-mail (appel signé par le secret partagé)
create or replace function public._send_mail_hook(p_type text, p_to uuid, p_data jsonb)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  if p_to is null then return; end if;
  perform net.http_post(
    url     := 'https://tuzfoqdxmxzjjhvlxsgb.supabase.co/functions/v1/send-mail',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1emZvcWR4bXh6ampodmx4c2diIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0MzIyNDcsImV4cCI6MjA5MDAwODI0N30.xJU8CmI0KGiEl-YA87Rtv8yrrFkPU8_dAlUrY85DDzs',
      'x-hook-secret', coalesce((select decrypted_secret from vault.decrypted_secrets
                                  where name = 'notify_hook_secret' limit 1), '')
    ),
    body    := jsonb_build_object('type', p_type, 'to_user_ids', jsonb_build_array(p_to), 'data', p_data),
    timeout_milliseconds := 5000
  );
end $$;
revoke all on function public._send_mail_hook(text, uuid, jsonb) from public, anon, authenticated;

-- Données communes de la course (référence, date, trajet)
create or replace function public._ride_mail_data(r public.rides)
returns jsonb language sql stable as $$
  select jsonb_build_object(
    'code', coalesce(r.booking_code, left(r.id::text, 8)),
    'date', coalesce(to_char(r.ride_date, 'DD/MM/YYYY'), ''),
    'time', left(coalesce(r.ride_time::text, ''), 5),
    'from', coalesce(split_part(r.from_address, ',', 1), ''),
    'to',   case when r.trip_type = 'disposal' then 'Mise à disposition'
                 else coalesce(split_part(r.to_address, ',', 1), '') end);
$$;

-- Véhicule et chauffeur attribués (offre acceptée)
create or replace function public._ride_assignment_data(p_ride uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce((
    select jsonb_build_object(
      'vehicle', coalesce(trim(concat_ws(' ', v.brand, v.model, v.color)) ||
                          case when v.plate is not null then ' (' || v.plate || ')' else '' end, ''),
      'driver',  coalesce(trim(concat_ws(' ', d.first_name, d.last_name)), ''),
      'driverPhone', coalesce(d.phone, ''))
    from offers o
    left join fleet_vehicles v on v.id = o.vehicle_id
    left join fleet_drivers  d on d.id = o.fleet_driver_id
    where o.ride_id = p_ride and o.status = 'accepted'
    limit 1), '{}'::jsonb);
$$;

-- ── Courses ─────────────────────────────────────────────────────
create or replace function public.trg_rides_client_mails()
returns trigger language plpgsql security definer set search_path = public as $$
declare d jsonb; old_note text; new_note text; offer_msg text;
        jn jsonb := to_jsonb(new); jo jsonb := to_jsonb(old);
begin
  if new.client_id is null or new.status = 'personal' then return new; end if;
  d := _ride_mail_data(new);

  -- Chauffeur en route
  if (jn->>'on_way_at') is not null and (jo->>'on_way_at') is null then
    perform _send_mail_hook('driver_on_way', new.client_id, d || _ride_assignment_data(new.id));
  end if;

  -- Absence du client
  if (jn->>'no_show_at') is not null and (jo->>'no_show_at') is null then
    perform _send_mail_hook('ride_no_show', new.client_id, d);
  -- Course terminée : remerciement (pas pour une sous-traitance)
  elsif new.status = 'done' and old.status is distinct from 'done'
        and (jn->>'no_show_at') is null and coalesce((jn->>'is_subcontract')::boolean, false) = false then
    perform _send_mail_hook('ride_completed', new.client_id, d);
  end if;

  -- Note de la fleet au client (|offer_note: dans les notes de la course)
  old_note := trim(coalesce((regexp_match(coalesce(old.notes,''), '\|offer_note:([^|]*)'))[1], ''));
  new_note := trim(coalesce((regexp_match(coalesce(new.notes,''), '\|offer_note:([^|]*)'))[1], ''));
  if new_note <> '' and new_note is distinct from old_note then
    -- recopie automatique du message de l'offre à la confirmation : pas d'email
    select trim(coalesce(message,'')) into offer_msg from offers
     where ride_id = new.id and status = 'accepted' limit 1;
    if not (old_note = '' and new_note = coalesce(offer_msg,'')) then
      perform _send_mail_hook('driver_note', new.client_id,
        d || jsonb_build_object('note', new_note,
                                'noteAction', case when old_note = '' then 'created' else 'updated' end));
    end if;
  end if;
  return new;
end $$;

drop trigger if exists ride_completed_mail on public.rides;   -- ancienne version (ride_completed_email.sql)
drop trigger if exists rides_client_mails on public.rides;
create trigger rides_client_mails
  after update on public.rides
  for each row execute function public.trg_rides_client_mails();

-- ── Offres ──────────────────────────────────────────────────────
create or replace function public.trg_offers_client_mails()
returns trigger language plpgsql security definer set search_path = public as $$
declare r rides%rowtype; chg text[] := '{}';
begin
  select * into r from rides where id = new.ride_id;
  if not found or r.client_id is null then return new; end if;

  if tg_op = 'INSERT' then
    -- Offre créée déjà acceptée (sous-traitance acceptée) : pas d'« offre reçue »
    if coalesce(new.status, 'pending') <> 'pending' then return new; end if;
    -- Nouvelle offre (prix TVAC affiché au client)
    perform _send_mail_hook('offer_received', r.client_id, _ride_mail_data(r) ||
      jsonb_build_object('price', replace(to_char(round(coalesce(new.price,0) * 1.06, 2), 'FM999999990.00'), '.', ',') || ' €'));
    -- Notification dans l'application (cloche) — met aussi l'écran du client à jour
    insert into notifications (user_id, type, title, body, ride_id, read)
    values (r.client_id, 'offer_received', 'Nouvelle offre reçue',
            'Un chauffeur vous propose ' || replace(to_char(round(coalesce(new.price,0) * 1.06, 2), 'FM999999990.00'), '.', ',') ||
            ' € TVAC pour votre demande ' || coalesce(r.booking_code, '') || '.',
            r.id, false);
    return new;
  end if;

  -- Véhicule / chauffeur modifiés sur une mission attribuée
  if new.status = 'accepted' and r.status in ('confirmed','active') then
    if new.vehicle_id is distinct from old.vehicle_id then chg := array_append(chg, 'véhicule'); end if;
    if new.fleet_driver_id is distinct from old.fleet_driver_id then chg := array_append(chg, 'chauffeur'); end if;
    if array_length(chg, 1) > 0 then
      perform _send_mail_hook('assignment_changed', r.client_id,
        _ride_mail_data(r) || _ride_assignment_data(r.id) ||
        jsonb_build_object('changes', array_to_string(chg, ' et ')));
    end if;
  end if;
  return new;
end $$;

drop trigger if exists offers_client_mails on public.offers;
create trigger offers_client_mails
  after insert or update on public.offers
  for each row execute function public.trg_offers_client_mails();
