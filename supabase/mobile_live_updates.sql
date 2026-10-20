-- ════════════════════════════════════════════════════════════════
-- App chauffeur (et site) — 20/10/2026. Peut être relancé sans risque.
--  1. Temps réel : les modifications des courses et des offres sont
--     poussées aux apps connectées (plus besoin de recharger)
--  2. Après « En chemin » : véhicule / chauffeur et note au client
--     ne sont plus modifiables (même via le site ou une fonction)
-- ════════════════════════════════════════════════════════════════

-- 1. TEMPS RÉEL (les règles d'accès RLS restent appliquées à chaque abonné)
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'rides') then
    alter publication supabase_realtime add table public.rides;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'offers') then
    alter publication supabase_realtime add table public.offers;
  end if;
end $$;

-- 2. VERROU APRÈS « EN CHEMIN »
-- (basé sur l'utilisateur connecté : s'applique aussi à la fonction fleet_update_assignment)
create or replace function public._is_user_not_admin()
returns boolean language sql stable as $$
  select auth.uid() is not null and coalesce(auth.jwt() ->> 'email', '') <> 'kb@bleenr.com';
$$;

create or replace function public.trg_offers_lock_on_way()
returns trigger language plpgsql set search_path = public as $$
begin
  if public._is_user_not_admin()
     and (new.vehicle_id is distinct from old.vehicle_id or new.fleet_driver_id is distinct from old.fleet_driver_id)
     and exists (select 1 from rides r where r.id = new.ride_id
                   and (to_jsonb(r) ->> 'on_way_at' is not null or r.pickup_at is not null or r.status in ('active','done'))) then
    raise exception 'Course en cours : le véhicule et le chauffeur ne peuvent plus être modifiés' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists b_offers_lock_on_way on public.offers;
create trigger b_offers_lock_on_way before update on public.offers
  for each row execute function public.trg_offers_lock_on_way();

create or replace function public.trg_rides_lock_note_on_way()
returns trigger language plpgsql set search_path = public as $$
begin
  if public._is_user_not_admin()
     and coalesce((regexp_match(coalesce(new.notes,''), '\|offer_note:([^|]*)'))[1], '')
         is distinct from coalesce((regexp_match(coalesce(old.notes,''), '\|offer_note:([^|]*)'))[1], '')
     and (to_jsonb(old) ->> 'on_way_at' is not null or old.pickup_at is not null or old.status in ('active','done')) then
    raise exception 'Course en cours : la note au client ne peut plus être modifiée' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists b_rides_lock_note_on_way on public.rides;
create trigger b_rides_lock_note_on_way before update on public.rides
  for each row execute function public.trg_rides_lock_note_on_way();

notify pgrst, 'reload schema';
