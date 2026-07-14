-- =========================================================
-- MIGRATION : rôle "sous_depot" (compte propre pour chaque sous-dépôt)
-- À exécuter APRÈS migration_commandes_sous_depots.sql
-- =========================================================

-- Nouveau rôle utilisateur
alter type user_role add value if not exists 'sous_depot';

-- Lien entre un compte utilisateur et sa fiche sous-dépôt
alter table sous_depots add column if not exists profile_id uuid references profiles(id) unique;

-- =========================================================
-- RLS : le sous-dépôt peut seulement CRÉER et LIRE ses propres commandes,
-- jamais changer un statut (ça reste au gérant/boss/admin)
-- =========================================================

create policy "sous_depot_read_own_fiche" on sous_depots for select
using (profile_id = auth.uid());

create policy "sous_depot_insert_own_commandes" on commandes for insert
with check (
  current_role_name() = 'sous_depot'
  and boutique_id = (select boutique_id from profiles where id = auth.uid())
  and sous_depot_id = (select id from sous_depots where profile_id = auth.uid())
);

create policy "sous_depot_read_own_commandes" on commandes for select
using (
  current_role_name() = 'sous_depot'
  and sous_depot_id = (select id from sous_depots where profile_id = auth.uid())
);

create policy "sous_depot_insert_own_commande_lignes" on commande_lignes for insert
with check (
  current_role_name() = 'sous_depot'
  and commande_id in (
    select id from commandes
    where sous_depot_id = (select id from sous_depots where profile_id = auth.uid())
  )
);

create policy "sous_depot_read_own_commande_lignes" on commande_lignes for select
using (
  current_role_name() = 'sous_depot'
  and commande_id in (
    select id from commandes
    where sous_depot_id = (select id from sous_depots where profile_id = auth.uid())
  )
);

-- Le sous-dépôt doit pouvoir lire les marques et prix pour composer sa commande
-- (les policies existantes "read_brands_all_authenticated" / "read_prices_all_authenticated"
-- couvrent déjà ce cas, aucune action nécessaire ici)
