import crypto from 'node:crypto';
import bcrypt from 'bcrypt';

import { config } from '../config/env.js';
import { query } from '../config/database.js';
import { ErreurIntrouvable, ErreurRegleMetier, ErreurValidation } from '../shared/errors.js';
import { identifiantRequis, texteRequis, valeurParmi } from '../shared/validation.js';
import * as courriel from './courriel.service.js';
import { fermerSessionsAdmin } from './session.service.js';

export const ROLES_BACKOFFICE = { admin: 'GESTIONNAIRE', manager: 'MANAGER' };
export const LIBELLES_BACKOFFICE = { GESTIONNAIRE: 'Admin', MANAGER: 'Manager' };

const COURRIEL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function motDePasseGenere() {
  const lettres = 'abcdefghijkmnpqrstuvwxyz';
  const majuscules = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const chiffres = '23456789';
  const signes = '!#$%&*+-?@';
  const tous = lettres + majuscules + chiffres + signes;
  const tirer = (alphabet) => alphabet[crypto.randomInt(alphabet.length)];
  const caracteres = [tirer(lettres), tirer(majuscules), tirer(chiffres), tirer(signes)];
  while (caracteres.length < 14) caracteres.push(tirer(tous));
  for (let i = caracteres.length - 1; i > 0; i -= 1) {
    const j = crypto.randomInt(i + 1);
    [caracteres[i], caracteres[j]] = [caracteres[j], caracteres[i]];
  }
  return caracteres.join('');
}

function versCompte(ligne) {
  if (!ligne) return null;
  return {
    id: ligne.id,
    fullName: ligne.full_name,
    email: ligne.email ?? ligne.admin_log,
    role: ligne.role,
    roleLabel: LIBELLES_BACKOFFICE[ligne.role] ?? ligne.role,
    status: ligne.status,
    lastLoginAt: ligne.last_login_at,
    createdAt: ligne.created_at,
  };
}

const COLONNES = 'id, admin_log, email, full_name, role, status, last_login_at, created_at';

function lienDeConnexion(email) {
  return `${config.siteUrl.replace(/\/$/, '')}/admin/login?identifiant=${encodeURIComponent(email)}`;
}

async function envoyerAcces(compte, motDePasse, { renouvellement = false } = {}) {
  const role = LIBELLES_BACKOFFICE[compte.role] ?? compte.role;
  return courriel.envoyer({
    a: compte.email,
    sujet: renouvellement ? 'HOPE — votre nouveau mot de passe back office' : 'HOPE — votre accès au back office',
    titre: `Bonjour${compte.fullName ? ` ${compte.fullName}` : ''},`,
    paragraphes: [
      renouvellement
        ? 'Un nouveau mot de passe vient d’être créé pour votre compte back office HOPE. L’ancien ne fonctionne plus.'
        : `Un compte back office HOPE vient d’être créé pour vous, avec le rôle « ${role} ».`,
      compte.role === 'MANAGER'
        ? 'Vous pourrez consulter l’espace et créer ou modifier les projets.'
        : 'Vous pourrez gérer les comptes des donateurs, bénévoles et bailleurs, et suivre les projets.',
      `Identifiant : ${compte.email}`,
      `Mot de passe : ${motDePasse}`,
      'Par sécurité, changez ce mot de passe dès votre première connexion (Paramètres → Changer mon mot de passe).',
    ],
    bouton: { texte: 'Accéder à mon espace', lien: lienDeConnexion(compte.email) },
    note: 'Vous n’attendiez pas ce message ? Ignorez-le et prévenez l’équipe HOPE.',
  });
}

export async function lister() {
  const { rows } = await query(
    `SELECT ${COLONNES} FROM admins WHERE role = ANY($1) ORDER BY created_at DESC, id DESC`,
    [Object.values(ROLES_BACKOFFICE)]
  );
  return { items: rows.map(versCompte), roles: LIBELLES_BACKOFFICE };
}

export async function creer(corps = {}) {
  const fullName = texteRequis(corps.fullName, 'fullName', { max: 160 });
  const email = String(corps.email ?? '').trim().toLowerCase();
  if (!COURRIEL.test(email) || email.length > 200) {
    throw new ErreurValidation('Indiquez une adresse électronique valide.', { email: 'Adresse invalide' });
  }
  const choix = valeurParmi(corps.role, 'role', ['ADMIN', 'MANAGER']);
  const role = choix === 'ADMIN' ? ROLES_BACKOFFICE.admin : ROLES_BACKOFFICE.manager;

  const { rows: pris } = await query('SELECT 1 FROM admins WHERE admin_log = $1 OR email = $1 LIMIT 1', [email]);
  if (pris.length > 0) {
    throw new ErreurRegleMetier('Un compte de l’équipe utilise déjà cette adresse.', 'ADRESSE_DEJA_PRISE');
  }

  const motDePasse = motDePasseGenere();
  const hash = await bcrypt.hash(motDePasse, config.admin.saltRounds);
  const { rows } = await query(
    `INSERT INTO admins (admin_log, email, password_hash, full_name, role)
     VALUES ($1, $1, $2, $3, $4)
     RETURNING ${COLONNES}`,
    [email, hash, fullName, role]
  );
  const compte = versCompte(rows[0]);
  const envoye = await envoyerAcces(compte, motDePasse);

  return {
    compte,
    courrielEnvoye: envoye,
    ...(envoye ? {} : { motDePasseProvisoire: motDePasse }),
    message: envoye
      ? `Le compte est créé : ses accès viennent de partir à ${email}.`
      : 'Le compte est créé, mais le courriel n’a pas pu partir : transmettez ce mot de passe à la personne.',
  };
}

async function trouver(id) {
  const adminId = identifiantRequis(id, 'id');
  const { rows } = await query(`SELECT ${COLONNES} FROM admins WHERE id = $1 AND role = ANY($2)`, [
    adminId,
    Object.values(ROLES_BACKOFFICE),
  ]);
  if (!rows[0]) throw new ErreurIntrouvable('Le compte back office', adminId);
  return versCompte(rows[0]);
}

export async function modifier(id, corps = {}) {
  const compte = await trouver(id);
  const role =
    corps.role !== undefined
      ? valeurParmi(corps.role, 'role', ['ADMIN', 'MANAGER']) === 'ADMIN'
        ? ROLES_BACKOFFICE.admin
        : ROLES_BACKOFFICE.manager
      : null;
  const status = corps.status !== undefined ? valeurParmi(corps.status, 'status', ['ACTIVE', 'SUSPENDED']) : null;
  const { rows } = await query(
    `UPDATE admins SET role = COALESCE($2, role), status = COALESCE($3, status) WHERE id = $1 RETURNING ${COLONNES}`,
    [compte.id, role, status]
  );
  if ((role && role !== compte.role) || status === 'SUSPENDED') await fermerSessionsAdmin(compte.id);
  return versCompte(rows[0]);
}

export async function renouvelerAcces(id) {
  const compte = await trouver(id);
  const motDePasse = motDePasseGenere();
  await query('UPDATE admins SET password_hash = $2 WHERE id = $1', [
    compte.id,
    await bcrypt.hash(motDePasse, config.admin.saltRounds),
  ]);
  await fermerSessionsAdmin(compte.id);
  const envoye = await envoyerAcces(compte, motDePasse, { renouvellement: true });
  return {
    courrielEnvoye: envoye,
    ...(envoye ? {} : { motDePasseProvisoire: motDePasse }),
    message: envoye
      ? `Un nouveau mot de passe vient de partir à ${compte.email}.`
      : 'Le courriel n’a pas pu partir : transmettez ce nouveau mot de passe à la personne.',
  };
}
