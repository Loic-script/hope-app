import { useCallback, useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';

import * as bailleurService from '../services/bailleur.service.js';

/**
 * Garde de route de l'espace bailleur.
 *
 * Le jeton stocke ne suffit pas : il est soumis a GET /api/bailleur/me,
 * qui verifie la signature, l'expiration, le statut du compte ET que
 * l'acces a l'organisation n'a pas ete retire. Un contact desactive
 * apres l'emission du jeton doit perdre l'acces sans attendre les deux
 * heures d'expiration.
 */
export default function RequireBailleur() {
  const emplacement = useLocation();
  const [etat, setEtat] = useState('verification');
  const [bailleur, setBailleur] = useState(null);

  /**
   * Relit le profil aupres du backend.
   *
   * Expose aux pages par le contexte : le formulaire de declaration
   * l'appelle apres avoir enregistre l'organisation. Sans cela la garde
   * croirait encore qu'il n'y en a pas et renverrait indefiniment vers
   * le formulaire que l'on vient de remplir.
   */
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

  /*
   * Aucun formulaire ne barre l'entree : l'organisation est creee avec
   * le compte, sous un nom provisoire, et se precise depuis
   * "Mon organisation".
   */
  return <Outlet context={{ bailleur, rafraichir }} />;
}
