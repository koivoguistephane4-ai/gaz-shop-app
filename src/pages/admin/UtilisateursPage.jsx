import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import Layout from '../../components/Layout'

const ROLE_LABEL = { admin: 'Administrateur', boss: 'Patron', gerant: 'Gérant', sous_depot: 'Sous-dépôt' }

// Le SDK Supabase ne remonte pas automatiquement le corps JSON {"error": "..."}
// d'une Edge Function en erreur — on va le chercher manuellement.
async function extractFunctionError(error) {
  try {
    const body = await error.context.json()
    return body?.error || error.message
  } catch (_) {
    return error.message
  }
}

export default function UtilisateursPage() {
  const [profiles, setProfiles] = useState([])
  const [boutiques, setBoutiques] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)

  const [form, setForm] = useState({
    email: '',
    password: '',
    nom: '',
    telephone: '',
    role: 'gerant',
    boutique_id: '',
    boutique_ids: [],
  })

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    const [{ data: profilesData }, { data: boutiquesData }] = await Promise.all([
      supabase.from('profiles').select('*, boutiques!boutique_id(nom)').order('created_at', { ascending: false }),
      supabase.from('boutiques').select('*').order('nom'),
    ])
    setProfiles(profilesData ?? [])
    setBoutiques(boutiquesData ?? [])
    setLoading(false)
  }

  function updateForm(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function toggleBoutiqueId(id) {
    setForm((prev) => ({
      ...prev,
      boutique_ids: prev.boutique_ids.includes(id)
        ? prev.boutique_ids.filter((x) => x !== id)
        : [...prev.boutique_ids, id],
    }))
  }

  async function handleCreate(e) {
    e.preventDefault()
    setSaving(true)
    setMessage(null)

    const payload = {
      email: form.email.trim(),
      password: form.password,
      nom: form.nom.trim(),
      telephone: form.telephone.trim() || null,
      role: form.role,
      boutique_id: (form.role === 'gerant' || form.role === 'sous_depot') ? form.boutique_id : null,
      boutique_ids: form.role === 'boss' ? form.boutique_ids : [],
    }

    const { data, error } = await supabase.functions.invoke('create-user', { body: payload })

    setSaving(false)

    // supabase-js ne remonte pas toujours le message d'erreur du corps JSON automatiquement
    if (error) {
      setMessage({ type: 'error', text: `Erreur : ${await extractFunctionError(error)}` })
      return
    }
    if (data?.error) {
      setMessage({ type: 'error', text: data.error })
      return
    }

    setMessage({ type: 'success', text: `Compte créé : ${payload.email}` })
    setForm({ email: '', password: '', nom: '', telephone: '', role: 'gerant', boutique_id: '', boutique_ids: [] })
    load()
  }

  async function handleDelete(userProfile) {
    const confirmed = window.confirm(
      `Supprimer définitivement le compte de "${userProfile.nom}" (${userProfile.email}) ? Cette action est irréversible.`
    )
    if (!confirmed) return

    setMessage(null)
    const { data, error } = await supabase.functions.invoke('delete-user', {
      body: { user_id: userProfile.id },
    })

    if (error) {
      setMessage({ type: 'error', text: `Erreur : ${await extractFunctionError(error)}` })
      return
    }
    if (data?.error) {
      setMessage({ type: 'error', text: data.error })
      return
    }

    setMessage(
      data?.deactivated
        ? { type: 'success', text: `Compte "${userProfile.nom}" désactivé (historique conservé, connexion bloquée).` }
        : { type: 'success', text: `Compte "${userProfile.nom}" supprimé définitivement.` }
    )
    load()
  }

  async function handleReactivate(userProfile) {
    setMessage(null)
    const { data, error } = await supabase.functions.invoke('reactivate-user', {
      body: { user_id: userProfile.id },
    })

    if (error) {
      setMessage({ type: 'error', text: `Erreur : ${await extractFunctionError(error)}` })
      return
    }
    if (data?.error) {
      setMessage({ type: 'error', text: data.error })
      return
    }

    setMessage({ type: 'success', text: `Compte "${userProfile.nom}" réactivé.` })
    load()
  }

  return (
    <Layout>
      <h1 className="text-xl font-semibold mb-6">Utilisateurs</h1>

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
          <h2 className="font-semibold mb-4">Nouveau compte</h2>
          <form onSubmit={handleCreate} className="space-y-3">
            <div>
              <label className="block text-sm text-gas-muted mb-1">Nom complet</label>
              <input
                className="input-field"
                value={form.nom}
                onChange={(e) => updateForm('nom', e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-sm text-gas-muted mb-1">E-mail</label>
              <input
                type="email"
                className="input-field"
                value={form.email}
                onChange={(e) => updateForm('email', e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-sm text-gas-muted mb-1">Mot de passe (min. 8 caractères)</label>
              <input
                type="password"
                className="input-field"
                value={form.password}
                onChange={(e) => updateForm('password', e.target.value)}
                minLength={8}
                required
              />
            </div>
            <div>
              <label className="block text-sm text-gas-muted mb-1">Rôle</label>
              <select
                className="input-field"
                value={form.role}
                onChange={(e) => updateForm('role', e.target.value)}
              >
                <option value="gerant">Gérant</option>
                <option value="sous_depot">Sous-dépôt</option>
                <option value="boss">Patron (boss)</option>
                <option value="admin">Administrateur</option>
              </select>
            </div>

            {(form.role === 'gerant' || form.role === 'sous_depot') && (
              <div>
                <label className="block text-sm text-gas-muted mb-1">
                  {form.role === 'sous_depot' ? 'Boutique fournisseur' : 'Boutique'}
                </label>
                <select
                  className="input-field"
                  value={form.boutique_id}
                  onChange={(e) => updateForm('boutique_id', e.target.value)}
                  required
                >
                  <option value="">— Choisir —</option>
                  {boutiques.map((b) => (
                    <option key={b.id} value={b.id}>{b.nom}</option>
                  ))}
                </select>
              </div>
            )}

            {form.role === 'sous_depot' && (
              <div>
                <label className="block text-sm text-gas-muted mb-1">Téléphone (optionnel)</label>
                <input
                  type="text"
                  className="input-field"
                  value={form.telephone}
                  onChange={(e) => updateForm('telephone', e.target.value)}
                />
              </div>
            )}

            {form.role === 'boss' && (
              <div>
                <label className="block text-sm text-gas-muted mb-1">Boutiques supervisées</label>
                <div className="space-y-1 max-h-40 overflow-y-auto border border-gas-line rounded-card p-2">
                  {boutiques.length === 0 && <p className="text-xs text-gas-muted">Aucune boutique créée.</p>}
                  {boutiques.map((b) => (
                    <label key={b.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={form.boutique_ids.includes(b.id)}
                        onChange={() => toggleBoutiqueId(b.id)}
                      />
                      {b.nom}
                    </label>
                  ))}
                </div>
              </div>
            )}

            <button type="submit" disabled={saving} className="btn-primary w-full disabled:opacity-50">
              {saving ? 'Création…' : 'Créer le compte'}
            </button>
          </form>
        </div>

        {/* Liste des comptes */}
        <div className="lg:col-span-2 card overflow-x-auto h-fit">
          <table className="w-full text-sm">
            <thead className="bg-gas-bg text-gas-muted text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Nom</th>
                <th className="px-4 py-3 font-medium">E-mail</th>
                <th className="px-4 py-3 font-medium">Rôle</th>
                <th className="px-4 py-3 font-medium">Boutique</th>
                <th className="px-4 py-3 font-medium">Statut</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td className="px-4 py-4 text-gas-muted" colSpan={6}>Chargement…</td></tr>
              )}
              {!loading && profiles.length === 0 && (
                <tr><td className="px-4 py-4 text-gas-muted" colSpan={6}>Aucun compte pour l'instant.</td></tr>
              )}
              {profiles.map((p) => (
                <tr key={p.id} className="border-t border-gas-line">
                  <td className="px-4 py-2 font-medium">{p.nom}</td>
                  <td className="px-4 py-2 text-gas-muted">{p.email}</td>
                  <td className="px-4 py-2">{ROLE_LABEL[p.role] ?? p.role}</td>
                  <td className="px-4 py-2 text-gas-muted">{p.boutiques?.nom || '—'}</td>
                  <td className="px-4 py-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      p.is_active ? 'bg-gas-success/10 text-gas-success' : 'bg-gas-line text-gas-muted'
                    }`}>
                      {p.is_active ? 'Actif' : 'Désactivé'}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right space-x-3">
                    {p.is_active ? (
                      <button
                        onClick={() => handleDelete(p)}
                        className="text-gas-danger text-xs font-medium hover:underline"
                      >
                        Supprimer
                      </button>
                    ) : (
                      <button
                        onClick={() => handleReactivate(p)}
                        className="text-gas-success text-xs font-medium hover:underline"
                      >
                        Réactiver
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  )
}
