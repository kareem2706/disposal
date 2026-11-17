-- « Welcome sign » d'une sous-traitance (17/11/2026)
-- La fleet qui publie une sous-traitance peut joindre un fichier (logo de société, pancarte…)
-- que le chauffeur qui accepte affiche au client pour être identifié.
--  • fichier privé : bucket « welcome-signs », dossier = id de la fleet qui publie ;
--  • lecture : la fleet qui publie, le chauffeur assigné à la course, l'administrateur ;
--  • rattachement à la course : uniquement par le serveur (api_ride_welcome_sign).

alter table public.rides add column if not exists welcome_sign text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('welcome-signs', 'welcome-signs', false, 5242880,
        array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
                               allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists welcome_signs_insert on storage.objects;
drop policy if exists welcome_signs_update on storage.objects;
drop policy if exists welcome_signs_delete on storage.objects;
drop policy if exists welcome_signs_select on storage.objects;
create policy welcome_signs_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'welcome-signs' and (storage.foldername(name))[1] = auth.uid()::text);
create policy welcome_signs_update on storage.objects for update to authenticated
  using (bucket_id = 'welcome-signs' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'welcome-signs' and (storage.foldername(name))[1] = auth.uid()::text);
create policy welcome_signs_delete on storage.objects for delete to authenticated
  using (bucket_id = 'welcome-signs' and ((storage.foldername(name))[1] = auth.uid()::text or _api_admin()));
create policy welcome_signs_select on storage.objects for select to authenticated
  using (bucket_id = 'welcome-signs' and (
          (storage.foldername(name))[1] = auth.uid()::text
          or _api_admin()
          or exists (select 1 from public.rides r
                      where r.welcome_sign = storage.objects.name
                        and r.driver_id = auth.uid()
                        and coalesce(r.is_subcontract, false))));

-- Rattache (ou retire, p_path = null) le welcome sign d'une sous-traitance publiée par la fleet connectée
create or replace function public.api_ride_welcome_sign(p_ride uuid, p_path text)
returns boolean language plpgsql security definer set search_path = public as $$
declare uid uuid := _api_uid(); r rides%rowtype;
begin
  select * into r from rides where id = p_ride for update;
  if not found or r.client_id <> uid or not coalesce(r.is_subcontract, false) then
    raise exception 'Course introuvable' using errcode = '42501';
  end if;
  if r.status in ('done', 'cancelled', 'no_show') then
    raise exception 'Course clôturée' using errcode = '42501';
  end if;
  if p_path is not null and p_path !~ ('^' || uid::text || '/' || p_ride::text || '\.(jpg|jpeg|png|webp|pdf)$') then
    raise exception 'Fichier invalide' using errcode = '22023';
  end if;
  if p_path is not null and not exists (select 1 from storage.objects o where o.bucket_id = 'welcome-signs' and o.name = p_path) then
    raise exception 'Fichier introuvable' using errcode = '22023';
  end if;
  perform _api_trusted(true);
  update rides set welcome_sign = p_path where id = p_ride;
  perform _api_trusted(false);
  return true;
end $$;
revoke all on function public.api_ride_welcome_sign(uuid, text) from public, anon;
grant execute on function public.api_ride_welcome_sign(uuid, text) to authenticated;
