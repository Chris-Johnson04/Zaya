import { Link, useNavigate } from 'react-router-dom'
import { Alert } from '@/components/ui'
import { useAuth } from '@/features/auth/AuthProvider'
import {
  createDraftListing,
  deleteDraftListing,
  setListingStatus,
  uploadListingImage,
} from '@/features/marketplace/api'
import {
  emptyListingForm,
  ListingForm,
  type FormAction,
  type ListingSubmission,
} from '@/features/marketplace/ListingForm'
import { errorMessage } from '@/lib/errors'
import { SELLER_TYPE_LABELS } from '@/types/marketplace'

const actions: FormAction[] = [
  { intent: 'publish', label: 'Mettre en ligne', requiresPhoto: true },
  { intent: 'draft', label: 'Enregistrer en brouillon', requiresPhoto: false },
]

export function SellPage() {
  const { user, profile, hasRole } = useAuth()
  const navigate = useNavigate()

  if (!hasRole('vendor', 'business')) {
    return (
      <div className="mx-auto max-w-md px-4 py-12">
        <h1 className="text-3xl font-extrabold">Publier une annonce</h1>
        <div className="mt-6">
          <Alert tone="info">
            Pour publier une annonce, activez d’abord le rôle Vendeur ou Entreprise sur votre
            compte.
          </Alert>
        </div>
        <Link to="/compte" className="mt-6 inline-block font-semibold text-river underline">
          Aller à Mon compte
        </Link>
      </div>
    )
  }

  async function handleSubmit({ intent, input, photos }: ListingSubmission) {
    if (!user) throw new Error('not_authenticated')

    // Étapes 1 et 2 : le brouillon, puis les photos. Tout ou rien : en cas d'échec,
    // le brouillon est supprimé et le formulaire reste rempli pour réessayer.
    let listingId: string | null = null
    try {
      const listing = await createDraftListing(input)
      listingId = listing.id

      for (let index = 0; index < photos.length; index += 1) {
        const photo = photos[index]
        if (photo.source !== 'new') continue
        await uploadListingImage(user.id, listing.id, photo.file, index)
      }
    } catch (e) {
      if (listingId) {
        try {
          await deleteDraftListing(listingId)
        } catch {
          // Si le nettoyage échoue, le brouillon reste visible dans « Mes annonces ».
        }
      }
      throw e
    }

    // Étape 3 : la mise en ligne. La base vérifie qu'il y a au moins une photo.
    if (intent === 'publish') {
      try {
        await setListingStatus(listingId, 'active')
      } catch (e) {
        navigate('/mes-annonces', {
          state: {
            notice: {
              tone: 'error',
              text: `Votre annonce est enregistrée en brouillon, mais elle n’a pas pu être mise en ligne. ${errorMessage(e)}`,
            },
          },
        })
        return
      }
    }

    navigate('/mes-annonces', {
      state: {
        notice: {
          tone: 'success',
          text: intent === 'publish' ? 'Votre annonce est en ligne.' : 'Brouillon enregistré.',
        },
      },
    })
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-3xl font-extrabold">Publier une annonce</h1>
      {profile && (
        <p className="mt-2 text-muted">
          Vous publiez en tant que <strong>{SELLER_TYPE_LABELS[profile.account_type]}</strong>. Cette
          mention s’affiche sur votre annonce.
        </p>
      )}

      <div className="mt-8">
        <ListingForm
          initial={emptyListingForm(profile?.city ?? '')}
          actions={actions}
          onSubmit={handleSubmit}
        />
      </div>
    </div>
  )
}