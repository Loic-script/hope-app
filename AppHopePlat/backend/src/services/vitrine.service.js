import { query } from '../config/database.js';
import { ErreurIntrouvable } from '../shared/errors.js';
import { versListe, versObjet } from '../shared/mapping.js';

const EXTRAIT = 220;

function extrait(texte) {
  if (!texte || texte.length <= EXTRAIT) return texte;
  return `${texte.slice(0, EXTRAIT).replace(/\s+\S*$/, '')}…`;
}

function borner(valeur, defaut, maximum) {
  return Math.min(Math.max(Number.parseInt(valeur, 10) || defaut, 1), maximum);
}

const PROJETS_VISIBLES = `p.project_type = 'HOPE' AND p.status <> 'ARCHIVED'`;

const COLONNES_ACTUALITE = `
  pu.id, pu.titre, pu.publie_le,
  COALESCE(pu.media_url, CASE WHEN p.media_type = 'PHOTO' THEN p.media_url END) AS photo_url,
  CASE WHEN ${PROJETS_VISIBLES} THEN p.id   END AS projet_id,
  CASE WHEN ${PROJETS_VISIBLES} THEN p.name END AS projet_nom`;

const DE_ACTUALITES = `FROM publication pu LEFT JOIN projects p ON p.id = pu.projet_id`;

export async function actualites(requete = {}) {
  const { rows } = await query(
    `SELECT ${COLONNES_ACTUALITE}, LEFT(pu.corps, ${EXTRAIT + 1}) AS corps
       ${DE_ACTUALITES}
      WHERE pu.type = 'actualite'
      ORDER BY pu.publie_le DESC
      LIMIT $1`,
    [borner(requete.limite, 9, 60)]
  );
  return { items: versListe(rows).map((a) => ({ ...a, corps: extrait(a.corps) })) };
}

export async function actualite(id) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(id).trim())) {
    throw new ErreurIntrouvable("L'actualite", id);
  }
  const { rows } = await query(
    `SELECT ${COLONNES_ACTUALITE}, pu.corps ${DE_ACTUALITES} WHERE pu.id = $1 AND pu.type = 'actualite'`,
    [String(id).trim()]
  );
  if (!rows[0]) throw new ErreurIntrouvable("L'actualite", id);
  return versObjet(rows[0]);
}

export async function actualitesPourPlan() {
  const { rows } = await query(`SELECT id, publie_le FROM publication WHERE type = 'actualite' ORDER BY publie_le DESC`);
  return versListe(rows);
}

const COLONNES_PROJET = `
  p.id, p.name, p.description_titre, p.location, p.status,
  p.start_date, p.completed_at, p.updated_at,
  CASE WHEN p.media_type = 'PHOTO' THEN p.media_url END AS photo_url,
  c.name AS categorie`;

const DE_PROJETS = `FROM projects p LEFT JOIN project_categories c ON c.id = p.category_id`;

export async function projets(requete = {}) {
  const valeurs = [borner(requete.limite, 24, 60)];
  let filtre = '';
  const recherche = String(requete.recherche ?? '').trim().slice(0, 80);
  if (recherche) {
    valeurs.push(`%${recherche}%`);
    filtre = ` AND (p.name ILIKE $2 OR p.location ILIKE $2 OR c.name ILIKE $2)`;
  }
  const { rows } = await query(
    `SELECT ${COLONNES_PROJET}, LEFT(p.description, ${EXTRAIT + 1}) AS description
       ${DE_PROJETS}
      WHERE ${PROJETS_VISIBLES}${filtre}
      ORDER BY p.created_at DESC, p.id DESC
      LIMIT $1`,
    valeurs
  );
  return { items: versListe(rows).map((p) => ({ ...p, description: extrait(p.description) })) };
}

export async function projet(id) {
  if (!/^\d{1,9}$/.test(String(id).trim())) throw new ErreurIntrouvable('Le projet', id);
  const { rows } = await query(
    `SELECT ${COLONNES_PROJET}, p.description, p.outcome
       ${DE_PROJETS}
      WHERE p.id = $1 AND ${PROJETS_VISIBLES}`,
    [Number.parseInt(id, 10)]
  );
  if (!rows[0]) throw new ErreurIntrouvable('Le projet', id);
  return versObjet(rows[0]);
}

export async function projetsPourPlan() {
  const { rows } = await query(`SELECT p.id, p.updated_at FROM projects p WHERE ${PROJETS_VISIBLES} ORDER BY p.id`);
  return versListe(rows);
}

export async function benevoles() {
  const { rows } = await query(
    `SELECT b.id, u.prenom, u.photo_url
       FROM benevole b
       JOIN utilisateur u ON u.id = b.utilisateur_id
      WHERE NOT b.masque_site AND u.statut = 'actif' AND TRIM(u.prenom) <> ''
      ORDER BY b.benevole_depuis, u.prenom
      LIMIT 24`
  );
  return { items: versListe(rows) };
}
