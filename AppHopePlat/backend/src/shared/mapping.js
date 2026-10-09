function versCamel(cle) {
  return cle.replace(/_([a-z0-9])/g, (_correspondance, lettre) => lettre.toUpperCase());
}

export function versObjet(ligne) {
  if (!ligne) return null;

  const resultat = {};
  for (const [cle, valeur] of Object.entries(ligne)) {
    resultat[versCamel(cle)] = valeur instanceof Date ? valeur.toISOString() : valeur;
  }
  return resultat;
}

export function versListe(lignes = []) {
  return lignes.map(versObjet);
}

export function construireSet(colonnes, indexDepart = 1) {
  const morceaux = [];
  const valeurs = [];
  let index = indexDepart;

  for (const [colonne, valeur] of Object.entries(colonnes)) {
    if (valeur === undefined) continue;
    morceaux.push(`${colonne} = $${index}`);
    valeurs.push(valeur);
    index += 1;
  }

  return {
    clause: morceaux.join(', '),
    valeurs,
    vide: morceaux.length === 0,
  };
}
