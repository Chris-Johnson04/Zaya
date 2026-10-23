import { Link } from 'react-router-dom'
import type { CurrentLegalDocument } from '@/types/legal'

const FEMININE = new Set(['privacy', 'returns', 'delivery', 'prohibited', 'antifraud', 'premium'])

/** Texte de la case : « J'accepte… » ou, pour la confidentialité, « J'ai pris connaissance de… ». */
export function consentLabel(doc: CurrentLegalDocument): string {
  const article = FEMININE.has(doc.slug) ? 'la' : 'les'
  if (doc.slug === 'privacy') return `J’ai pris connaissance de la ${doc.title}`
  return `J’accepte ${article} ${doc.title}`
}

interface ConsentChecklistProps {
  documents: CurrentLegalDocument[]
  /** Identifiants des versions actuellement cochées. */
  accepted: ReadonlySet<string>
  onToggle: (versionId: string, value: boolean) => void
  error?: string
}

export function ConsentChecklist({ documents, accepted, onToggle, error }: ConsentChecklistProps) {
  if (documents.length === 0) return null

  return (
    <fieldset className="space-y-3">
      <legend className="sr-only">Documents à accepter</legend>

      {documents.map((doc) => {
        const inputId = `consent-${doc.slug}`
        return (
          <div key={doc.versionId} className="flex items-start gap-3">
            <input
              id={inputId}
              type="checkbox"
              checked={accepted.has(doc.versionId)}
              onChange={(e) => onToggle(doc.versionId, e.target.checked)}
              aria-describedby={error ? 'consent-error' : undefined}
              className="mt-1 h-5 w-5 shrink-0 rounded border-line accent-river"
            />
            <label htmlFor={inputId} className="text-sm">
              {consentLabel(doc)}{' '}
              <Link
                to={`/legal/${doc.slug}`}
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-river underline"
              >
                Lire<span className="sr-only"> (s’ouvre dans un nouvel onglet)</span>
              </Link>
              <span className="ml-1 text-muted">· version {doc.version}</span>
            </label>
          </div>
        )
      })}

      {error && (
        <p id="consent-error" role="alert" className="text-sm text-clay">
          {error}
        </p>
      )}
    </fieldset>
  )
}