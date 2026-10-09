import { useCallback, useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';

import * as benevoleService from '../services/benevole.service.js';

const COMPLETION = '/benevole/completer-profil';

export default function RequireBenevole() {
  const emplacement = useLocation();
  const [etat, setEtat] = useState('verification');
  const [benevole, setBenevole] = useState(null);

  const rafraichir = useCallback(async () => {
    if (!benevoleService.lireJeton()) {
      setEtat('refuse');
      return null;
    }

    try {
      const profil = await benevoleService.recupererProfil();
      setBenevole(profil);
      setEtat('authentifie');
      return profil;
    } catch {
      benevoleService.effacerSession();
      setEtat('refuse');
      return null;
    }
  }, []);

  useEffect(() => {
    rafraichir();
  }, [rafraichir]);

  if (etat === 'verification') {
    return (
      <div className="verification" role="status" aria-live="polite">
        <span className="verification__rotation" aria-hidden="true" />
        <p>Vérification de la session…</p>
      </div>
    );
  }

  if (etat === 'refuse') {
    return <Navigate to="/authentification" replace state={{ depuis: emplacement.pathname }} />;
  }

  const surLaCompletion = emplacement.pathname === COMPLETION;
  if (benevole && benevole.profilComplete === false && !surLaCompletion) {
    return <Navigate to={COMPLETION} replace />;
  }
  if (benevole && benevole.profilComplete !== false && surLaCompletion) {
    return <Navigate to="/benevole" replace />;
  }

  return <Outlet context={{ benevole, rafraichir }} />;
}
