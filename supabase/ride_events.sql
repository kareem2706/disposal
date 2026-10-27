-- ════════════════════════════════════════════════════════════════
-- ÉVÉNEMENTS (plusieurs véhicules) — 27/10/2026. Peut être relancé sans risque.
-- À exécuter APRÈS server_actions.sql.
--  • ride_events : la « demande mère » (nom de l'événement, contact sur place)
--  • rides.event_id / rides.event_name : chaque véhicule reste une demande
--    indépendante pour les chauffeurs, liée à son événement
--  • api_event_create : relie les demandes créées par le client à un
--    événement (nouveau, ou existant pour « + Ajouter un véhicule »)
-- ════════════════════════════════════════════════════════════════

create table if not exists public.ride_events (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid not null references auth.users(id) on delete cascade,
  name          text not null,
  contact_name  text,
  contact_phone text,
  created_at    timestamptz not null default now()
);
alter table public.ride_events enable row level security;
drop policy if exists ride_events_select on public.ride_events;
create policy ride_events_select on public.ride_events for select to authenticated
  using (client_id = auth.uid() or (auth.jwt() ->> 'email') = 'kb@bleenr.com');
revoke all on public.ride_events from anon;
revoke insert, update, delete, truncate on public.ride_events from authenticated;
grant select on public.ride_events to authenticated;
grant all on public.ride_events to service_role;

alter table public.rides add column if not exists event_id uuid references public.ride_events(id) on delete set null;
alter table public.rides add column if not exists event_name text;
create index if not exists rides_event_id_idx on public.rides(event_id);

-- p = { name, contact_name, contact_phone, ride_ids: [uuid…], event_id? }
create or replace function public.api_event_create(p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := _api_uid(); v_ids uuid[]; v_ev uuid := nullif(p ->> 'event_id','')::uuid; v_name text; v_n int;
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
    select name into v_name from ride_events where id = v_ev and client_id = uid;
    if v_name is null then raise exception 'Événement introuvable' using errcode = '42501'; end if;
  else
    v_name := _api_txt(p ->> 'name', 120);
    if v_name is null then raise exception 'Nom de l''événement requis' using errcode = '22023'; end if;
    insert into ride_events (client_id, name, contact_name, contact_phone)
    values (uid, v_name, _api_txt(p ->> 'contact_name', 120), _api_txt(p ->> 'contact_phone', 40))
    returning id into v_ev;
  end if;
  perform _api_trusted(true);
  update rides set event_id = v_ev, event_name = v_name where id = any(v_ids) and client_id = uid;
  get diagnostics v_n = row_count;
  perform _api_trusted(false);
  return jsonb_build_object('id', v_ev, 'name', v_name, 'linked', v_n);
end $$;
revoke all on function public.api_event_create(jsonb) from public, anon;
grant execute on function public.api_event_create(jsonb) to authenticated;

notify pgrst, 'reload schema';
