-- ════════════════════════════════════════════════════════════════
-- SÉCURITÉ — audit du 19/10/2026 (à exécuter en une fois, peut être relancé)
--  1. Documents des fleets (stockage) : privés, chacun son dossier, admin lit tout
--  2. Neutralisation des caractères < et " dans les textes saisis (anti-injection)
--  3. Notifications : on ne peut notifier que les personnes liées à une course
--  4. Profils : rôle, validation fleet, note, email non modifiables par l'utilisateur
--  5. Push chauffeurs (notify-drivers) : appel signé par un secret
-- ════════════════════════════════════════════════════════════════

-- ────────────────────────────────────────────────────────────────
-- 1. STOCKAGE fleet-docs
-- Les fichiers sont rangés dans <id de la fleet>/<dossier>/<fichier>
-- ────────────────────────────────────────────────────────────────
update storage.buckets set public = false where id = 'fleet-docs';

drop policy if exists fleet_insert on storage.objects;
drop policy if exists fleet_select on storage.objects;
drop policy if exists fleet_update on storage.objects;
drop policy if exists fleet_delete on storage.objects;
drop policy if exists fleet_docs_insert on storage.objects;
drop policy if exists fleet_docs_select on storage.objects;
drop policy if exists fleet_docs_update on storage.objects;
drop policy if exists fleet_docs_delete on storage.objects;

create policy fleet_docs_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'fleet-docs' and (storage.foldername(name))[1] = auth.uid()::text);
create policy fleet_docs_select on storage.objects for select to authenticated
  using (bucket_id = 'fleet-docs' and ((storage.foldername(name))[1] = auth.uid()::text
                                       or (auth.jwt() ->> 'email') = 'kb@bleenr.com'));
create policy fleet_docs_update on storage.objects for update to authenticated
  using      (bucket_id = 'fleet-docs' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'fleet-docs' and (storage.foldername(name))[1] = auth.uid()::text);
create policy fleet_docs_delete on storage.objects for delete to authenticated
  using (bucket_id = 'fleet-docs' and ((storage.foldername(name))[1] = auth.uid()::text
                                       or (auth.jwt() ->> 'email') = 'kb@bleenr.com'));

-- ────────────────────────────────────────────────────────────────
-- 2. NEUTRALISATION DES TEXTES
-- < devient ‹ et " devient ” dans tous les champs texte saisis par les
-- utilisateurs : impossible d'y glisser une balise ou de sortir d'un attribut.
-- (le > est conservé : il sert dans les trajets « A>B » des courses mixtes)
-- ────────────────────────────────────────────────────────────────
create or replace function public.trg_sanitize_text()
returns trigger language plpgsql as $$
declare j jsonb := to_jsonb(new); k text; v jsonb; changed boolean := false;
begin
  for k, v in select * from jsonb_each(j) loop
    if jsonb_typeof(v) = 'string' and (v #>> '{}') ~ '[<"]' then
      j := jsonb_set(j, array[k], to_jsonb(translate(v #>> '{}', '<"', '‹”')));
      changed := true;
    end if;
  end loop;
  if changed then new := jsonb_populate_record(new, j); end if;
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['rides','offers','profiles','passengers','notifications','ride_reports',
                           'fleet_drivers','fleet_vehicles','ratings','fleet_documents',
                           'driver_documents','vehicle_documents','ride_private'] loop
    if to_regclass('public.'||t) is not null then
      execute format('drop trigger if exists "0_sanitize_text" on public.%I', t);
      execute format('create trigger "0_sanitize_text" before insert or update on public.%I
                      for each row execute function public.trg_sanitize_text()', t);
    end if;
  end loop;
end $$;

-- Nettoyage des données existantes (déclencheurs coupés le temps du nettoyage :
-- pas de notifications envoyées, notes privées des demandes conservées)
do $$
declare r record;
begin
  for r in
    select c.table_name, c.column_name
      from information_schema.columns c
     where c.table_schema = 'public'
       and c.data_type in ('text','character varying')
       and c.table_name = any (array['rides','offers','profiles','passengers','notifications','ride_reports',
                                     'fleet_drivers','fleet_vehicles','ratings','fleet_documents',
                                     'driver_documents','vehicle_documents','ride_private'])
  loop
    execute format('alter table public.%I disable trigger user', r.table_name);
    execute format('update public.%I set %I = translate(%I, %L, %L) where %I ~ %L',
                   r.table_name, r.column_name, r.column_name, '<"', '‹”', r.column_name, '[<"]');
    execute format('alter table public.%I enable trigger user', r.table_name);
  end loop;
end $$;

-- La notification « problème signalé » n'a plus besoin d'échapper elle-même le texte
create or replace function public.notify_admin_ride_report()
returns trigger language plpgsql security definer set search_path = public as $$
declare admin_id uuid;
begin
  select id into admin_id from auth.users where email = 'kb@bleenr.com' limit 1;
  if admin_id is not null then
    insert into public.notifications (user_id, type, title, body, ride_id, read)
    values (admin_id, 'ride_problem', '⚠️ Problème signalé par un client', left(new.message, 300), new.ride_id, false);
  end if;
  return new;
end $$;

-- ────────────────────────────────────────────────────────────────
-- 3. NOTIFICATIONS
-- ────────────────────────────────────────────────────────────────
create or replace function public.can_notify(p_target uuid, p_ride uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and (
       p_target = auth.uid()
    or (auth.jwt() ->> 'email') = 'kb@bleenr.com'
    or (p_ride is not null and exists (
          select 1 from rides r
           where r.id = p_ride
             -- l'expéditeur participe à la course…
             and (auth.uid() in (r.client_id, r.driver_id)
                  or exists (select 1 from offers o where o.ride_id = r.id and o.driver_id = auth.uid()))
             -- …et le destinataire aussi
             and (p_target in (r.client_id, r.driver_id)
                  or exists (select 1 from offers o where o.ride_id = r.id and o.driver_id = p_target))))
  );
$$;
revoke all on function public.can_notify(uuid, uuid) from public, anon;
grant execute on function public.can_notify(uuid, uuid) to authenticated;

drop policy if exists "insert notifs" on public.notifications;
drop policy if exists "System inserts notifications" on public.notifications;
drop policy if exists notifications_insert_related on public.notifications;
create policy notifications_insert_related on public.notifications
  for insert to authenticated
  with check (public.can_notify(user_id, ride_id));

-- ────────────────────────────────────────────────────────────────
-- 4. PROFILS : champs protégés
-- ────────────────────────────────────────────────────────────────
create or replace function public.trg_profiles_guard()
returns trigger language plpgsql as $$
begin
  if not public._is_app_user() then return new; end if;   -- admin, fonctions serveur : libres

  if tg_op = 'INSERT' then
    if new.id is distinct from auth.uid() then
      raise exception 'Profil d''un autre utilisateur' using errcode = '42501';
    end if;
    if coalesce(new.role,'') not in ('','client','driver') then
      raise exception 'Rôle invalide' using errcode = '42501';
    end if;
    new.fleet_verified := null;
    new.rating := null;
    new.rating_count := null;
    return new;
  end if;

  -- rôle : choisi une seule fois à l'inscription (client ou fleet)
  if new.role is distinct from old.role
     and not (coalesce(old.role,'') = '' and new.role in ('client','driver')) then
    raise exception 'Le rôle ne peut pas être modifié' using errcode = '42501';
  end if;
  if new.fleet_verified is distinct from old.fleet_verified then
    raise exception 'La validation est faite par l''administrateur' using errcode = '42501';
  end if;
  if new.rating is distinct from old.rating or new.rating_count is distinct from old.rating_count then
    raise exception 'La note est calculée par le serveur' using errcode = '42501';
  end if;
  if new.email is distinct from old.email
     and new.email is distinct from (auth.jwt() ->> 'email') then
    raise exception 'L''email se modifie depuis le compte' using errcode = '42501';
  end if;
  -- fleet validée : identité figée (comme dans l'app)
  if old.role = 'driver' and old.fleet_verified = 'validated'
     and (new.first_name is distinct from old.first_name
          or new.last_name is distinct from old.last_name
          or new.company_name is distinct from old.company_name) then
    raise exception 'Fleet validée : contactez Bleenr pour modifier l''identité' using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists a_profiles_guard on public.profiles;
create trigger a_profiles_guard
  before insert or update on public.profiles
  for each row execute function public.trg_profiles_guard();

-- ────────────────────────────────────────────────────────────────
-- 5. PUSH CHAUFFEURS : secret partagé entre la base et notify-drivers
-- ────────────────────────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'notify_hook_secret') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(24), 'hex'), 'notify_hook_secret');
  end if;
end $$;

create or replace function public.notify_drivers_hook()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  perform net.http_post(
    url     := 'https://tuzfoqdxmxzjjhvlxsgb.supabase.co/functions/v1/notify-drivers',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1emZvcWR4bXh6ampodmx4c2diIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0MzIyNDcsImV4cCI6MjA5MDAwODI0N30.xJU8CmI0KGiEl-YA87Rtv8yrrFkPU8_dAlUrY85DDzs',
      'x-hook-secret', coalesce((select decrypted_secret from vault.decrypted_secrets
                                  where name = 'notify_hook_secret' limit 1), '')
    ),
    body    := jsonb_build_object(
      'type',       TG_OP,
      'table',      TG_TABLE_NAME,
      'record',     to_jsonb(NEW),
      'old_record', case when TG_OP = 'UPDATE' then to_jsonb(OLD) else null end
    ),
    timeout_milliseconds := 5000
  );
  return NEW;
end;
$$;

notify pgrst, 'reload schema';

-- ── À copier ensuite dans Supabase → Edge Functions → Secrets (nom : NOTIFY_HOOK_SECRET) ──
select decrypted_secret as notify_hook_secret
  from vault.decrypted_secrets where name = 'notify_hook_secret';
