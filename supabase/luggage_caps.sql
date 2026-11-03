-- ════════════════════════════════════════════════════════════════
-- CAPACITÉ EN BAGAGES PAR GAMME — 03/11/2026. Peut être relancé sans risque.
-- billing_settings.luggage_caps : réglée dans Admin › Facturation.
-- Pour chaque gamme, une ou plusieurs combinaisons maximum { l : grandes valises, s : bagages cabine }.
-- Le formulaire affiche un conseil si les bagages dépassent toutes les combinaisons de la gamme choisie.
-- Liste vide = pas de limite. « lowcost7 » = Economy de 7 places (4 à 7 passagers).
-- ════════════════════════════════════════════════════════════════

alter table public.billing_settings add column if not exists luggage_caps jsonb;
update public.billing_settings set luggage_caps = '{
  "lowcost":  [{"l":3,"s":0},{"l":2,"s":2}],
  "lowcost7": [{"l":5,"s":2}],
  "business": [{"l":3,"s":0},{"l":2,"s":2}],
  "luxe":     [{"l":3,"s":0},{"l":2,"s":2}],
  "van":      [{"l":7,"s":7}],
  "bus":      []
}'::jsonb where id = 1 and luggage_caps is null;

notify pgrst, 'reload schema';
