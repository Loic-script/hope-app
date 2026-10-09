export function simplifier(texte) {
  return String(texte ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

export function filtrerParMots(liste, recherche, champs) {
  const mots = simplifier(recherche).split(/\s+/).filter(Boolean);
  if (mots.length === 0) return liste;
  return liste.filter((element) => {
    const corps = simplifier(champs.map((champ) => element[champ]).join(' '));
    return mots.every((mot) => corps.includes(mot));
  });
}
