import { useCallback, useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';

import * as authService from '../services/auth.service.js';

/**
 * Garde de route : protege les pages reservees a l'administrateur connecte.
 *
 * On ne se contente pas de constater la presence d'un jeton dans le
 * navigateur : le jeton est soumis au backend via GET /api/admin/me. C'est
 * lui qui verifie la signature, l'expiration et l'existence du compte. Sans
 * confirmation du serveur, l'utilisateur est renvoye vers la page
 * d'authentification, le choix "Aucun" deja fait.
 */
export default function RequireAuth() {
  const emplacement = useLocation();
  // 'verification' -> 'authentifie' -> ou 'refuse'
  const [etat, setEtat] = useState('verification');
  const [admin, setAdmin] = useState(null);

  /**
   * Relit le profil aupres du backend.
   *
   * Expose aux pages : les parametres l'appellent apres un changement de
   * photo, pour que le bandeau montre la nouvelle sans attendre une
   * reconnexion.
   */
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
