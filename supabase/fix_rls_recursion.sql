-- =========================================================
-- CORRECTIF CRITIQUE : récursion infinie dans les policies RLS
--
-- Problème : current_role_name() interroge `profiles`, mais cette requête
-- passe elle-même par les policies RLS de `profiles`, qui rappellent
-- current_role_name() → boucle infinie → erreur 500 sur toutes les tables
-- qui utilisent cette fonction dans leurs policies.
--
-- Solution : SECURITY DEFINER fait que la fonction s'exécute avec les
-- droits de son créateur (qui contourne RLS), donc plus de boucle.
-- À exécuter dans Supabase > SQL Editor.
-- =========================================================

create or replace function current_role_name()
returns user_role as $$
  select role from profiles where id = auth.uid();
$$ language sql stable security definer set search_path = public;
