/**
 * Chaque moyen de paiement a sa page. Ce tableau donne son adresse,
 * relative a la base de l'espace ("/donateur/payer", "/bailleur/payer",
 * ou le parcours d'accueil "/donateur/completer-profil").
 */
export const PAGES_DE_PAIEMENT = {
  mvola: 'mvola',
  orange_money: 'orange-money',
  carte_bancaire: 'carte',
  virement_bancaire: 'virement',
  depot_bancaire: 'depot',
  especes: 'especes',
  virement_international: 'virement-international',
  plateforme: 'plateforme',
};

/** L'adresse de la page d'un moyen, ou null s'il n'en a pas. */
export function pageDePaiement(base, mode) {
  const chemin = PAGES_DE_PAIEMENT[mode];
  return chemin ? `${base}/${chemin}` : null;
}
