DROP TABLE IF EXISTS donation_allocations CASCADE;
DROP TABLE IF EXISTS budget_items CASCADE;
DROP TABLE IF EXISTS project_budgets CASCADE;

CREATE TABLE IF NOT EXISTS project_categories (
  id          SERIAL       PRIMARY KEY,
  name        VARCHAR(120) NOT NULL UNIQUE,
  description TEXT,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS projects (
  id                  SERIAL        PRIMARY KEY,
  reference           VARCHAR(30)   NOT NULL UNIQUE,
  category_id         INTEGER       REFERENCES project_categories(id) ON DELETE SET NULL,
  name                VARCHAR(200)  NOT NULL,
  project_type        VARCHAR(20)   NOT NULL DEFAULT 'HOPE',
  description_titre   VARCHAR(160),
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
  CONSTRAINT projects_fin_coherente
    CHECK ((status = 'IN_PROGRESS') = (completed_at IS NULL))
);

CREATE INDEX IF NOT EXISTS projects_status_idx   ON projects (status);
CREATE INDEX IF NOT EXISTS projects_category_idx ON projects (category_id);

CREATE TABLE IF NOT EXISTS project_objectives (
  id         SERIAL       PRIMARY KEY,
  project_id INTEGER      NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  label      VARCHAR(300) NOT NULL,
  position   SMALLINT     NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT project_objectives_libelle_non_vide CHECK (BTRIM(label) <> '')
);

CREATE INDEX IF NOT EXISTS project_objectives_projet_idx
  ON project_objectives (project_id, position);

CREATE TABLE IF NOT EXISTS project_quote_items (
  id         SERIAL        PRIMARY KEY,
  project_id INTEGER       NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  label      VARCHAR(200)  NOT NULL,
  category   VARCHAR(60),
  amount     NUMERIC(14,2) NOT NULL,
  position   SMALLINT      NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT project_quote_items_montant_positif CHECK (amount > 0),
  CONSTRAINT project_quote_items_libelle_non_vide CHECK (BTRIM(label) <> '')
);

CREATE INDEX IF NOT EXISTS project_quote_items_projet_idx
  ON project_quote_items (project_id, position);

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
  CONSTRAINT donors_identite_presente
    CHECK (COALESCE(first_name, last_name, organization_name) IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS donors_origin_idx ON donors (origin);

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
  CONSTRAINT donations_projet_coherent
    CHECK ((allocation = 'PROJECT') = (project_id IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS donations_status_idx     ON donations (status);
CREATE INDEX IF NOT EXISTS donations_allocation_idx ON donations (allocation);
CREATE INDEX IF NOT EXISTS donations_donor_idx      ON donations (donor_id);
CREATE INDEX IF NOT EXISTS donations_project_idx    ON donations (project_id);

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
      'INVOICE',
      'RECEIPT',
      'QUOTE',
      'CONTRACT',
      'DELIVERY_NOTE',
      'BANK_PROOF',
      'ACTIVITY_REPORT',
      'COMPLETION_PHOTO',
      'CERTIFICATE',
      'PARTNER_AGREEMENT',
      'OTHER'
    ))
);

ALTER TABLE supporting_documents ADD COLUMN IF NOT EXISTS admin_id INTEGER
  REFERENCES admins(id) ON DELETE SET NULL;

ALTER TABLE supporting_documents DROP CONSTRAINT IF EXISTS documents_type_valide;
ALTER TABLE supporting_documents ADD  CONSTRAINT documents_type_valide
  CHECK (document_type IN (
    'INVOICE', 'RECEIPT', 'QUOTE', 'CONTRACT', 'DELIVERY_NOTE', 'BANK_PROOF',
    'ACTIVITY_REPORT', 'COMPLETION_PHOTO', 'CERTIFICATE', 'PARTNER_AGREEMENT', 'OTHER'
  ));

CREATE INDEX IF NOT EXISTS documents_expense_idx ON supporting_documents (expense_id);

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

ALTER TABLE beneficiaries ADD COLUMN IF NOT EXISTS photo_fichier VARCHAR(80);

ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS beneficiary_id INTEGER REFERENCES beneficiaries(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS expenses_beneficiaire_idx ON expenses (beneficiary_id);

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

CREATE TABLE IF NOT EXISTS impacts (
  id             SERIAL        PRIMARY KEY,
  project_id     INTEGER       NOT NULL REFERENCES projects(id)      ON DELETE CASCADE,
  objective_id   INTEGER       REFERENCES project_objectives(id)     ON DELETE SET NULL,
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

ALTER TABLE field_proofs DROP CONSTRAINT IF EXISTS field_proofs_type_valide;
ALTER TABLE field_proofs ADD  CONSTRAINT field_proofs_type_valide
  CHECK (proof_type IN ('PHOTO', 'VIDEO', 'DOCUMENT', 'TESTIMONY'));

CREATE INDEX IF NOT EXISTS field_proofs_project_idx ON field_proofs (project_id);
CREATE INDEX IF NOT EXISTS field_proofs_date_idx    ON field_proofs (created_at DESC);

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

    ALTER TABLE field_proofs DROP CONSTRAINT IF EXISTS field_proofs_fichier_coherent;
    ALTER TABLE field_proofs
      DROP COLUMN file_name,
      DROP COLUMN file_path,
      DROP COLUMN mime_type,
      DROP COLUMN file_size;
  END IF;
END $$;

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

CREATE TABLE IF NOT EXISTS utilisateur (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom                VARCHAR(80)  NOT NULL,
  prenom             VARCHAR(80)  NOT NULL,
  telephone          VARCHAR(20)  UNIQUE,
  email              VARCHAR(160) UNIQUE,
  mot_de_passe       VARCHAR(255) NOT NULL,
  photo_url          TEXT,
  adresse            VARCHAR(255),
  date_de_naissance  DATE,
  statut             VARCHAR(20)  NOT NULL DEFAULT 'en_attente',
  telephone_verifie  BOOLEAN      NOT NULL DEFAULT FALSE,
  cree_le            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  derniere_connexion TIMESTAMPTZ,
  profil_complete    BOOLEAN      NOT NULL DEFAULT FALSE,
  active_le          TIMESTAMPTZ,
  active_par         INTEGER      REFERENCES admins(id) ON DELETE SET NULL,

  CONSTRAINT utilisateur_statut_valide
    CHECK (statut IN ('en_attente', 'actif', 'suspendu', 'supprime')),

  CONSTRAINT utilisateur_contact_present
    CHECK (email IS NOT NULL OR telephone IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS utilisateur_role (
  utilisateur_id UUID        NOT NULL REFERENCES utilisateur(id) ON DELETE CASCADE,
  role           VARCHAR(20) NOT NULL,
  attribue_le    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  PRIMARY KEY (utilisateur_id, role),

  CONSTRAINT utilisateur_role_valide
    CHECK (role IN ('donateur', 'benevole', 'bailleur', 'staff'))
);

ALTER TABLE utilisateur
  ADD COLUMN IF NOT EXISTS profil_complete BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE utilisateur
  ADD COLUMN IF NOT EXISTS conditions_version      VARCHAR(20),
  ADD COLUMN IF NOT EXISTS conditions_acceptees_le TIMESTAMPTZ;

ALTER TABLE utilisateur ADD COLUMN IF NOT EXISTS sessions_valides_depuis TIMESTAMPTZ;
ALTER TABLE admins      ADD COLUMN IF NOT EXISTS sessions_valides_depuis TIMESTAMPTZ;

ALTER TABLE admins ADD COLUMN IF NOT EXISTS email VARCHAR(200);
CREATE UNIQUE INDEX IF NOT EXISTS admins_email_unique ON admins (LOWER(email)) WHERE email IS NOT NULL;
ALTER TABLE admins DROP CONSTRAINT IF EXISTS admins_role_valide;
ALTER TABLE admins ADD CONSTRAINT admins_role_valide
  CHECK (role IN ('ADMIN', 'COORDINATOR', 'VIEWER', 'GESTIONNAIRE', 'MANAGER'));

CREATE INDEX IF NOT EXISTS utilisateur_statut_idx ON utilisateur (statut);
CREATE INDEX IF NOT EXISTS utilisateur_role_idx   ON utilisateur_role (role);

CREATE TABLE IF NOT EXISTS benevole (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  utilisateur_id      UUID NOT NULL UNIQUE REFERENCES utilisateur(id) ON DELETE CASCADE,
  profession          VARCHAR(120),
  competences         TEXT[]      NOT NULL DEFAULT ARRAY[]::TEXT[],
  langues             TEXT[]      NOT NULL DEFAULT ARRAY[]::TEXT[],
  disponibilites      JSONB       NOT NULL DEFAULT '{}'::JSONB,
  rayon_km            SMALLINT,
  accepte_terrain     BOOLEAN     NOT NULL DEFAULT TRUE,
  accepte_distance    BOOLEAN     NOT NULL DEFAULT TRUE,
  contact_urgence_nom VARCHAR(120),
  contact_urgence_tel VARCHAR(20),
  valide_par_hope     BOOLEAN     NOT NULL DEFAULT FALSE,
  valide_le           TIMESTAMPTZ,
  valide_par          INTEGER     REFERENCES admins(id) ON DELETE SET NULL,
  benevole_depuis     DATE        NOT NULL DEFAULT CURRENT_DATE,
  notes_internes      TEXT,
  cree_le             TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT benevole_rayon_positif CHECK (rayon_km IS NULL OR rayon_km >= 0)
);

CREATE TABLE IF NOT EXISTS mission (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  projet_id          INTEGER      NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
  titre              VARCHAR(160) NOT NULL,
  description        TEXT,
  lieu_nom           VARCHAR(160),
  latitude           NUMERIC(9,6),
  longitude          NUMERIC(9,6),
  format             VARCHAR(20)  NOT NULL,
  date_debut         TIMESTAMPTZ  NOT NULL,
  date_fin           TIMESTAMPTZ  NOT NULL,
  recurrence         VARCHAR(120),
  places_total       SMALLINT     NOT NULL,
  encadreur_id       INTEGER      REFERENCES admins(id) ON DELETE SET NULL,
  besoins_a_apporter TEXT[]       NOT NULL DEFAULT ARRAY[]::TEXT[],
  statut             VARCHAR(20)  NOT NULL DEFAULT 'ouverte',
  cree_le            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  CONSTRAINT mission_format_valide
    CHECK (format IN ('presentiel', 'terrain', 'distance')),
  CONSTRAINT mission_statut_valide
    CHECK (statut IN ('brouillon', 'ouverte', 'complete', 'terminee', 'annulee')),
  CONSTRAINT mission_places_positives CHECK (places_total > 0),
  CONSTRAINT mission_periode_coherente CHECK (date_fin >= date_debut)
);

CREATE INDEX IF NOT EXISTS mission_statut_date_idx ON mission (statut, date_debut);
CREATE INDEX IF NOT EXISTS mission_projet_idx      ON mission (projet_id);

CREATE TABLE IF NOT EXISTS inscription_mission (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id       UUID         NOT NULL REFERENCES mission(id) ON DELETE CASCADE,
  benevole_id      UUID         NOT NULL REFERENCES benevole(id) ON DELETE CASCADE,
  statut           VARCHAR(20)  NOT NULL DEFAULT 'inscrit',
  inscrit_le       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  annule_le        TIMESTAMPTZ,
  motif_annulation TEXT,
  heures_validees  NUMERIC(4,1),
  valide_par       INTEGER      REFERENCES admins(id) ON DELETE SET NULL,

  UNIQUE (mission_id, benevole_id),

  CONSTRAINT inscription_statut_valide
    CHECK (statut IN ('inscrit', 'confirme', 'present', 'absent', 'annule')),
  CONSTRAINT inscription_heures_positives
    CHECK (heures_validees IS NULL OR heures_validees >= 0)
);

CREATE INDEX IF NOT EXISTS inscription_benevole_idx ON inscription_mission (benevole_id, statut);
CREATE INDEX IF NOT EXISTS inscription_mission_idx  ON inscription_mission (mission_id, statut);

CREATE TABLE IF NOT EXISTS tache (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  projet_id    INTEGER      NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  titre        VARCHAR(160) NOT NULL,
  description  TEXT,
  echeance     DATE,
  statut       VARCHAR(20)  NOT NULL DEFAULT 'a_faire',
  benevole_id  UUID         REFERENCES benevole(id) ON DELETE SET NULL,
  prise_le     TIMESTAMPTZ,
  livree_le    TIMESTAMPTZ,
  validee_par  INTEGER      REFERENCES admins(id) ON DELETE SET NULL,
  cree_le      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  CONSTRAINT tache_statut_valide
    CHECK (statut IN ('a_faire', 'en_cours', 'livree'))
);

CREATE INDEX IF NOT EXISTS tache_benevole_idx ON tache (benevole_id, statut);
CREATE INDEX IF NOT EXISTS tache_projet_idx   ON tache (projet_id, statut);

ALTER TABLE field_proofs
  ADD COLUMN IF NOT EXISTS benevole_id UUID REFERENCES benevole(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS field_proofs_benevole_idx ON field_proofs (benevole_id);

CREATE TABLE IF NOT EXISTS tache_fichier (
  id           SERIAL       PRIMARY KEY,
  tache_id     UUID         NOT NULL REFERENCES tache(id) ON DELETE CASCADE,
  nom_fichier  VARCHAR(255) NOT NULL,
  chemin       VARCHAR(500) NOT NULL,
  type_mime    VARCHAR(100) NOT NULL,
  taille       INTEGER      NOT NULL,
  position     SMALLINT     NOT NULL DEFAULT 0,
  cree_le      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS tache_fichier_tache_idx ON tache_fichier (tache_id, position);

CREATE TABLE IF NOT EXISTS tache_benevole (
  id           BIGSERIAL    PRIMARY KEY,
  tache_id     UUID         NOT NULL REFERENCES tache(id) ON DELETE CASCADE,
  benevole_id  UUID         NOT NULL REFERENCES benevole(id) ON DELETE CASCADE,
  statut       VARCHAR(20)  NOT NULL,
  origine      VARCHAR(20)  NOT NULL,
  demandee_le  TIMESTAMPTZ,
  affectee_le  TIMESTAMPTZ,
  decidee_par  INTEGER      REFERENCES admins(id) ON DELETE SET NULL,
  decidee_le   TIMESTAMPTZ,
  cree_le      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  UNIQUE (tache_id, benevole_id),
  CONSTRAINT tache_benevole_statut_valide
    CHECK (statut IN ('demandee', 'affectee', 'refusee')),
  CONSTRAINT tache_benevole_origine_valide
    CHECK (origine IN ('equipe', 'benevole'))
);

CREATE INDEX IF NOT EXISTS tache_benevole_benevole_idx ON tache_benevole (benevole_id, statut);
CREATE INDEX IF NOT EXISTS tache_benevole_tache_idx    ON tache_benevole (tache_id, statut);
CREATE INDEX IF NOT EXISTS tache_benevole_demandes_idx
  ON tache_benevole (tache_id) WHERE statut = 'demandee';

ALTER TABLE tache ADD COLUMN IF NOT EXISTS livree_par UUID REFERENCES benevole(id) ON DELETE SET NULL;

ALTER TABLE tache ADD COLUMN IF NOT EXISTS commentaire_livraison VARCHAR(2000);

ALTER TABLE tache DROP CONSTRAINT IF EXISTS tache_prise_coherente;

INSERT INTO tache_benevole (tache_id, benevole_id, statut, origine, affectee_le, cree_le)
SELECT id, benevole_id, 'affectee', 'benevole',
       COALESCE(prise_le, cree_le), COALESCE(prise_le, cree_le)
  FROM tache
 WHERE benevole_id IS NOT NULL
ON CONFLICT (tache_id, benevole_id) DO NOTHING;

UPDATE tache SET livree_par = benevole_id
 WHERE statut = 'livree' AND livree_par IS NULL AND benevole_id IS NOT NULL;

UPDATE tache SET benevole_id = NULL WHERE benevole_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS avis_mission (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id  UUID        NOT NULL REFERENCES mission(id) ON DELETE CASCADE,
  benevole_id UUID        NOT NULL REFERENCES benevole(id) ON DELETE CASCADE,
  note        SMALLINT    NOT NULL CHECK (note BETWEEN 1 AND 5),
  commentaire TEXT,
  publie      BOOLEAN     NOT NULL DEFAULT TRUE,
  cree_le     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (mission_id, benevole_id)
);

CREATE INDEX IF NOT EXISTS avis_mission_idx ON avis_mission (mission_id, publie);

CREATE TABLE IF NOT EXISTS bailleur (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  raison_sociale    VARCHAR(200) NOT NULL,
  type_organisation VARCHAR(40)  NOT NULL,
  secteur           VARCHAR(120),
  pays              VARCHAR(80)  NOT NULL DEFAULT 'Madagascar',
  adresse           TEXT,
  site_web          TEXT,
  logo_url          TEXT,
  nif               VARCHAR(40),
  partenaire_depuis DATE         NOT NULL DEFAULT CURRENT_DATE,
  statut            VARCHAR(20)  NOT NULL DEFAULT 'prospect',
  niveau            VARCHAR(20),
  notes_internes    TEXT,
  cree_le           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  CONSTRAINT bailleur_type_valide
    CHECK (type_organisation IN
      ('fondation_privee', 'entreprise', 'agence_publique', 'ong', 'ambassade', 'autre')),
  CONSTRAINT bailleur_statut_valide
    CHECK (statut IN ('prospect', 'actif', 'en_pause', 'termine')),
  CONSTRAINT bailleur_niveau_valide
    CHECK (niveau IS NULL OR niveau IN ('bronze', 'argent', 'or'))
);

ALTER TABLE bailleur DROP CONSTRAINT IF EXISTS bailleur_type_valide;
ALTER TABLE bailleur ADD CONSTRAINT bailleur_type_valide
  CHECK (type_organisation IN
    ('fondation_privee', 'entreprise', 'agence_publique', 'ong', 'ambassade', 'autre'));

CREATE TABLE IF NOT EXISTS bailleur_contact (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bailleur_id       UUID    NOT NULL REFERENCES bailleur(id) ON DELETE CASCADE,
  utilisateur_id    UUID    UNIQUE REFERENCES utilisateur(id) ON DELETE SET NULL,
  fonction          VARCHAR(120),
  contact_principal BOOLEAN NOT NULL DEFAULT FALSE,
  peut_consulter    BOOLEAN NOT NULL DEFAULT TRUE,
  peut_telecharger  BOOLEAN NOT NULL DEFAULT TRUE,
  actif             BOOLEAN NOT NULL DEFAULT TRUE,
  cree_le           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_contact_principal
  ON bailleur_contact (bailleur_id) WHERE contact_principal;

CREATE TABLE IF NOT EXISTS engagement (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bailleur_id          UUID         NOT NULL REFERENCES bailleur(id) ON DELETE CASCADE,
  intitule             VARCHAR(200) NOT NULL,
  type_soutien         VARCHAR(30)  NOT NULL,
  montant_engage       NUMERIC(14,2),
  devise               CHAR(3)      NOT NULL DEFAULT 'MGA',
  unite                VARCHAR(40),
  quantite_engagee     NUMERIC(10,2),
  quantite_realisee    NUMERIC(10,2) NOT NULL DEFAULT 0,
  valorisation         NUMERIC(14,2),
  date_signature       DATE         NOT NULL,
  date_debut           DATE         NOT NULL,
  date_fin             DATE,
  reference_convention VARCHAR(80),
  convention_url       TEXT,
  affectation_libre    BOOLEAN      NOT NULL DEFAULT FALSE,
  statut               VARCHAR(20)  NOT NULL DEFAULT 'en_cours',
  cree_le              TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  CONSTRAINT engagement_type_valide
    CHECK (type_soutien IN ('financier', 'competences', 'materiel')),
  CONSTRAINT engagement_statut_valide
    CHECK (statut IN ('en_cours', 'finalise', 'suspendu', 'annule')),
  CONSTRAINT engagement_periode_coherente
    CHECK (date_fin IS NULL OR date_fin >= date_debut),
  CONSTRAINT engagement_mesure_presente
    CHECK ((type_soutien = 'financier' AND montant_engage IS NOT NULL)
        OR (type_soutien <> 'financier' AND quantite_engagee IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS engagement_bailleur_idx ON engagement (bailleur_id, statut);

CREATE TABLE IF NOT EXISTS versement (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  engagement_id      UUID          NOT NULL REFERENCES engagement(id) ON DELETE CASCADE,
  numero_tranche     SMALLINT,
  montant            NUMERIC(14,2) NOT NULL,
  devise             CHAR(3)       NOT NULL DEFAULT 'MGA',
  date_prevue        DATE,
  date_recue         DATE,
  moyen              VARCHAR(30),
  reference_bancaire VARCHAR(80),
  justificatif_url   TEXT,
  saisi_par          INTEGER       REFERENCES admins(id) ON DELETE SET NULL,
  statut             VARCHAR(20)   NOT NULL DEFAULT 'attendu',
  cree_le            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT versement_statut_valide
    CHECK (statut IN ('attendu', 'recu', 'en_retard', 'annule')),
  CONSTRAINT versement_moyen_valide
    CHECK (moyen IS NULL OR moyen IN ('virement', 'cheque', 'especes', 'mobile_money')),
  CONSTRAINT versement_montant_positif CHECK (montant > 0),
  CONSTRAINT versement_recu_date
    CHECK (statut <> 'recu' OR date_recue IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS versement_engagement_idx ON versement (engagement_id, statut);

CREATE TABLE IF NOT EXISTS affectation (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  engagement_id    UUID          NOT NULL REFERENCES engagement(id) ON DELETE CASCADE,
  projet_id        INTEGER       NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
  montant          NUMERIC(14,2) NOT NULL,
  date_affectation DATE          NOT NULL DEFAULT CURRENT_DATE,
  commentaire      TEXT,

  UNIQUE (engagement_id, projet_id),
  CONSTRAINT affectation_montant_positif CHECK (montant > 0)
);

CREATE INDEX IF NOT EXISTS affectation_projet_idx ON affectation (projet_id);

CREATE TABLE IF NOT EXISTS document_bailleur (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bailleur_id        UUID         NOT NULL REFERENCES bailleur(id) ON DELETE CASCADE,
  engagement_id      UUID         REFERENCES engagement(id) ON DELETE CASCADE,
  projet_id          INTEGER      REFERENCES projects(id) ON DELETE SET NULL,
  type               VARCHAR(30)  NOT NULL,
  titre              VARCHAR(200) NOT NULL,
  periode_debut      DATE,
  periode_fin        DATE,
  fichier_url        TEXT         NOT NULL,
  nb_pages           SMALLINT,
  genere_auto        BOOLEAN      NOT NULL DEFAULT FALSE,
  publie_le          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  publie_par         INTEGER      REFERENCES admins(id) ON DELETE SET NULL,
  telecharge_le      TIMESTAMPTZ,
  nb_telechargements INT          NOT NULL DEFAULT 0,

  CONSTRAINT document_bailleur_type_valide
    CHECK (type IN
      ('rapport_impact', 'justificatif_financier', 'certificat', 'convention'))
);

CREATE INDEX IF NOT EXISTS document_bailleur_idx ON document_bailleur (bailleur_id, type);

CREATE TABLE IF NOT EXISTS distinction (
  code    VARCHAR(40) PRIMARY KEY,
  libelle VARCHAR(80) NOT NULL,
  regle   TEXT
);

CREATE TABLE IF NOT EXISTS bailleur_distinction (
  bailleur_id      UUID        NOT NULL REFERENCES bailleur(id) ON DELETE CASCADE,
  distinction_code VARCHAR(40) NOT NULL REFERENCES distinction(code) ON DELETE CASCADE,
  obtenue_le       DATE        NOT NULL DEFAULT CURRENT_DATE,

  PRIMARY KEY (bailleur_id, distinction_code)
);

CREATE OR REPLACE FUNCTION verifier_affectation_engagement()
RETURNS TRIGGER AS $$
DECLARE
  plafond NUMERIC(14,2);
  deja    NUMERIC(14,2);
BEGIN
  SELECT montant_engage INTO plafond
    FROM engagement WHERE id = NEW.engagement_id;

  IF plafond IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(SUM(montant), 0) INTO deja
    FROM affectation
   WHERE engagement_id = NEW.engagement_id
     AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::UUID);

  IF deja + NEW.montant > plafond THEN
    RAISE EXCEPTION
      'Affectation refusee : % + % depasse le montant engage de %',
      deja, NEW.montant, plafond
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS affectation_plafond ON affectation;
CREATE TRIGGER affectation_plafond
  BEFORE INSERT OR UPDATE ON affectation
  FOR EACH ROW EXECUTE FUNCTION verifier_affectation_engagement();

CREATE TABLE IF NOT EXISTS publication (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type          VARCHAR(30)  NOT NULL DEFAULT 'actualite',
  titre         VARCHAR(200) NOT NULL,
  corps         TEXT,
  projet_id     INTEGER      REFERENCES projects(id) ON DELETE SET NULL,
  media_url     TEXT,
  cibles        TEXT[]       NOT NULL DEFAULT ARRAY['bailleurs']::TEXT[],
  montant_cible NUMERIC(14,2),
  publie_le     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  publie_par    INTEGER      REFERENCES admins(id) ON DELETE SET NULL,

  CONSTRAINT publication_type_valide
    CHECK (type IN ('actualite', 'appel_financement'))
);

CREATE INDEX IF NOT EXISTS publication_date_idx ON publication (publie_le DESC);

ALTER TABLE publication DROP CONSTRAINT IF EXISTS publication_appel_chiffre;

CREATE TABLE IF NOT EXISTS manifestation_interet (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bailleur_id    UUID        NOT NULL REFERENCES bailleur(id) ON DELETE CASCADE,
  publication_id UUID        REFERENCES publication(id) ON DELETE SET NULL,
  projet_id      INTEGER     REFERENCES projects(id) ON DELETE SET NULL,
  message        TEXT,
  contact_id     UUID        REFERENCES bailleur_contact(id) ON DELETE SET NULL,
  statut         VARCHAR(20) NOT NULL DEFAULT 'nouvelle',
  cree_le        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT manifestation_statut_valide
    CHECK (statut IN ('nouvelle', 'contactee', 'convertie', 'classee')),
  UNIQUE (bailleur_id, publication_id)
);

CREATE INDEX IF NOT EXISTS manifestation_publication_idx
  ON manifestation_interet (publication_id);

CREATE TABLE IF NOT EXISTS notification_utilisateur (
  id             BIGSERIAL PRIMARY KEY,
  utilisateur_id UUID         NOT NULL REFERENCES utilisateur(id) ON DELETE CASCADE,
  type           VARCHAR(40)  NOT NULL,
  titre          VARCHAR(160) NOT NULL,
  corps          TEXT,
  lien           VARCHAR(200),
  lu             BOOLEAN      NOT NULL DEFAULT FALSE,
  cree_le        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS notification_utilisateur_idx
  ON notification_utilisateur (utilisateur_id, lu, cree_le DESC);

CREATE TABLE IF NOT EXISTS message_utilisateur (
  id             BIGSERIAL PRIMARY KEY,
  utilisateur_id UUID         NOT NULL REFERENCES utilisateur(id) ON DELETE CASCADE,
  sujet          VARCHAR(160) NOT NULL,
  corps          TEXT         NOT NULL,
  statut         VARCHAR(20)  NOT NULL DEFAULT 'envoye',
  reponse        TEXT,
  repondu_le     TIMESTAMPTZ,
  repondu_par    INTEGER      REFERENCES admins(id) ON DELETE SET NULL,
  reponse_lue    BOOLEAN      NOT NULL DEFAULT TRUE,
  cree_le        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  CONSTRAINT message_utilisateur_statut_valide
    CHECK (statut IN ('envoye', 'repondu', 'clos')),
  CONSTRAINT message_utilisateur_reponse_coherente
    CHECK ((statut = 'repondu') = (reponse IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS message_utilisateur_idx
  ON message_utilisateur (utilisateur_id, cree_le DESC);

CREATE TABLE IF NOT EXISTS message_entree (
  id       BIGSERIAL   PRIMARY KEY,
  fil_id   BIGINT      NOT NULL REFERENCES message_utilisateur(id) ON DELETE CASCADE,
  auteur   VARCHAR(12) NOT NULL,
  corps    TEXT        NOT NULL,
  admin_id INTEGER     REFERENCES admins(id) ON DELETE SET NULL,
  lu       BOOLEAN     NOT NULL DEFAULT FALSE,
  cree_le  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT message_entree_auteur_valide CHECK (auteur IN ('utilisateur', 'hope'))
);

CREATE INDEX IF NOT EXISTS message_entree_idx ON message_entree (fil_id, cree_le);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_name = 'message_utilisateur' AND column_name = 'corps'
  ) THEN
    INSERT INTO message_entree (fil_id, auteur, corps, lu, cree_le)
    SELECT id, 'utilisateur', corps, TRUE, cree_le
      FROM message_utilisateur;

    INSERT INTO message_entree (fil_id, auteur, corps, admin_id, lu, cree_le)
    SELECT id, 'hope', reponse, repondu_par, reponse_lue,
           COALESCE(repondu_le, updated_at)
      FROM message_utilisateur
     WHERE reponse IS NOT NULL;

    ALTER TABLE message_utilisateur
      DROP CONSTRAINT IF EXISTS message_utilisateur_reponse_coherente,
      DROP COLUMN corps,
      DROP COLUMN reponse,
      DROP COLUMN repondu_le,
      DROP COLUMN repondu_par,
      DROP COLUMN reponse_lue;
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS conversation (
  id      BIGSERIAL    PRIMARY KEY,
  sujet   VARCHAR(160),
  cree_le TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  maj_le  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS conversation_maj_idx ON conversation (maj_le DESC);

CREATE TABLE IF NOT EXISTS conversation_participant (
  id              BIGSERIAL   PRIMARY KEY,
  conversation_id BIGINT      NOT NULL REFERENCES conversation(id) ON DELETE CASCADE,
  utilisateur_id  UUID        REFERENCES utilisateur(id) ON DELETE CASCADE,
  admin_id        INTEGER     REFERENCES admins(id) ON DELETE CASCADE,
  lu_jusqu_a      TIMESTAMPTZ,
  rejoint_le      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT participant_une_seule_identite CHECK (
    (utilisateur_id IS NOT NULL AND admin_id IS NULL) OR
    (utilisateur_id IS NULL AND admin_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS participant_utilisateur_unique
  ON conversation_participant (conversation_id, utilisateur_id)
  WHERE utilisateur_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS participant_admin_unique
  ON conversation_participant (conversation_id, admin_id)
  WHERE admin_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS participant_utilisateur_idx
  ON conversation_participant (utilisateur_id);
CREATE INDEX IF NOT EXISTS participant_admin_idx
  ON conversation_participant (admin_id);

CREATE TABLE IF NOT EXISTS conversation_message (
  id              BIGSERIAL   PRIMARY KEY,
  conversation_id BIGINT      NOT NULL REFERENCES conversation(id) ON DELETE CASCADE,
  utilisateur_id  UUID        REFERENCES utilisateur(id) ON DELETE SET NULL,
  admin_id        INTEGER     REFERENCES admins(id) ON DELETE SET NULL,
  corps           TEXT        NOT NULL,
  cree_le         TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT message_jamais_deux_auteurs
    CHECK (utilisateur_id IS NULL OR admin_id IS NULL)
);

ALTER TABLE conversation_message
  DROP CONSTRAINT IF EXISTS message_une_seule_identite;

ALTER TABLE conversation_message
  DROP CONSTRAINT IF EXISTS message_jamais_deux_auteurs;

ALTER TABLE conversation_message
  ADD CONSTRAINT message_jamais_deux_auteurs
    CHECK (utilisateur_id IS NULL OR admin_id IS NULL);

CREATE INDEX IF NOT EXISTS conversation_message_idx
  ON conversation_message (conversation_id, cree_le);

DO $$
DECLARE
  premier_admin INTEGER;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'message_utilisateur')
     AND NOT EXISTS (SELECT 1 FROM conversation) THEN

    SELECT id INTO premier_admin FROM admins ORDER BY id LIMIT 1;

    INSERT INTO conversation (id, sujet, cree_le, maj_le)
    SELECT id, sujet, cree_le, updated_at FROM message_utilisateur;
    PERFORM setval(
      'conversation_id_seq',
      COALESCE((SELECT MAX(id) FROM conversation), 1)
    );

    INSERT INTO conversation_participant (conversation_id, utilisateur_id, lu_jusqu_a)
    SELECT id, utilisateur_id, updated_at FROM message_utilisateur;

    INSERT INTO conversation_participant (conversation_id, admin_id)
    SELECT m.id,
           COALESCE(
             (SELECT e.admin_id FROM message_entree e
               WHERE e.fil_id = m.id AND e.admin_id IS NOT NULL
               ORDER BY e.cree_le LIMIT 1),
             premier_admin
           )
      FROM message_utilisateur m
     WHERE premier_admin IS NOT NULL;

    INSERT INTO conversation_message
      (conversation_id, utilisateur_id, admin_id, corps, cree_le)
    SELECT e.fil_id,
           CASE WHEN e.auteur = 'utilisateur' THEN m.utilisateur_id END,
           CASE WHEN e.auteur = 'hope' THEN COALESCE(e.admin_id, premier_admin) END,
           e.corps, e.cree_le
      FROM message_entree e
      JOIN message_utilisateur m ON m.id = e.fil_id
     WHERE e.auteur = 'utilisateur' OR premier_admin IS NOT NULL;
  END IF;
END;
$$;

ALTER TABLE conversation ADD COLUMN IF NOT EXISTS type VARCHAR(12) NOT NULL DEFAULT 'individuel';
ALTER TABLE conversation ADD COLUMN IF NOT EXISTS nom VARCHAR(80);
ALTER TABLE conversation ADD COLUMN IF NOT EXISTS photo_fichier VARCHAR(80);
ALTER TABLE conversation ADD COLUMN IF NOT EXISTS assistance BOOLEAN NOT NULL DEFAULT FALSE;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'conversation_type_valide') THEN
    ALTER TABLE conversation
      ADD CONSTRAINT conversation_type_valide CHECK (type IN ('individuel', 'groupe'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'conversation_nom_de_groupe') THEN
    ALTER TABLE conversation
      ADD CONSTRAINT conversation_nom_de_groupe
        CHECK ((type = 'groupe' AND nom IS NOT NULL AND BTRIM(nom) <> '')
            OR (type = 'individuel' AND nom IS NULL));
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM conversation WHERE sujet IS NOT NULL AND assistance = FALSE) THEN
    UPDATE conversation SET assistance = TRUE WHERE sujet IS NOT NULL;

    INSERT INTO conversation_participant (conversation_id, admin_id, lu_jusqu_a)
    SELECT c.id, a.id, NOW()
      FROM conversation c
      CROSS JOIN admins a
     WHERE c.assistance
       AND a.status = 'ACTIVE'
       AND NOT EXISTS (
         SELECT 1 FROM conversation_participant p
          WHERE p.conversation_id = c.id AND p.admin_id = a.id
       );
  END IF;
END
$$;

ALTER TABLE conversation_message ADD COLUMN IF NOT EXISTS auteur_nom VARCHAR(160);
ALTER TABLE conversation_message ADD COLUMN IF NOT EXISTS modifie_le TIMESTAMPTZ;
ALTER TABLE conversation_message ADD COLUMN IF NOT EXISTS supprime_le TIMESTAMPTZ;
ALTER TABLE conversation_message ADD COLUMN IF NOT EXISTS transfere BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE conversation_message m
   SET auteur_nom = COALESCE(
         (SELECT TRIM(u.prenom || ' ' || u.nom) FROM utilisateur u WHERE u.id = m.utilisateur_id),
         (SELECT a.admin_log FROM admins a WHERE a.id = m.admin_id),
         'Compte supprimé'
       )
 WHERE auteur_nom IS NULL;

CREATE TABLE IF NOT EXISTS conversation_piece (
  id          BIGSERIAL    PRIMARY KEY,
  message_id  BIGINT       NOT NULL REFERENCES conversation_message(id) ON DELETE CASCADE,
  nom_origine VARCHAR(255) NOT NULL,
  type        VARCHAR(8)   NOT NULL,
  type_mime   VARCHAR(80)  NOT NULL,
  fichier     VARCHAR(80)  NOT NULL UNIQUE,
  taille      INTEGER      NOT NULL,
  position    SMALLINT     NOT NULL DEFAULT 0,
  cree_le     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  CONSTRAINT conversation_piece_type_valide CHECK (type IN ('image', 'video', 'pdf')),
  CONSTRAINT conversation_piece_taille_positive CHECK (taille > 0)
);

CREATE INDEX IF NOT EXISTS conversation_piece_message_idx
  ON conversation_piece (message_id, position);

CREATE INDEX IF NOT EXISTS conversation_message_vivants_idx
  ON conversation_message (conversation_id, cree_le) WHERE supprime_le IS NULL;

ALTER TABLE admins ADD COLUMN IF NOT EXISTS photo_url VARCHAR(255);

ALTER TABLE projects ADD COLUMN IF NOT EXISTS description_titre VARCHAR(160);

ALTER TABLE projects ADD COLUMN IF NOT EXISTS project_type VARCHAR(20) NOT NULL DEFAULT 'HOPE';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'projects_type_valide') THEN
    ALTER TABLE projects
      ADD CONSTRAINT projects_type_valide CHECK (project_type IN ('HOPE', 'INTERNAL'));
  END IF;
END
$$;

ALTER TABLE impacts ADD COLUMN IF NOT EXISTS objective_id INTEGER
  REFERENCES project_objectives(id) ON DELETE SET NULL;

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
    'project_beneficiaries', 'impacts', 'messages', 'field_proofs',
    'message_utilisateur'
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

UPDATE utilisateur u
   SET profil_complete = TRUE
 WHERE u.profil_complete = FALSE
   AND (
     EXISTS (SELECT 1 FROM benevole b WHERE b.utilisateur_id = u.id)
     OR EXISTS (SELECT 1 FROM bailleur_contact c WHERE c.utilisateur_id = u.id)
   );

UPDATE utilisateur u
   SET profil_complete = FALSE
 WHERE u.profil_complete = TRUE
   AND EXISTS (
     SELECT 1 FROM utilisateur_role r
      WHERE r.utilisateur_id = u.id
        AND r.role IN ('benevole', 'bailleur'))
   AND NOT EXISTS (SELECT 1 FROM benevole b WHERE b.utilisateur_id = u.id)
   AND NOT EXISTS (SELECT 1 FROM bailleur_contact c WHERE c.utilisateur_id = u.id);

ALTER TABLE document_bailleur ADD COLUMN IF NOT EXISTS contenu JSONB;

CREATE TABLE IF NOT EXISTS donateur (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  utilisateur_id      UUID         NOT NULL UNIQUE REFERENCES utilisateur(id) ON DELETE CASCADE,
  ville               VARCHAR(120),
  pays                CHAR(2),
  profession          VARCHAR(120),
  source_connaissance VARCHAR(30),
  etape_suivante      SMALLINT     NOT NULL DEFAULT 1,
  cree_le             TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  mis_a_jour_le       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  CONSTRAINT donateur_pays_iso CHECK (pays IS NULL OR pays ~ '^[A-Z]{2}$'),
  CONSTRAINT donateur_source_valide CHECK (
    source_connaissance IS NULL OR source_connaissance IN (
      'reseaux_sociaux', 'bouche_a_oreille', 'recherche_internet', 'evenement',
      'medias', 'membre_hope', 'partenaire', 'autre')),
  CONSTRAINT donateur_etape_valide CHECK (etape_suivante BETWEEN 1 AND 6)
);

ALTER TABLE donateur ADD COLUMN IF NOT EXISTS type_donateur  VARCHAR(20);
ALTER TABLE donateur ADD COLUMN IF NOT EXISTS nom_structure  VARCHAR(200);
ALTER TABLE donateur ADD COLUMN IF NOT EXISTS site_web       VARCHAR(255);
ALTER TABLE donateur ADD COLUMN IF NOT EXISTS devise         CHAR(3);
ALTER TABLE donateur ADD COLUMN IF NOT EXISTS langue         VARCHAR(5);
ALTER TABLE donateur ADD COLUMN IF NOT EXISTS fuseau_horaire VARCHAR(64);

ALTER TABLE donateur DROP CONSTRAINT IF EXISTS donateur_type_valide;
ALTER TABLE donateur ADD CONSTRAINT donateur_type_valide CHECK (
  type_donateur IS NULL OR type_donateur IN (
    'particulier', 'entreprise', 'fondation', 'organisation', 'partenaire', 'international'));

ALTER TABLE donateur DROP CONSTRAINT IF EXISTS donateur_devise_valide;
ALTER TABLE donateur ADD CONSTRAINT donateur_devise_valide CHECK (
  devise IS NULL OR devise IN ('MGA', 'EUR', 'USD'));

ALTER TABLE donateur DROP CONSTRAINT IF EXISTS donateur_langue_valide;
ALTER TABLE donateur ADD CONSTRAINT donateur_langue_valide CHECK (
  langue IS NULL OR langue ~ '^[a-z]{2}$');

ALTER TABLE donateur ADD COLUMN IF NOT EXISTS affectation VARCHAR(10);
ALTER TABLE donateur ADD COLUMN IF NOT EXISTS projet_id INTEGER
  REFERENCES projects(id) ON DELETE SET NULL;

ALTER TABLE donateur DROP CONSTRAINT IF EXISTS donateur_affectation_valide;
ALTER TABLE donateur ADD CONSTRAINT donateur_affectation_valide CHECK (
  affectation IS NULL OR affectation IN ('PROJECT', 'HOPE'));

ALTER TABLE donateur DROP CONSTRAINT IF EXISTS donateur_affectation_coherente;
ALTER TABLE donateur ADD CONSTRAINT donateur_affectation_coherente CHECK (
  affectation IS DISTINCT FROM 'HOPE' OR projet_id IS NULL);

ALTER TABLE donateur ADD COLUMN IF NOT EXISTS mode_paiement VARCHAR(30);

ALTER TABLE donateur DROP CONSTRAINT IF EXISTS donateur_mode_paiement_valide;
ALTER TABLE donateur ADD CONSTRAINT donateur_mode_paiement_valide CHECK (
  mode_paiement IS NULL OR mode_paiement IN (
    'mvola', 'orange_money', 'virement_bancaire', 'depot_bancaire',
    'especes', 'carte_bancaire', 'virement_international', 'plateforme'));

ALTER TABLE donateur ADD COLUMN IF NOT EXISTS frequence VARCHAR(10);

ALTER TABLE donateur DROP CONSTRAINT IF EXISTS donateur_frequence_valide;
ALTER TABLE donateur ADD CONSTRAINT donateur_frequence_valide CHECK (
  frequence IS NULL OR frequence IN ('ONE_TIME', 'MONTHLY'));

ALTER TABLE donors
  ADD COLUMN IF NOT EXISTS utilisateur_id UUID REFERENCES utilisateur(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS donors_utilisateur_unique
  ON donors (utilisateur_id) WHERE utilisateur_id IS NOT NULL;

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS utilisateur_id UUID REFERENCES utilisateur(id) ON DELETE CASCADE;

ALTER TABLE benevole ADD COLUMN IF NOT EXISTS pays CHAR(2);

ALTER TABLE benevole DROP CONSTRAINT IF EXISTS benevole_pays_iso;
ALTER TABLE benevole ADD CONSTRAINT benevole_pays_iso CHECK (
  pays IS NULL OR pays ~ '^[A-Z]{2}$');

ALTER TABLE tache
  ADD COLUMN IF NOT EXISTS competences_requises TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS tache_id UUID REFERENCES tache(id) ON DELETE CASCADE;

ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_valide;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_valide CHECK (
  type IN ('DONATION', 'MESSAGE', 'PROJECT_COMPLETED', 'INVESTMENT', 'ACCOUNT_CREATED',
           'TASK_REQUEST', 'TASK_DELIVERED', 'FUNDER_INTEREST', 'FIELD_PROOF'));

ALTER TABLE tache ADD COLUMN IF NOT EXISTS priorite VARCHAR(10) NOT NULL DEFAULT 'moyenne';

ALTER TABLE tache DROP CONSTRAINT IF EXISTS tache_priorite_valide;
ALTER TABLE tache ADD CONSTRAINT tache_priorite_valide CHECK (
  priorite IN ('urgente', 'haute', 'moyenne', 'simple'));

ALTER TABLE tache ADD COLUMN IF NOT EXISTS benevoles_min SMALLINT;
ALTER TABLE tache ADD COLUMN IF NOT EXISTS benevoles_max SMALLINT;

ALTER TABLE tache DROP CONSTRAINT IF EXISTS tache_equipe_coherente;
ALTER TABLE tache ADD CONSTRAINT tache_equipe_coherente CHECK (
  (benevoles_min IS NULL OR benevoles_min >= 1)
  AND (benevoles_max IS NULL OR benevoles_max >= 1)
  AND (benevoles_min IS NULL OR benevoles_max IS NULL OR benevoles_min <= benevoles_max));

ALTER TABLE donations ADD COLUMN IF NOT EXISTS payment_provider VARCHAR(20);
ALTER TABLE donations ADD COLUMN IF NOT EXISTS provider_session_id VARCHAR(120);
ALTER TABLE donations ADD COLUMN IF NOT EXISTS provider_payment_id VARCHAR(120);
ALTER TABLE donations ADD COLUMN IF NOT EXISTS provider_status VARCHAR(40);
ALTER TABLE donations ADD COLUMN IF NOT EXISTS provider_updated_at TIMESTAMPTZ;

ALTER TABLE donations DROP CONSTRAINT IF EXISTS donations_provider_valide;
ALTER TABLE donations ADD CONSTRAINT donations_provider_valide CHECK (
  payment_provider IS NULL OR payment_provider IN ('stripe'));

CREATE UNIQUE INDEX IF NOT EXISTS donations_provider_session_unique
  ON donations (provider_session_id) WHERE provider_session_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS reinitialisation_mot_de_passe (
  id               BIGSERIAL    PRIMARY KEY,
  utilisateur_id   UUID         NOT NULL REFERENCES utilisateur(id) ON DELETE CASCADE,
  jeton_empreinte  CHAR(64)     NOT NULL UNIQUE,
  expire_le        TIMESTAMPTZ  NOT NULL,
  utilise_le       TIMESTAMPTZ,
  cree_le          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS reinitialisation_utilisateur_idx
  ON reinitialisation_mot_de_passe (utilisateur_id) WHERE utilise_le IS NULL;

ALTER TABLE utilisateur ADD COLUMN IF NOT EXISTS email_verifie_le TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS verification_courriel (
  id               BIGSERIAL    PRIMARY KEY,
  utilisateur_id   UUID         NOT NULL REFERENCES utilisateur(id) ON DELETE CASCADE,
  jeton_empreinte  CHAR(64)     NOT NULL UNIQUE,
  expire_le        TIMESTAMPTZ  NOT NULL,
  utilise_le       TIMESTAMPTZ,
  cree_le          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS verification_courriel_utilisateur_idx
  ON verification_courriel (utilisateur_id) WHERE utilise_le IS NULL;

CREATE TABLE IF NOT EXISTS journal_audit (
  id              BIGSERIAL     PRIMARY KEY,
  acteur_type     VARCHAR(12)   NOT NULL,
  acteur_id       VARCHAR(64),
  acteur_libelle  VARCHAR(160),
  action          VARCHAR(160)  NOT NULL,
  libelle         VARCHAR(300)  NOT NULL,
  cible           VARCHAR(120),
  details         JSONB,
  statut_http     INTEGER,
  ip              VARCHAR(64),
  cree_le         TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT journal_audit_acteur_valide CHECK (acteur_type IN ('admin', 'utilisateur', 'systeme'))
);

CREATE INDEX IF NOT EXISTS journal_audit_date_idx ON journal_audit (cree_le DESC);
CREATE INDEX IF NOT EXISTS journal_audit_acteur_idx ON journal_audit (acteur_type, acteur_id);

CREATE TABLE IF NOT EXISTS publication_jaime (
  publication_id UUID        NOT NULL REFERENCES publication(id) ON DELETE CASCADE,
  utilisateur_id UUID        NOT NULL REFERENCES utilisateur(id) ON DELETE CASCADE,
  cree_le        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (publication_id, utilisateur_id)
);

CREATE TABLE IF NOT EXISTS publication_commentaire (
  id             BIGSERIAL     PRIMARY KEY,
  publication_id UUID          NOT NULL REFERENCES publication(id) ON DELETE CASCADE,
  utilisateur_id UUID          REFERENCES utilisateur(id) ON DELETE SET NULL,
  espace         VARCHAR(12),
  texte          VARCHAR(1000) NOT NULL,
  cree_le        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  lu_le          TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS publication_commentaire_pub_idx ON publication_commentaire (publication_id, cree_le DESC);

ALTER TABLE benevole DROP COLUMN IF EXISTS visible_site;
ALTER TABLE benevole ADD COLUMN IF NOT EXISTS masque_site BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS contact_messages (
  id         SERIAL       PRIMARY KEY,
  nom        VARCHAR(120) NOT NULL,
  email      VARCHAR(255) NOT NULL,
  telephone  VARCHAR(30),
  sujet      VARCHAR(40)  NOT NULL,
  message    TEXT         NOT NULL,
  traite_le  TIMESTAMPTZ,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT contact_messages_sujet_valide
    CHECK (sujet IN ('don', 'benevolat', 'partenariat', 'presse', 'autre')),
  CONSTRAINT contact_messages_message_non_vide CHECK (BTRIM(message) <> '')
);

CREATE INDEX IF NOT EXISTS contact_messages_recents_idx ON contact_messages (created_at DESC);

ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_valide;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_valide CHECK (
  type IN ('DONATION', 'MESSAGE', 'PROJECT_COMPLETED', 'INVESTMENT', 'ACCOUNT_CREATED',
           'TASK_REQUEST', 'TASK_DELIVERED', 'FUNDER_INTEREST', 'FIELD_PROOF', 'CONTACT'));
