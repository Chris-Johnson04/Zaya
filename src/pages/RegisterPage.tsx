import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { errorMessage } from '@/lib/errors'
import { useAuth } from '@/features/auth/AuthProvider'
import { ConsentChecklist } from '@/features/legal/ConsentChecklist'
import { documentsRequiredForEveryone, fetchCurrentLegalDocuments } from '@/features/legal/api'
import { Alert, Button, Field, SelectField } from '@/components/ui'
import { ACCOUNT_TYPE_LABELS, type AccountType } from '@/types/database'
import type { CurrentLegalDocument } from '@/types/legal'

const accountTypeOptions = (Object.keys(ACCOUNT_TYPE_LABELS) as AccountType[]).map((value) => ({
  value,
  label: ACCOUNT_TYPE_LABELS[value],
}))

export function RegisterPage() {
  const { user, loading } = useAuth()

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [accountType, setAccountType] = useState<AccountType>('individual')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | undefined>()
  const [needsConfirmation, setNeedsConfirmation] = useState(false)

  const [documents, setDocuments] = useState<CurrentLegalDocument[] | null>(null)
  const [documentsError, setDocumentsError] = useState<string | null>(null)
  const [accepted, setAccepted] = useState<Set<string>>(new Set())
  const [consentError, setConsentError] = useState<string | undefined>()

  useEffect(() => {
    let cancelled = false
    fetchCurrentLegalDocuments()
      .then((docs) => {
        if (!cancelled) setDocuments(docs)
      })
      .catch((e) => {
        if (!cancelled) setDocumentsError(errorMessage(e))
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Documents à accepter par tout le monde : Termes et Confidentialité.
  const required = useMemo(
    () => (documents ? documentsRequiredForEveryone(documents) : []),
    [documents],
  )

  if (!loading && user) {
    return <Navigate to="/compte" replace />
  }

  function toggleConsent(versionId: string, value: boolean) {
    setConsentError(undefined)
    setAccepted((previous) => {
      const next = new Set(previous)
      if (value) next.add(versionId)
      else next.delete(versionId)
      return next
    })
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setPasswordError(undefined)
    setConsentError(undefined)

    if (password.length < 8) {
      setPasswordError('Le mot de passe doit contenir au moins 8 caractères.')
      return
    }
    if (required.some((d) => !accepted.has(d.versionId))) {
      setConsentError('Vous devez accepter ces documents pour créer un compte.')
      return
    }

    setSubmitting(true)

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        // Lues par le trigger handle_new_user() : profil + preuve de consentement.
        data: {
          full_name: fullName.trim(),
          account_type: accountType,
          accepted_version_ids: required.map((d) => d.versionId),
        },
      },
    })

    if (signUpError) {
      setError(errorMessage(signUpError))
      setSubmitting(false)
      return
    }

    // Avec la confirmation par e-mail activée, une adresse déjà utilisée
    // renvoie un utilisateur sans identité plutôt qu'une erreur.
    if (data.user && data.user.identities?.length === 0) {
      setError('Un compte existe déjà avec cet e-mail.')
      setSubmitting(false)
      return
    }

    if (!data.session) {
      setNeedsConfirmation(true)
      setSubmitting(false)
    }
    // Avec une session, AuthProvider la détecte et la redirection ci-dessus s'applique.
  }

  if (needsConfirmation) {
    return (
      <div className="mx-auto max-w-md px-4 py-12">
        <h1 className="text-3xl font-extrabold">Vérifiez votre e-mail</h1>
        <div className="mt-6">
          <Alert tone="success">
            Nous avons envoyé un message de confirmation à <strong>{email.trim()}</strong>. Ouvrez-le
            et cliquez sur le lien pour activer votre compte, puis connectez-vous.
          </Alert>
        </div>
        <Link to="/connexion" className="mt-6 inline-block font-semibold text-river underline">
          Aller à la connexion
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="text-3xl font-extrabold">Créer un compte</h1>
      <p className="mt-2 text-muted">
        Un seul compte pour acheter, et vendre ensuite si vous le souhaitez.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-4" noValidate>
        {error && <Alert tone="error">{error}</Alert>}

        <Field
          label="Nom complet"
          name="full_name"
          autoComplete="name"
          required
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
        />

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

        <SelectField
          label="Vous êtes"
          name="account_type"
          value={accountType}
          onChange={(e) => setAccountType(e.target.value as AccountType)}
          options={accountTypeOptions}
        />

        <Field
          label="Mot de passe"
          type="password"
          name="password"
          autoComplete="new-password"
          required
          hint="Au moins 8 caractères."
          error={passwordError}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {documentsError ? (
          <Alert tone="error">
            Les documents à accepter n’ont pas pu être chargés. {documentsError} Rechargez la page
            pour réessayer.
          </Alert>
        ) : !documents ? (
          <p role="status" className="text-sm text-muted">
            Chargement des documents…
          </p>
        ) : (
          <ConsentChecklist
            documents={required}
            accepted={accepted}
            onToggle={toggleConsent}
            error={consentError}
          />
        )}

        <Button
          type="submit"
          loading={submitting}
          disabled={!documents || Boolean(documentsError)}
          className="w-full"
        >
          Créer mon compte
        </Button>
      </form>

      <p className="mt-6 text-sm text-muted">
        Déjà inscrit ?{' '}
        <Link to="/connexion" className="font-semibold text-river underline">
          Se connecter
        </Link>
      </p>
    </div>
  )
}