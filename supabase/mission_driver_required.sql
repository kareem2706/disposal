-- ════════════════════════════════════════════════════════════════
-- « EN CHEMIN » SEULEMENT AVEC UN CHAUFFEUR ASSIGNÉ — 20/10/2026
-- Peut être relancé sans risque. À exécuter APRÈS server_actions.sql.
-- La fleet ne peut pas démarrer une mission (« En chemin ») tant que
-- l'offre retenue n'a pas de chauffeur (site, app iOS, toute requête).
-- (Une sous-traitance acceptée sans offre n'est pas concernée.)
-- ════════════════════════════════════════════════════════════════

-- Correctif (aussi dans server_actions.sql) : réglage absent = « non », jamais « inconnu »
create or replace function public._is_app_user()
returns boolean language sql stable as $$
  select (current_user in ('authenticated','anon') or coalesce(current_setting('bleenr.as_user', true), '') = '1')
     and coalesce(auth.jwt() ->> 'email','') <> 'kb@bleenr.com';
$$;

create or replace function public.trg_rides_driver_required()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public._is_user_not_admin()
     and (to_jsonb(new) ->> 'on_way_at') is not null and (to_jsonb(old) ->> 'on_way_at') is null
     and exists (select 1 from offers o where o.ride_id = new.id and o.status = 'accepted' and o.fleet_driver_id is null) then
    raise exception 'Assignez un chauffeur à la mission avant de partir' using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists a_rides_driver_required on public.rides;
create trigger a_rides_driver_required before update on public.rides
  for each row execute function public.trg_rides_driver_required();
