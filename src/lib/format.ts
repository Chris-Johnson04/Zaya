import type { PriceType } from '@/types/marketplace'

const numberFormat = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 })

/** 25000 devient « 25 000 FCFA ». Le FCFA n'a pas de centimes. */
export function formatFcfa(amount: number): string {
  return `${numberFormat.format(amount)} FCFA`
}

/** Prix affiché sur une annonce, selon son mode : fixe, négociable ou sur devis. */
export function formatPrice(price: number | null, priceType: PriceType): string {
  if (priceType === 'quote' || price === null) return 'Sur devis'
  const formatted = formatFcfa(price)
  return priceType === 'negotiable' ? `${formatted} (négociable)` : formatted
}

/**
 * Lit un prix saisi dans un champ : « 25 000 », « 25000 » ou « 25.000 » donnent 25000.
 * Renvoie null si le champ est vide ou ne contient aucun chiffre.
 */
export function parsePriceInput(value: string): number | null {
  const digits = value.replace(/\D/g, '')
  if (digits === '') return null
  const parsed = Number(digits)
  return Number.isSafeInteger(parsed) ? parsed : null
}

const dateFormat = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

export function formatDate(iso: string): string {
  return dateFormat.format(new Date(iso))
}

const relativeFormat = new Intl.RelativeTimeFormat('fr', { numeric: 'auto' })

/** « il y a 3 heures », « hier », « il y a 2 jours »... Au-delà de 30 jours : la date. */
export function formatRelativeDate(iso: string): string {
  const seconds = Math.round((new Date(iso).getTime() - Date.now()) / 1000)
  const abs = Math.abs(seconds)

  if (abs < 60) return "à l'instant"
  if (abs < 3600) return relativeFormat.format(Math.round(seconds / 60), 'minute')
  if (abs < 86400) return relativeFormat.format(Math.round(seconds / 3600), 'hour')
  if (abs < 30 * 86400) return relativeFormat.format(Math.round(seconds / 86400), 'day')
  return formatDate(iso)
}