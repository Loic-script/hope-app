/**
 * Conversion des lignes PostgreSQL vers les objets exposes par l'API.
 *
 * La base parle en snake_case (admin_log, planned_amount), le frontend en
 * camelCase (adminLog, plannedAmount). Un convertisseur generique evite de
 * recopier la meme correspondance dans les douze repositories.
 */

/** Transforme "budget_item_id" en "budgetItemId". */
function versCamel(cle) {
  return cle.replace(/_([a-z0-9])/g, (_correspondance, lettre) => lettre.toUpperCase());
}

/**
 * Convertit une ligne SQL en objet camelCase.
 * Les dates sont serialisees en ISO, les DATE nues restent en AAAA-MM-JJ.
 *
 * @param {Record<string, unknown>|undefined} ligne
 * @returns {Record<string, unknown>|null}
 */
export function versObjet(ligne) {
  if (!ligne) return null;

  const resultat = {};
  for (const [cle, valeur] of Object.entries(ligne)) {
    resultat[versCamel(cle)] = valeur instanceof Date ? valeur.toISOString() : valeur;
  }
  return resultat;
}

/** Convertit une liste de lignes SQL. */
export function versListe(lignes = []) {
  return lignes.map(versObjet);
}

/**
 * Construit la clause SET d'un UPDATE partiel.
 *
 * Seules les colonnes reellement fournies sont modifiees : un PATCH qui
 * n'envoie que le statut ne doit pas effacer les autres champs.
 *
 * @param {Record<string, unknown>} colonnes couples colonne SQL -> valeur
 * @param {number} indexDepart premier numero de placeholder disponible
 * @returns {{ clause: string, valeurs: unknown[], vide: boolean }}
 */
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
