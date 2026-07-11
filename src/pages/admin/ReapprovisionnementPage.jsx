import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'
import Layout from '../../components/Layout'

export default function ReapprovisionnementPage() {
  const { profile } = useAuth()
  const [boutiques, setBoutiques] = useState([])
  const [brands, setBrands] = useState([])
  const [stock, setStock] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)

  const [form, setForm] = useState({
    boutique_id: '',
    brand_id: '',
    taille: 'B6',
    type: 'livraison_pleines',
    quantite: '',
  })

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)

    // Admin voit toutes les boutiques ; boss seulement les siennes (RLS s'en charge déjà)
    const [{ data: boutiquesData }, { data: brandsData }, { data: stockData }] = await Promise.all([
      supabase.from('boutiques').select('*').order('nom'),
      supabase.from('bottle_brands').select('*').order('nom'),
      supabase.from('stock').select('*, boutiques(nom), bottle_brands(nom)'),
    ])

    setBoutiques(boutiquesData ?? [])
    setBrands(brandsData ?? [])
    setStock(stockData ?? [])
    setLoading(false)
  }

  function updateForm(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setMessage(null)

    const { error } = await supabase.from('restock_entries').insert({
      boutique_id: form.boutique_id,
      brand_id: form.brand_id,
      taille: form.taille,
      type: form.type,
      quantite: Number(form.quantite),
      created_by: profile.id,
    })

    setSaving(false)

    if (error) {
      setMessage({ type: 'error', text: `Erreur : ${error.message}` })
      return
    }

    setMessage({ type: 'success', text: 'Stock mis à jour.' })
    setForm((prev) => ({ ...prev, quantite: '' }))
    load()
  }

  return (
    <Layout>
      <h1 className="text-xl font-semibold mb-6">Réapprovisionnement & stock</h1>

      {message && (
        <div
          className={`mb-4 text-sm px-4 py-2 rounded-card ${
            message.type === 'error' ? 'bg-gas-danger/10 text-gas-danger' : 'bg-gas-success/10 text-gas-success'
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Formulaire */}
        <div className="card p-5 h-fit">
          <h2 className="font-semibold mb-4">Nouveau mouvement</h2>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-sm text-gas-muted mb-1">Boutique</label>
              <select
                className="input-field"
                value={form.boutique_id}
                onChange={(e) => updateForm('boutique_id', e.target.value)}
                required
              >
                <option value="">— Choisir —</option>
                {boutiques.map((b) => <option key={b.id} value={b.id}>{b.nom}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gas-muted mb-1">Marque</label>
              <select
                className="input-field"
                value={form.brand_id}
                onChange={(e) => updateForm('brand_id', e.target.value)}
                required
              >
                <option value="">— Choisir —</option>
                {brands.map((b) => <option key={b.id} value={b.id}>{b.nom}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gas-muted mb-1">Taille</label>
              <select className="input-field" value={form.taille} onChange={(e) => updateForm('taille', e.target.value)}>
                <option value="B6">B6</option>
                <option value="B12">B12</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-gas-muted mb-1">Type de mouvement</label>
              <select className="input-field" value={form.type} onChange={(e) => updateForm('type', e.target.value)}>
                <option value="livraison_pleines">Livraison de pleines (+ stock)</option>
                <option value="retour_vides_fournisseur">Retour de vides au fournisseur (− stock)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-gas-muted mb-1">Quantité</label>
              <input
                type="number"
                min="1"
                className="input-field"
                value={form.quantite}
                onChange={(e) => updateForm('quantite', e.target.value)}
                required
              />
            </div>
            <button type="submit" disabled={saving} className="btn-primary w-full disabled:opacity-50">
              {saving ? 'Enregistrement…' : 'Enregistrer le mouvement'}
            </button>
          </form>
        </div>

        {/* Vue du stock actuel */}
        <div className="lg:col-span-2 card overflow-x-auto h-fit">
          <table className="w-full text-sm">
            <thead className="bg-gas-bg text-gas-muted text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Boutique</th>
                <th className="px-4 py-3 font-medium">Marque</th>
                <th className="px-4 py-3 font-medium">Taille</th>
                <th className="px-4 py-3 font-medium">Pleines</th>
                <th className="px-4 py-3 font-medium">Vides</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td className="px-4 py-4 text-gas-muted" colSpan={5}>Chargement…</td></tr>
              )}
              {!loading && stock.length === 0 && (
                <tr><td className="px-4 py-4 text-gas-muted" colSpan={5}>Aucun mouvement de stock pour l'instant.</td></tr>
              )}
              {stock.map((s) => (
                <tr key={`${s.boutique_id}-${s.brand_id}-${s.taille}`} className="border-t border-gas-line">
                  <td className="px-4 py-2">{s.boutiques?.nom}</td>
                  <td className="px-4 py-2 font-medium">{s.bottle_brands?.nom}</td>
                  <td className="px-4 py-2 text-gas-muted">{s.taille}</td>
                  <td className="px-4 py-2 tabular">{s.pleines}</td>
                  <td className="px-4 py-2 tabular">{s.vides}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  )
}
