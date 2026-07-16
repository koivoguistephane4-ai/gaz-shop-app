-- Liste tous les comptes avec leur rôle et boutique, pour identifier
-- lesquels sont des comptes de test créés pendant le développement
select id, email, nom, role, is_active, boutique_id, created_at
from profiles
order by created_at;
