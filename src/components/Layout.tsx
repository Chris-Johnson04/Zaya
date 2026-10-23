import { Link, NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthProvider'
import { ConsentGate } from '@/features/legal/ConsentGate'

function Wordmark() {
  return (
    <Link to="/" className="flex shrink-0 items-center gap-2" aria-label="ZAYA, accueil">
      <svg width="26" height="26" viewBox="0 0 512 512" aria-hidden="true">
        <rect width="512" height="512" rx="112" fill="#0B5D55" />
        <path d="M256 96l160 160-160 160L96 256z" fill="none" stroke="#F0B429" strokeWidth="28" />
        <path d="M256 176l80 80-80 80-80-80z" fill="#F0B429" />
      </svg>
      <span className="font-display text-2xl font-extrabold tracking-tight text-ink">ZAYA</span>
    </Link>
  )
}

const navLink = ({ isActive }: { isActive: boolean }) =>
  `whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
    isActive ? 'bg-river-soft text-river-dark' : 'text-ink hover:bg-river-soft'
  }`

export function Layout() {
  const { user, loading, isAdmin, hasRole } = useAuth()
  const isSeller = hasRole('vendor', 'business')

  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#contenu"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2"
      >
        Aller au contenu
      </a>

      <header className="sticky top-0 z-40 border-b border-line bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-2 px-4">
          <Wordmark />

          <nav
            aria-label="Navigation principale"
            className="flex min-w-0 items-center gap-1 overflow-x-auto"
          >
            <NavLink to="/marketplace" className={navLink}>
              Marketplace
            </NavLink>

            {loading ? null : user ? (
              <>
                {isAdmin && (
                  <NavLink to="/admin" className={navLink}>
                    Administration
                  </NavLink>
                )}
                {isSeller && (
                  <>
                    <NavLink to="/mes-annonces" className={navLink}>
                      Mes annonces
                    </NavLink>
                    <Link
                      to="/vendre"
                      className="inline-flex min-h-10 items-center whitespace-nowrap rounded-lg bg-river px-4 text-sm font-semibold text-white transition-colors hover:bg-river-dark"
                    >
                      Vendre
                    </Link>
                  </>
                )}
                <NavLink to="/compte" className={navLink}>
                  Mon compte
                </NavLink>
              </>
            ) : (
              <>
                <NavLink to="/connexion" className={navLink}>
                  Se connecter
                </NavLink>
                <Link
                  to="/inscription"
                  className="ml-1 inline-flex min-h-10 items-center whitespace-nowrap rounded-lg bg-river px-4 text-sm font-semibold text-white transition-colors hover:bg-river-dark"
                >
                  Créer un compte
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      <main id="contenu" className="flex-1">
        <ConsentGate>
          <Outlet />
        </ConsentGate>
      </main>

      <footer className="border-t border-line bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-6 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>ZAYA — Discover. Buy. Sell. Deliver.</p>
          <nav aria-label="Informations légales" className="flex flex-wrap gap-x-5 gap-y-2">
            <Link to="/legal/terms" className="underline">
              Termes et Conditions
            </Link>
            <Link to="/legal/privacy" className="underline">
              Confidentialité
            </Link>
            <Link to="/legal" className="underline">
              Tous les documents
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  )
}