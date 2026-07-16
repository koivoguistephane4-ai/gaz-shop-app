import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'
import Layout from '../../components/Layout'
import BrandLogo from '../../components/BrandLogo'

export default function PrixPage() {
  const { profile } = useAuth()
  const [brands, setBrands] = useState([])
  const [prices, setPrices] = useState([]) // toutes les entrées, triées par date desc
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)

  const [form, setForm] = useState({ brand_id: '', taille: 'B6', prix: '' })

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    const [{ data: brandsData }, { data: pricesData }] = await Promise.all([
      supabase.from('bottle_brands').select('*').order('nom'),
      supabase.from('bottle_prices').select('*, bottle_brands(nom)').order('effective_date', { ascending: false }),
    ])
    setBrands(brandsData ?? [])
    setPrices(pricesData ?? [])
    setLoading(false)
  }

  // Prix courant = entrée la plus récente par marque+taille dont la date d'effet est passée
  function currentPrice(brandId, taille) {
    const today = new Date().toISOString().slice(0, 10)
    return prices.find((p) => p.brand_id === brandId && p.taille === taille && p.effective_date <= today)
  }

  async function handleAddPrice(e) {
    e.preventDefault()
    setSaving(true)
    setMessage(null)

    const { error } = await supabase.from('bottle_prices').insert({
      brand_id: form.brand_id,
      taille: form.taille,
      prix: Number(form.prix),
      created_by: profile.id,
    })

    setSaving(false)

    if (error) {
      setMessage({ type: 'error', text: `Erreur : ${error.message}` })
      return
    }

    setMessage({ type: 'success', text: 'Nouveau prix appliqué dès aujourd\'hui.' })
    setForm({ brand_id: '', taille: 'B6', prix: '' })
    load()
  }

  async function handleDelete(priceId) {
    const confirmed = window.confirm(
      "Supprimer cette entrée de prix ? Les ventes déjà enregistrées gardent leur montant d'origine, seule cette ligne d'historique disparaît."
    )
    if (!confirmed) return

    const { error } = await supabase.from('bottle_prices').delete().eq('id', priceId)
    if (error) {
      setMessage({ type: 'error', text: `Suppression impossible : ${error.message}` })
    } else {
      load()
    }
  }

  async function handleLogoChange(brand, file) {
    if (!file) return
    setMessage(null)

    const ext = file.name.split('.').pop()
    const path = `${brand.id}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('brand-logos')
      .upload(path, file, { upsert: true })

    if (uploadError) {
      setMessage({ type: 'error', text: `Envoi de l'image échoué : ${uploadError.message}` })
      return
    }

    const { data: publicUrlData } = supabase.storage.from('brand-logos').getPublicUrl(path)
    // Ajoute un paramètre unique pour forcer le rechargement de l'image (contourne le cache navigateur)
    const logoUrl = `${publicUrlData.publicUrl}?t=${Date.now()}`

    const { error: updateError } = await supabase
      .from('bottle_brands')
      .update({ logo_url: logoUrl })
      .eq('id', brand.id)

    if (updateError) {
      setMessage({ type: 'error', text: `Enregistrement du logo échoué : ${updateError.message}` })
      return
    }

    setMessage({ type: 'success', text: `Logo mis à jour pour ${brand.nom}.` })
    load()
  }

  return (
    <Layout>
      <h1 className="text-xl font-semibold mb-6">Prix des bouteilles</h1>

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
        {/* Formulaire nouveau prix */}
        <div className="card p-5 h-fit">
          <h2 className="font-semibold mb-4">Nouveau prix</h2>
          <form onSubmit={handleAddPrice} className="space-y-3">
            <div>
              <label className="block text-sm text-gas-muted mb-1">Marque</label>
              <select
                className="input-field"
                value={form.brand_id}
                onChange={(e) => setForm((f) => ({ ...f, brand_id: e.target.value }))}
                required
              >
                <option value="">— Choisir —</option>
                {brands.map((b) => <option key={b.id} value={b.id}>{b.nom}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gas-muted mb-1">Taille</label>
              <select
                className="input-field"
                value={form.taille}
                onChange={(e) => setForm((f) => ({ ...f, taille: e.target.value }))}
              >
                <option value="B6">B6</option>
                <option value="B12">B12</option>
              <option value="B28">B28</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-gas-muted mb-1">Nouveau prix (FCFA)</label>
              <input
                type="number"
                min="0"
                className="input-field"
                value={form.prix}
                onChange={(e) => setForm((f) => ({ ...f, prix: e.target.value }))}
                required
              />
            </div>
            <button type="submit" disabled={saving} className="btn-primary w-full disabled:opacity-50">
              {saving ? 'Enregistrement…' : 'Appliquer ce prix'}
            </button>
            <p className="text-xs text-gas-muted">
              S'applique immédiatement à toutes les nouvelles ventes. Les ventes déjà enregistrées ne sont pas affectées.
            </p>
          </form>
        </div>

        {/* Prix actuels */}
        <div className="lg:col-span-2 space-y-6">
          <div className="card overflow-x-auto">
            <div className="px-4 py-3 bg-gas-bg text-sm font-semibold text-gas-muted">Prix actuels</div>
            <table className="w-full text-sm">
              <thead className="text-gas-muted text-left border-t border-gas-line">
                <tr>
                  <th className="px-4 py-2 font-medium"></th>
                  <th className="px-4 py-2 font-medium">Marque</th>
                  <th className="px-4 py-2 font-medium">B6</th>
                  <th className="px-4 py-2 font-medium">B12</th>
                </tr>
              </thead>
              <tbody>
                {brands.map((b) => (
                  <tr key={b.id} className="border-t border-gas-line">
                    <td className="px-4 py-2">
                      <label className="cursor-pointer block" title="Changer le logo">
                        <BrandLogo nom={b.nom} logoUrl={b.logo_url} size={32} />
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => handleLogoChange(b, e.target.files?.[0])}
                        />
                      </label>
                    </td>
                    <td className="px-4 py-2 font-medium">{b.nom}</td>
                    <td className="px-4 py-2 tabular">
                      {currentPrice(b.id, 'B6')?.prix?.toLocaleString('fr-FR') ?? '—'} F
                    </td>
                    <td className="px-4 py-2 tabular">
                      {currentPrice(b.id, 'B12')?.prix?.toLocaleString('fr-FR') ?? '—'} F
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gas-muted -mt-2">Cliquez sur le rond à gauche d'une marque pour changer son logo (image carrée recommandée).</p>

          <div className="card overflow-x-auto">
            <div className="px-4 py-3 bg-gas-bg text-sm font-semibold text-gas-muted">Historique des prix</div>
            <table className="w-full text-sm">
              <thead className="text-gas-muted text-left border-t border-gas-line">
                <tr>
                  <th className="px-4 py-2 font-medium">Date d'effet</th>
                  <th className="px-4 py-2 font-medium">Marque</th>
                  <th className="px-4 py-2 font-medium">Taille</th>
                  <th className="px-4 py-2 font-medium">Prix</th>
                  <th className="px-4 py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr><td className="px-4 py-4 text-gas-muted" colSpan={5}>Chargement…</td></tr>
                )}
                {!loading && prices.length === 0 && (
                  <tr><td className="px-4 py-4 text-gas-muted" colSpan={5}>Aucun prix défini pour l'instant.</td></tr>
                )}
                {prices.map((p) => (
                  <tr key={p.id} className="border-t border-gas-line">
                    <td className="px-4 py-2 tabular">{p.effective_date}</td>
                    <td className="px-4 py-2">{p.bottle_brands?.nom}</td>
                    <td className="px-4 py-2 text-gas-muted">{p.taille}</td>
                    <td className="px-4 py-2 tabular">{Number(p.prix).toLocaleString('fr-FR')} F</td>
                    <td className="px-4 py-2 text-right">
                      <button
                        onClick={() => handleDelete(p.id)}
                        className="text-gas-danger text-xs font-medium hover:underline"
                      >
                        Supprimer
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Layout>
  )
}
