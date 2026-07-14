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

export default function MesCommandesPage() {
  const { profile } = useAuth()
  const [commandes, setCommandes] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (profile) load()
  }, [profile])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('commandes')
      .select('*, commande_lignes(*, bottle_brands(nom))')
      .order('date_commande', { ascending: false })
    setCommandes(data ?? [])
    setLoading(false)
  }

  return (
    <Layout>
      <h1 className="text-xl font-semibold mb-6">Mes commandes</h1>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gas-bg text-gas-muted text-left">
            <tr>
              <th className="px-4 py-3 font-medium">Référence</th>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Contenu</th>
              <th className="px-4 py-3 font-medium">Montant</th>
              <th className="px-4 py-3 font-medium">Statut</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td className="px-4 py-4 text-gas-muted" colSpan={5}>Chargement…</td></tr>
            )}
            {!loading && commandes.length === 0 && (
              <tr><td className="px-4 py-4 text-gas-muted" colSpan={5}>Aucune commande envoyée pour l'instant.</td></tr>
            )}
            {commandes.map((c) => (
              <tr key={c.id} className="border-t border-gas-line align-top">
                <td className="px-4 py-2 font-mono text-xs font-medium">{c.reference}</td>
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Layout>
  )
}
