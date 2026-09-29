/**
 * Le filtrage des listes du site, au fil de la frappe.
 */

/** Sans accents ni majuscules, pour que "ecole" trouve "École". */
export function simplifier(texte) {
  return String(texte ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

/**
 * Les elements dont les champs donnes contiennent chaque mot de la
 * recherche. Une recherche vide rend la liste entiere.
 */
export function filtrerParMots(liste, recherche, champs) {
  const mots = simplifier(recherche).split(/\s+/).filter(Boolean);
  if (mots.length === 0) return liste;
  return liste.filter((element) => {
    const corps = simplifier(champs.map((champ) => element[champ]).join(' '));
    return mots.every((mot) => corps.includes(mot));
  });
}
