-- ════════════════════════════════════════════════════════════════
-- LANGUE DE L'UTILISATEUR — 06/11/2026. Peut être relancé.
-- profiles.lang : 'fr' | 'en' | 'es'. Par défaut, la langue choisie sur la page
-- au moment de la première connexion (enregistrée par l'application).
-- Utilisée pour l'application, puis pour les e-mails et les documents.
-- api_profile_update accepte déjà la colonne « lang ».
-- ════════════════════════════════════════════════════════════════

alter table public.profiles add column if not exists lang text;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_lang_check') then
    alter table public.profiles add constraint profiles_lang_check check (lang is null or lang in ('fr','en','es'));
  end if;
end $$;

notify pgrst, 'reload schema';
