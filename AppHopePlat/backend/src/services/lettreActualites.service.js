import crypto from 'node:crypto';

import { query } from '../config/database.js';
import { config } from '../config/env.js';
import { ErreurValidation } from '../shared/errors.js';
import * as courriel from './courriel.service.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LONGUEUR_EXTRAIT = 400;

const site = () => config.siteUrl.replace(/\/$/, '');

function signature(utilisateurId) {
  return crypto.createHmac('sha256', config.jwt.secret).update(`desinscription:${utilisateurId}`).digest('base64url');
}

export function jetonDeDesinscription(utilisateurId) {
  return `${utilisateurId}.${signature(utilisateurId)}`;
}

function extrait(texte) {
  const propre = String(texte ?? '').replace(/\s+/g, ' ').trim();
  if (propre.length <= LONGUEUR_EXTRAIT) return propre;
  return `${propre.slice(0, LONGUEUR_EXTRAIT - 1).replace(/\s+\S*$/, '')}…`;
}

export async function abonner(utilisateurId, client = null) {
  await query(
    'UPDATE utilisateur SET actualites_acceptees_le = COALESCE(actualites_acceptees_le, NOW()) WHERE id = $1',
    [utilisateurId],
    client
  );
}

export async function etat(utilisateurId) {
  const { rows } = await query('SELECT actualites_acceptees_le FROM utilisateur WHERE id = $1', [utilisateurId]);
  return { actualites: Boolean(rows[0]?.actualites_acceptees_le) };
}

export async function choisir(utilisateurId, corps = {}) {
  if (typeof corps.actualites !== 'boolean') {
    throw new ErreurValidation('Indiquez si vous souhaitez recevoir les actualités.', {
      actualites: 'Oui ou non attendu',
    });
  }
  if (corps.actualites) await abonner(utilisateurId);
  else await query('UPDATE utilisateur SET actualites_acceptees_le = NULL WHERE id = $1', [utilisateurId]);
  return {
    actualites: corps.actualites,
    message: corps.actualites
      ? 'C’est noté : vous recevrez les actualités de HOPE par courriel.'
      : 'C’est noté : vous ne recevrez plus les actualités de HOPE par courriel.',
  };
}

export async function desinscrire(corps = {}) {
  const [utilisateurId = '', signe = ''] = String(corps.jeton ?? '').trim().split('.');
  const attendu = UUID.test(utilisateurId) ? Buffer.from(signature(utilisateurId)) : null;
  const recu = Buffer.from(signe);
  if (!attendu || attendu.length !== recu.length || !crypto.timingSafeEqual(attendu, recu)) {
    throw new ErreurValidation('Ce lien de désinscription n’est pas valable. Vous pouvez aussi vous désinscrire depuis votre espace.', {
      jeton: 'Lien invalide',
    });
  }
  await query('UPDATE utilisateur SET actualites_acceptees_le = NULL WHERE id = $1', [utilisateurId]);
  return { message: 'C’est fait : vous ne recevrez plus les actualités de HOPE par courriel.' };
}

export async function envoyerActualite(publicationId) {
  try {
    const { rows } = await query(
      `SELECT id, titre, corps, media_url FROM publication WHERE id = $1 AND type = 'actualite'`,
      [publicationId]
    );
    const actualite = rows[0];
    if (!actualite) return 0;
    const abonnes = await query(
      `SELECT id, email FROM utilisateur
        WHERE actualites_acceptees_le IS NOT NULL AND statut = 'actif' AND email_verifie_le IS NOT NULL
        ORDER BY actualites_acceptees_le`
    );

    let envoyes = 0;
    for (const abonne of abonnes.rows) {
      const jeton = encodeURIComponent(jetonDeDesinscription(abonne.id));
      const parti = await courriel.envoyer({
        a: abonne.email,
        sujet: `HOPE — ${actualite.titre}`,
        titre: actualite.titre,
        image: actualite.media_url ? { src: `${site()}${actualite.media_url}`, alt: actualite.titre } : null,
        paragraphes: [extrait(actualite.corps) || 'Une nouvelle actualité de HOPE vous attend sur le site.'],
        bouton: { texte: 'Lire l’actualité', lien: `${site()}/actualites/${actualite.id}` },
        desinscription: {
          page: `${site()}/se-desinscrire?jeton=${jeton}`,
          api: `${site()}/api/public/actualites/desinscription?jeton=${jeton}`,
        },
      });
      if (parti) envoyes += 1;
    }
    return envoyes;
  } catch (erreur) {
    console.error('[HOPE] Actualite non envoyee aux abonnes :', erreur.message);
    return 0;
  }
}
