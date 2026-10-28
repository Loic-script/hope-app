import { Outlet } from 'react-router-dom';
import { Footer } from '@/components/layout/Footer';
import { Header } from '@/components/layout/Header';
import { useScrollToTop } from '@/hooks/useApi';

/**
 * Structure commune a toutes les pages.
 *
 * Le lien d'evitement est le PREMIER element focusable du document : une
 * personne naviguant au clavier peut sauter les huit liens du menu et
 * atteindre le contenu d'une seule tabulation. Il reste invisible tant qu'il
 * n'a pas le focus.
 */
export function RootLayout() {
  useScrollToTop();

  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#contenu" className="skip-link">
        Aller au contenu principal
      </a>

      <Header />

      <main id="contenu" className="flex-1">
        <Outlet />
      </main>

      <Footer />
    </div>
  );
}
