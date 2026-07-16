import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'
import Layout from '../../components/Layout'
import BrandLogo from '../../components/BrandLogo'

export default function NouvelleCommandePage() {
  const { profile } = useAuth()
  const [brands, setBrands] = useState([])
  const [prices, setPrices] = useState({}) // `${brand_id}-${taille}` -> prix
  const [cart, setCart] = useState([])
  const [lineForm, setLineForm] = useState({ brand_id: '', taille: 'B6', quantite: 1 })
  const [avecEchange, setAvecEchange] = useState(true)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    const today = new Date().toISOString().slice(0, 10)
    const [{ data: brandsData }, { data: priceData }] = await Promise.all([
      supabase.from('bottle_brands').select('*').order('nom'),
      supabase.from('bottle_prices').select('*').lte('effective_date', today).order('effective_date', { ascending: false }),
    ])
    setBrands(brandsData ?? [])

    const pMap = {}
    for (const p of priceData ?? []) {
      const key = `${p.brand_id}-${p.taille}`
      if (!(key in pMap)) pMap[key] = p.prix
    }
    setPrices(pMap)
  }

  function addLine() {
    if (!lineForm.brand_id || lineForm.quantite <= 0) return
    const brand = brands.find((b) => b.id === lineForm.brand_id)
    setCart((prev) => [...prev, { ...lineForm, brand_nom: brand?.nom, logo: brand?.logo_url, quantite: Number(lineForm.quantite) }])
    setLineForm({ brand_id: '', taille: 'B6', quantite: 1 })
  }

  function removeLine(i) {
    setCart((prev) => prev.filter((_, idx) => idx !== i))
  }

  const totalEstime = cart.reduce((sum, l) => sum + (prices[`${l.brand_id}-${l.taille}`] ?? 0) * l.quantite, 0)

  async function handleSubmit() {
    if (cart.length === 0) {
      setMessage({ type: 'error', text: 'Ajoutez au moins une ligne à la commande.' })
      return
    }

    setSaving(true)
    setMessage(null)

    // Récupère l'id de sa propre fiche sous-dépôt
    const { data: sousDepot, error: sdError } = await supabase
      .from('sous_depots')
      .select('id')
      .eq('profile_id', profile.id)
      .single()

    if (sdError || !sousDepot) {
      setSaving(false)
      setMessage({ type: 'error', text: "Votre fiche sous-dépôt est introuvable. Contactez l'administrateur." })
      return
    }

    const { data: commande, error } = await supabase
      .from('commandes')
      .insert({
        boutique_id: profile.boutique_id,
        sous_depot_id: sousDepot.id,
        avec_echange: avecEchange,
        notes: notes.trim() || null,
      })
      .select()
      .single()

    if (error) {
      setSaving(false)
      setMessage({ type: 'error', text: `Erreur : ${error.message}` })
      return
    }

    const lignes = cart.map((l) => ({ commande_id: commande.id, brand_id: l.brand_id, taille: l.taille, quantite: l.quantite }))
    const { error: lignesError } = await supabase.from('commande_lignes').insert(lignes)

    setSaving(false)

    if (lignesError) {
      setMessage({ type: 'error', text: `Commande créée mais erreur sur les lignes : ${lignesError.message}` })
      return
    }

    setMessage({ type: 'success', text: `Commande ${commande.reference} envoyée ! Vous serez notifié quand elle sera livrée.` })
    setCart([])
    setNotes('')
  }

  return (
    <Layout>
      <h1 className="text-xl font-semibold mb-6">Passer une commande</h1>

      {message && (
        <div
          className={`mb-4 text-sm px-4 py-2 rounded-card ${
            message.type === 'error' ? 'bg-gas-danger/10 text-gas-danger' : 'bg-gas-success/10 text-gas-success'
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="card p-5 mb-6">
        <h2 className="text-sm font-semibold text-gas-muted mb-4">Ajouter des bouteilles</h2>

        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-8 gap-2 mb-4">
          {brands.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => setLineForm((f) => ({ ...f, brand_id: b.id }))}
              className={`flex flex-col items-center gap-1.5 p-2 rounded-card border transition-colors ${
                lineForm.brand_id === b.id ? 'border-flame-500 bg-flame-100/50' : 'border-gas-line hover:border-flame-500/50'
              }`}
            >
              <BrandLogo nom={b.nom} logoUrl={b.logo_url} size={36} />
              <span className="text-xs font-medium text-center leading-tight">{b.nom}</span>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
          <div>
            <label className="block text-sm text-gas-muted mb-1">Taille</label>
            <select className="input-field" value={lineForm.taille} onChange={(e) => setLineForm((f) => ({ ...f, taille: e.target.value }))}>
              <option value="B6">B6</option>
              <option value="B12">B12</option>
              <option value="B28">B28</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-gas-muted mb-1">Quantité</label>
            <input
              type="number"
              min="1"
              className="input-field"
              value={lineForm.quantite}
              onChange={(e) => setLineForm((f) => ({ ...f, quantite: e.target.value }))}
            />
          </div>
          <button type="button" onClick={addLine} disabled={!lineForm.brand_id} className="btn-secondary disabled:opacity-50">
            + Ajouter à la commande
          </button>
        </div>
      </div>

      {cart.length > 0 && (
        <div className="card overflow-x-auto mb-6">
          <table className="w-full text-sm">
            <thead className="bg-gas-bg text-gas-muted text-left">
              <tr>
                <th className="px-4 py-2 font-medium">Marque</th>
                <th className="px-4 py-2 font-medium">Taille</th>
                <th className="px-4 py-2 font-medium">Quantité</th>
                <th className="px-4 py-2 font-medium">Sous-total estimé</th>
                <th className="px-4 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {cart.map((l, i) => (
                <tr key={i} className="border-t border-gas-line">
                  <td className="px-4 py-2 font-medium flex items-center gap-2">
                    <BrandLogo nom={l.brand_nom} logoUrl={l.logo} size={20} />
                    {l.brand_nom}
                  </td>
                  <td className="px-4 py-2 text-gas-muted">{l.taille}</td>
                  <td className="px-4 py-2 tabular">{l.quantite}</td>
                  <td className="px-4 py-2 tabular">
                    {((prices[`${l.brand_id}-${l.taille}`] ?? 0) * l.quantite).toLocaleString('fr-FR')} F
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button onClick={() => removeLine(i)} className="text-gas-danger text-xs hover:underline">Retirer</button>
                  </td>
                </tr>
              ))}
              <tr className="border-t border-gas-line bg-gas-bg font-semibold">
                <td className="px-4 py-2" colSpan={3}>Total estimé</td>
                <td className="px-4 py-2 tabular" colSpan={2}>{totalEstime.toLocaleString('fr-FR')} F</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      <div className="card p-5">
        <label className="flex items-center gap-2 text-sm mb-3">
          <input type="checkbox" checked={avecEchange} onChange={(e) => setAvecEchange(e.target.checked)} />
          Je rendrai des bouteilles vides en échange
        </label>
        <input
          className="input-field mb-4"
          placeholder="Notes (optionnel)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
        <button
          onClick={handleSubmit}
          disabled={saving || cart.length === 0}
          className="btn-primary disabled:opacity-50"
        >
          {saving ? 'Envoi…' : 'Envoyer la commande'}
        </button>
      </div>
    </Layout>
  )
}
