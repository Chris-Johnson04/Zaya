import { lazy, Suspense, type ReactNode } from 'react'
import { Route, Routes } from 'react-router-dom'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { RequireAuth, RequireRole } from '@/features/auth/RequireAuth'
import { Layout } from '@/components/Layout'
import { HomePage } from '@/pages/HomePage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { isSupabaseConfigured } from '@/lib/supabase'
import { ADMIN_ROLES } from '@/types/database'

// Ces pages ne sont téléchargées qu'au moment où on les ouvre (connexions lentes).
const LoginPage = lazy(() => import('@/pages/LoginPage').then((m) => ({ default: m.LoginPage })))
const RegisterPage = lazy(() =>
  import('@/pages/RegisterPage').then((m) => ({ default: m.RegisterPage })),
)
const AccountPage = lazy(() =>
  import('@/pages/AccountPage').then((m) => ({ default: m.AccountPage })),
)
const AdminPage = lazy(() => import('@/pages/AdminPage').then((m) => ({ default: m.AdminPage })))
const LegalPage = lazy(() => import('@/pages/LegalPage').then((m) => ({ default: m.LegalPage })))
const SellPage = lazy(() => import('@/pages/SellPage').then((m) => ({ default: m.SellPage })))
const MyListingsPage = lazy(() =>
  import('@/pages/MyListingsPage').then((m) => ({ default: m.MyListingsPage })),
)
const EditListingPage = lazy(() =>
  import('@/pages/EditListingPage').then((m) => ({ default: m.EditListingPage })),
)
const MarketplacePage = lazy(() =>
  import('@/pages/MarketplacePage').then((m) => ({ default: m.MarketplacePage })),
)
const ListingPage = lazy(() =>
  import('@/pages/ListingPage').then((m) => ({ default: m.ListingPage })),
)

function PageLoading() {
  return (
    <div role="status" className="flex min-h-[50vh] items-center justify-center text-muted">
      Chargement…
    </div>
  )
}

function page(element: ReactNode) {
  return <Suspense fallback={<PageLoading />}>{element}</Suspense>
}

function ConfigMissing() {
  return (
    <div className="mx-auto max-w-xl px-4 py-16">
      <h1 className="text-3xl font-extrabold">Configuration manquante</h1>
      <p className="mt-3 text-muted">
        ZAYA ne trouve pas les clés Supabase. Créez un fichier <code>.env.local</code> à la racine
        du projet, en copiant <code>.env.example</code>, puis renseignez :
      </p>
      <pre className="mt-4 overflow-x-auto rounded-lg border border-line bg-white p-4 text-sm">
        {`VITE_SUPABASE_URL=...\nVITE_SUPABASE_ANON_KEY=...`}
      </pre>
      <p className="mt-4 text-muted">Redémarrez ensuite le serveur avec « npm run dev ».</p>
    </div>
  )
}

export default function App() {
  if (!isSupabaseConfigured) return <ConfigMissing />

  return (
    <AuthProvider>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="marketplace" element={page(<MarketplacePage />)} />
          <Route path="annonce/:id" element={page(<ListingPage />)} />
          <Route path="connexion" element={page(<LoginPage />)} />
          <Route path="inscription" element={page(<RegisterPage />)} />
          <Route path="legal/:slug?" element={page(<LegalPage />)} />
          <Route path="compte" element={<RequireAuth>{page(<AccountPage />)}</RequireAuth>} />
          <Route path="vendre" element={<RequireAuth>{page(<SellPage />)}</RequireAuth>} />
          <Route
            path="mes-annonces"
            element={<RequireAuth>{page(<MyListingsPage />)}</RequireAuth>}
          />
          <Route
            path="mes-annonces/:id/modifier"
            element={<RequireAuth>{page(<EditListingPage />)}</RequireAuth>}
          />
          <Route
            path="admin"
            element={
              <RequireRole roles={ADMIN_ROLES} fallback={<NotFoundPage />}>
                {page(<AdminPage />)}
              </RequireRole>
            }
          />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </AuthProvider>
  )
}