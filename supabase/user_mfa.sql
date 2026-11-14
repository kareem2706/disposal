-- ════════════════════════════════════════════════════════════════
-- DOUBLE AUTHENTIFICATION (clients, fleets, admin) — 14/11/2026. Peut être relancé.
-- Un compte qui a activé la double authentification (facteur TOTP vérifié) n'a accès à RIEN
-- tant que la connexion n'a pas été validée par le code à 6 chiffres (jeton « aal2 ») :
--   1) chaque appel à l'API de la base (tables et fonctions api_*) passe par _mfa_pre_request ;
--   2) règles d'accès « restrictives » sur toutes les tables (temps réel, stockage) ;
--   3) _api_uid() (utilisée par les fonctions api_*) fait le même contrôle.
-- Les comptes sans double authentification ne voient aucune différence.
-- À exécuter APRÈS admin_mfa.sql.
-- ════════════════════════════════════════════════════════════════

-- Connexion suffisante pour ce compte ? (pas connecté, pas de 2FA, ou 2FA validée)
create or replace function public._mfa_ok()
returns boolean language sql stable security definer set search_path = public, auth, pg_temp as $$
  select auth.uid() is null
      or coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
      or not exists (select 1 from auth.mfa_factors f where f.user_id = auth.uid() and f.status = 'verified');
$$;
revoke all on function public._mfa_ok() from public;
grant execute on function public._mfa_ok() to anon, authenticated, service_role;

-- 1) Contrôle avant chaque requête de l'API (PostgREST)
create or replace function public._mfa_pre_request()
returns void language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not public._mfa_ok() then
    raise exception 'Double authentification requise' using errcode = '42501', hint = 'mfa_required';
  end if;
end $$;
revoke all on function public._mfa_pre_request() from public;
grant execute on function public._mfa_pre_request() to anon, authenticated, service_role;
alter role authenticator set pgrst.db_pre_request to 'public._mfa_pre_request';
notify pgrst, 'reload config';

-- 2) Règle restrictive sur toutes les tables protégées (s'ajoute aux règles existantes)
do $$
declare t record;
begin
  for t in
    select n.nspname s, c.relname r from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where c.relkind = 'r' and c.relrowsecurity and (n.nspname = 'public' or (n.nspname = 'storage' and c.relname = 'objects'))
  loop
    begin
      execute format('drop policy if exists mfa_required on %I.%I', t.s, t.r);
      execute format('create policy mfa_required on %I.%I as restrictive for all to authenticated using ((select public._mfa_ok())) with check ((select public._mfa_ok()))', t.s, t.r);
    exception when others then
      raise warning 'règle mfa_required non créée sur %.% : %', t.s, t.r, sqlerrm;
    end;
  end loop;
end $$;

-- 3) Fonctions api_* : même contrôle
create or replace function public._api_uid()
returns uuid language plpgsql set search_path = public, extensions, pg_temp as $$
declare v uuid := auth.uid();
begin
  if v is null then raise exception 'Connexion requise' using errcode = '42501'; end if;
  if not public._mfa_ok() then raise exception 'Double authentification requise' using errcode = '42501', hint = 'mfa_required'; end if;
  perform set_config('bleenr.as_user', '1', true);
  return v;
end $$;

-- 4) Edge Functions : « ce compte a-t-il activé la double authentification ? » (réservé au serveur)
create or replace function public.mfa_user_enabled(p_uid uuid)
returns boolean language sql stable security definer set search_path = public, auth, pg_temp as $$
  select exists (select 1 from auth.mfa_factors f where f.user_id = p_uid and f.status = 'verified');
$$;
revoke all on function public.mfa_user_enabled(uuid) from public, anon, authenticated;
grant execute on function public.mfa_user_enabled(uuid) to service_role;
