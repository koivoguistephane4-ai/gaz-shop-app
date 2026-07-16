import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'

/**
 * Affiche le détail des lignes d'une commande, permet de :
 * - modifier la quantité commandée d'une ligne (si pas encore livrée)
 * - cocher les lignes disponibles en stock pour les livrer (même partiellement, ligne par ligne)
 */
export default function CommandeLignesEditor({ commande, onUpdated }) {
  const [editedQty, setEditedQty] = useState({}) // ligneId -> nouvelle quantité en cours d'édition
  const [checked, setChecked] = useState({})     // ligneId -> coché pour livraison
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const lignes = commande.commande_lignes ?? []

  function toggleCheck(ligneId) {
    setChecked((prev) => ({ ...prev, [ligneId]: !prev[ligneId] }))
  }

  async function saveQuantiteEdit(ligne) {
    const nouvelleQte = Number(editedQty[ligne.id])
    if (!nouvelleQte || nouvelleQte < ligne.quantite_livree) {
      setError(`La quantité ne peut pas être inférieure à ce qui est déjà livré (${ligne.quantite_livree}).`)
      return
    }
    const { error: err } = await supabase.from('commande_lignes').update({ quantite: nouvelleQte }).eq('id', ligne.id)
    if (err) {
      setError(err.message)
    } else {
      setEditedQty((prev) => { const p = { ...prev }; delete p[ligne.id]; return p })
      onUpdated()
    }
  }

  async function handleLivrerCoches() {
    setSaving(true)
    setError(null)

    const aLivrer = lignes.filter((l) => checked[l.id] && l.quantite_livree < l.quantite)

    for (const l of aLivrer) {
      const { error: err } = await supabase
        .from('commande_lignes')
        .update({ quantite_livree: l.quantite })
        .eq('id', l.id)
      if (err) {
        setError(`Erreur sur ${l.bottle_brands?.nom} ${l.taille} : ${err.message}`)
        setSaving(false)
        return
      }
    }

    setSaving(false)
    setChecked({})
    onUpdated()
  }

  return (
    <div className="bg-gas-bg rounded-card p-4 mt-2">
      {error && <p className="text-xs text-gas-danger mb-2">{error}</p>}

      <table className="w-full text-sm">
        <thead className="text-gas-muted text-left">
          <tr>
            <th className="py-1 pr-2 font-medium w-8"></th>
            <th className="py-1 pr-2 font-medium">Marque</th>
            <th className="py-1 pr-2 font-medium">Taille</th>
            <th className="py-1 pr-2 font-medium">Commandé</th>
            <th className="py-1 pr-2 font-medium">Déjà livré</th>
            <th className="py-1 pr-2 font-medium"></th>
          </tr>
        </thead>
        <tbody>
          {lignes.map((l) => {
            const complet = l.quantite_livree >= l.quantite
            return (
              <tr key={l.id} className="border-t border-gas-line">
                <td className="py-2 pr-2">
                  {!complet && (
                    <input
                      type="checkbox"
                      checked={!!checked[l.id]}
                      onChange={() => toggleCheck(l.id)}
                    />
                  )}
                </td>
                <td className="py-2 pr-2 font-medium">{l.bottle_brands?.nom}</td>
                <td className="py-2 pr-2 text-gas-muted">{l.taille}</td>
                <td className="py-2 pr-2">
                  {complet ? (
                    <span className="tabular">{l.quantite}</span>
                  ) : (
                    <input
                      type="number"
                      min={l.quantite_livree || 1}
                      className="input-field w-20 py-1"
                      value={editedQty[l.id] ?? l.quantite}
                      onChange={(e) => setEditedQty((prev) => ({ ...prev, [l.id]: e.target.value }))}
                      onBlur={() => {
                        if (editedQty[l.id] !== undefined && Number(editedQty[l.id]) !== l.quantite) {
                          saveQuantiteEdit(l)
                        }
                      }}
                    />
                  )}
                </td>
                <td className="py-2 pr-2 tabular">
                  {l.quantite_livree} / {l.quantite}
                  {complet && <span className="ml-1 text-gas-success">✓</span>}
                </td>
                <td className="py-2 pr-2"></td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <button
        onClick={handleLivrerCoches}
        disabled={saving || Object.values(checked).every((v) => !v)}
        className="btn-primary mt-3 text-sm py-1.5 disabled:opacity-50"
      >
        {saving ? 'Livraison…' : 'Livrer les lignes cochées'}
      </button>
      <p className="text-xs text-gas-muted mt-2">
        Modifiez la quantité si vous n'avez pas tout le stock demandé, puis cochez et livrez ce qui est disponible.
        Le reste restera « en attente » jusqu'à un prochain réapprovisionnement.
      </p>
    </div>
  )
}
