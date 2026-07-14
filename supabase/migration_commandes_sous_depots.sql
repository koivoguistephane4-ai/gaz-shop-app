-- =========================================================
-- MIGRATION : Commandes des sous-dépôts (autres boutiques clientes)
-- À exécuter dans Supabase > SQL Editor
-- =========================================================

-- ---------- SOUS-DÉPÔTS (boutiques indépendantes qui commandent chez ce dépôt) ----------
create table sous_depots (
  id uuid primary key default gen_random_uuid(),
  boutique_id uuid not null references boutiques(id), -- le dépôt qui les fournit
  nom text not null,
  telephone text,
  adresse text,
  is_active boolean not null default true,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

-- ---------- COMMANDES ----------
create type commande_statut as enum ('en_attente', 'livree', 'payee', 'annulee');

create sequence if not exists commande_ref_seq;

create table commandes (
  id uuid primary key default gen_random_uuid(),
  reference text unique,
  boutique_id uuid not null references boutiques(id),
  sous_depot_id uuid not null references sous_depots(id),
  gerant_id uuid references profiles(id),
  statut commande_statut not null default 'en_attente',
  avec_echange boolean not null default false,
  montant_total numeric(12,2) not null default 0,
  notes text,
  date_commande timestamptz not null default now(),
  date_livraison timestamptz,
  date_paiement timestamptz
);

create table commande_lignes (
  id uuid primary key default gen_random_uuid(),
  commande_id uuid not null references commandes(id) on delete cascade,
  brand_id uuid not null references bottle_brands(id),
  taille bottle_size not null,
  quantite integer not null check (quantite > 0),
  prix_unitaire numeric(10,2),
  montant numeric(12,2)
);

-- =========================================================
-- TRIGGERS
-- =========================================================

-- Génère automatiquement une référence lisible : CMD-2026-0001
create or replace function generate_commande_reference()
returns trigger as $$
begin
  if new.reference is null then
    new.reference := 'CMD-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('commande_ref_seq')::text, 4, '0');
  end if;
  return new;
end;
$$ language plpgsql;

create trigger trg_generate_commande_reference
before insert on commandes
for each row execute function generate_commande_reference();

-- Calcule le prix/montant de chaque ligne selon le prix courant
create or replace function before_commande_ligne()
returns trigger as $$
declare
  v_prix numeric(10,2);
begin
  select prix into v_prix
  from bottle_prices
  where brand_id = new.brand_id and taille = new.taille and effective_date <= current_date
  order by effective_date desc
  limit 1;

  new.prix_unitaire := coalesce(v_prix, 0);
  new.montant := coalesce(v_prix, 0) * new.quantite;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger trg_before_commande_ligne
before insert or update on commande_lignes
for each row execute function before_commande_ligne();

-- Recalcule le total de la commande à chaque changement de ses lignes
create or replace function recalc_commande_total()
returns trigger as $$
begin
  update commandes
  set montant_total = (
    select coalesce(sum(montant), 0) from commande_lignes
    where commande_id = coalesce(new.commande_id, old.commande_id)
  )
  where id = coalesce(new.commande_id, old.commande_id);
  return null;
end;
$$ language plpgsql security definer set search_path = public;

create trigger trg_recalc_commande_total
after insert or update or delete on commande_lignes
for each row execute function recalc_commande_total();

-- Quand une commande passe à "livrée" : décrémente le stock de pleines
-- (et crédite les vides si avec_echange est coché)
create or replace function apply_stock_on_commande_livree()
returns trigger as $$
declare
  l record;
begin
  if new.statut = 'livree' and (old.statut is distinct from 'livree') then
    for l in select * from commande_lignes where commande_id = new.id loop
      perform ensure_stock_row(new.boutique_id, l.brand_id, l.taille);
      if new.avec_echange then
        update stock set pleines = greatest(0, pleines - l.quantite), vides = vides + l.quantite, updated_at = now()
        where boutique_id = new.boutique_id and brand_id = l.brand_id and taille = l.taille;
      else
        update stock set pleines = greatest(0, pleines - l.quantite), updated_at = now()
        where boutique_id = new.boutique_id and brand_id = l.brand_id and taille = l.taille;
      end if;
    end loop;
    new.date_livraison := now();
  end if;

  if new.statut = 'payee' and old.statut is distinct from 'payee' then
    new.date_paiement := now();
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger trg_apply_stock_on_commande_livree
before update on commandes
for each row execute function apply_stock_on_commande_livree();

-- =========================================================
-- RLS
-- =========================================================

alter table sous_depots enable row level security;
alter table commandes enable row level security;
alter table commande_lignes enable row level security;

-- SOUS_DEPOTS
create policy "admin_full_access_sous_depots" on sous_depots for all
using (current_role_name() = 'admin');

create policy "boss_read_sous_depots_own_boutiques" on sous_depots for select
using (current_role_name() = 'boss' and boutique_id in (select boutique_id from boss_boutiques where boss_id = auth.uid()));

create policy "gerant_manage_sous_depots_own_boutique" on sous_depots for all
using (current_role_name() = 'gerant' and boutique_id = (select boutique_id from profiles where id = auth.uid()));

-- COMMANDES
create policy "admin_full_access_commandes" on commandes for all
using (current_role_name() = 'admin');

create policy "boss_manage_commandes_own_boutiques" on commandes for all
using (current_role_name() = 'boss' and boutique_id in (select boutique_id from boss_boutiques where boss_id = auth.uid()));

create policy "gerant_manage_commandes_own_boutique" on commandes for all
using (current_role_name() = 'gerant' and boutique_id = (select boutique_id from profiles where id = auth.uid()));

-- COMMANDE_LIGNES (accès via la commande parente)
create policy "admin_full_access_commande_lignes" on commande_lignes for all
using (current_role_name() = 'admin');

create policy "boss_manage_commande_lignes_own_boutiques" on commande_lignes for all
using (
  current_role_name() = 'boss'
  and commande_id in (
    select id from commandes where boutique_id in (select boutique_id from boss_boutiques where boss_id = auth.uid())
  )
);

create policy "gerant_manage_commande_lignes_own_boutique" on commande_lignes for all
using (
  current_role_name() = 'gerant'
  and commande_id in (
    select id from commandes where boutique_id = (select boutique_id from profiles where id = auth.uid())
  )
);
