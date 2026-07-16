-- =========================================================
-- MIGRATION : livraison partielle des commandes, ligne par ligne
-- À exécuter en 2 temps (l'enum doit être validé avant d'être utilisé)
-- =========================================================

-- ---------- ÉTAPE 1 : à exécuter seule, dans SA PROPRE requête ----------
-- alter type commande_statut add value if not exists 'partiellement_livree';

-- ---------- ÉTAPE 2 : à exécuter ensuite, dans une AUTRE requête ----------

alter table commande_lignes add column if not exists quantite_livree integer not null default 0;

-- Empêche de livrer plus que commandé, et vérifie le stock disponible
create or replace function before_update_commande_ligne()
returns trigger as $$
declare
  v_commande record;
  v_delta integer;
  v_stock_pleines integer;
begin
  if new.quantite_livree > new.quantite then
    raise exception 'Quantité livrée (%) supérieure à la quantité commandée (%).', new.quantite_livree, new.quantite;
  end if;

  v_delta := new.quantite_livree - old.quantite_livree;

  if v_delta > 0 then
    select * into v_commande from commandes where id = new.commande_id;

    select pleines into v_stock_pleines from stock
      where boutique_id = v_commande.boutique_id and brand_id = new.brand_id and taille = new.taille;

    if coalesce(v_stock_pleines, 0) < v_delta then
      raise exception 'Stock insuffisant : impossible de livrer % bouteille(s) supplémentaire(s), seulement % disponible(s).', v_delta, coalesce(v_stock_pleines, 0);
    end if;
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger trg_before_update_commande_ligne
before update on commande_lignes
for each row execute function before_update_commande_ligne();

-- Applique l'impact sur le stock + recalcule le statut global de la commande
create or replace function after_update_commande_ligne()
returns trigger as $$
declare
  v_commande record;
  v_delta integer := new.quantite_livree - old.quantite_livree;
  v_total_qte integer;
  v_total_livree integer;
begin
  select * into v_commande from commandes where id = new.commande_id;

  if v_delta <> 0 then
    perform ensure_stock_row(v_commande.boutique_id, new.brand_id, new.taille);

    if v_commande.avec_echange then
      update stock set pleines = pleines - v_delta, vides = vides + v_delta, updated_at = now()
      where boutique_id = v_commande.boutique_id and brand_id = new.brand_id and taille = new.taille;
    else
      update stock set pleines = pleines - v_delta, updated_at = now()
      where boutique_id = v_commande.boutique_id and brand_id = new.brand_id and taille = new.taille;
    end if;
  end if;

  select coalesce(sum(quantite), 0), coalesce(sum(quantite_livree), 0)
    into v_total_qte, v_total_livree
    from commande_lignes where commande_id = new.commande_id;

  if v_commande.statut not in ('payee', 'annulee') then
    if v_total_livree = 0 then
      update commandes set statut = 'en_attente' where id = new.commande_id;
    elsif v_total_livree < v_total_qte then
      update commandes set statut = 'partiellement_livree' where id = new.commande_id;
    else
      update commandes set statut = 'livree', date_livraison = now() where id = new.commande_id;
    end if;
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger trg_after_update_commande_ligne
after update on commande_lignes
for each row execute function after_update_commande_ligne();

-- L'ancien trigger qui livrait toute la commande d'un coup n'a plus lieu d'être
-- (remplacé par la logique ligne par ligne ci-dessus)
drop trigger if exists trg_apply_stock_on_commande_livree on commandes;

-- On garde uniquement l'horodatage du paiement
create or replace function apply_date_paiement()
returns trigger as $$
begin
  if new.statut = 'payee' and old.statut is distinct from 'payee' then
    new.date_paiement := now();
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger trg_apply_date_paiement
before update on commandes
for each row execute function apply_date_paiement();
