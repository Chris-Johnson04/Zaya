import { LISTING_LIMITS } from '@/types/marketplace'

/** Côté le plus long après réduction, en pixels. Suffisant pour un écran de téléphone. */
const MAX_SIDE = 1600
/** Au-delà, on refuse d'ouvrir le fichier : il risquerait de saturer la mémoire du téléphone. */
const MAX_SOURCE_BYTES = 25 * 1024 * 1024
/** Qualités essayées dans l'ordre, jusqu'à passer sous la limite de la base (5 Mo). */
const QUALITIES = [0.82, 0.7, 0.55, 0.4]

interface DecodedImage {
  source: CanvasImageSource
  width: number
  height: number
  close: () => void
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality))
}

async function decode(file: File): Promise<DecodedImage> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file)
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        close: () => bitmap.close(),
      }
    } catch {
      // Navigateur ancien ou fichier particulier : on essaie l'autre méthode.
    }
  }

  const url = URL.createObjectURL(file)
  try {
    const image = new Image()
    image.src = url
    await image.decode()
    return {
      source: image,
      width: image.naturalWidth,
      height: image.naturalHeight,
      close: () => URL.revokeObjectURL(url),
    }
  } catch {
    URL.revokeObjectURL(url)
    throw new Error('image_decode_failed')
  }
}

/**
 * Prépare une photo avant l'envoi : la réduit, la ré-encode (WebP si le navigateur
 * le permet, sinon JPEG) et vérifie qu'elle respecte la limite de taille.
 *
 * Le ré-encodage supprime aussi les métadonnées de la photo d'origine
 * (par exemple le lieu où elle a été prise), qui n'ont rien à faire sur une annonce publique.
 */
export async function prepareImage(file: File): Promise<File> {
  if (!(LISTING_LIMITS.imageTypes as readonly string[]).includes(file.type)) {
    throw new Error('unsupported_image_type')
  }
  if (file.size > MAX_SOURCE_BYTES) {
    throw new Error('image_source_too_large')
  }

  const decoded = await decode(file)
  try {
    const scale = Math.min(1, MAX_SIDE / Math.max(decoded.width, decoded.height))
    const width = Math.max(1, Math.round(decoded.width * scale))
    const height = Math.max(1, Math.round(decoded.height * scale))

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height

    const context = canvas.getContext('2d')
    if (!context) throw new Error('image_decode_failed')

    // Fond blanc : une photo PNG transparente ne devient pas noire en JPEG.
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, width, height)
    context.drawImage(decoded.source, 0, 0, width, height)

    for (const quality of QUALITIES) {
      let blob = await toBlob(canvas, 'image/webp', quality)
      // Certains navigateurs ne savent pas encoder le WebP et renvoient autre chose.
      if (!blob || blob.type !== 'image/webp') {
        blob = await toBlob(canvas, 'image/jpeg', quality)
      }
      if (blob && blob.size <= LISTING_LIMITS.maxImageBytes) {
        const extension = blob.type === 'image/webp' ? 'webp' : 'jpg'
        const baseName = file.name.replace(/\.[^.]+$/, '') || 'photo'
        return new File([blob], `${baseName}.${extension}`, { type: blob.type })
      }
    }

    throw new Error('image_too_large')
  } finally {
    decoded.close()
  }
}