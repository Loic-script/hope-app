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

export function pageDePaiement(base, mode) {
  const chemin = PAGES_DE_PAIEMENT[mode];
  return chemin ? `${base}/${chemin}` : null;
}
