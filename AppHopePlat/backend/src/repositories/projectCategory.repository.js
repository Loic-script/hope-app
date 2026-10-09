import { query } from '../config/database.js';
import { versListe, versObjet } from '../shared/mapping.js';

export async function lister(client = null) {
  const resultat = await query(
    `SELECT c.id, c.name, c.description, c.created_at, c.updated_at,
            COUNT(p.id)::int AS projects_count
       FROM project_categories c
       LEFT JOIN projects p ON p.category_id = c.id AND p.status <> 'ARCHIVED'
      GROUP BY c.id
      ORDER BY c.name`,
    [],
    client
  );
  return versListe(resultat.rows);
}

export async function trouverParId(id, client = null) {
  const resultat = await query('SELECT * FROM project_categories WHERE id = $1', [id], client);
  return versObjet(resultat.rows[0]);
}

export async function creer({ name, description }, client = null) {
  const resultat = await query(
    `INSERT INTO project_categories (name, description)
     VALUES ($1, $2)
     RETURNING *`,
    [name, description],
    client
  );
  return versObjet(resultat.rows[0]);
}

export async function creerSiAbsente({ name, description }, client = null) {
  const resultat = await query(
    `INSERT INTO project_categories (name, description)
     VALUES ($1, $2)
     ON CONFLICT (name) DO NOTHING
     RETURNING *`,
    [name, description],
    client
  );
  if (resultat.rows[0]) return versObjet(resultat.rows[0]);

  const existante = await query('SELECT * FROM project_categories WHERE name = $1', [name], client);
  return versObjet(existante.rows[0]);
}

export async function trouverOuCreerParNom(nom, client = null) {
  const propre = String(nom).trim().replace(/\s+/g, ' ');
  const existante = await query(
    'SELECT * FROM project_categories WHERE LOWER(name) = LOWER($1) LIMIT 1',
    [propre],
    client
  );
  if (existante.rows[0]) return versObjet(existante.rows[0]);
  return creerSiAbsente({ name: propre, description: null }, client);
}
