-- ════════════════════════════════════════════════════════════════
-- SOUS-TRAITANCE : notification push au donneur d'ordre (12/11/2026) — peut être relancé.
-- Quand le sous-traitant change le véhicule ou le chauffeur (offre acceptée), la fonction notify-drivers
-- prévient la flotte qui a publié la sous-traitance (client_id de la course).
-- La note du sous-traitant, « En chemin » et « Terminée » passent déjà par le déclencheur des courses.
-- Prérequis : edge_calls.sql (_edge_post), ride_driver_emails.sql (_ride_assignment_data).
-- ════════════════════════════════════════════════════════════════
create or replace function public.trg_offers_sub_push()
returns trigger language plpgsql security definer set search_path = public as $$
declare r rides%rowtype; chg text[] := '{}';
begin
  if new.status is distinct from 'accepted' then return new; end if;
  select * into r from rides where id = new.ride_id;
  if not found or not coalesce(r.is_subcontract, false) or r.client_id is null
     or r.client_id = r.driver_id or r.status not in ('confirmed', 'active') then return new; end if;
  -- 1re attribution : fleet_update_assignment crée l'offre acceptée (INSERT) ; ensuite elle la modifie (UPDATE)
  if tg_op = 'INSERT' then
    if new.vehicle_id is not null then chg := array_append(chg, 'véhicule'); end if;
    if new.fleet_driver_id is not null then chg := array_append(chg, 'chauffeur'); end if;
  else
    if new.vehicle_id is distinct from old.vehicle_id and new.vehicle_id is not null then chg := array_append(chg, 'véhicule'); end if;
    if new.fleet_driver_id is distinct from old.fleet_driver_id and new.fleet_driver_id is not null then chg := array_append(chg, 'chauffeur'); end if;
  end if;
  if coalesce(array_length(chg, 1), 0) = 0 then return new; end if;
  perform public._edge_post('notify-drivers', jsonb_build_object(
    'type', 'SUB_ASSIGN', 'table', 'offers',
    'record', jsonb_build_object('id', r.id, 'client_id', r.client_id, 'booking_code', r.booking_code,
                                 'from_address', r.from_address, 'to_address', r.to_address, 'trip_type', r.trip_type,
                                 'notes', r.notes, 'ride_date', r.ride_date, 'ride_time', r.ride_time),
    'changes', to_jsonb(chg),
    'assignment', public._ride_assignment_data(r.id)));
  return new;
exception when others then
  return new;   -- une notification ne doit jamais bloquer l'attribution
end $$;
revoke all on function public.trg_offers_sub_push() from public, anon, authenticated;

drop trigger if exists offers_sub_push on public.offers;
create trigger offers_sub_push
  after insert or update of vehicle_id, fleet_driver_id on public.offers
  for each row execute function public.trg_offers_sub_push();
