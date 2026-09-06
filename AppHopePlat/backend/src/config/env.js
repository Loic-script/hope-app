/**
 * Chargement et validation des variables d'environnement.
 *
 * Toute la configuration sensible (mot de passe PostgreSQL, secret JWT) vit
 * uniquement ici, cote backend. Rien n'est ecrit en dur dans le code.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const dossierCourant = path.dirname(fileURLToPath(import.meta.url));
// backend/src/config -> backend/.env
const cheminEnv = path.resolve(dossierCourant, '..', '..', '.env');

dotenv.config({ path: cheminEnv, quiet: true });

/**
 * Lit une variable obligatoire et arrete le processus si elle est absente.
 * Mieux vaut echouer au demarrage que servir des requetes mal configurees.
 */
function requis(nom) {
  const valeur = process.env[nom];
  if (valeur === undefined || valeur === '') {
    console.error(
      `[HOPE] Variable d'environnement manquante : ${nom}\n` +
        `       Verifiez le fichier ${cheminEnv} (modele : .env.example).`
    );
    process.exit(1);
  }
  return valeur;
}

/** Lit une variable optionnelle avec une valeur par defaut. */
function optionnel(nom, defaut) {
  const valeur = process.env[nom];
  return valeur === undefined || valeur === '' ? defaut : valeur;
}

export const config = {
  env: optionnel('NODE_ENV', 'development'),
  port: Number.parseInt(optionnel('PORT', '3000'), 10),
  corsOrigin: optionnel('CORS_ORIGIN', 'http://localhost:5173'),

  database: {
    host: requis('DB_HOST'),
    port: Number.parseInt(optionnel('DB_PORT', '5432'), 10),
    name: requis('DB_NAME'),
    user: requis('DB_USER'),
    password: requis('DB_PASSWORD'),
  },

  jwt: {
    secret: requis('JWT_SECRET'),
    expiresIn: optionnel('JWT_EXPIRES_IN', '2h'),
  },

  admin: {
    log: optionnel('ADMIN_LOG', 'AdminHope'),
    password: optionnel('ADMIN_PASSWORD', ''),
    saltRounds: Number.parseInt(optionnel('BCRYPT_SALT_ROUNDS', '12'), 10),
  },
};

export const estProduction = config.env === 'production';
