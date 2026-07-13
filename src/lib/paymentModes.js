// Modes de paiement disponibles pour une vente
export const PAYMENT_MODES = [
  { key: 'especes', label: 'Espèces' },
  { key: 'wave', label: 'Wave' },
  { key: 'orange_money', label: 'Orange Money' },
  { key: 'mtn_money', label: 'MTN Money' },
  { key: 'moov_money', label: 'Moov Money' },
]

export function paymentModeLabel(key) {
  return PAYMENT_MODES.find((m) => m.key === key)?.label ?? (key === 'electronique' ? 'Électronique' : key)
}

// true si ce n'est pas un paiement en espèces (utile pour les totaux "électronique")
export function isElectronicPayment(key) {
  return key && key !== 'especes'
}
