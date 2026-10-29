-- ════════════════════════════════════════════════════════════════
-- TRAJET MIXTE « peu importe le chauffeur » — 29/10/2026. Peut être relancé sans risque.
-- À exécuter APRÈS ride_events.sql.
--  • ride_events.kind : 'event' (événement) ou 'mixed' (trajet mixte découpé en
--    une demande par trajet : chaque trajet peut être pris par un chauffeur différent)
--  • rides.event_kind : copie du type du groupe (affichage des listes / de l'app)
--  • api_event_create accepte p.kind
-- ════════════════════════════════════════════════════════════════

alter table public.ride_events add column if not exists kind text not null default 'event';
alter table public.ride_events drop constraint if exists ride_events_kind_chk;
alter table public.ride_events add constraint ride_events_kind_chk check (kind in ('event','mixed'));
alter table public.rides add column if not exists event_kind text;

-- p = { name, kind?, contact_name, contact_phone, ride_ids: [uuid…], event_id? }
create or replace function public.api_event_create(p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := _api_uid(); v_ids uuid[]; v_ev uuid := nullif(p ->> 'event_id','')::uuid; v_name text; v_kind text; v_n int;
begin
  select coalesce(array_agg(x::uuid), '{}') into v_ids from jsonb_array_elements_text(coalesce(p -> 'ride_ids','[]'::jsonb)) x;
  if coalesce(array_length(v_ids, 1), 0) = 0 or array_length(v_ids, 1) > 30 then
    raise exception 'Entre 1 et 30 véhicules par envoi' using errcode = '22023';
  end if;
  if exists (select 1 from unnest(v_ids) i where not exists (
               select 1 from rides r where r.id = i and r.client_id = uid and r.event_id is null and not coalesce(r.is_subcontract,false))) then
    raise exception 'Demande introuvable' using errcode = '42501';
  end if;
  if v_ev is not null then
    select name, kind into v_name, v_kind from ride_events where id = v_ev and client_id = uid;
    if v_name is null then raise exception 'Événement introuvable' using errcode = '42501'; end if;
  else
    v_name := _api_txt(p ->> 'name', 120);
    v_kind := case when p ->> 'kind' = 'mixed' then 'mixed' else 'event' end;
    if v_name is null then raise exception 'Nom de l''événement requis' using errcode = '22023'; end if;
    insert into ride_events (client_id, name, kind, contact_name, contact_phone)
    values (uid, v_name, v_kind, _api_txt(p ->> 'contact_name', 120), _api_txt(p ->> 'contact_phone', 40))
    returning id into v_ev;
  end if;
  perform _api_trusted(true);
  update rides set event_id = v_ev, event_name = v_name, event_kind = v_kind where id = any(v_ids) and client_id = uid;
  get diagnostics v_n = row_count;
  perform _api_trusted(false);
  return jsonb_build_object('id', v_ev, 'name', v_name, 'kind', v_kind, 'linked', v_n);
end $$;
revoke all on function public.api_event_create(jsonb) from public, anon;
grant execute on function public.api_event_create(jsonb) to authenticated;

notify pgrst, 'reload schema';
