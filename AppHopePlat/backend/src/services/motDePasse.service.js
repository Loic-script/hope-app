/**
 * Le mot de passe oublie, pour les comptes des espaces (donateur,
 * benevole, bailleur).
 *
 * 1. La personne donne son adresse. La reponse est toujours la meme --
 *    que l'adresse existe ou non : la page ne doit pas servir a verifier
 *    qui a un compte.
 * 2. Si le compte existe, un jeton aleatoire part par courriel, dans un
 *    lien valable une heure et une seule fois. La base n'en garde que
 *    l'empreinte (SHA-256) : une fuite de la table ne donne aucun lien
 *    utilisable.
 * 3. Le lien ouvre la page du nouveau mot de passe ; le jeton est
 *    verifie, consomme, et les autres liens encore ouverts sont annules.
 */
import crypto from 'node:crypto';
import bcrypt from 'bcrypt';

import { config } from '../config/env.js';
import { query, transaction } from '../config/database.js';
import { ErreurValidation } from '../shared/errors.js';
import * as courriel from './courriel.service.js';
import { fermerSessionsUtilisateur } from './session.service.js';

/** La duree de vie d'un lien : une heure. */
const DUREE_MS = 60 * 60 * 1000;
const LONGUEUR_MOT_DE_PASSE = 8;

/** L'empreinte d'un jeton : c'est elle, et elle seule, qui dort en base. */
function empreinte(jeton) {
  return crypto.createHash('sha256').update(String(jeton)).digest('hex');
}

/** Le message rendu dans tous les cas, pour ne rien reveler. */
export const REPONSE_DEMANDE =
  'Si un compte existe pour cette adresse, un lien pour choisir un nouveau mot de passe vient d’y être envoyé. ' +
  'Il reste valable une heure.';

/**
 * Etape 1 : demander un lien.
 * @returns {Promise<{ message: string }>}
 */
export async function demander(corps = {}) {
  const email = String(corps.email ?? '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new ErreurValidation('Indiquez une adresse électronique valide.', { email: 'Adresse invalide' });
  }

  const { rows } = await query(
    `SELECT id, prenom, statut FROM utilisateur WHERE email = $1 LIMIT 1`,
    [email]
  );
  const compte = rows[0];
  // Un compte absent ou ferme : meme reponse, rien d'envoye.
  if (!compte || ['suspendu', 'supprime'].includes(compte.statut)) return { message: REPONSE_DEMANDE };

  const jeton = crypto.randomBytes(32).toString('hex');
  await transaction(async (client) => {
    // Un nouveau lien annule les precedents encore ouverts.
    await query(
      `UPDATE reinitialisation_mot_de_passe SET utilise_le = NOW()
        WHERE utilisateur_id = $1 AND utilise_le IS NULL`,
      [compte.id],
      client
    );
    await query(
      `INSERT INTO reinitialisation_mot_de_passe (utilisateur_id, jeton_empreinte, expire_le)
       VALUES ($1, $2, $3)`,
      [compte.id, empreinte(jeton), new Date(Date.now() + DUREE_MS)],
      client
    );
  });

  const lien = `${config.siteUrl.replace(/\/$/, '')}/reinitialiser-mot-de-passe?jeton=${jeton}`;
  await courriel.envoyer({
    a: email,
    sujet: 'HOPE — choisir un nouveau mot de passe',
    titre: `Bonjour${compte.prenom ? ` ${compte.prenom}` : ''},`,
    paragraphes: [
      'Vous avez demandé à changer le mot de passe de votre compte HOPE.',
      'Le bouton ci-dessous ouvre la page où le choisir. Il reste valable une heure, et ne sert qu’une fois.',
    ],
    bouton: { texte: 'Choisir un nouveau mot de passe', lien },
    note: 'Vous n’êtes pas à l’origine de cette demande ? Ignorez ce message : votre mot de passe ne change pas.',
  });

  return { message: REPONSE_DEMANDE };
}

/**
 * Etape 2 : le nouveau mot de passe, avec le jeton du lien.
 * @returns {Promise<{ message: string }>}
 */
export async function reinitialiser(corps = {}) {
  const jeton = String(corps.jeton ?? '').trim();
  const motDePasse = typeof corps.motDePasse === 'string' ? corps.motDePasse : '';

  if (motDePasse.length < LONGUEUR_MOT_DE_PASSE) {
    throw new ErreurValidation(`Le mot de passe doit compter au moins ${LONGUEUR_MOT_DE_PASSE} caractères.`, {
      motDePasse: `Au moins ${LONGUEUR_MOT_DE_PASSE} caractères`,
    });
  }
  if (!/^[a-f0-9]{64}$/.test(jeton)) throw lienInvalide();

  const hash = await bcrypt.hash(motDePasse, config.admin.saltRounds);
  await transaction(async (client) => {
    const { rows } = await query(
      `SELECT id, utilisateur_id FROM reinitialisation_mot_de_passe
        WHERE jeton_empreinte = $1 AND utilise_le IS NULL AND expire_le > NOW()
        FOR UPDATE`,
      [empreinte(jeton)],
      client
    );
    const demande = rows[0];
    if (!demande) throw lienInvalide();

    await query('UPDATE utilisateur SET mot_de_passe = $2 WHERE id = $1', [demande.utilisateur_id, hash], client);
    // Quelqu'un avait peut-etre le mot de passe : ses sessions tombent.
    await fermerSessionsUtilisateur(demande.utilisateur_id, client);
    // Ce lien, et tout autre encore ouvert pour ce compte, est consomme.
    await query(
      `UPDATE reinitialisation_mot_de_passe SET utilise_le = NOW()
        WHERE utilisateur_id = $1 AND utilise_le IS NULL`,
      [demande.utilisateur_id],
      client
    );
  });

  return { message: 'Votre mot de passe est changé. Vous pouvez vous connecter.' };
}

function lienInvalide() {
  return new ErreurValidation('Ce lien n’est plus valable : il a expiré ou a déjà servi. Demandez-en un nouveau.', {
    jeton: 'Lien expiré ou déjà utilisé',
  });
}
