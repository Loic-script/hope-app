/**
 * Ce que le site vitrine public lit de la plateforme, sans compte.
 *
 * Seulement des actualites de HOPE : leur titre, un extrait, leur date et
 * leur photo. Jamais les appels a financement (montants, budgets), ni les
 * interets des bailleurs, ni l'auteur de la publication.
 */
import { query } from '../config/database.js';
import { versListe } from '../shared/mapping.js';

const EXTRAIT = 220;

/** Les dernieres actualites, les plus recentes d'abord. */
export async function actualites(requete = {}) {
  const limite = Math.min(Math.max(Number.parseInt(requete.limite, 10) || 9, 1), 24);
  const { rows } = await query(
    `SELECT pu.id, pu.titre, LEFT(pu.corps, ${EXTRAIT + 1}) AS corps, pu.publie_le,
            COALESCE(pu.media_url, CASE WHEN p.media_type = 'PHOTO' THEN p.media_url END) AS photo_url,
            p.name AS projet_nom
       FROM publication pu
       LEFT JOIN projects p ON p.id = pu.projet_id
      WHERE pu.type = 'actualite'
      ORDER BY pu.publie_le DESC
      LIMIT $1`,
    [limite]
  );
  return {
    items: versListe(rows).map((a) => ({
      ...a,
      // Un extrait coupe a un mot entier, avec des points de suspension.
      corps:
        a.corps && a.corps.length > EXTRAIT ? `${a.corps.slice(0, EXTRAIT).replace(/\s+\S*$/, '')}…` : a.corps,
    })),
  };
}
