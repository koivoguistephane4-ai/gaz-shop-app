-- =========================================================
-- MIGRATION : ventes sans échange (clients qui ne rendent pas de vide)
-- À exécuter dans Supabase > SQL Editor
-- =========================================================

alter table sale_transactions add column if not exists avec_echange boolean not null default true;
alter table sale_transactions add column if not exists client_nom text;

-- ---------- Remplace la logique de stock après une vente ----------
-- (ne crédite les vides que si le client en a réellement rendu une)
create or replace function after_sale_transaction()
returns trigger as $$
begin
  if new.avec_echange then
    update stock
    set pleines = pleines - 1, vides = vides + 1, updated_at = now()
    where boutique_id = new.boutique_id and brand_id = new.brand_id and taille = new.taille;
  else
    update stock
    set pleines = pleines - 1, updated_at = now()
    where boutique_id = new.boutique_id and brand_id = new.brand_id and taille = new.taille;
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

-- ---------- Idem pour la correction (update) d'une vente ----------
create or replace function after_update_sale_transaction()
returns trigger as $$
begin
  -- Annule l'effet de l'ancienne vente
  if old.avec_echange then
    update stock set pleines = pleines + 1, vides = greatest(0, vides - 1), updated_at = now()
    where boutique_id = old.boutique_id and brand_id = old.brand_id and taille = old.taille;
  else
    update stock set pleines = pleines + 1, updated_at = now()
    where boutique_id = old.boutique_id and brand_id = old.brand_id and taille = old.taille;
  end if;

  -- Applique l'effet de la nouvelle vente
  perform ensure_stock_row(new.boutique_id, new.brand_id, new.taille);
  if new.avec_echange then
    update stock set pleines = greatest(0, pleines - 1), vides = vides + 1, updated_at = now()
    where boutique_id = new.boutique_id and brand_id = new.brand_id and taille = new.taille;
  else
    update stock set pleines = greatest(0, pleines - 1), updated_at = now()
    where boutique_id = new.boutique_id and brand_id = new.brand_id and taille = new.taille;
  end if;

  insert into sale_audit_log (sale_id, action, modified_by, ancien_brand_id, ancien_taille, ancien_montant, nouveau_brand_id, nouveau_taille, nouveau_montant)
  values (new.id, 'update', auth.uid(), old.brand_id, old.taille, old.montant, new.brand_id, new.taille, new.montant);

  return new;
end;
$$ language plpgsql security definer set search_path = public;

-- ---------- Idem pour l'annulation (delete) d'une vente ----------
create or replace function after_delete_sale_transaction()
returns trigger as $$
begin
  if old.avec_echange then
    update stock set pleines = pleines + 1, vides = greatest(0, vides - 1), updated_at = now()
    where boutique_id = old.boutique_id and brand_id = old.brand_id and taille = old.taille;
  else
    update stock set pleines = pleines + 1, updated_at = now()
    where boutique_id = old.boutique_id and brand_id = old.brand_id and taille = old.taille;
  end if;

  insert into sale_audit_log (sale_id, action, modified_by, ancien_brand_id, ancien_taille, ancien_montant)
  values (old.id, 'delete', auth.uid(), old.brand_id, old.taille, old.montant);

  return old;
end;
$$ language plpgsql security definer set search_path = public;
