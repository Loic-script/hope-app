import { useCallback, useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';

import * as bailleurService from '../services/bailleur.service.js';

export default function RequireBailleur() {
  const emplacement = useLocation();
  const [etat, setEtat] = useState('verification');
  const [bailleur, setBailleur] = useState(null);

  const rafraichir = useCallback(async () => {
    if (!bailleurService.lireJeton()) {
      setEtat('refuse');
      return null;
    }

    try {
      const profil = await bailleurService.recupererProfil();
      setBailleur(profil);
      setEtat('authentifie');
      return profil;
    } catch {
      bailleurService.effacerSession();
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

  return <Outlet context={{ bailleur, rafraichir }} />;
}
