-- ════════════════════════════════════════════════════════════════
-- Email de remerciement au client quand une course est terminée
-- Envoyé depuis la base : fonctionne que la course soit clôturée sur le site,
-- dans l'app iOS ou automatiquement. Pas d'email en cas d'absence du client
-- (No Show), ni pour les sous-traitances (client = autre fleet).
-- Prérequis : security_hardening.sql (secret notify_hook_secret) + send-mail déployée.
-- Peut être relancé sans risque.
-- ════════════════════════════════════════════════════════════════
create or replace function public.ride_completed_mail_hook()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if new.status = 'done' and old.status is distinct from 'done'
     and new.no_show_at is null and not coalesce(new.is_subcontract, false)
     and new.client_id is not null then
    perform net.http_post(
      url     := 'https://tuzfoqdxmxzjjhvlxsgb.supabase.co/functions/v1/send-mail',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1emZvcWR4bXh6ampodmx4c2diIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0MzIyNDcsImV4cCI6MjA5MDAwODI0N30.xJU8CmI0KGiEl-YA87Rtv8yrrFkPU8_dAlUrY85DDzs',
        'x-hook-secret', coalesce((select decrypted_secret from vault.decrypted_secrets
                                    where name = 'notify_hook_secret' limit 1), '')
      ),
      body    := jsonb_build_object(
        'type', 'ride_completed',
        'to_user_ids', jsonb_build_array(new.client_id),
        'data', jsonb_build_object(
          'code', coalesce(new.booking_code, left(new.id::text, 8)),
          'date', to_char(new.ride_date, 'DD/MM/YYYY'),
          'time', left(coalesce(new.ride_time::text, ''), 5),
          'from', coalesce(split_part(new.from_address, ',', 1), ''),
          'to',   case when new.trip_type = 'disposal' then 'Mise à disposition'
                       else coalesce(split_part(new.to_address, ',', 1), '') end
        )
      ),
      timeout_milliseconds := 5000
    );
  end if;
  return new;
end;
$$;

drop trigger if exists ride_completed_mail on public.rides;
create trigger ride_completed_mail
  after update of status on public.rides
  for each row execute function public.ride_completed_mail_hook();
