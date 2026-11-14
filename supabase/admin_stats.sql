-- ════════════════════════════════════════════════════════════════
-- STATISTIQUES ADMIN (Admin › Statistiques) — 14/11/2026. Peut être relancé.
--  • user_activity : une ligne par utilisateur, par jour et par support (site, iOS, Android),
--    écrite uniquement par le serveur (api_activity_ping) ; aucun accès direct.
--  • api_activity_ping(platform) : appelé par le site et les apps à l'ouverture.
--  • api_admin_stats(days) : chiffres de l'écran Statistiques, réservé à l'admin.
-- ════════════════════════════════════════════════════════════════

create table if not exists public.user_activity (
  user_id  uuid not null references auth.users(id) on delete cascade,
  day      date not null default (now() at time zone 'Europe/Brussels')::date,
  platform text not null check (platform in ('web','ios','android')),
  first_at timestamptz not null default now(),
  last_at  timestamptz not null default now(),
  hits     int not null default 1,
  primary key (user_id, day, platform)
);
alter table public.user_activity enable row level security;
revoke all on public.user_activity from anon, authenticated;
create index if not exists user_activity_day on public.user_activity(day);

-- Activité du jour (une ligne par jour et par support ; les appels suivants mettent juste l'heure à jour)
create or replace function public.api_activity_ping(p_platform text)
returns void language plpgsql security definer set search_path = public as $$
declare v uuid := auth.uid();
begin
  if v is null or p_platform not in ('web','ios','android') then return; end if;
  insert into user_activity(user_id, platform) values (v, p_platform)
  on conflict (user_id, day, platform) do update
    set last_at = now(), hits = least(user_activity.hits + 1, 100000)
    where user_activity.last_at < now() - interval '2 minutes';
end $$;
revoke all on function public.api_activity_ping(text) from public, anon;
grant execute on function public.api_activity_ping(text) to authenticated;

-- Chiffres de l'écran Statistiques (admin uniquement). Le compte admin est exclu des chiffres.
create or replace function public.api_admin_stats(p_days int default 30)
returns jsonb language plpgsql stable security definer set search_path = public, auth as $$
declare
  d int := greatest(7, least(coalesce(p_days, 30), 365));
  t date := (now() at time zone 'Europe/Brussels')::date;
  since date := t - (d - 1);
  r jsonb;
begin
  if not public._api_admin() then raise exception 'Réservé à l''administrateur' using errcode = '42501'; end if;

  with u as (
    select au.id, au.created_at, au.last_sign_in_at, p.role, p.client_type,
           coalesce(nullif(p.company_name,''), nullif(trim(coalesce(p.first_name,'')||' '||coalesce(p.last_name,'')),''), au.email) as name,
           au.email
      from auth.users au left join profiles p on p.id = au.id
     where coalesce(p.role,'') <> 'admin'
  ),
  days as (select generate_series(since, t, interval '1 day')::date as day),
  act as (select a.* from user_activity a join u on u.id = a.user_id where a.day >= least(since, t - 29)),
  rd as (select r.* from rides r where r.status <> 'personal')
  select jsonb_build_object(
    'days', d, 'since', since, 'today', t,
    'users', jsonb_build_object(
      'total',   (select count(*) from u),
      'clients', (select count(*) from u where role = 'client'),
      'perso',   (select count(*) from u where role = 'client' and coalesce(client_type,'perso') <> 'pro'),
      'pro',     (select count(*) from u where role = 'client' and client_type = 'pro'),
      'fleets',  (select count(*) from u where role = 'driver'),
      'new',     (select count(*) from u where (created_at at time zone 'Europe/Brussels')::date >= since)),
    'active', jsonb_build_object(
      'tracked_since', (select min(day) from user_activity),
      'd1',  (select count(distinct user_id) from act where day = t),
      'd7',  (select count(distinct user_id) from act where day > t - 7),
      'd30', (select count(distinct user_id) from act where day > t - 30),
      'login7',  (select count(*) from u where last_sign_in_at > now() - interval '7 days'),
      'login30', (select count(*) from u where last_sign_in_at > now() - interval '30 days'),
      'platforms', (select coalesce(jsonb_object_agg(platform, n), '{}'::jsonb)
                      from (select platform, count(distinct user_id) n from act where day > t - 30 group by platform) x)),
    'series', (select jsonb_agg(jsonb_build_object(
        'day', days.day,
        'signup_clients', (select count(*) from u where role = 'client' and (created_at at time zone 'Europe/Brussels')::date = days.day),
        'signup_fleets',  (select count(*) from u where role = 'driver' and (created_at at time zone 'Europe/Brussels')::date = days.day),
        'active_web',     (select count(distinct user_id) from act where day = days.day and platform = 'web'),
        'active_ios',     (select count(distinct user_id) from act where day = days.day and platform = 'ios'),
        'active_android', (select count(distinct user_id) from act where day = days.day and platform = 'android'),
        'active',         (select count(distinct user_id) from act where day = days.day),
        'rides',          (select count(*) from rd where (created_at at time zone 'Europe/Brussels')::date = days.day)
      ) order by days.day) from days),
    'rides', (select jsonb_build_object(
        'created',   count(*),
        'waiting',   count(*) filter (where status in ('waiting','offers')),
        'confirmed', count(*) filter (where status in ('confirmed','active')),
        'done',      count(*) filter (where status = 'done'),
        'cancelled', count(*) filter (where status = 'cancelled'),
        'revenue',   coalesce(sum(final_price) filter (where status = 'done'), 0))
      from rd where (created_at at time zone 'Europe/Brussels')::date >= since),
    'recent', (select coalesce(jsonb_agg(x order by x.last_sign_in_at desc), '[]'::jsonb) from (
        select u.name, u.email, u.role, u.client_type, u.last_sign_in_at, u.created_at,
               (select max(last_at) from user_activity a where a.user_id = u.id) as last_seen,
               (select array_agg(distinct platform) from user_activity a where a.user_id = u.id and a.day > t - 30) as platforms
          from u where u.last_sign_in_at is not null order by u.last_sign_in_at desc limit 20) x)
  ) into r;
  return r;
end $$;
revoke all on function public.api_admin_stats(int) from public, anon;
grant execute on function public.api_admin_stats(int) to authenticated;
