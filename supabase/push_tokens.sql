-- ════════════════════════════════════════════════════════════════
-- Notifications push de l'app Bleenr Chauffeur
-- Une ligne par téléphone : jeton Expo + préférences du chauffeur.
-- À exécuter une fois dans Supabase → SQL Editor.
-- ════════════════════════════════════════════════════════════════

create table if not exists public.push_tokens (
  token      text primary key,                                   -- ExponentPushToken[...]
  user_id    uuid not null references auth.users(id) on delete cascade,
  platform   text,                                               -- ios / android
  prefs      jsonb not null default '{"new_request":true,"request_updated":true,"request_cancelled":true,"offer_accepted":true}'::jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists push_tokens_user_idx on public.push_tokens(user_id);

alter table public.push_tokens enable row level security;

-- Droits explicites (Supabase ne les donne plus automatiquement aux nouvelles tables à partir du 30/10/2026).
-- Lecture encadrée par les règles RLS ; écritures uniquement par les fonctions serveur (api_*) et les Edge Functions.
revoke all on public.push_tokens from anon;
grant select on public.push_tokens to authenticated;
grant all on public.push_tokens to service_role;

-- Chaque chauffeur ne voit et ne gère que ses propres téléphones.
-- L'Edge Function notify-drivers lit toute la table avec la clé service (RLS contournée).
drop policy if exists push_tokens_own_select on public.push_tokens;
create policy push_tokens_own_select on public.push_tokens for select using (auth.uid() = user_id);

drop policy if exists push_tokens_own_insert on public.push_tokens;
create policy push_tokens_own_insert on public.push_tokens for insert with check (auth.uid() = user_id);

-- Un jeton peut changer de compte (déconnexion / reconnexion avec un autre compte sur le même téléphone)
drop policy if exists push_tokens_own_update on public.push_tokens;
create policy push_tokens_own_update on public.push_tokens for update using (true) with check (auth.uid() = user_id);

drop policy if exists push_tokens_own_delete on public.push_tokens;
create policy push_tokens_own_delete on public.push_tokens for delete using (auth.uid() = user_id);
