-- =========================================================
-- CORRECTIF : les fonctions déclenchées par trigger doivent contourner
-- le RLS pour pouvoir écrire dans `stock` / `sale_audit_log`, même
-- quand elles sont appelées depuis une action du gérant (qui n'a que
-- des droits de lecture sur `stock`).
-- À exécuter dans Supabase > SQL Editor.
-- =========================================================

alter function ensure_stock_row(uuid, uuid, bottle_size) security definer set search_path = public;
alter function before_sale_transaction() security definer set search_path = public;
alter function after_sale_transaction() security definer set search_path = public;
alter function after_restock_entry() security definer set search_path = public;
alter function before_update_sale_transaction() security definer set search_path = public;
alter function after_update_sale_transaction() security definer set search_path = public;
alter function after_delete_sale_transaction() security definer set search_path = public;
alter function lock_yesterday_reports() security definer set search_path = public;
