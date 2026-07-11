import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

const MOIS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']
const JOURS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']

export default function SalesCalendar({ boutiqueId }) {
  const [cursor, setCursor] = useState(() => {
    const now = new Date()
    return { year: now.getFullYear(), month: now.getMonth() } // month: 0-11
  })
  const [dayTotals, setDayTotals] = useState({}) // 'YYYY-MM-DD' -> { total, count }
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    load()
  }, [cursor, boutiqueId])

  async function load() {
    setLoading(true)
    const start = new Date(cursor.year, cursor.month, 1)
    const end = new Date(cursor.year, cursor.month + 1, 1)

    const { data } = await supabase
      .from('sale_transactions')
      .select('montant, created_at')
      .eq('boutique_id', boutiqueId)
      .gte('created_at', start.toISOString())
      .lt('created_at', end.toISOString())

    const totals = {}
    for (const s of data ?? []) {
      const key = s.created_at.slice(0, 10)
      if (!totals[key]) totals[key] = { total: 0, count: 0 }
      totals[key].total += Number(s.montant || 0)
      totals[key].count += 1
    }
    setDayTotals(totals)
    setLoading(false)
  }

  function changeMonth(delta) {
    setCursor((prev) => {
      let month = prev.month + delta
      let year = prev.year
      if (month < 0) { month = 11; year -= 1 }
      if (month > 11) { month = 0; year += 1 }
      return { year, month }
    })
  }

  // Construit la grille du calendrier (cases vides avant le 1er du mois)
  const firstDay = new Date(cursor.year, cursor.month, 1).getDay() // 0 = dimanche
  const daysInMonth = new Date(cursor.year, cursor.month + 1, 0).getDate()
  const cells = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)]

  const todayKey = new Date().toISOString().slice(0, 10)

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => changeMonth(-1)} className="btn-secondary px-3 py-1.5 text-sm">‹</button>
        <h3 className="font-semibold">{MOIS[cursor.month]} {cursor.year}</h3>
        <button onClick={() => changeMonth(1)} className="btn-secondary px-3 py-1.5 text-sm">›</button>
      </div>

      <div className="grid grid-cols-7 gap-2 text-center text-xs text-gas-muted mb-2">
        {JOURS.map((j) => <div key={j}>{j}</div>)}
      </div>

      <div className="grid grid-cols-7 gap-2">
        {cells.map((day, idx) => {
          if (day === null) return <div key={`empty-${idx}`} />

          const key = `${cursor.year}-${String(cursor.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          const info = dayTotals[key]
          const isToday = key === todayKey

          return (
            <div
              key={key}
              className={`rounded-card p-2 text-center border ${
                isToday ? 'border-flame-500 bg-flame-100' : info ? 'border-gas-line bg-gas-bg' : 'border-transparent'
              }`}
            >
              <div className="text-xs font-medium">{day}</div>
              {info ? (
                <>
                  <div className="tabular text-xs text-gas-success font-semibold mt-1">
                    +{info.total.toLocaleString('fr-FR')}
                  </div>
                  <div className="text-[10px] text-gas-muted">{info.count} op.</div>
                </>
              ) : (
                <div className="text-[10px] text-gas-muted mt-1">—</div>
              )}
            </div>
          )
        })}
      </div>

      {loading && <p className="text-xs text-gas-muted mt-3">Chargement…</p>}
    </div>
  )
}
