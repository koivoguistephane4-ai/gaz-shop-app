import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import Layout from '../../components/Layout'
import { paymentModeLabel } from '../../lib/paymentModes'
import { downloadXlsx } from '../../lib/exportXlsx'
import SalesCalendar from '../../components/SalesCalendar'

const TAILLES = ['B6', 'B12', 'B28']

function startDateFor(period) {
  const now = new Date()
  if (period === 'jour') return new Date(now.getFullYear(), now.getMonth(), now.getDate())
  if (period === 'semaine') {
    const day = now.getDay() === 0 ? 7 : now.getDay()
    const monday = new Date(now)
    monday.setDate(now.getDate() - (day - 1))
    return new Date(monday.getFullYear(), monday.getMonth(), monday.getDate())
  }
  if (period === 'mois') return new Date(now.getFullYear(), now.getMonth(), 1)
  if (period === 'annee') return new Date(now.getFullYear(), 0, 1)
  return now
}

export default function BoutiqueDetailPage() {
  const { id } = useParams()
  const [boutique, setBoutique] = useState(null)
  const [stockRows, setStockRows] = useState([])
  const [recentSales, setRecentSales] = useState([])
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(null)
  const [message, setMessage] = useState(null)
  const [view, setView] = useState('liste') // 'liste' | 'calendrier'

  useEffect(() => {
    load()
  }, [id])

  async function load() {
    setLoading(true)
    const [{ data: boutiqueData }, { data: brands }, { data: stock }, { data: sales }] = await Promise.all([
      supabase.from('boutiques').select('*').eq('id', id).single(),
      supabase.from('bottle_brands').select('*').order('nom'),
      supabase.from('stock').select('*').eq('boutique_id', id),
      supabase
        .from('sale_transactions')
        .select('*, bottle_brands(nom), profiles(nom)')
        .eq('boutique_id', id)
        .order('created_at', { ascending: false })
        .limit(30),
    ])

    setBoutique(boutiqueData)

    const stockMap = {}
    for (const s of stock ?? []) stockMap[`${s.brand_id}-${s.taille}`] = s

    const rows = []
    for (const brand of brands ?? []) {
      for (const taille of TAILLES) {
        const key = `${brand.id}-${taille}`
        rows.push({
          key,
          brand_nom: brand.nom,
          taille,
          pleines: stockMap[key]?.pleines ?? 0,
          vides: stockMap[key]?.vides ?? 0,
        })
      }
    }
    setStockRows(rows)
    setRecentSales(sales ?? [])
    setLoading(false)
  }

  async function handleExport(period) {
    setExporting(period)
    setMessage(null)
    const start = startDateFor(period)

    const { data, error } = await supabase
      .from('sale_transactions')
      .select('*, bottle_brands(nom), profiles(nom)')
      .eq('boutique_id', id)
      .gte('created_at', start.toISOString())
      .order('created_at', { ascending: true })

    setExporting(null)

    if (error) {
      setMessage({ type: 'error', text: `Export impossible : ${error.message}` })
      return
    }
    if (!data || data.length === 0) {
      setMessage({ type: 'error', text: 'Aucune vente sur cette période.' })
      return
    }

    const header = ['Date', 'Heure', 'Gérant', 'Marque', 'Taille', 'Paiement', 'Montant (FCFA)']
    const rows = data.map((s) => {
      const d = new Date(s.created_at)
      return [
        d.toLocaleDateString('fr-FR'),
        d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        s.profiles?.nom ?? '',
        s.bottle_brands?.nom ?? '',
        s.taille,
        paymentModeLabel(s.mode_paiement),
        Number(s.montant),
      ]
    })
    const total = data.reduce((sum, s) => sum + Number(s.montant || 0), 0)
    rows.push([])
    rows.push(['', '', '', '', '', 'TOTAL', total])

    downloadXlsx(header, rows, `ventes_${boutique?.nom || id}_${period}_${new Date().toISOString().slice(0, 10)}`)
  }

  if (loading) {
    return (
      <Layout>
        <p className="text-gas-muted">Chargement…</p>
      </Layout>
    )
  }

  return (
    <Layout>
      <Link to="/" className="text-xs text-gas-muted hover:underline">← Retour</Link>
      <h1 className="text-xl font-semibold mt-1 mb-1">{boutique?.nom}</h1>
      <p className="text-sm text-gas-muted mb-6">{boutique?.adresse || 'Adresse non renseignée'}</p>

      {message && (
        <div className="mb-4 text-sm px-4 py-2 rounded-card bg-gas-danger/10 text-gas-danger">
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Stock */}
        <div>
          <h2 className="text-sm font-semibold text-gas-muted mb-3">Stock actuel</h2>
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gas-bg text-gas-muted text-left">
                <tr>
                  <th className="px-4 py-2 font-medium">Marque</th>
                  <th className="px-4 py-2 font-medium">Taille</th>
                  <th className="px-4 py-2 font-medium">Pleines</th>
                  <th className="px-4 py-2 font-medium">Vides</th>
                </tr>
              </thead>
              <tbody>
                {stockRows.map((row) => (
                  <tr key={row.key} className={`border-t border-gas-line ${row.pleines <= 2 ? 'bg-gas-danger/5' : ''}`}>
                    <td className="px-4 py-2 font-medium">{row.brand_nom}</td>
                    <td className="px-4 py-2 text-gas-muted">{row.taille}</td>
                    <td className={`px-4 py-2 tabular ${row.pleines <= 2 ? 'text-gas-danger font-medium' : ''}`}>{row.pleines}</td>
                    <td className="px-4 py-2 tabular">{row.vides}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Export */}
        <div>
          <h2 className="text-sm font-semibold text-gas-muted mb-3">Télécharger le rapport</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                className="card p-3 text-left hover:border-flame-500 hover:shadow-md transition-all disabled:opacity-50"
              >
                <div className="font-medium text-sm">{p.label}</div>
                <div className="text-xs text-gas-muted mt-1">
                  {exporting === p.key ? 'Génération…' : 'Excel'}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Ventes récentes / calendrier */}
      <div className="flex items-center gap-2 mb-3">
        <button
          onClick={() => setView('liste')}
          className={`text-sm font-medium px-3 py-1.5 rounded-card ${
            view === 'liste' ? 'bg-navy-900 text-white' : 'text-gas-muted hover:bg-gas-line'
          }`}
        >
          Liste
        </button>
        <button
          onClick={() => setView('calendrier')}
          className={`text-sm font-medium px-3 py-1.5 rounded-card ${
            view === 'calendrier' ? 'bg-navy-900 text-white' : 'text-gas-muted hover:bg-gas-line'
          }`}
        >
          Calendrier
        </button>
      </div>

      {view === 'calendrier' ? (
        <SalesCalendar boutiqueId={id} />
      ) : (
        <>
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gas-bg text-gas-muted text-left">
                <tr>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Gérant</th>
                  <th className="px-4 py-3 font-medium">Marque</th>
                  <th className="px-4 py-3 font-medium">Taille</th>
                  <th className="px-4 py-3 font-medium">Montant</th>
                </tr>
              </thead>
              <tbody>
                {recentSales.length === 0 && (
                  <tr><td className="px-4 py-4 text-gas-muted" colSpan={5}>Aucune vente pour l'instant.</td></tr>
                )}
                {recentSales.map((s) => (
                  <tr key={s.id} className="border-t border-gas-line">
                    <td className="px-4 py-2 tabular text-gas-muted">
                      {new Date(s.created_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-4 py-2">{s.profiles?.nom}</td>
                    <td className="px-4 py-2 font-medium">{s.bottle_brands?.nom}</td>
                    <td className="px-4 py-2 text-gas-muted">{s.taille}</td>
                    <td className="px-4 py-2 tabular">{Number(s.montant).toLocaleString('fr-FR')} F</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <p className="text-xs text-gas-muted mt-4">
        Pour corriger ou annuler une vente, utilisez la page <Link to="/ventes" className="text-flame-600 hover:underline">Ventes</Link>.
      </p>
    </Layout>
  )
}
