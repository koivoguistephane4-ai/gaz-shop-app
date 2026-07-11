-- =========================================================
-- CORRECTIF : les triggers qui ajustent `stock` échouent à cause du RLS
-- (le gérant n'a que SELECT sur `stock`, pas UPDATE — normal en soi,
-- mais les triggers déclenchés par une vente doivent pouvoir l'ajuster).
--
-- SECURITY DEFINER fait que ces fonctions s'exécutent avec les droits
-- de leur créateur (qui contourne RLS), uniquement pour cette logique
-- interne. Le gérant ne peut toujours pas modifier `stock` directement.
-- À exécuter dans Supabase > SQL Editor.
-- =========================================================

alter function ensure_stock_row(uuid, uuid, bottle_size) security definer set search_path = public;
alter function before_sale_transaction() security definer set search_path = public;
alter function after_sale_transaction() security definer set search_path = public;
alter function after_restock_entry() security definer set search_path = public;
alter function before_update_sale_transaction() security definer set search_path = public;
alter function after_update_sale_transaction() security definer set search_path = public;
alter function after_delete_sale_transaction() security definer set search_path = public;
