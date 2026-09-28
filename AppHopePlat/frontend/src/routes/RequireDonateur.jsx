import { useCallback, useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';

import {
  CLE_DONATEUR,
  CLE_JETON_DONATEUR,
  effacerStockage,
  lireStockage,
} from '../services/apiDonateur.js';
import * as utilisateurService from '../services/utilisateur.service.js';

/**
 * Garde de route de l'espace donateur.
 *
 * Comme les autres espaces : le jeton stocke ne suffit pas, il est
 * soumis a GET /api/donateur/me. Le donateur n'a pas de formulaire de
 * completion, il n'y a donc pas de redirection a prevoir ici.
 */
export default function RequireDonateur() {
  const emplacement = useLocation();
  const [etat, setEtat] = useState('verification');
  const [donateur, setDonateur] = useState(null);

  /*
   * Relit le profil. Le parcours d'accueil l'appelle apres chaque etape :
   * le nom qu'on vient de donner doit se lire aussitot dans l'espace.
   */
  const rafraichir = useCallback(async () => {
    try {
      setDonateur(await utilisateurService.recupererDonateur());
    } catch {
      /* la session reste ouverte ; la prochaine lecture reessaiera */
    }
  }, []);

  useEffect(() => {
    let annule = false;

    async function verifier() {
      if (!lireStockage(CLE_JETON_DONATEUR)) {
        if (!annule) setEtat('refuse');
        return;
      }

      try {
        const profil = await utilisateurService.recupererDonateur();
        if (annule) return;
        setDonateur(profil);
        setEtat('authentifie');
      } catch {
        if (annule) return;
        effacerStockage(CLE_JETON_DONATEUR);
        effacerStockage(CLE_DONATEUR);
        setEtat('refuse');
      }
    }

    verifier();

    return () => {
      annule = true;
    };
  }, []);

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

  return <Outlet context={{ donateur, rafraichir }} />;
}
