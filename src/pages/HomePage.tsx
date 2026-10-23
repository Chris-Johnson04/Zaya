import { Link } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthProvider'

const actions = [
  { title: 'Découvrir', text: 'Parcourez les annonces de particuliers, de professionnels et d’entreprises.' },
  { title: 'Acheter', text: 'Payez en ligne ou à la livraison, et suivez votre commande en direct.' },
  { title: 'Vendre', text: 'Publiez un produit ou un service, neuf ou d’occasion, en quelques minutes.' },
  { title: 'Livrer', text: 'Un livreur récupère le colis chez le vendeur et le remet au client avec un code de confirmation.' },
]

const primaryButton =
  'inline-flex min-h-11 items-center rounded-lg bg-river px-5 font-semibold text-white transition-colors hover:bg-river-dark'
const secondaryButton =
  'inline-flex min-h-11 items-center rounded-lg border border-line bg-white px-5 font-semibold transition-colors hover:bg-river-soft'

export function HomePage() {
  const { user, loading } = useAuth()

  return (
    <>
      <div className="kuba h-24 sm:h-32" aria-hidden="true" />

      <section className="mx-auto max-w-6xl px-4 py-12 sm:py-16">
        <h1 className="max-w-2xl text-4xl font-extrabold leading-tight sm:text-6xl">
          Découvrez, achetez, vendez, faites livrer.
        </h1>
        <p className="mt-5 max-w-xl text-lg text-muted">
          ZAYA réunit au même endroit les annonces, le paiement et la livraison, pour que chacun
          puisse acheter et vendre simplement au Congo.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link to="/marketplace" className={primaryButton}>
            Voir les annonces
          </Link>
          {!loading &&
            (user ? (
              <Link to="/compte" className={secondaryButton}>
                Mon compte
              </Link>
            ) : (
              <Link to="/inscription" className={secondaryButton}>
                Créer un compte
              </Link>
            ))}
        </div>
      </section>

      <section className="border-t border-line bg-white">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:grid-cols-2 lg:grid-cols-4">
          {actions.map((a) => (
            <div key={a.title}>
              <h2 className="text-xl font-bold">{a.title}</h2>
              <p className="mt-2 text-muted">{a.text}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  )
}