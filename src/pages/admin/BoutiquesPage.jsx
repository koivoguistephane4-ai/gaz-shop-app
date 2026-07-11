import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import Layout from '../../components/Layout'

export default function BoutiquesPage() {
  const [boutiques, setBoutiques] = useState([])
  const [loading, setLoading] = useState(true)
  const [nom, setNom] = useState('')
  const [adresse, setAdresse] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    const { data, error } = await supabase
      .from('boutiques')
      .select('*, profiles!boutique_id(count)')
      .order('created_at', { ascending: false })

    if (error) {
      setMessage({ type: 'error', text: `Erreur de chargement : ${error.message}` })
    } else {
      setBoutiques(data ?? [])
    }
    setLoading(false)
  }

  async function handleCreate(e) {
    e.preventDefault()
    if (!nom.trim()) return

    setSaving(true)
    setMessage(null)

    const { error } = await supabase.from('boutiques').insert({
      nom: nom.trim(),
      adresse: adresse.trim() || null,
    })

    setSaving(false)

    if (error) {
      setMessage({ type: 'error', text: `Impossible de créer la boutique : ${error.message}` })
      return
    }

    setNom('')
    setAdresse('')
    setMessage({ type: 'success', text: 'Boutique créée.' })
    load()
  }

  async function handleDelete(boutique) {
    const confirmed = window.confirm(
      `Supprimer la boutique "${boutique.nom}" ? Cette action est irréversible et échouera si des comptes ou rapports y sont encore rattachés.`
    )
    if (!confirmed) return

    const { error } = await supabase.from('boutiques').delete().eq('id', boutique.id)
    if (error) {
      setMessage({ type: 'error', text: `Suppression impossible : ${error.message}` })
    } else {
      load()
    }
  }

  return (
    <Layout>
      <h1 className="text-xl font-semibold mb-6">Boutiques</h1>

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
        {/* Formulaire de création */}
        <div className="card p-5 h-fit">
          <h2 className="font-semibold mb-4">Nouvelle boutique</h2>
          <form onSubmit={handleCreate} className="space-y-3">
            <div>
              <label className="block text-sm text-gas-muted mb-1">Nom</label>
              <input
                className="input-field"
                value={nom}
                onChange={(e) => setNom(e.target.value)}
                placeholder="Boutique Cocody"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-gas-muted mb-1">Adresse (optionnel)</label>
              <input
                className="input-field"
                value={adresse}
                onChange={(e) => setAdresse(e.target.value)}
                placeholder="Rue des Jardins, Abidjan"
              />
            </div>
            <button type="submit" disabled={saving} className="btn-primary w-full disabled:opacity-50">
              {saving ? 'Création…' : 'Créer la boutique'}
            </button>
          </form>
        </div>

        {/* Liste des boutiques */}
        <div className="lg:col-span-2 card overflow-x-auto h-fit">
          <table className="w-full text-sm">
            <thead className="bg-gas-bg text-gas-muted text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Nom</th>
                <th className="px-4 py-3 font-medium">Adresse</th>
                <th className="px-4 py-3 font-medium">Comptes rattachés</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td className="px-4 py-4 text-gas-muted" colSpan={4}>Chargement…</td></tr>
              )}
              {!loading && boutiques.length === 0 && (
                <tr><td className="px-4 py-4 text-gas-muted" colSpan={4}>Aucune boutique pour l'instant.</td></tr>
              )}
              {boutiques.map((b) => (
                <tr key={b.id} className="border-t border-gas-line">
                  <td className="px-4 py-2 font-medium">
                    <Link to={`/boutiques/${b.id}`} className="hover:text-flame-600 hover:underline">
                      {b.nom}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-gas-muted">{b.adresse || '—'}</td>
                  <td className="px-4 py-2 tabular">{b.profiles?.[0]?.count ?? 0}</td>
                  <td className="px-4 py-2 text-right">
                    <button
                      onClick={() => handleDelete(b)}
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

      <p className="text-xs text-gas-muted mt-4">
        L'assignation d'un patron (boss) à une ou plusieurs boutiques se fait depuis la page
        <strong> Utilisateurs</strong> (prochaine étape).
      </p>
    </Layout>
  )
}
