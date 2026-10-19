-- ════════════════════════════════════════════════════════════════
-- SÉCURITÉ — audit du 19/10/2026, 2e partie (après security_hardening.sql)
-- Peut être relancé sans risque.
--  1. Validation (documents, véhicules, chauffeurs) réservée à l'admin ;
--     un document remplacé repasse « en attente »
--  2. Notes : seulement par le client d'une course terminée, avec cette fleet
--  3. Offres : seulement par une fleet, sur une demande ouverte, pas la sienne
--  4. Fonction utilisée par l'envoi d'emails (send-mail)
-- ════════════════════════════════════════════════════════════════

-- ────────────────────────────────────────────────────────────────
-- 1. STATUT DE VALIDATION
-- ────────────────────────────────────────────────────────────────
create or replace function public.trg_validation_guard()
returns trigger language plpgsql as $$
declare jn jsonb := to_jsonb(new); jo jsonb;
begin
  if not public._is_app_user() or not (jn ? 'status') then return new; end if;

  if tg_op = 'INSERT' then
    -- tout nouvel élément attend la validation de l'admin
    new := jsonb_populate_record(new, jsonb_set(jn, '{status}', '"pending"'));
    return new;
  end if;

  jo := to_jsonb(old);
  if (jn->>'status') is distinct from (jo->>'status') then
    raise exception 'La validation est faite par l''administrateur' using errcode = '42501';
  end if;
  -- document remplacé : il doit être revalidé
  if jn ? 'file_url' and (jn->>'file_url') is distinct from (jo->>'file_url') then
    new := jsonb_populate_record(new, jsonb_set(jn, '{status}', '"pending"'));
  end if;
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['fleet_documents','fleet_vehicles','fleet_drivers','driver_documents','vehicle_documents'] loop
    if to_regclass('public.'||t) is not null then
      execute format('drop trigger if exists a_validation_guard on public.%I', t);
      execute format('create trigger a_validation_guard before insert or update on public.%I
                      for each row execute function public.trg_validation_guard()', t);
    end if;
  end loop;
end $$;

-- ────────────────────────────────────────────────────────────────
-- 2. NOTES
-- ────────────────────────────────────────────────────────────────
create or replace function public.trg_ratings_guard()
returns trigger language plpgsql set search_path = public as $$
begin
  if not public._is_app_user() then return new; end if;
  if new.client_id is distinct from auth.uid() then
    raise exception 'Note au nom d''un autre client' using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' and (new.ride_id is distinct from old.ride_id or new.driver_id is distinct from old.driver_id) then
    raise exception 'Note : course ou fleet non modifiable' using errcode = '42501';
  end if;
  if new.score is null or new.score < 1 or new.score > 5 then
    raise exception 'La note doit être comprise entre 1 et 5' using errcode = '22023';
  end if;
  if not exists (select 1 from rides r
                  where r.id = new.ride_id and r.client_id = auth.uid()
                    and r.driver_id = new.driver_id and r.status = 'done') then
    raise exception 'Seule une course terminée peut être notée' using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists a_ratings_guard on public.ratings;
create trigger a_ratings_guard before insert or update on public.ratings
  for each row execute function public.trg_ratings_guard();

-- ────────────────────────────────────────────────────────────────
-- 3. OFFRES (remplace la version de security_payments_privacy.sql)
-- ────────────────────────────────────────────────────────────────
create or replace function public.trg_offers_guard()
returns trigger language plpgsql set search_path = public as $$
begin
  if not public._is_app_user() then return new; end if;
  if tg_op = 'INSERT' then
    if coalesce(new.status,'pending') <> 'pending' or new.driver_id is distinct from auth.uid() then
      raise exception 'Offre invalide' using errcode = '42501';
    end if;
    if not public.is_fleet() then
      raise exception 'Seules les fleets peuvent faire une offre' using errcode = '42501';
    end if;
    if not exists (select 1 from rides r where r.id = new.ride_id
                     and r.status in ('waiting','offers') and r.client_id <> auth.uid()) then
      raise exception 'Cette demande n''est plus ouverte aux offres' using errcode = '42501';
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

-- ────────────────────────────────────────────────────────────────
-- 4. EMAILS : deux utilisateurs sont-ils liés par une course ?
-- (appelée par l'Edge Function send-mail avec la clé service_role)
-- ────────────────────────────────────────────────────────────────
create or replace function public.users_linked(p_a uuid, p_b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select p_a = p_b or exists (
    select 1 from rides r
     where (r.client_id = p_a and (r.driver_id = p_b
              or exists (select 1 from offers o where o.ride_id = r.id and o.driver_id = p_b)))
        or (r.client_id = p_b and (r.driver_id = p_a
              or exists (select 1 from offers o where o.ride_id = r.id and o.driver_id = p_a)))
  );
$$;
revoke all on function public.users_linked(uuid, uuid) from public, anon, authenticated;
grant execute on function public.users_linked(uuid, uuid) to service_role;

notify pgrst, 'reload schema';
