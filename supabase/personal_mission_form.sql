-- ════════════════════════════════════════════════════════════════
-- MISSION PERSONNELLE : MÊME FORMULAIRE QUE LA SOUS-TRAITANCE — 13/11/2026. Peut être relancé.
-- À exécuter APRÈS server_actions.sql.
-- Passagers et bagages enregistrés avec la mission (infos client dans les notes, comme la sous-traitance).
-- ════════════════════════════════════════════════════════════════

create or replace function public.api_personal_save(p_id uuid, p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := _api_uid(); d jsonb; r rides%rowtype;
begin
  d := _api_cols('public.rides', p, array['trip_type','from_address','to_address','ride_date','ride_time','vehicle_type','notes','passengers','luggage_large','luggage_small']);
  if d ? 'notes' then d := jsonb_set(d, '{notes}', coalesce(to_jsonb(nullif(left(d ->> 'notes', 2000), '')), 'null'::jsonb)); end if;
  if (d ->> 'ride_date') is null then raise exception 'Date requise' using errcode = '22023'; end if;
  if p_id is null then
    return _api_insert('public.rides', d || jsonb_build_object('client_id', uid, 'driver_id', uid, 'status', 'personal'));
  end if;
  select * into r from rides where id = p_id for update;
  if not found or r.status <> 'personal' or r.driver_id is distinct from uid then raise exception 'Mission introuvable' using errcode = '42501'; end if;
  return _api_update('public.rides', p_id::text, d);
end $$;
