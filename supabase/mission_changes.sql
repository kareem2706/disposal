-- ════════════════════════════════════════════════════════════════
-- MISSION MODIFIÉE APRÈS CONFIRMATION / SUPPLÉMENT / CRÉDIT — 04/11/2026.
-- Peut être relancé sans risque. À exécuter APRÈS luggage.sql et ride_rules.sql.
--
--  1. Le client peut modifier ou annuler une course confirmée jusqu'au délai de
--     remboursement (Admin › Facturation, 48 h par défaut).
--  2. Modification d'une mission confirmée → rides.change_state = 'to_review' ;
--     le chauffeur répond (api_mission_reply) :
--       accept     : la mission reste au même prix
--       supplement : nouveau prix total HTVA → le client paie la différence (Stripe)
--       withdraw   : le chauffeur se retire
--  3. Le client répond (supplément ou chauffeur retiré) :
--       payer le supplément (create-checkout kind = supplement → confirm_supplement_payment)
--       api_change_decline : cancel | republish_refund | republish_credit
--     Sans réponse au délai (supp_deadline) : course annulée et remboursable
--     (expire_mission_changes, toutes les 10 min via pg_cron si disponible).
--  4. Crédit : la demande republiée garde le montant payé (rides.credit_amount) ;
--     le client ne paie que la différence ; trop-perçu ou crédit inutilisé →
--     remboursement (la course d'origine réapparaît dans « Remboursements »).
-- ════════════════════════════════════════════════════════════════

alter table public.rides add column if not exists change_state   text;          -- to_review | supplement | withdrawn
alter table public.rides add column if not exists change_summary text;
alter table public.rides add column if not exists change_at      timestamptz;
alter table public.rides add column if not exists supp_new_htva  numeric;       -- nouveau prix total HTVA demandé par le chauffeur
alter table public.rides add column if not exists supp_amount    numeric;       -- supplément TVAC à payer par le client
alter table public.rides add column if not exists supp_message   text;
alter table public.rides add column if not exists supp_deadline  timestamptz;   -- réponse attendue avant (sinon annulation)
alter table public.rides add column if not exists credit_amount  numeric;       -- crédit (TVAC) reporté depuis une course annulée
alter table public.rides add column if not exists credit_from    uuid;          -- course d'origine du crédit
alter table public.rides add column if not exists credit_method  text;          -- moyen de paiement d'origine (stripe | bank_transfer)

-- Mode « serveur de confiance » le temps d'une écriture, puis retour à l'état précédent
create or replace function public._trusted_begin() returns text language plpgsql as $$
declare v text := coalesce(current_setting('bleenr.as_user', true), '');
begin perform set_config('bleenr.as_user', '0', true); return v; end $$;
create or replace function public._trusted_end(p text) returns void language sql as $$
  select set_config('bleenr.as_user', coalesce(p, ''), true);
$$;

create or replace function public._eur(p numeric) returns text language sql immutable as $$
  select replace(to_char(coalesce(p, 0), 'FM999990.00'), '.', ',');
$$;

-- Délai de réponse : début de la course − délai de remboursement
create or replace function public._change_deadline(r public.rides) returns timestamptz language sql stable as $$
  select (_ride_start(r) - make_interval(hours => _refund_delay_hours(r))) at time zone 'Europe/Brussels';
$$;

-- Résumé lisible des changements importants (« Heure : 11:15 → 13:30 · Passagers : 2 → 3 »)
create or replace function public._mission_changes(o public.rides, n public.rides) returns text language plpgsql stable as $$
declare p text[] := '{}'; sa text; sb text;
  lbl jsonb := '{"lowcost":"Economy","business":"Business","van":"Van","luxe":"Luxe","bus":"Bus","any":"Toute gamme"}';
  tl  jsonb := '{"ab":"Transfert","disposal":"Mise à disposition","mixed":"Trajet mixte"}';
begin
  if o.trip_type is distinct from n.trip_type then p := p || ('Type : ' || coalesce(tl ->> o.trip_type, '—') || ' → ' || coalesce(tl ->> n.trip_type, '—')); end if;
  if o.ride_date is distinct from n.ride_date then p := p || ('Date : ' || coalesce(to_char(o.ride_date, 'DD/MM'), '—') || ' → ' || coalesce(to_char(n.ride_date, 'DD/MM'), '—')); end if;
  if left(o.ride_time::text, 5) is distinct from left(n.ride_time::text, 5) then p := p || ('Heure : ' || coalesce(left(o.ride_time::text, 5), '—') || ' → ' || coalesce(left(n.ride_time::text, 5), '—')); end if;
  if o.from_address is distinct from n.from_address then p := p || ('Départ : ' || coalesce(split_part(o.from_address, ',', 1), '—') || ' → ' || coalesce(split_part(n.from_address, ',', 1), '—')); end if;
  if o.to_address is distinct from n.to_address and n.trip_type = 'ab' then p := p || ('Arrivée : ' || coalesce(nullif(split_part(o.to_address, ',', 1), ''), '—') || ' → ' || coalesce(split_part(n.to_address, ',', 1), '—')); end if;
  if o.passengers is distinct from n.passengers then p := p || ('Passagers : ' || coalesce(o.passengers::text, '—') || ' → ' || coalesce(n.passengers::text, '—')); end if;
  if o.vehicle_type is distinct from n.vehicle_type then p := p || ('Gamme : ' || coalesce(lbl ->> o.vehicle_type, '—') || ' → ' || coalesce(lbl ->> n.vehicle_type, '—')); end if;
  if row(coalesce(o.luggage_large, 0), coalesce(o.luggage_small, 0)) is distinct from row(coalesce(n.luggage_large, 0), coalesce(n.luggage_small, 0)) then
    p := p || ('Bagages : ' || coalesce(o.luggage_large, 0) || ' + ' || coalesce(o.luggage_small, 0) || ' → ' || coalesce(n.luggage_large, 0) || ' + ' || coalesce(n.luggage_small, 0));
  end if;
  sa := (regexp_match(coalesce(o.notes, ''), 'Durée:([^\s|,]+)'))[1]; sb := (regexp_match(coalesce(n.notes, ''), 'Durée:([^\s|,]+)'))[1];
  if sa is distinct from sb then p := p || ('Durée : ' || coalesce(sa, '—') || ' → ' || coalesce(sb, '—')); end if;
  if n.trip_type = 'mixed' and regexp_replace(regexp_replace(coalesce(o.notes, ''), '\|[a-z_]{3,}:[^|]*', '', 'g'), '\|(n|fl|tr|fl2|tr2|pn|pt):[^|]*', '', 'g')
       is distinct from regexp_replace(regexp_replace(coalesce(n.notes, ''), '\|[a-z_]{3,}:[^|]*', '', 'g'), '\|(n|fl|tr|fl2|tr2|pn|pt):[^|]*', '', 'g') then
    p := p || 'Trajets modifiés'::text;
  end if;
  return array_to_string(p, ' · ');
end $$;

create or replace function public.api_ride_update(p_ride uuid, p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := _api_uid(); r rides%rowtype; n rides%rowtype; d jsonb; v_offer text; v_res jsonb; v_old int; v_new int; v_reason text; v_drv uuid; v_sig_o text; v_sig_n text; v_chg text;
begin
  select * into r from rides where id = p_ride for update;
  if not found or r.client_id is distinct from uid then raise exception 'Demande introuvable' using errcode = '42501'; end if;
  if r.status not in ('waiting','offers','confirmed','pending_payment') or r.on_way_at is not null or r.pickup_at is not null then
    raise exception 'Cette demande ne peut plus être modifiée' using errcode = '42501';
  end if;
  -- Course confirmée : modifiable uniquement au-delà du délai de remboursement (48 h par défaut)
  if r.status in ('confirmed','pending_payment') and _ride_start(r) is not null
     and _ride_start(r) - _now_bxl() < make_interval(hours => _refund_delay_hours(r)) then
    raise exception 'Moins de % h avant le départ : la course ne peut plus être modifiée.', _refund_delay_hours(r) using errcode = '42501';
  end if;
  if r.change_state = 'withdrawn' then
    raise exception 'Votre chauffeur s''est retiré : choisissez d''abord la suite à donner à votre demande.' using errcode = '42501';
  end if;
  if r.change_state in ('to_review','supplement') then
    raise exception 'Une modification est déjà en attente de la réponse de votre chauffeur.' using errcode = '42501';
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
  -- Mission confirmée modifiée : le chauffeur doit valider (accepter, demander un supplément ou se retirer)
  if r.status = 'confirmed' and r.driver_id is not null then
    v_chg := _mission_changes(r, n);
    if v_chg <> '' then
      perform _api_trusted(true);
      update rides set change_state = 'to_review', change_summary = left(v_chg, 1000), change_at = now(),
                       supp_new_htva = null, supp_amount = null, supp_message = null, supp_deadline = null
       where id = p_ride;
      perform _api_trusted(false);
      perform _api_notify(r.driver_id, 'mission_changed', 'Mission modifiée — à valider',
        'Le client a modifié la mission ' || coalesce(r.booking_code, left(r.id::text, 8)) || ' : ' || v_chg ||
        '. Ouvrez la mission pour accepter, demander un supplément ou vous retirer.', p_ride);
    end if;
  end if;
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

-- ── Réponse du chauffeur à une mission modifiée ──────────────────
create or replace function public.api_mission_reply(p_ride uuid, p_action text, p_price numeric default null, p_message text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := _api_uid(); r rides%rowtype; v_dl timestamptz; v_new numeric; v_supp numeric; v_code text; t text;
begin
  select * into r from rides where id = p_ride for update;
  if not found or r.driver_id is distinct from uid then raise exception 'Mission introuvable' using errcode = '42501'; end if;
  if r.status <> 'confirmed' or r.change_state is distinct from 'to_review' then
    raise exception 'Aucune modification à valider sur cette mission' using errcode = '42501';
  end if;
  v_code := coalesce(r.booking_code, left(r.id::text, 8));
  v_dl := _change_deadline(r);
  if p_action = 'accept' then
    t := _trusted_begin();
    update rides set change_state = null, change_summary = null, change_at = null where id = p_ride;
    perform _trusted_end(t);
    perform _api_notify(r.client_id, 'mission_accepted', 'Modification acceptée',
      'Votre chauffeur a accepté la modification de la course ' || v_code || '. Elle reste confirmée au même prix.', p_ride);
  elsif p_action = 'supplement' then
    if p_price is null or p_price <= 0 or p_price > 100000 then raise exception 'Prix invalide' using errcode = '22023'; end if;
    v_new := round(p_price * 1.06, 2);                       -- TVA 6 % (identique à create-checkout)
    v_supp := round(v_new - coalesce(r.final_price, 0), 2);
    if v_supp < 0.5 then
      raise exception 'Le nouveau prix doit être supérieur au prix déjà payé (% € TVAC, soit % € HTVA).',
        _eur(coalesce(r.final_price, 0)), _eur(coalesce(r.final_price, 0) / 1.06) using errcode = '22023';
    end if;
    if v_dl is null or v_dl <= now() then raise exception 'Trop tard : la course commence dans moins de % h.', _refund_delay_hours(r) using errcode = '42501'; end if;
    t := _trusted_begin();
    update rides set change_state = 'supplement', supp_new_htva = round(p_price, 2), supp_amount = v_supp,
                     supp_message = _api_txt(p_message, 500), supp_deadline = v_dl
     where id = p_ride;
    perform _trusted_end(t);
    perform _api_notify(r.client_id, 'supplement_requested', 'Supplément demandé — ' || _eur(v_supp) || ' €',
      'Suite à votre modification de la course ' || v_code || ', votre chauffeur demande un supplément de ' || _eur(v_supp) ||
      ' € (nouveau total ' || _eur(v_new) || ' € TVAC). Répondez avant le ' || to_char(v_dl at time zone 'Europe/Brussels', 'DD/MM à HH24:MI') ||
      ', sinon la course sera annulée et remboursée.', p_ride);
  elsif p_action = 'withdraw' then
    t := _trusted_begin();
    update rides set change_state = 'withdrawn', supp_message = _api_txt(p_message, 500), supp_deadline = v_dl,
                     supp_new_htva = null, supp_amount = null
     where id = p_ride;
    perform _trusted_end(t);
    perform _api_notify(r.client_id, 'driver_withdrew', 'Votre chauffeur s’est retiré',
      'Suite à votre modification de la course ' || v_code || ', votre chauffeur ne peut plus l’assurer. Choisissez : republier votre demande ou l’annuler (remboursement intégral).', p_ride);
  else
    raise exception 'Action inconnue' using errcode = '22023';
  end if;
  return jsonb_build_object('state', (select change_state from rides where id = p_ride));
end $$;
revoke all on function public.api_mission_reply(uuid, text, numeric, text) from public, anon;
grant execute on function public.api_mission_reply(uuid, text, numeric, text) to authenticated;

-- ── Le client refuse le supplément (ou le chauffeur s'est retiré) ──
--  cancel           : course annulée, remboursement intégral
--  republish_refund : course annulée et remboursée ; nouvelle demande identique publiée
--  republish_credit : course annulée ; nouvelle demande publiée avec le montant payé en crédit
create or replace function public.api_change_decline(p_ride uuid, p_choice text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := _api_uid(); r rides%rowtype; v_new jsonb; v_id uuid; v_credit numeric; t text; v_notes text;
begin
  select * into r from rides where id = p_ride for update;
  if not found or r.client_id is distinct from uid then raise exception 'Demande introuvable' using errcode = '42501'; end if;
  if r.status <> 'confirmed' or coalesce(r.change_state, '') not in ('supplement','withdrawn') then
    raise exception 'Aucune décision à prendre sur cette course' using errcode = '42501';
  end if;
  if p_choice not in ('cancel','republish_refund','republish_credit') then raise exception 'Choix invalide' using errcode = '22023'; end if;
  if p_choice = 'republish_credit' and (r.final_price is null or r.payment_method not in ('stripe','bank_transfer')) then
    raise exception 'Aucun paiement à reporter en crédit' using errcode = '22023';
  end if;

  update rides set status = 'cancelled' where id = p_ride;
  t := _trusted_begin();
  update rides set change_state = null, supp_amount = null, supp_new_htva = null, supp_deadline = null,
                   payment_method = case when p_choice = 'republish_credit' then 'credit' else payment_method end
   where id = p_ride;
  perform _trusted_end(t);

  if p_choice <> 'cancel' then
    v_notes := nullif(regexp_replace(coalesce(r.notes, ''), '\|(note_drv|offer_note):[^|]*', '', 'g'), '');
    v_new := api_ride_create(jsonb_build_object('trip_type', r.trip_type, 'from_address', r.from_address, 'to_address', r.to_address,
               'ride_date', r.ride_date, 'ride_time', left(r.ride_time::text, 5), 'passengers', r.passengers, 'vehicle_type', r.vehicle_type,
               'notes', v_notes, 'luggage_large', r.luggage_large, 'luggage_small', r.luggage_small));
    v_id := (v_new ->> 'id')::uuid;
    if p_choice = 'republish_credit' then
      v_credit := r.final_price;
      t := _trusted_begin();
      update rides set credit_amount = v_credit, credit_from = p_ride, credit_method = r.payment_method where id = v_id;
      perform _trusted_end(t);
    end if;
  end if;

  perform _api_notify(r.driver_id, 'ride_cancelled', 'Mission annulée',
    'Le client a annulé la mission ' || coalesce(r.booking_code, left(r.id::text, 8)) ||
    case when p_choice = 'cancel' then '.' else ' et republié sa demande (' || coalesce(v_new ->> 'booking_code', '') || ') : vous pouvez y refaire une offre.' end, p_ride);
  return jsonb_build_object('new_ride', v_id, 'booking_code', v_new ->> 'booking_code', 'credit', v_credit);
end $$;
revoke all on function public.api_change_decline(uuid, text) from public, anon;
grant execute on function public.api_change_decline(uuid, text) to authenticated;

-- ── Paiement du supplément (appelé par verify-checkout / stripe-webhook) ──
create or replace function public.confirm_supplement_payment(p_session text, p_ride uuid, p_amount numeric)
returns table(result text, driver uuid) language plpgsql security definer set search_path = public as $$
declare r rides%rowtype; v_prev text;
begin
  select * into r from rides where id = p_ride for update;
  if not found then return query select 'not_confirmable'::text, null::uuid; return; end if;
  select c.status into v_prev from ride_checkouts c where c.session_id = p_session;
  if v_prev = 'paid' then return query select 'already'::text, r.driver_id; return; end if;
  if v_prev = 'refunded' then return query select 'refunded'::text, null::uuid; return; end if;
  if r.status <> 'confirmed' or r.change_state is distinct from 'supplement' or abs(coalesce(r.supp_amount, 0) - p_amount) > 0.01 then
    return query select 'not_confirmable'::text, null::uuid; return;
  end if;
  update offers set price = r.supp_new_htva where ride_id = p_ride and status = 'accepted' and r.supp_new_htva is not null;
  update rides set final_price = round(coalesce(final_price, 0) + p_amount, 2), change_state = null, change_summary = null, change_at = null,
                   supp_amount = null, supp_new_htva = null, supp_message = null, supp_deadline = null
   where id = p_ride;
  insert into ride_checkouts (session_id, ride_id, offer_id, amount, status, updated_at)
  values (p_session, p_ride, null, p_amount, 'paid', now())
  on conflict (session_id) do update set status = 'paid', amount = excluded.amount, updated_at = now();
  perform _api_notify(r.driver_id, 'supplement_paid', 'Supplément payé',
    'Le client a payé le supplément de ' || _eur(p_amount) || ' € pour la mission ' || coalesce(r.booking_code, left(r.id::text, 8)) ||
    '. La mission est confirmée avec ses modifications.', p_ride);
  return query select 'confirmed'::text, r.driver_id;
end $$;
revoke all on function public.confirm_supplement_payment(text, uuid, numeric) from public, anon, authenticated;
grant execute on function public.confirm_supplement_payment(text, uuid, numeric) to service_role;

-- ── Paiement d'une offre : le crédit éventuel s'ajoute au montant payé ──
create or replace function public.confirm_ride_payment(p_session text, p_ride uuid, p_offer uuid, p_amount numeric)
returns table(result text, driver uuid) language plpgsql security definer set search_path = public as $$
declare v_ride rides%rowtype; v_off offers%rowtype; v_prev text;
begin
  select * into v_ride from rides where id = p_ride for update;
  if not found then return query select 'not_confirmable'::text, null::uuid; return; end if;
  select c.status into v_prev from ride_checkouts c where c.session_id = p_session;
  if v_prev = 'paid' then return query select 'already'::text, v_ride.driver_id; return; end if;
  if v_prev = 'refunded' then return query select 'refunded'::text, null::uuid; return; end if;
  if exists (select 1 from ride_checkouts c where c.ride_id = p_ride and c.status = 'paid' and c.session_id <> p_session) then
    return query select 'duplicate'::text, null::uuid; return;
  end if;
  select * into v_off from offers where id = p_offer and ride_id = p_ride;
  if not found or v_ride.status not in ('waiting','offers') then
    return query select 'not_confirmable'::text, null::uuid; return;
  end if;
  perform _confirm_offer(v_ride, v_off, round(p_amount + coalesce(v_ride.credit_amount, 0), 2), 'stripe');
  insert into ride_checkouts (session_id, ride_id, offer_id, amount, status, updated_at)
  values (p_session, p_ride, p_offer, p_amount, 'paid', now())
  on conflict (session_id) do update set status = 'paid', amount = excluded.amount, updated_at = now();
  return query select 'confirmed'::text, v_off.driver_id;
end $$;
revoke all on function public.confirm_ride_payment(text, uuid, uuid, numeric) from public, anon, authenticated;
grant execute on function public.confirm_ride_payment(text, uuid, uuid, numeric) to service_role;

-- Confirmation commune (offre retenue, note au chauffeur)
create or replace function public._confirm_offer(v_ride public.rides, v_off public.offers, p_total numeric, p_method text)
returns void language plpgsql security definer set search_path = public as $$
begin
  update offers set status = 'accepted' where id = v_off.id;
  update offers set status = 'rejected' where ride_id = v_ride.id and id <> v_off.id;
  update rides set status = 'confirmed', driver_id = v_off.driver_id, final_price = p_total, payment_method = p_method
   where id = v_ride.id;
  update rides r set notes = coalesce(r.notes,'') || '|note_drv:' || x.c
    from (select trim(regexp_replace(regexp_replace(regexp_replace(coalesce(notes,''),
                 '\|(pax|tel|pemail|pref|flight|train):[^|]*', '', 'g'),
                 '^Mixte:.*$', '', 'n'),
                 'Durée:[^\s|]+', '', 'g')) as c
            from rides where id = v_ride.id) x
   where r.id = v_ride.id and coalesce(r.notes,'') !~ '\|note_drv:' and x.c <> '';
end $$;
revoke all on function public._confirm_offer(public.rides, public.offers, numeric, text) from public, anon, authenticated;

-- Offre entièrement couverte par le crédit : confirmée sans paiement (appelé par create-checkout)
create or replace function public.confirm_ride_credit(p_ride uuid, p_offer uuid)
returns table(result text, driver uuid) language plpgsql security definer set search_path = public as $$
declare v_ride rides%rowtype; v_off offers%rowtype; v_tvac numeric; v_excess numeric;
begin
  select * into v_ride from rides where id = p_ride for update;
  select * into v_off from offers where id = p_offer and ride_id = p_ride;
  if v_ride.id is null or v_off.id is null or v_ride.status not in ('waiting','offers') or v_off.status <> 'pending' or v_off.outdated_at is not null then
    return query select 'not_confirmable'::text, null::uuid; return;
  end if;
  v_tvac := round(v_off.price * 1.06, 2);
  if coalesce(v_ride.credit_amount, 0) < v_tvac then return query select 'not_enough'::text, null::uuid; return; end if;
  perform _confirm_offer(v_ride, v_off, v_tvac, coalesce(v_ride.credit_method, 'stripe'));
  -- Trop-perçu : la course d'origine redevient remboursable pour la différence
  v_excess := round(v_ride.credit_amount - v_tvac, 2);
  if v_excess >= 0.01 and v_ride.credit_from is not null then
    update rides set final_price = v_excess, payment_method = coalesce(v_ride.credit_method, 'stripe')
     where id = v_ride.credit_from and payment_method = 'credit';
  end if;
  return query select 'confirmed'::text, v_off.driver_id;
end $$;
revoke all on function public.confirm_ride_credit(uuid, uuid) from public, anon, authenticated;
grant execute on function public.confirm_ride_credit(uuid, uuid) to service_role;

-- Demande avec crédit annulée / expirée avant paiement : le crédit est remboursé
create or replace function public.trg_rides_credit_release()
returns trigger language plpgsql security definer set search_path = public as $$
declare t text;
begin
  if new.status = 'cancelled' and old.status in ('waiting','offers') and new.credit_from is not null and coalesce(new.credit_amount, 0) > 0 then
    t := _trusted_begin();
    update rides set payment_method = coalesce(new.credit_method, 'stripe') where id = new.credit_from and payment_method = 'credit';
    perform _trusted_end(t);
  end if;
  return new;
end $$;
drop trigger if exists z_rides_credit_release on public.rides;
create trigger z_rides_credit_release after update of status on public.rides
  for each row execute function public.trg_rides_credit_release();

-- Pas de départ (« En chemin », pick up…) tant que le chauffeur n'a pas répondu à la modification ou s'est retiré
create or replace function public.trg_rides_change_block_steps()
returns trigger language plpgsql set search_path = public as $$
begin
  if old.change_state in ('to_review','withdrawn')
     and (new.on_way_at is distinct from old.on_way_at or new.pickup_at is distinct from old.pickup_at
          or (new.status in ('active','done') and new.status is distinct from old.status)) then
    raise exception 'Répondez d''abord à la modification du client (accepter, supplément ou retrait).' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists b_rides_change_block_steps on public.rides;
create trigger b_rides_change_block_steps before update on public.rides
  for each row execute function public.trg_rides_change_block_steps();

-- ── Délais dépassés ──────────────────────────────────────────────
--  supplément / chauffeur retiré sans réponse du client → annulée, remboursable
--  modification non traitée par le chauffeur → acceptée au même prix
create or replace function public.expire_mission_changes()
returns int language plpgsql security definer set search_path = public as $$
declare r rides%rowtype; n int := 0; t text; me uuid := auth.uid();
begin
  for r in select * from rides
            where status = 'confirmed' and change_state in ('supplement','withdrawn') and supp_deadline < now()
              and (me is null or client_id = me) for update skip locked loop
    t := _trusted_begin();
    update rides set status = 'cancelled', change_state = null, supp_amount = null, supp_new_htva = null where id = r.id;
    perform _trusted_end(t);
    perform _api_notify(r.client_id, 'ride_cancelled', 'Course annulée',
      'Sans réponse avant le délai, la course ' || coalesce(r.booking_code, left(r.id::text, 8)) || ' a été annulée. Vous serez remboursé intégralement.', r.id);
    perform _api_notify(r.driver_id, 'ride_cancelled', 'Mission annulée',
      'Le client n’a pas répondu avant le délai : la mission ' || coalesce(r.booking_code, left(r.id::text, 8)) || ' est annulée.', r.id);
    n := n + 1;
  end loop;
  for r in select * from rides
            where status = 'confirmed' and change_state = 'to_review' and _change_deadline(rides) < now()
              and (me is null or client_id = me or driver_id = me) for update skip locked loop
    t := _trusted_begin();
    update rides set change_state = null where id = r.id;
    perform _trusted_end(t);
    n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function public.expire_mission_changes() from public, anon;
grant execute on function public.expire_mission_changes() to authenticated, service_role;

-- Toutes les 10 minutes (si l'extension pg_cron est activée : Database › Extensions › pg_cron)
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'bleenr_expire_mission_changes';
    perform cron.schedule('bleenr_expire_mission_changes', '*/10 * * * *', 'select public.expire_mission_changes()');
  end if;
exception when others then raise notice 'pg_cron : %', sqlerrm;
end $$;

notify pgrst, 'reload schema';
