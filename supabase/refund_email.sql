-- ════════════════════════════════════════════════════════════════
-- E-MAIL « REMBOURSEMENT EFFECTUÉ » — 04/11/2026. Peut être relancé.
-- À exécuter APRÈS ride_driver_emails.sql (fonctions _send_mail_hook, _ride_mail_data).
-- Quand l'admin marque une course comme remboursée (payment_method → 'refunded'),
-- le client reçoit l'e-mail ride_refunded (montant, moyen de paiement, délai bancaire).
-- E-mail de service : toujours envoyé (non désactivable).
-- ════════════════════════════════════════════════════════════════

create or replace function public.trg_rides_refund_mail()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.payment_method = 'refunded' and old.payment_method is distinct from 'refunded' and new.client_id is not null then
    perform _send_mail_hook('ride_refunded', new.client_id, _ride_mail_data(new) || jsonb_build_object(
      'amount', replace(to_char(coalesce(new.final_price, 0), 'FM999990.00'), '.', ',') || ' €',
      'method', case old.payment_method when 'bank_transfer' then 'bank' else 'card' end));
  end if;
  return new;
exception when others then
  raise warning 'trg_rides_refund_mail: %', sqlerrm;   -- un e-mail en échec ne bloque jamais le remboursement
  return new;
end $$;
drop trigger if exists z_rides_refund_mail on public.rides;
create trigger z_rides_refund_mail after update of payment_method on public.rides
  for each row execute function public.trg_rides_refund_mail();
