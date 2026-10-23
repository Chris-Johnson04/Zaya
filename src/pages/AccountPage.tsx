import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '@/lib/supabase'
import { errorMessage } from '@/lib/errors'
import { useAuth } from '@/features/auth/AuthProvider'
import { ConsentChecklist } from '@/features/legal/ConsentChecklist'
import { documentsRequiredForRole, fetchCurrentLegalDocuments } from '@/features/legal/api'
import { Alert, Button, Field } from '@/components/ui'
import {
  ACCOUNT_TYPE_LABELS,
  ROLE_LABELS,
  SELF_ASSIGNABLE_ROLES,
  type RoleCode,
  type RoleStatus,
} from '@/types/database'
import type { CurrentLegalDocument } from '@/types/legal'

const ROLE_STATUS_LABELS: Record<RoleStatus, string> = {
  active: 'Actif',
  pending: 'En attente de vérification',
  suspended: 'Suspendu',
}

const ROLE_DESCRIPTIONS: Partial<Record<RoleCode, string>> = {
  vendor: 'Publier et vendre des produits ou des services.',
  business: 'Représenter une entreprise sur ZAYA.',
  creator: 'Présenter des produits et gagner une commission sur les ventes générées.',
  driver: 'Livrer des commandes. Une vérification de votre compte est nécessaire.',
}

type Message = { tone: 'success' | 'error'; text: string }

export function AccountPage() {
  const { user, profile, roles, refresh, signOut } = useAuth()

  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [city, setCity] = useState('')
  const [saving, setSaving] = useState(false)
  const [profileMessage, setProfileMessage] = useState<Message | null>(null)

  const [documents, setDocuments] = useState<CurrentLegalDocument[]>([])
  const [activating, setActivating] = useState<RoleCode | null>(null)
  const [roleMessage, setRoleMessage] = useState<Message | null>(null)

  // Rôle en cours d'activation et documents que l'utilisateur doit encore accepter pour lui.
  const [consentRole, setConsentRole] = useState<RoleCode | null>(null)
  const [consentDocs, setConsentDocs] = useState<CurrentLegalDocument[]>([])
  const [accepted, setAccepted] = useState<Set<string>>(new Set())
  const [consentError, setConsentError] = useState<string | undefined>()

  useEffect(() => {
    if (!profile) return
    setFullName(profile.full_name ?? '')
    setPhone(profile.phone ?? '')
    setCity(profile.city ?? '')
  }, [profile])

  useEffect(() => {
    let cancelled = false
    fetchCurrentLegalDocuments()
      .then((docs) => {
        if (!cancelled) setDocuments(docs)
      })
      .catch(() => {
        // Sans documents, le serveur refusera l'activation et le message l'expliquera.
      })
    return () => {
      cancelled = true
    }
  }, [])

  const heldRoles = new Set(roles.map((r) => r.role_code))
  const availableRoles = SELF_ASSIGNABLE_ROLES.filter((r) => !heldRoles.has(r))

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!user) return
    setSaving(true)
    setProfileMessage(null)

    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: fullName.trim() || null,
        phone: phone.trim() || null,
        city: city.trim() || null,
      })
      .eq('id', user.id)

    if (error) {
      setProfileMessage({ tone: 'error', text: errorMessage(error) })
    } else {
      await refresh()
      setProfileMessage({ tone: 'success', text: 'Profil enregistré.' })
    }
    setSaving(false)
  }

  async function activate(role: RoleCode, versionIds: string[]) {
    setActivating(role)
    setRoleMessage(null)

    const { data, error } = await supabase.rpc('activate_self_role', {
      p_role: role,
      p_version_ids: versionIds,
    })

    if (error) {
      const text = /legal_consent_required/i.test(error.message ?? '')
        ? 'Vous devez accepter les documents de ce rôle. Rechargez la page puis réessayez.'
        : errorMessage(error)
      setRoleMessage({ tone: 'error', text })
    } else {
      setConsentRole(null)
      setConsentDocs([])
      await refresh()
      setRoleMessage({
        tone: 'success',
        text:
          data === 'pending'
            ? 'Demande envoyée. Un administrateur doit vérifier votre compte avant l’activation.'
            : `Rôle « ${ROLE_LABELS[role]} » activé.`,
      })
    }
    setActivating(null)
  }

  /** Premier clic : affiche les documents du rôle non encore acceptés, ou active directement. */
  async function startActivation(role: RoleCode) {
    if (!user) return
    setRoleMessage(null)
    setConsentError(undefined)
    setActivating(role)

    const required = documentsRequiredForRole(documents, role)
    let missing = required

    if (required.length > 0) {
      const { data } = await supabase
        .from('user_consents')
        .select('version_id')
        .eq('user_id', user.id)
      const done = new Set((data ?? []).map((row: { version_id: string }) => row.version_id))
      missing = required.filter((d) => !done.has(d.versionId))
    }

    if (missing.length === 0) {
      await activate(role, [])
      return
    }

    setConsentRole(role)
    setConsentDocs(missing)
    setAccepted(new Set())
    setActivating(null)
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

  async function confirmActivation() {
    if (!consentRole) return
    if (consentDocs.some((d) => !accepted.has(d.versionId))) {
      setConsentError('Vous devez accepter ces documents pour activer ce rôle.')
      return
    }
    await activate(
      consentRole,
      consentDocs.map((d) => d.versionId),
    )
  }

  function cancelActivation() {
    setConsentRole(null)
    setConsentDocs([])
    setConsentError(undefined)
  }

  if (!profile) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <Alert tone="error">
          Votre profil n’a pas pu être chargé. Rechargez la page ou reconnectez-vous.
        </Alert>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl space-y-10 px-4 py-12">
      <header>
        <h1 className="text-3xl font-extrabold">Mon compte</h1>
        <p className="mt-2 text-muted">
          {user?.email} · {ACCOUNT_TYPE_LABELS[profile.account_type]}
        </p>
      </header>

      {profile.status !== 'active' && (
        <Alert tone="error">
          Votre compte est actuellement {profile.status === 'suspended' ? 'suspendu' : 'fermé'}.
          Certaines actions sont indisponibles.
        </Alert>
      )}

      <section aria-labelledby="profil-titre">
        <h2 id="profil-titre" className="text-xl font-bold">
          Mes informations
        </h2>
        <form onSubmit={handleSave} className="mt-4 space-y-4">
          {profileMessage && <Alert tone={profileMessage.tone}>{profileMessage.text}</Alert>}

          <Field
            label="Nom complet"
            name="full_name"
            autoComplete="name"
            maxLength={120}
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
          <Field
            label="Téléphone"
            type="tel"
            name="phone"
            autoComplete="tel"
            inputMode="tel"
            maxLength={30}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <Field
            label="Ville"
            name="city"
            autoComplete="address-level2"
            maxLength={80}
            value={city}
            onChange={(e) => setCity(e.target.value)}
          />

          <Button type="submit" loading={saving}>
            Enregistrer
          </Button>
        </form>
      </section>

      <section aria-labelledby="roles-titre">
        <h2 id="roles-titre" className="text-xl font-bold">
          Mes rôles
        </h2>
        <ul className="mt-4 divide-y divide-line rounded-lg border border-line bg-white">
          {roles.map((r) => (
            <li key={r.role_code} className="flex items-center justify-between gap-4 px-4 py-3">
              <span className="font-semibold">{ROLE_LABELS[r.role_code]}</span>
              <span
                className={`text-sm ${r.status === 'active' ? 'text-river-dark' : 'text-muted'}`}
              >
                {ROLE_STATUS_LABELS[r.status]}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {availableRoles.length > 0 && (
        <section aria-labelledby="activer-titre">
          <h2 id="activer-titre" className="text-xl font-bold">
            Ajouter un rôle
          </h2>
          <p className="mt-1 text-muted">Vous pouvez en activer plusieurs sur le même compte.</p>

          {roleMessage && (
            <div className="mt-4">
              <Alert tone={roleMessage.tone}>{roleMessage.text}</Alert>
            </div>
          )}

          <ul className="mt-4 space-y-3">
            {availableRoles.map((role) => (
              <li key={role} className="rounded-lg border border-line bg-white p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-semibold">{ROLE_LABELS[role]}</p>
                    <p className="text-sm text-muted">{ROLE_DESCRIPTIONS[role]}</p>
                  </div>
                  {consentRole !== role && (
                    <Button
                      variant="secondary"
                      loading={activating === role}
                      disabled={activating !== null || profile.status !== 'active'}
                      onClick={() => startActivation(role)}
                    >
                      {role === 'driver' ? 'Faire une demande' : 'Activer'}
                    </Button>
                  )}
                </div>

                {consentRole === role && (
                  <div className="mt-4 space-y-4 border-t border-line pt-4">
                    <p className="text-sm font-semibold">
                      Avant d’activer ce rôle, lisez et acceptez :
                    </p>
                    <ConsentChecklist
                      documents={consentDocs}
                      accepted={accepted}
                      onToggle={toggleConsent}
                      error={consentError}
                    />
                    <div className="flex flex-wrap gap-3">
                      <Button loading={activating === role} onClick={confirmActivation}>
                        {role === 'driver' ? 'Accepter et envoyer la demande' : 'Accepter et activer'}
                      </Button>
                      <Button variant="ghost" disabled={activating !== null} onClick={cancelActivation}>
                        Annuler
                      </Button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <Button variant="ghost" onClick={signOut}>
          Se déconnecter
        </Button>
      </section>
    </div>
  )
}