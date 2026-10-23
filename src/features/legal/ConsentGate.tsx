import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { Alert, Button } from '@/components/ui'
import { errorMessage } from '@/lib/errors'
import { useAuth } from '@/features/auth/AuthProvider'
import { ConsentChecklist } from './ConsentChecklist'
import { acceptLegalVersions, fetchPendingLegalVersions } from './api'
import type { CurrentLegalDocument, PendingLegalVersion } from '@/types/legal'

function toDocument(p: PendingLegalVersion): CurrentLegalDocument {
  return {
    documentId: p.document_id,
    versionId: p.version_id,
    slug: p.slug,
    title: p.title,
    version: p.version,
    content: '',
    effectiveAt: null,
    requiredForRoles: p.required_for_roles,
    isRequired: true,
  }
}

/**
 * Bloque l'application tant que l'utilisateur connecté n'a pas accepté
 * les documents juridiques en vigueur qui le concernent.
 * Les pages /legal restent lisibles pour pouvoir consulter les textes.
 */
export function ConsentGate({ children }: { children: ReactNode }) {
  const { user, loading, signOut } = useAuth()
  const { pathname } = useLocation()
  const userId = user?.id

  const [pending, setPending] = useState<PendingLegalVersion[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [accepted, setAccepted] = useState<Set<string>>(new Set())
  const [consentError, setConsentError] = useState<string | undefined>()
  const [submitting, setSubmitting] = useState(false)

  const check = useCallback(async () => {
    if (!userId) {
      setPending(null)
      return
    }
    setLoadError(null)
    try {
      const rows = await fetchPendingLegalVersions()
      setPending(rows)
      setAccepted(new Set())
    } catch (e) {
      setLoadError(errorMessage(e))
    }
  }, [userId])

  useEffect(() => {
    setPending(null)
    void check()
  }, [check])

  const onLegalPage = pathname === '/legal' || pathname.startsWith('/legal/')
  if (loading || !user || onLegalPage) return <>{children}</>

  if (loadError) {
    return (
      <div className="mx-auto max-w-md px-4 py-12">
        <Alert tone="error">
          Impossible de vérifier vos documents à accepter. {loadError}
        </Alert>
        <div className="mt-4 flex gap-3">
          <Button onClick={() => void check()}>Réessayer</Button>
          <Button variant="ghost" onClick={signOut}>
            Se déconnecter
          </Button>
        </div>
      </div>
    )
  }

  if (pending === null) {
    return (
      <div role="status" className="flex min-h-[50vh] items-center justify-center text-muted">
        Chargement…
      </div>
    )
  }

  if (pending.length === 0) return <>{children}</>

  function toggle(versionId: string, value: boolean) {
    setConsentError(undefined)
    setAccepted((previous) => {
      const next = new Set(previous)
      if (value) next.add(versionId)
      else next.delete(versionId)
      return next
    })
  }

  async function handleAccept() {
    if (!pending) return
    if (pending.some((p) => !accepted.has(p.version_id))) {
      setConsentError('Vous devez accepter ces documents pour continuer.')
      return
    }
    setSubmitting(true)
    try {
      await acceptLegalVersions(pending.map((p) => p.version_id))
      await check()
    } catch (e) {
      setConsentError(errorMessage(e))
      await check()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="text-3xl font-extrabold">Documents à accepter</h1>
      <p className="mt-2 text-muted">
        Pour continuer à utiliser ZAYA, lisez et acceptez les documents suivants. Certains sont
        nouveaux ou ont été mis à jour.
      </p>

      <div className="mt-6">
        <ConsentChecklist
          documents={pending.map(toDocument)}
          accepted={accepted}
          onToggle={toggle}
          error={consentError}
        />
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <Button loading={submitting} onClick={handleAccept}>
          Accepter et continuer
        </Button>
        <Button variant="ghost" disabled={submitting} onClick={signOut}>
          Se déconnecter
        </Button>
      </div>
    </div>
  )
}