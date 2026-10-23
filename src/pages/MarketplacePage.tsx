import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Alert, Button, Field, SelectField } from '@/components/ui'
import { fetchCategories } from '@/features/marketplace/api'
import { ListingCard } from '@/features/marketplace/ListingCard'
import {
  filtersFromParams,
  filtersToParams,
  hasActiveFilters,
  searchListings,
  type ListingCardData,
  type SearchFilters,
  type SortOption,
} from '@/features/marketplace/search'
import { errorMessage } from '@/lib/errors'
import { parsePriceInput } from '@/lib/format'
import {
  CONDITION_LABELS,
  KIND_LABELS,
  SELLER_TYPE_LABELS,
  type Category,
} from '@/types/marketplace'

/** Le formulaire garde les prix en texte : on les convertit au moment de chercher. */
interface Draft {
  q: string
  kind: SearchFilters['kind']
  categoryId: string
  condition: SearchFilters['condition']
  sellerType: SearchFilters['sellerType']
  city: string
  minText: string
  maxText: string
  sort: SortOption
}

function toDraft(f: SearchFilters): Draft {
  return {
    q: f.q,
    kind: f.kind,
    categoryId: f.categoryId,
    condition: f.condition,
    sellerType: f.sellerType,
    city: f.city,
    minText: f.minPrice === null ? '' : String(f.minPrice),
    maxText: f.maxPrice === null ? '' : String(f.maxPrice),
    sort: f.sort,
  }
}

function fromDraft(d: Draft): SearchFilters {
  return {
    q: d.q,
    kind: d.kind,
    categoryId: d.categoryId,
    condition: d.condition,
    sellerType: d.sellerType,
    city: d.city,
    minPrice: parsePriceInput(d.minText),
    maxPrice: parsePriceInput(d.maxText),
    sort: d.sort,
  }
}

const kindOptions = [
  { value: '', label: 'Produits et services' },
  { value: 'product', label: `${KIND_LABELS.product}s` },
  { value: 'service', label: `${KIND_LABELS.service}s` },
]

const conditionOptions = [
  { value: '', label: 'Neuf ou occasion' },
  { value: 'new', label: CONDITION_LABELS.new },
  { value: 'used', label: CONDITION_LABELS.used },
]

const sellerOptions = [
  { value: '', label: 'Tous les vendeurs' },
  { value: 'individual', label: SELLER_TYPE_LABELS.individual },
  { value: 'professional', label: SELLER_TYPE_LABELS.professional },
  { value: 'company', label: SELLER_TYPE_LABELS.company },
]

const sortOptions = [
  { value: 'recent', label: 'Plus récentes' },
  { value: 'price_asc', label: 'Prix croissant' },
  { value: 'price_desc', label: 'Prix décroissant' },
]

export function MarketplacePage() {
  const [params, setParams] = useSearchParams()
  // La recherche vit dans l'adresse : c'est la source de vérité.
  const filters = useMemo(() => filtersFromParams(params), [params])

  const [draft, setDraft] = useState<Draft>(() => toDraft(filters))
  const [priceError, setPriceError] = useState<string | undefined>()
  const [showFilters, setShowFilters] = useState(hasActiveFilters(filters))

  const [categories, setCategories] = useState<Category[]>([])

  const [items, setItems] = useState<ListingCardData[] | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reloadTick, setReloadTick] = useState(0)
  const [loadingMore, setLoadingMore] = useState(false)
  const [moreError, setMoreError] = useState<string | null>(null)

  // Identifie la recherche en cours : une réponse arrivée trop tard est ignorée.
  const requestRef = useRef(0)
  // Nombre de lignes déjà reçues du serveur (avant suppression des doublons).
  const offsetRef = useRef(0)

  useEffect(() => {
    let cancelled = false
    fetchCategories()
      .then((rows) => {
        if (!cancelled) setCategories(rows)
      })
      .catch(() => {
        // Sans catégories, la recherche par mots-clés et les autres filtres fonctionnent encore.
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Le formulaire suit l'adresse (bouton « retour », lien partagé).
  useEffect(() => {
    setDraft(toDraft(filters))
    setPriceError(undefined)
  }, [filters])

  useEffect(() => {
    const id = ++requestRef.current
    offsetRef.current = 0
    setItems(null)
    setHasMore(false)
    setError(null)
    setMoreError(null)

    searchListings(filters, 0)
      .then((result) => {
        if (requestRef.current !== id) return
        offsetRef.current = result.items.length
        setItems(result.items)
        setHasMore(result.hasMore)
      })
      .catch((e) => {
        if (requestRef.current !== id) return
        setError(errorMessage(e))
        setItems([])
      })
  }, [filters, reloadTick])

  const categoryOptions = useMemo(
    () => [
      { value: '', label: 'Toutes les catégories' },
      ...categories
        .filter((c) => !draft.kind || c.kind === draft.kind)
        .map((c) => ({ value: c.id, label: c.name })),
    ],
    [categories, draft.kind],
  )

  function apply(next: Draft) {
    const candidate = fromDraft(next)
    if (
      candidate.minPrice !== null &&
      candidate.maxPrice !== null &&
      candidate.minPrice > candidate.maxPrice
    ) {
      setPriceError('Le prix minimum dépasse le prix maximum.')
      return
    }
    setPriceError(undefined)
    setParams(filtersToParams(candidate))
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    apply(draft)
  }

  function changeKind(kind: Draft['kind']) {
    setDraft((previous) => {
      const category = categories.find((c) => c.id === previous.categoryId)
      return {
        ...previous,
        kind,
        // Une catégorie de produit ne convient pas à un service, et inversement.
        categoryId: category && kind && category.kind !== kind ? '' : previous.categoryId,
        // Un service n'est ni neuf ni d'occasion.
        condition: kind === 'service' ? '' : previous.condition,
      }
    })
  }

  function clearFilters() {
    setParams(new URLSearchParams())
  }

  async function loadMore() {
    if (items === null || loadingMore) return
    const id = requestRef.current
    setLoadingMore(true)
    setMoreError(null)
    try {
      const result = await searchListings(filters, offsetRef.current)
      if (requestRef.current !== id) return
      offsetRef.current += result.items.length
      setItems((previous) => {
        const seen = new Set((previous ?? []).map((item) => item.id))
        return [...(previous ?? []), ...result.items.filter((item) => !seen.has(item.id))]
      })
      setHasMore(result.hasMore)
    } catch (e) {
      if (requestRef.current === id) setMoreError(errorMessage(e))
    } finally {
      setLoadingMore(false)
    }
  }

  const active = hasActiveFilters(filters)

  let statusText = ''
  if (items === null) statusText = 'Chargement des annonces…'
  else if (!error && items.length > 0) statusText = `${items.length} annonce(s) affichée(s).`

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-3xl font-extrabold">Marketplace</h1>

      <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-4">
        <div className="flex items-end gap-3">
          <Field
            label="Rechercher une annonce"
            type="search"
            name="q"
            autoComplete="off"
            maxLength={100}
            className="min-w-0 flex-1"
            value={draft.q}
            onChange={(e) => setDraft({ ...draft, q: e.target.value })}
          />
          <Button type="submit">Rechercher</Button>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="secondary"
            aria-expanded={showFilters}
            aria-controls="filtres"
            className="sm:hidden"
            onClick={() => setShowFilters((value) => !value)}
          >
            {showFilters ? 'Masquer les filtres' : 'Filtres'}
          </Button>
          {active && (
            <Button variant="ghost" onClick={clearFilters}>
              Effacer les filtres
            </Button>
          )}
        </div>

        <div
          id="filtres"
          className={`${showFilters ? 'block' : 'hidden'} space-y-4 rounded-lg border border-line bg-white p-4 sm:block`}
        >
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <SelectField
              label="Type"
              name="type"
              value={draft.kind}
              onChange={(e) => changeKind(e.target.value as Draft['kind'])}
              options={kindOptions}
            />
            <SelectField
              label="Catégorie"
              name="categorie"
              value={draft.categoryId}
              onChange={(e) => setDraft({ ...draft, categoryId: e.target.value })}
              options={categoryOptions}
            />
            {draft.kind !== 'service' && (
              <SelectField
                label="État"
                name="etat"
                value={draft.condition}
                onChange={(e) =>
                  setDraft({ ...draft, condition: e.target.value as Draft['condition'] })
                }
                options={conditionOptions}
              />
            )}
            <SelectField
              label="Vendeur"
              name="vendeur"
              value={draft.sellerType}
              onChange={(e) =>
                setDraft({ ...draft, sellerType: e.target.value as Draft['sellerType'] })
              }
              options={sellerOptions}
            />
            <Field
              label="Ville"
              name="ville"
              autoComplete="address-level2"
              maxLength={80}
              value={draft.city}
              onChange={(e) => setDraft({ ...draft, city: e.target.value })}
            />
            <div className="grid grid-cols-2 gap-3">
              <Field
                label="Prix min (FCFA)"
                name="min"
                inputMode="numeric"
                autoComplete="off"
                value={draft.minText}
                error={priceError}
                onChange={(e) => setDraft({ ...draft, minText: e.target.value })}
              />
              <Field
                label="Prix max (FCFA)"
                name="max"
                inputMode="numeric"
                autoComplete="off"
                value={draft.maxText}
                onChange={(e) => setDraft({ ...draft, maxText: e.target.value })}
              />
            </div>
          </div>
          <Button type="submit">Appliquer les filtres</Button>
        </div>
      </form>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <p role="status" aria-live="polite" className="text-sm text-muted">
          {statusText}
        </p>
        <div className="w-full sm:w-56">
          <SelectField
            label="Trier par"
            name="tri"
            value={draft.sort}
            onChange={(e) => apply({ ...draft, sort: e.target.value as SortOption })}
            options={sortOptions}
          />
        </div>
      </div>

      {error && (
        <div className="mt-4 space-y-3">
          <Alert tone="error">Les annonces n’ont pas pu être chargées. {error}</Alert>
          <Button variant="secondary" onClick={() => setReloadTick((tick) => tick + 1)}>
            Réessayer
          </Button>
        </div>
      )}

      {items === null && (
        <ul
          aria-hidden="true"
          className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
        >
          {Array.from({ length: 8 }, (_, index) => (
            <li key={index} className="aspect-[3/4] animate-pulse rounded-lg bg-line/60" />
          ))}
        </ul>
      )}

      {items !== null && items.length === 0 && !error && (
        <div className="mt-6 rounded-lg border border-line bg-white p-6">
          <p className="font-semibold">
            {active
              ? 'Aucune annonce ne correspond à votre recherche.'
              : 'Aucune annonce en ligne pour le moment.'}
          </p>
          <p className="mt-1 text-sm text-muted">
            {active
              ? 'Essayez d’autres mots-clés ou retirez un filtre.'
              : 'Revenez bientôt, ou publiez la première.'}
          </p>
          {active && (
            <div className="mt-4">
              <Button variant="secondary" onClick={clearFilters}>
                Effacer les filtres
              </Button>
            </div>
          )}
        </div>
      )}

      {items !== null && items.length > 0 && (
        <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((listing) => (
            <ListingCard key={listing.id} listing={listing} />
          ))}
        </ul>
      )}

      {moreError && (
        <div className="mt-4">
          <Alert tone="error">Impossible de charger la suite. {moreError}</Alert>
        </div>
      )}

      {hasMore && (
        <div className="mt-6 flex justify-center">
          <Button variant="secondary" loading={loadingMore} onClick={() => void loadMore()}>
            Voir plus d’annonces
          </Button>
        </div>
      )}
    </div>
  )
}