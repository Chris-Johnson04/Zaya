const MESSAGES: Array<[RegExp, string]> = [
  // Authentification et inscription
  [/invalid login credentials/i, 'E-mail ou mot de passe incorrect.'],
  [/already registered|already been registered/i, 'Un compte existe déjà avec cet e-mail.'],
  [/email not confirmed/i, "Votre e-mail n'est pas encore confirmé. Ouvrez le message de confirmation reçu."],
  [/password should be at least|weak password/i, 'Le mot de passe est trop faible. Utilisez au moins 8 caractères.'],
  [/invalid email|unable to validate email/i, "L'adresse e-mail n'est pas valide."],
  [/signups? not allowed|signup.*disabled/i, 'Les inscriptions sont fermées pour le moment.'],
  [/rate limit|too many requests/i, 'Trop de tentatives. Patientez quelques minutes puis réessayez.'],
  [/legal_consent_required|database error saving new user/i, 'L’inscription a été refusée. Rechargez la page, acceptez les documents affichés, puis réessayez.'],
  [/invalid_legal_version/i, 'Un document vient d’être mis à jour. Relisez la nouvelle version, puis acceptez-la.'],

  // Marketplace
  [/listing_needs_image/i, 'Ajoutez au moins une photo avant de mettre l’annonce en ligne.'],
  [/listing_photos_failed/i, 'Vos informations sont enregistrées, mais les photos n’ont pas pu être mises à jour. Vérifiez votre connexion, puis enregistrez à nouveau.'],
  [/too_many_images/i, 'Une annonce accepte 8 photos au maximum.'],
  [/invalid_category|category_kind_mismatch/i, 'Cette catégorie ne convient pas à ce type d’annonce.'],
  [/listing_immutable_field/i, 'Le type d’annonce ne peut pas être modifié après sa création.'],
  [/exceeded the maximum allowed size/i, 'Une photo est trop lourde (5 Mo maximum).'],
  [/mime type|unsupported_image_type/i, 'Format de photo non accepté. Utilisez JPEG, PNG ou WebP.'],
  [/image_decode_failed/i, 'Cette photo est illisible. Essayez-en une autre.'],
  [/image_source_too_large|image_too_large/i, 'Cette photo est trop lourde. Choisissez-en une plus légère.'],

  // Réseau
  [/failed to fetch|network|load failed/i, 'Connexion impossible. Vérifiez votre accès Internet.'],

  // Erreurs renvoyées par nos fonctions SQL
  [/not_authenticated/i, 'Vous devez être connecté pour faire cela.'],
  [/role_not_self_assignable/i, 'Ce rôle ne peut pas être activé depuis votre compte.'],
  [/account_not_active/i, "Votre compte n'est pas actif."],
  [/cannot_change_own_roles/i, 'Vous ne pouvez pas modifier vos propres rôles.'],

  // Dernière : la plus générale, elle ne doit passer qu'après les autres.
  [/forbidden|permission denied|row-level security/i, "Vous n'avez pas l'autorisation d'effectuer cette action."],
]

const FALLBACK = 'Une erreur est survenue. Réessayez dans un instant.'

/** Transforme une erreur Supabase (ou autre) en message clair en français. */
export function errorMessage(error: unknown): string {
  const raw =
    typeof error === 'string'
      ? error
      : error && typeof error === 'object' && 'message' in error
        ? String((error as { message: unknown }).message)
        : ''

  for (const [pattern, message] of MESSAGES) {
    if (pattern.test(raw)) return message
  }
  return FALLBACK
}