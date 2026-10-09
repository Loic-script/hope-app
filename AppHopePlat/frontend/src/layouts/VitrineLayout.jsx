import { Suspense, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';

import ChargementPage from '../components/ChargementPage.jsx';
import EnteteVitrine from '../components/vitrine/EnteteVitrine.jsx';
import PiedVitrine from '../components/vitrine/PiedVitrine.jsx';

export default function VitrineLayout() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div className="vitrine">
      <a className="vitrine__evitement" href="#vitrine-contenu">
        Aller au contenu
      </a>
      <EnteteVitrine />
      <main id="vitrine-contenu" className="vitrine__contenu" tabIndex={-1}>
        <Suspense fallback={<ChargementPage />}>
          <Outlet />
        </Suspense>
      </main>
      <PiedVitrine />
    </div>
  );
}
