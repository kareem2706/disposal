-- Informations bancaires des flottes (onglet Profil > Société)
alter table public.profiles add column if not exists iban text;
alter table public.profiles add column if not exists bic text;
alter table public.profiles add column if not exists bank_holder text;
