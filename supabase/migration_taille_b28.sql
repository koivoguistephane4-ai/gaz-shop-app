-- =========================================================
-- MIGRATION : nouvelle taille de bouteille B28
-- À exécuter SEULE, dans sa propre requête (contrainte Postgres :
-- une nouvelle valeur d'enum doit être validée avant d'être utilisée)
-- =========================================================

alter type bottle_size add value if not exists 'B28';
