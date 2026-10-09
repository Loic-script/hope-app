import crypto from 'node:crypto';
import bcrypt from 'bcrypt';

import { config } from '../config/env.js';
import { query, transaction } from '../config/database.js';
import { ErreurValidation } from '../shared/errors.js';
import * as courriel from './courriel.service.js';
import { fermerSessionsUtilisateur } from './session.service.js';

const DUREE_MS = 60 * 60 * 1000;
const LONGUEUR_MOT_DE_PASSE = 8;

function empreinte(jeton) {
  return crypto.createHash('sha256').update(String(jeton)).digest('hex');
}

export const REPONSE_DEMANDE =
  'Si un compte existe pour cette adresse, un lien pour choisir un nouveau mot de passe vient d’y être envoyé. ' +
  'Il reste valable une heure.';

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
  if (!compte || ['suspendu', 'supprime'].includes(compte.statut)) return { message: REPONSE_DEMANDE };

  const jeton = crypto.randomBytes(32).toString('hex');
  await transaction(async (client) => {
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

    await query(
      'UPDATE utilisateur SET mot_de_passe = $2, email_verifie_le = COALESCE(email_verifie_le, NOW()) WHERE id = $1',
      [demande.utilisateur_id, hash],
      client
    );
    await fermerSessionsUtilisateur(demande.utilisateur_id, client);
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
