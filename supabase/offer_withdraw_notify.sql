-- ════════════════════════════════════════════════════════════════
-- Retrait d'une offre par la fleet (site + app iOS) — 20/10/2026
-- Remplace la fonction de offers_withdraw.sql (même comportement) et ajoute :
--   • une notification (cloche) au client : « Une offre a été retirée »
--     → son écran se met aussi à jour tout seul
--   • les suppressions d'offres transmises en temps réel avec la ligne complète
-- Peut être relancé sans risque.
-- ════════════════════════════════════════════════════════════════
create or replace function public.driver_withdraw_offer(p_offer uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ride uuid; v_price numeric; r rides%rowtype; v_left int;
begin
  delete from public.offers
   where id = p_offer
     and driver_id = auth.uid()
     and status = 'pending'
  returning ride_id, price into v_ride, v_price;

  if v_ride is null then
    return false;                       -- pas son offre, ou déjà acceptée / refusée
  end if;

  select count(*) into v_left from public.offers where ride_id = v_ride and status = 'pending';

  update public.rides
     set status = 'waiting'
   where id = v_ride
     and status = 'offers'
     and v_left = 0;

  select * into r from public.rides where id = v_ride;
  if found and r.client_id is not null and r.status in ('waiting','offers') then
    insert into public.notifications (user_id, type, title, body, ride_id, read)
    values (r.client_id, 'offer_withdrawn', 'Une offre a été retirée',
            'Un chauffeur a retiré son offre sur votre demande ' || coalesce(r.booking_code, '') ||
            case when v_left = 0 then '. Votre demande reste visible par les chauffeurs.'
                 else '. Il vous reste ' || v_left || ' offre' || case when v_left > 1 then 's' else '' end || '.' end,
            r.id, false);
  end if;
  return true;
end;
$$;

revoke all on function public.driver_withdraw_offer(uuid) from public, anon;
grant execute on function public.driver_withdraw_offer(uuid) to authenticated;

-- Temps réel : la ligne complète est transmise aussi pour les suppressions
alter table public.offers replica identity full;

notify pgrst, 'reload schema';
