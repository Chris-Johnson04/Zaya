import { supabase } from '@/lib/supabase'
import type {
  Category,
  Listing,
  ListingImage,
  ListingInput,
  ListingKind,
  ListingStatus,
  ListingWithImages,
} from '@/types/marketplace'

const BUCKET = 'listing-images'

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

/* ---------- Catégories ---------- */

/** Catégories actives, éventuellement filtrées par type (produit ou service). */
export async function fetchCategories(kind?: ListingKind): Promise<Category[]> {
  let query = supabase.from('categories').select('*').order('sort_order')
  if (kind) query = query.eq('kind', kind)
  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as Category[]
}

/* ---------- Annonces du vendeur ---------- */

/**
 * Crée toujours un BROUILLON : la base refuse de publier une annonce sans photo.
 * Le vendeur et son type de compte sont fixés par la base, pas par le navigateur.
 */
export async function createDraftListing(input: ListingInput): Promise<Listing> {
  const { data, error } = await supabase
    .from('listings')
    .insert({ ...input, status: 'draft' })
    .select()
    .single()
  if (error) throw error
  return data as Listing
}

export async function updateListing(
  id: string,
  patch: Partial<Omit<ListingInput, 'kind'>>,
): Promise<Listing> {
  const { data, error } = await supabase
    .from('listings')
    .update(patch)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data as Listing
}

/** Publier, mettre en pause, marquer vendue. Le statut « retirée » est réservé à la modération. */
export async function setListingStatus(
  id: string,
  status: Exclude<ListingStatus, 'removed'>,
): Promise<Listing> {
  const { data, error } = await supabase
    .from('listings')
    .update({ status })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data as Listing
}

/** Seul un brouillon peut être supprimé (règle de la base). */
export async function deleteDraftListing(id: string): Promise<void> {
  const { data: images } = await supabase
    .from('listing_images')
    .select('storage_path')
    .eq('listing_id', id)

  const { error } = await supabase.from('listings').delete().eq('id', id).eq('status', 'draft')
  if (error) throw error

  // Nettoyage des fichiers : un échec ici n'empêche pas la suppression de l'annonce.
  const paths = (images ?? []).map((row: { storage_path: string }) => row.storage_path)
  if (paths.length > 0) await supabase.storage.from(BUCKET).remove(paths)
}

/** Toutes les annonces de l'utilisateur connecté, avec leurs photos. */
export async function fetchMyListings(userId: string): Promise<ListingWithImages[]> {
  const { data, error } = await supabase
    .from('listings')
    .select('*, listing_images(*)')
    .eq('seller_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return sortImages((data ?? []) as ListingWithImages[])
}

export async function fetchListing(id: string): Promise<ListingWithImages | null> {
  const { data, error } = await supabase
    .from('listings')
    .select('*, listing_images(*)')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return sortImages([data as ListingWithImages])[0]
}

function sortImages(listings: ListingWithImages[]): ListingWithImages[] {
  return listings.map((l) => ({
    ...l,
    listing_images: [...l.listing_images].sort((a, b) => a.position - b.position),
  }))
}

/* ---------- Photos ---------- */

export function imageUrl(storagePath: string): string {
  return supabase.storage.from(BUCKET).getPublicUrl(storagePath).data.publicUrl
}

/**
 * Envoie une photo puis l'enregistre dans la base, et renvoie la ligne créée.
 * Chemin imposé par les règles de sécurité : <vendeur>/<annonce>/<fichier>.
 */
export async function uploadListingImage(
  sellerId: string,
  listingId: string,
  file: File,
  position: number,
): Promise<ListingImage> {
  const extension = EXTENSIONS[file.type]
  if (!extension) throw new Error('unsupported_image_type')

  const path = `${sellerId}/${listingId}/${crypto.randomUUID()}.${extension}`

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type, cacheControl: '31536000', upsert: false })
  if (uploadError) throw uploadError

  const { data, error: insertError } = await supabase
    .from('listing_images')
    .insert({ listing_id: listingId, storage_path: path, position })
    .select()
    .single()

  if (insertError || !data) {
    // Pas de fichier orphelin si la base refuse la ligne (par exemple plus de 8 photos).
    await supabase.storage.from(BUCKET).remove([path])
    throw insertError ?? new Error('image_insert_failed')
  }
  return data as ListingImage
}

export async function setListingImagePosition(id: string, position: number): Promise<void> {
  const { error } = await supabase.from('listing_images').update({ position }).eq('id', id)
  if (error) throw error
}

export async function deleteListingImage(image: { id: string; storage_path: string }): Promise<void> {
  const { error } = await supabase.from('listing_images').delete().eq('id', image.id)
  if (error) throw error
  await supabase.storage.from(BUCKET).remove([image.storage_path])
}