/**
 * L'annuaire des benevoles, dans l'espace benevole : se connaitre entre
 * membres, voir le profil d'un autre, et lui ecrire par la messagerie.
 *
 * Le profil qu'on lit d'un autre est un profil public : ce qui aide a
 * travailler ensemble (metier, competences, langues, disponibilites,
 * taches livrees), rien de ce qui touche a la vie privee. Pour le
 * joindre, on passe par la messagerie de HOPE, jamais par ses
 * coordonnees.
 */
import * as annuaire from '../repositories/annuaireBenevoles.repository.js';
import { ErreurIntrouvable } from '../shared/errors.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Les memes paliers que le journal de chacun (volunteerProfile.service.js). */
const BADGES = [
  { cle: 'premiere-tache', libelle: 'Première tâche livrée', taches: 1 },
  { cle: 'cinq-taches', libelle: '5 tâches livrées', taches: 5 },
  { cle: 'trois-projets', libelle: '3 projets soutenus', projets: 3 },
  { cle: 'quinze-taches', libelle: '15 tâches livrées', taches: 15 },
  { cle: 'pilier', libelle: 'Pilier HOPE', taches: 30, projets: 5 },
];

function versCarte(ligne) {
  return {
    id: ligne.utilisateurId,
    prenom: ligne.prenom,
    nom: ligne.nom,
    photoUrl: ligne.photoUrl,
    profession: ligne.profession,
    pays: ligne.pays ?? null,
    competences: ligne.competences ?? [],
    langues: ligne.langues ?? [],
    accepteTerrain: ligne.accepteTerrain,
    accepteDistance: ligne.accepteDistance,
    membreDepuis: ligne.benevoleDepuis ?? ligne.creeLe,
    tachesLivrees: Number(ligne.tachesLivrees ?? 0),
    projets: Number(ligne.projets ?? 0),
  };
}

/** Les autres benevoles actifs. */
export async function lister(utilisateurId) {
  const lignes = await annuaire.lister(utilisateurId);
  return { items: lignes.map(versCarte) };
}

/** Le profil public d'un benevole actif. */
export async function profil(utilisateurId, id) {
  if (!UUID.test(String(id ?? ''))) throw new ErreurIntrouvable('Le bénévole', id);
  const ligne = await annuaire.trouver(id);
  if (!ligne) throw new ErreurIntrouvable('Le bénévole', id);

  const carte = versCarte(ligne);
  const projets = await annuaire.projetsDe(ligne.benevoleId);
  const aides = projets.length;
  return {
    ...carte,
    moi: id === utilisateurId,
    disponibilites: ligne.disponibilites ?? {},
    projetsSuivis: projets.map((p) => ({ id: p.id, nom: p.nom, tachesLivrees: p.tachesLivrees })),
    badges: BADGES.filter(
      (b) => (b.taches === undefined || carte.tachesLivrees >= b.taches) && (b.projets === undefined || aides >= b.projets)
    ).map((b) => ({ cle: b.cle, libelle: b.libelle })),
  };
}
