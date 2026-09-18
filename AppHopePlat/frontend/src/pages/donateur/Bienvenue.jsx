import { useLocation, useNavigate, useOutletContext } from 'react-router-dom';

import logoSurFondViolet from '../../assets/LOGO_WORDMARK_SUR_FOND_VIOLET.png';
import * as utilisateurService from '../../services/utilisateur.service.js';

/**
 * Espace donateur.
 *
 * Volontairement reduit a un accueil : l'espace lui-meme n'est pas
 * encore construit. La page prouve que la chaine fonctionne -- un
 * donateur s'inscrit, se connecte sans attendre de validation, et
 * arrive chez lui.
 */
export default function BienvenueDonateur() {
  const { donateur } = useOutletContext();
  const navigate = useNavigate();
  // On arrive du parcours d'accueil : il vient d'etre termine.
  const parcoursTermine = Boolean(useLocation().state?.parcoursTermine);

  async function seDeconnecter() {
    await utilisateurService.deconnecterDonateur();
    navigate('/authentification', { replace: true });
  }

  return (
    <main className="donateur">
      <img className="donateur__logo" src={logoSurFondViolet} alt="HOPE" />

      <h1 className="donateur__titre">
        Bienvenue, {donateur?.prenom || 'chez HOPE'}
      </h1>

      {parcoursTermine && (
        <p className="donateur__merci" role="status">
          Merci ! Votre profil de donateur est complet.
        </p>
      )}

      <p className="donateur__texte">
        Votre compte donateur est ouvert. Votre espace — suivi de vos dons, projets soutenus
        et reçus — arrive prochainement.
      </p>

      <button type="button" className="donateur__sortie" onClick={seDeconnecter}>
        Se déconnecter
      </button>
    </main>
  );
}
