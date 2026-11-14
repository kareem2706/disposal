-- ════════════════════════════════════════════════════════════════
-- CORRECTIFS DE L'AUDIT SÉCURITÉ SUPABASE — 14/11/2026. Peut être relancé.
-- Ne change rien à ce que voient ou font les utilisateurs normaux.
-- ════════════════════════════════════════════════════════════════

-- 1) Fonction de trigger appelable directement par anon / authenticated → retirée
--    (un trigger n'a pas besoin du droit EXECUTE de l'appelant)
revoke execute on function public.trg_profiles_notif_defaults() from public, anon, authenticated;

-- 2) search_path figé sur les fonctions de préférences (avertissement Supabase)
alter function public._notif_defaults() set search_path = public;
alter function public._notif_with_defaults(jsonb) set search_path = public;

-- 3) invoice_number : seul l'émetteur peut modifier les montants enregistrés d'une facture existante
--    • facture « prestation » (fleet → client) : la fleet ou l'admin ;
--    • facture « commission » (Bleenr → fleet) : l'admin seulement ;
--    • le client obtient toujours le numéro, mais ne modifie plus jamais les montants ;
--    • seuls les types « prestation » et « commission » sont acceptés.
create or replace function public.invoice_number(p_fleet uuid, p_client uuid, p_period text, p_kind text,
  p_htva numeric, p_vat_rate numeric, p_vat numeric, p_tvac numeric, p_rc boolean, p_count integer)
returns text language plpgsql security definer set search_path = public as $function$
declare v_num text; v_pre text;
  v_admin boolean := (auth.jwt() ->> 'email') = 'kb@bleenr.com';
  v_can_edit boolean;
begin
  if p_kind not in ('prestation', 'commission') then raise exception 'type de facture inconnu'; end if;
  if not (v_admin or auth.uid() = p_fleet
          or (p_kind = 'prestation' and auth.uid() = p_client
              and exists (select 1 from rides r where r.client_id = p_client and r.driver_id = p_fleet))) then
    raise exception 'non autorisé';
  end if;
  v_can_edit := v_admin or (p_kind = 'prestation' and auth.uid() = p_fleet);
  select number into v_num from fleet_invoices
   where fleet_id = p_fleet and period = p_period and kind = p_kind
     and client_id is not distinct from p_client;
  if v_num is not null then
    if v_can_edit then
      update fleet_invoices set amount_htva = p_htva, vat_rate = p_vat_rate, vat_amount = p_vat,
             amount_tvac = p_tvac, reverse_charge = p_rc, rides_count = p_count
       where number = v_num;
    end if;
    return v_num;
  end if;
  v_pre := 'BL-' || case when p_kind = 'prestation' then 'P' else 'C' end || '-' || left(p_period, 4) || '-';
  perform pg_advisory_xact_lock(hashtext(v_pre));
  select v_pre || lpad((count(*) + 1)::text, 4, '0') into v_num from fleet_invoices where number like v_pre || '%';
  insert into fleet_invoices (fleet_id, client_id, period, kind, number, rides_count,
                              amount_htva, vat_rate, vat_amount, amount_tvac, reverse_charge)
  values (p_fleet, p_client, p_period, p_kind, v_num, p_count, p_htva, p_vat_rate, p_vat, p_tvac, p_rc);
  return v_num;
end $function$;
revoke execute on function public.invoice_number(uuid, uuid, text, text, numeric, numeric, numeric, numeric, boolean, integer) from public, anon;
grant execute on function public.invoice_number(uuid, uuid, text, text, numeric, numeric, numeric, numeric, boolean, integer) to authenticated;
