import 'dotenv/config';

/**
 * Chargement et validation des variables d'environnement.
 *
 * Regle de securite : aucun identifiant de connexion n'est ecrit en dur dans
 * le code. Tout passe par le fichier .env (non versionne).
 */

export type NodeEnv = 'development' | 'test' | 'production';
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

const LOG_LEVELS: readonly LogLevel[] = ['debug', 'info', 'warn', 'error', 'silent'];

function readRequired(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === '') {
    throw new Error(
      `Variable d'environnement manquante : ${name}. ` +
        `Copiez .env.example vers .env puis renseignez cette valeur.`,
    );
  }
  return value.trim();
}

function readOptional(name: string, fallback: string): string {
  const value = process.env[name];
  return value && value.trim() !== '' ? value.trim() : fallback;
}

const nodeEnv = readOptional('NODE_ENV', 'development') as NodeEnv;
const isTest = nodeEnv === 'test';

/**
 * En mode test on bascule automatiquement sur la base dediee afin de ne
 * jamais ecraser les donnees de developpement.
 */
const databaseUrl = isTest
  ? readOptional('TEST_DATABASE_URL', readRequired('DATABASE_URL'))
  : readRequired('DATABASE_URL');

const rawLogLevel = readOptional('LOG_LEVEL', isTest ? 'error' : 'info') as LogLevel;
const logLevel: LogLevel = LOG_LEVELS.includes(rawLogLevel) ? rawLogLevel : 'info';

export const env = {
  nodeEnv,
  isTest,
  isProduction: nodeEnv === 'production',
  databaseUrl,
  testDatabaseUrl: readOptional('TEST_DATABASE_URL', ''),
  logLevel,
  defaultCurrency: readOptional('DEFAULT_CURRENCY', 'MGA').toUpperCase(),
  defaultPaymentProvider: readOptional('DEFAULT_PAYMENT_PROVIDER', 'MOCK').toUpperCase(),
} as const;
