-- ════════════════════════════════════════════════════════════════
-- Appels de la base vers les Edge Functions sans adresse en dur
-- (préparation de l'environnement de développement)
--
-- L'adresse du projet et la clé publique sont lues dans le coffre (vault) :
--   project_url : https://<ref>.supabase.co
--   anon_key    : clé publique « anon » du projet
-- Si elles manquent, aucun appel n'est fait (une base de développement copiée
-- de la production ne peut donc jamais appeler les fonctions de production).
--
-- À lancer sur la PRODUCTION, puis env_secrets_prod.sql. Peut être relancé.
-- ════════════════════════════════════════════════════════════════

-- Adresse d'une Edge Function du projet courant (null si non configuré)
create or replace function public._edge_url(p_fn text)
returns text language sql stable security definer set search_path = public as $$
  select rtrim(decrypted_secret, '/') || '/functions/v1/' || p_fn
    from vault.decrypted_secrets where name = 'project_url' limit 1;
$$;
revoke all on function public._edge_url(text) from public, anon, authenticated;

-- Appel signé (secret partagé notify_hook_secret) d'une Edge Function
create or replace function public._edge_post(p_fn text, p_body jsonb)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare u text := public._edge_url(p_fn);
        k text := (select decrypted_secret from vault.decrypted_secrets where name = 'anon_key' limit 1);
begin
  if u is null or k is null then
    raise notice '[edge] % non appelée : project_url / anon_key absents du coffre', p_fn;
    return;
  end if;
  perform net.http_post(
    url     := u,
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || k,
      'x-hook-secret', coalesce((select decrypted_secret from vault.decrypted_secrets
                                  where name = 'notify_hook_secret' limit 1), '')
    ),
    body    := p_body,
    timeout_milliseconds := 5000
  );
end $$;
revoke all on function public._edge_post(text, jsonb) from public, anon, authenticated;

-- E-mails envoyés par la base (même comportement qu'avant)
create or replace function public._send_mail_hook(p_type text, p_to uuid, p_data jsonb)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  if p_to is null then return; end if;
  perform public._edge_post('send-mail',
    jsonb_build_object('type', p_type, 'to_user_ids', jsonb_build_array(p_to), 'data', p_data));
end $$;
revoke all on function public._send_mail_hook(text, uuid, jsonb) from public, anon, authenticated;

-- Notification des chauffeurs (même comportement qu'avant)
create or replace function public.notify_drivers_hook()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public._edge_post('notify-drivers', jsonb_build_object(
    'type',       TG_OP,
    'table',      TG_TABLE_NAME,
    'record',     to_jsonb(NEW),
    'old_record', case when TG_OP = 'UPDATE' then to_jsonb(OLD) else null end));
  return NEW;
end $$;
revoke all on function public.notify_drivers_hook() from public, anon, authenticated;

notify pgrst, 'reload schema';
