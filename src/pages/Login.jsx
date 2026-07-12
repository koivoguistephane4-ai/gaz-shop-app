import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    const { error } = await signIn(email, password)
    setSubmitting(false)
    if (error) {
      setError("Identifiants incorrects. Vérifiez l'e-mail et le mot de passe.")
      return
    }
    navigate('/', { replace: true })
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-navy-900 px-4">
      <div className="card w-full max-w-sm p-8">
        <div className="text-flame-500 font-semibold tracking-wide text-sm mb-1">GAZ • GESTION</div>
        <h1 className="text-xl font-semibold text-gas-text mb-6">Connexion</h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gas-muted mb-1">E-mail</label>
            <input
              type="email"
              required
              className="input-field"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="vous@boutique.ci"
            />
          </div>
          <div>
            <label className="block text-sm text-gas-muted mb-1">Mot de passe</label>
            <input
              type="password"
              required
              className="input-field"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          {error && <p className="text-sm text-gas-danger">{error}</p>}

          <button type="submit" disabled={submitting} className="btn-primary w-full">
            {submitting ? 'Connexion…' : 'Se connecter'}
          </button>
        </form>

        <p className="text-xs text-gas-muted mt-6">
          Binvenue sur votre espace de travail. Union, Discipline et Travail. Pour toute assistance, contactez l'administrateur.
        </p>
      </div>
    </div>
  )
}
