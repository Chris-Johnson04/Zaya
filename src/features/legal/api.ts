import { supabase } from '@/lib/supabase'
import type { RoleCode } from '@/types/database'
import type {
  CurrentLegalDocument,
  LegalDocument,
  LegalVersion,
  PendingLegalVersion,
} from '@/types/legal'

/**
 * Tous les documents avec leur version en vigueur.
 * Fonctionne sans être connecté : nécessaire pour la page d'inscription.
 */
export async function fetchCurrentLegalDocuments(): Promise<CurrentLegalDocument[]> {
  const [versionsResult, documentsResult] = await Promise.all([
    supabase.rpc('current_legal_versions'),
    supabase.from('legal_documents').select('*').order('sort_order'),
  ])
  if (versionsResult.error) throw versionsResult.error
  if (documentsResult.error) throw documentsResult.error

  const versions = (versionsResult.data ?? []) as LegalVersion[]
  const documents = (documentsResult.data ?? []) as LegalDocument[]
  const versionByDocument = new Map(versions.map((v) => [v.document_id, v]))

  return documents.flatMap((d) => {
    const v = versionByDocument.get(d.id)
    if (!v) return []
    return [
      {
        documentId: d.id,
        versionId: v.id,
        slug: d.slug,
        title: d.title,
        version: v.version,
        content: v.content,
        effectiveAt: v.effective_at,
        requiredForRoles: d.required_for_roles,
        isRequired: d.is_required,
      },
    ]
  })
}

/** Documents que l'utilisateur connecté doit encore accepter. */
export async function fetchPendingLegalVersions(): Promise<PendingLegalVersion[]> {
  const { data, error } = await supabase.rpc('pending_legal_versions')
  if (error) throw error
  return (data ?? []) as PendingLegalVersion[]
}

/** Enregistre l'acceptation de versions en vigueur (preuve de consentement côté serveur). */
export async function acceptLegalVersions(
  versionIds: string[],
  source: 'gate' | 'role_activation' = 'gate',
): Promise<void> {
  const { error } = await supabase.rpc('accept_legal_versions', {
    p_version_ids: versionIds,
    p_source: source,
  })
  if (error) throw error
}

/** Documents obligatoires pour tout le monde (cases de l'inscription). */
export function documentsRequiredForEveryone(docs: CurrentLegalDocument[]): CurrentLegalDocument[] {
  return docs.filter((d) => d.isRequired && d.requiredForRoles.length === 0)
}

/** Documents obligatoires pour un rôle donné (cases avant l'activation d'un rôle). */
export function documentsRequiredForRole(
  docs: CurrentLegalDocument[],
  role: RoleCode,
): CurrentLegalDocument[] {
  return docs.filter((d) => d.isRequired && d.requiredForRoles.includes(role))
}