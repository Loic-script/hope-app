/**
 * Gestion des comptes bailleurs, cote administrateur.
 *
 * Meme mecanique que pour les benevoles : l'inscription depose une
 * demande, c'est l'administrateur qui ouvre l'acces. La difference est
 * qu'activer un bailleur fait aussi passer son organisation de
 * "prospect" a "actif" -- un partenaire dont personne ne peut se
 * connecter n'est pas encore un partenaire.
 */
import { query, transaction } from '../config/database.js';
import * as volunteerRepository from '../repositories/volunteer.repository.js';
import { versListe } from '../shared/mapping.js';
import { ErreurIntrouvable, ErreurValidation } from '../shared/errors.js';

const STATUTS_ADMIN = ['actif', 'suspendu', 'supprime'];
const STATUTS = ['en_attente', ...STATUTS_ADMIN];

/**
 * Verifie qu'un statut fait partie d'une liste.
 *
 * On n'utilise pas valeurParmi() de shared/validation : elle passe la
 * valeur en majuscules, ce qui convient aux enums du reste du projet
 * mais pas aux statuts de ces tables, ecrits en minuscules.
 */
function statutParmi(valeur, autorises) {
  const texte = String(valeur ?? '').trim().toLowerCase();
  if (!autorises.includes(texte)) {
    throw new ErreurValidation(
      `Le champ "statut" doit valoir : ${autorises.join(', ')}.`,
      { statut: 'Valeur non autorisée' }
    );
  }
  return texte;
}

/**
 * Liste les comptes bailleurs, demandes en attente d'abord.
 *
 * Chaque ligne joint l'organisation : sans elle, l'administrateur ne
 * saurait pas qui il active.
 */
export async function lister(requete = {}) {
  const statut = requete.statut ? statutParmi(requete.statut, STATUTS) : null;
  const valeurs = [];
  let condition = '';

  if (statut) {
    valeurs.push(statut);
    condition = `AND u.statut = $${valeurs.length}`;
  }

  const resultat = await query(
    `SELECT u.id, u.nom, u.prenom, u.email, u.statut, u.cree_le,
            u.derniere_connexion,
            c.id       AS contact_id,
            c.fonction,
            c.contact_principal,
            b.id       AS bailleur_id,
            b.raison_sociale,
            b.type_organisation,
            b.pays,
            b.statut   AS bailleur_statut,
            b.niveau
       FROM utilisateur u
       JOIN utilisateur_role r ON r.utilisateur_id = u.id AND r.role = 'bailleur'
       LEFT JOIN bailleur_contact c ON c.utilisateur_id = u.id
       LEFT JOIN bailleur         b ON b.id = c.bailleur_id
      WHERE TRUE ${condition}
      ORDER BY
        CASE u.statut WHEN 'en_attente' THEN 0 ELSE 1 END,
        u.cree_le DESC`,
    valeurs
  );

  const compteurs = await volunteerRepository.compterParStatut('bailleur');

  return { items: versListe(resultat.rows), counts: compteurs };
}

/**
 * Change le statut d'un compte bailleur.
 *
 * L'activation entraine celle de l'organisation ; la suspension ne la
 * retire pas -- un autre contact peut rester actif.
 */
export async function changerStatut(id, corps = {}, admin = null) {
  const statut = statutParmi(corps.statut, STATUTS_ADMIN);

  const existant = await volunteerRepository.trouverParId(id);
  if (!existant) throw new ErreurIntrouvable('Le compte bailleur', id);

  if (existant.statut === statut) {
    throw new ErreurValidation(`Ce compte est déjà « ${statut} ».`, { statut: 'Sans effet' });
  }

  return transaction(async (client) => {
    const compte = await volunteerRepository.changerStatut(
      id,
      statut,
      admin?.id ?? null,
      client
    );

    if (statut === 'actif') {
      // L'organisation quitte l'etat de prospect, et sa date de
      // partenariat part du jour de l'activation.
      await query(
        `UPDATE bailleur b
            SET statut = 'actif',
                partenaire_depuis = LEAST(b.partenaire_depuis, CURRENT_DATE)
           FROM bailleur_contact c
          WHERE c.bailleur_id = b.id
            AND c.utilisateur_id = $1
            AND b.statut = 'prospect'`,
        [id],
        client
      );
    }

    return compte;
  });
}

/** Raccourci de l'action la plus courante. */
export async function activer(id, admin = null) {
  return changerStatut(id, { statut: 'actif' }, admin);
}
