import { Link } from 'react-router-dom';

import SoleilHope from '../../components/vitrine/SoleilHope.jsx';
import { LIEN_DON } from '../../components/vitrine/liens.js';

/**
 * Une page du site vitrine dont le contenu n'est pas encore ecrit : son
 * titre, et de quoi continuer -- revenir a l'accueil ou faire un don.
 * Elle sera remplacee page par page.
 */
export default function EnPreparation({ titre }) {
  return (
    <section className="vitrine-preparation">
      <SoleilHope className="vitrine-preparation__soleil" />
      <h1 className="vitrine-preparation__titre">{titre}</h1>
      <p className="vitrine-preparation__texte">Cette page est en préparation. Elle arrive très bientôt.</p>
      <div className="vitrine-preparation__actions">
        <Link to="/" className="vitrine-preparation__retour">
          Retour à l’accueil
        </Link>
        <Link to={LIEN_DON} className="vitrine-don">
          Faire un don
        </Link>
      </div>
    </section>
  );
}
