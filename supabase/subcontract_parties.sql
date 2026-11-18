-- Sous-traitance : qui est qui (18/11/2026)
--  • la fleet qui a publié voit la société qui a accepté + le nom complet et le téléphone du chauffeur assigné ;
--  • la fleet qui a accepté voit la société qui lui a sous-traité la course.
-- Lecture seule, réservée aux deux parties de la course (et à l'administrateur).
create or replace function public.ride_subcontract_parties(p_ride uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare uid uuid := auth.uid(); r rides%rowtype; o offers%rowtype; res jsonb := '{}'::jsonb;
  _name text;
begin
  if uid is null then return null; end if;
  select * into r from rides where id = p_ride;
  if not found or not coalesce(r.is_subcontract, false) then return null; end if;
  if uid <> r.client_id and uid is distinct from r.driver_id and not _api_admin() then return null; end if;

  -- Société qui a sous-traité (visible par la fleet qui a accepté)
  if uid = r.driver_id or _api_admin() then
    select coalesce(nullif(trim(p.company_name), ''), trim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')))
      into _name from profiles p where p.id = r.client_id;
    res := res || jsonb_build_object('poster_company', _name);
  end if;

  -- Société qui a accepté + chauffeur assigné (visibles par la fleet qui a publié, une fois la course acceptée)
  if (uid = r.client_id or _api_admin()) and r.driver_id is not null and r.status not in ('waiting', 'offers') then
    select coalesce(nullif(trim(p.company_name), ''), trim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')))
      into _name from profiles p where p.id = r.driver_id;
    res := res || jsonb_build_object('taker_company', _name);
    select * into o from offers where ride_id = r.id and status = 'accepted' limit 1;
    if found and o.fleet_driver_id is not null then
      select res || jsonb_build_object('driver_name', trim(coalesce(fd.first_name, '') || ' ' || coalesce(fd.last_name, '')), 'driver_phone', fd.phone)
        into res from fleet_drivers fd where fd.id = o.fleet_driver_id;
    end if;
  end if;
  return res;
end $$;
revoke all on function public.ride_subcontract_parties(uuid) from public, anon;
grant execute on function public.ride_subcontract_parties(uuid) to authenticated;
