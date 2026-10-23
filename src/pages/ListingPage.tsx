import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Alert } from '@/components/ui'
import { useAuth } from '@/features/auth/AuthProvider'
import { fetchCategories, fetchListing, imageUrl } from '@/features/marketplace/api'
import { fetchSellerPublic, type SellerPublic } from '@/features/marketplace/seller'
import { errorMessage } from '@/lib/errors'
import { formatDate, formatPrice, formatRelativeDate } from '@/lib/format'
import {
  CONDITION_LABELS,
  KIND_LABELS,
  SELLER_TYPE_LABELS,
  STATUS_LABELS,
  type ListingWithImages,
} from '@/types/marketplace'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function ListingPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()

  // undefined = chargement, null = introuvable.
  const [listing, setListing] = useState<ListingWithImages | null | undefined>(undefined)
  const [seller, setSeller] = useState<SellerPublic | null>(null)
  const [categoryName, setCategoryName] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState(0)

  useEffect(() => {
    setListing(undefined)
    setSeller(null)
    setCategoryName(null)
    setError(null)
    setSelected(0)

    if (!id || !UUID.test(id)) {
      setListing(null)
      return
    }

    let cancelled = false
    fetchListing(id)
      .then(async (found) => {
        if (cancelled) return
        setListing(found)
        if (!found) return

        // Informations secondaires : si elles échouent, l'annonce s'affiche quand même.
        const [sellerResult, categoriesResult] = await Promise.allSettled([
          fetchSellerPublic(found.seller_id),
          fetchCategories(),
        ])
        if (cancelled) return
        if (sellerResult.status === 'fulfilled') setSeller(sellerResult.value)
        if (categoriesResult.status === 'fulfilled') {
          setCategoryName(
            categoriesResult.value.find((c) => c.id === found.category_id)?.name ?? null,
          )
        }
      })
      .catch((e) => {
        if (!cancelled) setError(errorMessage(e))
      })

    return () => {
      cancelled = true
    }
  }, [id])

  if (error) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <Alert tone="error">Cette annonce n’a pas pu être chargée. {error}</Alert>
        <Link to="/marketplace" className="mt-6 inline-block font-semibold text-river underline">
          Retour à la marketplace
        </Link>
      </div>
    )
  }

  if (listing === undefined) {
    return (
      <div role="status" className="flex min-h-[50vh] items-center justify-center text-muted">
        Chargement…
      </div>
    )
  }

  if (listing === null) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-2xl font-extrabold">Annonce introuvable</h1>
        <p className="mt-3 text-muted">
          Cette annonce n’existe pas, ou elle n’est plus en ligne.
        </p>
        <Link
          to="/marketplace"
          className="mt-8 inline-flex min-h-11 items-center rounded-lg bg-river px-5 font-semibold text-white transition-colors hover:bg-river-dark"
        >
          Voir les annonces
        </Link>
      </div>
    )
  }

  const images = listing.listing_images
  const current = images[Math.min(selected, Math.max(images.length - 1, 0))]
  const isOwner = user?.id === listing.seller_id

  return (
    <article className="mx-auto max-w-5xl px-4 py-10">
      <Link to="/marketplace" className="text-sm font-semibold text-river underline">
        Retour à la marketplace
      </Link>

      {listing.status !== 'active' && (
        <div className="mt-4">
          <Alert tone="info">
            Cette annonce n’est pas visible par le public (statut : {STATUS_LABELS[listing.status]}).{' '}
            {isOwner ? (
              <>
                Vous la voyez parce que c’est la vôtre.{' '}
                <Link to="/mes-annonces" className="font-semibold underline">
                  Gérer mes annonces
                </Link>
              </>
            ) : (
              'Vous la voyez grâce à vos droits d’administration.'
            )}
          </Alert>
        </div>
      )}

      <div className="mt-6 grid gap-8 lg:grid-cols-2">
        <section aria-label="Photos de l’annonce">
          <div className="aspect-[4/3] w-full overflow-hidden rounded-lg border border-line bg-mist">
            {current ? (
              <img
                src={imageUrl(current.storage_path)}
                alt={`${listing.title}, photo ${Math.min(selected, images.length - 1) + 1} sur ${images.length}`}
                decoding="async"
                className="h-full w-full object-contain"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-muted">Pas de photo</div>
            )}
          </div>

          {images.length > 1 && (
            <ul className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-4">
              {images.map((image, index) => (
                <li key={image.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(index)}
                    aria-label={`Voir la photo ${index + 1} sur ${images.length}`}
                    aria-current={index === selected ? 'true' : undefined}
                    className={`block aspect-square w-full overflow-hidden rounded-lg border-2 bg-mist ${
                      index === selected ? 'border-river' : 'border-transparent hover:border-line'
                    }`}
                  >
                    <img
                      src={imageUrl(image.storage_path)}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover"
                    />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h1 className="break-words text-3xl font-extrabold">{listing.title}</h1>
          <p className="mt-3 text-2xl font-bold text-river-dark">
            {formatPrice(listing.price, listing.price_type)}
          </p>

          <p className="mt-4 text-sm text-muted">
            {KIND_LABELS[listing.kind]}
            {listing.condition ? `, ${CONDITION_LABELS[listing.condition]}` : ''}
            {categoryName ? `, ${categoryName}` : ''}
            {listing.city ? `, ${listing.city}` : ''}
          </p>
          {listing.published_at && (
            <p className="mt-1 text-sm text-muted">
              Publiée {formatRelativeDate(listing.published_at)}
            </p>
          )}

          <div className="mt-6">
            <h2 className="text-lg font-bold">Description</h2>
            {listing.description.trim() ? (
              <p className="mt-2 whitespace-pre-line break-words leading-relaxed">
                {listing.description}
              </p>
            ) : (
              <p className="mt-2 text-muted">Le vendeur n’a pas ajouté de description.</p>
            )}
          </div>

          <div className="mt-8 rounded-lg border border-line bg-white p-4">
            <h2 className="text-lg font-bold">Vendeur</h2>
            <p className="mt-2 font-semibold">{seller?.displayName ?? 'Vendeur ZAYA'}</p>
            <p className="mt-1">
              <span className="rounded-full border border-line px-2.5 py-0.5 text-xs font-semibold">
                {SELLER_TYPE_LABELS[listing.seller_type]}
              </span>
            </p>
            {seller && (
              <ul className="mt-3 space-y-1 text-sm text-muted">
                <li>Membre depuis le {formatDate(seller.memberSince)}</li>
                <li>
                  {seller.activeListings} annonce{seller.activeListings > 1 ? 's' : ''} en ligne
                </li>
              </ul>
            )}
          </div>
        </section>
      </div>
    </article>
  )
}