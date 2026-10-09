import crypto from 'node:crypto';
import bcrypt from 'bcrypt';

import { config } from '../config/env.js';
import { query, transaction } from '../config/database.js';
import { ErreurIntrouvable, ErreurValidation } from '../shared/errors.js';
import { fermerSessionsUtilisateur } from './session.service.js';

const LONGUEUR_MOT_DE_PASSE = 8;

async function compteAvecHash(utilisateurId, client = null) {
  const { rows } = await query(
    `SELECT id, email, statut, mot_de_passe FROM utilisateur WHERE id = $1 FOR UPDATE`,
    [utilisateurId],
    client
  );
  const compte = rows[0];
  if (!compte || compte.statut === 'supprime') throw new ErreurIntrouvable('Le compte');
  return compte;
}

async function verifierActuel(compte, actuel, champ = 'actuel') {
  if (!(await bcrypt.compare(typeof actuel === 'string' ? actuel : '', compte.mot_de_passe))) {
    throw new ErreurValidation('Le mot de passe actuel est incorrect.', { [champ]: 'Mot de passe incorrect' });
  }
}

export async function changerMotDePasse(utilisateurId, corps = {}) {
  const nouveau = typeof corps.nouveau === 'string' ? corps.nouveau : '';
  const details = {};
  if (!corps.actuel) details.actuel = 'Champ obligatoire';
  if (nouveau.length < LONGUEUR_MOT_DE_PASSE) details.nouveau = `Au moins ${LONGUEUR_MOT_DE_PASSE} caractères`;
  if (corps.confirmation !== nouveau) details.confirmation = 'Les deux mots de passe ne correspondent pas';
  if (Object.keys(details).length > 0) throw new ErreurValidation('Le formulaire comporte des erreurs.', details);

  const hash = await bcrypt.hash(nouveau, config.admin.saltRounds);
  await transaction(async (client) => {
    const compte = await compteAvecHash(utilisateurId, client);
    await verifierActuel(compte, corps.actuel);
    if (await bcrypt.compare(nouveau, compte.mot_de_passe)) {
      throw new ErreurValidation('Le nouveau mot de passe doit être différent de l’actuel.', {
        nouveau: 'Identique à l’actuel',
      });
    }
    await query('UPDATE utilisateur SET mot_de_passe = $2 WHERE id = $1', [utilisateurId, hash], client);
    await fermerSessionsUtilisateur(utilisateurId, client);
  });
  return { message: 'Votre mot de passe est changé. Vos autres sessions sont fermées.' };
}

export async function supprimerSonCompte(utilisateurId, corps = {}) {
  if (String(corps.confirmation ?? '').trim().toUpperCase() !== 'SUPPRIMER') {
    throw new ErreurValidation('Écrivez SUPPRIMER pour confirmer.', { confirmation: 'Écrivez SUPPRIMER' });
  }
  await transaction(async (client) => {
    const compte = await compteAvecHash(utilisateurId, client);
    await verifierActuel(compte, corps.motDePasse, 'motDePasse');
    const inutilisable = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), config.admin.saltRounds);
    await query(
      `UPDATE utilisateur
          SET statut = 'supprime',
              nom = 'Compte', prenom = 'supprimé',
              email = 'supprime-' || id::text || '@hope.invalid',
              telephone = NULL, adresse = NULL, date_de_naissance = NULL, photo_url = NULL,
              mot_de_passe = $2
        WHERE id = $1`,
      [utilisateurId, inutilisable],
      client
    );
    await query('DELETE FROM reinitialisation_mot_de_passe WHERE utilisateur_id = $1', [utilisateurId], client);
    await fermerSessionsUtilisateur(utilisateurId, client);
  });
  return { message: 'Votre compte est supprimé. Merci pour ce que vous avez fait avec HOPE.' };
}
