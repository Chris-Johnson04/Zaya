import { supabase } from '@/lib/supabase'
import type { AccountType } from '@/types/database'
import type {
  Listing,
  ListingCondition,
  ListingImage,
  ListingKind,
} from '@/types/marketplace'

/** Nombre d'annonces chargées à chaque fois. Petit pour rester léger sur mobile. */
export const PAGE_SIZE = 24

export type SortOption = 'recent' | 'price_asc' | 'price_desc'

export interface SearchFilters {
  q: string
  kind: ListingKind | ''
  categoryId: string
  condition: ListingCondition | ''
  sellerType: AccountType | ''
  city: string
  minPrice: number | null
  maxPrice: number | null
  sort: SortOption
}

export const EMPTY_FILTERS: SearchFilters = {
  q: '',
  kind: '',
  categoryId: '',
  condition: '',
  sellerType: '',
  city: '',
  minPrice: null,
  maxPrice: null,
  sort: 'recent',
}

/** Ce dont une carte d'annonce a besoin : pas de description, une seule photo. */
export type ListingCardData = Pick<
  Listing,
  | 'id'
  | 'seller_id'
  | 'seller_type'
  | 'kind'
  | 'condition'
  | 'title'
  | 'price_type'
  | 'price'
  | 'city'
  | 'published_at'
> & {
  listing_images: Pick<ListingImage, 'storage_path' | 'position'>[]
}

export interface SearchResult {
  items: ListingCardData[]
  hasMore: boolean
}

const CARD_SELECT =
  'id, seller_id, seller_type, kind, condition, title, price_type, price, city, published_at, ' +
  'listing_images(storage_path, position)'

/** Échappe les caractères spéciaux d'un motif ILIKE (%, _ et \). */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`)
}

/**
 * Recherche d'annonces publiques. `offset` sert au bouton « Voir plus ».
 *
 * Le filtre sur le statut « active » est écrit ici explicitement : la base laisse un vendeur
 * voir aussi SES annonces en pause ou en brouillon, et elles n'ont rien à faire dans la
 * marketplace publique.
 */
export async function searchListings(filters: SearchFilters, offset = 0): Promise<SearchResult> {
  let query = supabase.from('listings').select(CARD_SELECT).eq('status', 'active')

  const text = filters.q.trim().slice(0, 100)
  if (text) {
    // Recherche en français sur le titre (prioritaire) et la description.
    // Le mode « websearch » accepte n'importe quelle saisie sans erreur de syntaxe.
    query = query.textSearch('search', text, { type: 'websearch', config: 'french' })
  }
  if (filters.kind) query = query.eq('kind', filters.kind)
  if (filters.categoryId) query = query.eq('category_id', filters.categoryId)
  if (filters.condition) query = query.eq('condition', filters.condition)
  if (filters.sellerType) query = query.eq('seller_type', filters.sellerType)

  const city = filters.city.trim().slice(0, 80)
  if (city) query = query.ilike('city', `%${escapeLike(city)}%`)

  // Une annonce « sur devis » n'a pas de prix : elle est exclue dès qu'on filtre par prix.
  if (filters.minPrice !== null) query = query.gte('price', filters.minPrice)
  if (filters.maxPrice !== null) query = query.lte('price', filters.maxPrice)

  if (filters.sort === 'price_asc') {
    query = query.order('price', { ascending: true, nullsFirst: false })
  } else if (filters.sort === 'price_desc') {
    query = query.order('price', { ascending: false, nullsFirst: false })
  } else {
    query = query.order('published_at', { ascending: false })
  }
  // Le deuxième critère rend l'ordre stable quand deux annonces ont la même date ou le même prix.
  query = query.order('id', { ascending: false })

  // Seule la photo principale est chargée pour la carte.
  query = query
    .order('position', { referencedTable: 'listing_images', ascending: true })
    .limit(1, { referencedTable: 'listing_images' })

  // On demande une ligne de plus que la page pour savoir s'il en reste.
  const { data, error } = await query.range(offset, offset + PAGE_SIZE)
  if (error) throw error

  const rows = (data ?? []) as unknown as ListingCardData[]
  return { items: rows.slice(0, PAGE_SIZE), hasMore: rows.length > PAGE_SIZE }
}

/* ---------- Filtres dans l'adresse de la page ---------- */
// La recherche vit dans l'adresse (/marketplace?q=iphone&kind=product) : on peut la partager,
// l'ajouter aux favoris, et le bouton « retour » du navigateur fonctionne.

const KINDS: readonly ListingKind[] = ['product', 'service']
const CONDITIONS: readonly ListingCondition[] = ['new', 'used']
const SELLER_TYPES: readonly AccountType[] = ['individual', 'professional', 'company']
const SORTS: readonly SortOption[] = ['recent', 'price_asc', 'price_desc']
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function pick<T extends string>(value: string | null, allowed: readonly T[]): T | '' {
  return allowed.includes(value as T) ? (value as T) : ''
}

function toAmount(value: string | null): number | null {
  if (!value || !/^\d{1,11}$/.test(value)) return null
  return Number(value)
}

/** Lit les filtres depuis l'adresse. Toute valeur invalide est ignorée. */
export function filtersFromParams(params: URLSearchParams): SearchFilters {
  const category = params.get('categorie')
  return {
    q: (params.get('q') ?? '').slice(0, 100),
    kind: pick(params.get('type'), KINDS),
    categoryId: category && UUID.test(category) ? category : '',
    condition: pick(params.get('etat'), CONDITIONS),
    sellerType: pick(params.get('vendeur'), SELLER_TYPES),
    city: (params.get('ville') ?? '').slice(0, 80),
    minPrice: toAmount(params.get('min')),
    maxPrice: toAmount(params.get('max')),
    sort: pick(params.get('tri'), SORTS) || 'recent',
  }
}

/** Écrit les filtres dans l'adresse : seules les valeurs renseignées apparaissent. */
export function filtersToParams(filters: SearchFilters): URLSearchParams {
  const params = new URLSearchParams()
  if (filters.q.trim()) params.set('q', filters.q.trim())
  if (filters.kind) params.set('type', filters.kind)
  if (filters.categoryId) params.set('categorie', filters.categoryId)
  if (filters.condition) params.set('etat', filters.condition)
  if (filters.sellerType) params.set('vendeur', filters.sellerType)
  if (filters.city.trim()) params.set('ville', filters.city.trim())
  if (filters.minPrice !== null) params.set('min', String(filters.minPrice))
  if (filters.maxPrice !== null) params.set('max', String(filters.maxPrice))
  if (filters.sort !== 'recent') params.set('tri', filters.sort)
  return params
}

/** Vrai si au moins un filtre est actif (le tri ne compte pas). */
export function hasActiveFilters(filters: SearchFilters): boolean {
  return (
    filters.q.trim() !== '' ||
    filters.kind !== '' ||
    filters.categoryId !== '' ||
    filters.condition !== '' ||
    filters.sellerType !== '' ||
    filters.city.trim() !== '' ||
    filters.minPrice !== null ||
    filters.maxPrice !== null
  )
}