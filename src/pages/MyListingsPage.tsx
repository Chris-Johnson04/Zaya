import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Alert, Button } from '@/components/ui'
import { useAuth } from '@/features/auth/AuthProvider'
import {
  deleteDraftListing,
  fetchMyListings,
  imageUrl,
  setListingStatus,
} from '@/features/marketplace/api'
import { errorMessage } from '@/lib/errors'
import { formatPrice, formatRelativeDate } from '@/lib/format'
import {
  CONDITION_LABELS,
  KIND_LABELS,
  STATUS_LABELS,
  type ListingStatus,
  type ListingWithImages,
} from '@/types/marketplace'

type Notice = { tone: 'success' | 'error'; text: string }

const STATUS_STYLES: Record<ListingStatus, string> = {
  active: 'bg-river-soft text-river-dark',
  draft: 'border border-line bg-white text-muted',
  paused: 'border border-sun-dark/40 bg-sun/20 text-ink',
  sold: 'bg-ink text-white',
  removed: 'bg-clay/10 text-clay',
}

const secondaryLink =
  'inline-flex min-h-11 items-center justify-center rounded-lg border border-line bg-white px-4 py-2 text-sm font-semibold text-ink transition-colors hover:bg-river-soft'

export function MyListingsPage() {
  const { user } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const userId = user?.id

  const [listings, setListings] = useState<ListingWithImages[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!userId) return
    try {
      setListings(await fetchMyListings(userId))
      setLoadError(null)
    } catch (e) {
      setLoadError(errorMessage(e))
    }
  }, [userId])

  useEffect(() => {
    void load()
  }, [load])

  // Message envoyé par la page « Publier » ou « Modifier » : lu une fois, puis effacé de l'historique.
  useEffect(() => {
    const incoming = (location.state as { notice?: Notice } | null)?.notice
    if (incoming) {
      setNotice(incoming)
      navigate(location.pathname, { replace: true, state: null })
    }
  }, [location.state, location.pathname, navigate])

  async function run(id: string, action: () => Promise<unknown>, success: string) {
    setBusyId(id)
    setNotice(null)
    setConfirmDeleteId(null)
    try {
      await action()
      setNotice({ tone: 'success', text: success })
      await load()
    } catch (e) {
      setNotice({ tone: 'error', text: errorMessage(e) })
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-extrabold">Mes annonces</h1>
        <Link
          to="/vendre"
          className="inline-flex min-h-11 items-center rounded-lg bg-river px-4 text-sm font-semibold text-white transition-colors hover:bg-river-dark"
        >
          Publier une annonce
        </Link>
      </div>

      {notice && (
        <div className="mt-6">
          <Alert tone={notice.tone}>{notice.text}</Alert>
        </div>
      )}

      {loadError && (
        <div className="mt-6">
          <Alert tone="error">Vos annonces n’ont pas pu être chargées. {loadError}</Alert>
          <div className="mt-3">
            <Button variant="secondary" onClick={() => void load()}>
              Réessayer
            </Button>
          </div>
        </div>
      )}

      {!loadError && listings === null && (
        <p role="status" className="mt-8 text-muted">
          Chargement…
        </p>
      )}

      {listings !== null && listings.length === 0 && (
        <div className="mt-8 rounded-lg border border-line bg-white p-6">
          <p className="font-semibold">Vous n’avez pas encore d’annonce.</p>
          <p className="mt-1 text-sm text-muted">
            Publiez un produit ou un service : il apparaît ici, et vous pouvez le gérer à tout
            moment.
          </p>
        </div>
      )}

      {listings !== null && listings.length > 0 && (
        <ul className="mt-8 space-y-4">
          {listings.map((listing) => {
            const cover = listing.listing_images[0]
            const busy = busyId === listing.id
            const canPublish = listing.status === 'draft' || listing.status === 'paused'
            const canEdit = listing.status !== 'removed'

            return (
              <li
                key={listing.id}
                className="flex flex-col gap-4 rounded-lg border border-line bg-white p-4 sm:flex-row"
              >
                <div className="h-28 w-28 shrink-0 overflow-hidden rounded-lg bg-mist">
                  {cover ? (
                    <img
                      src={imageUrl(cover.storage_path)}
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center px-2 text-center text-xs text-muted">
                      Pas de photo
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="min-w-0 break-words text-lg font-bold">
                      {listing.status === 'active' ? (
                        <Link to={`/annonce/${listing.id}`} className="hover:underline">
                          {listing.title}
                        </Link>
                      ) : (
                        listing.title
                      )}
                    </h2>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLES[listing.status]}`}
                    >
                      {STATUS_LABELS[listing.status]}
                    </span>
                  </div>

                  <p className="mt-1 font-semibold text-river-dark">
                    {formatPrice(listing.price, listing.price_type)}
                  </p>
                  <p className="mt-1 text-sm text-muted">
                    {KIND_LABELS[listing.kind]}
                    {listing.condition ? `, ${CONDITION_LABELS[listing.condition]}` : ''}
                    {listing.city ? `, ${listing.city}` : ''}
                    {' · '}modifiée {formatRelativeDate(listing.updated_at)}
                  </p>

                  {listing.status === 'removed' && (
                    <div className="mt-3">
                      <Alert tone="error">
                        Cette annonce a été retirée par la modération.
                        {listing.removed_reason ? ` Motif : ${listing.removed_reason}` : ''}
                      </Alert>
                    </div>
                  )}

                  {confirmDeleteId === listing.id ? (
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      <span className="text-sm font-semibold">Supprimer ce brouillon ?</span>
                      <Button
                        variant="danger"
                        loading={busy}
                        onClick={() =>
                          void run(
                            listing.id,
                            () => deleteDraftListing(listing.id),
                            'Brouillon supprimé.',
                          )
                        }
                      >
                        Oui, supprimer
                      </Button>
                      <Button
                        variant="ghost"
                        disabled={busy}
                        onClick={() => setConfirmDeleteId(null)}
                      >
                        Annuler
                      </Button>
                    </div>
                  ) : (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {canPublish && (
                        <Button
                          loading={busy}
                          disabled={busyId !== null}
                          onClick={() =>
                            void run(
                              listing.id,
                              () => setListingStatus(listing.id, 'active'),
                              'Votre annonce est en ligne.',
                            )
                          }
                        >
                          {listing.status === 'paused' ? 'Remettre en ligne' : 'Mettre en ligne'}
                        </Button>
                      )}

                      {canEdit && (
                        <Link to={`/mes-annonces/${listing.id}/modifier`} className={secondaryLink}>
                          Modifier
                        </Link>
                      )}

                      {listing.status === 'active' && (
                        <Button
                          variant="secondary"
                          loading={busy}
                          disabled={busyId !== null}
                          onClick={() =>
                            void run(
                              listing.id,
                              () => setListingStatus(listing.id, 'paused'),
                              'Annonce mise en pause : elle n’est plus visible.',
                            )
                          }
                        >
                          Mettre en pause
                        </Button>
                      )}

                      {(listing.status === 'active' || listing.status === 'paused') && (
                        <Button
                          variant="secondary"
                          disabled={busyId !== null}
                          onClick={() =>
                            void run(
                              listing.id,
                              () => setListingStatus(listing.id, 'sold'),
                              'Annonce marquée comme vendue.',
                            )
                          }
                        >
                          Marquer comme vendue
                        </Button>
                      )}

                      {listing.status === 'draft' && (
                        <Button
                          variant="ghost"
                          disabled={busyId !== null}
                          onClick={() => setConfirmDeleteId(listing.id)}
                        >
                          Supprimer
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}