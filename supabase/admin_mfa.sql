-- ════════════════════════════════════════════════════════════════
-- ADMIN : DOUBLE AUTHENTIFICATION OBLIGATOIRE — 14/11/2026. Peut être relancé.
-- Les droits d'administrateur exigent désormais, en plus de l'e-mail kb@bleenr.com,
-- une connexion validée par un code de l'application d'authentification (jeton « aal2 »).
-- Un mot de passe ou un code e-mail volé ne donne plus aucun droit admin.
--
-- Toutes les vérifications admin (fonctions et règles d'accès) passent par public._api_admin().
-- Les fonctions qui identifient simplement le compte admin (_is_user_not_admin, _is_app_user,
-- notify_admin_ride_report) ne donnent aucun droit et ne sont pas modifiées.
--
-- Secours si le téléphone est perdu : Supabase › Authentication › Users › kb@bleenr.com › supprimer le facteur MFA
-- (réservé à qui a accès au tableau de bord Supabase), puis réactiver la double authentification sur le site.
-- ════════════════════════════════════════════════════════════════

-- 1) Le seul test « admin » : e-mail + double authentification validée
create or replace function public._api_admin()
returns boolean language sql stable set search_path = public, extensions, pg_temp as $$
  select lower(coalesce(auth.jwt() ->> 'email', '')) = 'kb@bleenr.com'
     and coalesce(auth.jwt() ->> 'aal', '') = 'aal2';
$$;

-- 2) Fonctions qui donnaient des droits sur le seul e-mail → public._api_admin()
do $$
declare f record; d text; n text;
begin
  for f in
    select p.oid, p.proname from pg_proc p join pg_namespace s on s.oid = p.pronamespace
     where s.nspname = 'public'
       and p.proname in ('ride_assigned_driver','can_notify','can_see_vehicle','can_see_profile','invoice_parties',
                         'invoice_number','trg_ride_target_check','trg_fleet_stripe_required')
  loop
    d := pg_get_functiondef(f.oid);
    n := replace(replace(d,
           'coalesce(auth.jwt() ->> ''email'', '''') = ''kb@bleenr.com''', 'public._api_admin()'),
           '(auth.jwt() ->> ''email'') = ''kb@bleenr.com''', 'public._api_admin()');
    if n <> d then execute n; raise notice 'fonction % : admin = _api_admin()', f.proname; end if;
    if n ilike '%kb@bleenr.com%' then raise warning 'fonction % : e-mail admin encore présent', f.proname; end if;
  end loop;
end $$;

-- 3) Règles d'accès (RLS) qui donnaient des droits sur le seul e-mail → public._api_admin()
do $$
declare p record; q text; c text; sql text;
  function_call constant text := 'public._api_admin()';
begin
  for p in
    select schemaname, tablename, policyname, qual, with_check from pg_policies
     where coalesce(qual,'') || coalesce(with_check,'') ilike '%kb@bleenr.com%'
  loop
    q := p.qual; c := p.with_check;
    q := replace(replace(replace(q,
           '((auth.jwt() ->> ''email''::text) = ''kb@bleenr.com''::text)', function_call),
           '(COALESCE((auth.jwt() ->> ''email''::text), ''''::text) = ''kb@bleenr.com''::text)', function_call),
           '(auth.email() = ''kb@bleenr.com''::text)', function_call);
    c := replace(replace(replace(c,
           '((auth.jwt() ->> ''email''::text) = ''kb@bleenr.com''::text)', function_call),
           '(COALESCE((auth.jwt() ->> ''email''::text), ''''::text) = ''kb@bleenr.com''::text)', function_call),
           '(auth.email() = ''kb@bleenr.com''::text)', function_call);
    if coalesce(q,'') || coalesce(c,'') ilike '%kb@bleenr.com%' then
      raise warning 'règle %.% « % » : format non reconnu, non modifiée', p.schemaname, p.tablename, p.policyname; continue;
    end if;
    sql := format('alter policy %I on %I.%I', p.policyname, p.schemaname, p.tablename)
        || case when q is not null then ' using (' || q || ')' else '' end
        || case when c is not null then ' with check (' || c || ')' else '' end;
    begin
      execute sql;
      raise notice 'règle %.% « % » : admin = _api_admin()', p.schemaname, p.tablename, p.policyname;
    exception when others then
      raise warning 'règle %.% « % » non modifiée : %', p.schemaname, p.tablename, p.policyname, sqlerrm;
    end;
  end loop;
end $$;

-- Contrôle : doit renvoyer 0 ligne (hors fonctions d'identification listées en tête de fichier)
-- select schemaname, tablename, policyname from pg_policies where coalesce(qual,'')||coalesce(with_check,'') ilike '%kb@bleenr.com%';
