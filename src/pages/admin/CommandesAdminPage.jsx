import { useEffect, useState, Fragment } from 'react'
import { supabase } from '../../lib/supabaseClient'
import Layout from '../../components/Layout'
import CommandeLignesEditor from '../../components/CommandeLignesEditor'

const STATUT_LABEL = {
  en_attente: 'En attente',
  partiellement_livree: 'Partiellement livrée',
  livree: 'Livrée',
  payee: 'Payée',
  annulee: 'Annulée',
}

const STATUT_COLOR = {
  en_attente: 'bg-flame-100 text-flame-600',
  partiellement_livree: 'bg-amber-100 text-amber-700',
  livree: 'bg-navy-800/10 text-navy-800',
  payee: 'bg-gas-success/10 text-gas-success',
  annulee: 'bg-gas-line text-gas-muted',
}

const STATUT_FILTERS = [
  { key: '', label: 'Toutes' },
  { key: 'en_attente', label: 'En attente' },
  { key: 'partiellement_livree', label: 'Partiellement livrée' },
  { key: 'livree', label: 'Livrée' },
  { key: 'payee', label: 'Payée' },
  { key: 'annulee', label: 'Annulée' },
]

export default function CommandesAdminPage() {
  const [boutiques, setBoutiques] = useState([])
  const [boutiqueFilter, setBoutiqueFilter] = useState('')
  const [statutFilter, setStatutFilter] = useState('')
  const [commandes, setCommandes] = useState([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState(null)
  const [expandedId, setExpandedId] = useState(null)

  useEffect(() => {
    supabase.from('boutiques').select('*').order('nom').then(({ data }) => setBoutiques(data ?? []))
  }, [])

  useEffect(() => {
    load()
  }, [boutiqueFilter, statutFilter])

  async function load() {
    setLoading(true)
    let query = supabase
      .from('commandes')
      .select('*, boutiques(nom), sous_depots(nom), commande_lignes(*, bottle_brands(nom))')
      .order('date_commande', { ascending: false })

    if (boutiqueFilter) query = query.eq('boutique_id', boutiqueFilter)
    if (statutFilter) query = query.eq('statut', statutFilter)

    const { data } = await query.limit(200)
    setCommandes(data ?? [])
    setLoading(false)
  }

  async function updateStatut(commande, statut) {
    const confirmed = statut === 'annulee'
      ? window.confirm(`Annuler la commande ${commande.reference} ?`)
      : true
    if (!confirmed) return

    const { error } = await supabase.from('commandes').update({ statut }).eq('id', commande.id)
    if (error) {
      setMessage({ type: 'error', text: `Erreur : ${error.message}` })
    } else {
      setMessage({ type: 'success', text: `Commande ${commande.reference} → ${STATUT_LABEL[statut]}.` })
      load()
    }
  }

  const totalEnAttente = commandes.filter((c) => c.statut === 'en_attente').length
  const totalMontantNonPaye = commandes
    .filter((c) => c.statut === 'en_attente' || c.statut === 'partiellement_livree' || c.statut === 'livree')
    .reduce((sum, c) => sum + Number(c.montant_total || 0), 0)

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

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div className="card p-4">
          <div className="text-xs text-gas-muted uppercase tracking-wide">Commandes en attente</div>
          <div className="tabular text-2xl font-semibold mt-1">{totalEnAttente}</div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-gas-muted uppercase tracking-wide">Montant non encore payé</div>
          <div className="tabular text-2xl font-semibold mt-1 text-flame-600">{totalMontantNonPaye.toLocaleString('fr-FR')} F</div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
        {boutiques.length > 1 && (
          <select className="input-field w-full sm:w-56" value={boutiqueFilter} onChange={(e) => setBoutiqueFilter(e.target.value)}>
            <option value="">Toutes les boutiques</option>
            {boutiques.map((b) => <option key={b.id} value={b.id}>{b.nom}</option>)}
          </select>
        )}
        <div className="flex gap-2 flex-wrap">
          {STATUT_FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setStatutFilter(f.key)}
              className={`text-sm px-3 py-1.5 rounded-full font-medium transition-colors ${
                statutFilter === f.key ? 'bg-navy-900 text-white' : 'bg-gas-card border border-gas-line text-gas-muted hover:text-gas-text'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gas-bg text-gas-muted text-left">
            <tr>
              <th className="px-4 py-3 font-medium">Référence</th>
              <th className="px-4 py-3 font-medium">Boutique</th>
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
              <tr><td className="px-4 py-4 text-gas-muted" colSpan={8}>Chargement…</td></tr>
            )}
            {!loading && commandes.length === 0 && (
              <tr><td className="px-4 py-4 text-gas-muted" colSpan={8}>Aucune commande trouvée.</td></tr>
            )}
            {commandes.map((c) => (
              <Fragment key={c.id}>
              <tr className="border-t border-gas-line align-top">
                <td className="px-4 py-2 font-mono text-xs font-medium">{c.reference}</td>
                <td className="px-4 py-2">{c.boutiques?.nom}</td>
                <td className="px-4 py-2">{c.sous_depots?.nom}</td>
                <td className="px-4 py-2 tabular text-gas-muted">
                  {new Date(c.date_commande).toLocaleDateString('fr-FR')}
                </td>
                <td className="px-4 py-2 text-xs text-gas-muted">
                  {(c.commande_lignes ?? []).map((l, i) => (
                    <div key={i}>
                      {l.bottle_brands?.nom} {l.taille} × {l.quantite}
                      {l.quantite_livree > 0 && (
                        <span className={l.quantite_livree >= l.quantite ? 'text-gas-success' : 'text-flame-600'}>
                          {' '}({l.quantite_livree} livré{l.quantite_livree > 1 ? 's' : ''})
                        </span>
                      )}
                    </div>
                  ))}
                  <button
                    onClick={() => setExpandedId(expandedId === c.id ? null : c.id)}
                    className="text-flame-600 hover:underline mt-1"
                  >
                    {expandedId === c.id ? 'Fermer' : 'Détail / Livrer'}
                  </button>
                </td>
                <td className="px-4 py-2 tabular">{Number(c.montant_total).toLocaleString('fr-FR')} F</td>
                <td className="px-4 py-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${STATUT_COLOR[c.statut]}`}>
                    {STATUT_LABEL[c.statut]}
                  </span>
                </td>
                <td className="px-4 py-2 text-right space-y-1">
                  {c.statut === 'livree' && (
                    <button onClick={() => updateStatut(c, 'payee')} className="block text-xs text-gas-success hover:underline">
                      Marquer payée
                    </button>
                  )}
                  {(c.statut === 'en_attente' || c.statut === 'partiellement_livree') && (
                    <button onClick={() => updateStatut(c, 'annulee')} className="block text-xs text-gas-danger hover:underline">
                      Annuler
                    </button>
                  )}
                </td>
              </tr>
              {expandedId === c.id && (
                <tr className="border-t border-gas-line">
                  <td colSpan={8} className="px-4 pb-3">
                    <CommandeLignesEditor commande={c} onUpdated={load} />
                  </td>
                </tr>
              )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </Layout>
  )
}
