/**
 * Consultation d'un espace depuis l'espace administrateur.
 *
 * L'administrateur ouvre l'espace d'un benevole ou d'un bailleur et le
 * voit tel que son occupant le voit. Le serveur emet pour cela un jeton
 * de trente minutes, marque du nom de l'administrateur ; il ne revele
 * aucun mot de passe et ne touche pas au compte consulte.
 *
 * Le jeton est range dans la cle de l'espace vise, et non dans celle de
 * l'administrateur : chaque espace a son client HTTP et sa cle, si bien
 * que la session d'administration reste intacte -- on revient a /admin
 * sans s'etre deconnecte.
 */
import { api, ecrireStockage } from './api.js';
import { CLE_JETON_BAILLEUR } from './apiBailleur.js';
import { CLE_JETON_BENEVOLE } from './apiBenevole.js';
import { CLE_JETON_DONATEUR } from './apiDonateur.js';

const CLE_PAR_TYPE = {
  benevole: CLE_JETON_BENEVOLE,
  bailleur: CLE_JETON_BAILLEUR,
  donateur: CLE_JETON_DONATEUR,
};

/**
 * Ouvre une session de consultation et rend ou aller.
 *
 * @param {string} utilisateurId identifiant du compte a consulter
 * @returns {Promise<{ espace: string, type: string, utilisateur: object }>}
 */
export async function consulter(utilisateurId) {
  const { data } = await api.post(`/admin/consulter/${utilisateurId}`);

  const cle = CLE_PAR_TYPE[data.type];
  if (!cle) {
    throw new Error(`Aucun espace ne correspond au type « ${data.type} ».`);
  }
  ecrireStockage(cle, data.token, true);

  return data;
}
