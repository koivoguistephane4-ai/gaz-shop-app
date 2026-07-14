import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const NAV_BY_ROLE = {
  admin: [
    { to: '/statistiques', label: 'Statistiques' },
    { to: '/', label: 'Vue d\'ensemble' },
    { to: '/utilisateurs', label: 'Utilisateurs' },
    { to: '/boutiques', label: 'Boutiques' },
    { to: '/ventes', label: 'Ventes' },
    { to: '/commandes-suivi', label: 'Commandes' },
    { to: '/reapprovisionnement', label: 'Stock & réappro' },
    { to: '/prix', label: 'Prix des bouteilles' },
  ],
  boss: [
    { to: '/statistiques', label: 'Statistiques' },
    { to: '/', label: 'Mes boutiques' },
    { to: '/ventes', label: 'Ventes' },
    { to: '/commandes-suivi', label: 'Commandes' },
    { to: '/reapprovisionnement', label: 'Stock & réappro' },
    { to: '/prix', label: 'Prix des bouteilles' },
  ],
  gerant: [
    { to: '/', label: 'Caisse — Vente du jour' },
    { to: '/commandes', label: 'Commandes' },
    { to: '/historique', label: 'Historique' },
  ],
  sous_depot: [
    { to: '/', label: 'Passer une commande' },
    { to: '/mes-commandes', label: 'Mes commandes' },
  ],
}

const ROLE_LABEL = {
  admin: 'Administrateur',
  boss: 'Patron',
  gerant: 'Gérant',
  sous_depot: 'Sous-dépôt',
}

export default function Layout({ children }) {
  const { profile, signOut } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const items = NAV_BY_ROLE[profile?.role] ?? []

  return (
    <div className="min-h-screen lg:flex">
      {/* Barre du haut, visible uniquement en mobile */}
      <div className="lg:hidden flex items-center justify-between bg-navy-900 text-white px-4 py-3 sticky top-0 z-30">
        <div>
          <div className="text-flame-500 font-semibold tracking-wide text-sm">GAZ • GESTION</div>
          <div className="text-xs text-white/60">{ROLE_LABEL[profile?.role] ?? '—'}</div>
        </div>
        <button
          onClick={() => setMenuOpen(true)}
          aria-label="Ouvrir le menu"
          className="p-2 -mr-2 text-white"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
      </div>

      {/* Fond assombri quand le tiroir mobile est ouvert */}
      {menuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setMenuOpen(false)}
        />
      )}

      {/* Sidebar : tiroir coulissant en mobile, fixe en desktop */}
      <aside
        className={`
          bg-navy-900 text-white flex flex-col shrink-0 w-64
          fixed inset-y-0 left-0 z-50 transform transition-transform duration-200
          lg:static lg:translate-x-0
          ${menuOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <div className="px-6 py-5 border-b border-navy-800 flex items-center justify-between">
          <div>
            <div className="text-flame-500 font-semibold tracking-wide text-sm">GAZ • GESTION</div>
            <div className="text-xs text-white/60 mt-1">{ROLE_LABEL[profile?.role] ?? '—'}</div>
          </div>
          <button
            onClick={() => setMenuOpen(false)}
            aria-label="Fermer le menu"
            className="lg:hidden p-1 text-white/70"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              onClick={() => setMenuOpen(false)}
              className={({ isActive }) =>
                `block px-3 py-2 rounded-card text-sm font-medium transition-colors ${
                  isActive ? 'bg-flame-500 text-white' : 'text-white/70 hover:bg-navy-800 hover:text-white'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="px-3 py-4 border-t border-navy-800">
          <div className="px-3 text-xs text-white/50 mb-2 truncate">{profile?.nom}</div>
          <button
            onClick={signOut}
            className="w-full text-left px-3 py-2 rounded-card text-sm text-white/70 hover:bg-navy-800 hover:text-white transition-colors"
          >
            Se déconnecter
          </button>
        </div>
      </aside>

      <main className="flex-1 p-4 sm:p-6 lg:p-8 min-w-0">{children}</main>
    </div>
  )
}
