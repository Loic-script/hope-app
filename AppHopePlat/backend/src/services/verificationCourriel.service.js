import crypto from 'node:crypto';

import { config } from '../config/env.js';
import { query, transaction } from '../config/database.js';
import { ErreurValidation } from '../shared/errors.js';
import * as courriel from './courriel.service.js';

const DUREE_MS = 48 * 60 * 60 * 1000;

function empreinte(jeton) {
  return crypto.createHash('sha256').update(String(jeton)).digest('hex');
}

export async function envoyerLien(compte) {
  try {
    const jeton = crypto.randomBytes(32).toString('hex');
    await transaction(async (client) => {
      await query(
        `UPDATE verification_courriel SET utilise_le = NOW() WHERE utilisateur_id = $1 AND utilise_le IS NULL`,
        [compte.id],
        client
      );
      await query(
        `INSERT INTO verification_courriel (utilisateur_id, jeton_empreinte, expire_le) VALUES ($1, $2, $3)`,
        [compte.id, empreinte(jeton), new Date(Date.now() + DUREE_MS)],
        client
      );
    });
    const lien = `${config.siteUrl.replace(/\/$/, '')}/verifier-courriel?jeton=${jeton}`;
    return await courriel.envoyer({
      a: compte.email,
      sujet: 'HOPE — confirmez votre adresse électronique',
      titre: `Bienvenue${compte.prenom ? ` ${compte.prenom}` : ''} !`,
      paragraphes: [
        'Un compte HOPE vient d’être ouvert avec cette adresse.',
        'Confirmez-la avec le bouton ci-dessous : c’est à elle que HOPE écrira au sujet de votre compte et de vos dons. Le lien reste valable 48 heures.',
      ],
      bouton: { texte: 'Confirmer mon adresse', lien },
      note: 'Vous n’avez pas créé de compte HOPE ? Ignorez ce message : sans confirmation, l’adresse ne sera pas utilisée.',
    });
  } catch (erreur) {
    console.error('[HOPE] Lien de verification non envoye :', erreur.message);
    return false;
  }
}

export async function verifier(corps = {}) {
  const jeton = String(corps.jeton ?? '').trim();
  const invalide = () =>
    new ErreurValidation('Ce lien n’est plus valable : il a expiré ou a déjà servi. Demandez-en un nouveau depuis votre espace.', {
      jeton: 'Lien expiré ou déjà utilisé',
    });
  if (!/^[a-f0-9]{64}$/.test(jeton)) throw invalide();

  await transaction(async (client) => {
    const { rows } = await query(
      `SELECT id, utilisateur_id FROM verification_courriel
        WHERE jeton_empreinte = $1 AND utilise_le IS NULL AND expire_le > NOW()
        FOR UPDATE`,
      [empreinte(jeton)],
      client
    );
    if (!rows[0]) throw invalide();
    await query('UPDATE verification_courriel SET utilise_le = NOW() WHERE utilisateur_id = $1 AND utilise_le IS NULL', [rows[0].utilisateur_id], client);
    await query('UPDATE utilisateur SET email_verifie_le = COALESCE(email_verifie_le, NOW()) WHERE id = $1', [rows[0].utilisateur_id], client);
  });
  return { message: 'Votre adresse est confirmée. Merci !' };
}

export async function etat(utilisateurId) {
  const { rows } = await query('SELECT email, email_verifie_le FROM utilisateur WHERE id = $1', [utilisateurId]);
  return { email: rows[0]?.email ?? null, emailVerifie: Boolean(rows[0]?.email_verifie_le) };
}

export async function renvoyer(utilisateurId) {
  const { rows } = await query('SELECT id, email, prenom, email_verifie_le FROM utilisateur WHERE id = $1', [utilisateurId]);
  const compte = rows[0];
  if (!compte) throw new ErreurValidation('Compte introuvable.');
  if (compte.email_verifie_le) return { message: 'Votre adresse est déjà confirmée.', emailVerifie: true };
  const parti = await envoyerLien(compte);
  if (!parti) {
    return {
      message: 'Le lien n’a pas pu être envoyé : l’envoi des courriels n’est pas encore en service. Réessayez plus tard ou contactez l’équipe HOPE.',
      emailVerifie: false,
      envoye: false,
    };
  }
  return { message: `Un nouveau lien vient de partir à ${compte.email}.`, emailVerifie: false, envoye: true };
}
