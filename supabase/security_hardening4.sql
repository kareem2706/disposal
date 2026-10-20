-- ════════════════════════════════════════════════════════════════
-- SÉCURITÉ — résultat du contrôle du 20/10/2026 (4e partie).
-- À exécuter APRÈS security_hardening3.sql. Peut être relancé sans risque.
--  1. CRITIQUE : un client pouvait modifier le prix d'une offre reçue
--     (et donc payer moins cher)
--  2. Seules les fleets VALIDÉES par Bleenr peuvent faire une offre ou
--     accepter une sous-traitance
--  3. La fleet attribuée ne peut pas modifier le trajet, la date, l'heure…
--     de la demande du client (seulement sa note et les étapes de mission)
--  4. Fonctions serveur : plus aucune n'est appelable sans connexion ;
--     _ride_assignment_data (téléphone du chauffeur de n'importe quelle
--     course) et auto_process_rides ne sont plus appelables par l'app
--  5. Factures : un client ne peut numéroter une facture que d'une fleet
--     avec qui il a eu une course
--  6. Tables : plus aucun droit pour les visiteurs non connectés
-- ════════════════════════════════════════════════════════════════

-- ────────────────────────────────────────────────────────────────
-- 1. OFFRES : seul le chauffeur auteur modifie son offre
-- ────────────────────────────────────────────────────────────────
drop policy if exists "Clients update offers" on public.offers;

-- ────────────────────────────────────────────────────────────────
-- 2. FLEETS VALIDÉES
-- ────────────────────────────────────────────────────────────────
create or replace function public.is_validated_fleet()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'driver' and fleet_verified = 'validated');
$$;
revoke all on function public.is_validated_fleet() from public, anon;
grant execute on function public.is_validated_fleet() to authenticated;

create or replace function public.trg_offers_guard()
returns trigger language plpgsql set search_path = public as $$
begin
  if not public._is_app_user() then return new; end if;
  if tg_op = 'INSERT' then
    if coalesce(new.status,'pending') <> 'pending' or new.driver_id is distinct from auth.uid() then
      raise exception 'Offre invalide' using errcode = '42501';
    end if;
    if not public.is_validated_fleet() then
      raise exception 'Votre flotte doit être validée par Bleenr avant de faire une offre' using errcode = '42501';
    end if;
    if not exists (select 1 from rides r where r.id = new.ride_id
                     and r.status in ('waiting','offers') and r.client_id <> auth.uid()) then
      raise exception 'Cette demande n''est plus ouverte aux offres' using errcode = '42501';
    end if;
    return new;
  end if;
  if old.driver_id is distinct from auth.uid() then
    raise exception 'Seule la fleet auteur peut modifier son offre' using errcode = '42501';
  end if;
  if new.status is distinct from old.status then
    raise exception 'Le statut d''une offre est géré par le serveur' using errcode = '42501';
  end if;
  if new.price is distinct from old.price and old.status <> 'pending' then
    raise exception 'Offre déjà traitée' using errcode = '42501';
  end if;
  if new.driver_id is distinct from old.driver_id or new.ride_id is distinct from old.ride_id then
    raise exception 'Offre invalide' using errcode = '42501';
  end if;
  return new;
end $$;

create or replace function public.accept_subcontract(p_ride uuid)
returns boolean
language plpgsql security definer set search_path = public
as $$
begin
  if not is_validated_fleet() then
    raise exception 'Votre flotte doit être validée par Bleenr' using errcode = '42501';
  end if;
  update rides set status = 'confirmed', driver_id = auth.uid()
   where id = p_ride
     and is_subcontract = true
     and status in ('waiting','offers')
     and client_id <> auth.uid();
  return found;
end $$;
revoke all on function public.accept_subcontract(uuid) from public, anon;
grant execute on function public.accept_subcontract(uuid) to authenticated;

-- ────────────────────────────────────────────────────────────────
-- 3. LA FLEET NE MODIFIE PAS LA DEMANDE DU CLIENT
-- ────────────────────────────────────────────────────────────────
create or replace function public.trg_rides_driver_fields_guard()
returns trigger language plpgsql set search_path = public as $$
declare jn jsonb := to_jsonb(new); jo jsonb := to_jsonb(old); k text;
begin
  if not public._is_user_not_admin() or old.status = 'personal'
     or old.driver_id is distinct from auth.uid() or old.client_id = auth.uid() then
    return new;
  end if;
  foreach k in array array['from_address','to_address','ride_date','ride_time','passengers',
                           'vehicle_type','trip_type','booking_code','is_subcontract'] loop
    if (jn -> k) is distinct from (jo -> k) then
      raise exception 'Seul le client peut modifier les détails de sa demande' using errcode = '42501';
    end if;
  end loop;
  return new;
end $$;

drop trigger if exists a_rides_driver_fields_guard on public.rides;
create trigger a_rides_driver_fields_guard
  before update on public.rides
  for each row execute function public.trg_rides_driver_fields_guard();

-- ────────────────────────────────────────────────────────────────
-- 4. FONCTIONS SERVEUR
-- ────────────────────────────────────────────────────────────────
do $$
declare f text;
begin
  -- utilisées uniquement par la base (déclencheurs, tâches planifiées)
  foreach f in array array['public._ride_assignment_data(uuid)', 'public.auto_process_rides()'] loop
    if to_regprocedure(f) is not null then
      execute format('revoke all on function %s from public, anon, authenticated', f);
    end if;
  end loop;
  -- appelées par l'app : connectés uniquement
  foreach f in array array['public.apply_signup_role(text, text, text)',
                           'public.fleet_update_assignment(uuid, uuid, uuid)',
                           'public.invoice_parties(uuid[])',
                           'public.update_driver_rating(uuid)',
                           'public.invoice_number(uuid, uuid, text, text, numeric, numeric, numeric, numeric, boolean, integer)'] loop
    if to_regprocedure(f) is not null then
      execute format('revoke all on function %s from public, anon', f);
      execute format('grant execute on function %s to authenticated', f);
    end if;
  end loop;
end $$;

-- ────────────────────────────────────────────────────────────────
-- 5. FACTURES : numéro demandé par un client = fleet avec qui il a roulé
-- ────────────────────────────────────────────────────────────────
create or replace function public.invoice_number(p_fleet uuid, p_client uuid, p_period text, p_kind text,
  p_htva numeric, p_vat_rate numeric, p_vat numeric, p_tvac numeric, p_rc boolean, p_count integer)
returns text
language plpgsql security definer set search_path = public
as $$
declare v_num text; v_pre text;
begin
  if not ((auth.jwt() ->> 'email') = 'kb@bleenr.com' or auth.uid() = p_fleet
          or (p_kind = 'prestation' and auth.uid() = p_client
              and exists (select 1 from rides r where r.client_id = p_client and r.driver_id = p_fleet))) then
    raise exception 'non autorisé';
  end if;
  select number into v_num from fleet_invoices
   where fleet_id = p_fleet and period = p_period and kind = p_kind
     and client_id is not distinct from p_client;
  if v_num is not null then
    update fleet_invoices set amount_htva = p_htva, vat_rate = p_vat_rate, vat_amount = p_vat,
           amount_tvac = p_tvac, reverse_charge = p_rc, rides_count = p_count
     where number = v_num;
    return v_num;
  end if;
  v_pre := 'BL-' || case when p_kind = 'prestation' then 'P' else 'C' end || '-' || left(p_period, 4) || '-';
  perform pg_advisory_xact_lock(hashtext(v_pre));
  select v_pre || lpad((count(*) + 1)::text, 4, '0') into v_num from fleet_invoices where number like v_pre || '%';
  insert into fleet_invoices (fleet_id, client_id, period, kind, number, rides_count,
                              amount_htva, vat_rate, vat_amount, amount_tvac, reverse_charge)
  values (p_fleet, p_client, p_period, p_kind, v_num, p_count, p_htva, p_vat_rate, p_vat, p_tvac, p_rc);
  return v_num;
end $$;
revoke all on function public.invoice_number(uuid, uuid, text, text, numeric, numeric, numeric, numeric, boolean, integer) from public, anon;
grant execute on function public.invoice_number(uuid, uuid, text, text, numeric, numeric, numeric, numeric, boolean, integer) to authenticated;

-- ────────────────────────────────────────────────────────────────
-- 6. TABLES : aucun droit sans connexion ; jamais de TRUNCATE
-- ────────────────────────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['billing_settings','driver_documents','fleet_documents','fleet_drivers',
                           'fleet_invoices','fleet_vehicles','notifications','offers','passengers',
                           'push_tokens','ratings','ride_locations','ride_reports','vehicle_documents',
                           'rides','profiles','ride_private','ride_checkouts'] loop
    if to_regclass('public.'||t) is not null then
      execute format('revoke all on public.%I from anon', t);
      execute format('revoke truncate on public.%I from authenticated', t);
    end if;
  end loop;
end $$;

notify pgrst, 'reload schema';
