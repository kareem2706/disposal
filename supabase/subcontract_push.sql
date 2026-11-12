-- ════════════════════════════════════════════════════════════════
-- SOUS-TRAITANCE : notification push au donneur d'ordre (12/11/2026) — peut être relancé.
-- Quand le sous-traitant change le véhicule ou le chauffeur (offre acceptée), la fonction notify-drivers
-- prévient la flotte qui a publié la sous-traitance (client_id de la course).
-- La note du sous-traitant, « En chemin » et « Terminée » passent déjà par le déclencheur des courses.
-- Prérequis : edge_calls.sql (_edge_post), ride_driver_emails.sql (_ride_assignment_data).
-- ════════════════════════════════════════════════════════════════
create or replace function public.trg_offers_sub_push()
returns trigger language plpgsql security definer set search_path = public as $$
declare r rides%rowtype; lines text[] := '{}'; ov uuid; od uuid; nm text;
begin
  if new.status is distinct from 'accepted' then return new; end if;
  select * into r from rides where id = new.ride_id;
  if not found or not coalesce(r.is_subcontract, false) or r.client_id is null
     or r.client_id = r.driver_id or r.status not in ('confirmed', 'active') then return new; end if;
  -- 1re attribution : fleet_update_assignment crée l'offre acceptée (INSERT) ; ensuite elle la modifie (UPDATE)
  if tg_op = 'UPDATE' then ov := old.vehicle_id; od := old.fleet_driver_id; end if;

  -- Véhicule : « Véhicule assigné : … » / « Changement de véhicule : … » / « Le véhicule a été retiré »
  if new.vehicle_id is distinct from ov then
    if new.vehicle_id is null then
      lines := array_append(lines, 'Le véhicule a été retiré');
    else
      select nullif(trim(concat_ws(' ', v.brand, v.model, v.plate)), '') into nm from fleet_vehicles v where v.id = new.vehicle_id;
      lines := array_append(lines, case when ov is null then 'Véhicule assigné : ' else 'Changement de véhicule : ' end || coalesce(nm, 'véhicule'));
    end if;
  end if;
  -- Chauffeur : « Chauffeur assigné : … » / « Changement de chauffeur : … » / « Le chauffeur a été supprimé »
  if new.fleet_driver_id is distinct from od then
    if new.fleet_driver_id is null then
      lines := array_append(lines, 'Le chauffeur a été supprimé');
    else
      select nullif(trim(concat_ws(' ', d.first_name, d.last_name)), '') into nm from fleet_drivers d where d.id = new.fleet_driver_id;
      lines := array_append(lines, case when od is null then 'Chauffeur assigné : ' else 'Changement de chauffeur : ' end || coalesce(nm, 'chauffeur'));
    end if;
  end if;
  if coalesce(array_length(lines, 1), 0) = 0 then return new; end if;

  perform public._edge_post('notify-drivers', jsonb_build_object(
    'type', 'SUB_ASSIGN', 'table', 'offers',
    'record', jsonb_build_object('id', r.id, 'client_id', r.client_id, 'booking_code', r.booking_code),
    'lines', to_jsonb(lines)));
  return new;
exception when others then
  return new;   -- une notification ne doit jamais bloquer l'attribution
end $$;
revoke all on function public.trg_offers_sub_push() from public, anon, authenticated;

drop trigger if exists offers_sub_push on public.offers;
create trigger offers_sub_push
  after insert or update of vehicle_id, fleet_driver_id on public.offers
  for each row execute function public.trg_offers_sub_push();
