import { query, transaction } from '../config/database.js';
import * as volunteerRepository from '../repositories/volunteer.repository.js';
import { versListe } from '../shared/mapping.js';
import { ErreurIntrouvable, ErreurValidation } from '../shared/errors.js';
import * as courrielsAuto from './courrielsAutomatiques.service.js';

const STATUTS_ADMIN = ['actif', 'suspendu', 'supprime'];
const STATUTS = ['en_attente', ...STATUTS_ADMIN];

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

export async function changerStatut(id, corps = {}, admin = null) {
  const statut = statutParmi(corps.statut, STATUTS_ADMIN);

  const existant = await volunteerRepository.trouverParId(id);
  if (!existant) throw new ErreurIntrouvable('Le compte bailleur', id);

  if (existant.statut === statut) {
    throw new ErreurValidation(`Ce compte est déjà « ${statut} ».`, { statut: 'Sans effet' });
  }

  const resultat = await transaction(async (client) => {
    const compte = await volunteerRepository.changerStatut(
      id,
      statut,
      admin?.id ?? null,
      client
    );

    if (statut === 'actif') {
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
  if (statut === 'actif') void courrielsAuto.compteValide(id, 'bailleur');
  return resultat;
}

export async function activer(id, admin = null) {
  return changerStatut(id, { statut: 'actif' }, admin);
}
