import { api, ecrireStockage, TEMOIN_SESSION } from './api.js';
import { CLE_JETON_BAILLEUR } from './apiBailleur.js';
import { CLE_JETON_BENEVOLE } from './apiBenevole.js';
import { CLE_JETON_DONATEUR } from './apiDonateur.js';

const CLE_PAR_TYPE = {
  benevole: CLE_JETON_BENEVOLE,
  bailleur: CLE_JETON_BAILLEUR,
  donateur: CLE_JETON_DONATEUR,
};

export async function consulter(utilisateurId) {
  const { data } = await api.post(`/admin/consulter/${utilisateurId}`);

  const cle = CLE_PAR_TYPE[data.type];
  if (!cle) {
    throw new Error(`Aucun espace ne correspond au type « ${data.type} ».`);
  }
  ecrireStockage(cle, TEMOIN_SESSION, true);

  return data;
}
