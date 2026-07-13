import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import Layout from '../../components/Layout'
import { paymentModeLabel } from '../../lib/paymentModes'

export default function VentesPage() {
  const [boutiques, setBoutiques] = useState([])
  const [brands, setBrands] = useState([])
  const [sales, setSales] = useState([])
  const [boutiqueFilter, setBoutiqueFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({ brand_id: '', taille: 'B6' })

  useEffect(() => {
    load()
  }, [])

  useEffect(() => {
    loadSales()
  }, [boutiqueFilter])

  async function load() {
    setLoading(true)
    const [{ data: boutiquesData }, { data: brandsData }] = await Promise.all([
      supabase.from('boutiques').select('*').order('nom'),
      supabase.from('bottle_brands').select('*').order('nom'),
    ])
    setBoutiques(boutiquesData ?? [])
    setBrands(brandsData ?? [])
    await loadSales()
    setLoading(false)
  }

  async function loadSales() {
    let query = supabase
      .from('sale_transactions')
      .select('*, boutiques(nom), bottle_brands(nom), profiles(nom)')
      .order('created_at', { ascending: false })
      .limit(100)

    if (boutiqueFilter) query = query.eq('boutique_id', boutiqueFilter)

    const { data } = await query
    setSales(data ?? [])
  }

  function startEdit(sale) {
    setEditingId(sale.id)
    setEditForm({ brand_id: sale.brand_id, taille: sale.taille })
    setMessage(null)
  }

  async function handleSaveEdit(saleId) {
    const { error } = await supabase
      .from('sale_transactions')
      .update({ brand_id: editForm.brand_id, taille: editForm.taille })
      .eq('id', saleId)

    if (error) {
      setMessage({ type: 'error', text: `Correction impossible : ${error.message}` })
      return
    }

    setMessage({ type: 'success', text: 'Vente corrigée. Le stock a été ajusté automatiquement.' })
    setEditingId(null)
    loadSales()
  }

  async function handleDelete(sale) {
    const confirmed = window.confirm(
      `Annuler cette vente (${sale.bottle_brands?.nom} ${sale.taille}) ? La bouteille pleine sera recréditée au stock.`
    )
    if (!confirmed) return

    const { error } = await supabase.from('sale_transactions').delete().eq('id', sale.id)

    if (error) {
      setMessage({ type: 'error', text: `Suppression impossible : ${error.message}` })
    } else {
      setMessage({ type: 'success', text: 'Vente annulée, stock recrédité.' })
      loadSales()
    }
  }

  return (
    <Layout>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <h1 className="text-xl font-semibold">Ventes — correction</h1>
        <select
          className="input-field w-full sm:w-56"
          value={boutiqueFilter}
          onChange={(e) => setBoutiqueFilter(e.target.value)}
        >
          <option value="">Toutes les boutiques</option>
          {boutiques.map((b) => <option key={b.id} value={b.id}>{b.nom}</option>)}
        </select>
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

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gas-bg text-gas-muted text-left">
            <tr>
              <th className="px-4 py-3 font-medium">Heure</th>
              <th className="px-4 py-3 font-medium">Boutique</th>
              <th className="px-4 py-3 font-medium">Gérant</th>
              <th className="px-4 py-3 font-medium">Marque</th>
              <th className="px-4 py-3 font-medium">Taille</th>
              <th className="px-4 py-3 font-medium">Montant</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td className="px-4 py-4 text-gas-muted" colSpan={7}>Chargement…</td></tr>
            )}
            {!loading && sales.length === 0 && (
              <tr><td className="px-4 py-4 text-gas-muted" colSpan={7}>Aucune vente trouvée.</td></tr>
            )}
            {sales.map((s) => (
              <tr key={s.id} className="border-t border-gas-line">
                <td className="px-4 py-2 tabular text-gas-muted">
                  {new Date(s.created_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </td>
                <td className="px-4 py-2">{s.boutiques?.nom}</td>
                <td className="px-4 py-2 text-gas-muted">{s.profiles?.nom}</td>

                {editingId === s.id ? (
                  <>
                    <td className="px-4 py-2">
                      <select
                        className="input-field"
                        value={editForm.brand_id}
                        onChange={(e) => setEditForm((f) => ({ ...f, brand_id: e.target.value }))}
                      >
                        {brands.map((b) => <option key={b.id} value={b.id}>{b.nom}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-2">
                      <select
                        className="input-field"
                        value={editForm.taille}
                        onChange={(e) => setEditForm((f) => ({ ...f, taille: e.target.value }))}
                      >
                        <option value="B6">B6</option>
                        <option value="B12">B12</option>
                      </select>
                    </td>
                    <td className="px-4 py-2 tabular text-gas-muted">recalculé</td>
                    <td className="px-4 py-2 text-right space-x-3">
                      <button onClick={() => handleSaveEdit(s.id)} className="text-gas-success text-xs font-medium hover:underline">
                        Valider
                      </button>
                      <button onClick={() => setEditingId(null)} className="text-gas-muted text-xs font-medium hover:underline">
                        Annuler
                      </button>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-4 py-2 font-medium">{s.bottle_brands?.nom}</td>
                    <td className="px-4 py-2 text-gas-muted">{s.taille}</td>
                    <td className="px-4 py-2 tabular">
                      {Number(s.montant).toLocaleString('fr-FR')} F
                      <span className="ml-2 text-xs text-gas-muted">
                        ({paymentModeLabel(s.mode_paiement)})
                      </span>
                      {!s.avec_echange && (
                        <span className="ml-2 text-xs px-1.5 py-0.5 rounded-full bg-flame-100 text-flame-600" title={s.client_nom || ''}>
                          sans vide
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right space-x-3">
                      <button onClick={() => startEdit(s)} className="text-flame-600 text-xs font-medium hover:underline">
                        Corriger
                      </button>
                      <button onClick={() => handleDelete(s)} className="text-gas-danger text-xs font-medium hover:underline">
                        Annuler
                      </button>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gas-muted mt-4">
        Chaque correction ou annulation ajuste automatiquement le stock et est tracée dans le journal d'audit
        (<code>sale_audit_log</code>).
      </p>
    </Layout>
  )
}
