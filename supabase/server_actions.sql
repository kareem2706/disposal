-- ════════════════════════════════════════════════════════════════
-- ACTIONS SERVEUR — 20/10/2026 (étape 1 sur 2). Peut être relancé sans risque.
-- À exécuter APRÈS security_hardening4.sql.
--
-- Toutes les écritures du site et de l'app passent désormais par ces
-- fonctions (sb.rpc('api_…')). Chacune vérifie :
--   • qui appelle (connexion obligatoire, rôle, propriétaire de la donnée)
--   • ce qui est demandé (statut de la course, étape autorisée…)
--   • les valeurs envoyées (seuls les champs prévus sont pris en compte)
-- Les garde-fous existants (déclencheurs) restent actifs en plus.
--
-- Étape 2 (server_actions_lock.sql) : interdit toute écriture directe dans
-- les tables. À lancer quand le site ET la nouvelle app iOS sont en ligne.
-- ════════════════════════════════════════════════════════════════

-- ────────────────────────────────────────────────────────────────
-- 0. SOCLE
-- ────────────────────────────────────────────────────────────────

-- Les garde-fous s'appliquent aussi pendant une action serveur (drapeau bleenr.as_user)
create or replace function public._is_app_user()
returns boolean language sql stable as $$
  select (current_user in ('authenticated','anon') or current_setting('bleenr.as_user', true) = '1')
     and coalesce(auth.jwt() ->> 'email','') <> 'kb@bleenr.com';
$$;

-- Utilisateur connecté (sinon erreur) ; active les garde-fous pour la suite de l'action
create or replace function public._api_uid()
returns uuid language plpgsql as $$
declare v uuid := auth.uid();
begin
  if v is null then raise exception 'Connexion requise' using errcode = '42501'; end if;
  perform set_config('bleenr.as_user', '1', true);
  return v;
end $$;

create or replace function public._api_admin()
returns boolean language sql stable as $$
  select coalesce(auth.jwt() ->> 'email','') = 'kb@bleenr.com';
$$;

-- Écriture serveur de confiance (calculs faits par le serveur lui-même)
create or replace function public._api_trusted(p_on boolean)
returns void language sql as $$
  select set_config('bleenr.as_user', case when p_on then '0' else '1' end, true);
$$;

-- Ne garde que les champs autorisés qui existent vraiment dans la table
create or replace function public._api_cols(p_table regclass, p_data jsonb, p_allowed text[])
returns jsonb language sql stable as $$
  select coalesce(jsonb_object_agg(e.key, e.value), '{}'::jsonb)
    from jsonb_each(coalesce(p_data, '{}'::jsonb)) e
   where e.key = any(p_allowed)
     and exists (select 1 from pg_attribute a
                  where a.attrelid = p_table and a.attname = e.key and a.attnum > 0 and not a.attisdropped);
$$;

create or replace function public._api_insert(p_table regclass, p_data jsonb)
returns jsonb language plpgsql as $$
declare cols text; r jsonb;
begin
  select string_agg(format('%I', k), ', ') into cols from jsonb_object_keys(p_data) k;
  execute format('insert into %s as t (%s) select %s from jsonb_populate_record(null::%s, $1) returning to_jsonb(t)',
                 p_table, cols, cols, p_table) into r using p_data;
  return r;
end $$;

create or replace function public._api_update(p_table regclass, p_id text, p_data jsonb)
returns jsonb language plpgsql as $$
declare sets text; r jsonb;
begin
  select string_agg(format('%I = x.%I', k, k), ', ') into sets from jsonb_object_keys(p_data) k;
  if sets is null then
    execute format('select to_jsonb(t) from %s t where t.id::text = $1', p_table) into r using p_id;
  else
    execute format('update %s t set %s from jsonb_populate_record(null::%s, $1) x where t.id::text = $2 returning to_jsonb(t)',
                   p_table, sets, p_table) into r using p_data, p_id;
  end if;
  return r;
end $$;

-- Texte libre : pas de « | » (séparateur des étiquettes de la note), longueur bornée
create or replace function public._api_txt(p text, p_max int default 1000)
returns text language sql immutable as $$
  select nullif(left(trim(replace(coalesce(p,''), '|', '/')), p_max), '');
$$;

-- Remplace une étiquette |tag:… dans une note (valeur vide = suppression)
create or replace function public._api_set_tag(p_notes text, p_tag text, p_value text)
returns text language sql immutable as $$
  select nullif(rtrim(regexp_replace(coalesce(p_notes,''), '\|' || p_tag || ':[^|]*', '', 'g'))
         || coalesce('|' || p_tag || ':' || public._api_txt(p_value, 1000), ''), '');
$$;

-- Heure de la course (heure de Bruxelles)
create or replace function public._ride_start(r public.rides)
returns timestamp language plpgsql stable as $$
declare j jsonb := to_jsonb(r);
begin
  return (j ->> 'ride_date')::date + coalesce(nullif(left(j ->> 'ride_time', 5), '')::time, '00:00'::time);
exception when others then return null;
end $$;

create or replace function public._now_bxl()
returns timestamp language sql stable as $$ select now() at time zone 'Europe/Brussels'; $$;

-- Pays de la course (dernière partie de l'adresse de départ), comme le site
create or replace function public._ride_country(p_addr text)
returns text language sql immutable as $$
  select case lower(trim(regexp_replace(coalesce(p_addr,''), '^.*,', '')))
    when 'belgique' then 'BE' when 'belgium' then 'BE' when 'belgië' then 'BE' when 'belgien' then 'BE'
    when 'france' then 'FR' when 'frankrijk' then 'FR'
    when 'pays-bas' then 'NL' when 'netherlands' then 'NL' when 'nederland' then 'NL'
    when 'luxembourg' then 'LU' when 'luxemburg' then 'LU'
    when 'allemagne' then 'DE' when 'germany' then 'DE' when 'deutschland' then 'DE'
    when 'espagne' then 'ES' when 'spain' then 'ES' when 'españa' then 'ES'
    when 'italie' then 'IT' when 'italy' then 'IT' when 'italia' then 'IT'
    when 'portugal' then 'PT'
    when 'autriche' then 'AT' when 'austria' then 'AT' when 'österreich' then 'AT'
    when 'irlande' then 'IE' when 'ireland' then 'IE'
    when 'danemark' then 'DK' when 'denmark' then 'DK'
    when 'suède' then 'SE' when 'sweden' then 'SE'
    when 'finlande' then 'FI' when 'finland' then 'FI'
    when 'pologne' then 'PL' when 'poland' then 'PL' when 'polska' then 'PL'
    when 'tchéquie' then 'CZ' when 'czechia' then 'CZ' when 'czech republic' then 'CZ'
    when 'grèce' then 'GR' when 'greece' then 'GR'
    when 'suisse' then 'CH' when 'switzerland' then 'CH' when 'schweiz' then 'CH'
    when 'royaume-uni' then 'GB' when 'united kingdom' then 'GB' when 'uk' then 'GB'
    when 'monaco' then 'MC'
    else 'BE' end;
$$;

-- Délai d'annulation remboursable (Admin → Facturation), 48 h par défaut
create or replace function public._refund_delay_hours(r public.rides)
returns int language plpgsql stable security definer set search_path = public as $$
declare v jsonb; c text := _ride_country(r.from_address); h int;
begin
  select to_jsonb(b) -> 'refund_delays' into v from billing_settings b where b.id = 1;
  select (x ->> 'hours')::int into h from jsonb_array_elements(case when jsonb_typeof(v) = 'array' then v else '[]'::jsonb end) x
   where x ->> 'country' = c limit 1;
  if h is null then
    select (x ->> 'hours')::int into h from jsonb_array_elements(case when jsonb_typeof(v) = 'array' then v else '[]'::jsonb end) x
     where x ->> 'country' = 'BE' limit 1;
  end if;
  return coalesce(h, 48);
exception when others then return 48;
end $$;

-- Notification dans l'application (cloche)
create or replace function public._api_notify(p_user uuid, p_type text, p_title text, p_body text, p_ride uuid)
returns void language sql security definer set search_path = public as $$
  insert into notifications (user_id, type, title, body, ride_id, read)
  select p_user, p_type, p_title, p_body, p_ride, false where p_user is not null;
$$;

do $$
declare f text;
begin
  foreach f in array array['public._api_uid()','public._api_trusted(boolean)','public._api_cols(regclass, jsonb, text[])',
                           'public._api_insert(regclass, jsonb)','public._api_update(regclass, text, jsonb)',
                           'public._refund_delay_hours(public.rides)','public._api_notify(uuid, text, text, text, uuid)'] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
  end loop;
end $$;

-- ────────────────────────────────────────────────────────────────
-- 1. PROFIL
-- ────────────────────────────────────────────────────────────────

-- Coordonnées bancaires : table à part, lisible seulement par la fleet et l'admin
-- (avant : dans profiles, donc visibles des clients qui recevaient une offre)
create table if not exists public.profile_bank (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  iban        text,
  bic         text,
  bank_holder text,
  updated_at  timestamptz not null default now()
);
alter table public.profile_bank enable row level security;
drop policy if exists profile_bank_read on public.profile_bank;
create policy profile_bank_read on public.profile_bank for select to authenticated
  using (user_id = auth.uid() or (auth.jwt() ->> 'email') = 'kb@bleenr.com');
revoke all on public.profile_bank from anon;
revoke insert, update, delete, truncate on public.profile_bank from authenticated;
grant select on public.profile_bank to authenticated;
grant all on public.profile_bank to service_role;

do $$
begin
  if exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'profiles' and column_name = 'iban') then
    execute $q$
      insert into public.profile_bank (user_id, iban, bic, bank_holder)
      select id, iban, bic, bank_holder from public.profiles
       where coalesce(iban, bic, bank_holder) is not null
      on conflict (user_id) do nothing$q$;
    execute 'alter table public.profiles disable trigger user';
    execute 'update public.profiles set iban = null, bic = null, bank_holder = null where coalesce(iban, bic, bank_holder) is not null';
    execute 'alter table public.profiles enable trigger user';
  end if;
end $$;

-- Création / mise à jour du profil à la connexion (données lues côté serveur dans le compte)
create or replace function public.api_profile_sync()
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := _api_uid(); u record; m jsonb; p profiles%rowtype; upd jsonb := '{}'::jsonb;
        v_role text; full_name text;
begin
  select email, phone, coalesce(raw_user_meta_data, '{}'::jsonb) as meta into u from auth.users where id = uid;
  m := u.meta;
  full_name := coalesce(m ->> 'full_name', m ->> 'name', '');
  select * into p from profiles where id = uid;
  if not found then
    v_role := case when _api_admin() then 'admin'
                   when m ->> 'role' in ('client','driver') then m ->> 'role' else 'client' end;
    return _api_insert('public.profiles', _api_cols('public.profiles', jsonb_build_object(
      'id', uid, 'email', u.email,
      'first_name', _api_txt(coalesce(m ->> 'first_name', split_part(full_name, ' ', 1)), 100),
      'last_name',  _api_txt(coalesce(m ->> 'last_name', nullif(substr(full_name, length(split_part(full_name, ' ', 1)) + 2), '')), 100),
      'role', v_role,
      'client_type', case when v_role = 'client' then case when m ->> 'client_type' = 'pro' then 'pro' else 'perso' end end,
      'company_name', _api_txt(m ->> 'company_name', 200),
      'avatar_url', _api_txt(coalesce(m ->> 'avatar_url', m ->> 'picture'), 500)),
      array['id','email','first_name','last_name','role','client_type','company_name','avatar_url']));
  end if;
  if u.email is not null and p.email is distinct from u.email then upd := upd || jsonb_build_object('email', u.email); end if;
  if coalesce(u.phone,'') <> '' and p.phone is null then upd := upd || jsonb_build_object('phone', u.phone); end if;
  if coalesce(p.role,'') = '' and m ->> 'role' in ('client','driver') and not _api_admin() then
    upd := upd || jsonb_build_object('role', m ->> 'role');
  end if;
  if _api_admin() and coalesce(p.role,'') in ('','client') then
    upd := upd || jsonb_build_object('role', 'admin', 'client_type', null);
  end if;
  if p.client_type is null and coalesce(p.role, m ->> 'role') = 'client' and m ->> 'client_type' in ('perso','pro') then
    upd := upd || jsonb_build_object('client_type', m ->> 'client_type');
  end if;
  if p.first_name is null and _api_txt(m ->> 'first_name', 100) is not null then upd := upd || jsonb_build_object('first_name', _api_txt(m ->> 'first_name', 100)); end if;
  if p.last_name is null and _api_txt(m ->> 'last_name', 100) is not null then upd := upd || jsonb_build_object('last_name', _api_txt(m ->> 'last_name', 100)); end if;
  if p.company_name is null and _api_txt(m ->> 'company_name', 200) is not null then upd := upd || jsonb_build_object('company_name', _api_txt(m ->> 'company_name', 200)); end if;
  return _api_update('public.profiles', uid::text, _api_cols('public.profiles', upd,
           array['email','phone','role','client_type','first_name','last_name','company_name']));
end $$;

-- Modification de son profil (champs autorisés uniquement)
create or replace function public.api_profile_update(p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := _api_uid(); d jsonb; k text;
begin
  d := _api_cols('public.profiles', p, array['first_name','last_name','company_name','phone','vat_number',
         'address_street','address_postal','address_city','address_country','client_type','avatar_url','lang','notif_prefs']);
  for k in select jsonb_object_keys(d) loop
    if jsonb_typeof(d -> k) = 'string' then d := jsonb_set(d, array[k], coalesce(to_jsonb(_api_txt(d ->> k, 300)), 'null'::jsonb)); end if;
  end loop;
  if d ? 'client_type' and coalesce(d ->> 'client_type','') not in ('perso','pro') then d := d - 'client_type'; end if;
  return _api_update('public.profiles', uid::text, d);
end $$;

-- Coordonnées bancaires (fleet)
create or replace function public.api_bank_save(p_iban text, p_bic text, p_holder text)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := _api_uid();
        v_iban text := nullif(upper(regexp_replace(coalesce(p_iban,''), '\s', '', 'g')), '');
        v_bic  text := nullif(upper(regexp_replace(coalesce(p_bic,''), '\s', '', 'g')), '');
begin
  if v_iban is not null and v_iban !~ '^[A-Z]{2}[0-9]{2}[A-Z0-9]{10,30}$' then raise exception 'IBAN invalide' using errcode = '22023'; end if;
  if v_bic is not null and v_bic !~ '^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$' then raise exception 'BIC invalide' using errcode = '22023'; end if;
  insert into profile_bank (user_id, iban, bic, bank_holder, updated_at)
  values (uid, v_iban, v_bic, _api_txt(p_holder, 200), now())
  on conflict (user_id) do update set iban = excluded.iban, bic = excluded.bic,
                                      bank_holder = excluded.bank_holder, updated_at = now();
end $$;

-- ────────────────────────────────────────────────────────────────
-- 2. DEMANDES (client)
-- ────────────────────────────────────────────────────────────────
create or replace function public.api_ride_create(p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := _api_uid(); d jsonb; r jsonb; v_sub boolean := coalesce((p ->> 'is_subcontract')::boolean, false);
        v_now timestamp := _now_bxl(); v_code text; v_n bigint;
begin
  if (select count(*) from rides where client_id = uid and created_at > now() - interval '1 hour') >= 30 then
    raise exception 'Trop de demandes en peu de temps, réessayez plus tard' using errcode = '42501';
  end if;
  d := _api_cols('public.rides', p, array['trip_type','from_address','to_address','ride_date','ride_time',
                                          'passengers','vehicle_type','notes','final_price']);
  if coalesce(d ->> 'trip_type','') not in ('ab','disposal','mixed') then raise exception 'Type de course invalide' using errcode = '22023'; end if;
  if _api_txt(d ->> 'from_address', 300) is null then raise exception 'Adresse de départ requise' using errcode = '22023'; end if;
  if (d ->> 'ride_date') is null or (d ->> 'ride_date')::date < current_date - 1 then raise exception 'Date invalide' using errcode = '22023'; end if;
  if coalesce((d ->> 'passengers')::int, 1) not between 1 and 60 then raise exception 'Nombre de passagers invalide' using errcode = '22023'; end if;
  d := d || jsonb_build_object('from_address', left(d ->> 'from_address', 300),
                               'notes', nullif(left(regexp_replace(coalesce(d ->> 'notes',''), '\|offer_note:[^|]*', '', 'g'), 4000), ''),
                               'client_id', uid, 'status', 'waiting');
  if v_sub then
    if not is_validated_fleet() then raise exception 'Votre flotte doit être validée par Bleenr' using errcode = '42501'; end if;
    if coalesce((d ->> 'final_price')::numeric, 0) <= 0 then raise exception 'Prix de la sous-traitance requis' using errcode = '22023'; end if;
    d := d || '{"is_subcontract": true}'::jsonb;
  else
    d := d - 'final_price';
  end if;
  r := _api_insert('public.rides', _api_cols('public.rides', d, array['client_id','status','trip_type','from_address','to_address',
         'ride_date','ride_time','passengers','vehicle_type','notes','final_price','is_subcontract']));

  -- Référence BLxx-MMAA### (compteur du mois, calculé par le serveur)
  perform pg_advisory_xact_lock(hashtext('bleenr_booking_code'));
  select count(*) into v_n from rides where created_at >= date_trunc('month', v_now) at time zone 'Europe/Brussels';
  v_code := 'BL' || case d ->> 'trip_type' when 'ab' then 'AB' when 'disposal' then 'DI' else 'MX' end || '-' ||
            to_char(v_now, 'MMYY') || lpad(greatest(v_n, 1)::text, 3, '0');
  update rides set booking_code = v_code where id = (r ->> 'id')::uuid;
  return jsonb_build_object('id', r ->> 'id', 'booking_code', v_code);
end $$;

create or replace function public.api_ride_update(p_ride uuid, p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := _api_uid(); r rides%rowtype; d jsonb; v_offer text;
begin
  select * into r from rides where id = p_ride for update;
  if not found or r.client_id is distinct from uid then raise exception 'Demande introuvable' using errcode = '42501'; end if;
  if r.status not in ('waiting','offers','confirmed','pending_payment') or r.on_way_at is not null or r.pickup_at is not null then
    raise exception 'Cette demande ne peut plus être modifiée' using errcode = '42501';
  end if;
  d := _api_cols('public.rides', p, array['trip_type','from_address','to_address','ride_date','ride_time',
                                          'passengers','vehicle_type','notes','final_price']);
  if d ? 'trip_type' and d ->> 'trip_type' not in ('ab','disposal','mixed') then raise exception 'Type de course invalide' using errcode = '22023'; end if;
  if d ? 'from_address' and _api_txt(d ->> 'from_address', 300) is null then raise exception 'Adresse de départ requise' using errcode = '22023'; end if;
  if d ? 'passengers' and coalesce((d ->> 'passengers')::int, 1) not between 1 and 60 then raise exception 'Nombre de passagers invalide' using errcode = '22023'; end if;
  if d ? 'notes' then
    -- la note de la fleet au client (|offer_note:) n'est jamais écrite par le client
    v_offer := (regexp_match(coalesce(r.notes,''), '(\|offer_note:[^|]*)'))[1];
    d := jsonb_set(d, '{notes}', coalesce(to_jsonb(nullif(left(regexp_replace(coalesce(d ->> 'notes',''), '\|offer_note:[^|]*', '', 'g'), 4000)
                                                     || coalesce(v_offer, ''), '')), 'null'::jsonb));
  end if;
  if not (coalesce(r.is_subcontract, false) and r.status in ('waiting','offers')) then d := d - 'final_price'; end if;
  return _api_update('public.rides', p_ride::text, d);
end $$;

-- Passager / note au chauffeur / référence (étiquettes de la note)
create or replace function public.api_ride_set_tags(p_ride uuid, p_tags jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := _api_uid(); r rides%rowtype; src text; k text;
begin
  select * into r from rides where id = p_ride for update;
  if not found or r.client_id is distinct from uid then raise exception 'Demande introuvable' using errcode = '42501'; end if;
  if r.status in ('done','cancelled','personal') or r.pickup_at is not null then
    raise exception 'Cette course ne peut plus être modifiée' using errcode = '42501';
  end if;
  src := r.notes;
  if r.status in ('waiting','offers') then
    select coalesce(full_notes, r.notes) into src from ride_private where ride_id = p_ride;
    src := coalesce(src, r.notes);
  end if;
  for k in select jsonb_object_keys(p_tags) loop
    if k not in ('pax','tel','pemail','pref','note_drv') then raise exception 'Information non modifiable : %', k using errcode = '22023'; end if;
    src := _api_set_tag(src, k, p_tags ->> k);
  end loop;
  return _api_update('public.rides', p_ride::text, jsonb_build_object('notes', src));
end $$;

-- Annulation par le client (demande ou course confirmée)
create or replace function public.api_ride_cancel(p_ride uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := _api_uid(); r rides%rowtype; d jsonb := '{"status":"cancelled"}'::jsonb; v_refundable boolean := true;
        v_start timestamp; v_drv uuid; v_body text;
begin
  select * into r from rides where id = p_ride for update;
  if not found or r.client_id is distinct from uid then raise exception 'Demande introuvable' using errcode = '42501'; end if;
  if r.status in ('confirmed','pending_payment') then
    if r.on_way_at is not null then raise exception 'Le chauffeur est déjà en route' using errcode = '42501'; end if;
    v_start := _ride_start(r);
    if r.final_price is not null and r.payment_method is not null and r.payment_method <> 'non_refundable'
       and v_start is not null and v_start - _now_bxl() < make_interval(hours => _refund_delay_hours(r)) then
      d := d || '{"payment_method":"non_refundable"}'::jsonb;
      v_refundable := false;
    end if;
  elsif r.status not in ('waiting','offers') then
    raise exception 'Cette demande ne peut plus être annulée' using errcode = '42501';
  end if;
  perform _api_update('public.rides', p_ride::text, d);

  v_body := 'La demande ' || coalesce(r.booking_code, left(r.id::text, 8)) ||
            coalesce(' du ' || to_char(r.ride_date, 'DD/MM/YYYY') || coalesce(' à ' || left(r.ride_time::text, 5), ''), '') ||
            ', sur laquelle vous aviez envoyé une offre, a été annulée par le client. Votre offre n’est plus valable.';
  for v_drv in select distinct x from (select o.driver_id as x from offers o where o.ride_id = p_ride
                                       union select r.driver_id) s where x is not null and x <> uid loop
    perform _api_notify(v_drv, 'ride_cancelled', 'Demande annulée', v_body, p_ride);
  end loop;
  return jsonb_build_object('refundable', v_refundable);
end $$;

-- Demande expirée : aucune offre acceptée avant l'heure de départ
create or replace function public.api_ride_expire(p_ride uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare uid uuid := _api_uid(); r rides%rowtype; v_drv uuid; v_body text;
begin
  select * into r from rides where id = p_ride for update;
  if not found or (r.client_id is distinct from uid and not _api_admin()) or r.status not in ('waiting','offers')
     or _ride_start(r) is null or _ride_start(r) > _now_bxl() then
    return false;
  end if;
  perform _api_trusted(true);
  update rides set status = 'cancelled' where id = p_ride;
  perform _api_trusted(false);
  v_body := 'La demande ' || coalesce(r.booking_code, left(r.id::text, 8)) ||
            coalesce(' du ' || to_char(r.ride_date, 'DD/MM/YYYY') || coalesce(' à ' || left(r.ride_time::text, 5), ''), '') ||
            ', sur laquelle vous aviez envoyé une offre, a été annulée automatiquement : aucune offre n’a été acceptée avant l’heure de départ. Votre offre n’est plus valable.';
  for v_drv in select distinct driver_id from offers where ride_id = p_ride and driver_id <> r.client_id loop
    perform _api_notify(v_drv, 'ride_cancelled', 'Demande expirée', v_body, p_ride);
  end loop;
  return true;
end $$;

-- Course terminée : par la fleet attribuée, ou par le client une fois l'heure passée
create or replace function public.api_ride_complete(p_ride uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare uid uuid := _api_uid(); r rides%rowtype;
begin
  select * into r from rides where id = p_ride for update;
  if not found or r.status <> 'confirmed' then return false; end if;
  if r.driver_id is distinct from uid then
    if r.client_id is distinct from uid or _ride_start(r) is null or _ride_start(r) + interval '30 minutes' > _now_bxl() then
      return false;
    end if;
  end if;
  perform _api_update('public.rides', p_ride::text, '{"status":"done"}'::jsonb);
  return true;
end $$;

-- ────────────────────────────────────────────────────────────────
-- 3. MISSIONS (fleet attribuée)
-- ────────────────────────────────────────────────────────────────
create or replace function public.api_mission_step(p_ride uuid, p_step text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := _api_uid(); r rides%rowtype; d jsonb;
begin
  select * into r from rides where id = p_ride for update;
  if not found or r.driver_id is distinct from uid or r.status = 'personal' then raise exception 'Mission introuvable' using errcode = '42501'; end if;
  if p_step = 'on_way' then
    if r.status <> 'confirmed' or r.on_way_at is not null then raise exception 'Étape déjà faite ou impossible' using errcode = '42501'; end if;
    d := jsonb_build_object('on_way_at', now());
  elsif p_step = 'pickup' then
    if r.status <> 'confirmed' or r.pickup_at is not null then raise exception 'Étape déjà faite ou impossible' using errcode = '42501'; end if;
    d := jsonb_build_object('pickup_at', now(), 'status', 'active');
  elsif p_step = 'done' then
    if r.status not in ('confirmed','active') then raise exception 'Étape impossible' using errcode = '42501'; end if;
    d := jsonb_build_object('completed_at', now(), 'status', 'done');
  else
    raise exception 'Étape inconnue' using errcode = '22023';
  end if;
  return _api_update('public.rides', p_ride::text, d);
end $$;

create or replace function public.api_mission_no_show(p_ride uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := _api_uid(); r rides%rowtype; x jsonb;
begin
  select * into r from rides where id = p_ride for update;
  if not found or r.driver_id is distinct from uid then raise exception 'Mission introuvable' using errcode = '42501'; end if;
  if r.status <> 'confirmed' or r.on_way_at is null or r.pickup_at is not null then
    raise exception 'No Show impossible : la course doit être « En chemin » et sans pick up.' using errcode = '42501';
  end if;
  x := _api_update('public.rides', p_ride::text, jsonb_build_object('completed_at', now(), 'no_show_at', now(), 'status', 'done'));
  perform _api_notify(r.client_id, 'ride_no_show', 'Absence au rendez-vous (No Show)',
    'Votre chauffeur s’est présenté pour la course ' || coalesce(r.booking_code, '') ||
    coalesce(' du ' || to_char(r.ride_date, 'DD/MM/YYYY') || coalesce(' à ' || left(r.ride_time::text, 5), ''), '') ||
    ', mais vous n’étiez pas au lieu de rendez-vous. La course est clôturée.', p_ride);
  return x;
end $$;

-- Note de la fleet au client (|offer_note:)
create or replace function public.api_ride_driver_note(p_ride uuid, p_note text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := _api_uid(); r rides%rowtype;
begin
  select * into r from rides where id = p_ride for update;
  if not found or r.driver_id is distinct from uid or r.status in ('done','cancelled','personal') then
    raise exception 'Mission introuvable' using errcode = '42501';
  end if;
  return _api_update('public.rides', p_ride::text, jsonb_build_object('notes', _api_set_tag(r.notes, 'offer_note', p_note)));
end $$;

-- Missions personnelles (agenda de la fleet)
create or replace function public.api_personal_save(p_id uuid, p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := _api_uid(); d jsonb; r rides%rowtype;
begin
  d := _api_cols('public.rides', p, array['trip_type','from_address','to_address','ride_date','ride_time','vehicle_type','notes']);
  if d ? 'notes' then d := jsonb_set(d, '{notes}', coalesce(to_jsonb(nullif(left(d ->> 'notes', 2000), '')), 'null'::jsonb)); end if;
  if (d ->> 'ride_date') is null then raise exception 'Date requise' using errcode = '22023'; end if;
  if p_id is null then
    return _api_insert('public.rides', d || jsonb_build_object('client_id', uid, 'driver_id', uid, 'status', 'personal'));
  end if;
  select * into r from rides where id = p_id for update;
  if not found or r.status <> 'personal' or r.driver_id is distinct from uid then raise exception 'Mission introuvable' using errcode = '42501'; end if;
  return _api_update('public.rides', p_id::text, d);
end $$;

create or replace function public.api_personal_delete(p_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare uid uuid := _api_uid();
begin
  delete from rides where id = p_id and status = 'personal' and (driver_id = uid or client_id = uid);
  return found;
end $$;

-- ────────────────────────────────────────────────────────────────
-- 4. OFFRES
-- ────────────────────────────────────────────────────────────────
create or replace function public.api_offer_submit(p_ride uuid, p_price numeric, p_message text, p_vehicle uuid, p_km jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := _api_uid(); o offers%rowtype; d jsonb;
begin
  if p_price is null or p_price <= 0 or p_price > 100000 then raise exception 'Prix invalide' using errcode = '22023'; end if;
  if p_vehicle is not null and not exists (select 1 from fleet_vehicles where id = p_vehicle and fleet_id = uid) then
    raise exception 'Ce véhicule n''appartient pas à votre flotte' using errcode = '42501';
  end if;
  d := _api_cols('public.offers', jsonb_build_object('price', round(p_price, 2), 'message', _api_txt(p_message, 1000),
                                                     'vehicle_id', p_vehicle, 'included_km', p_km),
                 array['price','message','vehicle_id','included_km']);
  select * into o from offers where ride_id = p_ride and driver_id = uid for update;
  if found then
    if o.status <> 'pending' then raise exception 'Offre déjà traitée' using errcode = '42501'; end if;
    return _api_update('public.offers', o.id::text, d);
  end if;
  return _api_insert('public.offers', d || jsonb_build_object('ride_id', p_ride, 'driver_id', uid, 'status', 'pending'));
end $$;

-- ────────────────────────────────────────────────────────────────
-- 5. NOTES, SIGNALEMENTS, NOTIFICATIONS, PASSAGERS
-- ────────────────────────────────────────────────────────────────
create or replace function public.api_rate_ride(p_ride uuid, p_score int, p_comment text)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := _api_uid(); r rides%rowtype; v_id uuid;
begin
  select * into r from rides where id = p_ride;
  if not found or r.client_id is distinct from uid or r.status <> 'done' or r.driver_id is null then
    raise exception 'Seule une course terminée peut être notée' using errcode = '42501';
  end if;
  if p_score is null or p_score not between 1 and 5 then raise exception 'La note doit être comprise entre 1 et 5' using errcode = '22023'; end if;
  select id into v_id from ratings where ride_id = p_ride limit 1;
  if v_id is not null then
    update ratings set score = p_score, comment = _api_txt(p_comment, 1000) where id = v_id;
  else
    insert into ratings (ride_id, driver_id, client_id, score, comment) values (p_ride, r.driver_id, uid, p_score, _api_txt(p_comment, 1000));
  end if;
  -- moyenne calculée par le serveur
  perform _api_trusted(true);
  update profiles set rating = (select round(avg(score)::numeric, 1) from ratings where driver_id = r.driver_id),
                      rating_count = (select count(*) from ratings where driver_id = r.driver_id)
   where id = r.driver_id;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'rides' and column_name = 'rated') then
    execute 'update public.rides set rated = true where id = $1' using p_ride;
  end if;
  perform _api_trusted(false);
end $$;

create or replace function public.api_report_ride(p_ride uuid, p_message text)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := _api_uid(); v_msg text := left(trim(coalesce(p_message,'')), 2000);
begin
  if not exists (select 1 from rides where id = p_ride and client_id = uid) then raise exception 'Course introuvable' using errcode = '42501'; end if;
  if char_length(v_msg) < 5 then raise exception 'Merci de décrire le problème' using errcode = '22023'; end if;
  insert into ride_reports (ride_id, client_id, message) values (p_ride, uid, v_msg);
end $$;

create or replace function public.api_notif_read(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := _api_uid();
begin
  update notifications set read = true where user_id = uid and read = false and (p_id is null or id = p_id);
end $$;

create or replace function public.api_passenger_save(p_id uuid, p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := _api_uid(); d jsonb;
begin
  d := jsonb_build_object('first_name', _api_txt(p ->> 'first_name', 100), 'last_name', _api_txt(p ->> 'last_name', 100),
                          'phone', _api_txt(p ->> 'phone', 50), 'email', _api_txt(p ->> 'email', 200));
  if d ->> 'first_name' is null or d ->> 'last_name' is null then raise exception 'Prénom et nom requis' using errcode = '22023'; end if;
  if p_id is null then return _api_insert('public.passengers', d || jsonb_build_object('client_id', uid)); end if;
  if not exists (select 1 from passengers where id = p_id and client_id = uid) then raise exception 'Passager introuvable' using errcode = '42501'; end if;
  return _api_update('public.passengers', p_id::text, d);
end $$;

create or replace function public.api_passenger_delete(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := _api_uid();
begin
  delete from passengers where id = p_id and client_id = uid;
end $$;

-- ────────────────────────────────────────────────────────────────
-- 6. FLOTTE : véhicules, chauffeurs, documents
-- ────────────────────────────────────────────────────────────────
create or replace function public._api_require_fleet(uid uuid)
returns void language plpgsql stable security definer set search_path = public as $$
begin
  if not exists (select 1 from profiles where id = uid and role = 'driver') and not _api_admin() then
    raise exception 'Réservé aux fleets' using errcode = '42501';
  end if;
end $$;
revoke all on function public._api_require_fleet(uuid) from public, anon, authenticated;

create or replace function public.api_vehicle_save(p_id uuid, p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := _api_uid(); d jsonb; v fleet_vehicles%rowtype; jv jsonb; k text; x jsonb;
begin
  perform _api_require_fleet(uid);
  d := _api_cols('public.fleet_vehicles', p, array['brand','model','year','color','vehicle_class','plate','amenities','seats','active']);
  foreach k in array array['brand','model','color','plate','vehicle_class'] loop
    if d ? k then d := jsonb_set(d, array[k], coalesce(to_jsonb(_api_txt(d ->> k, 100)), 'null'::jsonb)); end if;
  end loop;
  if d ? 'seats' and coalesce((d ->> 'seats')::int, 0) not between 1 and 60 then raise exception 'Nombre de places invalide' using errcode = '22023'; end if;
  if p_id is null then return _api_insert('public.fleet_vehicles', d || jsonb_build_object('fleet_id', uid)); end if;
  select * into v from fleet_vehicles where id = p_id for update;
  if not found or v.fleet_id is distinct from uid then raise exception 'Véhicule introuvable' using errcode = '42501'; end if;
  x := _api_update('public.fleet_vehicles', p_id::text, d);
  -- véhicule validé dont l'identité change : il repasse en validation
  jv := to_jsonb(v);
  if jv ->> 'status' = 'validated' and exists (select 1 from unnest(array['brand','model','plate','vehicle_class','seats']) c
                                               where d ? c and (d -> c) is distinct from (jv -> c)) then
    perform _api_trusted(true);
    x := _api_update('public.fleet_vehicles', p_id::text, '{"status":"pending"}'::jsonb);
    perform _api_trusted(false);
  end if;
  return x;
end $$;

create or replace function public.api_vehicle_delete(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := _api_uid();
begin
  if not exists (select 1 from fleet_vehicles where id = p_id and fleet_id = uid) then raise exception 'Véhicule introuvable' using errcode = '42501'; end if;
  delete from vehicle_documents where vehicle_id = p_id;
  delete from fleet_vehicles where id = p_id;
end $$;

create or replace function public.api_fleet_driver_save(p_id uuid, p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := _api_uid(); d jsonb; v fleet_drivers%rowtype; jv jsonb; x jsonb;
begin
  perform _api_require_fleet(uid);
  d := _api_cols('public.fleet_drivers', jsonb_build_object(
         'first_name', _api_txt(p ->> 'first_name', 100), 'last_name', _api_txt(p ->> 'last_name', 100),
         'phone', _api_txt(p ->> 'phone', 50), 'email', _api_txt(p ->> 'email', 200),
         'license_region', _api_txt(p ->> 'license_region', 50), 'active', p -> 'active'),
       array['first_name','last_name','phone','email','license_region'] || case when p ? 'active' then array['active'] else '{}'::text[] end);
  if d ->> 'first_name' is null or d ->> 'last_name' is null then raise exception 'Prénom et nom requis' using errcode = '22023'; end if;
  if p_id is null then return _api_insert('public.fleet_drivers', d || jsonb_build_object('fleet_id', uid)); end if;
  select * into v from fleet_drivers where id = p_id for update;
  if not found or v.fleet_id is distinct from uid then raise exception 'Chauffeur introuvable' using errcode = '42501'; end if;
  x := _api_update('public.fleet_drivers', p_id::text, d);
  jv := to_jsonb(v);
  if jv ->> 'status' = 'validated' and exists (select 1 from unnest(array['first_name','last_name','license_region']) c
                                               where (d -> c) is distinct from (jv -> c)) then
    perform _api_trusted(true);
    x := _api_update('public.fleet_drivers', p_id::text, '{"status":"pending"}'::jsonb);
    perform _api_trusted(false);
  end if;
  return x;
end $$;

create or replace function public.api_fleet_driver_delete(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := _api_uid();
begin
  if not exists (select 1 from fleet_drivers where id = p_id and fleet_id = uid) then raise exception 'Chauffeur introuvable' using errcode = '42501'; end if;
  delete from driver_documents where driver_id = p_id;
  delete from fleet_drivers where id = p_id;
end $$;

-- Documents : p_kind = fleet | driver | vehicle ; p_owner = id du chauffeur / véhicule
create or replace function public.api_doc_save(p_kind text, p_owner uuid, p_doc uuid, p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := _api_uid(); t regclass; fk text; d jsonb; cur jsonb;
begin
  perform _api_require_fleet(uid);
  if p_kind = 'fleet' then t := 'public.fleet_documents'; fk := 'fleet_id'; p_owner := uid;
  elsif p_kind = 'driver' then t := 'public.driver_documents'; fk := 'driver_id';
    if not exists (select 1 from fleet_drivers where id = p_owner and fleet_id = uid) then raise exception 'Chauffeur introuvable' using errcode = '42501'; end if;
  elsif p_kind = 'vehicle' then t := 'public.vehicle_documents'; fk := 'vehicle_id';
    if not exists (select 1 from fleet_vehicles where id = p_owner and fleet_id = uid) then raise exception 'Véhicule introuvable' using errcode = '42501'; end if;
  else raise exception 'Type de document inconnu' using errcode = '22023';
  end if;
  d := _api_cols(t, p, array['doc_type','doc_name','file_url','expires_at']);
  -- le fichier doit être dans le dossier de la fleet (stockage privé fleet-docs/<id>/…)
  if d ? 'file_url' and position('/fleet-docs/' || uid::text || '/' in coalesce(d ->> 'file_url','')) = 0 then
    raise exception 'Fichier invalide' using errcode = '42501';
  end if;
  if d ? 'doc_name' then d := jsonb_set(d, '{doc_name}', coalesce(to_jsonb(_api_txt(d ->> 'doc_name', 200)), 'null'::jsonb)); end if;
  if d ? 'doc_type' then d := jsonb_set(d, '{doc_type}', coalesce(to_jsonb(_api_txt(d ->> 'doc_type', 60)), 'null'::jsonb)); end if;
  d := d || _api_cols(t, '{"reminder_sent_at": null}'::jsonb, array['reminder_sent_at']);
  if p_doc is null then
    return _api_insert(t, d || jsonb_build_object(fk, p_owner));
  end if;
  execute format('select to_jsonb(x) from %s x where x.id = $1', t) into cur using p_doc;
  if cur is null or (cur ->> fk)::uuid is distinct from p_owner then raise exception 'Document introuvable' using errcode = '42501'; end if;
  return _api_update(t, p_doc::text, d - 'doc_type');
end $$;

create or replace function public.api_doc_delete(p_kind text, p_doc uuid)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := _api_uid();
begin
  if p_kind = 'fleet' then
    delete from fleet_documents where id = p_doc and fleet_id = uid;
  elsif p_kind = 'driver' then
    delete from driver_documents d using fleet_drivers f where d.id = p_doc and f.id = d.driver_id and f.fleet_id = uid;
  elsif p_kind = 'vehicle' then
    delete from vehicle_documents d using fleet_vehicles v where d.id = p_doc and v.id = d.vehicle_id and v.fleet_id = uid;
  end if;
end $$;

-- ────────────────────────────────────────────────────────────────
-- 7. POSITION GPS ET NOTIFICATIONS PUSH (app chauffeur)
-- ────────────────────────────────────────────────────────────────
create or replace function public.api_location_push(p_rows jsonb)
returns int language plpgsql security definer set search_path = public as $$
declare uid uuid := _api_uid(); x jsonb; n int := 0;
begin
  for x in select * from jsonb_array_elements(case when jsonb_typeof(p_rows) = 'array' then p_rows else '[]'::jsonb end) limit 10 loop
    if exists (select 1 from rides where id = (x ->> 'ride_id')::uuid and driver_id = uid and status in ('confirmed','active')) then
      insert into ride_locations (ride_id, driver_id, lat, lng, heading, speed, accuracy, updated_at)
      values ((x ->> 'ride_id')::uuid, uid, (x ->> 'lat')::float8, (x ->> 'lng')::float8, (x ->> 'heading')::float8,
              (x ->> 'speed')::float8, (x ->> 'accuracy')::int, now())
      on conflict (ride_id) do update set driver_id = excluded.driver_id, lat = excluded.lat, lng = excluded.lng,
        heading = excluded.heading, speed = excluded.speed, accuracy = excluded.accuracy, updated_at = now();
      n := n + 1;
    end if;
  end loop;
  return n;
end $$;

create or replace function public.api_push_register(p_token text, p_platform text, p_prefs jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := _api_uid();
begin
  if coalesce(p_token,'') !~ '^ExponentPushToken\[[A-Za-z0-9_-]+\]$' then raise exception 'Jeton invalide' using errcode = '22023'; end if;
  insert into push_tokens (token, user_id, platform, prefs, updated_at)
  values (p_token, uid, left(p_platform, 20), coalesce(p_prefs, '{}'::jsonb), now())
  on conflict (token) do update set user_id = uid, platform = excluded.platform, prefs = excluded.prefs, updated_at = now();
end $$;

create or replace function public.api_push_prefs(p_prefs jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := _api_uid();
begin
  update push_tokens set prefs = coalesce(p_prefs, prefs), updated_at = now() where user_id = uid;
end $$;

create or replace function public.api_push_unregister(p_token text)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := _api_uid();
begin
  delete from push_tokens where token = p_token and user_id = uid;
end $$;

-- ────────────────────────────────────────────────────────────────
-- 8. ADMIN (compte kb@bleenr.com uniquement)
-- ────────────────────────────────────────────────────────────────
create or replace function public.api_admin_save(p_table text, p_id text, p_data jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare t regclass; d jsonb; r jsonb;
begin
  perform _api_uid();
  if not _api_admin() then raise exception 'Réservé à l''administrateur' using errcode = '42501'; end if;
  if p_table not in ('profiles','fleet_documents','fleet_vehicles','fleet_drivers','driver_documents','vehicle_documents',
                     'billing_settings','ride_reports','rides','fleet_invoices') then
    raise exception 'Table non autorisée' using errcode = '42501';
  end if;
  t := ('public.' || p_table)::regclass;
  select coalesce(jsonb_object_agg(e.key, e.value), '{}'::jsonb) into d
    from jsonb_each(coalesce(p_data, '{}'::jsonb)) e
   where e.key <> 'id' and exists (select 1 from pg_attribute a where a.attrelid = t and a.attname = e.key and a.attnum > 0 and not a.attisdropped);
  if p_id is null then return _api_insert(t, d); end if;
  r := _api_update(t, p_id, d);
  if r is null and p_table = 'billing_settings' then
    r := _api_insert(t, d || jsonb_build_object('id', p_id::int));
  end if;
  if r is null then raise exception 'Enregistrement introuvable' using errcode = 'P0002'; end if;
  return r;
end $$;

-- ────────────────────────────────────────────────────────────────
-- 9. CONFIRMATION : notes de la course préparées par le serveur
-- (remplace _promoteNotesToDriver et la recopie du message de l'offre faites
--  avant par le navigateur)
-- ────────────────────────────────────────────────────────────────
create or replace function public.trg_rides_confirm_notes()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_msg text; v_clean text;
begin
  if tg_op = 'UPDATE' and old.status in ('waiting','offers','pending_payment')
     and new.status in ('confirmed','pending_payment') and new.status is distinct from old.status then
    -- note libre du client → |note_drv: (pour la fleet retenue)
    if coalesce(new.notes,'') !~ '\|note_drv:' then
      v_clean := trim(regexp_replace(regexp_replace(regexp_replace(
                   regexp_replace(coalesce(new.notes,''), '\|[a-z_]+:[^|]*', '', 'g'),
                   '^Mixte:.*$', '', 'n'), 'Durée:[^\s|]+', '', 'g'), '\s+', ' ', 'g'));
      if v_clean <> '' then new.notes := rtrim(coalesce(new.notes,'')) || '|note_drv:' || v_clean; end if;
    end if;
    -- message de l'offre retenue → |offer_note: (note de la fleet au client)
    if coalesce(new.notes,'') !~ '\|offer_note:' then
      select _api_txt(message, 1000) into v_msg from offers where ride_id = new.id and status = 'accepted' limit 1;
      if v_msg is not null then new.notes := coalesce(new.notes,'') || '|offer_note:' || v_msg; end if;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists c_rides_confirm_notes on public.rides;
create trigger c_rides_confirm_notes
  before update on public.rides
  for each row execute function public.trg_rides_confirm_notes();

-- ────────────────────────────────────────────────────────────────
-- 10. DROITS : seuls les connectés appellent les actions
-- ────────────────────────────────────────────────────────────────
do $$
declare f record;
begin
  for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.proname like 'api\_%' loop
    execute format('revoke all on function %s from public, anon', f.sig);
    execute format('grant execute on function %s to authenticated', f.sig);
  end loop;
end $$;

notify pgrst, 'reload schema';
