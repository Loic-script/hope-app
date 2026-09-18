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
  -- HOPE : la mission, pour les beneficiaires. INTERNAL : faire evoluer
  -- HOPE elle-meme -- outils, formation de l'equipe, organisation.
  project_type        VARCHAR(20)   NOT NULL DEFAULT 'HOPE',
  -- Le titre de la description, et non celui du projet : une phrase qui
  -- annonce ce que le texte raconte, ecrite par l'equipe.
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
  -- Un projet termine porte forcement sa date de fin, et inversement.
  CONSTRAINT projects_fin_coherente
    CHECK ((status = 'IN_PROGRESS') = (completed_at IS NULL))
);

CREATE INDEX IF NOT EXISTS projects_status_idx   ON projects (status);
CREATE INDEX IF NOT EXISTS projects_category_idx ON projects (category_id);

-- ------------------------------------------------------------
-- 2 bis. Objectifs specifiques d'un projet
--
--    "Ouvrir une cantine" est le projet ; "servir un repas chaud par
--    jour a 200 eleves" et "former quatre cuisinieres" en sont les
--    objectifs specifiques. Une ligne par objectif plutot qu'un texte
--    unique : c'est une liste qu'on relit point par point, et chaque
--    point pourra plus tard porter son etat ou son indicateur.
--
--    "position" fixe l'ordre de saisie, qui est celui de lecture.
-- ------------------------------------------------------------
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

-- ------------------------------------------------------------
-- 2 ter. Devis d'un projet
--
--    D'ou vient le budget necessaire. Une ligne par poste : "Fournitures
--    scolaires, 1 200 000 Ar". Quand il y a au moins une ligne, le
--    required_budget du projet n'est plus saisi mais calcule -- leur
--    somme. Sans ligne, il reste saisi a la main : celui qui connait
--    deja le montant ne doit pas etre oblige de le detailler.
--
--    "category" reprend le vocabulaire des depenses, ce qui permettra
--    de comparer le prevu au reel poste par poste. Elle reste
--    facultative : un devis approximatif vaut mieux que pas de devis.
--
--    Le devis ne touche pas au circuit de l'argent. Ce n'est pas un
--    budget qui vit sa vie a cote des dons, des investissements et des
--    depenses : c'est la facon d'arriver a un chiffre.
-- ------------------------------------------------------------
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
  -- L'objectif specifique que cette mesure documente. Facultatif : une
  -- mesure peut porter sur le projet entier plutot que sur un point
  -- precis. SET NULL, car retirer un objectif ne doit pas effacer ce
  -- qui a ete mesure.
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
-- 16. Comptes des espaces non administrateurs
--
-- Un compte par personne, et un ou plusieurs roles a cote : la meme
-- personne peut etre a la fois donatrice et benevole, sans double
-- inscription.
--
-- Ces comptes n'ont rien a voir avec la table "admins" : un benevole
-- ne peut pas se connecter a l'espace administrateur, et vice versa.
-- Les jetons des deux espaces portent d'ailleurs une audience
-- differente, donc l'un ne vaut jamais pour l'autre.
--
-- Trois ecarts assumes avec le modele fourni :
--
--   * telephone accepte NULL. Le formulaire d'inscription ne le
--     demande pas ; la contrainte d'unicite continue de s'appliquer
--     des qu'il est renseigne.
--   * statut vaut "en_attente" a la creation et non "actif" : c'est
--     l'administrateur qui ouvre l'acces a l'espace.
--   * age n'est pas stocke. Il se deduit de date_de_naissance, et une
--     colonne figee serait fausse des le lendemain de l'anniversaire.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS utilisateur (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom                VARCHAR(80)  NOT NULL,
  prenom             VARCHAR(80)  NOT NULL,
  -- Identifiant principal a Madagascar, renseigne apres l'inscription.
  telephone          VARCHAR(20)  UNIQUE,
  -- Stocke en minuscules : c'est lui qui sert a se connecter.
  email              VARCHAR(160) UNIQUE,
  -- Hash bcrypt. Le mot de passe en clair ne touche jamais la base.
  mot_de_passe       VARCHAR(255) NOT NULL,
  photo_url          TEXT,
  adresse            VARCHAR(255),
  date_de_naissance  DATE,
  statut             VARCHAR(20)  NOT NULL DEFAULT 'en_attente',
  telephone_verifie  BOOLEAN      NOT NULL DEFAULT FALSE,
  cree_le            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  derniere_connexion TIMESTAMPTZ,
  -- Le compte existe, mais la fiche propre a son role est-elle remplie ?
  -- Un marqueur explicite plutot qu'une deduction : un benevole peut
  -- legitimement n'avoir declare aucune competence, et on ne doit pas
  -- lui redemander son formulaire a chaque connexion.
  profil_complete    BOOLEAN      NOT NULL DEFAULT FALSE,
  -- Trace de l'activation : qui a ouvert l'acces, et quand.
  active_le          TIMESTAMPTZ,
  active_par         INTEGER      REFERENCES admins(id) ON DELETE SET NULL,

  CONSTRAINT utilisateur_statut_valide
    CHECK (statut IN ('en_attente', 'actif', 'suspendu', 'supprime')),

  -- Un compte injoignable ne sert a rien : au moins un des deux.
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

-- Les tables existantes ne recoivent pas les colonnes ajoutees apres
-- coup : CREATE TABLE IF NOT EXISTS ne les voit pas.
ALTER TABLE utilisateur
  ADD COLUMN IF NOT EXISTS profil_complete BOOLEAN NOT NULL DEFAULT FALSE;

-- La liste des comptes a activer est la requete la plus frequente.
CREATE INDEX IF NOT EXISTS utilisateur_statut_idx ON utilisateur (statut);
CREATE INDEX IF NOT EXISTS utilisateur_role_idx   ON utilisateur_role (role);

-- ------------------------------------------------------------
-- 17. Espace benevole : profil, missions, taches, avis
--
-- Un benevole est un "utilisateur" portant le role benevole, plus une
-- fiche de terrain : ce qu'il sait faire, quand il est libre, jusqu'ou
-- il accepte de se deplacer.
--
-- Quatre raccords s'ecartent du modele fourni, faute de quoi rien ne
-- se lierait a la base existante :
--
--   * projet_id est un INTEGER qui pointe "projects". Le modele
--     annoncait un UUID vers une table "projet" qui n'existe pas ici :
--     les projets sont en anglais et leur cle est un entier.
--   * les validateurs HOPE (valide_par, encadreur_id, validee_par)
--     pointent "admins", pas "utilisateur" : l'equipe HOPE a sa propre
--     table, et un benevole ne valide pas ses propres heures.
--   * date_naissance n'est pas repetee sur "benevole" : elle vit deja
--     sur "utilisateur". Deux copies finiraient par diverger.
--   * les places restantes ne sont pas stockees : elles se comptent
--     depuis les inscriptions, seule source qui ne peut pas mentir.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS benevole (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  utilisateur_id      UUID NOT NULL UNIQUE REFERENCES utilisateur(id) ON DELETE CASCADE,
  profession          VARCHAR(120),
  -- Ex : {'traduction','informatique','cuisine'}
  competences         TEXT[]      NOT NULL DEFAULT ARRAY[]::TEXT[],
  -- Ex : {'malgache','francais','anglais'}
  langues             TEXT[]      NOT NULL DEFAULT ARRAY[]::TEXT[],
  -- Ex : {"mercredi":["matin"],"samedi":["journee"]}
  disponibilites      JSONB       NOT NULL DEFAULT '{}'::JSONB,
  -- Distance acceptee depuis son quartier.
  rayon_km            SMALLINT,
  accepte_terrain     BOOLEAN     NOT NULL DEFAULT TRUE,
  accepte_distance    BOOLEAN     NOT NULL DEFAULT TRUE,
  contact_urgence_nom VARCHAR(120),
  contact_urgence_tel VARCHAR(20),
  -- Exige pour les missions de terrain, pas pour celles a distance.
  valide_par_hope     BOOLEAN     NOT NULL DEFAULT FALSE,
  valide_le           TIMESTAMPTZ,
  valide_par          INTEGER     REFERENCES admins(id) ON DELETE SET NULL,
  benevole_depuis     DATE        NOT NULL DEFAULT CURRENT_DATE,
  -- Reserve a l'equipe HOPE : jamais renvoye a l'espace benevole.
  notes_internes      TEXT,
  cree_le             TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT benevole_rayon_positif CHECK (rayon_km IS NULL OR rayon_km >= 0)
);

CREATE TABLE IF NOT EXISTS mission (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  projet_id          INTEGER      NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
  titre              VARCHAR(160) NOT NULL,
  description        TEXT,
  -- Ex : "Ankadifotsy, Antananarivo"
  lieu_nom           VARCHAR(160),
  latitude           NUMERIC(9,6),
  longitude          NUMERIC(9,6),
  format             VARCHAR(20)  NOT NULL,
  date_debut         TIMESTAMPTZ  NOT NULL,
  date_fin           TIMESTAMPTZ  NOT NULL,
  -- Regle RRULE, ex : 'FREQ=WEEKLY;BYDAY=WE'
  recurrence         VARCHAR(120),
  places_total       SMALLINT     NOT NULL,
  encadreur_id       INTEGER      REFERENCES admins(id) ON DELETE SET NULL,
  -- Ex : {'tenue confortable','bouteille d''eau'}
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
  -- Saisi par l'encadreur apres la mission.
  heures_validees  NUMERIC(4,1),
  valide_par       INTEGER      REFERENCES admins(id) ON DELETE SET NULL,

  -- Un benevole ne s'inscrit qu'une fois a la meme mission.
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
  -- NULL : personne ne l'a prise.
  benevole_id  UUID         REFERENCES benevole(id) ON DELETE SET NULL,
  prise_le     TIMESTAMPTZ,
  livree_le    TIMESTAMPTZ,
  validee_par  INTEGER      REFERENCES admins(id) ON DELETE SET NULL,
  cree_le      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  CONSTRAINT tache_statut_valide
    CHECK (statut IN ('a_faire', 'en_cours', 'livree')),

  -- Une tache prise a forcement quelqu'un derriere, et inversement.
  CONSTRAINT tache_prise_coherente
    CHECK ((statut = 'a_faire' AND benevole_id IS NULL)
        OR (statut <> 'a_faire' AND benevole_id IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS tache_benevole_idx ON tache (benevole_id, statut);
CREATE INDEX IF NOT EXISTS tache_projet_idx   ON tache (projet_id, statut);

/*
 * La preuve d'une tache livree : les photos et videos que le benevole
 * joint en la declarant faite.
 *
 * Rattachee a la tache et non publiee comme preuve terrain : ce que
 * voient les donateurs reste un choix de l'equipe. Elle sert d'abord a
 * valider la livraison.
 *
 * Les colonnes sont nommees comme celles de la tache ; l'API les
 * expose sous la forme des fichiers de preuve (fileName, mimeType...),
 * pour que les memes composants de lecture servent aux deux.
 */
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

CREATE TABLE IF NOT EXISTS avis_mission (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id  UUID        NOT NULL REFERENCES mission(id) ON DELETE CASCADE,
  benevole_id UUID        NOT NULL REFERENCES benevole(id) ON DELETE CASCADE,
  note        SMALLINT    NOT NULL CHECK (note BETWEEN 1 AND 5),
  commentaire TEXT,
  -- Moderation de l'equipe HOPE.
  publie      BOOLEAN     NOT NULL DEFAULT TRUE,
  cree_le     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (mission_id, benevole_id)
);

CREATE INDEX IF NOT EXISTS avis_mission_idx ON avis_mission (mission_id, publie);

-- ------------------------------------------------------------
-- 18. Espace bailleur : organisations, engagements, versements
--
-- Trois notions qu'il ne faut jamais confondre :
--
--   engagement  = ce qui est promis
--   versement   = ce qui est reellement arrive
--   affectation = la part attribuee a un projet
--
-- Le bailleur ne paie jamais dans l'application : les virements
-- arrivent hors ligne et le back-office les saisit ensuite. Cet espace
-- est donc en lecture seule sur les montants.
--
-- Quatre raccords s'ecartent du modele fourni, faute de quoi rien ne se
-- lierait a la base existante :
--
--   * projet_id est un INTEGER vers "projects" : la table "projet"
--     annoncee n'existe pas ici, et sa cle est un entier.
--   * saisi_par et publie_par pointent "admins" : ce sont des gestes de
--     back-office, et l'equipe HOPE a sa propre table.
--   * le domaine d'un projet se lit dans project_categories, sa zone
--     dans projects.location : il n'y a pas de colonne "domaine".
--   * partenaire_depuis prend la date du jour par defaut, au lieu
--     d'etre obligatoire : a l'inscription, personne ne la connait.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bailleur (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  raison_sociale    VARCHAR(200) NOT NULL,
  type_organisation VARCHAR(40)  NOT NULL,
  secteur           VARCHAR(120),
  pays              VARCHAR(80)  NOT NULL DEFAULT 'Madagascar',
  adresse           TEXT,
  site_web          TEXT,
  logo_url          TEXT,
  -- Numero fiscal, utile pour les justificatifs.
  nif               VARCHAR(40),
  partenaire_depuis DATE         NOT NULL DEFAULT CURRENT_DATE,
  statut            VARCHAR(20)  NOT NULL DEFAULT 'prospect',
  -- Le badge "Partenaire Or" de la maquette.
  niveau            VARCHAR(20),
  -- Reserve a l'equipe HOPE : jamais renvoye a l'espace bailleur.
  notes_internes    TEXT,
  cree_le           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  -- "autre" est le type pose a l'inscription : le compte se cree sans
  -- rien demander, et l'organisation se precise ensuite depuis
  -- "Mon organisation".
  CONSTRAINT bailleur_type_valide
    CHECK (type_organisation IN
      ('fondation_privee', 'entreprise', 'agence_publique', 'ong', 'ambassade', 'autre')),
  CONSTRAINT bailleur_statut_valide
    CHECK (statut IN ('prospect', 'actif', 'en_pause', 'termine')),
  CONSTRAINT bailleur_niveau_valide
    CHECK (niveau IS NULL OR niveau IN ('bronze', 'argent', 'or'))
);

-- Un bailleur n'est pas une personne : plusieurs employes peuvent se
-- connecter, et les gens changent de poste. Toute requete de l'espace
-- filtre donc sur bailleur_id, jamais sur utilisateur_id.
-- Les bases creees avant le type "autre" portent encore l'ancienne
-- regle : une contrainte CHECK ne se modifie pas en place.
ALTER TABLE bailleur DROP CONSTRAINT IF EXISTS bailleur_type_valide;
ALTER TABLE bailleur ADD CONSTRAINT bailleur_type_valide
  CHECK (type_organisation IN
    ('fondation_privee', 'entreprise', 'agence_publique', 'ong', 'ambassade', 'autre'));

CREATE TABLE IF NOT EXISTS bailleur_contact (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bailleur_id       UUID    NOT NULL REFERENCES bailleur(id) ON DELETE CASCADE,
  -- NULL tant que la personne n'a pas de compte.
  utilisateur_id    UUID    UNIQUE REFERENCES utilisateur(id) ON DELETE SET NULL,
  fonction          VARCHAR(120),
  contact_principal BOOLEAN NOT NULL DEFAULT FALSE,
  peut_consulter    BOOLEAN NOT NULL DEFAULT TRUE,
  peut_telecharger  BOOLEAN NOT NULL DEFAULT TRUE,
  actif             BOOLEAN NOT NULL DEFAULT TRUE,
  cree_le           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Un seul contact principal par organisation.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_contact_principal
  ON bailleur_contact (bailleur_id) WHERE contact_principal;

CREATE TABLE IF NOT EXISTS engagement (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bailleur_id          UUID         NOT NULL REFERENCES bailleur(id) ON DELETE CASCADE,
  -- Ex : "Financement — Education 2026"
  intitule             VARCHAR(200) NOT NULL,
  type_soutien         VARCHAR(30)  NOT NULL,
  -- NULL pour un soutien en competences ou en materiel.
  montant_engage       NUMERIC(14,2),
  devise               CHAR(3)      NOT NULL DEFAULT 'MGA',
  -- Pour les soutiens non financiers : 'session', 'kit', 'heure'...
  unite                VARCHAR(40),
  quantite_engagee     NUMERIC(10,2),
  quantite_realisee    NUMERIC(10,2) NOT NULL DEFAULT 0,
  -- Valeur estimee en Ar, pour les rapports.
  valorisation         NUMERIC(14,2),
  date_signature       DATE         NOT NULL,
  date_debut           DATE         NOT NULL,
  date_fin             DATE,
  reference_convention VARCHAR(80),
  convention_url       TEXT,
  -- Le pendant, cote bailleur, du don non affecte : HOPE choisit alors
  -- les projets.
  affectation_libre    BOOLEAN      NOT NULL DEFAULT FALSE,
  statut               VARCHAR(20)  NOT NULL DEFAULT 'en_cours',
  cree_le              TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  CONSTRAINT engagement_type_valide
    CHECK (type_soutien IN ('financier', 'competences', 'materiel')),
  CONSTRAINT engagement_statut_valide
    CHECK (statut IN ('en_cours', 'finalise', 'suspendu', 'annule')),
  CONSTRAINT engagement_periode_coherente
    CHECK (date_fin IS NULL OR date_fin >= date_debut),
  -- Un soutien financier porte un montant ; les autres une quantite.
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
  -- NULL : le versement est attendu, pas encore arrive.
  date_recue         DATE,
  moyen              VARCHAR(30),
  reference_bancaire VARCHAR(80),
  justificatif_url   TEXT,
  -- Saisi par le back-office : le bailleur n'ecrit jamais ici.
  saisi_par          INTEGER       REFERENCES admins(id) ON DELETE SET NULL,
  statut             VARCHAR(20)   NOT NULL DEFAULT 'attendu',
  cree_le            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT versement_statut_valide
    CHECK (statut IN ('attendu', 'recu', 'en_retard', 'annule')),
  CONSTRAINT versement_moyen_valide
    CHECK (moyen IS NULL OR moyen IN ('virement', 'cheque', 'especes', 'mobile_money')),
  CONSTRAINT versement_montant_positif CHECK (montant > 0),
  -- Un versement recu a forcement une date de reception.
  CONSTRAINT versement_recu_date
    CHECK (statut <> 'recu' OR date_recue IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS versement_engagement_idx ON versement (engagement_id, statut);

-- La table centrale de la vue consolidee : un engagement peut nourrir
-- plusieurs projets, et un projet recevoir plusieurs engagements.
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
  -- NULL : document global, tous engagements confondus.
  engagement_id      UUID         REFERENCES engagement(id) ON DELETE CASCADE,
  -- NULL : tous domaines.
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
  -- Savoir si le rapport est reellement lu.
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
  -- Description de la condition, en clair.
  regle   TEXT
);

CREATE TABLE IF NOT EXISTS bailleur_distinction (
  bailleur_id      UUID        NOT NULL REFERENCES bailleur(id) ON DELETE CASCADE,
  distinction_code VARCHAR(40) NOT NULL REFERENCES distinction(code) ON DELETE CASCADE,
  obtenue_le       DATE        NOT NULL DEFAULT CURRENT_DATE,

  PRIMARY KEY (bailleur_id, distinction_code)
);

-- ------------------------------------------------------------
-- Regle d'or contre le double comptage
--
-- La somme des affectations d'un engagement ne doit jamais depasser le
-- montant engage. C'est exactement ce que veut dire "finances a ce jour
-- sans double comptage".
--
-- Le controle est ici, en base, et non seulement dans le service : une
-- correction faite a la main en SQL doit se heurter a la meme regle.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION verifier_affectation_engagement()
RETURNS TRIGGER AS $$
DECLARE
  plafond NUMERIC(14,2);
  deja    NUMERIC(14,2);
BEGIN
  SELECT montant_engage INTO plafond
    FROM engagement WHERE id = NEW.engagement_id;

  -- Un engagement en competences ou en materiel n'a pas de plafond
  -- financier : rien a verifier.
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

-- ------------------------------------------------------------
-- 19. Fil d'actualite et manifestations d'interet
--
-- Ces deux tables ne figuraient pas dans le modele fourni, mais le
-- comportement decrit les suppose : un fil filtre par cible, et un
-- bouton "Financer ce projet" qui ne debite rien.
--
-- Le bouton ne cree donc pas un engagement : il enregistre une
-- intention et notifie l'equipe, qui prend contact hors ligne. La
-- plateforme enregistre la relation, elle ne la remplace pas.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS publication (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type          VARCHAR(30)  NOT NULL DEFAULT 'actualite',
  titre         VARCHAR(200) NOT NULL,
  corps         TEXT,
  projet_id     INTEGER      REFERENCES projects(id) ON DELETE SET NULL,
  -- La photo propre a la publication. NULL : elle reprend celle du
  -- projet lie, lue a l'affichage -- changer la photo du projet change
  -- donc celle de ses actualites.
  media_url     TEXT,
  -- Cibles de diffusion : {'bailleurs'}, {'donateurs','bailleurs'}...
  cibles        TEXT[]       NOT NULL DEFAULT ARRAY['bailleurs']::TEXT[],
  -- Ancienne cible saisie a la main. La barre d'un appel se lit
  -- desormais sur le projet lie : budget et somme investie.
  montant_cible NUMERIC(14,2),
  publie_le     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  publie_par    INTEGER      REFERENCES admins(id) ON DELETE SET NULL,

  CONSTRAINT publication_type_valide
    CHECK (type IN ('actualite', 'appel_financement'))
);

CREATE INDEX IF NOT EXISTS publication_date_idx ON publication (publie_le DESC);

-- Un appel n'a plus de montant saisi : la contrainte qui l'exigeait tombe.
-- Le projet lie, lui, est verifie par le service -- une contrainte le
-- rendrait impossible a supprimer, la cle passant a NULL.
ALTER TABLE publication DROP CONSTRAINT IF EXISTS publication_appel_chiffre;

CREATE TABLE IF NOT EXISTS manifestation_interet (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bailleur_id    UUID        NOT NULL REFERENCES bailleur(id) ON DELETE CASCADE,
  publication_id UUID        REFERENCES publication(id) ON DELETE SET NULL,
  projet_id      INTEGER     REFERENCES projects(id) ON DELETE SET NULL,
  message        TEXT,
  -- Qui a clique, pour que l'equipe sache a qui parler.
  contact_id     UUID        REFERENCES bailleur_contact(id) ON DELETE SET NULL,
  statut         VARCHAR(20) NOT NULL DEFAULT 'nouvelle',
  cree_le        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT manifestation_statut_valide
    CHECK (statut IN ('nouvelle', 'contactee', 'convertie', 'classee')),
  -- Une seule manifestation vivante par bailleur et par publication.
  UNIQUE (bailleur_id, publication_id)
);

-- L'administration lit les interets publication par publication.
CREATE INDEX IF NOT EXISTS manifestation_publication_idx
  ON manifestation_interet (publication_id);

-- ------------------------------------------------------------
-- 20. Declencheurs updated_at
-- ------------------------------------------------------------
/* ================================================================
   Notifications et messages des espaces utilisateurs

   L'administrateur avait les siens depuis le debut ; le benevole et le
   bailleur n'avaient rien. Ces deux tables leur servent a tous les deux
   -- et au donateur le jour ou son espace existera -- puisqu'elles ne
   connaissent que "utilisateur", sans distinguer le role.

   Elles ne remplacent pas les tables du back-office :
     * "notifications" reste le fil d'alertes de l'equipe, indexe sur les
       dons, les projets et les messages recus ;
     * "messages" reste le courrier venu du site public, rattache aux
       anciens comptes donateurs.
   Les deux mondes n'ont ni les memes cles ni les memes destinataires.
   ================================================================ */

CREATE TABLE IF NOT EXISTS notification_utilisateur (
  id             BIGSERIAL PRIMARY KEY,
  utilisateur_id UUID         NOT NULL REFERENCES utilisateur(id) ON DELETE CASCADE,
  type           VARCHAR(40)  NOT NULL,
  titre          VARCHAR(160) NOT NULL,
  corps          TEXT,
  -- Chemin interne vers ce dont la notification parle : "/benevole/taches".
  -- Jamais une URL externe, que rien ne validerait.
  lien           VARCHAR(200),
  lu             BOOLEAN      NOT NULL DEFAULT FALSE,
  cree_le        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Le fil se lit toujours de la meme facon : les miennes, les non lues
-- d'abord, la plus recente en tete.
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
  -- Faux tant que l'utilisateur n'a pas ouvert la reponse : c'est ce
  -- drapeau qui alimente la pastille de son menu.
  reponse_lue    BOOLEAN      NOT NULL DEFAULT TRUE,
  cree_le        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  CONSTRAINT message_utilisateur_statut_valide
    CHECK (statut IN ('envoye', 'repondu', 'clos')),
  -- Un message repondu porte sa reponse, et reciproquement : sans cette
  -- regle, un statut mis a jour sans texte laisserait un fil muet.
  CONSTRAINT message_utilisateur_reponse_coherente
    CHECK ((statut = 'repondu') = (reponse IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS message_utilisateur_idx
  ON message_utilisateur (utilisateur_id, cree_le DESC);

/*
 * Les messages du fil.
 *
 * "message_utilisateur" portait au depart le message ET sa reponse, en
 * deux colonnes : un aller, un retour, et fin de la conversation. Des
 * que le benevole doit pouvoir repondre a la reponse, ce modele ne tient
 * plus -- le fil devient une suite, et chaque prise de parole une ligne.
 *
 * Le fil garde le sujet et le statut ; les paroles vivent ici.
 */
CREATE TABLE IF NOT EXISTS message_entree (
  id       BIGSERIAL   PRIMARY KEY,
  fil_id   BIGINT      NOT NULL REFERENCES message_utilisateur(id) ON DELETE CASCADE,
  -- Qui parle. "hope" couvre toute l'equipe ; admin_id dit qui, quand on
  -- le sait, sans que la lecture en depende.
  auteur   VARCHAR(12) NOT NULL,
  corps    TEXT        NOT NULL,
  admin_id INTEGER     REFERENCES admins(id) ON DELETE SET NULL,
  -- Lu par l'autre bout. C'est ce drapeau qui allume les pastilles, des
  -- deux cotes.
  lu       BOOLEAN     NOT NULL DEFAULT FALSE,
  cree_le  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT message_entree_auteur_valide CHECK (auteur IN ('utilisateur', 'hope'))
);

CREATE INDEX IF NOT EXISTS message_entree_idx ON message_entree (fil_id, cree_le);

/*
 * Reprise des fils ecrits avant le decoupage : le corps devient la
 * premiere parole, la reponse la seconde. Les quatre colonnes qui les
 * portaient s'en vont ensuite, ainsi que la contrainte qui liait le
 * statut a la presence d'une reponse.
 */
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

/* ================================================================
   Conversations entre personnes

   La messagerie precedente n'avait qu'un destinataire : HOPE. Un
   benevole ecrivait a l'equipe, l'equipe repondait, et deux benevoles
   d'une meme mission n'avaient aucun moyen de se parler.

   Ici une conversation reunit des participants, et chacun peut y
   ecrire. Le modele ne connait pas les roles : un administrateur y est
   un participant comme un autre.

   Deux tables d'identite coexistent dans HOPE -- "utilisateur" pour ceux
   qui s'inscrivent, "admins" pour l'equipe. Un participant porte donc
   l'une OU l'autre, jamais les deux, et une contrainte le verifie. Les
   fondre en une seule table aurait touche l'authentification des quatre
   espaces ; ce n'est pas le moment.
   ================================================================ */

CREATE TABLE IF NOT EXISTS conversation (
  id      BIGSERIAL    PRIMARY KEY,
  -- Facultatif : les conversations ouvertes depuis l'annuaire n'en ont
  -- pas. Il ne survit que des anciens fils adresses a l'equipe.
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
  -- Jusqu'ou cette personne a lu. Un horodatage plutot qu'un drapeau par
  -- message : le non-lu se compte alors d'une comparaison, et rien n'est
  -- a mettre a jour message par message.
  lu_jusqu_a      TIMESTAMPTZ,
  rejoint_le      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT participant_une_seule_identite CHECK (
    (utilisateur_id IS NOT NULL AND admin_id IS NULL) OR
    (utilisateur_id IS NULL AND admin_id IS NOT NULL)
  )
);

-- Une personne ne figure qu'une fois dans une conversation. Deux index
-- partiels plutot qu'une contrainte unique : la colonne inutilisee vaut
-- NULL, et NULL n'entre pas dans une unicite composee.
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
  -- L'auteur, dans l'une des deux tables d'identite. Mis a NULL si le
  -- compte disparait : le message reste, la conversation garde son sens.
  utilisateur_id  UUID        REFERENCES utilisateur(id) ON DELETE SET NULL,
  admin_id        INTEGER     REFERENCES admins(id) ON DELETE SET NULL,
  corps           TEXT        NOT NULL,
  cree_le         TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Ce qu'il faut interdire, c'est qu'un message ait DEUX auteurs.
  --
  -- La regle etait d'abord "exactement une identite". Elle ne pouvait
  -- pas tenir avec le ON DELETE SET NULL ci-dessus : supprimer un
  -- compte qui avait ecrit mettait ses deux colonnes a NULL et heurtait
  -- la contrainte, si bien qu'aucun compte ayant parle n'etait plus
  -- supprimable. Les deux colonnes a NULL sont donc admises : c'est la
  -- trace d'un compte efface, et elle s'affiche "Compte supprimé".
  --
  -- La presence d'un auteur a l'ecriture reste garantie par le service,
  -- seule voie d'insertion.
  CONSTRAINT message_jamais_deux_auteurs
    CHECK (utilisateur_id IS NULL OR admin_id IS NULL)
);

-- Les bases creees avant ce raisonnement portent encore l'ancienne
-- regle : CREATE TABLE IF NOT EXISTS ne les voit pas.
ALTER TABLE conversation_message
  DROP CONSTRAINT IF EXISTS message_une_seule_identite;

ALTER TABLE conversation_message
  DROP CONSTRAINT IF EXISTS message_jamais_deux_auteurs;

ALTER TABLE conversation_message
  ADD CONSTRAINT message_jamais_deux_auteurs
    CHECK (utilisateur_id IS NULL OR admin_id IS NULL);

CREATE INDEX IF NOT EXISTS conversation_message_idx
  ON conversation_message (conversation_id, cree_le);

/*
 * Reprise des fils adresses a l'equipe.
 *
 * Chaque fil devient une conversation entre son auteur et
 * l'administrateur qui lui avait repondu -- a defaut, le premier de la
 * table : il faut bien quelqu'un en face pour que la conversation existe.
 */
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

    -- L'auteur du fil.
    INSERT INTO conversation_participant (conversation_id, utilisateur_id, lu_jusqu_a)
    SELECT id, utilisateur_id, updated_at FROM message_utilisateur;

    -- L'equipe, en la personne de qui a repondu.
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

/* ================================================================
 * Messagerie complete : groupes, assistance, pieces jointes
 * ================================================================ */

/*
 * Le fil.
 *
 * "individuel" reunit deux personnes, "groupe" en reunit davantage.
 * Le nom et la photo n'existent que pour un groupe : un fil individuel
 * montre a chacun l'autre personne, et ne stocke donc rien.
 *
 * "assistance" marque le fil entre un utilisateur et l'equipe : chaque
 * administrateur actif y participe, et l'utilisateur y voit "l'equipe"
 * plutot qu'une personne.
 */
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
  -- Un groupe se nomme ; un fil individuel ne porte pas de nom, puisque
  -- chacun y voit l'autre.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'conversation_nom_de_groupe') THEN
    ALTER TABLE conversation
      ADD CONSTRAINT conversation_nom_de_groupe
        CHECK ((type = 'groupe' AND nom IS NOT NULL AND BTRIM(nom) <> '')
            OR (type = 'individuel' AND nom IS NULL));
  END IF;
END
$$;

/*
 * Les anciens fils "ecrire a HOPE" etaient adresses a l'equipe, pas a une
 * personne : ils portaient un sujet. Ils deviennent des fils d'assistance
 * -- une seule fois, et le reste de l'equipe y est inscrit comme lecteur a
 * jour, pour ne pas lui faire lire comme neuf un historique deja traite.
 */
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

/*
 * Le message.
 *
 * - auteur_nom : le nom affiche, copie a l'ecriture. Il survit au compte,
 *   et un groupe relu dans un an dit encore qui parlait.
 * - corps peut etre vide quand le message porte des pieces jointes ; il
 *   est aussi vide une fois le message supprime.
 * - supprime_le : suppression logique. La bulle garde sa place dans le
 *   fil, son contenu et ses pieces disparaissent.
 */
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

/*
 * La piece jointe.
 *
 * "fichier" est le nom sur le disque : un UUID, jamais le nom d'origine.
 * Le dossier est prive -- rien ne le sert directement, seule la route de
 * lecture controlee y accede, apres verification de la participation.
 */
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

-- Le non-lu se compte sur les messages recents, non supprimes, d'un fil.
CREATE INDEX IF NOT EXISTS conversation_message_vivants_idx
  ON conversation_message (conversation_id, cree_le) WHERE supprime_le IS NULL;

/*
 * La photo des membres de l'equipe.
 *
 * "utilisateur" en portait une depuis le debut ; "admins" non, et les
 * conversations montraient donc des initiales d'un cote et des visages
 * de l'autre. La meme colonne, au meme format : un chemin /media servi
 * par HOPE.
 */
ALTER TABLE admins ADD COLUMN IF NOT EXISTS photo_url VARCHAR(255);

/*
 * Le titre de la description d'un projet.
 *
 * Distinct du nom du projet : celui-ci designe, celui-la annonce. Une
 * fiche ouvrait sur un paragraphe sans en-tete, et rien ne disait en une
 * ligne ce que le projet allait raconter.
 */
ALTER TABLE projects ADD COLUMN IF NOT EXISTS description_titre VARCHAR(160);

/*
 * Le type d'un projet : la mission de HOPE, ou HOPE elle-meme.
 *
 * Les projets existants sont tous des projets de terrain : ils prennent
 * la valeur par defaut. La contrainte est posee a part, et seulement si
 * elle manque -- PostgreSQL n'a pas de ADD CONSTRAINT IF NOT EXISTS.
 */
ALTER TABLE projects ADD COLUMN IF NOT EXISTS project_type VARCHAR(20) NOT NULL DEFAULT 'HOPE';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'projects_type_valide') THEN
    ALTER TABLE projects
      ADD CONSTRAINT projects_type_valide CHECK (project_type IN ('HOPE', 'INTERNAL'));
  END IF;
END
$$;

/*
 * L'objectif specifique qu'une mesure d'impact documente.
 *
 * Les deux tableaux de l'onglet Impact ne disaient pas la meme chose et
 * portaient pourtant le meme contenu : le cumul par indicateur repond a
 * la description du projet, chaque mesure repond a un objectif. Encore
 * fallait-il pouvoir dire lequel.
 */
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

-- ------------------------------------------------------------
-- 21. Rattrapage des comptes anterieurs a profil_complete
--
-- La colonne utilisateur.profil_complete est arrivee apres les premiers
-- comptes, avec DEFAULT FALSE : les benevoles et bailleurs deja en base
-- se verraient donc redemander un formulaire qu'ils ont deja rempli.
--
-- On ne peut pas deviner l'intention, mais on peut lire le fait : si la
-- fiche propre au role existe, le formulaire a bien ete rempli. Le
-- rattrapage ne remet jamais un marqueur a FALSE -- un benevole qui n'a
-- declare aucune competence reste complet -- et ne touche donc qu'aux
-- comptes restes a FALSE. Il est ainsi sans effet au second passage.
--
-- Le donateur n'a pas de formulaire : son compte n'entre pas ici.
-- ------------------------------------------------------------
UPDATE utilisateur u
   SET profil_complete = TRUE
 WHERE u.profil_complete = FALSE
   AND (
     EXISTS (SELECT 1 FROM benevole b WHERE b.utilisateur_id = u.id)
     OR EXISTS (SELECT 1 FROM bailleur_contact c WHERE c.utilisateur_id = u.id)
   );

-- Le cas inverse : un compte marque complet dont la fiche a disparu.
-- Une remise a zero du jeu de demonstration vide "bailleur" en cascade
-- sans toucher aux comptes qui n'en font pas partie ; leur marqueur
-- resterait a TRUE et ils entreraient dans un espace sans organisation.
-- On leur redemande donc leur formulaire, ce qui est la verite.
--
-- Le donateur n'entre pas ici : il n'a pas de fiche, et son marqueur ne
-- commande aucun formulaire.
UPDATE utilisateur u
   SET profil_complete = FALSE
 WHERE u.profil_complete = TRUE
   AND EXISTS (
     SELECT 1 FROM utilisateur_role r
      WHERE r.utilisateur_id = u.id
        AND r.role IN ('benevole', 'bailleur'))
   AND NOT EXISTS (SELECT 1 FROM benevole b WHERE b.utilisateur_id = u.id)
   AND NOT EXISTS (SELECT 1 FROM bailleur_contact c WHERE c.utilisateur_id = u.id);

/*
 * Le contenu lisible d'un document de bailleur.
 *
 * Le rapport n'existait que dans son PDF : pour en montrer un extrait,
 * il fallait aller chercher le fichier, et un gestionnaire de
 * telechargement installe sur le poste du partenaire s'en saisissait
 * avant le navigateur -- la fenetre restait vide et un enregistrement
 * demarrait. L'apercu se sert desormais d'ici, sans qu'aucun fichier ne
 * circule.
 *
 * Forme : { "sousTitre": "...", "blocs": [ { "t": "h2", "texte": "..." },
 * { "t": "p", "texte": "..." }, { "t": "puce", "texte": "..." },
 * { "t": "kv", "lignes": [["libelle", "valeur"], ...] } ] } -- le meme
 * vocabulaire que celui dont le PDF est compose, pour que les deux
 * disent exactement la meme chose.
 *
 * NULL est permis : un document televerse par HOPE n'a pas de contenu
 * structure, et l'espace propose alors son telechargement.
 */
ALTER TABLE document_bailleur ADD COLUMN IF NOT EXISTS contenu JSONB;

/*
 * La fiche du donateur.
 *
 * Le pendant de "benevole" et de "bailleur_contact" : ce que le compte
 * ne dit pas. Le nom, le prenom, l'adresse et le telephone vivent sur
 * "utilisateur", comme pour les deux autres ; ici, le reste.
 *
 * Elle se remplit au fil d'un parcours en cinq etapes, ouvert des
 * l'inscription. "etape_suivante" dit ou le donateur reprendra : il peut
 * s'arreter entre deux etapes sans rien perdre de ce qu'il a donne.
 *
 * - pays : code ISO 3166-1 alpha-2 ("MG"), et non un libelle. C'est de
 *   lui qu'on deduira le fuseau horaire, et un code ne s'orthographie
 *   pas de deux facons.
 * - source_connaissance : comment il a connu HOPE. Un code, pour que
 *   l'equipe puisse compter ; la liste est tenue par le service.
 */
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
  -- 6 : le parcours est termine.
  CONSTRAINT donateur_etape_valide CHECK (etape_suivante BETWEEN 1 AND 6)
);

/*
 * La fiche du donateur, etape 2 : son profil et ses preferences.
 *
 * - type_donateur : particulier, ou une structure (entreprise,
 *   fondation, organisation, partenaire), ou un donateur de l'etranger.
 * - nom_structure : la raison sociale, exigee pour une structure -- c'est
 *   elle qui figurera sur les recus. NULL pour un particulier.
 * - devise : l'une de celles que HOPE accepte pour un don (money.js).
 *   Une preference qu'aucun don ne pourrait honorer ne servirait a rien.
 * - langue : celle des messages que HOPE lui adresse, en code ISO 639-1
 *   ("fr", "mg", "es"...). La liste des langues proposees est tenue par
 *   le service ; la base n'en controle que la forme.
 * - fuseau_horaire : un identifiant IANA ("Indian/Antananarivo"), pour
 *   dater les messages a son heure.
 */
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

/*
 * La fiche du donateur, etape 3 : l'affectation de son don.
 *
 * Le meme vocabulaire que donations.allocation, pour que le choix se
 * change en don sans traduction :
 *   PROJECT : don affecte au projet projet_id ;
 *   HOPE    : don non affecte, que HOPE repartit entre ses projets.
 *
 * projet_id tombe a NULL si le projet disparait : le donateur le
 * retrouvera a choisir. La contrainte n'interdit donc que le cas absurde
 * d'un don libre attache a un projet.
 */
ALTER TABLE donateur ADD COLUMN IF NOT EXISTS affectation VARCHAR(10);
ALTER TABLE donateur ADD COLUMN IF NOT EXISTS projet_id INTEGER
  REFERENCES projects(id) ON DELETE SET NULL;

ALTER TABLE donateur DROP CONSTRAINT IF EXISTS donateur_affectation_valide;
ALTER TABLE donateur ADD CONSTRAINT donateur_affectation_valide CHECK (
  affectation IS NULL OR affectation IN ('PROJECT', 'HOPE'));

ALTER TABLE donateur DROP CONSTRAINT IF EXISTS donateur_affectation_coherente;
ALTER TABLE donateur ADD CONSTRAINT donateur_affectation_coherente CHECK (
  affectation IS DISTINCT FROM 'HOPE' OR projet_id IS NULL);

/*
 * La fiche du donateur, etape 4 : le mode de paiement qu'il prevoit.
 * Un code ; la liste et ses libelles sont tenus par le service.
 */
ALTER TABLE donateur ADD COLUMN IF NOT EXISTS mode_paiement VARCHAR(30);

ALTER TABLE donateur DROP CONSTRAINT IF EXISTS donateur_mode_paiement_valide;
ALTER TABLE donateur ADD CONSTRAINT donateur_mode_paiement_valide CHECK (
  mode_paiement IS NULL OR mode_paiement IN (
    'mvola', 'orange_money', 'virement_bancaire', 'depot_bancaire',
    'especes', 'carte_bancaire', 'virement_international', 'plateforme'));

/*
 * La fiche du donateur, etape 5 : la frequence de son don.
 *
 * Le vocabulaire de donations.frequency : ONE_TIME (ponctuel) ou MONTHLY
 * (mensuel). Enregistrer cette etape clot le parcours : etape_suivante
 * passe a 6, et le compte est marque complet -- la connexion ne ramene
 * plus au formulaire.
 */
ALTER TABLE donateur ADD COLUMN IF NOT EXISTS frequence VARCHAR(10);

ALTER TABLE donateur DROP CONSTRAINT IF EXISTS donateur_frequence_valide;
ALTER TABLE donateur ADD CONSTRAINT donateur_frequence_valide CHECK (
  frequence IS NULL OR frequence IN ('ONE_TIME', 'MONTHLY'));
