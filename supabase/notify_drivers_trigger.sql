-- ════════════════════════════════════════════════════════════════
-- Déclencheur des notifications push (remplace le Database Webhook du tableau de bord)
-- À chaque INSERT / UPDATE sur rides, appelle l'Edge Function notify-drivers
-- avec le même contenu qu'un webhook : { type, table, record, old_record }.
-- Prérequis : push_tokens.sql exécuté et Edge Function notify-drivers déployée.
-- À exécuter une fois dans Supabase → SQL Editor.
-- ════════════════════════════════════════════════════════════════

-- 1) Extension d'appels HTTP depuis Postgres
create extension if not exists pg_net with schema extensions;

-- 2) Fonction appelée par le déclencheur.
--    La clé utilisée est la clé publique « anon » (déjà présente dans le site) :
--    elle sert seulement à passer la vérification JWT de l'Edge Function,
--    qui lit ensuite la base avec sa propre clé service.
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
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1emZvcWR4bXh6ampodmx4c2diIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0MzIyNDcsImV4cCI6MjA5MDAwODI0N30.xJU8CmI0KGiEl-YA87Rtv8yrrFkPU8_dAlUrY85DDzs'
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

-- 3) Déclencheur sur la table rides (insertion + modification)
drop trigger if exists notify_drivers_on_rides on public.rides;
create trigger notify_drivers_on_rides
after insert or update on public.rides
for each row execute function public.notify_drivers_hook();
