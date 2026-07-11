-- =========================================================
-- MIGRATION : correction/suppression de ventes (admin + boss)
-- À exécuter APRÈS migration_stock_ventes.sql
-- =========================================================

-- ---------- JOURNAL D'AUDIT DES VENTES CORRIGÉES ----------
create table sale_audit_log (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid, -- pas de FK stricte : on garde la trace même si la vente est supprimée
  action text not null, -- 'update' | 'delete'
  modified_by uuid references profiles(id),
  modified_at timestamptz not null default now(),
  ancien_brand_id uuid,
  ancien_taille bottle_size,
  ancien_montant numeric(12,2),
  nouveau_brand_id uuid,
  nouveau_taille bottle_size,
  nouveau_montant numeric(12,2)
);

alter table sale_audit_log enable row level security;

create policy "admin_full_access_sale_audit" on sale_audit_log for all
using (current_role_name() = 'admin');

create policy "boss_read_sale_audit" on sale_audit_log for select
using (current_role_name() = 'boss');

-- ---------- RECALCUL DU PRIX SI LA MARQUE/TAILLE CHANGE ----------
create or replace function before_update_sale_transaction()
returns trigger as $$
declare
  v_prix numeric(10,2);
begin
  if new.brand_id is distinct from old.brand_id or new.taille is distinct from old.taille then
    select prix into v_prix
    from bottle_prices
    where brand_id = new.brand_id and taille = new.taille and effective_date <= current_date
    order by effective_date desc
    limit 1;

    new.prix_unitaire := coalesce(v_prix, 0);
    new.montant := coalesce(v_prix, 0);
  end if;
  return new;
end;
$$ language plpgsql;

create trigger trg_before_update_sale
before update on sale_transactions
for each row execute function before_update_sale_transaction();

-- ---------- AJUSTEMENT DU STOCK + AUDIT APRÈS MODIFICATION ----------
create or replace function after_update_sale_transaction()
returns trigger as $$
begin
  -- Annule l'effet de l'ancienne vente
  update stock set pleines = pleines + 1, vides = greatest(0, vides - 1), updated_at = now()
  where boutique_id = old.boutique_id and brand_id = old.brand_id and taille = old.taille;

  -- Applique l'effet de la nouvelle vente
  perform ensure_stock_row(new.boutique_id, new.brand_id, new.taille);
  update stock set pleines = greatest(0, pleines - 1), vides = vides + 1, updated_at = now()
  where boutique_id = new.boutique_id and brand_id = new.brand_id and taille = new.taille;

  insert into sale_audit_log (sale_id, action, modified_by, ancien_brand_id, ancien_taille, ancien_montant, nouveau_brand_id, nouveau_taille, nouveau_montant)
  values (new.id, 'update', auth.uid(), old.brand_id, old.taille, old.montant, new.brand_id, new.taille, new.montant);

  return new;
end;
$$ language plpgsql;

create trigger trg_after_update_sale
after update on sale_transactions
for each row execute function after_update_sale_transaction();

-- ---------- AJUSTEMENT DU STOCK + AUDIT APRÈS SUPPRESSION ----------
create or replace function after_delete_sale_transaction()
returns trigger as $$
begin
  update stock set pleines = pleines + 1, vides = greatest(0, vides - 1), updated_at = now()
  where boutique_id = old.boutique_id and brand_id = old.brand_id and taille = old.taille;

  insert into sale_audit_log (sale_id, action, modified_by, ancien_brand_id, ancien_taille, ancien_montant)
  values (old.id, 'delete', auth.uid(), old.brand_id, old.taille, old.montant);

  return old;
end;
$$ language plpgsql;

create trigger trg_after_delete_sale
after delete on sale_transactions
for each row execute function after_delete_sale_transaction();

-- ---------- RLS : le gérant ne peut PAS modifier/supprimer (déjà implicite, RLS ne le
-- lui a jamais permis puisqu'il n'a qu'une policy INSERT + SELECT). On ajoute
-- explicitement les droits UPDATE/DELETE pour boss (admin a déjà tout via "for all").

create policy "boss_update_sales_own_boutiques" on sale_transactions for update
using (current_role_name() = 'boss' and boutique_id in (select boutique_id from boss_boutiques where boss_id = auth.uid()));

create policy "boss_delete_sales_own_boutiques" on sale_transactions for delete
using (current_role_name() = 'boss' and boutique_id in (select boutique_id from boss_boutiques where boss_id = auth.uid()));
