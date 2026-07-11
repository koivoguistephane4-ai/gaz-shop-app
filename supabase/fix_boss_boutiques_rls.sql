-- =========================================================
-- CORRECTIF : policies manquantes sur boss_boutiques
-- (la table avait RLS activé sans aucune policy, ce qui bloquait
-- silencieusement tout accès, y compris pour l'admin)
-- À exécuter dans Supabase > SQL Editor
-- =========================================================

create policy "admin_full_access_boss_boutiques"
on boss_boutiques for all
using (current_role_name() = 'admin');

create policy "boss_read_own_boss_boutiques"
on boss_boutiques for select
using (boss_id = auth.uid());
