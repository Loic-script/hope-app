import pg from 'pg';
import { config } from '../config/env.js';

const { Client } = pg;

const SQL_TABLE_ADMINS = `
  CREATE TABLE IF NOT EXISTS admins (
    id            SERIAL       PRIMARY KEY,
    admin_log     VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
  );

  -- Colonnes ajoutees apres coup : ADD COLUMN IF NOT EXISTS rend le script
  -- rejouable sur une base existante comme sur une base neuve.
  ALTER TABLE admins ADD COLUMN IF NOT EXISTS full_name     VARCHAR(160);
  ALTER TABLE admins ADD COLUMN IF NOT EXISTS role          VARCHAR(20)  NOT NULL DEFAULT 'ADMIN';
  ALTER TABLE admins ADD COLUMN IF NOT EXISTS status        VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE';
  ALTER TABLE admins ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

  -- Un compte sans nom affiche retombe sur son identifiant de connexion.
  UPDATE admins SET full_name = admin_log WHERE full_name IS NULL;

  ALTER TABLE admins DROP CONSTRAINT IF EXISTS admins_role_valide;
  ALTER TABLE admins ADD  CONSTRAINT admins_role_valide
    CHECK (role IN ('ADMIN', 'COORDINATOR', 'VIEWER', 'GESTIONNAIRE', 'MANAGER'));

  ALTER TABLE admins DROP CONSTRAINT IF EXISTS admins_status_valide;
  ALTER TABLE admins ADD  CONSTRAINT admins_status_valide
    CHECK (status IN ('ACTIVE', 'SUSPENDED'));

  COMMENT ON TABLE  admins               IS 'Comptes de l equipe HOPE';
  COMMENT ON COLUMN admins.admin_log     IS 'Identifiant de connexion, unique';
  COMMENT ON COLUMN admins.password_hash IS 'Hash bcrypt du mot de passe - jamais le mot de passe en clair';
  COMMENT ON COLUMN admins.full_name     IS 'Nom affiche sur les actions : "Njara R."';
  COMMENT ON COLUMN admins.role          IS 'ADMIN (tout) / COORDINATOR (terrain) / VIEWER (lecture seule)';
  COMMENT ON COLUMN admins.status        IS 'Un compte SUSPENDED ne peut plus se connecter';
`;

const SQL_TRIGGER_UPDATED_AT = `
  CREATE OR REPLACE FUNCTION definir_updated_at()
  RETURNS TRIGGER AS $$
  BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
  END;
  $$ LANGUAGE plpgsql;

  DROP TRIGGER IF EXISTS admins_updated_at ON admins;

  CREATE TRIGGER admins_updated_at
    BEFORE UPDATE ON admins
    FOR EACH ROW
    EXECUTE FUNCTION definir_updated_at();
`;

async function creerBaseSiNecessaire() {
  const client = new Client({
    host: config.database.host,
    port: config.database.port,
    user: config.database.user,
    password: config.database.password,
    database: 'postgres',
  });

  await client.connect();
  try {
    const existe = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [
      config.database.name,
    ]);

    if (existe.rowCount > 0) {
      console.log(`[HOPE] Base "${config.database.name}" deja presente.`);
    } else {
      await client.query(`CREATE DATABASE "${config.database.name.replace(/"/g, '""')}"`);
      console.log(`[HOPE] Base "${config.database.name}" creee.`);
    }
  } finally {
    await client.end();
  }
}

async function creerSchema() {
  const client = new Client(
    config.database.url
      ? {
          connectionString: config.database.url,
          ssl: config.database.ssl ? { rejectUnauthorized: false } : undefined,
        }
      : {
          host: config.database.host,
          port: config.database.port,
          user: config.database.user,
          password: config.database.password,
          database: config.database.name,
        }
  );

  await client.connect();
  try {
    await client.query(SQL_TABLE_ADMINS);
    console.log('[HOPE] Table "admins" prete.');

    await client.query(SQL_TRIGGER_UPDATED_AT);
    console.log('[HOPE] Declencheur "admins_updated_at" installe.');
  } finally {
    await client.end();
  }
}

async function executer() {
  console.log('[HOPE] Initialisation de la base de donnees...');
  if (config.database.url) {
    console.log('[HOPE] Cible : la base de DATABASE_URL (fournie par l hebergeur).');
  } else {
    console.log(
      `[HOPE] Cible : ${config.database.user}@${config.database.host}:${config.database.port}/${config.database.name}`
    );
    await creerBaseSiNecessaire();
  }
  await creerSchema();

  console.log('[HOPE] Initialisation terminee.');
}

executer().catch((erreur) => {
  console.error('[HOPE] Echec de l\'initialisation :', erreur.message);
  process.exit(1);
});
