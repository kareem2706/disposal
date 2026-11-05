-- ════════════════════════════════════════════════════════════════
-- E-MAILS « MISSION MODIFIÉE / SUPPLÉMENT » — 04/11/2026. Peut être relancé.
-- À exécuter APRÈS mission_changes.sql, ride_driver_emails.sql et email_campaigns.sql.
--
--   client modifie une mission confirmée   → mission_changed      (chauffeur)
--   chauffeur demande un supplément        → supplement_requested (client)
--   chauffeur se retire                    → driver_withdrew      (client)
--   chauffeur accepte la modification      → mission_accepted     (client)
--   client paie le supplément              → supplement_paid      (chauffeur)
-- Désactivables dans Profil › Notifications (cloche et e-mail) :
--   client     : « Modification de ma course » (ride_changes)
--   chauffeur  : « Mission modifiée par le client » (mission_changed)
-- ════════════════════════════════════════════════════════════════

create or replace function public._notif_pref_key(p_type text)
returns text language sql immutable as $$
  select case p_type
    when 'ride_published' then 'ride_published'  when 'ride_created' then 'ride_published'
    when 'offer_received' then 'offer_received'
    when 'offer_updated' then 'offer_updated'    when 'offer_withdrawn' then 'offer_updated'
    when 'ride_confirmed' then 'ride_confirmed'  when 'ride_confirmed_client' then 'ride_confirmed'
    when 'driver_note' then 'driver_message'     when 'assignment_changed' then 'driver_message'
    when 'driver_on_way' then 'driver_on_way'
    when 'supplement_requested' then 'ride_changes' when 'driver_withdrew' then 'ride_changes'
    when 'mission_accepted' then 'ride_changes'
    when 'mission_changed' then 'mission_changed'   when 'supplement_paid' then 'mission_changed'
  end;
$$;

create or replace function public._notif_prefs_merge(p_old jsonb, p_new jsonb)
returns jsonb language sql immutable as $$
  select jsonb_build_object(
    'app',   coalesce(p_old -> 'app', '{}'::jsonb)   || coalesce((select jsonb_object_agg(k, (p_new -> 'app'   ->> k) <> 'false')
                 from unnest(array['ride_published','offer_received','offer_updated','ride_confirmed','driver_message','driver_on_way',
                                   'ride_changes','mission_changed']) k
                where p_new -> 'app' ? k), '{}'::jsonb),
    'email', coalesce(p_old -> 'email', '{}'::jsonb) || coalesce((select jsonb_object_agg(k, (p_new -> 'email' ->> k) <> 'false')
                 from unnest(array['ride_published','offer_received','offer_updated','ride_confirmed','driver_message','driver_on_way','marketing',
                                   'ride_changes','mission_changed']) k
                where p_new -> 'email' ? k), '{}'::jsonb));
$$;

-- Envoi des e-mails selon le changement d'état (change_state)
create or replace function public.trg_rides_change_mails()
returns trigger language plpgsql security definer set search_path = public as $$
declare d jsonb;
begin
  if new.status <> 'confirmed' or new.client_id is null then return new; end if;
  d := _ride_mail_data(new);
  if new.change_state = 'to_review' and (old.change_state is distinct from 'to_review' or new.change_summary is distinct from old.change_summary) then
    perform _send_mail_hook('mission_changed', new.driver_id, d || jsonb_build_object('changes', coalesce(new.change_summary, '')));
  elsif new.change_state = 'supplement' and old.change_state is distinct from 'supplement' then
    perform _send_mail_hook('supplement_requested', new.client_id, d || jsonb_build_object(
      'amount', _eur(new.supp_amount) || ' €', 'paid', _eur(new.final_price) || ' €', 'total', _eur(coalesce(new.final_price, 0) + coalesce(new.supp_amount, 0)) || ' €',
      'note', coalesce(new.supp_message, ''), 'deadline', coalesce(to_char(new.supp_deadline at time zone 'Europe/Brussels', 'DD/MM/YYYY à HH24:MI'), '')));
  elsif new.change_state = 'withdrawn' and old.change_state is distinct from 'withdrawn' then
    perform _send_mail_hook('driver_withdrew', new.client_id, d || jsonb_build_object(
      'note', coalesce(new.supp_message, ''), 'deadline', coalesce(to_char(new.supp_deadline at time zone 'Europe/Brussels', 'DD/MM/YYYY à HH24:MI'), '')));
  elsif new.change_state is null and old.change_state = 'to_review' then
    perform _send_mail_hook('mission_accepted', new.client_id, d || case
      when coalesce(new.refund_due, 0) > coalesce(old.refund_due, 0) + 0.004 and new.final_price < old.final_price
      then jsonb_build_object('refund', _eur(old.final_price - new.final_price) || ' €',
                              'paid', _eur(old.final_price) || ' €', 'total', _eur(new.final_price) || ' €', 'note', coalesce(new.supp_message, ''))
      else '{}'::jsonb end);
  elsif new.change_state is null and old.change_state = 'supplement' and new.final_price > old.final_price then
    perform _send_mail_hook('supplement_paid', new.driver_id, d || jsonb_build_object('amount', _eur(new.final_price - old.final_price) || ' €'));
  end if;
  return new;
exception when others then
  raise warning 'trg_rides_change_mails: %', sqlerrm;   -- un e-mail en échec ne bloque jamais la course
  return new;
end $$;
drop trigger if exists z_rides_change_mails on public.rides;
create trigger z_rides_change_mails after update of change_state, change_summary, final_price on public.rides
  for each row execute function public.trg_rides_change_mails();

notify pgrst, 'reload schema';
