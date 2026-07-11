-- =========================================================
-- MIGRATION : Ventes transactionnelles (type caisse) + stock temps réel
-- À exécuter dans Supabase > SQL Editor, APRÈS le schéma initial
-- et les correctifs précédents (fix_rls_recursion.sql, fix_boss_boutiques_rls.sql)
-- =========================================================

-- ---------- STOCK (un seul enregistrement par boutique + marque + taille) ----------
create table stock (
  boutique_id uuid not null references boutiques(id),
  brand_id uuid not null references bottle_brands(id),
  taille bottle_size not null,
  pleines integer not null default 0,
  vides integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (boutique_id, brand_id, taille)
);

-- ---------- VENTES INDIVIDUELLES (type caisse) ----------
create table sale_transactions (
  id uuid primary key default gen_random_uuid(),
  boutique_id uuid not null references boutiques(id),
  gerant_id uuid not null references profiles(id),
  brand_id uuid not null references bottle_brands(id),
  taille bottle_size not null,
  prix_unitaire numeric(10,2) not null default 0,
  montant numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);

-- ---------- RÉAPPROVISIONNEMENT (livraisons fournisseur + retours de vides) ----------
create type restock_type as enum ('livraison_pleines', 'retour_vides_fournisseur');

create table restock_entries (
  id uuid primary key default gen_random_uuid(),
  boutique_id uuid not null references boutiques(id),
  brand_id uuid not null references bottle_brands(id),
  taille bottle_size not null,
  type restock_type not null,
  quantite integer not null check (quantite > 0),
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

-- =========================================================
-- TRIGGERS : mise à jour automatique du stock
-- =========================================================

-- S'assure qu'une ligne de stock existe (sinon la crée à 0/0) avant toute opération
create or replace function ensure_stock_row(p_boutique_id uuid, p_brand_id uuid, p_taille bottle_size)
returns void as $$
begin
  insert into stock (boutique_id, brand_id, taille)
  values (p_boutique_id, p_brand_id, p_taille)
  on conflict (boutique_id, brand_id, taille) do nothing;
end;
$$ language plpgsql;

-- Avant une vente : vérifie le stock dispo, calcule le prix, bloque si stock insuffisant
create or replace function before_sale_transaction()
returns trigger as $$
declare
  v_pleines integer;
  v_prix numeric(10,2);
begin
  perform ensure_stock_row(new.boutique_id, new.brand_id, new.taille);

  select pleines into v_pleines from stock
  where boutique_id = new.boutique_id and brand_id = new.brand_id and taille = new.taille
  for update; -- verrou pour éviter les ventes concurrentes qui dépasseraient le stock

  if v_pleines is null or v_pleines <= 0 then
    raise exception 'Stock insuffisant : aucune bouteille pleine disponible pour cette marque/taille.';
  end if;

  select prix into v_prix
  from bottle_prices
  where brand_id = new.brand_id and taille = new.taille and effective_date <= current_date
  order by effective_date desc
  limit 1;

  new.prix_unitaire := coalesce(v_prix, 0);
  new.montant := coalesce(v_prix, 0);

  return new;
end;
$$ language plpgsql;

create trigger trg_before_sale
before insert on sale_transactions
for each row execute function before_sale_transaction();

-- Après une vente : décrémente les pleines, incrémente les vides (échange)
create or replace function after_sale_transaction()
returns trigger as $$
begin
  update stock
  set pleines = pleines - 1, vides = vides + 1, updated_at = now()
  where boutique_id = new.boutique_id and brand_id = new.brand_id and taille = new.taille;
  return new;
end;
$$ language plpgsql;

create trigger trg_after_sale
after insert on sale_transactions
for each row execute function after_sale_transaction();

-- Après un réapprovisionnement : ajuste le stock selon le type
create or replace function after_restock_entry()
returns trigger as $$
begin
  perform ensure_stock_row(new.boutique_id, new.brand_id, new.taille);

  if new.type = 'livraison_pleines' then
    update stock set pleines = pleines + new.quantite, updated_at = now()
    where boutique_id = new.boutique_id and brand_id = new.brand_id and taille = new.taille;
  elsif new.type = 'retour_vides_fournisseur' then
    update stock set vides = greatest(0, vides - new.quantite), updated_at = now()
    where boutique_id = new.boutique_id and brand_id = new.brand_id and taille = new.taille;
  end if;

  return new;
end;
$$ language plpgsql;

create trigger trg_after_restock
after insert on restock_entries
for each row execute function after_restock_entry();

-- =========================================================
-- MISE À JOUR : le job de minuit calcule maintenant le rapport
-- automatiquement à partir des ventes de la journée (snapshot figé)
-- =========================================================

create or replace function lock_yesterday_reports()
returns void as $$
declare
  r record;
begin
  -- Pour chaque boutique ayant eu au moins une vente hier, ou déjà une ligne de rapport,
  -- on crée/complète le rapport journalier verrouillé
  for r in
    select distinct boutique_id from sale_transactions where created_at::date = current_date - 1
  loop
    insert into daily_reports (boutique_id, gerant_id, date, status, locked_at)
    select r.boutique_id, (select gerant_id from profiles where boutique_id = r.boutique_id and role = 'gerant' limit 1),
           current_date - 1, 'locked', now()
    on conflict (boutique_id, date) do update set status = 'locked', locked_at = now();

    insert into daily_report_lines (report_id, brand_id, taille, ventes, restes_pleines, vides, prix_unitaire, montant)
    select
      (select id from daily_reports where boutique_id = r.boutique_id and date = current_date - 1),
      st.brand_id, st.taille,
      count(*), 
      (select pleines from stock where boutique_id = r.boutique_id and brand_id = st.brand_id and taille = st.taille),
      (select vides from stock where boutique_id = r.boutique_id and brand_id = st.brand_id and taille = st.taille),
      avg(st.prix_unitaire), sum(st.montant)
    from sale_transactions st
    where st.boutique_id = r.boutique_id and st.created_at::date = current_date - 1
    group by st.brand_id, st.taille
    on conflict (report_id, brand_id, taille) do update
      set ventes = excluded.ventes, restes_pleines = excluded.restes_pleines,
          vides = excluded.vides, prix_unitaire = excluded.prix_unitaire, montant = excluded.montant;
  end loop;
end;
$$ language plpgsql;

-- =========================================================
-- RLS
-- =========================================================

alter table stock enable row level security;
alter table sale_transactions enable row level security;
alter table restock_entries enable row level security;

-- STOCK : admin tout ; boss lecture sur ses boutiques ; gérant lecture sur sa boutique
create policy "admin_full_access_stock" on stock for all using (current_role_name() = 'admin');

create policy "boss_read_stock_own_boutiques" on stock for select
using (current_role_name() = 'boss' and boutique_id in (select boutique_id from boss_boutiques where boss_id = auth.uid()));

create policy "gerant_read_stock_own_boutique" on stock for select
using (current_role_name() = 'gerant' and boutique_id = (select boutique_id from profiles where id = auth.uid()));

-- SALE_TRANSACTIONS : admin tout ; boss lecture sur ses boutiques ;
-- gérant crée + lit ses propres ventes du jour sur sa boutique
create policy "admin_full_access_sales" on sale_transactions for all using (current_role_name() = 'admin');

create policy "boss_read_sales_own_boutiques" on sale_transactions for select
using (current_role_name() = 'boss' and boutique_id in (select boutique_id from boss_boutiques where boss_id = auth.uid()));

create policy "gerant_insert_sales_own_boutique_today" on sale_transactions for insert
with check (
  current_role_name() = 'gerant'
  and gerant_id = auth.uid()
  and boutique_id = (select boutique_id from profiles where id = auth.uid())
  and created_at::date = current_date
);

create policy "gerant_read_sales_own_boutique_today" on sale_transactions for select
using (
  current_role_name() = 'gerant'
  and boutique_id = (select boutique_id from profiles where id = auth.uid())
  and created_at::date = current_date
);

-- RESTOCK_ENTRIES : admin + boss uniquement (le gérant ne réapprovisionne pas)
create policy "admin_full_access_restock" on restock_entries for all using (current_role_name() = 'admin');

create policy "boss_manage_restock_own_boutiques" on restock_entries for all
using (current_role_name() = 'boss' and boutique_id in (select boutique_id from boss_boutiques where boss_id = auth.uid()));

-- Note : la contrainte unique (report_id, brand_id, taille) existe déjà
-- dans le schéma initial (schema_boutique_gaz.sql), pas besoin de la recréer.
