-- ════════════════════════════════════════════════════════════════
-- STRIPE CONNECT (Express) — versements automatiques aux flottes. 09/11/2026. Peut être relancé.
-- Prérequis : edge_calls.sql + env_secrets_prod.sql (appel des fonctions serveur depuis la base),
--             extension pg_cron (déjà utilisée par mission_changes.sql).
--
-- Principe (« charges séparées + virements ») :
--   • le client paie Bleenr comme aujourd'hui (Stripe Checkout) ;
--   • une fois la course terminée (+ délai de sécurité), la fonction stripe-payouts vire au compte
--     Stripe de la flotte : prestation TVAC − commission Bleenr TVAC (mêmes règles que la facture
--     de commission, Admin › Facturation) ;
--   • une flotte sans compte Stripe actif reste payée par virement manuel (IBAN), comme avant ;
--   • seules les courses commençant APRÈS l'activation de Stripe par la flotte sont versées par
--     Stripe (les plus anciennes ont été ou seront payées à la main : jamais deux fois).
-- Tables lisibles seulement par la flotte concernée et l'admin ; écrites seulement par le serveur.
-- ════════════════════════════════════════════════════════════════

-- Compte Stripe de chaque flotte (rempli par les fonctions stripe-connect / stripe-webhook)
create table if not exists public.fleet_stripe (
  driver_id          uuid primary key references auth.users(id) on delete cascade,
  account_id         text not null unique,
  details_submitted  boolean not null default false,
  payouts_enabled    boolean not null default false,
  payouts_since      timestamptz,             -- 1re activation : courses à partir de cette date
  requirements_due   text[],                  -- informations encore demandées par Stripe
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- Un versement par course
create table if not exists public.ride_payouts (
  ride_id      uuid primary key,
  driver_id    uuid not null,
  account_id   text not null,
  amount       numeric not null,              -- EUR versés à la flotte
  transfer_id  text,
  status       text not null default 'failed' check (status in ('paid','failed','reversed')),
  error        text,
  attempts     int not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists ride_payouts_driver on public.ride_payouts (driver_id);

alter table public.fleet_stripe enable row level security;
alter table public.ride_payouts enable row level security;
revoke all on public.fleet_stripe, public.ride_payouts from anon, authenticated;
grant select on public.fleet_stripe, public.ride_payouts to authenticated;
grant all on public.fleet_stripe, public.ride_payouts to service_role;

drop policy if exists fleet_stripe_read on public.fleet_stripe;
create policy fleet_stripe_read on public.fleet_stripe for select to authenticated
  using (driver_id = auth.uid()
         or coalesce(auth.jwt() ->> 'email', '') = 'kb@bleenr.com');
drop policy if exists ride_payouts_read on public.ride_payouts;
create policy ride_payouts_read on public.ride_payouts for select to authenticated
  using (driver_id = auth.uid()
         or coalesce(auth.jwt() ->> 'email', '') = 'kb@bleenr.com');

-- Courses à verser : terminées (ou annulées trop tard, donc payées à la flotte), payées en ligne,
-- d'une flotte au compte Stripe actif, commencées après son activation, délai de sécurité écoulé,
-- pas encore versées. p_delay_hours : délai après la fin de la course (réclamations).
create or replace function public.payout_candidates(p_delay_hours int default 24)
returns table(ride_id uuid, driver_id uuid, account_id text, final_price numeric,
              is_subcontract boolean, address_country text, booking_code text)
language sql stable security definer set search_path = public as $$
  select r.id, r.driver_id, fs.account_id, r.final_price::numeric, coalesce(r.is_subcontract, false),
         p.address_country, r.booking_code
    from rides r
    join fleet_stripe fs on fs.driver_id = r.driver_id and fs.payouts_enabled and fs.payouts_since is not null
    left join profiles p on p.id = r.driver_id
    left join ride_payouts rp on rp.ride_id = r.id
   where coalesce(r.is_subcontract, false) = false
     and coalesce(r.final_price, 0) > 0
     and ((r.status = 'done' and coalesce(r.payment_method, 'stripe') in ('stripe', 'credit'))
          or (r.status = 'cancelled' and r.payment_method = 'non_refundable'))
     and _ride_start(r) >= (fs.payouts_since at time zone 'Europe/Brussels')
     and greatest(_ride_start(r), coalesce(r.completed_at at time zone 'Europe/Brussels', _ride_start(r)))
         + make_interval(hours => greatest(p_delay_hours, 0)) < _now_bxl()
     and (rp.ride_id is null or (rp.status = 'failed' and rp.attempts < 20))
   order by _ride_start(r)
   limit 100;
$$;
revoke all on function public.payout_candidates(int) from public, anon, authenticated;
grant execute on function public.payout_candidates(int) to service_role;

-- Toutes les heures : versements dus (fonction stripe-payouts, protégée par notify_hook_secret)
create or replace function public.run_stripe_payouts()
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public._edge_post('stripe-payouts', '{}'::jsonb);
end $$;
revoke all on function public.run_stripe_payouts() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'bleenr_stripe_payouts';
    perform cron.schedule('bleenr_stripe_payouts', '17 * * * *', 'select public.run_stripe_payouts()');
  else
    raise notice 'pg_cron absent : activer l''extension puis relancer ce fichier';
  end if;
end $$;

notify pgrst, 'reload schema';

-- ════════════════════════════════════════════════════════════════
-- Compte Stripe actif OBLIGATOIRE pour faire une offre ou accepter une sous-traitance (09/11/2026)
-- (la flotte voit un bandeau « Activez les versements automatiques » sur son tableau de bord)
-- Vérifié par des déclencheurs : s'applique quelle que soit la fonction qui écrit.
-- L'admin et les traitements automatiques (sans utilisateur connecté) ne sont pas concernés.
-- ════════════════════════════════════════════════════════════════
create or replace function public.fleet_payouts_ok(p_uid uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from fleet_stripe where driver_id = p_uid and payouts_enabled);
$$;
revoke all on function public.fleet_payouts_ok(uuid) from public, anon;
grant execute on function public.fleet_payouts_ok(uuid) to authenticated;

create or replace function public.trg_fleet_stripe_required()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or coalesce(auth.jwt() ->> 'email', '') = 'kb@bleenr.com' then return new; end if;
  if tg_table_name = 'offers' then
    if new.driver_id is distinct from auth.uid() or coalesce(new.status, 'pending') <> 'pending' then return new; end if;
  else  -- rides : sous-traitance prise par la flotte connectée
    if not coalesce(new.is_subcontract, false) or old.driver_id is not null
       or new.driver_id is distinct from auth.uid() then return new; end if;
  end if;
  if not public.fleet_payouts_ok(auth.uid()) then
    raise exception 'STRIPE_REQUIRED: Activez les versements automatiques (Profil › Société) pour recevoir le paiement de vos courses.'
      using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists offers_stripe_required on public.offers;
create trigger offers_stripe_required before insert on public.offers
  for each row execute function public.trg_fleet_stripe_required();
drop trigger if exists rides_stripe_required on public.rides;
create trigger rides_stripe_required before update of driver_id on public.rides
  for each row execute function public.trg_fleet_stripe_required();
revoke all on function public.trg_fleet_stripe_required() from public, anon, authenticated;

notify pgrst, 'reload schema';
