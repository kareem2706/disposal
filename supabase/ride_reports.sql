-- Signalements de problème envoyés par les clients pendant une course
create table if not exists public.ride_reports (
  id          uuid primary key default gen_random_uuid(),
  ride_id     uuid not null references public.rides(id) on delete cascade,
  client_id   uuid not null references auth.users(id) on delete cascade,
  message     text not null check (char_length(message) between 5 and 2000),
  status      text not null default 'open',
  created_at  timestamptz not null default now()
);

alter table public.ride_reports enable row level security;

-- Le client ne peut signaler que ses propres courses
drop policy if exists ride_reports_insert_own on public.ride_reports;
create policy ride_reports_insert_own on public.ride_reports
  for insert to authenticated
  with check (
    client_id = auth.uid()
    and exists (select 1 from public.rides r where r.id = ride_id and r.client_id = auth.uid())
  );

drop policy if exists ride_reports_select_own on public.ride_reports;
create policy ride_reports_select_own on public.ride_reports
  for select to authenticated
  using (client_id = auth.uid() or (auth.jwt() ->> 'email') = 'kb@bleenr.com');

-- Notification in-app pour l'admin à chaque signalement
create or replace function public.notify_admin_ride_report()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  admin_id uuid;
begin
  select id into admin_id from auth.users where email = 'kb@bleenr.com' limit 1;
  if admin_id is not null then
    insert into public.notifications (user_id, type, title, body, ride_id, read)
    values (
      admin_id, 'ride_problem', '⚠️ Problème signalé par un client',
      replace(replace(left(new.message, 300), '<', '&lt;'), '>', '&gt;'),
      new.ride_id, false
    );
  end if;
  return new;
end $$;

drop trigger if exists trg_ride_reports_notify on public.ride_reports;
create trigger trg_ride_reports_notify
  after insert on public.ride_reports
  for each row execute function public.notify_admin_ride_report();
