import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { errorMessage } from '@/lib/errors'
import { useAuth } from '@/features/auth/AuthProvider'
import { Alert, Button, Field } from '@/components/ui'

/** N'accepte que des chemins internes, pour éviter une redirection vers un site externe. */
function safeRedirect(value: unknown): string {
  if (typeof value === 'string' && value.startsWith('/') && !value.startsWith('//')) {
    return value
  }
  return '/compte'
}

export function LoginPage() {
  const { user, loading } = useAuth()
  const location = useLocation()
  const redirectTo = safeRedirect((location.state as { from?: string } | null)?.from)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Dès que la session existe (déjà connecté, ou connexion réussie), on quitte la page.
  if (!loading && user) {
    return <Navigate to={redirectTo} replace />
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })

    if (signInError) {
      setError(errorMessage(signInError))
      setSubmitting(false)
    }
    // En cas de succès, AuthProvider reçoit la session et la redirection ci-dessus s'applique.
  }

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="text-3xl font-extrabold">Se connecter</h1>
      <p className="mt-2 text-muted">Accédez à votre compte ZAYA.</p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-4" noValidate>
        {error && <Alert tone="error">{error}</Alert>}

        <Field
          label="Adresse e-mail"
          type="email"
          name="email"
          autoComplete="email"
          inputMode="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <Field
          label="Mot de passe"
          type="password"
          name="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <Button type="submit" loading={submitting} className="w-full">
          Se connecter
        </Button>
      </form>

      <p className="mt-6 text-sm text-muted">
        Pas encore de compte ?{' '}
        <Link to="/inscription" className="font-semibold text-river underline">
          Créer un compte
        </Link>
      </p>
    </div>
  )
}