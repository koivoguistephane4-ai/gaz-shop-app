import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import Layout from '../../components/Layout'
import { paymentModeLabel, isElectronicPayment, PAYMENT_MODES } from '../../lib/paymentModes'

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
  return null // 'tout' → pas de borne
}

const PERIODS = [
  { key: 'jour', label: "Aujourd'hui" },
  { key: 'semaine', label: 'Cette semaine' },
  { key: 'mois', label: 'Ce mois-ci' },
  { key: 'tout', label: "Tout l'historique" },
]

export default function StatistiquesPage() {
  const [boutiques, setBoutiques] = useState([])
  const [boutiqueFilter, setBoutiqueFilter] = useState('')
  const [period, setPeriod] = useState('jour')
  const [sales, setSales] = useState([])
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    supabase.from('boutiques').select('*').order('nom').then(({ data }) => setBoutiques(data ?? []))
  }, [])

  useEffect(() => {
    loadSales()
  }, [boutiqueFilter, period])

  async function loadSales() {
    setLoading(true)
    let query = supabase
      .from('sale_transactions')
      .select('*, boutiques(nom), bottle_brands(nom), profiles(nom)')
      .order('created_at', { ascending: false })

    if (boutiqueFilter) query = query.eq('boutique_id', boutiqueFilter)

    const start = startDateFor(period)
    if (start) query = query.gte('created_at', start.toISOString())

    const { data } = await query.limit(500)
    setSales(data ?? [])
    setLoading(false)
  }

  const totalVentes = sales.length
  const chiffreAffaires = sales.reduce((sum, s) => sum + Number(s.montant || 0), 0)
  const panierMoyen = totalVentes > 0 ? chiffreAffaires / totalVentes : 0

  function handleExport() {
    setExporting(true)
    const header = ['Date', 'Heure', 'Boutique', 'Gérant', 'Marque', 'Taille', 'Paiement', 'Montant (FCFA)']
    const rows = sales.map((s) => {
      const d = new Date(s.created_at)
      return [
        d.toLocaleDateString('fr-FR'),
        d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        s.boutiques?.nom ?? '',
        s.profiles?.nom ?? '',
        s.bottle_brands?.nom ?? '',
        s.taille,
        paymentModeLabel(s.mode_paiement),
        Number(s.montant).toString(),
      ]
    })
    rows.push([])
    rows.push(['', '', '', '', '', '', 'TOTAL', chiffreAffaires.toString()])

    const csvContent = [header, ...rows]
      .map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(';'))
      .join('\n')

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `statistiques_${period}_${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
    setExporting(false)
  }

  return (
    <Layout>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <h1 className="text-xl font-semibold">Statistiques</h1>
        <button onClick={handleExport} disabled={exporting || sales.length === 0} className="btn-secondary disabled:opacity-50">
          ⬇ Télécharger Excel
        </button>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 mb-6">
        {boutiques.length > 1 && (
          <select className="input-field w-full sm:w-56" value={boutiqueFilter} onChange={(e) => setBoutiqueFilter(e.target.value)}>
            <option value="">Toutes les boutiques</option>
            {boutiques.map((b) => <option key={b.id} value={b.id}>{b.nom}</option>)}
          </select>
        )}

        <div className="flex gap-2 flex-wrap">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={`text-sm px-3 py-1.5 rounded-full font-medium transition-colors ${
                period === p.key ? 'bg-navy-900 text-white' : 'bg-gas-card border border-gas-line text-gas-muted hover:text-gas-text'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
        <div className="card p-4">
          <div className="text-xs text-gas-muted uppercase tracking-wide">Ventes — {PERIODS.find(p => p.key === period)?.label}</div>
          <div className="tabular text-2xl font-semibold mt-1">{totalVentes}</div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-gas-muted uppercase tracking-wide">Chiffre d'affaires</div>
          <div className="tabular text-2xl font-semibold mt-1 text-flame-600">{chiffreAffaires.toLocaleString('fr-FR')} FCFA</div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-gas-muted uppercase tracking-wide">Panier moyen</div>
          <div className="tabular text-2xl font-semibold mt-1">{Math.round(panierMoyen).toLocaleString('fr-FR')} F</div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-8">
        {PAYMENT_MODES.map((m) => {
          const total = sales
            .filter((s) => (s.mode_paiement || 'especes') === m.key)
            .reduce((sum, s) => sum + Number(s.montant || 0), 0)
          return (
            <div key={m.key} className="card p-3">
              <div className="text-xs text-gas-muted">{m.label}</div>
              <div className="tabular text-base font-semibold mt-1">{total.toLocaleString('fr-FR')} F</div>
            </div>
          )
        })}
      </div>

      <div className="card overflow-x-auto">
        <div className="px-4 py-3 bg-gas-bg text-sm font-semibold text-gas-muted flex items-center justify-between">
          <span>Détail — {PERIODS.find(p => p.key === period)?.label}</span>
          <span>{sales.length} opération{sales.length > 1 ? 's' : ''}</span>
        </div>
        <table className="w-full text-sm">
          <thead className="text-gas-muted text-left border-t border-gas-line">
            <tr>
              <th className="px-4 py-2 font-medium">Date</th>
              {boutiques.length > 1 && <th className="px-4 py-2 font-medium">Boutique</th>}
              <th className="px-4 py-2 font-medium">Gérant</th>
              <th className="px-4 py-2 font-medium">Marque</th>
              <th className="px-4 py-2 font-medium">Taille</th>
              <th className="px-4 py-2 font-medium">Paiement</th>
              <th className="px-4 py-2 font-medium">Montant</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td className="px-4 py-4 text-gas-muted" colSpan={7}>Chargement…</td></tr>
            )}
            {!loading && sales.length === 0 && (
              <tr><td className="px-4 py-4 text-gas-muted" colSpan={7}>Aucune vente sur cette période.</td></tr>
            )}
            {sales.map((s) => (
              <tr key={s.id} className="border-t border-gas-line">
                <td className="px-4 py-2 tabular text-gas-muted">
                  {new Date(s.created_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </td>
                {boutiques.length > 1 && <td className="px-4 py-2">{s.boutiques?.nom}</td>}
                <td className="px-4 py-2 text-gas-muted">{s.profiles?.nom}</td>
                <td className="px-4 py-2 font-medium">{s.bottle_brands?.nom}</td>
                <td className="px-4 py-2 text-gas-muted">{s.taille}</td>
                <td className="px-4 py-2 text-gas-muted">{paymentModeLabel(s.mode_paiement)}</td>
                <td className="px-4 py-2 tabular">{Number(s.montant).toLocaleString('fr-FR')} F</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Layout>
  )
}
