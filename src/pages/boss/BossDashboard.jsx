import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import Layout from '../../components/Layout'

export default function BossDashboard() {
  const [boutiques, setBoutiques] = useState([])
  const [summaries, setSummaries] = useState({}) // boutique_id -> { totalJour, nbVentes, alertesStock }
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)

    // RLS limite automatiquement aux boutiques supervisées par ce boss
    const { data: boutiquesData } = await supabase.from('boutiques').select('*').order('nom')
    setBoutiques(boutiquesData ?? [])

    const today = new Date().toISOString().slice(0, 10)
    const results = {}

    await Promise.all(
      (boutiquesData ?? []).map(async (b) => {
        const [{ data: sales }, { data: stock }] = await Promise.all([
          supabase
            .from('sale_transactions')
            .select('montant')
            .eq('boutique_id', b.id)
            .gte('created_at', `${today}T00:00:00`),
          supabase.from('stock').select('pleines').eq('boutique_id', b.id),
        ])

        const totalJour = (sales ?? []).reduce((sum, s) => sum + Number(s.montant || 0), 0)
        const alertesStock = (stock ?? []).filter((s) => s.pleines <= 2).length

        results[b.id] = { totalJour, nbVentes: (sales ?? []).length, alertesStock }
      })
    )

    setSummaries(results)
    setLoading(false)
  }

  return (
    <Layout>
      <h1 className="text-xl font-semibold mb-6">Mes boutiques</h1>

      {loading && <p className="text-gas-muted">Chargement…</p>}

      {!loading && boutiques.length === 0 && (
        <p className="text-gas-muted">Aucune boutique ne vous est encore assignée. Contactez l'administrateur.</p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {boutiques.map((b) => {
          const s = summaries[b.id] ?? { totalJour: 0, nbVentes: 0, alertesStock: 0 }
          return (
            <Link
              key={b.id}
              to={`/boutiques/${b.id}`}
              className="card p-5 hover:border-flame-500 hover:shadow-md transition-all"
            >
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold">{b.nom}</h2>
                {s.alertesStock > 0 && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-gas-danger/10 text-gas-danger">
                    {s.alertesStock} marque{s.alertesStock > 1 ? 's' : ''} en alerte stock
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-xs text-gas-muted">Ventes aujourd'hui</div>
                  <div className="tabular font-semibold">{s.nbVentes}</div>
                </div>
                <div>
                  <div className="text-xs text-gas-muted">Encaissé aujourd'hui</div>
                  <div className="tabular font-semibold text-flame-600">{s.totalJour.toLocaleString('fr-FR')} F</div>
                </div>
              </div>
              <div className="text-xs text-gas-muted mt-3">{b.adresse || 'Adresse non renseignée'}</div>
            </Link>
          )
        })}
      </div>
    </Layout>
  )
}
