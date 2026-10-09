import { useCallback, useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';

import * as authService from '../services/auth.service.js';

export default function RequireAuth() {
  const emplacement = useLocation();
  const [etat, setEtat] = useState('verification');
  const [admin, setAdmin] = useState(null);

  const rafraichir = useCallback(async () => {
    if (!authService.lireJeton()) {
      setEtat('refuse');
      return null;
    }

    try {
      const profil = await authService.recupererProfil();
      setAdmin(profil);
      setEtat('authentifie');
      return profil;
    } catch {
      authService.effacerSession();
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
    return <Navigate to="/authentification?type=aucun" replace state={{ depuis: emplacement.pathname }} />;
  }

  return <Outlet context={{ admin, rafraichir }} />;
}
