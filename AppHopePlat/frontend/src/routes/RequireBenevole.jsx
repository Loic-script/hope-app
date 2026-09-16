import { useCallback, useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';

import * as benevoleService from '../services/benevole.service.js';

/** Le formulaire a remplir a la premiere connexion. */
const COMPLETION = '/benevole/completer-profil';

/**
 * Garde de route de l'espace benevole.
 *
 * Comme pour l'administrateur, la presence d'un jeton dans le navigateur
 * ne suffit pas : il est soumis a GET /api/benevole/me. C'est le backend
 * qui verifie la signature, l'expiration, et surtout que le compte est
 * toujours actif -- un compte suspendu apres l'emission du jeton doit
 * perdre l'acces sans attendre son expiration.
 */
export default function RequireBenevole() {
  const emplacement = useLocation();
  // 'verification' -> 'authentifie' ou 'refuse'
  const [etat, setEtat] = useState('verification');
  const [benevole, setBenevole] = useState(null);

  /**
   * Relit le profil aupres du backend.
   *
   * Expose aux pages par le contexte : le formulaire de completion
   * l'appelle apres avoir enregistre. Sans cela la garde garderait en
   * memoire un profil incomplet et renverrait indefiniment vers le
   * formulaire que l'on vient de remplir.
   */
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

  /*
   * Premiere connexion : le compte existe, la fiche de terrain est
   * vide. On passe par le formulaire avant l'espace -- sans quoi
   * l'equipe ne saurait pas quelles taches lui confier.
   *
   * La condition exclut la page de completion elle-meme : sinon elle se
   * redirigerait vers elle-meme sans fin.
   */
  const surLaCompletion = emplacement.pathname === COMPLETION;
  if (benevole && benevole.profilComplete === false && !surLaCompletion) {
    return <Navigate to={COMPLETION} replace />;
  }
  if (benevole && benevole.profilComplete !== false && surLaCompletion) {
    return <Navigate to="/benevole" replace />;
  }

  return <Outlet context={{ benevole, rafraichir }} />;
}
