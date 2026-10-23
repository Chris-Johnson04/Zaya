import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Alert } from '@/components/ui'
import { errorMessage } from '@/lib/errors'
import { fetchCurrentLegalDocuments } from '@/features/legal/api'
import type { CurrentLegalDocument } from '@/types/legal'

type Block = { type: 'heading' | 'paragraph'; text: string }

/**
 * Convention des textes : une ligne "## Titre" est un titre,
 * les autres lignes forment des paragraphes séparés par une ligne vide.
 */
function parseContent(content: string): Block[] {
  const blocks: Block[] = []
  let buffer: string[] = []

  const flush = () => {
    if (buffer.length > 0) {
      blocks.push({ type: 'paragraph', text: buffer.join(' ') })
      buffer = []
    }
  }

  for (const raw of content.split('\n')) {
    const line = raw.trim()
    if (line.startsWith('## ')) {
      flush()
      blocks.push({ type: 'heading', text: line.slice(3) })
    } else if (line === '') {
      flush()
    } else {
      buffer.push(line)
    }
  }
  flush()

  // Le premier titre répète le titre du document, déjà affiché en haut de page.
  if (blocks[0]?.type === 'heading') blocks.shift()
  return blocks
}

/** Met en évidence les passages [entre crochets] : ils restent à compléter par un juriste. */
function WithPlaceholders({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\[[^\]]+\])/g).map((part, i) =>
        part.startsWith('[') && part.endsWith(']') ? (
          <mark key={i} className="rounded bg-sun/30 px-1">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  )
}

function formatDate(iso: string | null): string | null {
  if (!iso) return null
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export function LegalPage() {
  const { slug } = useParams<{ slug?: string }>()
  const [documents, setDocuments] = useState<CurrentLegalDocument[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchCurrentLegalDocuments()
      .then((docs) => {
        if (!cancelled) setDocuments(docs)
      })
      .catch((e) => {
        if (!cancelled) setError(errorMessage(e))
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (error) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <Alert tone="error">{error}</Alert>
      </div>
    )
  }

  if (!documents) {
    return (
      <div role="status" className="flex min-h-[50vh] items-center justify-center text-muted">
        Chargement…
      </div>
    )
  }

  /* ---------- Liste de tous les documents ---------- */
  if (!slug) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <h1 className="text-3xl font-extrabold">Informations légales</h1>
        <p className="mt-2 text-muted">Les règles qui encadrent l’utilisation de ZAYA.</p>
        <ul className="mt-8 divide-y divide-line rounded-lg border border-line bg-white">
          {documents.map((d) => (
            <li key={d.slug}>
              <Link
                to={`/legal/${d.slug}`}
                className="flex items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-river-soft"
              >
                <span className="font-semibold">{d.title}</span>
                <span className="text-sm text-muted">Version {d.version}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    )
  }

  /* ---------- Un document ---------- */
  const doc = documents.find((d) => d.slug === slug)

  if (!doc) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-2xl font-extrabold">Document introuvable</h1>
        <Link to="/legal" className="mt-6 inline-block font-semibold text-river underline">
          Voir tous les documents
        </Link>
      </div>
    )
  }

  const blocks = parseContent(doc.content)
  const effective = formatDate(doc.effectiveAt)

  return (
    <article className="mx-auto max-w-2xl px-4 py-12">
      <Link to="/legal" className="text-sm font-semibold text-river underline">
        Tous les documents
      </Link>
      <h1 className="mt-4 text-3xl font-extrabold">{doc.title}</h1>
      <p className="mt-2 text-sm text-muted">
        Version {doc.version}
        {effective ? `, en vigueur depuis le ${effective}` : ''}
      </p>

      <div className="mt-8">
        {blocks.map((b, i) => {
          if (b.type === 'heading') {
            return (
              <h2 key={i} className="mt-8 text-xl font-bold">
                {b.text}
              </h2>
            )
          }
          if (b.text.startsWith('Texte provisoire')) {
            return (
              <div key={i} className="mt-3">
                <Alert tone="info">{b.text}</Alert>
              </div>
            )
          }
          return (
            <p key={i} className="mt-3 leading-relaxed">
              <WithPlaceholders text={b.text} />
            </p>
          )
        })}
      </div>
    </article>
  )
}