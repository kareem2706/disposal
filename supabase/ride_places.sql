-- ════════════════════════════════════════════════════════════════
-- ADRESSES DES DEMANDES : UNIQUEMENT DES LIEUX CONNUS DE GOOGLE — 14/11/2026. Peut être relancé.
-- Le site et l'app envoient l'identifiant Google (place_id) du lieu choisi dans la liste.
-- Le serveur vérifie ce lieu auprès de Google et enregistre son nom et son adresse officiels :
-- impossible de publier une demande avec une adresse inventée.
--  • nouvelle demande : départ (et arrivée) obligatoirement choisis dans la liste Google ;
--  • modification : seulement si l'adresse change ;
--  • trajets d'une demande mixte : un lieu Google valide par trajet ;
--  • Google injoignable : la demande passe (on ne bloque pas les clients), un avertissement est journalisé.
-- Nécessite l'extension http et le secret Vault « google_maps_key » (clé Google Maps publique du site).
-- ════════════════════════════════════════════════════════════════

create extension if not exists http with schema extensions;
alter table public.rides add column if not exists from_place_id text, add column if not exists to_place_id text;

-- Nom + adresse officiels d'un lieu Google. NULL = lieu inconnu ; '' = Google injoignable.
create or replace function public._place_label(p_id text)
returns text language plpgsql volatile security definer set search_path = public, extensions, pg_temp as $$
declare v_key text; v_res record; j jsonb; nm text; ad text;
begin
  if p_id is null or p_id !~ '^[A-Za-z0-9_-]{10,300}$' then return null; end if;
  select decrypted_secret into v_key from vault.decrypted_secrets where name = 'google_maps_key';
  if v_key is null then return ''; end if;
  begin
    perform extensions.http_set_curlopt('CURLOPT_TIMEOUT_MS', '4000');
    select status, content into v_res from extensions.http((
      'GET', 'https://places.googleapis.com/v1/places/' || p_id || '?languageCode=fr',
      array[extensions.http_header('X-Goog-Api-Key', v_key),
            extensions.http_header('X-Goog-FieldMask', 'displayName,formattedAddress'),
            extensions.http_header('Referer', 'https://www.bleenr.com/')], null, null)::extensions.http_request);
  exception when others then
    raise warning 'lieu Google % : injoignable (%)', p_id, sqlerrm; return '';
  end;
  if v_res.status in (400, 404) then return null; end if;
  if v_res.status <> 200 then raise warning 'lieu Google % : HTTP %', p_id, v_res.status; return ''; end if;
  j := v_res.content::jsonb;
  nm := nullif(trim(j #>> '{displayName,text}'), ''); ad := nullif(trim(j ->> 'formattedAddress'), '');
  if ad is null and nm is null then return null; end if;
  if nm is not null and ad is not null and position(lower(nm) in lower(ad)) = 0 then return left(nm || ', ' || ad, 300); end if;
  return left(coalesce(ad, nm), 300);
end $$;
revoke all on function public._place_label(text) from public, anon, authenticated;

-- Contrôle des adresses d'une demande (création : p_old_* null ; modification : valeurs actuelles)
create or replace function public._ride_places(d jsonb, p jsonb, p_old_from text, p_old_to text, p_old_notes text, p_type text)
returns jsonb language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare v_lbl text; v_id text; v_n int; v_seg text; v_need int := 0; v_ok int := 0;
begin
  -- Départ
  if d ? 'from_address' and coalesce(d ->> 'from_address', '') is distinct from coalesce(p_old_from, '') then
    v_id := p ->> 'from_place_id'; v_lbl := _place_label(v_id);
    if v_lbl is null then raise exception 'Adresse de départ inconnue : choisissez-la dans la liste proposée par Google.' using errcode = '22023'; end if;
    d := d || jsonb_build_object('from_place_id', v_id);
    if v_lbl <> '' and p_type <> 'mixed' then d := d || jsonb_build_object('from_address', v_lbl); end if;
  end if;
  -- Arrivée (transfert)
  if d ? 'to_address' and coalesce(d ->> 'to_address', '') <> '' and coalesce(d ->> 'to_address', '') is distinct from coalesce(p_old_to, '') then
    v_id := p ->> 'to_place_id'; v_lbl := _place_label(v_id);
    if v_lbl is null then raise exception 'Adresse d''arrivée inconnue : choisissez-la dans la liste proposée par Google.' using errcode = '22023'; end if;
    d := d || jsonb_build_object('to_place_id', v_id);
    if v_lbl <> '' then d := d || jsonb_build_object('to_address', v_lbl); end if;
  end if;
  -- Trajets d'une demande mixte : chaque adresse des trajets doit avoir un lieu Google valide
  if p_type = 'mixed' and d ? 'notes' and coalesce(d ->> 'notes', '') is distinct from coalesce(p_old_notes, '') then
    for v_seg in select trim(x) from unnest(string_to_array(regexp_replace(coalesce(d ->> 'notes', ''), '^\s*Mixte:\s*', ''), ' | ')) x loop
      v_seg := split_part(v_seg, '|', 1);
      if v_seg ~ '^A>B' then v_need := v_need + 2; elsif v_seg ~ '^Disposition' then v_need := v_need + 1; end if;
    end loop;
    if jsonb_typeof(p -> 'places') = 'array' then
      for v_id in select jsonb_array_elements_text(p -> 'places') limit 40 loop
        v_lbl := _place_label(v_id);
        if v_lbl is null then raise exception 'Une adresse des trajets est inconnue : choisissez-la dans la liste proposée par Google.' using errcode = '22023'; end if;
        v_ok := v_ok + 1;
      end loop;
    end if;
    if v_ok < v_need then raise exception 'Choisissez chaque adresse des trajets dans la liste proposée par Google.' using errcode = '22023'; end if;
  end if;
  return d;
end $$;
revoke all on function public._ride_places(jsonb, jsonb, text, text, text, text) from public, anon, authenticated;

-- Branchement dans api_ride_create et api_ride_update
do $$
declare f text; n text;
begin
  f := pg_get_functiondef('public.api_ride_create(jsonb)'::regprocedure);
  if position('_ride_places' in f) = 0 then
    n := replace(f, E'  if v_sub then', E'  d := _ride_places(d, p, null, null, null, d ->> ''trip_type'');\n  if v_sub then');
    n := replace(n, '''is_subcontract'',''luggage_large'',''luggage_small'']));', '''is_subcontract'',''luggage_large'',''luggage_small'',''from_place_id'',''to_place_id'']));');
    if n = f or position('from_place_id' in n) = 0 then raise exception 'api_ride_create : point d''insertion introuvable'; end if;
    execute n;
  end if;
  f := pg_get_functiondef('public.api_ride_update(uuid,jsonb)'::regprocedure);
  if position('_ride_places' in f) = 0 then
    n := replace(f, E'  v_res := _api_update(''public.rides'', p_ride::text, d);',
                    E'  d := _ride_places(d, p, r.from_address, r.to_address, r.notes, coalesce(d ->> ''trip_type'', r.trip_type));\n  v_res := _api_update(''public.rides'', p_ride::text, d);');
    if n = f then raise exception 'api_ride_update : point d''insertion introuvable'; end if;
    execute n;
  end if;
end $$;
