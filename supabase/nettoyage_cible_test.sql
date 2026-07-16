-- =========================================================
-- NETTOYAGE CIBLÉ des données de test
-- Ne touche QUE les données liées à vos 3 comptes de test :
--   - gerant1@test.ci (Asso)
--   - sousdepot1@boutique.ci (sous-depot 01)
--   - koivoguistephane4@gmail.com (Sous boutique 01)
--
-- Les comptes réels (essoboulassika@gmail.com, antoineamichia8@gmail.com)
-- et leurs données ne sont PAS touchés.
-- =========================================================

-- 1. Supprime les ventes de test (le trigger recrédite automatiquement le stock)
delete from sale_transactions
where gerant_id = (select id from profiles where email = 'gerant1@test.ci');

-- 2. Supprime les commandes de test (jamais "livrées", donc aucun stock à corriger)
delete from commandes
where sous_depot_id in (
  select sd.id from sous_depots sd
  join profiles p on p.id = sd.profile_id
  where p.email in ('sousdepot1@boutique.ci', 'koivoguistephane4@gmail.com')
);

-- 3. Vérification : affiche ce qu'il reste comme ventes après nettoyage
select s.created_at, b.nom as boutique, p.nom as gerant, br.nom as marque, s.taille, s.montant
from sale_transactions s
join boutiques b on b.id = s.boutique_id
join profiles p on p.id = s.gerant_id
join bottle_brands br on br.id = s.brand_id
order by s.created_at desc;
