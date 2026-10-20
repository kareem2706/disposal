-- ════════════════════════════════════════════════════════════════
-- PRÉFÉRENCES DE NOTIFICATIONS DU CLIENT — 20/10/2026. Peut être relancé.
-- À exécuter APRÈS server_actions.sql.
--
-- Profil → Notifications : deux blocs de 6 interrupteurs
--   (dans l'application = cloche, par e-mail) :
--   ride_published  Demande publiée
--   offer_received  Nouvelle offre reçue
--   offer_updated   Mise à jour des offres reçues (offre modifiée / retirée)
--   ride_confirmed  Course confirmée
--   driver_message  Message d'un chauffeur
--   driver_on_way   Chauffeur en route
-- Les choix sont appliqués par le serveur (notifications et e-mails).
-- Par défaut tout est activé.
-- ════════════════════════════════════════════════════════════════

alter table public.profiles add column if not exists notif_prefs jsonb;

-- Type de notification / d'e-mail → préférence
create or replace function public._notif_pref_key(p_type text)
returns text language sql immutable as $$
  select case p_type
    when 'ride_published' then 'ride_published'  when 'ride_created' then 'ride_published'
    when 'offer_received' then 'offer_received'
    when 'offer_updated' then 'offer_updated'    when 'offer_withdrawn' then 'offer_updated'
    when 'ride_confirmed' then 'ride_confirmed'  when 'ride_confirmed_client' then 'ride_confirmed'
    when 'driver_note' then 'driver_message'
    when 'driver_on_way' then 'driver_on_way'
  end;
$$;

-- Le destinataire accepte-t-il ce type sur ce canal (app | email) ?
create or replace function public.notif_allowed(p_user uuid, p_channel text, p_type text)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select (notif_prefs -> p_channel ->> public._notif_pref_key(p_type)) <> 'false'
                     from profiles where id = p_user), true)
         or public._notif_pref_key(p_type) is null;
$$;
revoke all on function public.notif_allowed(uuid, text, text) from public, anon, authenticated;
grant execute on function public.notif_allowed(uuid, text, text) to service_role;

-- Cloche : la notification n'est pas créée si le client l'a désactivée
create or replace function public.trg_notifications_prefs()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not public.notif_allowed(new.user_id, 'app', new.type) then return null; end if;
  return new;
end $$;
drop trigger if exists "1_notif_prefs" on public.notifications;
create trigger "1_notif_prefs" before insert on public.notifications
  for each row execute function public.trg_notifications_prefs();

-- Enregistrement des préférences (seules les 6 clés connues, valeurs vrai / faux)
create or replace function public._notif_prefs_merge(p_old jsonb, p_new jsonb)
returns jsonb language sql immutable as $$
  select jsonb_build_object(
    'app',   coalesce(p_old -> 'app', '{}'::jsonb)   || coalesce((select jsonb_object_agg(k, (p_new -> 'app'   ->> k) <> 'false')
                 from unnest(array['ride_published','offer_received','offer_updated','ride_confirmed','driver_message','driver_on_way']) k
                where p_new -> 'app' ? k), '{}'::jsonb),
    'email', coalesce(p_old -> 'email', '{}'::jsonb) || coalesce((select jsonb_object_agg(k, (p_new -> 'email' ->> k) <> 'false')
                 from unnest(array['ride_published','offer_received','offer_updated','ride_confirmed','driver_message','driver_on_way']) k
                where p_new -> 'email' ? k), '{}'::jsonb));
$$;
create or replace function public.api_profile_update(p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := _api_uid(); d jsonb; k text;
begin
  d := _api_cols('public.profiles', p, array['first_name','last_name','company_name','phone','vat_number',
         'address_street','address_postal','address_city','address_country','client_type','avatar_url','lang','notif_prefs']);
  for k in select jsonb_object_keys(d) loop
    if jsonb_typeof(d -> k) = 'string' then d := jsonb_set(d, array[k], coalesce(to_jsonb(_api_txt(d ->> k, 300)), 'null'::jsonb)); end if;
  end loop;
  if d ? 'client_type' and coalesce(d ->> 'client_type','') not in ('perso','pro') then d := d - 'client_type'; end if;
  if d ? 'notif_prefs' then
    d := jsonb_set(d, '{notif_prefs}', _notif_prefs_merge((select notif_prefs from profiles where id = uid),
                                                          case when jsonb_typeof(d -> 'notif_prefs') = 'object' then d -> 'notif_prefs' else '{}'::jsonb end));
  end if;
  return _api_update('public.profiles', uid::text, d);
end $$;
revoke all on function public.api_profile_update(jsonb) from public, anon;
grant execute on function public.api_profile_update(jsonb) to authenticated;

-- ────────────────────────────────────────────────────────────────
-- Nouvelles notifications « cloche » pour le client
-- ────────────────────────────────────────────────────────────────
create or replace function public._ride_label(r public.rides)
returns text language sql stable as $$
  select coalesce(r.booking_code, left(r.id::text, 8)) ||
         coalesce(' du ' || to_char(r.ride_date, 'DD/MM/YYYY') || coalesce(' à ' || left(r.ride_time::text, 5), ''), '');
$$;

create or replace function public.trg_rides_client_inapp()
returns trigger language plpgsql security definer set search_path = public as $$
declare jn jsonb := to_jsonb(new); jo jsonb := to_jsonb(old); old_note text; new_note text; offer_msg text;
begin
  if new.client_id is null or new.status = 'personal' then return new; end if;

  -- Demande publiée (la référence est attribuée juste après la création)
  if new.booking_code is not null and old.booking_code is null and new.status in ('waiting','offers') then
    perform _api_notify(new.client_id, 'ride_published', 'Demande publiée',
      'Votre demande ' || _ride_label(new) || ' est publiée. Les chauffeurs partenaires peuvent vous envoyer leurs offres.', new.id);
  end if;

  -- Course confirmée
  if new.status = 'confirmed' and old.status in ('waiting','offers','pending_payment') then
    perform _api_notify(new.client_id, 'ride_confirmed', 'Course confirmée',
      'Votre course ' || _ride_label(new) || ' est confirmée. Votre chauffeur est réservé.', new.id);
  end if;

  -- Chauffeur en route
  if (jn ->> 'on_way_at') is not null and (jo ->> 'on_way_at') is null then
    perform _api_notify(new.client_id, 'driver_on_way', 'Votre chauffeur est en route',
      'Votre chauffeur est parti vers le lieu de prise en charge (course ' || coalesce(new.booking_code, '') || ').', new.id);
  end if;

  -- Message du chauffeur (|offer_note:), sauf la recopie automatique du message de l'offre
  old_note := trim(coalesce((regexp_match(coalesce(old.notes,''), '\|offer_note:([^|]*)'))[1], ''));
  new_note := trim(coalesce((regexp_match(coalesce(new.notes,''), '\|offer_note:([^|]*)'))[1], ''));
  if new_note <> '' and new_note is distinct from old_note then
    select trim(coalesce(message,'')) into offer_msg from offers where ride_id = new.id and status = 'accepted' limit 1;
    if not (old_note = '' and new_note = coalesce(offer_msg,'')) then
      perform _api_notify(new.client_id, 'driver_note', 'Message de votre chauffeur', left(new_note, 300), new.id);
    end if;
  end if;
  return new;
end $$;

drop trigger if exists rides_client_inapp on public.rides;
create trigger rides_client_inapp after update on public.rides
  for each row execute function public.trg_rides_client_inapp();

-- Offre modifiée (prix / message) ou retirée → cloche + e-mail « mise à jour des offres »
create or replace function public.trg_offers_client_updates()
returns trigger language plpgsql security definer set search_path = public as $$
declare r rides%rowtype; o offers%rowtype; v_price text;
begin
  if tg_op = 'DELETE' then o := old; else o := new; end if;
  select * into r from rides where id = o.ride_id;
  if not found or r.client_id is null or r.status not in ('waiting','offers') then return null; end if;
  v_price := replace(to_char(round(coalesce(o.price,0) * 1.06, 2), 'FM999999990.00'), '.', ',') || ' €';

  if tg_op = 'UPDATE' then
    if old.status <> 'pending' or new.status <> 'pending'
       or (new.price is not distinct from old.price and new.message is not distinct from old.message) then
      return null;
    end if;
    perform _api_notify(r.client_id, 'offer_updated', 'Offre mise à jour',
      'Un chauffeur a modifié son offre sur votre demande ' || coalesce(r.booking_code, '') || ' : ' || v_price || ' TVAC.', r.id);
    perform _send_mail_hook('offer_updated', r.client_id, _ride_mail_data(r) ||
      jsonb_build_object('price', v_price, 'action', 'updated'));
  elsif old.status = 'pending' then
    -- retrait : la cloche est envoyée par driver_withdraw_offer
    perform _send_mail_hook('offer_updated', r.client_id, _ride_mail_data(r) ||
      jsonb_build_object('price', v_price, 'action', 'withdrawn'));
  end if;
  return null;
end $$;

drop trigger if exists offers_client_updates on public.offers;
create trigger offers_client_updates after update or delete on public.offers
  for each row execute function public.trg_offers_client_updates();

notify pgrst, 'reload schema';
