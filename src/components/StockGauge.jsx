/**
 * Jauge circulaire type "niveau de bouteille" — élément signature du design.
 * Utilisée pour visualiser un ratio (ex: bouteilles pleines restantes / capacité).
 */
export default function StockGauge({ label, value, max, unit = '' }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0
  const radius = 34
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (pct / 100) * circumference

  const color = pct < 20 ? '#C6493F' : pct < 50 ? '#E8871E' : '#4A9B6E'

  return (
    <div className="card p-4 flex items-center gap-4">
      <svg width="84" height="84" viewBox="0 0 84 84" className="shrink-0">
        <circle cx="42" cy="42" r={radius} fill="none" stroke="#DDE3E8" strokeWidth="8" />
        <circle
          cx="42" cy="42" r={radius} fill="none"
          stroke={color} strokeWidth="8" strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={offset}
          transform="rotate(-90 42 42)"
        />
        <text x="42" y="47" textAnchor="middle" className="font-mono" fontSize="16" fontWeight="600" fill="#1B2A3A">
          {pct}%
        </text>
      </svg>
      <div>
        <div className="text-sm text-gas-muted">{label}</div>
        <div className="tabular text-lg font-semibold text-gas-text">
          {value}{unit} <span className="text-gas-muted text-sm font-normal">/ {max}{unit}</span>
        </div>
      </div>
    </div>
  )
}
