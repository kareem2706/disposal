-- ════════════════════════════════════════════════════════════════
-- PAIEMENTS STRIPE — suivi des sessions + confirmation atomique (19/10/2026)
-- À exécuter APRÈS security_payments_privacy.sql. Peut être relancé.
--
-- • ride_checkouts : chaque session Stripe créée pour une course.
--   Permet de n'avoir qu'une session ouverte par course et de savoir
--   quelle session a confirmé la course (les autres sont remboursées).
-- • confirm_ride_payment : confirme la course pour une session payée,
--   une seule fois. Renvoie un code au lieu d'une erreur pour que
--   l'Edge Function sache s'il faut rembourser.
-- Lecture / écriture réservées au serveur (clé service_role).
-- ════════════════════════════════════════════════════════════════

create table if not exists public.ride_checkouts (
  session_id  text primary key,
  ride_id     uuid not null,
  offer_id    uuid,
  user_id     uuid,
  amount      numeric,
  status      text not null default 'open',   -- open | expired | paid | refunded
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists ride_checkouts_ride on public.ride_checkouts (ride_id);
alter table public.ride_checkouts enable row level security;   -- aucune règle : invisible pour l'app
revoke all on public.ride_checkouts from anon, authenticated;
grant all on public.ride_checkouts to service_role;

create or replace function public.confirm_ride_payment(
  p_session text, p_ride uuid, p_offer uuid, p_amount numeric)
returns table(result text, driver uuid)
language plpgsql security definer set search_path = public
as $$
declare v_ride rides%rowtype; v_off offers%rowtype; v_prev text;
begin
  -- verrou sur la course : deux confirmations simultanées passent l'une après l'autre
  select * into v_ride from rides where id = p_ride for update;
  if not found then
    return query select 'not_confirmable'::text, null::uuid; return;
  end if;

  select c.status into v_prev from ride_checkouts c where c.session_id = p_session;
  if v_prev = 'paid' then                      -- déjà traité (webhook + retour app)
    return query select 'already'::text, v_ride.driver_id; return;
  end if;
  if v_prev = 'refunded' then
    return query select 'refunded'::text, null::uuid; return;
  end if;

  -- une autre session a déjà payé cette course → celle-ci est en trop
  if exists (select 1 from ride_checkouts c
             where c.ride_id = p_ride and c.status = 'paid' and c.session_id <> p_session) then
    return query select 'duplicate'::text, null::uuid; return;
  end if;

  select * into v_off from offers where id = p_offer and ride_id = p_ride;
  if not found or v_ride.status not in ('waiting','offers') then
    -- course annulée, déjà confirmée autrement, offre retirée…
    return query select 'not_confirmable'::text, null::uuid; return;
  end if;

  update offers set status = 'accepted' where id = p_offer;
  update offers set status = 'rejected' where ride_id = p_ride and id <> p_offer;
  update rides set status = 'confirmed', driver_id = v_off.driver_id,
                   final_price = p_amount, payment_method = 'stripe'
   where id = p_ride;

  -- Note au chauffeur (comme _promoteNotesToDriver dans l'app) : la note libre
  -- du client devient |note_drv: pour la fleet retenue
  update rides r set notes = coalesce(r.notes,'') || '|note_drv:' || x.c
    from (select trim(regexp_replace(regexp_replace(regexp_replace(coalesce(notes,''),
                 '\|(pax|tel|pemail|pref|flight|train):[^|]*', '', 'g'),
                 '^Mixte:.*$', '', 'n'),
                 'Durée:[^\s|]+', '', 'g')) as c
            from rides where id = p_ride) x
   where r.id = p_ride and coalesce(r.notes,'') !~ '\|note_drv:' and x.c <> '';

  insert into ride_checkouts (session_id, ride_id, offer_id, amount, status, updated_at)
  values (p_session, p_ride, p_offer, p_amount, 'paid', now())
  on conflict (session_id) do update
    set status = 'paid', amount = excluded.amount, updated_at = now();

  return query select 'confirmed'::text, v_off.driver_id;
end $$;

revoke all on function public.confirm_ride_payment(text, uuid, uuid, numeric) from public, anon, authenticated;
grant execute on function public.confirm_ride_payment(text, uuid, uuid, numeric) to service_role;

notify pgrst, 'reload schema';
