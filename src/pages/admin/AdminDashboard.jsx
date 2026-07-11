import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import Layout from '../../components/Layout'
import StockGauge from '../../components/StockGauge'

export default function AdminDashboard() {
  const [counts, setCounts] = useState({ boutiques: 0, profiles: 0, reportsToday: 0 })

  useEffect(() => {
    load()
  }, [])

  async function load() {
    const today = new Date().toISOString().slice(0, 10)
    const [{ count: boutiques }, { count: profiles }, { count: reportsToday }] = await Promise.all([
      supabase.from('boutiques').select('*', { count: 'exact', head: true }),
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
      supabase.from('daily_reports').select('*', { count: 'exact', head: true }).eq('date', today),
    ])
    setCounts({ boutiques: boutiques ?? 0, profiles: profiles ?? 0, reportsToday: reportsToday ?? 0 })
  }

  return (
    <Layout>
      <h1 className="text-xl font-semibold mb-6">Vue d'ensemble — Administrateur</h1>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <StockGauge label="Boutiques actives" value={counts.boutiques} max={Math.max(counts.boutiques, 1)} />
        <StockGauge label="Comptes utilisateurs" value={counts.profiles} max={Math.max(counts.profiles, 1)} />
        <StockGauge label="Rapports soumis aujourd'hui" value={counts.reportsToday} max={Math.max(counts.boutiques, 1)} />
      </div>

      <div className="card p-6">
        <h2 className="font-semibold mb-2">Prochaines étapes à construire ici</h2>
        <ul className="text-sm text-gas-muted list-disc pl-5 space-y-1">
          <li>Page « Utilisateurs » : liste + création via un Edge Function (service_role, jamais côté client)</li>
          <li>Page « Boutiques » : CRUD + assignation des boss</li>
          <li>Page « Prix des bouteilles » : historique des tarifs par marque/taille</li>
        </ul>
      </div>
    </Layout>
  )
}
