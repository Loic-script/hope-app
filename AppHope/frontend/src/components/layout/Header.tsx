import { Heart, Menu, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { ButtonLink } from '@/components/ui/Button';
import { Container } from '@/components/ui';
import { MAIN_NAV } from '@/constants/navigation';
import { cn } from '@/utils/cn';

/** Marque HOPE : le cœur reprend l'orange, sur le violet institutionnel. */
function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link
      to="/"
      className="flex shrink-0 items-center gap-2.5 rounded-hope-sm"
      aria-label="HOPE — retour à l’accueil"
    >
      <span
        aria-hidden="true"
        className="flex size-10 items-center justify-center rounded-hope-sm bg-hope-purple"
      >
        <Heart className="size-5 fill-hope-orange text-hope-orange" />
      </span>
      <span className="flex flex-col leading-none">
        <span className="font-display text-xl font-semibold text-hope-purple">HOPE</span>
        {!compact && (
          // Masque sous 380 px : a cette largeur, la baseline pousse les actions
          // hors de l ecran. Le nom HOPE, lui, reste toujours visible.
          <span className="mt-0.5 hidden text-[0.65rem] font-medium tracking-wide text-hope-ink-soft min-[380px]:block">
            Hope for a Better Life
          </span>
        )}
      </span>
    </Link>
  );
}

export function Header() {
  const [isMenuOpen, setMenuOpen] = useState(false);
  const [isScrolled, setScrolled] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const { pathname } = useLocation();

  /**
   * Le menu se referme a chaque navigation.
   *
   * L'ajustement se fait PENDANT LE RENDU, pas dans un effet. C'est le motif
   * recommande par React pour reagir au changement d'une valeur exterieure :
   * un effet declencherait un second rendu en cascade, et le menu resterait
   * visible le temps d'une image par-dessus la nouvelle page.
   *
   * Passer par le clic sur les liens ne suffirait pas : le bouton Precedent du
   * navigateur change aussi le chemin, et laisserait le menu ouvert.
   */
  const [lastPathname, setLastPathname] = useState(pathname);
  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    setMenuOpen(false);
  }

  // Ombre discrete des que la page defile : le header se detache du contenu
  // sans changer de taille ni faire sauter la mise en page.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Menu ouvert : le fond ne defile plus, et Echap referme.
  useEffect(() => {
    if (!isMenuOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
        menuButtonRef.current?.focus();
      }
    };

    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [isMenuOpen]);

  return (
    <header
      className={cn(
        'sticky top-0 z-50 border-b bg-white/95 backdrop-blur transition-shadow duration-300',
        isScrolled ? 'border-hope-blue-mist shadow-hope-sm' : 'border-transparent',
      )}
    >
      <Container size="wide">
        <div className="flex h-18 items-center justify-between gap-4 py-3">
          <Logo />

          <nav aria-label="Navigation principale" className="hidden lg:block">
            <ul className="flex items-center gap-1">
              {MAIN_NAV.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.to === '/'}
                    className={({ isActive }) =>
                      cn(
                        'relative rounded-hope-sm px-3 py-2 text-sm font-medium transition-colors',
                        isActive
                          ? 'text-hope-purple'
                          : 'text-hope-ink-soft hover:text-hope-purple',
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        {item.label}
                        {/* Le soulignement double l'information de couleur :
                            la page courante reste identifiable sans distinguer
                            les teintes. */}
                        <span
                          aria-hidden="true"
                          className={cn(
                            'absolute inset-x-3 -bottom-0.5 h-0.5 rounded-full bg-hope-orange transition-transform duration-300',
                            isActive ? 'scale-x-100' : 'scale-x-0',
                          )}
                        />
                      </>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>

          <div className="flex items-center gap-2">
            {/* La visibilite est portee par un CONTENEUR, pas par le bouton.
                Ajouter `hidden` au bouton ne marcherait pas : ses classes de
                base contiennent deja `inline-flex`, et Tailwind ordonne les
                utilitaires `display` selon sa propre logique, pas selon
                l'ordre ecrit dans l'attribut. Les deux se neutralisaient, le
                bouton restait affiche et debordait sur un ecran de 320 px. */}
            <div className="hidden sm:block">
              <ButtonLink to="/donate" size="sm">
                <Heart className="size-4" aria-hidden="true" />
                Faire un don
              </ButtonLink>
            </div>

            <button
              ref={menuButtonRef}
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-expanded={isMenuOpen}
              aria-controls="menu-mobile"
              aria-label={isMenuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
              className="flex size-11 items-center justify-center rounded-hope-sm text-hope-purple transition-colors hover:bg-hope-lavender/60 lg:hidden"
            >
              {isMenuOpen ? (
                <X className="size-6" aria-hidden="true" />
              ) : (
                <Menu className="size-6" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>
      </Container>

      <MobileMenu isOpen={isMenuOpen} onClose={() => setMenuOpen(false)} />
    </header>
  );
}

function MobileMenu({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  if (!isOpen) return null;

  return (
    <div className="lg:hidden">
      {/* Le voile est purement visuel : la fermeture reste possible au clavier
          par Echap et par le bouton, donc il n'a pas besoin d'etre focusable. */}
      <div
        className="fixed inset-0 top-18 z-40 bg-hope-ink/25"
        onClick={onClose}
        aria-hidden="true"
      />

      <nav
        id="menu-mobile"
        aria-label="Navigation principale"
        className="fixed inset-x-0 top-18 z-50 max-h-[calc(100dvh-4.5rem)] overflow-y-auto border-b border-hope-blue-mist bg-white shadow-hope-lg"
      >
        <Container className="py-4">
          <ul className="flex flex-col gap-1">
            {MAIN_NAV.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) =>
                    cn(
                      'flex min-h-12 items-center rounded-hope px-4 text-base font-medium transition-colors',
                      isActive
                        ? 'bg-hope-lavender/60 text-hope-purple'
                        : 'text-hope-ink hover:bg-hope-blue-light',
                    )
                  }
                >
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>

          <div className="mt-4 border-t border-hope-blue-mist pt-4">
            <ButtonLink to="/donate" fullWidth size="lg">
              <Heart className="size-5" aria-hidden="true" />
              Faire un don
            </ButtonLink>
          </div>
        </Container>
      </nav>
    </div>
  );
}
