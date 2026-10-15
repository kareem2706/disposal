-- No Show : le client ne s'est pas présenté au lieu de prise en charge.
-- La course est terminée (status = 'done') et no_show_at enregistre l'heure du constat.
alter table public.rides add column if not exists no_show_at timestamptz;
