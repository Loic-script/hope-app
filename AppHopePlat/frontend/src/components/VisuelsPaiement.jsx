import logoCartes from '../assets/paiement/cartes-bancaires.webp';
import imageEspeces from '../assets/paiement/especes.webp';
import logoMvola from '../assets/paiement/mvola.webp';
import logoOrangeMoney from '../assets/paiement/orange-money.webp';
import {
  IllustrationDepot,
  IllustrationInternational,
  IllustrationPlateformes,
  IllustrationVirement,
} from './IllustrationsPaiement.jsx';

/**
 * Le visuel de chaque moyen de paiement : son logo quand il a une marque
 * que l'on reconnait, une illustration au trait de la charte sinon.
 *
 * Partage par le parcours d'accueil du donateur et par "Faire un don" :
 * un moyen se reconnait au meme dessin partout.
 */
export const VISUELS_PAIEMENT = {
  mvola: { image: logoMvola },
  orange_money: { image: logoOrangeMoney },
  virement_bancaire: { Illustration: IllustrationVirement },
  depot_bancaire: { Illustration: IllustrationDepot },
  especes: { image: imageEspeces },
  carte_bancaire: { image: logoCartes },
  virement_international: { Illustration: IllustrationInternational },
  plateforme: { Illustration: IllustrationPlateformes },
};

/** Le visuel d'un moyen, par son code ("mvola", "especes"...). */
export function VisuelPaiement({ cle }) {
  const visuel = VISUELS_PAIEMENT[cle] ?? {};
  if (visuel.image) return <img src={visuel.image} alt="" decoding="async" />;
  return visuel.Illustration ? <visuel.Illustration /> : null;
}
