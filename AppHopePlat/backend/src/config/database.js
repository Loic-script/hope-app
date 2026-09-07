/**
 * Pool de connexions PostgreSQL.
 *
 * Un seul pool est partage par toute l'application : les repositories passent
 * par ce module et ne construisent jamais leur propre connexion.
 */
import pg from 'pg';
import { config } from './env.js';

const { Pool } = pg;

/**
 * Une colonne DATE est un jour, pas un instant.
 *
 * Par defaut, pg la convertit en objet Date a minuit dans le fuseau du
 * serveur : "2026-09-06" repart alors en "2026-09-05T21:00:00Z" et s'affiche
 * la veille pour qui lit depuis un autre fuseau. On la laisse donc telle
 * quelle, sous forme de chaine AAAA-MM-JJ.
 *
 * 1082 est l'identifiant du type DATE dans PostgreSQL. Les colonnes
 * TIMESTAMPTZ, elles, restent converties : ce sont de vrais instants.
 */
pg.types.setTypeParser(1082, (valeur) => valeur);

export const pool = new Pool({
  host: config.database.host,
  port: config.database.port,
  database: config.database.name,
  user: config.database.user,
  password: config.database.password,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

// Une erreur sur un client inactif ne doit pas faire tomber le serveur.
pool.on('error', (erreur) => {
  console.error('[HOPE] Erreur inattendue sur le pool PostgreSQL :', erreur.message);
});

/**
 * Execute une requete SQL parametree.
 * Les parametres sont toujours passes separement ($1, $2, ...) pour eviter
 * toute injection SQL.
 *
 * @param {string} texte requete SQL
 * @param {unknown[]} parametres valeurs des placeholders
 * @param {import('pg').PoolClient|null} client client de transaction ; si
 *        absent, la requete part sur le pool en dehors de toute transaction
 */
export function query(texte, parametres = [], client = null) {
  return (client ?? pool).query(texte, parametres);
}

/**
 * Execute un bloc de travail dans une transaction.
 *
 * Indispensable des qu'un controle precede une ecriture : verifier le solde
 * d'un don puis inserer une affectation doit etre atomique, sinon deux
 * requetes simultanees pourraient depasser le montant disponible.
 *
 * @param {(client: import('pg').PoolClient) => Promise<T>} travail
 * @returns {Promise<T>}
 * @template T
 */
export async function transaction(travail) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const resultat = await travail(client);
    await client.query('COMMIT');
    return resultat;
  } catch (erreur) {
    await client.query('ROLLBACK');
    throw erreur;
  } finally {
    client.release();
  }
}

/** Verifie que la base repond. Utilise au demarrage du serveur. */
export async function verifierConnexion() {
  const resultat = await pool.query('SELECT current_database() AS base, version() AS version');
  return resultat.rows[0];
}

/** Ferme proprement le pool (arret du serveur, fin d'un script). */
export function fermerPool() {
  return pool.end();
}
