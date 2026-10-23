import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react'
import { Alert, Button, Field, SelectField } from '@/components/ui'
import { errorMessage } from '@/lib/errors'
import { formatFcfa, parsePriceInput } from '@/lib/format'
import { prepareImage } from '@/lib/images'
import {
  CONDITION_LABELS,
  KIND_LABELS,
  LISTING_LIMITS,
  PRICE_TYPE_LABELS,
  type Category,
  type ListingCondition,
  type ListingInput,
  type ListingKind,
  type ListingWithImages,
  type PriceType,
} from '@/types/marketplace'
import { fetchCategories, imageUrl } from './api'

/* ---------- Types partagés avec les pages qui utilisent le formulaire ---------- */

export type SubmitIntent = 'publish' | 'draft' | 'save'

export interface FormAction {
  intent: SubmitIntent
  label: string
  /** Vrai si l'action exige au moins une photo (mise en ligne, ou annonce déjà en ligne). */
  requiresPhoto: boolean
}

/** Une photo du formulaire : déjà enregistrée, ou choisie à l'instant et pas encore envoyée. */
export type FormPhoto =
  | { source: 'existing'; id: string; storagePath: string; previewUrl: string }
  | { source: 'new'; id: string; file: File; previewUrl: string }

export interface ListingSubmission {
  intent: SubmitIntent
  input: ListingInput
  /** Dans l'ordre d'affichage : la première est la photo principale. */
  photos: FormPhoto[]
}

export interface ListingFormInitial {
  kind: ListingKind
  categoryId: string
  condition: ListingCondition | ''
  title: string
  description: string
  priceType: PriceType
  priceText: string
  city: string
  photos: FormPhoto[]
}

export function emptyListingForm(city = ''): ListingFormInitial {
  return {
    kind: 'product',
    categoryId: '',
    condition: '',
    title: '',
    description: '',
    priceType: 'fixed',
    priceText: '',
    city,
    photos: [],
  }
}

export function initialFromListing(listing: ListingWithImages): ListingFormInitial {
  return {
    kind: listing.kind,
    categoryId: listing.category_id,
    condition: listing.condition ?? '',
    title: listing.title,
    description: listing.description,
    priceType: listing.price_type,
    priceText: listing.price === null ? '' : String(listing.price),
    city: listing.city ?? '',
    photos: listing.listing_images.map(
      (image): FormPhoto => ({
        source: 'existing',
        id: image.id,
        storagePath: image.storage_path,
        previewUrl: imageUrl(image.storage_path),
      }),
    ),
  }
}

/* ---------- Options des listes ---------- */

const kindOptions = Object.keys(KIND_LABELS) as ListingKind[]

const conditionOptions = [
  { value: '', label: 'Choisir…' },
  ...(Object.keys(CONDITION_LABELS) as ListingCondition[]).map((value) => ({
    value,
    label: CONDITION_LABELS[value],
  })),
]

const priceTypeOptions = (Object.keys(PRICE_TYPE_LABELS) as PriceType[]).map((value) => ({
  value,
  label: PRICE_TYPE_LABELS[value],
}))

interface FieldErrors {
  category?: string
  condition?: string
  title?: string
  description?: string
  price?: string
  photos?: string
}

/* ---------- Formulaire ---------- */

interface ListingFormProps {
  initial: ListingFormInitial
  /** En modification, le type (produit ou service) est figé : la base refuse de le changer. */
  lockKind?: boolean
  /** La première action est celle de la touche Entrée et du bouton principal. */
  actions: FormAction[]
  /** Doit lever une erreur en cas d'échec : le formulaire l'affiche et reste rempli. */
  onSubmit: (submission: ListingSubmission) => Promise<void>
}

export function ListingForm({ initial, lockKind = false, actions, onSubmit }: ListingFormProps) {
  const [kind, setKind] = useState<ListingKind>(initial.kind)
  const [categoryId, setCategoryId] = useState(initial.categoryId)
  const [condition, setCondition] = useState<ListingCondition | ''>(initial.condition)
  const [title, setTitle] = useState(initial.title)
  const [description, setDescription] = useState(initial.description)
  const [priceType, setPriceType] = useState<PriceType>(initial.priceType)
  const [priceText, setPriceText] = useState(initial.priceText)
  const [city, setCity] = useState(initial.city)

  const [photos, setPhotos] = useState<FormPhoto[]>(initial.photos)
  const [preparing, setPreparing] = useState(false)
  const [photoMessage, setPhotoMessage] = useState<string | undefined>()

  const [categories, setCategories] = useState<Category[] | null>(null)
  const [categoriesError, setCategoriesError] = useState<string | null>(null)

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [error, setError] = useState<string | null>(null)
  const [pendingIntent, setPendingIntent] = useState<SubmitIntent | null>(null)

  const errorRef = useRef<HTMLDivElement>(null)
  const price = parsePriceInput(priceText)

  useEffect(() => {
    let cancelled = false
    fetchCategories()
      .then((rows) => {
        if (!cancelled) setCategories(rows)
      })
      .catch((e) => {
        if (!cancelled) setCategoriesError(errorMessage(e))
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Une erreur en haut d'un long formulaire passerait inaperçue sur un téléphone.
  useEffect(() => {
    if (error) errorRef.current?.scrollIntoView({ block: 'center' })
  }, [error])

  // Libère les aperçus des photos choisies (pas ceux des photos déjà enregistrées).
  const photosRef = useRef<FormPhoto[]>(photos)
  photosRef.current = photos
  useEffect(
    () => () => {
      photosRef.current.forEach((p) => {
        if (p.source === 'new') URL.revokeObjectURL(p.previewUrl)
      })
    },
    [],
  )

  const categoryOptions = useMemo(() => {
    const options = [
      { value: '', label: 'Choisir une catégorie…' },
      ...(categories ?? [])
        .filter((c) => c.kind === kind)
        .map((c) => ({ value: c.id, label: c.name })),
    ]
    // La catégorie d'une annonce existante a pu être désactivée depuis :
    // on la garde visible pour ne pas la faire disparaître sans prévenir.
    if (categories && categoryId && !options.some((o) => o.value === categoryId)) {
      options.push({ value: categoryId, label: 'Catégorie actuelle (plus proposée)' })
    }
    return options
  }, [categories, kind, categoryId])

  function changeKind(next: ListingKind) {
    setKind(next)
    setCategoryId('')
    setCondition('')
    setFieldErrors((previous) => ({ ...previous, category: undefined, condition: undefined }))
  }

  async function handleFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? [])
    event.target.value = ''
    if (files.length === 0) return

    setPhotoMessage(undefined)
    setFieldErrors((previous) => ({ ...previous, photos: undefined }))

    const room = LISTING_LIMITS.maxImages - photos.length
    if (room <= 0) {
      setPhotoMessage(`Une annonce accepte ${LISTING_LIMITS.maxImages} photos au maximum.`)
      return
    }

    const selected = files.slice(0, room)
    const skipped = files.length - selected.length

    setPreparing(true)
    const added: FormPhoto[] = []
    const failed: string[] = []
    for (const file of selected) {
      try {
        const prepared = await prepareImage(file)
        added.push({
          source: 'new',
          id: crypto.randomUUID(),
          file: prepared,
          previewUrl: URL.createObjectURL(prepared),
        })
      } catch {
        failed.push(file.name)
      }
    }
    setPhotos((previous) => [...previous, ...added])
    setPreparing(false)

    const notes: string[] = []
    if (failed.length > 0) {
      notes.push(`Photo non acceptée (format, poids ou fichier illisible) : ${failed.join(', ')}.`)
    }
    if (skipped > 0) {
      notes.push(
        `${skipped} photo(s) ignorée(s) : ${LISTING_LIMITS.maxImages} photos au maximum par annonce.`,
      )
    }
    if (notes.length > 0) setPhotoMessage(notes.join(' '))
  }

  function removePhoto(id: string) {
    setPhotos((previous) => {
      const target = previous.find((p) => p.id === id)
      if (target?.source === 'new') URL.revokeObjectURL(target.previewUrl)
      return previous.filter((p) => p.id !== id)
    })
  }

  function makeFirst(id: string) {
    setPhotos((previous) => {
      const target = previous.find((p) => p.id === id)
      if (!target) return previous
      return [target, ...previous.filter((p) => p.id !== id)]
    })
  }

  function validate(action: FormAction): FieldErrors {
    const errors: FieldErrors = {}
    if (title.trim().length < LISTING_LIMITS.titleMin) {
      errors.title = `Le titre doit contenir au moins ${LISTING_LIMITS.titleMin} caractères.`
    }
    if (!categoryId) errors.category = 'Choisissez une catégorie.'
    if (kind === 'product' && !condition) {
      errors.condition = 'Indiquez si le produit est neuf ou d’occasion.'
    }
    if (description.length > LISTING_LIMITS.descriptionMax) {
      errors.description = `La description ne peut pas dépasser ${LISTING_LIMITS.descriptionMax} caractères.`
    }
    if (priceType !== 'quote') {
      if (price === null || price < 1) errors.price = 'Indiquez un prix.'
      else if (price > LISTING_LIMITS.priceMax) errors.price = 'Ce prix est trop élevé.'
    }
    if (action.requiresPhoto && photos.length === 0) {
      errors.photos = 'Ajoutez au moins une photo : une annonce en ligne doit en avoir une.'
    }
    return errors
  }

  function buildInput(): ListingInput {
    return {
      category_id: categoryId,
      kind,
      condition: kind === 'product' ? (condition as ListingCondition) : null,
      title: title.trim(),
      description: description.trim(),
      price_type: priceType,
      price: priceType === 'quote' ? null : price,
      city: city.trim() || null,
    }
  }

  async function submit(action: FormAction) {
    if (pendingIntent !== null || preparing) return

    setError(null)
    const errors = validate(action)
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) return

    setPendingIntent(action.intent)
    try {
      await onSubmit({ intent: action.intent, input: buildInput(), photos })
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setPendingIntent(null)
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const first = actions[0]
    if (first) void submit(first)
  }

  const busy = pendingIntent !== null || preparing

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6">
      <div ref={errorRef}>{error && <Alert tone="error">{error}</Alert>}</div>
      {categoriesError && (
        <Alert tone="error">
          Les catégories n’ont pas pu être chargées. {categoriesError} Rechargez la page.
        </Alert>
      )}

      {lockKind ? (
        <p className="text-sm text-muted">
          Type : <strong>{KIND_LABELS[kind]}</strong> (il ne peut pas être modifié après la
          publication).
        </p>
      ) : (
        <fieldset>
          <legend className="text-sm font-semibold">Que souhaitez-vous publier ?</legend>
          <div className="mt-2 grid grid-cols-2 gap-3">
            {kindOptions.map((value) => (
              <label
                key={value}
                className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border px-4 py-2 text-sm font-semibold ${
                  kind === value ? 'border-river bg-river-soft' : 'border-line bg-white'
                }`}
              >
                <input
                  type="radio"
                  name="kind"
                  value={value}
                  checked={kind === value}
                  onChange={() => changeKind(value)}
                  className="h-4 w-4 accent-river"
                />
                {KIND_LABELS[value]}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <SelectField
        label="Catégorie"
        name="category"
        value={categoryId}
        onChange={(e) => setCategoryId(e.target.value)}
        options={categoryOptions}
        error={fieldErrors.category}
      />

      {kind === 'product' && (
        <SelectField
          label="État du produit"
          name="condition"
          value={condition}
          onChange={(e) => setCondition(e.target.value as ListingCondition | '')}
          options={conditionOptions}
          error={fieldErrors.condition}
        />
      )}

      <Field
        label="Titre"
        name="title"
        maxLength={LISTING_LIMITS.titleMax}
        hint={`Entre ${LISTING_LIMITS.titleMin} et ${LISTING_LIMITS.titleMax} caractères.`}
        error={fieldErrors.title}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />

      <div>
        <label htmlFor="description" className="text-sm font-semibold">
          Description
        </label>
        <textarea
          id="description"
          name="description"
          rows={6}
          maxLength={LISTING_LIMITS.descriptionMax}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          aria-invalid={fieldErrors.description ? true : undefined}
          className={`mt-1 block w-full rounded-lg border bg-white px-3 py-2 text-base text-ink focus:border-river ${
            fieldErrors.description ? 'border-clay' : 'border-line'
          }`}
        />
        <p className={`mt-1 text-sm ${fieldErrors.description ? 'text-clay' : 'text-muted'}`}>
          {fieldErrors.description ??
            `${description.length}/${LISTING_LIMITS.descriptionMax} caractères.`}
        </p>
      </div>

      <SelectField
        label="Prix"
        name="price_type"
        value={priceType}
        onChange={(e) => setPriceType(e.target.value as PriceType)}
        options={priceTypeOptions}
      />

      {priceType !== 'quote' && (
        <Field
          label="Montant en FCFA"
          name="price"
          inputMode="numeric"
          autoComplete="off"
          hint={price !== null ? `Affiché : ${formatFcfa(price)}` : 'En FCFA, sans centimes.'}
          error={fieldErrors.price}
          value={priceText}
          onChange={(e) => setPriceText(e.target.value)}
        />
      )}

      <Field
        label="Ville"
        name="city"
        autoComplete="address-level2"
        maxLength={LISTING_LIMITS.cityMax}
        value={city}
        onChange={(e) => setCity(e.target.value)}
      />

      <fieldset>
        <legend className="text-sm font-semibold">Photos</legend>
        <p className="mt-1 text-sm text-muted">
          Jusqu’à {LISTING_LIMITS.maxImages} photos (JPEG, PNG ou WebP). La première est la photo
          principale. Les nouvelles photos sont réduites automatiquement avant l’envoi.
        </p>

        {photos.length > 0 && (
          <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {photos.map((photo, index) => (
              <li key={photo.id} className="overflow-hidden rounded-lg border border-line bg-white">
                <img
                  src={photo.previewUrl}
                  alt={`Photo ${index + 1}`}
                  className="aspect-square w-full object-cover"
                />
                <div className="flex items-center justify-between gap-2 px-2 py-1 text-xs">
                  {index === 0 ? (
                    <span className="py-2 font-semibold text-river-dark">Photo principale</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => makeFirst(photo.id)}
                      disabled={busy}
                      className="py-2 font-semibold text-river underline"
                    >
                      Mettre en premier
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => removePhoto(photo.id)}
                    disabled={busy}
                    className="py-2 text-clay underline"
                  >
                    Retirer
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <input
          id="photos"
          type="file"
          accept={LISTING_LIMITS.imageTypes.join(',')}
          multiple
          disabled={busy || photos.length >= LISTING_LIMITS.maxImages}
          onChange={handleFiles}
          className="peer sr-only"
        />
        <label
          htmlFor="photos"
          className="mt-3 inline-flex min-h-11 cursor-pointer items-center rounded-lg border border-line bg-white px-4 text-sm font-semibold transition-colors hover:bg-river-soft peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-river peer-disabled:cursor-not-allowed peer-disabled:opacity-60"
        >
          {preparing ? 'Préparation des photos…' : 'Ajouter des photos'}
        </label>

        {(fieldErrors.photos ?? photoMessage) && (
          <p role="alert" className="mt-2 text-sm text-clay">
            {fieldErrors.photos ?? photoMessage}
          </p>
        )}
      </fieldset>

      <div className="flex flex-wrap gap-3">
        {actions.map((action, index) => (
          <Button
            key={action.intent}
            type={index === 0 ? 'submit' : 'button'}
            variant={index === 0 ? 'primary' : 'secondary'}
            loading={pendingIntent === action.intent}
            disabled={busy}
            onClick={index === 0 ? undefined : () => void submit(action)}
          >
            {action.label}
          </Button>
        ))}
      </div>
    </form>
  )
}