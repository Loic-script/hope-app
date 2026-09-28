/**
 * Les reactions aux actualites de HOPE, dans les accueils des espaces
 * (donateur, benevole, bailleur) : « J'aime » et « Commenter ».
 *
 *   - un J'aime par personne et par publication, qu'on peut retirer ; le
 *     nombre se voit de tous ;
 *   - un commentaire n'est lu que par l'equipe HOPE (page Actualites de
 *     l'administration) : ni les autres utilisateurs, ni son auteur ne le
 *     revoient dans le fil. C'est un mot adresse a l'association, pas un
 *     debat public.
 */
import { query } from '../config/database.js';
import { ErreurIntrouvable, ErreurValidation } from '../shared/errors.js';
import { versListe } from '../shared/mapping.js';
import { texteRequis } from '../shared/validation.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ESPACES = { 'hope-donateur': 'donateur', 'hope-benevole': 'benevole', 'hope-bailleur': 'bailleur' };

function idPublication(id) {
  const texte = String(id ?? '').trim();
  if (!UUID.test(texte)) throw new ErreurValidation('Publication inconnue.', { id: 'Identifiant invalide' });
  return texte;
}

async function exigerPublication(id) {
  const { rows } = await query('SELECT id FROM publication WHERE id = $1', [id]);
  if (!rows[0]) throw new ErreurIntrouvable('La publication', id);
}

/**
 * L'etat des reactions de plusieurs publications : leur nombre de J'aime,
 * et si la personne connectee a aime.
 * @param {string} utilisateurId
 * @param {string} ids liste separee par des virgules
 */
export async function etat(utilisateurId, ids) {
  const liste = String(ids ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter((id) => UUID.test(id))
    .slice(0, 100);
  if (liste.length === 0) return { items: {} };
  const { rows } = await query(
    `SELECT p.id,
            (SELECT COUNT(*)::int FROM publication_jaime j WHERE j.publication_id = p.id) AS jaimes,
            EXISTS (SELECT 1 FROM publication_jaime j WHERE j.publication_id = p.id AND j.utilisateur_id = $2) AS jaime
       FROM publication p WHERE p.id = ANY($1::uuid[])`,
    [liste, utilisateurId]
  );
  return { items: Object.fromEntries(rows.map((r) => [r.id, { jaimes: r.jaimes, jaime: r.jaime }])) };
}

/** Aimer, ou ne plus aimer. */
export async function basculerJaime(utilisateurId, id) {
  const publicationId = idPublication(id);
  await exigerPublication(publicationId);
  const retire = await query(
    'DELETE FROM publication_jaime WHERE publication_id = $1 AND utilisateur_id = $2',
    [publicationId, utilisateurId]
  );
  if (retire.rowCount === 0) {
    await query(
      'INSERT INTO publication_jaime (publication_id, utilisateur_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [publicationId, utilisateurId]
    );
  }
  const { rows } = await query('SELECT COUNT(*)::int AS n FROM publication_jaime WHERE publication_id = $1', [
    publicationId,
  ]);
  return { jaime: retire.rowCount === 0, jaimes: rows[0].n };
}

/** Un commentaire, pour l'equipe seulement. */
export async function commenter(utilisateurId, audience, id, corps = {}) {
  const publicationId = idPublication(id);
  const texte = texteRequis(corps.texte, 'texte', { max: 1000 });
  await exigerPublication(publicationId);
  await query(
    'INSERT INTO publication_commentaire (publication_id, utilisateur_id, espace, texte) VALUES ($1, $2, $3, $4)',
    [publicationId, utilisateurId, ESPACES[audience] ?? null, texte]
  );
  return { message: 'Merci ! Votre commentaire a été transmis à l’équipe HOPE.' };
}

/* ---------------------------- Cote equipe ---------------------------- */

/** Les chiffres de chaque publication, pour la liste de l'administration. */
export async function chiffresParPublication() {
  const { rows } = await query(
    `SELECT p.id,
            (SELECT COUNT(*)::int FROM publication_jaime j WHERE j.publication_id = p.id) AS jaimes,
            (SELECT COUNT(*)::int FROM publication_commentaire c WHERE c.publication_id = p.id) AS commentaires,
            (SELECT COUNT(*)::int FROM publication_commentaire c WHERE c.publication_id = p.id AND c.lu_le IS NULL) AS non_lus
       FROM publication p`
  );
  return new Map(rows.map((r) => [r.id, { jaimes: r.jaimes, commentaires: r.commentaires, commentairesNonLus: r.non_lus }]));
}

/** Les commentaires d'une publication ; les lire les marque comme lus. */
export async function commentaires(id) {
  const publicationId = idPublication(id);
  await exigerPublication(publicationId);
  const { rows } = await query(
    `SELECT c.id, c.texte, c.espace, c.cree_le, c.lu_le,
            NULLIF(TRIM(CONCAT_WS(' ', u.prenom, u.nom)), '') AS auteur, u.email AS auteur_email, u.id AS auteur_id
       FROM publication_commentaire c
       LEFT JOIN utilisateur u ON u.id = c.utilisateur_id
      WHERE c.publication_id = $1
      ORDER BY c.cree_le DESC`,
    [publicationId]
  );
  await query('UPDATE publication_commentaire SET lu_le = NOW() WHERE publication_id = $1 AND lu_le IS NULL', [
    publicationId,
  ]);
  return { items: versListe(rows) };
}
