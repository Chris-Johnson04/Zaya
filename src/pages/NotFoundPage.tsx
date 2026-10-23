import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <div className="mx-auto max-w-md px-4 py-16 text-center">
      <h1 className="text-3xl font-extrabold">Page introuvable</h1>
      <p className="mt-3 text-muted">
        Cette adresse n’existe pas ou a été déplacée. Vérifiez le lien ou revenez à l’accueil.
      </p>
      <Link
        to="/"
        className="mt-8 inline-flex min-h-11 items-center rounded-lg bg-river px-5 font-semibold text-white transition-colors hover:bg-river-dark"
      >
        Retour à l’accueil
      </Link>
    </div>
  )
}