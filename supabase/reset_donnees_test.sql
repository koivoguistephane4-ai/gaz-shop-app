-- =========================================================
-- REMISE À ZÉRO avant mise en production
--
-- ⚠️ IRRÉVERSIBLE : à n'exécuter qu'une fois sûr de vouloir effacer
-- toutes les ventes/stock/rapports de test.
--
-- CE QUI EST CONSERVÉ : boutiques, comptes utilisateurs, marques,
-- logos, prix actuels et leur historique.
-- CE QUI EST EFFACÉ : ventes, stock, réappros, rapports journaliers,
-- journaux d'audit.
--
-- Version tolérante : n'échoue pas si une table optionnelle
-- (créée par une migration que vous n'avez pas encore exécutée)
-- n'existe pas.
-- =========================================================

do $$
declare
  t text;
begin
  foreach t in array array[
    'sale_audit_log',
    'sale_transactions',
    'restock_entries',
    'stock',
    'report_audit_log',
    'daily_report_lines',
    'daily_reports'
  ]
  loop
    if exists (select 1 from pg_tables where schemaname = 'public' and tablename = t) then
      execute format('truncate table %I cascade', t);
    end if;
  end loop;
end $$;
