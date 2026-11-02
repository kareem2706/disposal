-- ═══════════════════════════════════════════════════════════════
-- Demande par IA (« Décrivez votre itinéraire »)
--   • billing_settings.ai_requests_enabled : interrupteur admin (non par défaut)
--   • ai_request_log : journal des appels, utilisé par la fonction Edge ai-itinerary
--     pour limiter le nombre d'appels par client (lecture / écriture : clé service uniquement)
-- À exécuter une fois dans Supabase › SQL Editor.
-- ═══════════════════════════════════════════════════════════════

alter table public.billing_settings add column if not exists ai_requests_enabled boolean not null default false;

create table if not exists public.ai_request_log (
  id bigserial primary key,
  user_id uuid not null,
  created_at timestamptz not null default now(),
  chars int,
  ok boolean
);
create index if not exists ai_request_log_user_idx on public.ai_request_log (user_id, created_at desc);

alter table public.ai_request_log enable row level security;   -- aucune policy : invisible pour anon / authenticated
revoke all on public.ai_request_log from anon, authenticated;

notify pgrst, 'reload schema';
