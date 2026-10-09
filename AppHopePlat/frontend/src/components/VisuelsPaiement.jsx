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

export function VisuelPaiement({ cle }) {
  const visuel = VISUELS_PAIEMENT[cle] ?? {};
  if (visuel.image) return <img src={visuel.image} alt="" decoding="async" />;
  return visuel.Illustration ? <visuel.Illustration /> : null;
}
