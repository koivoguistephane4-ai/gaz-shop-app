import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'
import Layout from '../../components/Layout'

const STATUT_LABEL = {
  en_attente: 'En attente',
  livree: 'Livrée',
  payee: 'Payée',
  annulee: 'Annulée',
}

const STATUT_COLOR = {
  en_attente: 'bg-flame-100 text-flame-600',
  livree: 'bg-navy-800/10 text-navy-800',
  payee: 'bg-gas-success/10 text-gas-success',
  annulee: 'bg-gas-line text-gas-muted',
}

export default function CommandesPage() {
  const { profile } = useAuth()
  const [sousDepots, setSousDepots] = useState([])
  const [brands, setBrands] = useState([])
  const [commandes, setCommandes] = useState([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState(null)

  // Formulaire nouveau sous-dépôt
  const [showNewSousDepot, setShowNewSousDepot] = useState(false)
  const [newSousDepot, setNewSousDepot] = useState({ nom: '', telephone: '' })

  // Formulaire nouvelle commande
  const [orderForm, setOrderForm] = useState({ sous_depot_id: '', avec_echange: false, notes: '' })
  const [cart, setCart] = useState([]) // { brand_id, brand_nom, taille, quantite }
  const [lineForm, setLineForm] = useState({ brand_id: '', taille: 'B6', quantite: 1 })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (profile) load()
  }, [profile])

  async function load() {
    setLoading(true)
    const [{ data: sd }, { data: b }, { data: c }] = await Promise.all([
      supabase.from('sous_depots').select('*').eq('boutique_id', profile.boutique_id).order('nom'),
      supabase.from('bottle_brands').select('*').order('nom'),
      supabase
        .from('commandes')
        .select('*, sous_depots(nom), commande_lignes(*, bottle_brands(nom))')
        .eq('boutique_id', profile.boutique_id)
        .order('date_commande', { ascending: false }),
    ])
    setSousDepots(sd ?? [])
    setBrands(b ?? [])
    setCommandes(c ?? [])
    setLoading(false)
  }

  async function handleCreateSousDepot(e) {
    e.preventDefault()
    if (!newSousDepot.nom.trim()) return

    const { error } = await supabase.from('sous_depots').insert({
      boutique_id: profile.boutique_id,
      nom: newSousDepot.nom.trim(),
      telephone: newSousDepot.telephone.trim() || null,
      created_by: profile.id,
    })

    if (error) {
      setMessage({ type: 'error', text: `Erreur : ${error.message}` })
      return
    }

    setNewSousDepot({ nom: '', telephone: '' })
    setShowNewSousDepot(false)
    load()
  }

  function addLineToCart() {
    if (!lineForm.brand_id || lineForm.quantite <= 0) return
    const brand = brands.find((b) => b.id === lineForm.brand_id)
    setCart((prev) => [...prev, { ...lineForm, brand_nom: brand?.nom, quantite: Number(lineForm.quantite) }])
    setLineForm({ brand_id: '', taille: 'B6', quantite: 1 })
  }

  function removeLineFromCart(index) {
    setCart((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleSubmitOrder(e) {
    e.preventDefault()
    if (!orderForm.sous_depot_id || cart.length === 0) {
      setMessage({ type: 'error', text: 'Choisissez un sous-dépôt et ajoutez au moins une ligne.' })
      return
    }

    setSaving(true)
    setMessage(null)

    const { data: commande, error } = await supabase
      .from('commandes')
      .insert({
        boutique_id: profile.boutique_id,
        sous_depot_id: orderForm.sous_depot_id,
        gerant_id: profile.id,
        avec_echange: orderForm.avec_echange,
        notes: orderForm.notes.trim() || null,
      })
      .select()
      .single()

    if (error) {
      setSaving(false)
      setMessage({ type: 'error', text: `Erreur création commande : ${error.message}` })
      return
    }

    const lignes = cart.map((l) => ({
      commande_id: commande.id,
      brand_id: l.brand_id,
      taille: l.taille,
      quantite: l.quantite,
    }))

    const { error: lignesError } = await supabase.from('commande_lignes').insert(lignes)

    setSaving(false)

    if (lignesError) {
      setMessage({ type: 'error', text: `Commande créée mais erreur sur les lignes : ${lignesError.message}` })
      return
    }

    setMessage({ type: 'success', text: `Commande ${commande.reference} créée.` })
    setOrderForm({ sous_depot_id: '', avec_echange: false, notes: '' })
    setCart([])
    load()
  }

  async function updateStatut(commande, statut) {
    const { error } = await supabase.from('commandes').update({ statut }).eq('id', commande.id)
    if (error) {
      setMessage({ type: 'error', text: `Erreur : ${error.message}` })
    } else {
      setMessage({ type: 'success', text: `Commande ${commande.reference} → ${STATUT_LABEL[statut]}.` })
      load()
    }
  }

  return (
    <Layout>
      <h1 className="text-xl font-semibold mb-6">Commandes des sous-dépôts</h1>

      {message && (
        <div
          className={`mb-4 text-sm px-4 py-2 rounded-card ${
            message.type === 'error' ? 'bg-gas-danger/10 text-gas-danger' : 'bg-gas-success/10 text-gas-success'
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Nouvelle commande */}
        <div className="lg:col-span-2 card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">Nouvelle commande</h2>
            <button
              type="button"
              onClick={() => setShowNewSousDepot((v) => !v)}
              className="text-xs text-flame-600 font-medium hover:underline"
            >
              + Nouveau sous-dépôt
            </button>
          </div>

          {showNewSousDepot && (
            <form onSubmit={handleCreateSousDepot} className="flex flex-col sm:flex-row gap-2 mb-4 p-3 bg-gas-bg rounded-card">
              <input
                className="input-field"
                placeholder="Nom du sous-dépôt"
                value={newSousDepot.nom}
                onChange={(e) => setNewSousDepot((f) => ({ ...f, nom: e.target.value }))}
                required
              />
              <input
                className="input-field"
                placeholder="Téléphone (optionnel)"
                value={newSousDepot.telephone}
                onChange={(e) => setNewSousDepot((f) => ({ ...f, telephone: e.target.value }))}
              />
              <button type="submit" className="btn-secondary whitespace-nowrap">Créer</button>
            </form>
          )}

          <div className="mb-4">
            <label className="block text-sm text-gas-muted mb-1">Sous-dépôt</label>
            <select
              className="input-field"
              value={orderForm.sous_depot_id}
              onChange={(e) => setOrderForm((f) => ({ ...f, sous_depot_id: e.target.value }))}
            >
              <option value="">— Choisir —</option>
              {sousDepots.map((sd) => <option key={sd.id} value={sd.id}>{sd.nom}</option>)}
            </select>
            {sousDepots.length === 0 && (
              <p className="text-xs text-gas-muted mt-1">Aucun sous-dépôt encore créé — utilisez le bouton ci-dessus.</p>
            )}
          </div>

          {/* Ajout de lignes au panier */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-end mb-3">
            <div className="sm:col-span-2">
              <label className="block text-xs text-gas-muted mb-1">Marque</label>
              <select
                className="input-field"
                value={lineForm.brand_id}
                onChange={(e) => setLineForm((f) => ({ ...f, brand_id: e.target.value }))}
              >
                <option value="">— Choisir —</option>
                {brands.map((b) => <option key={b.id} value={b.id}>{b.nom}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gas-muted mb-1">Taille</label>
              <select
                className="input-field"
                value={lineForm.taille}
                onChange={(e) => setLineForm((f) => ({ ...f, taille: e.target.value }))}
              >
                <option value="B6">B6</option>
                <option value="B12">B12</option>
              </select>
            </div>
            <div className="flex gap-2">
              <input
                type="number"
                min="1"
                className="input-field"
                value={lineForm.quantite}
                onChange={(e) => setLineForm((f) => ({ ...f, quantite: e.target.value }))}
              />
              <button type="button" onClick={addLineToCart} className="btn-secondary whitespace-nowrap px-3">+</button>
            </div>
          </div>

          {cart.length > 0 && (
            <div className="mb-4 border border-gas-line rounded-card divide-y divide-gas-line">
              {cart.map((l, i) => (
                <div key={i} className="flex items-center justify-between px-3 py-2 text-sm">
                  <span>{l.brand_nom} — {l.taille} × {l.quantite}</span>
                  <button onClick={() => removeLineFromCart(i)} className="text-gas-danger text-xs hover:underline">Retirer</button>
                </div>
              ))}
            </div>
          )}

          <label className="flex items-center gap-2 text-sm mb-3">
            <input
              type="checkbox"
              checked={orderForm.avec_echange}
              onChange={(e) => setOrderForm((f) => ({ ...f, avec_echange: e.target.checked }))}
            />
            Le sous-dépôt rendra des bouteilles vides en échange
          </label>

          <input
            className="input-field mb-3"
            placeholder="Notes (optionnel)"
            value={orderForm.notes}
            onChange={(e) => setOrderForm((f) => ({ ...f, notes: e.target.value }))}
          />

          <button
            onClick={handleSubmitOrder}
            disabled={saving || cart.length === 0 || !orderForm.sous_depot_id}
            className="btn-primary disabled:opacity-50"
          >
            {saving ? 'Création…' : 'Créer la commande'}
          </button>
        </div>

        {/* Liste des sous-dépôts */}
        <div className="card p-5 h-fit">
          <h2 className="font-semibold mb-3">Sous-dépôts</h2>
          {sousDepots.length === 0 && <p className="text-sm text-gas-muted">Aucun pour l'instant.</p>}
          <div className="space-y-2">
            {sousDepots.map((sd) => (
              <div key={sd.id} className="text-sm">
                <div className="font-medium">{sd.nom}</div>
                {sd.telephone && <div className="text-xs text-gas-muted">{sd.telephone}</div>}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Liste des commandes */}
      <h2 className="text-sm font-semibold text-gas-muted mb-3">Historique des commandes</h2>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gas-bg text-gas-muted text-left">
            <tr>
              <th className="px-4 py-3 font-medium">Référence</th>
              <th className="px-4 py-3 font-medium">Sous-dépôt</th>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Contenu</th>
              <th className="px-4 py-3 font-medium">Montant</th>
              <th className="px-4 py-3 font-medium">Statut</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td className="px-4 py-4 text-gas-muted" colSpan={7}>Chargement…</td></tr>
            )}
            {!loading && commandes.length === 0 && (
              <tr><td className="px-4 py-4 text-gas-muted" colSpan={7}>Aucune commande pour l'instant.</td></tr>
            )}
            {commandes.map((c) => (
              <tr key={c.id} className="border-t border-gas-line align-top">
                <td className="px-4 py-2 font-mono text-xs font-medium">{c.reference}</td>
                <td className="px-4 py-2">{c.sous_depots?.nom}</td>
                <td className="px-4 py-2 tabular text-gas-muted">
                  {new Date(c.date_commande).toLocaleDateString('fr-FR')}
                </td>
                <td className="px-4 py-2 text-xs text-gas-muted">
                  {(c.commande_lignes ?? []).map((l, i) => (
                    <div key={i}>{l.bottle_brands?.nom} {l.taille} × {l.quantite}</div>
                  ))}
                </td>
                <td className="px-4 py-2 tabular">{Number(c.montant_total).toLocaleString('fr-FR')} F</td>
                <td className="px-4 py-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${STATUT_COLOR[c.statut]}`}>
                    {STATUT_LABEL[c.statut]}
                  </span>
                </td>
                <td className="px-4 py-2 text-right space-y-1">
                  {c.statut === 'en_attente' && (
                    <button onClick={() => updateStatut(c, 'livree')} className="block text-xs text-navy-800 hover:underline">
                      Marquer livrée
                    </button>
                  )}
                  {c.statut === 'livree' && (
                    <button onClick={() => updateStatut(c, 'payee')} className="block text-xs text-gas-success hover:underline">
                      Marquer payée
                    </button>
                  )}
                  {(c.statut === 'en_attente' || c.statut === 'livree') && (
                    <button onClick={() => updateStatut(c, 'annulee')} className="block text-xs text-gas-danger hover:underline">
                      Annuler
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gas-muted mt-4">
        Marquer une commande « livrée » retire automatiquement les bouteilles du stock. Une fois « payée », la référence (ex: {commandes[0]?.reference || 'CMD-2026-0001'}) sert de preuve pour retrouver la commande en cas de litige.
      </p>
    </Layout>
  )
}
