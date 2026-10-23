import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Alert } from '@/components/ui'
import { useAuth } from '@/features/auth/AuthProvider'
import {
  deleteListingImage,
  fetchListing,
  setListingImagePosition,
  setListingStatus,
  updateListing,
  uploadListingImage,
} from '@/features/marketplace/api'
import {
  initialFromListing,
  ListingForm,
  type FormAction,
  type FormPhoto,
  type ListingSubmission,
} from '@/features/marketplace/ListingForm'
import { errorMessage } from '@/lib/errors'
import {
  LISTING_LIMITS,
  STATUS_LABELS,
  type ListingImage,
  type ListingStatus,
  type ListingWithImages,
} from '@/types/marketplace'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function actionsFor(status: ListingStatus): FormAction[] {
  if (status === 'draft') {
    return [
      { intent: 'publish', label: 'Mettre en ligne', requiresPhoto: true },
      { intent: 'draft', label: 'Enregistrer le brouillon', requiresPhoto: false },
    ]
  }
  return [
    {
      intent: 'save',
      label: 'Enregistrer les modifications',
      // Une annonce en ligne doit toujours garder au moins une photo.
      requiresPhoto: status === 'active',
    },
  ]
}

/**
 * Aligne les photos de la base sur celles du formulaire : ajoute les nouvelles,
 * retire celles qui ont disparu, puis applique l'ordre choisi.
 * L'état de départ est relu dans la base, pas reconstruit depuis l'écran.
 */
async function syncPhotos(sellerId: string, listingId: string, photos: FormPhoto[]): Promise<void> {
  const current = await fetchListing(listingId)
  if (!current) throw new Error('unknown_listing')

  const stored = current.listing_images
  const keptIds = new Set(photos.filter((p) => p.source === 'existing').map((p) => p.id))
  const toRemove = stored.filter((image) => !keptIds.has(image.id))
  const newCount = photos.filter((p) => p.source === 'new').length

  const uploaded: ListingImage[] = []

  async function upload() {
    for (let index = 0; index < photos.length; index += 1) {
      const photo = photos[index]
      if (photo.source !== 'new') continue
      uploaded.push(await uploadListingImage(sellerId, listingId, photo.file, index))
    }
  }

  async function remove() {
    for (const image of toRemove) await deleteListingImage(image)
  }

  try {
    // Quand c'est possible, on ajoute AVANT de retirer : l'annonce ne se retrouve jamais
    // sans photo si un envoi échoue. Près de la limite de 8 photos, on doit retirer d'abord.
    if (stored.length + newCount <= LISTING_LIMITS.maxImages) {
      await upload()
      await remove()
    } else {
      await remove()
      await upload()
    }
  } catch (e) {
    for (const image of uploaded) {
      try {
        await deleteListingImage(image)
      } catch {
        // Un fichier qu'on n'arrive pas à retirer est sans conséquence pour l'affichage.
      }
    }
    throw e
  }

  for (let index = 0; index < photos.length; index += 1) {
    const photo = photos[index]
    if (photo.source !== 'existing') continue
    const row = stored.find((image) => image.id === photo.id)
    if (row && row.position !== index) await setListingImagePosition(photo.id, index)
  }
}

export function EditListingPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()

  // undefined = chargement, null = introuvable.
  const [listing, setListing] = useState<ListingWithImages | null | undefined>(undefined)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    setListing(undefined)
    setLoadError(null)

    if (!id || !UUID.test(id)) {
      setListing(null)
      return
    }

    let cancelled = false
    fetchListing(id)
      .then((found) => {
        if (cancelled) return
        // Un utilisateur ne modifie que ses propres annonces.
        setListing(found && found.seller_id === user?.id ? found : null)
      })
      .catch((e) => {
        if (!cancelled) setLoadError(errorMessage(e))
      })
    return () => {
      cancelled = true
    }
  }, [id, user?.id])

  async function handleSubmit({ intent, input, photos }: ListingSubmission) {
    if (!user || !listing) throw new Error('not_authenticated')

    // 1. Les informations : une seule requête, tout ou rien. Le type est figé.
    await updateListing(listing.id, {
      category_id: input.category_id,
      condition: input.condition,
      title: input.title,
      description: input.description,
      price_type: input.price_type,
      price: input.price,
      city: input.city,
    })

    // 2. Les photos. Si cette étape échoue, les informations sont déjà enregistrées.
    try {
      await syncPhotos(user.id, listing.id, photos)
    } catch {
      throw new Error('listing_photos_failed')
    }

    // 3. La mise en ligne d'un brouillon.
    if (intent === 'publish') {
      try {
        await setListingStatus(listing.id, 'active')
      } catch (e) {
        navigate('/mes-annonces', {
          state: {
            notice: {
              tone: 'error',
              text: `Vos modifications sont enregistrées, mais l’annonce n’a pas pu être mise en ligne. ${errorMessage(e)}`,
            },
          },
        })
        return
      }
    }

    const text =
      intent === 'publish'
        ? 'Votre annonce est en ligne.'
        : intent === 'draft'
          ? 'Brouillon enregistré.'
          : 'Modifications enregistrées.'
    navigate('/mes-annonces', { state: { notice: { tone: 'success', text } } })
  }

  if (loadError) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <Alert tone="error">Cette annonce n’a pas pu être chargée. {loadError}</Alert>
        <Link to="/mes-annonces" className="mt-6 inline-block font-semibold text-river underline">
          Retour à mes annonces
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
        <p className="mt-3 text-muted">Cette annonce n’existe pas ou ne vous appartient pas.</p>
        <Link
          to="/mes-annonces"
          className="mt-8 inline-flex min-h-11 items-center rounded-lg bg-river px-5 font-semibold text-white transition-colors hover:bg-river-dark"
        >
          Mes annonces
        </Link>
      </div>
    )
  }

  if (listing.status === 'removed') {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <h1 className="text-3xl font-extrabold">Modifier l’annonce</h1>
        <div className="mt-6">
          <Alert tone="error">
            Cette annonce a été retirée par la modération et ne peut plus être modifiée.
            {listing.removed_reason ? ` Motif : ${listing.removed_reason}` : ''}
          </Alert>
        </div>
        <Link to="/mes-annonces" className="mt-6 inline-block font-semibold text-river underline">
          Retour à mes annonces
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-3xl font-extrabold">Modifier l’annonce</h1>
      <p className="mt-2 text-muted">Statut actuel : {STATUS_LABELS[listing.status]}.</p>

      <div className="mt-8">
        <ListingForm
          key={listing.id}
          initial={initialFromListing(listing)}
          lockKind
          actions={actionsFor(listing.status)}
          onSubmit={handleSubmit}
        />
      </div>

      <Link to="/mes-annonces" className="mt-6 inline-block font-semibold text-river underline">
        Annuler
      </Link>
    </div>
  )
}