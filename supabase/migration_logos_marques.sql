-- =========================================================
-- MIGRATION : images/logos des marques de bouteilles
-- À exécuter dans Supabase > SQL Editor
-- =========================================================

alter table bottle_brands add column if not exists logo_url text;

-- Bucket de stockage public pour les logos (public = true : les images sont
-- directement accessibles par URL, pas besoin d'être connecté pour les afficher)
insert into storage.buckets (id, name, public)
values ('brand-logos', 'brand-logos', true)
on conflict (id) do nothing;

-- Lecture publique (nécessaire pour que les <img> s'affichent dans l'app)
create policy "public_read_brand_logos"
on storage.objects for select
using (bucket_id = 'brand-logos');

-- Seuls admin et boss peuvent ajouter/remplacer/supprimer un logo
create policy "admin_boss_upload_brand_logos"
on storage.objects for insert
with check (bucket_id = 'brand-logos' and current_role_name() in ('admin', 'boss'));

create policy "admin_boss_update_brand_logos"
on storage.objects for update
using (bucket_id = 'brand-logos' and current_role_name() in ('admin', 'boss'));

create policy "admin_boss_delete_brand_logos"
on storage.objects for delete
using (bucket_id = 'brand-logos' and current_role_name() in ('admin', 'boss'));
