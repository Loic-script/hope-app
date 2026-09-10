-- ============================================================
-- HOPE - Schema de l'espace administrateur
--
-- Script idempotent : il peut etre rejoue sans risque.
-- Il ne touche pas a la table "admins", geree par initDatabase.js.
--
-- MODELE DE L'ARGENT (le coeur de la plateforme) :
--
--   DON AFFECTE      -> va directement au projet choisi par le donateur
--   DON NON AFFECTE  -> alimente le FONDS HOPE
--   FONDS HOPE       -> l'administrateur l'INVESTIT dans un projet,
--                       avec une justification
--   PROJET           -> ce qui y est investi finance ses DEPENSES
--   DEPENSE          -> prouvee par un JUSTIFICATIF (facture, recu)
--   PROJET TERMINE   -> porte son RESULTAT et ses IMPACTS mesures
--
-- Regles transverses :
--   * tous les montants sont en NUMERIC(14,2), jamais en FLOAT ;
--   * les statuts sont controles par des contraintes CHECK ;
--   * les ecritures financieres ne sont pas supprimees.
-- ============================================================

-- ------------------------------------------------------------
-- 0. Retrait des tables de la version precedente
--    Le budget est desormais un champ du projet (required_budget) et
--    l'affectation passe par donations.project_id ou par investments.
-- ------------------------------------------------------------
DROP TABLE IF EXISTS donation_allocations CASCADE;
DROP TABLE IF EXISTS budget_items CASCADE;
DROP TABLE IF EXISTS project_budgets CASCADE;

-- ------------------------------------------------------------
-- 1. Categories de projet
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS project_categories (
  id          SERIAL       PRIMARY KEY,
  name        VARCHAR(120) NOT NULL UNIQUE,
  description TEXT,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- 2. Projets
--
--    required_budget : le "budget necessaire" saisi a la creation.
--    Un projet nait EN COURS et ne quitte cet etat que pour etre
--    TERMINE, puis eventuellement ARCHIVE.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS projects (
  id                  SERIAL        PRIMARY KEY,
  reference           VARCHAR(30)   NOT NULL UNIQUE,
  category_id         INTEGER       REFERENCES project_categories(id) ON DELETE SET NULL,
  name                VARCHAR(200)  NOT NULL,
  description         TEXT,
  location            VARCHAR(160),
  manager_name        VARCHAR(160),
  start_date          DATE          NOT NULL DEFAULT CURRENT_DATE,
  required_budget     NUMERIC(14,2) NOT NULL,
  currency            CHAR(3)       NOT NULL DEFAULT 'MGA',
  beneficiary_profile VARCHAR(200),
  beneficiary_target  INTEGER,
  status              VARCHAR(20)   NOT NULL DEFAULT 'IN_PROGRESS',
  media_url           TEXT,
  media_type          VARCHAR(10),
  outcome             TEXT,
  completed_at        TIMESTAMPTZ,
  archived_at         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT projects_budget_positif   CHECK (required_budget > 0),
  CONSTRAINT projects_cible_positive   CHECK (beneficiary_target IS NULL OR beneficiary_target >= 0),
  CONSTRAINT projects_status_valide    CHECK (status IN ('IN_PROGRESS', 'COMPLETED', 'ARCHIVED')),
  CONSTRAINT projects_media_valide     CHECK (media_type IS NULL OR media_type IN ('PHOTO', 'VIDEO')),
  -- Un projet termine porte forcement sa date de fin, et inversement.
  CONSTRAINT projects_fin_coherente
    CHECK ((status = 'IN_PROGRESS') = (completed_at IS NULL))
);

CREATE INDEX IF NOT EXISTS projects_status_idx   ON projects (status);
CREATE INDEX IF NOT EXISTS projects_category_idx ON projects (category_id);

-- ------------------------------------------------------------
-- 3. Donateurs
--
--    Tout don est rattache a un donateur. Le donateur devient
--    "regulier" quand il ouvre un compte (table suivante) ; sinon il
--    reste un donateur ponctuel, sans espace personnel.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS donors (
  id                SERIAL       PRIMARY KEY,
  first_name        VARCHAR(120),
  last_name         VARCHAR(120),
  organization_name VARCHAR(200),
  email             VARCHAR(200),
  phone             VARCHAR(40),
  country           VARCHAR(120) NOT NULL DEFAULT 'Madagascar',
  city              VARCHAR(120),
  origin            VARCHAR(20)  NOT NULL DEFAULT 'LOCAL',
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT donors_origine_valide CHECK (origin IN ('LOCAL', 'INTERNATIONAL')),
  -- Un donateur porte au moins un nom ou une raison sociale.
  CONSTRAINT donors_identite_presente
    CHECK (COALESCE(first_name, last_name, organization_name) IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS donors_origin_idx ON donors (origin);

-- ------------------------------------------------------------
-- 4. Comptes donateurs
--    Le donateur regulier ouvre un compte pour suivre ses dons et les
--    projets qu'il soutient. L'espace donateur viendra plus tard :
--    l'administrateur, lui, doit deja savoir qui a un compte.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS donor_accounts (
  id            SERIAL       PRIMARY KEY,
  donor_id      INTEGER      NOT NULL UNIQUE REFERENCES donors(id) ON DELETE CASCADE,
  email         VARCHAR(200) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  status        VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE',
  last_login_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT donor_accounts_status_valide CHECK (status IN ('ACTIVE', 'SUSPENDED'))
);

-- ------------------------------------------------------------
-- 5. Dons
--
--    allocation = 'PROJECT' : don affecte, le donateur a choisi le projet
--    allocation = 'HOPE'    : don non affecte, il alimente le fonds HOPE
--
--    frequency  = 'ONE_TIME' : don ponctuel, un seul paiement
--    frequency  = 'MONTHLY'  : don mensuel, un paiement par mois
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS donations (
  id                SERIAL        PRIMARY KEY,
  reference         VARCHAR(30)   NOT NULL UNIQUE,
  donor_id          INTEGER       NOT NULL REFERENCES donors(id)         ON DELETE RESTRICT,
  donor_account_id  INTEGER       REFERENCES donor_accounts(id)          ON DELETE SET NULL,
  amount            NUMERIC(14,2) NOT NULL,
  currency          CHAR(3)       NOT NULL DEFAULT 'MGA',
  allocation        VARCHAR(20)   NOT NULL,
  project_id        INTEGER       REFERENCES projects(id)                ON DELETE RESTRICT,
  frequency         VARCHAR(20)   NOT NULL DEFAULT 'ONE_TIME',
  payment_method    VARCHAR(60),
  payment_reference VARCHAR(120),
  status            VARCHAR(20)   NOT NULL DEFAULT 'RECEIVED',
  received_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  message           TEXT,
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT donations_montant_positif CHECK (amount > 0),
  CONSTRAINT donations_allocation_valide CHECK (allocation IN ('PROJECT', 'HOPE')),
  CONSTRAINT donations_frequence_valide  CHECK (frequency IN ('ONE_TIME', 'MONTHLY')),
  CONSTRAINT donations_status_valide
    CHECK (status IN ('PENDING', 'RECEIVED', 'FAILED', 'REFUNDED')),
  -- Un don affecte designe un projet ; un don pour HOPE n'en designe aucun.
  CONSTRAINT donations_projet_coherent
    CHECK ((allocation = 'PROJECT') = (project_id IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS donations_status_idx     ON donations (status);
CREATE INDEX IF NOT EXISTS donations_allocation_idx ON donations (allocation);
CREATE INDEX IF NOT EXISTS donations_donor_idx      ON donations (donor_id);
CREATE INDEX IF NOT EXISTS donations_project_idx    ON donations (project_id);

-- ------------------------------------------------------------
-- 6. Investissements du fonds HOPE dans un projet
--    C'est l'action "Investir" : l'administrateur prend sur les dons
--    non affectes et les engage sur un projet precis, en justifiant.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS investments (
  id            SERIAL        PRIMARY KEY,
  reference     VARCHAR(30)   NOT NULL UNIQUE,
  project_id    INTEGER       NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
  amount        NUMERIC(14,2) NOT NULL,
  currency      CHAR(3)       NOT NULL DEFAULT 'MGA',
  justification TEXT          NOT NULL,
  invested_at   DATE          NOT NULL DEFAULT CURRENT_DATE,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT investments_montant_positif CHECK (amount > 0)
);

CREATE INDEX IF NOT EXISTS investments_project_idx ON investments (project_id);

-- ------------------------------------------------------------
-- 7. Depenses (utilisation des fonds d'un projet)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS expenses (
  id           SERIAL        PRIMARY KEY,
  project_id   INTEGER       NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
  amount       NUMERIC(14,2) NOT NULL,
  currency     CHAR(3)       NOT NULL DEFAULT 'MGA',
  description  TEXT          NOT NULL,
  category     VARCHAR(60),
  supplier     VARCHAR(200),
  expense_date DATE          NOT NULL DEFAULT CURRENT_DATE,
  status       VARCHAR(20)   NOT NULL DEFAULT 'RECORDED',
  created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT expenses_montant_positif CHECK (amount > 0),
  CONSTRAINT expenses_status_valide   CHECK (status IN ('RECORDED', 'CANCELLED'))
);

CREATE INDEX IF NOT EXISTS expenses_project_idx ON expenses (project_id);
CREATE INDEX IF NOT EXISTS expenses_status_idx  ON expenses (status);

-- ------------------------------------------------------------
-- 8. Justificatifs
--
--    Dix natures, du document comptable (facture, devis, bon de
--    livraison) a la preuve d'execution (rapport d'activite, photo de
--    realisation, certificat).
--
--    admin_id repond a "qui l'a ajoute" : la table field_proofs porte la
--    meme colonne, pour la meme raison.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS supporting_documents (
  id            SERIAL       PRIMARY KEY,
  expense_id    INTEGER      NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
  admin_id      INTEGER      REFERENCES admins(id) ON DELETE SET NULL,
  document_type VARCHAR(20)  NOT NULL DEFAULT 'INVOICE',
  file_name     VARCHAR(255) NOT NULL,
  file_path     TEXT         NOT NULL,
  mime_type     VARCHAR(120),
  file_size     INTEGER,
  reference     VARCHAR(120),
  issued_at     DATE,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT documents_type_valide
    CHECK (document_type IN (
      'INVOICE',          -- Facture
      'RECEIPT',          -- Recu
      'QUOTE',            -- Devis
      'CONTRACT',         -- Contrat
      'DELIVERY_NOTE',    -- Bon de livraison
      'BANK_PROOF',       -- Preuve de paiement
      'ACTIVITY_REPORT',  -- Rapport d'activite
      'COMPLETION_PHOTO', -- Photo de realisation
      'CERTIFICATE',      -- Certificat
      'PARTNER_AGREEMENT',-- Convention partenaire
      'OTHER'             -- conserve pour les lignes anterieures
    ))
);

-- Colonnes et contrainte ajoutees apres coup : le schema doit rester
-- rejouable sur une base existante comme sur une base neuve.
ALTER TABLE supporting_documents ADD COLUMN IF NOT EXISTS admin_id INTEGER
  REFERENCES admins(id) ON DELETE SET NULL;

ALTER TABLE supporting_documents DROP CONSTRAINT IF EXISTS documents_type_valide;
ALTER TABLE supporting_documents ADD  CONSTRAINT documents_type_valide
  CHECK (document_type IN (
    'INVOICE', 'RECEIPT', 'QUOTE', 'CONTRACT', 'DELIVERY_NOTE', 'BANK_PROOF',
    'ACTIVITY_REPORT', 'COMPLETION_PHOTO', 'CERTIFICATE', 'PARTNER_AGREEMENT', 'OTHER'
  ));

CREATE INDEX IF NOT EXISTS documents_expense_idx ON supporting_documents (expense_id);

-- ------------------------------------------------------------
-- 9. Beneficiaires : qui a ete aide
--    Donnees personnelles sensibles, reservees a l'espace admin.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS beneficiaries (
  id               SERIAL       PRIMARY KEY,
  first_name       VARCHAR(120) NOT NULL,
  last_name        VARCHAR(120) NOT NULL,
  beneficiary_type VARCHAR(20)  NOT NULL,
  gender           VARCHAR(10),
  birth_date       DATE,
  country          VARCHAR(120) DEFAULT 'Madagascar',
  city             VARCHAR(120),
  status           VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE',
  notes            TEXT,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT beneficiaries_type_valide
    CHECK (beneficiary_type IN ('ORPHAN', 'SINGLE_MOTHER', 'FAMILY', 'OTHER')),
  CONSTRAINT beneficiaries_genre_valide
    CHECK (gender IS NULL OR gender IN ('F', 'M', 'OTHER')),
  CONSTRAINT beneficiaries_status_valide CHECK (status IN ('ACTIVE', 'INACTIVE'))
);

CREATE INDEX IF NOT EXISTS beneficiaries_status_idx ON beneficiaries (status);

-- ------------------------------------------------------------
-- 10. Rattachement beneficiaires <-> projets (N-N)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS project_beneficiaries (
  id             SERIAL      PRIMARY KEY,
  project_id     INTEGER     NOT NULL REFERENCES projects(id)      ON DELETE CASCADE,
  beneficiary_id INTEGER     NOT NULL REFERENCES beneficiaries(id) ON DELETE CASCADE,
  joined_at      DATE        NOT NULL DEFAULT CURRENT_DATE,
  left_at        DATE,
  status         VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT project_beneficiaries_status_valide
    CHECK (status IN ('ACTIVE', 'COMPLETED', 'WITHDRAWN')),
  CONSTRAINT project_beneficiaries_unique UNIQUE (project_id, beneficiary_id)
);

-- ------------------------------------------------------------
-- 11. Impacts mesures d'un projet
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS impacts (
  id             SERIAL        PRIMARY KEY,
  project_id     INTEGER       NOT NULL REFERENCES projects(id)      ON DELETE CASCADE,
  beneficiary_id INTEGER       REFERENCES beneficiaries(id)          ON DELETE SET NULL,
  title          VARCHAR(200)  NOT NULL,
  description    TEXT,
  indicator      VARCHAR(120)  NOT NULL,
  value          NUMERIC(14,2) NOT NULL,
  unit           VARCHAR(60),
  measured_at    DATE          NOT NULL DEFAULT CURRENT_DATE,
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS impacts_project_idx ON impacts (project_id);

-- ------------------------------------------------------------
-- 12. Messages des donateurs disposant d'un compte
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS messages (
  id               SERIAL       PRIMARY KEY,
  donor_account_id INTEGER      NOT NULL REFERENCES donor_accounts(id) ON DELETE CASCADE,
  subject          VARCHAR(200) NOT NULL,
  body             TEXT         NOT NULL,
  status           VARCHAR(20)  NOT NULL DEFAULT 'NEW',
  reply            TEXT,
  replied_at       TIMESTAMPTZ,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT messages_status_valide CHECK (status IN ('NEW', 'READ', 'ANSWERED'))
);

CREATE INDEX IF NOT EXISTS messages_status_idx ON messages (status);

-- ------------------------------------------------------------
-- 13. Notifications de l'administrateur
--     Alimentees par les services : un don recu, un message recu,
--     un projet termine.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
  id          SERIAL      PRIMARY KEY,
  type        VARCHAR(30) NOT NULL,
  label       TEXT        NOT NULL,
  donation_id INTEGER     REFERENCES donations(id) ON DELETE CASCADE,
  message_id  INTEGER     REFERENCES messages(id)  ON DELETE CASCADE,
  project_id  INTEGER     REFERENCES projects(id)  ON DELETE CASCADE,
  donor_id    INTEGER     REFERENCES donors(id)    ON DELETE CASCADE,
  is_read     BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT notifications_type_valide
    CHECK (type IN ('DONATION', 'MESSAGE', 'PROJECT_COMPLETED', 'INVESTMENT'))
);

CREATE INDEX IF NOT EXISTS notifications_lues_idx ON notifications (is_read, created_at DESC);

-- ------------------------------------------------------------
-- 14. Preuves terrain
--
--    A ne pas confondre avec supporting_documents : un justificatif
--    prouve une DEPENSE (facture, recu), une preuve terrain prouve une
--    ACTION ("les fournitures ont ete remises ce matin"). C'est elle qui
--    alimentera le suivi que verra le donateur.
--
--    admin_id est renseigne des maintenant, alors qu'il n'existe qu'un
--    seul compte : le jour ou l'equipe aura des comptes nommes, les
--    preuves deja publiees porteront deja leur auteur.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS field_proofs (
  id          SERIAL       PRIMARY KEY,
  project_id  INTEGER      NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  admin_id    INTEGER      REFERENCES admins(id) ON DELETE SET NULL,
  proof_type  VARCHAR(20)  NOT NULL DEFAULT 'PHOTO',
  description TEXT         NOT NULL,
  occurred_on DATE         NOT NULL DEFAULT CURRENT_DATE,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT field_proofs_type_valide
    CHECK (proof_type IN ('PHOTO', 'VIDEO', 'DOCUMENT', 'TESTIMONY'))
);

-- VIDEO ajoute apres coup : le schema doit rester rejouable sur une base
-- existante comme sur une base neuve.
ALTER TABLE field_proofs DROP CONSTRAINT IF EXISTS field_proofs_type_valide;
ALTER TABLE field_proofs ADD  CONSTRAINT field_proofs_type_valide
  CHECK (proof_type IN ('PHOTO', 'VIDEO', 'DOCUMENT', 'TESTIMONY'));

CREATE INDEX IF NOT EXISTS field_proofs_project_idx ON field_proofs (project_id);
CREATE INDEX IF NOT EXISTS field_proofs_date_idx    ON field_proofs (created_at DESC);

-- ------------------------------------------------------------
-- 14 bis. Les fichiers d'une preuve
--
--    Une action se montre rarement en une seule image : la remise de
--    fournitures, c'est le carton ouvert, les enfants, la signature du
--    registre. Le fichier n'est donc plus une colonne de la preuve mais
--    une ligne a part, et une preuve en porte autant qu'il en faut.
--
--    "position" fixe l'ordre d'affichage : la premiere image est celle
--    qui represente la preuve dans les listes.
--
--    L'unicite de file_path n'est pas cosmetique : elle rend la reprise
--    ci-dessous rejouable, le schema etant joue a chaque migration.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS field_proof_files (
  id          SERIAL       PRIMARY KEY,
  proof_id    INTEGER      NOT NULL REFERENCES field_proofs(id) ON DELETE CASCADE,
  file_name   VARCHAR(255) NOT NULL,
  file_path   TEXT         NOT NULL UNIQUE,
  mime_type   VARCHAR(120),
  file_size   INTEGER,
  position    SMALLINT     NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS field_proof_files_preuve_idx
  ON field_proof_files (proof_id, position);

-- Reprise des fichiers portes par field_proofs avant que la preuve
-- puisse en avoir plusieurs, puis retrait des colonnes devenues fausses.
-- Le test d'existence rend le bloc sans effet sur une base deja migree
-- comme sur une base neuve.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_name = 'field_proofs' AND column_name = 'file_path'
  ) THEN
    INSERT INTO field_proof_files (proof_id, file_name, file_path, mime_type, file_size)
    SELECT id, COALESCE(file_name, file_path), file_path, mime_type, file_size
      FROM field_proofs
     WHERE file_path IS NOT NULL
    ON CONFLICT (file_path) DO NOTHING;

    -- "au moins un fichier" porte sur plusieurs lignes : un CHECK ne
    -- sait pas l'exprimer, c'est le service qui s'en charge desormais.
    ALTER TABLE field_proofs DROP CONSTRAINT IF EXISTS field_proofs_fichier_coherent;
    ALTER TABLE field_proofs
      DROP COLUMN file_name,
      DROP COLUMN file_path,
      DROP COLUMN mime_type,
      DROP COLUMN file_size;
  END IF;
END $$;

-- ------------------------------------------------------------
-- 15. Journal d'activite
--
--    Le pendant signe du fil de l'accueil. Celui-ci est reconstruit par
--    lecture des tables metier : il dit ce qui s'est passe, jamais qui
--    l'a fait. Le journal, lui, est depose par les services au moment de
--    l'evenement -- comme les notifications -- et porte son auteur.
--
--    Il n'est jamais modifie : une ligne ecrite reste telle quelle.
--    D'ou l'absence de updated_at et de declencheur.
--
--    admin_id passe a NULL si le compte est supprime : on perd le lien,
--    jamais la trace. author_label garde le nom tel qu'il etait au moment
--    de l'action.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS activity_log (
  id           SERIAL      PRIMARY KEY,
  admin_id     INTEGER     REFERENCES admins(id) ON DELETE SET NULL,
  author_label VARCHAR(160) NOT NULL,
  action       VARCHAR(40) NOT NULL,
  entity_type  VARCHAR(40) NOT NULL,
  entity_id    INTEGER,
  label        TEXT        NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS activity_log_date_idx   ON activity_log (created_at DESC);
CREATE INDEX IF NOT EXISTS activity_log_entite_idx ON activity_log (entity_type, entity_id);

-- ------------------------------------------------------------
-- 16. Declencheurs updated_at
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION definir_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  cible TEXT;
BEGIN
  FOREACH cible IN ARRAY ARRAY[
    'project_categories', 'projects', 'donors', 'donor_accounts', 'donations',
    'investments', 'expenses', 'supporting_documents', 'beneficiaries',
    'project_beneficiaries', 'impacts', 'messages', 'field_proofs'
  ]
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I', cible || '_updated_at', cible);
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION definir_updated_at()',
      cible || '_updated_at', cible
    );
  END LOOP;
END;
$$;
