import type { AccountType } from './database'

export type ListingKind = 'product' | 'service'
export type ListingCondition = 'new' | 'used'
export type PriceType = 'fixed' | 'negotiable' | 'quote'
export type ListingStatus = 'draft' | 'active' | 'paused' | 'sold' | 'removed'

export interface Category {
  id: string
  parent_id: string | null
  slug: string
  name: string
  kind: ListingKind
  sort_order: number
  is_active: boolean
}

export interface ListingImage {
  id: string
  listing_id: string
  storage_path: string
  position: number
}

/** Une annonce, telle que renvoyée par la table `listings` (sans la colonne de recherche). */
export interface Listing {
  id: string
  seller_id: string
  seller_type: AccountType
  category_id: string
  kind: ListingKind
  condition: ListingCondition | null
  title: string
  description: string
  price_type: PriceType
  price: number | null
  currency: 'XAF'
  city: string | null
  country: string
  status: ListingStatus
  removed_reason: string | null
  published_at: string | null
  created_at: string
  updated_at: string
}

export interface ListingWithImages extends Listing {
  listing_images: ListingImage[]
}

/** Ce que le formulaire de publication envoie à la base. */
export interface ListingInput {
  category_id: string
  kind: ListingKind
  condition: ListingCondition | null
  title: string
  description: string
  price_type: PriceType
  price: number | null
  city: string | null
}

/** Mêmes limites que la base de données : le formulaire les applique avant l'envoi. */
export const LISTING_LIMITS = {
  titleMin: 5,
  titleMax: 120,
  descriptionMax: 4000,
  cityMax: 80,
  priceMax: 10_000_000_000,
  maxImages: 8,
  maxImageBytes: 5 * 1024 * 1024,
  imageTypes: ['image/jpeg', 'image/png', 'image/webp'],
} as const

export const KIND_LABELS: Record<ListingKind, string> = {
  product: 'Produit',
  service: 'Service',
}

export const CONDITION_LABELS: Record<ListingCondition, string> = {
  new: 'Neuf',
  used: 'Occasion',
}

export const PRICE_TYPE_LABELS: Record<PriceType, string> = {
  fixed: 'Prix fixe',
  negotiable: 'Prix négociable',
  quote: 'Sur devis',
}

export const STATUS_LABELS: Record<ListingStatus, string> = {
  draft: 'Brouillon',
  active: 'En ligne',
  paused: 'En pause',
  sold: 'Vendue',
  removed: 'Retirée',
}

/** Étiquette affichée sur l'annonce : particulier, professionnel ou entreprise. */
export const SELLER_TYPE_LABELS: Record<AccountType, string> = {
  individual: 'Particulier',
  professional: 'Professionnel',
  company: 'Entreprise',
}