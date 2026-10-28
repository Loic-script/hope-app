// oxlint-disable react/only-export-components -- Fichier de ROUTAGE, pas de
// composants reutilisables : il expose `router` a cote des pages chargees a la
// demande. Le rechargement a chaud ne s'applique pas a une table de routes, et
// eclater ces quinze lignes en autant de fichiers nuirait a la lisibilite.
import { lazy, Suspense, type ReactNode } from 'react';
import { createBrowserRouter } from 'react-router-dom';
import { RootLayout } from '@/layouts/RootLayout';
import { Container, Loader, Section } from '@/components/ui';
import { HomePage } from '@/pages/HomePage';

/**
 * ROUTES DU SITE.
 *
 * DECOUPAGE DU CODE PAR ROUTE
 *   La page d'accueil est chargee immediatement : c'est la porte d'entree, et
 *   la faire attendre derriere un telechargement serait absurde. Toutes les
 *   autres sont chargees a la demande.
 *
 *   Le gain est concret : le parcours de don embarque React Hook Form et Zod,
 *   soit une part notable du poids total. Un visiteur qui lit la page d'accueil
 *   depuis une connexion mobile malgache n'a aucune raison de les telecharger.
 *
 * Toutes les routes partagent RootLayout : un seul en-tete, un seul pied de
 * page, et la remontee en haut de page a chaque navigation.
 */

const ActivitiesPage = lazy(() =>
  import('@/pages/ContentPages').then((m) => ({ default: m.ActivitiesPage })),
);
const ImpactPage = lazy(() =>
  import('@/pages/ContentPages').then((m) => ({ default: m.ImpactPage })),
);
const TransparencyPage = lazy(() =>
  import('@/pages/ContentPages').then((m) => ({ default: m.TransparencyPage })),
);
const AboutPage = lazy(() =>
  import('@/pages/ContentPages').then((m) => ({ default: m.AboutPage })),
);
const ContactPage = lazy(() =>
  import('@/pages/ContentPages').then((m) => ({ default: m.ContactPage })),
);
const PartnerPage = lazy(() =>
  import('@/pages/ContentPages').then((m) => ({ default: m.PartnerPage })),
);

const ProjectsPage = lazy(() =>
  import('@/pages/ProjectsPage').then((m) => ({ default: m.ProjectsPage })),
);
const ProjectDetailPage = lazy(() =>
  import('@/pages/ProjectDetailPage').then((m) => ({ default: m.ProjectDetailPage })),
);

const DonatePage = lazy(() =>
  import('@/pages/DonatePage').then((m) => ({ default: m.DonatePage })),
);
const ProjectDonatePage = lazy(() =>
  import('@/pages/DonatePage').then((m) => ({ default: m.ProjectDonatePage })),
);

const DonationSuccessPage = lazy(() =>
  import('@/pages/DonationResultPages').then((m) => ({ default: m.DonationSuccessPage })),
);
const DonationFailedPage = lazy(() =>
  import('@/pages/DonationResultPages').then((m) => ({ default: m.DonationFailedPage })),
);
const NotFoundPage = lazy(() =>
  import('@/pages/DonationResultPages').then((m) => ({ default: m.NotFoundPage })),
);

/**
 * Attente pendant le chargement d'une page.
 *
 * Elle occupe la meme hauteur qu'une page reelle : sans cela, l'en-tete et le
 * pied de page se rejoindraient une fraction de seconde avant de s'ecarter.
 */
function PageFallback() {
  return (
    <Section tone="white">
      <Container>
        <div className="min-h-[50vh]">
          <Loader label="Chargement de la page" />
        </div>
      </Container>
    </Section>
  );
}

function lazyRoute(element: ReactNode): ReactNode {
  return <Suspense fallback={<PageFallback />}>{element}</Suspense>;
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'activities', element: lazyRoute(<ActivitiesPage />) },
      { path: 'projects', element: lazyRoute(<ProjectsPage />) },
      { path: 'projects/:id', element: lazyRoute(<ProjectDetailPage />) },
      { path: 'projects/:id/donate', element: lazyRoute(<ProjectDonatePage />) },
      { path: 'donate', element: lazyRoute(<DonatePage />) },
      { path: 'impact', element: lazyRoute(<ImpactPage />) },
      { path: 'transparency', element: lazyRoute(<TransparencyPage />) },
      { path: 'about', element: lazyRoute(<AboutPage />) },
      { path: 'contact', element: lazyRoute(<ContactPage />) },
      { path: 'partner', element: lazyRoute(<PartnerPage />) },
      { path: 'donation/success/:transactionId', element: lazyRoute(<DonationSuccessPage />) },
      { path: 'donation/failed', element: lazyRoute(<DonationFailedPage />) },
      { path: '*', element: lazyRoute(<NotFoundPage />) },
    ],
  },
]);
