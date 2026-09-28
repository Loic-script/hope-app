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

const enProduction = optionnel('NODE_ENV', 'development') === 'production';

/*
 * La base : une adresse complete (DATABASE_URL, celle que fournit un
 * hebergeur comme Railway), ou ses morceaux (DB_HOST, DB_NAME...). L'une
 * ou les autres ; l'adresse l'emporte si les deux sont la.
 */
const adresseBase = optionnel('DATABASE_URL', '');

function morceauBase(nom) {
  return adresseBase ? optionnel(nom, '') : requis(nom);
}

/*
 * Le secret JWT signe toutes les sessions. En production, un secret
 * court ou reste a sa valeur d'exemple se devine : on refuse de demarrer.
 */
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
    // Une base jointe par Internet (et non par le reseau prive de
    // l'hebergeur) exige souvent le chiffrement : DB_SSL=true.
    ssl: optionnel('DB_SSL', 'false') === 'true',
  },

  /*
   * Le frontend construit (frontend/dist), servi par ce meme serveur : un
   * seul service a heberger, une seule adresse, pas de CORS entre les
   * deux. Actif si le dossier existe ; SERVIR_FRONTEND=false le coupe.
   */
  servirFrontend: optionnel('SERVIR_FRONTEND', 'true') !== 'false',

  jwt: {
    secret: secretJwt(),
    expiresIn: optionnel('JWT_EXPIRES_IN', '2h'),
  },

  /*
   * Les coordonnees de l'equipe, montrees dans un fil d'assistance.
   * Facultatives : rien n'est invente -- seules celles renseignees
   * s'affichent.
   */
  /*
   * La surveillance : l'adresse qui recoit les alertes d'erreur du
   * serveur en production (a defaut, celle de l'equipe).
   */
  surveillance: {
    alerteEmail: optionnel('ALERTE_EMAIL', ''),
  },

  equipe: {
    email: optionnel('EQUIPE_EMAIL', ''),
    telephone: optionnel('EQUIPE_TELEPHONE', ''),
    siteWeb: optionnel('EQUIPE_SITE', ''),
  },

  /*
   * Le compte MVola de HOPE, ou les donateurs envoient leur don. Ce
   * numero est public -- on le donne a qui veut payer --, mais il
   * change d'une installation a l'autre : il vit dans .env. Vide, la
   * page de paiement MVola le dit et n'accepte rien.
   */
  mvola: {
    numero: optionnel('HOPE_MVOLA_NUMERO', ''),
    titulaire: optionnel('HOPE_MVOLA_TITULAIRE', 'HOPE Madagascar'),
  },
  /*
   * Le compte bancaire de HOPE, pour les virements et les depots. Rien
   * de secret : ce sont les coordonnees qu'on donne a qui veut payer.
   * RIB malgache : 23 chiffres (banque 5, guichet 5, compte 11, cle 2).
   */
  banque: {
    nom: optionnel('HOPE_BANQUE_NOM', ''),
    agence: optionnel('HOPE_BANQUE_AGENCE', ''),
    titulaire: optionnel('HOPE_BANQUE_TITULAIRE', 'HOPE Madagascar'),
    rib: optionnel('HOPE_BANQUE_RIB', ''),
    iban: optionnel('HOPE_BANQUE_IBAN', ''),
    bic: optionnel('HOPE_BANQUE_BIC', ''),
    adresse: optionnel('HOPE_BANQUE_ADRESSE', ''),
  },
  // Le bureau de HOPE, ou l'on remet un don en especes.
  bureau: {
    adresse: optionnel('HOPE_BUREAU_ADRESSE', ''),
    horaires: optionnel('HOPE_BUREAU_HORAIRES', ''),
  },
  /*
   * Les transferts internationaux arrivent sur MVola, Orange Money, le
   * compte bancaire, ou en especes au guichet : pour ces derniers, le
   * nom de la personne qui retire, et sa ville.
   */
  plateformes: {
    retraitNom: optionnel('HOPE_RETRAIT_NOM', ''),
    retraitVille: optionnel('HOPE_RETRAIT_VILLE', 'Antananarivo'),
  },

  // Le compte Orange Money de HOPE, sur le meme principe.
  orangeMoney: {
    numero: optionnel('HOPE_ORANGE_MONEY_NUMERO', ''),
    titulaire: optionnel('HOPE_ORANGE_MONEY_TITULAIRE', 'HOPE Madagascar'),
  },

  /*
   * Stripe : le paiement par carte, le seul moyen encaisse en ligne.
   *
   * La cle secrete parle a Stripe au nom de HOPE : elle ne quitte jamais
   * le serveur. La cle publique, elle, est faite pour le navigateur --
   * elle ne permet que d'ouvrir le cadre de saisie de Stripe. Le secret
   * du webhook signe les messages que Stripe nous renvoie : sans lui,
   * n'importe qui pourrait annoncer un paiement.
   *
   * Sans ces cles, la page carte le dit et n'encaisse rien -- comme un
   * numero MVola absent.
   */
  stripe: {
    cleSecrete: optionnel('STRIPE_SECRET_KEY', ''),
    clePublique: optionnel('STRIPE_PUBLISHABLE_KEY', ''),
    secretWebhook: optionnel('STRIPE_WEBHOOK_SECRET', ''),
  },

  /*
   * L'adresse publique du site, ou Stripe ramene le donateur apres un
   * paiement qui demande une confirmation de sa banque (3-D Secure).
   */
  siteUrl: optionnel('HOPE_SITE_URL', 'http://localhost:5173'),

  /*
   * L'envoi des courriels (mot de passe oublie...). Vide : en
   * developpement, le courriel s'ecrit dans le journal du serveur.
   */
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
