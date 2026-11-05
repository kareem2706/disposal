-- ════════════════════════════════════════════════════════════════
-- COURSE COMMENCÉE : PASSAGER ET NOTE VERROUILLÉS — 05/11/2026. Peut être relancé.
-- À exécuter APRÈS server_actions.sql.
-- Dès que le chauffeur est en route (on_way_at), le client ne peut plus modifier
-- les informations du passager ni la note au chauffeur.
-- ════════════════════════════════════════════════════════════════

create or replace function public.api_ride_set_tags(p_ride uuid, p_tags jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := _api_uid(); r rides%rowtype; src text; k text;
begin
  select * into r from rides where id = p_ride for update;
  if not found or r.client_id is distinct from uid then raise exception 'Demande introuvable' using errcode = '42501'; end if;
  if r.status in ('done','cancelled','personal') then
    raise exception 'Cette course ne peut plus être modifiée' using errcode = '42501';
  end if;
  if r.status = 'active' or r.on_way_at is not null or r.pickup_at is not null then
    raise exception 'La course a commencé : le passager et la note au chauffeur ne peuvent plus être modifiés.' using errcode = '42501';
  end if;
  src := r.notes;
  if r.status in ('waiting','offers') then
    select coalesce(full_notes, r.notes) into src from ride_private where ride_id = p_ride;
    src := coalesce(src, r.notes);
  end if;
  for k in select jsonb_object_keys(p_tags) loop
    if k not in ('pax','tel','pemail','pref','note_drv') then raise exception 'Information non modifiable : %', k using errcode = '22023'; end if;
    src := _api_set_tag(src, k, p_tags ->> k);
  end loop;
  return _api_update('public.rides', p_ride::text, jsonb_build_object('notes', src));
end $$;

notify pgrst, 'reload schema';
