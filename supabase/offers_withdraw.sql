-- ════════════════════════════════════════════════════════════════
-- Retrait d'une offre par le chauffeur (app Bleenr Chauffeur → « Retirer mon offre »)
-- Supprime l'offre si elle appartient au chauffeur connecté et n'est pas encore acceptée.
-- Si la demande n'a plus aucune offre, elle repasse en « waiting ».
-- À exécuter une fois dans Supabase → SQL Editor.
-- ════════════════════════════════════════════════════════════════

create or replace function public.driver_withdraw_offer(p_offer uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ride uuid;
begin
  delete from public.offers
   where id = p_offer
     and driver_id = auth.uid()
     and status = 'pending'
  returning ride_id into v_ride;

  if v_ride is null then
    return false;                       -- pas son offre, ou déjà acceptée / refusée
  end if;

  update public.rides
     set status = 'waiting'
   where id = v_ride
     and status = 'offers'
     and not exists (select 1 from public.offers o where o.ride_id = v_ride and o.status = 'pending');

  return true;
end;
$$;

revoke all on function public.driver_withdraw_offer(uuid) from public;
grant execute on function public.driver_withdraw_offer(uuid) to authenticated;
