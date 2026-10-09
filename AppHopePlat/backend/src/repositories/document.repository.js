import { query } from '../config/database.js';
import { versListe, versObjet } from '../shared/mapping.js';

const COLONNES = `
  s.id, s.expense_id, s.admin_id, s.document_type, s.file_name, s.file_path,
  s.mime_type, s.file_size, s.reference, s.issued_at, s.created_at, s.updated_at,
  a.full_name AS author_name,
  a.admin_log AS author_log,
  e.description AS expense_description,
  e.amount      AS expense_amount,
  e.currency    AS expense_currency,
  e.expense_date,
  p.id          AS project_id,
  p.name        AS project_name
`;

const JOINTURES = `
  JOIN expenses e ON e.id = s.expense_id
  JOIN projects p ON p.id = e.project_id
  LEFT JOIN admins a ON a.id = s.admin_id
`;

export async function lister(filtres = {}, client = null) {
  const conditions = [];
  const valeurs = [];

  if (filtres.projectId) {
    valeurs.push(filtres.projectId);
    conditions.push(`p.id = $${valeurs.length}`);
  }
  if (filtres.expenseId) {
    valeurs.push(filtres.expenseId);
    conditions.push(`s.expense_id = $${valeurs.length}`);
  }
  if (filtres.type) {
    valeurs.push(filtres.type);
    conditions.push(`s.document_type = $${valeurs.length}`);
  }
  if (filtres.recherche) {
    valeurs.push(`%${filtres.recherche}%`);
    conditions.push(`(s.file_name ILIKE $${valeurs.length}
                      OR s.reference ILIKE $${valeurs.length}
                      OR e.description ILIKE $${valeurs.length}
                      OR p.name ILIKE $${valeurs.length})`);
  }

  const ou = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const resultat = await query(
    `SELECT ${COLONNES} FROM supporting_documents s ${JOINTURES} ${ou}
      ORDER BY s.created_at DESC, s.id DESC LIMIT 300`,
    valeurs,
    client
  );
  return versListe(resultat.rows);
}

export async function listerParDepense(expenseId, client = null) {
  return lister({ expenseId }, client);
}

export async function trouverParId(id, client = null) {
  const resultat = await query(
    `SELECT ${COLONNES} FROM supporting_documents s ${JOINTURES} WHERE s.id = $1`,
    [id],
    client
  );
  return versObjet(resultat.rows[0]);
}

export async function creer(donnees, client = null) {
  const resultat = await query(
    `INSERT INTO supporting_documents
       (expense_id, admin_id, document_type, file_name, file_path, mime_type, file_size,
        reference, issued_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id`,
    [
      donnees.expenseId,
      donnees.adminId ?? null,
      donnees.documentType,
      donnees.fileName,
      donnees.filePath,
      donnees.mimeType,
      donnees.fileSize,
      donnees.reference,
      donnees.issuedAt,
    ],
    client
  );
  return trouverParId(resultat.rows[0].id, client);
}

export async function supprimer(id, client = null) {
  const resultat = await query(
    'DELETE FROM supporting_documents WHERE id = $1 RETURNING file_path',
    [id],
    client
  );
  return resultat.rows[0]?.file_path ?? null;
}
