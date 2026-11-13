-- ════════════════════════════════════════════════════════════════
-- VÉHICULE MARQUÉ — 13/11/2026. Peut être relancé.
-- À exécuter APRÈS server_actions.sql.
--
-- Un véhicule « marqué » porte une inscription publicitaire sur la carrosserie
-- (Uber, Bolt, Heetch…). Le fleet l'indique dans la fiche du véhicule ;
-- le client le voit dans le détail du véhicule de chaque offre.
-- Modifiable à tout moment, même sur un véhicule validé (pas de nouvelle validation).
-- ════════════════════════════════════════════════════════════════

alter table public.fleet_vehicles add column if not exists branded boolean not null default false;

create or replace function public.api_vehicle_save(p_id uuid, p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := _api_uid(); d jsonb; v fleet_vehicles%rowtype; jv jsonb; k text; x jsonb;
begin
  perform _api_require_fleet(uid);
  d := _api_cols('public.fleet_vehicles', p, array['brand','model','year','color','vehicle_class','plate','amenities','seats','active','branded']);
  foreach k in array array['brand','model','color','plate','vehicle_class'] loop
    if d ? k then d := jsonb_set(d, array[k], coalesce(to_jsonb(_api_txt(d ->> k, 100)), 'null'::jsonb)); end if;
  end loop;
  if d ? 'seats' and coalesce((d ->> 'seats')::int, 0) not between 1 and 60 then raise exception 'Nombre de places invalide' using errcode = '22023'; end if;
  if p_id is null then return _api_insert('public.fleet_vehicles', d || jsonb_build_object('fleet_id', uid)); end if;
  select * into v from fleet_vehicles where id = p_id for update;
  if not found or v.fleet_id is distinct from uid then raise exception 'Véhicule introuvable' using errcode = '42501'; end if;
  x := _api_update('public.fleet_vehicles', p_id::text, d);
  -- véhicule validé dont l'identité change : il repasse en validation
  jv := to_jsonb(v);
  if jv ->> 'status' = 'validated' and exists (select 1 from unnest(array['brand','model','plate','vehicle_class','seats']) c
                                               where d ? c and (d -> c) is distinct from (jv -> c)) then
    perform _api_trusted(true);
    x := _api_update('public.fleet_vehicles', p_id::text, '{"status":"pending"}'::jsonb);
    perform _api_trusted(false);
  end if;
  return x;
end $$;
