// Génère une couleur stable à partir du nom, pour que le repli (sans logo)
// soit quand même visuellement distinct d'une marque à l'autre.
function colorFromName(name) {
  const palette = ['#E8871E', '#3D5A73', '#4A9B6E', '#C6493F', '#8B5CF6', '#0EA5E9', '#D97706', '#DB2777']
  let hash = 0
  for (const char of name || '') hash = char.charCodeAt(0) + ((hash << 5) - hash)
  return palette[Math.abs(hash) % palette.length]
}

export default function BrandLogo({ nom, logoUrl, size = 32 }) {
  const px = `${size}px`

  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt={nom}
        style={{ width: px, height: px }}
        className="rounded-full object-cover border border-gas-line shrink-0"
      />
    )
  }

  const initials = (nom || '?').slice(0, 2).toUpperCase()
  return (
    <div
      style={{ width: px, height: px, backgroundColor: colorFromName(nom) }}
      className="rounded-full flex items-center justify-center text-white font-semibold shrink-0"
    >
      <span style={{ fontSize: size * 0.4 }}>{initials}</span>
    </div>
  )
}
