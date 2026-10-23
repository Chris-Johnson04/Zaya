import { useAuth } from '@/features/auth/AuthProvider'
import { ADMIN_ROLES, ROLE_LABELS } from '@/types/database'

export function AdminPage() {
  const { roles } = useAuth()

  const adminRoles = roles.filter(
    (r) => r.status === 'active' && ADMIN_ROLES.includes(r.role_code),
  )

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-3xl font-extrabold">Administration</h1>
      <p className="mt-2 text-muted">
        Le tableau de bord complet sera construit à l’étape 11 : commandes, livraisons, vendeurs,
        finance et journal d’audit.
      </p>

      <section className="mt-8" aria-labelledby="admin-roles-titre">
        <h2 id="admin-roles-titre" className="text-xl font-bold">
          Vos rôles d’administration
        </h2>
        <ul className="mt-4 divide-y divide-line rounded-lg border border-line bg-white">
          {adminRoles.map((r) => (
            <li key={r.role_code} className="px-4 py-3 font-semibold">
              {ROLE_LABELS[r.role_code]}
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}