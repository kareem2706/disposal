-- ════════════════════════════════════════════════════════════════
-- CAMPAGNES E-MAIL (admin) — 21/10/2026. Peut être relancé sans risque.
-- À exécuter APRÈS client_notif_prefs.sql.
--  • email_campaigns : historique des campagnes envoyées (lisible par l'admin)
--  • préférence « marketing » (offres et nouveautés Bleenr) : un destinataire
--    désinscrit (lien en bas de chaque e-mail ou profil client) ne reçoit plus
--    de campagne. Les e-mails liés aux courses ne sont pas concernés.
-- Les envois sont faits par l'Edge Function « campaign » (admin uniquement).
-- ════════════════════════════════════════════════════════════════

create table if not exists public.email_campaigns (
  id          uuid primary key default gen_random_uuid(),
  audience    text not null,                 -- fleets | clients
  subject     text not null,
  title       text,
  body        text,
  cta_label   text,
  cta_url     text,
  recipients  int  not null default 0,       -- destinataires sélectionnés
  sent        int  not null default 0,       -- e-mails acceptés par Resend
  skipped     int  not null default 0,       -- désinscrits / sans adresse
  created_at  timestamptz not null default now()
);
alter table public.email_campaigns enable row level security;
drop policy if exists email_campaigns_admin_read on public.email_campaigns;
create policy email_campaigns_admin_read on public.email_campaigns for select to authenticated
  using ((auth.jwt() ->> 'email') = 'kb@bleenr.com');
revoke all on public.email_campaigns from anon;
revoke insert, update, delete, truncate on public.email_campaigns from authenticated;
grant select on public.email_campaigns to authenticated;
grant all on public.email_campaigns to service_role;

-- Préférences : ajoute la clé « marketing » (e-mail uniquement) aux clés acceptées
create or replace function public._notif_prefs_merge(p_old jsonb, p_new jsonb)
returns jsonb language sql immutable as $$
  select jsonb_build_object(
    'app',   coalesce(p_old -> 'app', '{}'::jsonb)   || coalesce((select jsonb_object_agg(k, (p_new -> 'app'   ->> k) <> 'false')
                 from unnest(array['ride_published','offer_received','offer_updated','ride_confirmed','driver_message','driver_on_way']) k
                where p_new -> 'app' ? k), '{}'::jsonb),
    'email', coalesce(p_old -> 'email', '{}'::jsonb) || coalesce((select jsonb_object_agg(k, (p_new -> 'email' ->> k) <> 'false')
                 from unnest(array['ride_published','offer_received','offer_updated','ride_confirmed','driver_message','driver_on_way','marketing']) k
                where p_new -> 'email' ? k), '{}'::jsonb));
$$;

notify pgrst, 'reload schema';
