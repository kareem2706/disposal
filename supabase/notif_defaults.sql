-- ════════════════════════════════════════════════════════════════
-- NOTIFICATIONS ACTIVÉES PAR DÉFAUT À L'INSCRIPTION — 13/11/2026. Peut être relancé.
-- À exécuter APRÈS client_notif_prefs.sql, email_campaigns.sql et mission_change_emails.sql.
--
--  • nouveau profil (client ou chauffeur, quel que soit le mode d'inscription) :
--    toutes les préférences « Appli » et « E-mail » sont enregistrées à oui ;
--  • profils existants : les préférences manquantes sont enregistrées à oui,
--    les choix déjà faits (oui / non) sont conservés ;
--  • téléphones (push_tokens.prefs) : idem pour les notifications push des chauffeurs.
-- Ensuite, chaque utilisateur désactive ce qu'il veut (Profil → Notifications).
-- ════════════════════════════════════════════════════════════════

-- Toutes les préférences connues, à oui
create or replace function public._notif_defaults()
returns jsonb language sql immutable as $$
  select jsonb_build_object(
    'app',   (select jsonb_object_agg(k, true) from unnest(array['ride_published','offer_received','offer_updated','ride_confirmed',
               'driver_message','driver_on_way','ride_changes','mission_changed']) k),
    'email', (select jsonb_object_agg(k, true) from unnest(array['ride_published','offer_received','offer_updated','ride_confirmed',
               'driver_message','driver_on_way','ride_changes','mission_changed','marketing']) k));
$$;

-- Valeurs par défaut complétées par les choix existants (un choix existant est toujours conservé)
create or replace function public._notif_with_defaults(p jsonb)
returns jsonb language sql immutable as $$
  select coalesce(p, '{}'::jsonb) || jsonb_build_object(
    'app',   (public._notif_defaults() -> 'app')   || coalesce(p -> 'app', '{}'::jsonb),
    'email', (public._notif_defaults() -> 'email') || coalesce(p -> 'email', '{}'::jsonb));
$$;

-- Nouveau profil : préférences enregistrées à oui
create or replace function public.trg_profiles_notif_defaults()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.notif_prefs := public._notif_with_defaults(new.notif_prefs);
  return new;
end $$;
drop trigger if exists "0_notif_defaults" on public.profiles;
create trigger "0_notif_defaults" before insert on public.profiles
  for each row execute function public.trg_profiles_notif_defaults();

-- Profils existants : préférences manquantes enregistrées à oui
update public.profiles
   set notif_prefs = public._notif_with_defaults(notif_prefs)
 where notif_prefs is distinct from public._notif_with_defaults(notif_prefs);

-- Push des chauffeurs (par téléphone) : toutes les notifications à oui par défaut
alter table public.push_tokens alter column prefs
  set default '{"new_request":true,"request_updated":true,"request_cancelled":true,"offer_accepted":true,"sub_update":true}'::jsonb;
update public.push_tokens
   set prefs = '{"new_request":true,"request_updated":true,"request_cancelled":true,"offer_accepted":true,"sub_update":true}'::jsonb || coalesce(prefs, '{}'::jsonb)
 where not (coalesce(prefs, '{}'::jsonb) ?& array['new_request','request_updated','request_cancelled','offer_accepted','sub_update']);
