-- ════════════════════════════════════════════════════════════════
-- E-MAIL « MERCI » UNIQUEMENT QUAND LE CHAUFFEUR TERMINE LA COURSE — 05/11/2026.
-- Peut être relancé. À exécuter APRÈS server_actions.sql et ride_driver_emails.sql.
--  • Clôture automatique (heure dépassée, ouverture de l'app par le client) :
--    la course passe « terminée » sans e-mail.
--  • Le chauffeur indique « Mission terminée » : completed_at est renseigné → e-mail.
-- ════════════════════════════════════════════════════════════════

-- Clôture : completed_at seulement quand c'est le chauffeur attribué
create or replace function public.api_ride_complete(p_ride uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare uid uuid := _api_uid(); r rides%rowtype;
begin
  select * into r from rides where id = p_ride for update;
  if not found or r.status <> 'confirmed' then return false; end if;
  if r.driver_id is distinct from uid then
    if r.client_id is distinct from uid or _ride_start(r) is null or _ride_start(r) + interval '30 minutes' > _now_bxl() then
      return false;
    end if;
    perform _api_update('public.rides', p_ride::text, '{"status":"done"}'::jsonb);          -- clôture automatique
  else
    perform _api_update('public.rides', p_ride::text, jsonb_build_object('status', 'done', 'completed_at', now()));
  end if;
  return true;
end $$;

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
  -- Course terminée PAR LE CHAUFFEUR (completed_at) : remerciement (pas pour une sous-traitance)
  elsif new.status = 'done' and (jn->>'completed_at') is not null and (jo->>'completed_at') is null
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

notify pgrst, 'reload schema';
