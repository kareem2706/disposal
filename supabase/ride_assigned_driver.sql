-- Prénom + téléphone du chauffeur attribué à une course,
-- lisible uniquement par le client de la course, la fleet et l'admin.
-- (fleet_drivers reste fermée au client par RLS)
create or replace function public.ride_assigned_driver(p_ride uuid)
returns table(first_name text, phone text)
language sql
stable
security definer
set search_path = public
as $$
  select fd.first_name::text, fd.phone::text
  from rides r
  join offers o        on o.ride_id = r.id and o.status = 'accepted'
  join fleet_drivers fd on fd.id = o.fleet_driver_id
  where r.id = p_ride
    and auth.uid() is not null
    and (r.client_id = auth.uid()
         or o.driver_id = auth.uid()
         or (auth.jwt() ->> 'email') = 'kb@bleenr.com')
  limit 1;
$$;

revoke all on function public.ride_assigned_driver(uuid) from public, anon;
grant execute on function public.ride_assigned_driver(uuid) to authenticated;

notify pgrst, 'reload schema';
