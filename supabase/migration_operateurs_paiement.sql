-- =========================================================
-- MIGRATION : détail des modes de paiement électronique
-- (Wave, Orange Money, MTN Money, Moov Money)
-- À exécuter dans Supabase > SQL Editor
--
-- Note : 'electronique' est conservé comme valeur existante pour ne pas
-- casser les ventes déjà enregistrées avant cette migration ; le
-- formulaire ne proposera plus que les 4 opérateurs + espèces désormais.
-- =========================================================

alter type payment_mode add value if not exists 'wave';
alter type payment_mode add value if not exists 'orange_money';
alter type payment_mode add value if not exists 'mtn_money';
alter type payment_mode add value if not exists 'moov_money';
