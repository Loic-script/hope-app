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

  /*
   * Les coordonnees de l'equipe, montrees dans un fil d'assistance.
   * Facultatives : rien n'est invente -- seules celles renseignees
   * s'affichent.
   */
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

  admin: {
    log: optionnel('ADMIN_LOG', 'AdminHope'),
    password: optionnel('ADMIN_PASSWORD', ''),
    saltRounds: Number.parseInt(optionnel('BCRYPT_SALT_ROUNDS', '12'), 10),
  },
};

export const estProduction = config.env === 'production';
