import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'
import Layout from '../../components/Layout'
import BrandLogo from '../../components/BrandLogo'
import { PAYMENT_MODES, paymentModeLabel } from '../../lib/paymentModes'

export default function GerantDashboard() {
  const { profile } = useAuth()
  const [brands, setBrands] = useState([])
  const [stockMap, setStockMap] = useState({})   // `${brand_id}-${taille}` -> {pleines, vides}
  const [priceMap, setPriceMap] = useState({})   // `${brand_id}-${taille}` -> prix
  const [sales, setSales] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)

  const [form, setForm] = useState({ brand_id: '', taille: 'B6', avec_echange: true, client_nom: '', mode_paiement: 'especes' })

  useEffect(() => {
    if (profile) init()
  }, [profile])

  async function init() {
    setLoading(true)
    await Promise.all([loadBrandsStockPrices(), loadSales()])
    setLoading(false)
  }

  async function loadBrandsStockPrices() {
    const today = new Date().toISOString().slice(0, 10)
    const [{ data: brandsData }, { data: stockData }, { data: priceData }] = await Promise.all([
      supabase.from('bottle_brands').select('*').order('nom'),
      supabase.from('stock').select('*').eq('boutique_id', profile.boutique_id),
      supabase.from('bottle_prices').select('*').lte('effective_date', today).order('effective_date', { ascending: false }),
    ])

    setBrands(brandsData ?? [])

    const sMap = {}
    for (const s of stockData ?? []) sMap[`${s.brand_id}-${s.taille}`] = s
    setStockMap(sMap)

    // Garde le prix le plus récent par marque+taille
    const pMap = {}
    for (const p of priceData ?? []) {
      const key = `${p.brand_id}-${p.taille}`
      if (!(key in pMap)) pMap[key] = p.prix
    }
    setPriceMap(pMap)
  }

  async function loadSales() {
    const today = new Date().toISOString().slice(0, 10)
    const { data } = await supabase
      .from('sale_transactions')
      .select('*, bottle_brands(nom, logo_url)')
      .eq('boutique_id', profile.boutique_id)
      .gte('created_at', `${today}T00:00:00`)
      .order('created_at', { ascending: false })
    setSales(data ?? [])
  }

  const selectedKey = form.brand_id ? `${form.brand_id}-${form.taille}` : null
  const selectedStock = selectedKey ? stockMap[selectedKey]?.pleines ?? 0 : 0
  const selectedPrix = selectedKey ? priceMap[selectedKey] ?? 0 : 0
  const rupture = form.brand_id && selectedStock <= 0

  async function handleAddSale(e) {
    e.preventDefault()
    if (!form.brand_id || rupture) return

    setSaving(true)
    setMessage(null)

    const { error } = await supabase.from('sale_transactions').insert({
      boutique_id: profile.boutique_id,
      gerant_id: profile.id,
      brand_id: form.brand_id,
      taille: form.taille,
      avec_echange: form.avec_echange,
      client_nom: form.client_nom.trim() || null,
      mode_paiement: form.mode_paiement,
    })

    setSaving(false)

    if (error) {
      setMessage({ type: 'error', text: `Vente impossible : ${error.message}` })
      return
    }

    setMessage({ type: 'success', text: 'Vente enregistrée.' })
    setForm({ brand_id: '', taille: 'B6', avec_echange: true, client_nom: '', mode_paiement: 'especes' })
    await Promise.all([loadBrandsStockPrices(), loadSales()])
  }

  const totalJour = sales.reduce((sum, s) => sum + Number(s.montant || 0), 0)

  if (loading) {
    return (
      <Layout>
        <p className="text-gas-muted">Chargement…</p>
      </Layout>
    )
  }

  return (
    <Layout>
      <h1 className="text-xl font-semibold mb-1">Caisse — Vente du jour</h1>
      <p className="text-sm text-gas-muted tabular mb-6">{new Date().toLocaleDateString('fr-FR')}</p>

      {/* Cartes résumé, façon Cybercafé */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="card p-4">
          <div className="text-xs text-gas-muted">Ventes du jour</div>
          <div className="tabular text-2xl font-semibold mt-1">{sales.length}</div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-gas-muted">Total encaissé</div>
          <div className="tabular text-2xl font-semibold mt-1 text-flame-600">
            {totalJour.toLocaleString('fr-FR')} F
          </div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-gas-muted">Dernière vente</div>
          <div className="tabular text-sm font-medium mt-1">
            {sales[0]
              ? new Date(sales[0].created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
              : '—'}
          </div>
        </div>
      </div>

      {message && (
        <div
          className={`mb-4 text-sm px-4 py-2 rounded-card ${
            message.type === 'error' ? 'bg-gas-danger/10 text-gas-danger' : 'bg-gas-success/10 text-gas-success'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Formulaire nouvelle vente */}
      <div className="card p-5 mb-6">
        <h2 className="text-sm font-semibold text-gas-muted mb-4">Nouvelle vente</h2>

        <label className="block text-sm text-gas-muted mb-2">Marque</label>
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-8 gap-2 mb-4">
          {brands.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => setForm((f) => ({ ...f, brand_id: b.id }))}
              className={`flex flex-col items-center gap-1.5 p-2 rounded-card border transition-colors ${
                form.brand_id === b.id
                  ? 'border-flame-500 bg-flame-100/50'
                  : 'border-gas-line hover:border-flame-500/50'
              }`}
            >
              <BrandLogo nom={b.nom} logoUrl={b.logo_url} size={36} />
              <span className="text-xs font-medium text-center leading-tight">{b.nom}</span>
            </button>
          ))}
        </div>

        <form onSubmit={handleAddSale} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
          <div>
            <label className="block text-sm text-gas-muted mb-1">Taille</label>
            <select
              className="input-field"
              value={form.taille}
              onChange={(e) => setForm((f) => ({ ...f, taille: e.target.value }))}
            >
              <option value="B6">B6</option>
              <option value="B12">B12</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-gas-muted mb-1">Montant</label>
            <div className="input-field tabular bg-gas-bg text-gas-muted">
              {form.brand_id ? `${selectedPrix.toLocaleString('fr-FR')} F` : '—'}
            </div>
          </div>
          <div className="sm:col-span-2 lg:col-span-1">
            <label className="block text-sm text-gas-muted mb-1">Paiement</label>
            <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-1 gap-1.5">
              {PAYMENT_MODES.map((m) => (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, mode_paiement: m.key }))}
                  className={`text-xs px-2 py-1.5 rounded-card border transition-colors ${
                    form.mode_paiement === m.key
                      ? 'bg-navy-900 text-white border-navy-900'
                      : 'bg-white text-gas-muted border-gas-line hover:border-navy-900/40'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
          <button
            type="submit"
            disabled={!form.brand_id || rupture || saving}
            className="btn-primary disabled:opacity-50"
          >
            {saving ? 'Enregistrement…' : '+ Ajouter la vente'}
          </button>

          <div className="sm:col-span-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.avec_echange}
                onChange={(e) => setForm((f) => ({ ...f, avec_echange: e.target.checked }))}
              />
              Le client rend une bouteille vide (échange)
            </label>
          </div>
          {!form.avec_echange && (
            <div>
              <label className="block text-sm text-gas-muted mb-1">Client (optionnel)</label>
              <input
                type="text"
                className="input-field"
                placeholder="Ex : Boutique Fatou"
                value={form.client_nom}
                onChange={(e) => setForm((f) => ({ ...f, client_nom: e.target.value }))}
              />
            </div>
          )}
        </form>

        {!form.avec_echange && (
          <p className="text-xs text-flame-600 mt-2">
            ⚠ Vente sans reprise de vide — seul le stock de pleines diminue, les vides ne changent pas.
          </p>
        )}
        {form.brand_id && (
          <p className={`text-xs mt-3 ${rupture ? 'text-gas-danger' : 'text-gas-muted'}`}>
            {rupture
              ? 'Rupture de stock pour cette marque/taille — vente impossible.'
              : `${selectedStock} bouteille${selectedStock > 1 ? 's' : ''} pleine${selectedStock > 1 ? 's' : ''} disponible${selectedStock > 1 ? 's' : ''}.`}
          </p>
        )}
      </div>

      {/* Tableau des ventes du jour */}
      <h2 className="text-sm font-semibold text-gas-muted mb-3">Ventes d'aujourd'hui ({sales.length})</h2>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gas-bg text-gas-muted text-left">
            <tr>
              <th className="px-4 py-3 font-medium">Heure</th>
              <th className="px-4 py-3 font-medium">Marque</th>
              <th className="px-4 py-3 font-medium">Taille</th>
              <th className="px-4 py-3 font-medium">Montant</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {sales.length === 0 && (
              <tr><td className="px-4 py-4 text-gas-muted" colSpan={5}>Aucune vente enregistrée pour l'instant.</td></tr>
            )}
            {sales.map((s) => (
              <tr key={s.id} className="border-t border-gas-line">
                <td className="px-4 py-2 tabular text-gas-muted">
                  {new Date(s.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </td>
                <td className="px-4 py-2 font-medium flex items-center gap-2">
                  <BrandLogo nom={s.bottle_brands?.nom} logoUrl={s.bottle_brands?.logo_url} size={20} />
                  {s.bottle_brands?.nom}
                </td>
                <td className="px-4 py-2 text-gas-muted">{s.taille}</td>
                <td className="px-4 py-2 tabular">{Number(s.montant).toLocaleString('fr-FR')} F</td>
                <td className="px-4 py-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    s.mode_paiement === 'especes' ? 'bg-gas-line text-gas-muted' : 'bg-navy-800/10 text-navy-800'
                  }`}>
                    {paymentModeLabel(s.mode_paiement)}
                  </span>
                  {!s.avec_echange && (
                    <span className="ml-1 text-xs px-2 py-0.5 rounded-full bg-flame-100 text-flame-600" title={s.client_nom || ''}>
                      Sans vide{s.client_nom ? ` — ${s.client_nom}` : ''}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gas-muted mt-4">
        Une erreur de saisie ? Contactez le patron ou l'administrateur — seuls eux peuvent corriger ou annuler une vente déjà enregistrée.
      </p>
    </Layout>
  )
}
