import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const dossierCourant = path.dirname(fileURLToPath(import.meta.url));
const cheminEnv = path.resolve(dossierCourant, '..', '..', '.env');

dotenv.config({ path: cheminEnv, quiet: true });

function requis(nom, conseil) {
  const valeur = process.env[nom];
  if (valeur === undefined || valeur === '') {
    const ou =
      conseil ??
      `Chez l'hebergeur : les variables du service (Railway : onglet Variables). En local : ${cheminEnv} (modele : .env.example).`;
    console.error(`[HOPE] Variable d'environnement manquante : ${nom}\n       ${ou}`);
    process.exit(1);
  }
  return valeur;
}

function optionnel(nom, defaut) {
  const valeur = process.env[nom];
  return valeur === undefined || valeur === '' ? defaut : valeur;
}

const enProduction = optionnel('NODE_ENV', 'development') === 'production';

const adresseBase = optionnel('DATABASE_URL', '');

const CONSEIL_BASE =
  'Aucune base configuree : DATABASE_URL est absente. Sur Railway, ajouter DATABASE_URL = ' +
  '${{Postgres.DATABASE_URL}} dans les variables du service ; en local, DB_HOST, DB_NAME, ' +
  'DB_USER et DB_PASSWORD dans backend/.env.';

function morceauBase(nom) {
  return adresseBase ? optionnel(nom, '') : requis(nom, CONSEIL_BASE);
}

function secretJwt() {
  const secret = requis('JWT_SECRET');
  if (enProduction && (secret.length < 32 || /change|exemple|secret/i.test(secret))) {
    console.error(
      '[HOPE] JWT_SECRET trop faible pour la production : 32 caracteres aleatoires au moins.\n' +
        "       node -e \"console.log(require('crypto').randomBytes(48).toString('hex'))\""
    );
    process.exit(1);
  }
  return secret;
}

export const config = {
  env: optionnel('NODE_ENV', 'development'),
  enProduction,
  port: Number.parseInt(optionnel('PORT', '3000'), 10),
  corsOrigin: optionnel('CORS_ORIGIN', 'http://localhost:5173'),

  database: {
    url: adresseBase,
    host: morceauBase('DB_HOST'),
    port: Number.parseInt(optionnel('DB_PORT', '5432'), 10),
    name: morceauBase('DB_NAME'),
    user: morceauBase('DB_USER'),
    password: morceauBase('DB_PASSWORD'),
    ssl: optionnel('DB_SSL', 'false') === 'true',
  },

  servirFrontend: optionnel('SERVIR_FRONTEND', 'true') !== 'false',

  jwt: {
    secret: secretJwt(),
    expiresIn: optionnel('JWT_EXPIRES_IN', '2h'),
  },

  surveillance: {
    alerteEmail: optionnel('ALERTE_EMAIL', ''),
  },

  equipe: {
    email: optionnel('EQUIPE_EMAIL', ''),
    telephone: optionnel('EQUIPE_TELEPHONE', ''),
    siteWeb: optionnel('EQUIPE_SITE', ''),
  },

  mvola: {
    numero: optionnel('HOPE_MVOLA_NUMERO', ''),
    titulaire: optionnel('HOPE_MVOLA_TITULAIRE', 'HOPE Madagascar'),
  },
  banque: {
    nom: optionnel('HOPE_BANQUE_NOM', ''),
    agence: optionnel('HOPE_BANQUE_AGENCE', ''),
    titulaire: optionnel('HOPE_BANQUE_TITULAIRE', 'HOPE Madagascar'),
    rib: optionnel('HOPE_BANQUE_RIB', ''),
    iban: optionnel('HOPE_BANQUE_IBAN', ''),
    bic: optionnel('HOPE_BANQUE_BIC', ''),
    adresse: optionnel('HOPE_BANQUE_ADRESSE', ''),
  },
  bureau: {
    adresse: optionnel('HOPE_BUREAU_ADRESSE', ''),
    horaires: optionnel('HOPE_BUREAU_HORAIRES', ''),
  },
  plateformes: {
    retraitNom: optionnel('HOPE_RETRAIT_NOM', ''),
    retraitVille: optionnel('HOPE_RETRAIT_VILLE', 'Antananarivo'),
  },

  orangeMoney: {
    numero: optionnel('HOPE_ORANGE_MONEY_NUMERO', ''),
    titulaire: optionnel('HOPE_ORANGE_MONEY_TITULAIRE', 'HOPE Madagascar'),
  },

  stripe: {
    cleSecrete: optionnel('STRIPE_SECRET_KEY', ''),
    clePublique: optionnel('STRIPE_PUBLISHABLE_KEY', ''),
    secretWebhook: optionnel('STRIPE_WEBHOOK_SECRET', ''),
  },

  siteUrl: optionnel('HOPE_SITE_URL', 'http://localhost:5173'),

  smtp: {
    host: optionnel('SMTP_HOST', ''),
    port: Number.parseInt(optionnel('SMTP_PORT', '587'), 10),
    secure: optionnel('SMTP_SECURE', 'false') === 'true',
    user: optionnel('SMTP_USER', ''),
    password: optionnel('SMTP_PASSWORD', ''),
    from: optionnel('SMTP_FROM', 'HOPE <no-reply@hope.mg>'),
  },

  admin: {
    log: optionnel('ADMIN_LOG', 'AdminHope'),
    password: optionnel('ADMIN_PASSWORD', ''),
    saltRounds: Number.parseInt(optionnel('BCRYPT_SALT_ROUNDS', '12'), 10),
  },
};

export const estProduction = config.env === 'production';
