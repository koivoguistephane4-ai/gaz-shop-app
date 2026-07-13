-- =========================================================
-- MIGRATION : mode de paiement par vente (espèces / électronique)
-- À exécuter dans Supabase > SQL Editor
-- =========================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'payment_mode') then
    create type payment_mode as enum ('especes', 'electronique');
  end if;
end $$;

alter table sale_transactions
  add column if not exists mode_paiement payment_mode not null default 'especes';
