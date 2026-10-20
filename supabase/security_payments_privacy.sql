-- ════════════════════════════════════════════════════════════════
-- SÉCURITÉ — 19/10/2026
--  A. Infos passager (nom, téléphone, email) masquées aux fleets tant
--     que la course n'est pas confirmée.
--  B. Confirmation de course / paiement uniquement côté serveur :
--     un client ne peut plus passer sa course en « confirmée » lui-même,
--     ni changer le prix, la fleet ou le mode de paiement.
-- À exécuter APRÈS security_rides_rls.sql. Peut être relancé sans risque.
-- ════════════════════════════════════════════════════════════════

-- ────────────────────────────────────────────────────────────────
-- A. INFOS PASSAGER PRIVÉES
-- ────────────────────────────────────────────────────────────────
create table if not exists public.ride_private (
  ride_id    uuid primary key,
  client_id  uuid,
  tokens     text not null default '',     -- ex. "|pax:Marc Debast|tel:+324..."
  updated_at timestamptz not null default now()
);
alter table public.ride_private enable row level security;

drop policy if exists ride_private_read on public.ride_private;
create policy ride_private_read on public.ride_private
  for select to authenticated
  using (client_id = auth.uid() or (auth.jwt() ->> 'email') = 'kb@bleenr.com');
revoke all on public.ride_private from anon;
revoke insert, update, delete on public.ride_private from authenticated;
grant select on public.ride_private to authenticated;
grant all on public.ride_private to service_role;
-- (aucune écriture directe : seul le trigger ci-dessous écrit dans cette table)

-- Extrait les jetons sensibles d'une note
create or replace function public._ride_priv_extract(p_notes text)
returns text language sql immutable as $$
  select coalesce(string_agg(m[1], '' order by ord), '')
  from regexp_matches(coalesce(p_notes,''), '(\|(?:pax|tel|pemail):[^|]*)', 'g') with ordinality as t(m, ord);
$$;

-- Retire les jetons sensibles d'une note
create or replace function public._ride_priv_strip(p_notes text)
returns text language sql immutable as $$
  select nullif(regexp_replace(coalesce(p_notes,''), '\|(pax|tel|pemail):[^|]*', '', 'g'), '');
$$;

-- Fusionne deux listes de jetons (les nouveaux remplacent les anciens de même clé)
create or replace function public._ride_priv_merge(p_old text, p_new text)
returns text language plpgsql immutable as $$
declare k text; res text := coalesce(p_old,'');
begin
  foreach k in array array['pax','tel','pemail'] loop
    if coalesce(p_new,'') ~ ('\|'||k||':') then
      res := regexp_replace(res, '\|'||k||':[^|]*', '', 'g')
          || coalesce((regexp_match(p_new, '(\|'||k||':[^|]*)'))[1], '');
    end if;
  end loop;
  return res;
end $$;

create or replace function public.trg_rides_private()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare v_tok text; v_saved text; k text;
begin
  if new.status in ('waiting','offers') then
    -- Course pas encore attribuée : les infos passager partent dans ride_private
    v_tok := _ride_priv_extract(new.notes);
    if v_tok <> '' then
      insert into ride_private as p (ride_id, client_id, tokens, updated_at)
      values (new.id, new.client_id, v_tok, now())
      on conflict (ride_id) do update
        set tokens = _ride_priv_merge(p.tokens, excluded.tokens),
            client_id = excluded.client_id, updated_at = now();
      new.notes := _ride_priv_strip(new.notes);
    end if;
  elsif new.status not in ('cancelled','personal') then
    -- Course confirmée : on remet les infos passager dans la note (fleet attribuée)
    select tokens into v_saved from ride_private where ride_id = new.id;
    if coalesce(v_saved,'') <> '' then
      -- n'ajoute que les clés absentes de la note
      foreach k in array array['pax','tel','pemail'] loop
        if coalesce(new.notes,'') !~ ('\|'||k||':') then
          new.notes := coalesce(new.notes,'') || coalesce((regexp_match(v_saved, '(\|'||k||':[^|]*)'))[1], '');
        end if;
      end loop;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists b_rides_private on public.rides;
create trigger b_rides_private
  before insert or update on public.rides
  for each row execute function public.trg_rides_private();

-- Les fleets dont l'offre a été refusée ne voient plus la course
create or replace function public.has_offer_on_ride(p_ride uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from offers
                 where ride_id = p_ride and driver_id = auth.uid()
                   and coalesce(status,'pending') <> 'rejected');
$$;

-- ────────────────────────────────────────────────────────────────
-- B. GARDE-FOUS SUR rides ET offers
-- (s'appliquent aux requêtes de l'app ; les fonctions serveur
--  "security definer", l'admin et les Edge Functions ne sont pas bloqués)
-- ────────────────────────────────────────────────────────────────
create or replace function public._is_app_user()
returns boolean language sql stable as $$
  select current_user in ('authenticated','anon')
     and coalesce(auth.jwt() ->> 'email','') <> 'kb@bleenr.com';
$$;

create or replace function public.trg_rides_guard()
returns trigger language plpgsql as $$
begin
  if not _is_app_user() then return new; end if;

  if tg_op = 'INSERT' then
    if new.status = 'personal' then
      if new.driver_id is distinct from auth.uid() then
        raise exception 'Mission personnelle : chauffeur invalide' using errcode = '42501';
      end if;
      return new;
    end if;
    if new.status is distinct from 'waiting' then
      raise exception 'Une nouvelle demande doit être en attente' using errcode = '42501';
    end if;
    if new.client_id is distinct from auth.uid() then
      raise exception 'Demande au nom d''un autre utilisateur' using errcode = '42501';
    end if;
    if new.driver_id is not null or new.payment_method is not null then
      raise exception 'Champs réservés au serveur' using errcode = '42501';
    end if;
    if new.final_price is not null and not coalesce(new.is_subcontract,false) then
      raise exception 'Le prix est fixé par l''offre acceptée' using errcode = '42501';
    end if;
    return new;
  end if;

  -- UPDATE
  if old.status = 'personal' then
    if new.status is distinct from 'personal' or new.driver_id is distinct from old.driver_id then
      raise exception 'Mission personnelle non modifiable ainsi' using errcode = '42501';
    end if;
    return new;
  end if;

  if new.client_id is distinct from old.client_id
     or new.driver_id is distinct from old.driver_id
     or new.is_subcontract is distinct from old.is_subcontract then
    raise exception 'Champs réservés au serveur' using errcode = '42501';
  end if;

  if new.final_price is distinct from old.final_price
     and not (coalesce(old.is_subcontract,false) and old.status in ('waiting','offers')) then
    raise exception 'Le prix ne peut pas être modifié' using errcode = '42501';
  end if;

  if new.payment_method is distinct from old.payment_method
     and not (new.status = 'cancelled' and new.payment_method = 'non_refundable') then
    raise exception 'Mode de paiement réservé au serveur' using errcode = '42501';
  end if;

  if new.status is distinct from old.status and not (
       (old.status in ('waiting','offers') and new.status in ('waiting','offers','cancelled'))
    or (old.status in ('confirmed','pending_payment') and new.status = 'cancelled')
    or (old.status = 'confirmed' and new.status in ('active','done'))
    or (old.status = 'active' and new.status = 'done')
  ) then
    raise exception 'Changement de statut non autorisé (% → %)', old.status, new.status using errcode = '42501';
  end if;

  return new;
end $$;

drop trigger if exists a_rides_guard on public.rides;
create trigger a_rides_guard
  before insert or update on public.rides
  for each row execute function public.trg_rides_guard();

create or replace function public.trg_offers_guard()
returns trigger language plpgsql as $$
begin
  if not _is_app_user() then return new; end if;
  if tg_op = 'INSERT' then
    if coalesce(new.status,'pending') <> 'pending' or new.driver_id is distinct from auth.uid() then
      raise exception 'Offre invalide' using errcode = '42501';
    end if;
    return new;
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

drop trigger if exists a_offers_guard on public.offers;
create trigger a_offers_guard
  before insert or update on public.offers
  for each row execute function public.trg_offers_guard();

-- ────────────────────────────────────────────────────────────────
-- C. FONCTIONS SERVEUR
-- ────────────────────────────────────────────────────────────────

-- Confirme une course après paiement vérifié (appelée par l'Edge Function
-- verify-checkout avec la clé service_role — jamais par le navigateur)
create or replace function public.confirm_ride_offer(p_ride uuid, p_offer uuid, p_amount numeric, p_method text default 'stripe')
returns uuid
language plpgsql security definer set search_path = public
as $$
declare v_ride rides%rowtype; v_off offers%rowtype;
begin
  select * into v_ride from rides where id = p_ride for update;
  if not found then raise exception 'Course introuvable'; end if;
  select * into v_off from offers where id = p_offer and ride_id = p_ride;
  if not found then raise exception 'Offre introuvable pour cette course'; end if;

  -- Déjà confirmée avec cette offre : rien à faire (appel répété)
  if v_ride.status in ('confirmed','pending_payment','active','done') and v_ride.driver_id = v_off.driver_id then
    return v_off.driver_id;
  end if;
  if v_ride.status not in ('waiting','offers') then
    raise exception 'Course non confirmable (statut %)', v_ride.status;
  end if;

  update offers set status = 'accepted' where id = p_offer;
  update offers set status = 'rejected' where ride_id = p_ride and id <> p_offer;
  update rides set
    status = case when p_method = 'bank_transfer' then 'pending_payment' else 'confirmed' end,
    driver_id = v_off.driver_id,
    final_price = p_amount,
    payment_method = p_method
  where id = p_ride;
  return v_off.driver_id;
end $$;
revoke all on function public.confirm_ride_offer(uuid, uuid, numeric, text) from public, anon, authenticated;
grant execute on function public.confirm_ride_offer(uuid, uuid, numeric, text) to service_role;

-- Une fleet accepte une course sous-traitée (prix fixé par le donneur d'ordre)
create or replace function public.accept_subcontract(p_ride uuid)
returns boolean
language plpgsql security definer set search_path = public
as $$
begin
  if not is_fleet() then raise exception 'Réservé aux fleets' using errcode = '42501'; end if;
  update rides set status = 'confirmed', driver_id = auth.uid()
   where id = p_ride
     and is_subcontract = true
     and status in ('waiting','offers')
     and client_id <> auth.uid();
  return found;
end $$;
revoke all on function public.accept_subcontract(uuid) from public, anon;
grant execute on function public.accept_subcontract(uuid) to authenticated;

-- Admin : valider un virement reçu (pending_payment → confirmed) passe déjà
-- par la règle admin ; rien à ajouter.

-- ────────────────────────────────────────────────────────────────
-- D. Applique le masquage aux demandes déjà en attente
-- ────────────────────────────────────────────────────────────────
update public.rides set notes = notes
 where status in ('waiting','offers') and notes ~ '\|(pax|tel|pemail):';

notify pgrst, 'reload schema';
