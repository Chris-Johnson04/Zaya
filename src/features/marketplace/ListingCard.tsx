import { Link } from 'react-router-dom'
import { formatPrice } from '@/lib/format'
import {
  CONDITION_LABELS,
  KIND_LABELS,
  SELLER_TYPE_LABELS,
} from '@/types/marketplace'
import { imageUrl } from './api'
import type { ListingCardData } from './search'

export function ListingCard({ listing }: { listing: ListingCardData }) {
  const cover = listing.listing_images[0]

  return (
    <li className="h-full">
      <Link
        to={`/annonce/${listing.id}`}
        className="flex h-full flex-col overflow-hidden rounded-lg border border-line bg-white transition-colors hover:border-river"
      >
        {/* Le ratio fixe réserve la place avant le chargement de la photo : pas de saut de page. */}
        <div className="aspect-[4/3] w-full overflow-hidden bg-mist">
          {cover ? (
            <img
              src={imageUrl(cover.storage_path)}
              alt=""
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted">
              Pas de photo
            </div>
          )}
        </div>

        <div className="flex flex-1 flex-col gap-1 p-3">
          <h3 className="line-clamp-2 break-words text-base font-bold leading-snug">
            {listing.title}
          </h3>

          <p className="font-semibold text-river-dark">
            {formatPrice(listing.price, listing.price_type)}
          </p>

          <p className="text-sm text-muted">
            {KIND_LABELS[listing.kind]}
            {listing.condition ? `, ${CONDITION_LABELS[listing.condition]}` : ''}
            {listing.city ? `, ${listing.city}` : ''}
          </p>

          <p className="mt-auto pt-2">
            <span className="rounded-full border border-line px-2.5 py-0.5 text-xs font-semibold">
              {SELLER_TYPE_LABELS[listing.seller_type]}
            </span>
          </p>
        </div>
      </Link>
    </li>
  )
}