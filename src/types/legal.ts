import type { RoleCode } from './database'

/** Un sujet juridique (Termes, Confidentialité...). Le texte vit dans les versions. */
export interface LegalDocument {
  id: string
  slug: string
  title: string
  /** Vide : à accepter par tout le monde. Sinon : par les titulaires de ces rôles. */
  required_for_roles: RoleCode[]
  is_required: boolean
  sort_order: number
}

export type LegalVersionStatus = 'draft' | 'published'

export interface LegalVersion {
  id: string
  document_id: string
  version: string
  content: string
  status: LegalVersionStatus
  published_at: string | null
  effective_at: string | null
}

/** Ligne renvoyée par la fonction SQL pending_legal_versions(). */
export interface PendingLegalVersion {
  document_id: string
  version_id: string
  slug: string
  title: string
  version: string
  required_for_roles: RoleCode[]
}

/** Un document avec sa version en vigueur, prêt à être affiché ou accepté. */
export interface CurrentLegalDocument {
  documentId: string
  versionId: string
  slug: string
  title: string
  version: string
  content: string
  effectiveAt: string | null
  requiredForRoles: RoleCode[]
  isRequired: boolean
}