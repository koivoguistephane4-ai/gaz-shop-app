# Gestion Boutiques de Gaz — Squelette React + Supabase

## Installation

```bash
npm install
cp .env.example .env
# remplir VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY (Dashboard Supabase > Settings > API)
npm run dev
```

Avant de lancer l'app : exécutez `schema_boutique_gaz.sql` dans l'éditeur SQL Supabase
(tables, RLS, triggers, verrouillage minuit).

## Architecture

```
src/
  lib/supabaseClient.js       -> client Supabase unique
  context/AuthContext.jsx     -> session + profil (role, boutique_id)
  components/
    ProtectedRoute.jsx        -> garde d'accès par rôle
    Layout.jsx                -> sidebar + navigation selon le rôle
    StockGauge.jsx            -> jauge visuelle (stats de stock)
  pages/
    Login.jsx
    admin/AdminDashboard.jsx  -> vue d'ensemble admin (à enrichir : Utilisateurs, Boutiques, Prix)
    boss/BossDashboard.jsx    -> liste des rapports des boutiques supervisées
    gerant/GerantDashboard.jsx-> formulaire du rapport journalier (fonctionnel, connecté à Supabase)
```

## Rôles et accès (rappel)

| Rôle | Peut |
|---|---|
| **admin** | tout : créer/modifier/supprimer les comptes et boutiques, voir tous les rapports |
| **boss** | voir + corriger les rapports de ses boutiques (pas de gestion de comptes) |
| **gerant** | saisir le rapport du jour de sa boutique, modifiable jusqu'à minuit seulement |

La sécurité réelle est appliquée côté **base de données** via Row Level Security (RLS)
dans `schema_boutique_gaz.sql` — le front React ne fait qu'afficher/masquer les menus,
il ne doit jamais être la seule barrière de sécurité.

## ⚠️ Important : création de comptes

Seul l'admin crée des comptes. Cette opération nécessite la clé `service_role` de
Supabase, qui **ne doit jamais être exposée dans le code React** (elle donne un accès
total, RLS ignorée). Il faut créer un **Edge Function Supabase** (ou un petit backend
séparé) qui :
1. Vérifie que l'appelant est bien authentifié en tant qu'`admin`
2. Utilise `supabase.auth.admin.createUser()` côté serveur avec la clé `service_role`
3. Insère la ligne correspondante dans `profiles`

C'est la prochaine brique à construire — dites-moi si vous voulez que je la fasse.

## Prochaines étapes suggérées
- [ ] Edge Function `create-user` (admin uniquement)
- [ ] Page Admin > Utilisateurs (liste, désactivation, changement de rôle)
- [ ] Page Admin > Boutiques (CRUD + assignation boss)
- [ ] Page Admin > Prix (historique des tarifs)
- [ ] Page Boss/Admin > détail d'un rapport avec édition ligne par ligne + affichage de `report_audit_log`
- [ ] Page Gérant > Historique (lecture seule des rapports passés)
- [ ] Export PDF/Excel du rapport journalier (retrouver le format papier)
