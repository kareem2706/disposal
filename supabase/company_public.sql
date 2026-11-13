-- ════════════════════════════════════════════════════════════════
-- COORDONNÉES OFFICIELLES DE BLEENR (lecture publique) — 13/11/2026. Peut être relancé.
-- Source unique : Admin › Facturation (billing_settings, ligne 1).
-- Lues par le site à sa construction (mentions légales, conditions, confidentialité,
-- données structurées) ; les factures et documents les lisent déjà directement.
-- Seuls les champs d'identité de la société sont exposés (aucun réglage de facturation).
-- ════════════════════════════════════════════════════════════════

create or replace function public.bleenr_company()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'name',        b.company_name,
    'street',      trim(concat_ws(' ', b.street, case when coalesce(b.box, '') <> '' then 'bte ' || b.box end)),
    'postal',      b.postal_code,
    'city',        b.city,
    'country',     b.country,
    'vat',         b.vat_number)
  from billing_settings b where b.id = 1;
$$;
revoke all on function public.bleenr_company() from public;
grant execute on function public.bleenr_company() to anon, authenticated;

notify pgrst, 'reload schema';
