/**
 * La verification de l'adresse electronique.
 *
 * A l'inscription, un lien part a l'adresse donnee : il prouve que la
 * personne recoit bien ce courrier. Tant qu'elle n'a pas clique :
 *
 *   - le compte fonctionne (un donateur peut donner tout de suite), mais
 *     son espace rappelle de confirmer l'adresse, avec un bouton pour
 *     renvoyer le lien ;
 *   - l'equipe le voit sur la fiche du compte, avant de valider un
 *     benevole ou un bailleur.
 *
 * Quelqu'un qui s'inscrit avec l'adresse d'un autre ne recoit donc
 * rien : c'est le vrai proprietaire qui recoit le lien (avec « ce n'est
 * pas vous ? ignorez ce message »), et il peut reprendre le compte par
 * « mot de passe oublie », qui confirme aussi l'adresse.
 *
 * Meme mecanique que le mot de passe oublie : jeton aleatoire, seule
 * son empreinte en base, valable 48 heures et une fois.
 */
import crypto from 'node:crypto';

import { config } from '../config/env.js';
import { query, transaction } from '../config/database.js';
import { ErreurValidation } from '../shared/errors.js';
import * as courriel from './courriel.service.js';

const DUREE_MS = 48 * 60 * 60 * 1000;

function empreinte(jeton) {
  return crypto.createHash('sha256').update(String(jeton)).digest('hex');
}

/**
 * Cree un lien et l'envoie. Ne leve pas : un courriel rate ne doit pas
 * faire echouer l'inscription (le lien se renvoie depuis l'espace).
 *
 * @param {{ id: string, email: string, prenom?: string }} compte
 */
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

/** Le lien du courriel : confirme l'adresse. */
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

/** L'etat de l'adresse, pour le rappel de l'espace. */
export async function etat(utilisateurId) {
  const { rows } = await query('SELECT email, email_verifie_le FROM utilisateur WHERE id = $1', [utilisateurId]);
  return { email: rows[0]?.email ?? null, emailVerifie: Boolean(rows[0]?.email_verifie_le) };
}

/** Renvoyer le lien depuis l'espace. */
export async function renvoyer(utilisateurId) {
  const { rows } = await query('SELECT id, email, prenom, email_verifie_le FROM utilisateur WHERE id = $1', [utilisateurId]);
  const compte = rows[0];
  if (!compte) throw new ErreurValidation('Compte introuvable.');
  if (compte.email_verifie_le) return { message: 'Votre adresse est déjà confirmée.', emailVerifie: true };
  await envoyerLien(compte);
  return { message: `Un nouveau lien vient de partir à ${compte.email}.`, emailVerifie: false };
}
