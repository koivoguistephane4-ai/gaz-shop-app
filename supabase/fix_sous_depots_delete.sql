-- =========================================================
-- CORRECTIF : la contrainte sous_depots.profile_id bloquait la
-- suppression d'un compte sous-dépôt. On la rend "SET NULL" :
-- la fiche sous_depots survit (orpheline), mais le compte peut
-- être supprimé normalement.
-- =========================================================

alter table sous_depots drop constraint sous_depots_profile_id_fkey;

alter table sous_depots
  add constraint sous_depots_profile_id_fkey
  foreign key (profile_id) references profiles(id) on delete set null;
