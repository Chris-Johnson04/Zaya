import type { ReactNode } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './AuthProvider'
import type { RoleCode } from '@/types/database'

function Loading() {
  return (
    <div role="status" className="flex min-h-[50vh] items-center justify-center text-muted">
      Chargement…
    </div>
  )
}

/** Réserve une page aux utilisateurs connectés. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) return <Loading />
  if (!user) {
    return <Navigate to="/connexion" replace state={{ from: location.pathname }} />
  }
  return <>{children}</>
}

interface RequireRoleProps {
  roles: RoleCode[]
  /**
   * Si fourni, affiché à la place de la page pour toute personne non autorisée
   * (connectée ou non). Permet de rendre une page indiscernable d'une page inexistante.
   */
  fallback?: ReactNode
  children: ReactNode
}

/** Réserve une page aux utilisateurs ayant au moins un des rôles indiqués (actif). */
export function RequireRole({ roles, fallback, children }: RequireRoleProps) {
  const { user, loading, hasRole } = useAuth()
  const location = useLocation()

  if (loading) return <Loading />

  if (!user) {
    if (fallback) return <>{fallback}</>
    return <Navigate to="/connexion" replace state={{ from: location.pathname }} />
  }

  if (!hasRole(...roles)) {
    if (fallback) return <>{fallback}</>
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-2xl font-bold">Accès refusé</h1>
        <p className="mt-2 text-muted">
          Votre compte n'a pas le rôle nécessaire pour ouvrir cette page.
        </p>
        <Link to="/" className="mt-6 inline-block font-semibold text-river underline">
          Retour à l'accueil
        </Link>
      </div>
    )
  }

  return <>{children}</>
}