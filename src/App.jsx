import { Routes, Route } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './pages/Login'
import AdminDashboard from './pages/admin/AdminDashboard'
import BoutiquesPage from './pages/admin/BoutiquesPage'
import UtilisateursPage from './pages/admin/UtilisateursPage'
import ReapprovisionnementPage from './pages/admin/ReapprovisionnementPage'
import PrixPage from './pages/admin/PrixPage'
import VentesPage from './pages/admin/VentesPage'
import StatistiquesPage from './pages/admin/StatistiquesPage'
import CommandesAdminPage from './pages/admin/CommandesAdminPage'
import BossDashboard from './pages/boss/BossDashboard'
import BoutiqueDetailPage from './pages/boss/BoutiqueDetailPage'
import GerantDashboard from './pages/gerant/GerantDashboard'
import NouvelleCommandePage from './pages/sousdepot/NouvelleCommandePage'
import MesCommandesPage from './pages/sousdepot/MesCommandesPage'
import HistoriquePage from './pages/gerant/HistoriquePage'
import CommandesPage from './pages/gerant/CommandesPage'

// Redirige "/" vers le bon dashboard selon le rôle du profil connecté
function Home() {
  const { profile } = useAuth()
  if (profile?.role === 'admin') return <AdminDashboard />
  if (profile?.role === 'boss') return <BossDashboard />
  if (profile?.role === 'gerant') return <GerantDashboard />
  if (profile?.role === 'sous_depot') return <NouvelleCommandePage />
  return null
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route
        path="/"
        element={
          <ProtectedRoute allowedRoles={['admin', 'boss', 'gerant', 'sous_depot']}>
            <Home />
          </ProtectedRoute>
        }
      />

      {/* Routes spécifiques admin — à compléter */}
      <Route
        path="/utilisateurs"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <UtilisateursPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/boutiques"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <BoutiquesPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/reapprovisionnement"
        element={
          <ProtectedRoute allowedRoles={['admin', 'boss']}>
            <ReapprovisionnementPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/prix"
        element={
          <ProtectedRoute allowedRoles={['admin', 'boss']}>
            <PrixPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/statistiques"
        element={
          <ProtectedRoute allowedRoles={['admin', 'boss']}>
            <StatistiquesPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/commandes-suivi"
        element={
          <ProtectedRoute allowedRoles={['admin', 'boss']}>
            <CommandesAdminPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/ventes"
        element={
          <ProtectedRoute allowedRoles={['admin', 'boss']}>
            <VentesPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/boutiques/:id"
        element={
          <ProtectedRoute allowedRoles={['admin', 'boss']}>
            <BoutiqueDetailPage />
          </ProtectedRoute>
        }
      />

      {/* Routes spécifiques boss — à compléter */}
      <Route
        path="/rapports"
        element={
          <ProtectedRoute allowedRoles={['boss', 'admin']}>
            <BossDashboard />
          </ProtectedRoute>
        }
      />

      {/* Route spécifique gérant — historique */}
      <Route
        path="/historique"
        element={
          <ProtectedRoute allowedRoles={['gerant']}>
            <HistoriquePage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/commandes"
        element={
          <ProtectedRoute allowedRoles={['gerant']}>
            <CommandesPage />
          </ProtectedRoute>
        }
      />

      {/* Routes spécifiques sous-dépôt */}
      <Route
        path="/mes-commandes"
        element={
          <ProtectedRoute allowedRoles={['sous_depot']}>
            <MesCommandesPage />
          </ProtectedRoute>
        }
      />
    </Routes>
  )
}
