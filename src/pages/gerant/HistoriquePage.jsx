import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'
import Layout from '../../components/Layout'
import { paymentModeLabel } from '../../lib/paymentModes'
import { downloadXlsx } from '../../lib/exportXlsx'
import BrandLogo from '../../components/BrandLogo'

const TAILLES = ['B6', 'B12', 'B28']

// Calcule la date de début selon la période choisie
function startDateFor(period) {
  const now = new Date()
  if (period === 'jour') {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate())
  }
  if (period === 'semaine') {
    const day = now.getDay() === 0 ? 7 : now.getDay() // lundi = 1 ... dimanche = 7
    const monday = new Date(now)
    monday.setDate(now.getDate() - (day - 1))
    return new Date(monday.getFullYear(), monday.getMonth(), monday.getDate())
  }
  if (period === 'mois') {
    return new Date(now.getFullYear(), now.getMonth(), 1)
  }
  if (period === 'annee') {
    return new Date(now.getFullYear(), 0, 1)
  }
  return now
}

const PERIOD_LABEL = { jour: 'jour', semaine: 'semaine', mois: 'mois', annee: 'année' }

export default function HistoriquePage() {
  const { profile } = useAuth()
  const [stockRows, setStockRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(null)
  const [message, setMessage] = useState(null)

  useEffect(() => {
    if (profile) loadStock()
  }, [profile])

  async function loadStock() {
    setLoading(true)
    const [{ data: brands }, { data: stock }] = await Promise.all([
      supabase.from('bottle_brands').select('*').order('nom'),
      supabase.from('stock').select('*').eq('boutique_id', profile.boutique_id),
    ])

    const stockMap = {}
    for (const s of stock ?? []) stockMap[`${s.brand_id}-${s.taille}`] = s

    const rows = []
    for (const brand of brands ?? []) {
      for (const taille of TAILLES) {
        const key = `${brand.id}-${taille}`
        rows.push({
          key,
          brand_nom: brand.nom,
          brand_logo: brand.logo_url,
          taille,
          pleines: stockMap[key]?.pleines ?? 0,
          vides: stockMap[key]?.vides ?? 0,
        })
      }
    }
    setStockRows(rows)
    setLoading(false)
  }

  async function handleExport(period) {
    setExporting(period)
    setMessage(null)

    const start = startDateFor(period)

    const { data, error } = await supabase
      .from('sale_transactions')
      .select('*, bottle_brands(nom)')
      .eq('boutique_id', profile.boutique_id)
      .gte('created_at', start.toISOString())
      .order('created_at', { ascending: true })

    setExporting(null)

    if (error) {
      setMessage({ type: 'error', text: `Export impossible : ${error.message}` })
      return
    }

    if (!data || data.length === 0) {
      setMessage({ type: 'error', text: `Aucune vente sur cette période (${PERIOD_LABEL[period]}).` })
      return
    }

    downloadCsv(data, period)
  }

  function downloadCsv(sales, period) {
    const header = ['Date', 'Heure', 'Marque', 'Taille', 'Paiement', 'Montant (FCFA)']
    const rows = sales.map((s) => {
      const d = new Date(s.created_at)
      return [
        d.toLocaleDateString('fr-FR'),
        d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        s.bottle_brands?.nom ?? '',
        s.taille,
        paymentModeLabel(s.mode_paiement),
        Number(s.montant),
      ]
    })

    const total = sales.reduce((sum, s) => sum + Number(s.montant || 0), 0)
    rows.push([])
    rows.push(['', '', '', '', 'TOTAL', total])

    const today = new Date().toISOString().slice(0, 10)
    downloadXlsx(header, rows, `ventes_${period}_${today}`)
  }

  return (
    <Layout>
      <h1 className="text-xl font-semibold mb-6">Historique & stock</h1>

      {message && (
        <div className="mb-4 text-sm px-4 py-2 rounded-card bg-gas-danger/10 text-gas-danger">
          {message.text}
        </div>
      )}

      {/* Stock actuel */}
      <h2 className="text-sm font-semibold text-gas-muted mb-3">Stock actuel — toutes marques</h2>
      <div className="card overflow-x-auto mb-8">
        <table className="w-full text-sm">
          <thead className="bg-gas-bg text-gas-muted text-left">
            <tr>
              <th className="px-4 py-3 font-medium">Marque</th>
              <th className="px-4 py-3 font-medium">Taille</th>
              <th className="px-4 py-3 font-medium">Bouteilles pleines</th>
              <th className="px-4 py-3 font-medium">Bouteilles vides</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td className="px-4 py-4 text-gas-muted" colSpan={4}>Chargement…</td></tr>
            )}
            {!loading && stockRows.map((row) => (
              <tr key={row.key} className="border-t border-gas-line">
                <td className="px-4 py-2 font-medium flex items-center gap-2">
                  <BrandLogo nom={row.brand_nom} logoUrl={row.brand_logo} size={20} />
                  {row.brand_nom}
                </td>
                <td className="px-4 py-2 text-gas-muted">{row.taille}</td>
                <td className="px-4 py-2 tabular">{row.pleines}</td>
                <td className="px-4 py-2 tabular">{row.vides}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Export */}
      <h2 className="text-sm font-semibold text-gas-muted mb-3">Télécharger le rapport des ventes</h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { key: 'jour', label: 'Aujourd\'hui' },
          { key: 'semaine', label: 'Cette semaine' },
          { key: 'mois', label: 'Ce mois' },
          { key: 'annee', label: 'Cette année' },
        ].map((p) => (
          <button
            key={p.key}
            onClick={() => handleExport(p.key)}
            disabled={exporting === p.key}
            className="card p-4 text-left hover:border-flame-500 hover:shadow-md transition-all disabled:opacity-50"
          >
            <div className="font-semibold">{p.label}</div>
            <div className="text-xs text-gas-muted mt-1">
              {exporting === p.key ? 'Génération…' : 'Télécharger en Excel'}
            </div>
          </button>
        ))}
      </div>

      <p className="text-xs text-gas-muted mt-4">
        Le fichier Excel (.xlsx) contient le détail de chaque vente sur la période choisie, avec le total en bas.
      </p>
    </Layout>
  )
}
