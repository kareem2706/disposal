-- ════════════════════════════════════════════════════════════════
-- ACCEPTATION DES CONDITIONS À L'INSCRIPTION — 14/11/2026. Peut être relancé.
--  • inscription par e-mail : refusée par le serveur si les conditions n'ont pas été acceptées
--    (interrupteur « J'accepte les conditions générales… » du formulaire, transmis avec l'inscription) ;
--  • inscription Google / Microsoft : interrupteur obligatoire avant la redirection, puis acceptation
--    enregistrée par api_terms_accept() ; un nouveau compte sans acceptation doit accepter avant d'entrer ;
--  • date et version de l'acceptation conservées sur le profil (preuve).
-- ════════════════════════════════════════════════════════════════

alter table public.profiles add column if not exists terms_accepted_at timestamptz,
                            add column if not exists terms_version text;

-- 1) Compte e-mail créé sans acceptation : refusé
create or replace function public.trg_auth_terms_required()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if coalesce(new.raw_app_meta_data ->> 'provider', 'email') = 'email'
     and coalesce(new.raw_user_meta_data ->> 'terms_accepted', '') <> 'true' then
    raise exception 'Vous devez accepter les conditions générales pour créer un compte.' using errcode = 'P0001';
  end if;
  return new;
end $$;
revoke all on function public.trg_auth_terms_required() from public, anon, authenticated;
drop trigger if exists "0_terms_required" on auth.users;
create trigger "0_terms_required" before insert on auth.users
  for each row execute function public.trg_auth_terms_required();

-- 2) Profil créé : acceptation reprise de l'inscription
create or replace function public.trg_profiles_terms()
returns trigger language plpgsql security definer set search_path = public, auth, pg_temp as $$
declare m jsonb;
begin
  if new.terms_accepted_at is null then
    select raw_user_meta_data into m from auth.users where id = new.id;
    if coalesce(m ->> 'terms_accepted', '') = 'true' then
      new.terms_accepted_at := now();
      new.terms_version := left(coalesce(m ->> 'terms_version', 'web'), 40);
    end if;
  end if;
  return new;
end $$;
revoke all on function public.trg_profiles_terms() from public, anon, authenticated;
drop trigger if exists "1_terms" on public.profiles;
create trigger "1_terms" before insert on public.profiles
  for each row execute function public.trg_profiles_terms();

-- 3) Acceptation après une inscription Google / Microsoft (ou un compte récent sans acceptation)
create or replace function public.api_terms_accept(p_version text default null)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare uid uuid := _api_uid();
begin
  update profiles set terms_accepted_at = coalesce(terms_accepted_at, now()),
                      terms_version = coalesce(terms_version, left(coalesce(p_version, 'web'), 40))
   where id = uid;
  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.api_terms_accept(text) from public, anon;
grant execute on function public.api_terms_accept(text) to authenticated;
