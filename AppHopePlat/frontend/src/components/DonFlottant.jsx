import { Link } from 'react-router-dom';

import { IconePoignee } from './admin/AdminIcons.jsx';
import { useCarteDeplacable } from '../hooks/useCarteDeplacable.js';

/**
 * "Faire un don", en bouton flottant dans tout l'espace bailleur.
 *
 * Pose en bas a droite, au-dessus de la page, il se deplace ou l'on veut
 * par sa poignee -- souris, doigt, ou fleches du clavier ; Origine le
 * remet en place (useCarteDeplacable, comme la carte des taches du
 * benevole). Le navigateur retient ou il a ete pose.
 *
 * Deux cibles distinctes : la poignee deplace, le reste du bouton mene
 * au don. Un glisser ne declenche donc jamais la navigation.
 *
 * @param {{ to: string, cle: string }} props  cle : ou retenir la position
 */
export default function DonFlottant({ to, cle }) {
  const bouton = useCarteDeplacable(cle, {
    entiere: true,
    margeHaut:
      (Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--admin-entete-hauteur')) || 70) + 6,
  });

  return (
    <div className="don-flottant">
      <div {...bouton.enveloppe}>
        <div className="don-flottant__pilule">
          <span className="don-flottant__reflet" aria-hidden="true" />
          <button
            type="button"
            className="don-flottant__poignee"
            title="Déplacer — flèches du clavier, Origine pour le remettre en place"
            aria-label="Déplacer le bouton Faire un don : glissez-le, ou utilisez les flèches du clavier"
            {...bouton.poignee}
          >
            <IconePoignee />
          </button>
          <Link to={to} className="don-flottant__lien">
            <span className="don-flottant__coeur" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d="M12 20.3s-7.6-4.6-9.3-9.6C1.5 7.3 3.7 4 7.1 4c2 0 3.6 1.1 4.9 2.9C13.3 5.1 14.9 4 16.9 4c3.4 0 5.6 3.3 4.4 6.7-1.7 5-9.3 9.6-9.3 9.6z" />
              </svg>
            </span>
            <span className="don-flottant__libelle">Faire un don</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
