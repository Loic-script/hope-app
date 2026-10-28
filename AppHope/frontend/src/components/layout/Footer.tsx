import { Heart, Mail, MapPin, Phone } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Container } from '@/components/ui';
import { ButtonLink } from '@/components/ui/Button';
import { FOOTER_NAV } from '@/constants/navigation';

/**
 * Pied de page institutionnel, en violet HOPE.
 *
 * Le blanc sur #5D5696 donne 6.49:1, largement au-dessus du seuil AA. Les
 * liens secondaires descendent a 85% d'opacite, ce qui reste au-dessus de
 * 4.5:1 ; en dessous, on repasserait sous le seuil.
 */
export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="bg-hope-purple text-white">
      <Container size="wide" className="py-14 lg:py-16">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-[1.4fr_repeat(3,1fr)]">
          {/* --- Identite --- */}
          <div>
            <div className="flex items-center gap-2.5">
              <span
                aria-hidden="true"
                className="flex size-10 items-center justify-center rounded-hope-sm bg-white/12"
              >
                <Heart className="size-5 fill-hope-orange text-hope-orange" />
              </span>
              <div className="leading-none">
                <p className="font-display text-xl font-semibold">HOPE</p>
                <p className="mt-0.5 text-[0.65rem] tracking-wide text-white/70">
                  Hope for a Better Life
                </p>
              </div>
            </div>

            <p className="mt-5 max-w-sm text-sm leading-relaxed text-white/85">
              HOPE accompagne les enfants orphelins et les mères célibataires de Madagascar vers
              une autonomie durable. Chaque don est tracé, du paiement jusqu’à l’impact.
            </p>

            <div className="mt-6">
              <ButtonLink to="/donate" size="sm">
                <Heart className="size-4" aria-hidden="true" />
                Faire un don
              </ButtonLink>
            </div>
          </div>

          {/* --- Plan du site --- */}
          {FOOTER_NAV.map((group) => (
            <nav key={group.title} aria-label={group.title}>
              <h2 className="font-display text-base font-semibold text-hope-yellow">
                {group.title}
              </h2>
              <ul className="mt-4 space-y-2.5">
                {group.items.map((item) => (
                  <li key={item.to}>
                    <Link
                      to={item.to}
                      className="text-sm text-white/85 underline-offset-4 transition-colors hover:text-white hover:underline"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        {/* --- Coordonnees --- */}
        <div className="mt-12 grid gap-4 border-t border-white/15 pt-8 sm:grid-cols-3">
          <p className="flex items-start gap-2.5 text-sm text-white/85">
            <MapPin className="mt-0.5 size-4 shrink-0 text-hope-yellow" aria-hidden="true" />
            Antananarivo, Madagascar
          </p>
          <p className="flex items-start gap-2.5 text-sm text-white/85">
            <Mail className="mt-0.5 size-4 shrink-0 text-hope-yellow" aria-hidden="true" />
            <a href="mailto:contact@hope-madagascar.org" className="underline-offset-4 hover:underline">
              contact@hope-madagascar.org
            </a>
          </p>
          <p className="flex items-start gap-2.5 text-sm text-white/85">
            <Phone className="mt-0.5 size-4 shrink-0 text-hope-yellow" aria-hidden="true" />
            <a href="tel:+261340000000" className="underline-offset-4 hover:underline">
              +261 34 00 000 00
            </a>
          </p>
        </div>

        <div className="mt-8 flex flex-col gap-3 border-t border-white/15 pt-6 text-xs text-white/70 sm:flex-row sm:items-center sm:justify-between">
          <p>© {year} HOPE — Hope for a Better Life. Organisation à but non lucratif.</p>
          <p>
            Plateforme de démonstration : les paiements sont simulés, aucun débit réel n’est
            effectué.
          </p>
        </div>
      </Container>
    </footer>
  );
}
