-- ════════════════════════════════════════════════════════════════
-- SÉCURITÉ — infos client invisibles avant confirmation (19/10/2026)
-- À exécuter APRÈS security_payments_privacy.sql. Peut être relancé.
--
-- Tant qu'une demande est en attente / en offres, les fleets ne voient
-- que ce qui sert à chiffrer la course :
--   trajet, date, heure, passagers, gamme, durée de mise à disposition,
--   segments d'une course mixte (sans leurs notes), n° de vol / train.
-- Tout le reste (note du client, nom / téléphone / email du passager,
-- référence client, notes des segments) est gardé à part et n'est
-- remis dans la course qu'une fois l'offre d'une fleet acceptée.
-- Seule cette fleet (et le client, l'admin) peut alors le lire.
-- ════════════════════════════════════════════════════════════════

alter table public.ride_private add column if not exists full_notes text;

-- Partie « publique » d'une note (ce que voient les fleets avant acceptation)
create or replace function public._ride_public_notes(p_notes text)
returns text language plpgsql immutable as $$
declare s text; head text; tail text; dur text;
begin
  if p_notes is null then return null; end if;
  -- retire les infos client (et notes de segment |n:)
  s := regexp_replace(p_notes, '\|(pax|tel|pemail|pref|n|note_drv|offer_note):[^|]*', '', 'g');
  if s ~ '^\s*Mixte:' then
    return nullif(trim(s), '');
  end if;
  -- A→B / mise à disposition : texte libre du client avant le 1er « | »
  head := split_part(s, '|', 1);
  tail := substr(s, length(head) + 1);              -- |flight:… |train:…
  dur  := substring(head from 'Durée:[^\s|]+');    -- durée de mise à disposition
  return nullif(trim(coalesce(dur, '') || tail), '');
end $$;

create or replace function public.trg_rides_private()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare v_full text; v_tok text; k text;
begin
  if new.status in ('waiting','offers') then
    -- Nouvelle note écrite par le client : on garde la version complète à part
    if tg_op = 'INSERT' or new.notes is distinct from old.notes
       or current_setting('bleenr.reprocess', true) = '1' then
      insert into ride_private as p (ride_id, client_id, tokens, full_notes, updated_at)
      values (new.id, new.client_id, _ride_priv_extract(new.notes), new.notes, now())
      on conflict (ride_id) do update
        set full_notes = excluded.full_notes, tokens = excluded.tokens,
            client_id = excluded.client_id, updated_at = now();
      new.notes := _ride_public_notes(new.notes);
    end if;

  elsif tg_op = 'UPDATE' and old.status in ('waiting','offers')
        and new.status not in ('cancelled','personal') then
    -- Offre acceptée : la fleet retenue reçoit la note complète
    select full_notes, tokens into v_full, v_tok from ride_private where ride_id = new.id;
    if v_full is not null then
      new.notes := v_full;
    elsif coalesce(v_tok,'') <> '' then              -- anciennes demandes (avant ce script)
      foreach k in array array['pax','tel','pemail'] loop
        if coalesce(new.notes,'') !~ ('\|'||k||':') then
          new.notes := coalesce(new.notes,'') || coalesce((regexp_match(v_tok, '(\|'||k||':[^|]*)'))[1], '');
        end if;
      end loop;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists b_rides_private on public.rides;
create trigger b_rides_private
  before insert or update on public.rides
  for each row execute function public.trg_rides_private();

-- Profils : une fleet ne voit le profil d'un client qu'une fois retenue
-- (le client voit toujours les fleets qui lui ont fait une offre)
create or replace function public.can_see_profile(target uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select
    auth.uid() is not null and (
      target = auth.uid()
      or (auth.jwt() ->> 'email') = 'kb@bleenr.com'
      or exists (
        select 1 from rides r
        where (r.client_id = auth.uid() and r.driver_id = target)
           or (r.driver_id = auth.uid() and r.client_id = target)
      )
      or exists (
        select 1 from offers o join rides r on r.id = o.ride_id
        where r.client_id = auth.uid() and o.driver_id = target
      )
    );
$$;

-- Demandes déjà en attente : on reconstitue la note complète puis on la masque
-- (sans déclencher de notifications push vers les fleets)
do $$ begin
  if exists (select 1 from pg_trigger where tgname = 'notify_drivers_on_rides') then
    execute 'alter table public.rides disable trigger notify_drivers_on_rides';
  end if;
end $$;

update public.rides r
   set notes = coalesce(r.notes,'') || coalesce(p.tokens,'')
  from public.ride_private p
 where p.ride_id = r.id and p.full_notes is null and coalesce(p.tokens,'') <> ''
   and r.status in ('waiting','offers');

select set_config('bleenr.reprocess', '1', false);
update public.rides set notes = notes
 where status in ('waiting','offers')
   and id not in (select ride_id from public.ride_private where full_notes is not null);
select set_config('bleenr.reprocess', '0', false);

do $$ begin
  if exists (select 1 from pg_trigger where tgname = 'notify_drivers_on_rides') then
    execute 'alter table public.rides enable trigger notify_drivers_on_rides';
  end if;
end $$;

notify pgrst, 'reload schema';
