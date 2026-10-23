import { supabase } from '@/lib/supabase'
import type { AccountType } from '@/types/database'

/** Ce qu'un visiteur a le droit de savoir sur un vendeur (cf. migration 0012). */
export interface SellerPublic {
  displayName: string | null
  accountType: AccountType
  memberSince: string
  activeListings: number
}

interface SellerPublicRow {
  display_name: string | null
  account_type: AccountType
  member_since: string
  active_listings: number | string
}

/**
 * Informations publiques d'un vendeur. Renvoie null si le vendeur n'a aucune annonce
 * en ligne, ou si son compte n'est plus actif : la base ne répond alors rien.
 */
export async function fetchSellerPublic(sellerId: string): Promise<SellerPublic | null> {
  const { data, error } = await supabase.rpc('get_seller_public', { p_seller_id: sellerId })
  if (error) throw error

  const row = ((data ?? []) as SellerPublicRow[])[0]
  if (!row) return null

  return {
    displayName: row.display_name,
    accountType: row.account_type,
    memberSince: row.member_since,
    // Les compteurs SQL (bigint) peuvent arriver sous forme de texte.
    activeListings: Number(row.active_listings),
  }
}