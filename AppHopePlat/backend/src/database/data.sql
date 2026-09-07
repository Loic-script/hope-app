-- ============================================================
-- HOPE - Jeu de donnees de demonstration
--
-- Reprise fidele de ce qu'installe le script :
--
--     npm run db:seed-demo -- --force
--
-- A jouer APRES schema.sql, sur une base ou les tables existent
-- deja. Le fichier vide les tables metier avant de les remplir :
-- il est donc rejouable sans creer de doublon.
--
--     psql -U postgres -d hope_db -f src/database/data.sql
--
-- Contenu : 5 projets en cours dont le financement s'echelonne de
-- 18 % a 100 %, 15 donateurs, 19 dons, 3 investissements du fonds
-- HOPE, 6 depenses et leurs justificatifs, 12 beneficiaires,
-- 4 impacts, 4 messages et 26 notifications.
--
-- La table admins n'est PAS touchee : le compte administrateur et
-- son mot de passe hache restent ceux de votre base.
--
-- Les projets pointent vers des visuels sous /media. Ces fichiers
-- sont copies dans backend/uploads/medias par le script de seed,
-- pas par ce fichier : sans eux les images manqueront, tout le
-- reste fonctionnera normalement.
--
-- Tous les montants sont en NUMERIC, jamais en flottant.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- Remise a zero des tables metier
--
-- CASCADE suit les cles etrangeres, RESTART IDENTITY remet les
-- sequences a 1 pour que les identifiants ci-dessous retombent
-- exactement sur ceux d'origine.
-- ------------------------------------------------------------
TRUNCATE
  notifications,
  messages,
  supporting_documents,
  expenses,
  investments,
  impacts,
  project_beneficiaries,
  beneficiaries,
  donations,
  donor_accounts,
  donors,
  projects,
  project_categories
  RESTART IDENTITY CASCADE;

-- ------------------------------------------------------------
-- Categories de projet (donnees de reference)
-- 7 ligne(s)
-- ------------------------------------------------------------
INSERT INTO public.project_categories (id, name, description, created_at, updated_at) VALUES (1, 'Scolarité', 'Frais de scolarité, fournitures et soutien scolaire', '2026-09-05 23:50:38.307606+03', '2026-09-05 23:50:38.307606+03');
INSERT INTO public.project_categories (id, name, description, created_at, updated_at) VALUES (2, 'Soins', 'Consultations, médicaments et suivi médical', '2026-09-05 23:50:38.323724+03', '2026-09-05 23:50:38.323724+03');
INSERT INTO public.project_categories (id, name, description, created_at, updated_at) VALUES (3, 'Alimentation', 'Repas, distributions alimentaires et nutrition', '2026-09-05 23:50:38.325902+03', '2026-09-05 23:50:38.325902+03');
INSERT INTO public.project_categories (id, name, description, created_at, updated_at) VALUES (4, 'Employabilité', 'Insertion professionnelle et accompagnement vers l''emploi', '2026-09-05 23:50:38.328005+03', '2026-09-05 23:50:38.328005+03');
INSERT INTO public.project_categories (id, name, description, created_at, updated_at) VALUES (5, 'Formation professionnelle', 'Apprentissage de métiers et formations qualifiantes', '2026-09-05 23:50:38.3299+03', '2026-09-05 23:50:38.3299+03');
INSERT INTO public.project_categories (id, name, description, created_at, updated_at) VALUES (6, 'Soutien social', 'Accompagnement des familles et aide sociale', '2026-09-05 23:50:38.331617+03', '2026-09-05 23:50:38.331617+03');
INSERT INTO public.project_categories (id, name, description, created_at, updated_at) VALUES (7, 'Urgence', 'Réponse aux situations d''urgence et aux catastrophes', '2026-09-05 23:50:38.333334+03', '2026-09-05 23:50:38.333334+03');

-- ------------------------------------------------------------
-- Les cinq projets en cours
-- 5 ligne(s)
-- ------------------------------------------------------------
INSERT INTO public.projects (id, reference, category_id, name, description, location, manager_name, start_date, required_budget, currency, beneficiary_profile, beneficiary_target, status, media_url, media_type, outcome, completed_at, archived_at, created_at, updated_at) VALUES (1, 'PRJ-2026-0001', 1, 'Soutien scolaire Antananarivo', 'Prise en charge des frais de scolarité, des fournitures et du transport pour 100 enfants orphelins d''Antananarivo, sur toute l''année scolaire.', 'Antananarivo', 'Hanta Rasoanaivo', '2026-09-07', 5000000.00, 'MGA', 'Enfants orphelins de 6 à 14 ans', 100, 'IN_PROGRESS', '/media/projet-1788800373917-385ccb21b4025861d8122fdef67cbd27.jpg', 'PHOTO', NULL, NULL, NULL, '2026-09-07 19:59:33.926196+03', '2026-09-07 19:59:33.926196+03');
INSERT INTO public.projects (id, reference, category_id, name, description, location, manager_name, start_date, required_budget, currency, beneficiary_profile, beneficiary_target, status, media_url, media_type, outcome, completed_at, archived_at, created_at, updated_at) VALUES (2, 'PRJ-2026-0002', 2, 'Santé pour tous', 'Consultations médicales gratuites et distribution de médicaments essentiels dans la région de Toamasina.', 'Toamasina', 'Dr Naina Andriamahefa', '2026-09-07', 8000000.00, 'MGA', 'Familles vulnérables du littoral est', 350, 'IN_PROGRESS', '/media/projet-1788800373961-749f6e14a4678617184f1737e8c1879a.jpg', 'PHOTO', NULL, NULL, NULL, '2026-09-07 19:59:33.966188+03', '2026-09-07 19:59:33.966188+03');
INSERT INTO public.projects (id, reference, category_id, name, description, location, manager_name, start_date, required_budget, currency, beneficiary_profile, beneficiary_target, status, media_url, media_type, outcome, completed_at, archived_at, created_at, updated_at) VALUES (3, 'PRJ-2026-0003', 5, 'Autonomisation des mères célibataires', 'Formation à la couture et à la gestion de micro-activités, suivie d''un accompagnement à l''installation.', 'Antsirabe', 'Voahangy Ratsimba', '2026-09-07', 6000000.00, 'MGA', 'Mères célibataires sans revenu stable', 25, 'IN_PROGRESS', '/media/projet-1788800373973-a209650e04870a934ab737fbd7ff31cb.jpg', 'PHOTO', NULL, NULL, NULL, '2026-09-07 19:59:33.978308+03', '2026-09-07 19:59:33.978308+03');
INSERT INTO public.projects (id, reference, category_id, name, description, location, manager_name, start_date, required_budget, currency, beneficiary_profile, beneficiary_target, status, media_url, media_type, outcome, completed_at, archived_at, created_at, updated_at) VALUES (4, 'PRJ-2026-0004', 3, 'Cantines scolaires de Fianarantsoa', 'Un repas chaud par jour et jardins potagers communautaires dans quatre écoles.', 'Fianarantsoa', 'Tiana Rakotomalala', '2026-09-07', 4000000.00, 'MGA', 'Élèves des écoles primaires publiques', 200, 'IN_PROGRESS', NULL, NULL, NULL, NULL, NULL, '2026-09-07 19:59:33.995992+03', '2026-09-07 19:59:33.995992+03');
INSERT INTO public.projects (id, reference, category_id, name, description, location, manager_name, start_date, required_budget, currency, beneficiary_profile, beneficiary_target, status, media_url, media_type, outcome, completed_at, archived_at, created_at, updated_at) VALUES (5, 'PRJ-2026-0005', 7, 'Puits d''eau potable Mahajanga', 'Forage et mise en service d''un puits pour le quartier d''Amborovy.', 'Mahajanga', 'Fara Andrianina', '2026-09-07', 2000000.00, 'MGA', 'Habitants du quartier Amborovy', 400, 'IN_PROGRESS', '/media/projet-1788800374019-dca38403f5a459659ef46a8f2bca860e.webm', 'VIDEO', NULL, NULL, NULL, '2026-09-07 19:59:34.023932+03', '2026-09-07 19:59:34.023932+03');

-- ------------------------------------------------------------
-- Les quinze donateurs : neuf a Madagascar, six a l etranger
-- 15 ligne(s)
-- ------------------------------------------------------------
INSERT INTO public.donors (id, first_name, last_name, organization_name, email, phone, country, city, origin, created_at, updated_at) VALUES (1, 'Jean', 'Rakotoarisoa', NULL, 'jean.rakoto@example.mg', '+261 34 12 345 67', 'Madagascar', 'Antananarivo', 'LOCAL', '2026-09-07 19:59:34.036533+03', '2026-09-07 19:59:34.036533+03');
INSERT INTO public.donors (id, first_name, last_name, organization_name, email, phone, country, city, origin, created_at, updated_at) VALUES (2, 'Miora', 'Randrianasolo', NULL, 'miora.r@example.mg', NULL, 'Madagascar', 'Toamasina', 'LOCAL', '2026-09-07 19:59:34.046405+03', '2026-09-07 19:59:34.046405+03');
INSERT INTO public.donors (id, first_name, last_name, organization_name, email, phone, country, city, origin, created_at, updated_at) VALUES (3, 'Hery', 'Andrianarison', NULL, 'hery.andria@example.mg', '+261 32 45 678 90', 'Madagascar', 'Antsirabe', 'LOCAL', '2026-09-07 19:59:34.066741+03', '2026-09-07 19:59:34.066741+03');
INSERT INTO public.donors (id, first_name, last_name, organization_name, email, phone, country, city, origin, created_at, updated_at) VALUES (4, 'Lanto', 'Rakotobe', NULL, 'lanto.rakotobe@example.mg', NULL, 'Madagascar', 'Fianarantsoa', 'LOCAL', '2026-09-07 19:59:34.071384+03', '2026-09-07 19:59:34.071384+03');
INSERT INTO public.donors (id, first_name, last_name, organization_name, email, phone, country, city, origin, created_at, updated_at) VALUES (5, 'Vero', 'Razanadrakoto', NULL, 'vero.raza@example.mg', NULL, 'Madagascar', 'Mahajanga', 'LOCAL', '2026-09-07 19:59:34.075618+03', '2026-09-07 19:59:34.075618+03');
INSERT INTO public.donors (id, first_name, last_name, organization_name, email, phone, country, city, origin, created_at, updated_at) VALUES (6, 'Rado', 'Raharimanana', NULL, 'rado.rahari@example.mg', NULL, 'Madagascar', 'Antananarivo', 'LOCAL', '2026-09-07 19:59:34.079858+03', '2026-09-07 19:59:34.079858+03');
INSERT INTO public.donors (id, first_name, last_name, organization_name, email, phone, country, city, origin, created_at, updated_at) VALUES (7, 'Noro', 'Rasoarimalala', NULL, 'noro.rasoa@example.mg', NULL, 'Madagascar', 'Toamasina', 'LOCAL', '2026-09-07 19:59:34.08379+03', '2026-09-07 19:59:34.08379+03');
INSERT INTO public.donors (id, first_name, last_name, organization_name, email, phone, country, city, origin, created_at, updated_at) VALUES (8, NULL, NULL, 'Entreprise Tafita Mada', 'don@tafitamada.example.mg', '+261 20 22 123 45', 'Madagascar', 'Antananarivo', 'LOCAL', '2026-09-07 19:59:34.088463+03', '2026-09-07 19:59:34.088463+03');
INSERT INTO public.donors (id, first_name, last_name, organization_name, email, phone, country, city, origin, created_at, updated_at) VALUES (9, 'Donateur', 'anonyme', NULL, NULL, NULL, 'Madagascar', 'Antananarivo', 'LOCAL', '2026-09-07 19:59:34.092614+03', '2026-09-07 19:59:34.092614+03');
INSERT INTO public.donors (id, first_name, last_name, organization_name, email, phone, country, city, origin, created_at, updated_at) VALUES (10, NULL, NULL, 'Fondation Solidarité Océan Indien', 'contact@fsoi.example', NULL, 'France', 'Paris', 'INTERNATIONAL', '2026-09-07 19:59:34.096981+03', '2026-09-07 19:59:34.096981+03');
INSERT INTO public.donors (id, first_name, last_name, organization_name, email, phone, country, city, origin, created_at, updated_at) VALUES (11, 'Sophie', 'Bernard', NULL, 'sophie.bernard@example.fr', NULL, 'France', 'Lyon', 'INTERNATIONAL', '2026-09-07 19:59:34.100805+03', '2026-09-07 19:59:34.100805+03');
INSERT INTO public.donors (id, first_name, last_name, organization_name, email, phone, country, city, origin, created_at, updated_at) VALUES (12, 'Marc', 'Delaunay', NULL, 'marc.delaunay@example.fr', NULL, 'France', 'Nantes', 'INTERNATIONAL', '2026-09-07 19:59:34.105333+03', '2026-09-07 19:59:34.105333+03');
INSERT INTO public.donors (id, first_name, last_name, organization_name, email, phone, country, city, origin, created_at, updated_at) VALUES (13, 'Anna', 'Schmidt', NULL, 'anna.schmidt@example.de', NULL, 'Allemagne', 'Berlin', 'INTERNATIONAL', '2026-09-07 19:59:34.109659+03', '2026-09-07 19:59:34.109659+03');
INSERT INTO public.donors (id, first_name, last_name, organization_name, email, phone, country, city, origin, created_at, updated_at) VALUES (14, 'Luca', 'Moretti', NULL, 'luca.moretti@example.it', NULL, 'Italie', 'Milan', 'INTERNATIONAL', '2026-09-07 19:59:34.114019+03', '2026-09-07 19:59:34.114019+03');
INSERT INTO public.donors (id, first_name, last_name, organization_name, email, phone, country, city, origin, created_at, updated_at) VALUES (15, NULL, NULL, 'Association Diaspora Malagasy', 'bureau@diaspora-mg.example', NULL, 'Canada', 'Montréal', 'INTERNATIONAL', '2026-09-07 19:59:34.126354+03', '2026-09-07 19:59:34.126354+03');

-- ------------------------------------------------------------
-- Comptes donateurs (mot de passe de demonstration : donateur2026)
-- 4 ligne(s)
-- ------------------------------------------------------------
INSERT INTO public.donor_accounts (id, donor_id, email, password_hash, status, last_login_at, created_at, updated_at) VALUES (1, 1, 'jean.rakoto@example.mg', '$2b$12$9uPQuMmBKfRkSfXFhzswSOu1iKkINovit9iepeShN6E4/RdDH/bby', 'ACTIVE', NULL, '2026-09-07 19:59:34.542763+03', '2026-09-07 19:59:34.542763+03');
INSERT INTO public.donor_accounts (id, donor_id, email, password_hash, status, last_login_at, created_at, updated_at) VALUES (2, 11, 'sophie.bernard@example.fr', '$2b$12$5TeEE/KeCC8CoNVtzcvjge9nnijhAeSuZDbE5BTxcbPHpvNzUYnre', 'ACTIVE', NULL, '2026-09-07 19:59:34.951715+03', '2026-09-07 19:59:34.951715+03');
INSERT INTO public.donor_accounts (id, donor_id, email, password_hash, status, last_login_at, created_at, updated_at) VALUES (3, 12, 'marc.delaunay@example.fr', '$2b$12$2Smqx6aj68O5jtAesdNUtOASNViQU9m2ACzFmINy95QA96Rz4h6EG', 'ACTIVE', NULL, '2026-09-07 19:59:35.354771+03', '2026-09-07 19:59:35.354771+03');
INSERT INTO public.donor_accounts (id, donor_id, email, password_hash, status, last_login_at, created_at, updated_at) VALUES (4, 8, 'don@tafitamada.example.mg', '$2b$12$uKzCDt5FdVknjc.iULA/F.lcLrDucsJL0.xL1dnRWBnbtMtjvNrB.', 'ACTIVE', NULL, '2026-09-07 19:59:35.802189+03', '2026-09-07 19:59:35.802189+03');

-- ------------------------------------------------------------
-- Les dix-neuf dons, affectes a un projet ou verses au fonds HOPE
-- 19 ligne(s)
-- ------------------------------------------------------------
INSERT INTO public.donations (id, reference, donor_id, donor_account_id, amount, currency, allocation, project_id, frequency, payment_method, payment_reference, status, received_at, message, created_at, updated_at) VALUES (1, 'DON-2026-0001', 1, 1, 1000000.00, 'MGA', 'PROJECT', 1, 'ONE_TIME', 'Mvola', 'MVOLA-884213', 'RECEIVED', '2026-07-29 00:00:00+03', 'Pour que ces enfants puissent aller à l’école.', '2026-09-07 19:59:35.808767+03', '2026-09-07 19:59:35.808767+03');
INSERT INTO public.donations (id, reference, donor_id, donor_account_id, amount, currency, allocation, project_id, frequency, payment_method, payment_reference, status, received_at, message, created_at, updated_at) VALUES (2, 'DON-2026-0002', 3, NULL, 250000.00, 'MGA', 'PROJECT', 1, 'ONE_TIME', 'Mvola', NULL, 'RECEIVED', '2026-08-03 00:00:00+03', NULL, '2026-09-07 19:59:35.883647+03', '2026-09-07 19:59:35.883647+03');
INSERT INTO public.donations (id, reference, donor_id, donor_account_id, amount, currency, allocation, project_id, frequency, payment_method, payment_reference, status, received_at, message, created_at, updated_at) VALUES (3, 'DON-2026-0003', 12, 3, 450000.00, 'MGA', 'PROJECT', 1, 'MONTHLY', 'Carte bancaire', 'CB-2026-3318', 'RECEIVED', '2026-08-10 00:00:00+03', NULL, '2026-09-07 19:59:35.902376+03', '2026-09-07 19:59:35.902376+03');
INSERT INTO public.donations (id, reference, donor_id, donor_account_id, amount, currency, allocation, project_id, frequency, payment_method, payment_reference, status, received_at, message, created_at, updated_at) VALUES (4, 'DON-2026-0004', 15, NULL, 900000.00, 'MGA', 'PROJECT', 1, 'ONE_TIME', 'Virement international', 'VIR-2026-0912', 'RECEIVED', '2026-08-17 00:00:00+03', 'De la part des Malagasy de Montréal.', '2026-09-07 19:59:35.919209+03', '2026-09-07 19:59:35.919209+03');
INSERT INTO public.donations (id, reference, donor_id, donor_account_id, amount, currency, allocation, project_id, frequency, payment_method, payment_reference, status, received_at, message, created_at, updated_at) VALUES (5, 'DON-2026-0005', 7, NULL, 160000.00, 'MGA', 'PROJECT', 2, 'ONE_TIME', 'Orange Money', NULL, 'RECEIVED', '2026-08-12 00:00:00+03', NULL, '2026-09-07 19:59:35.936927+03', '2026-09-07 19:59:35.936927+03');
INSERT INTO public.donations (id, reference, donor_id, donor_account_id, amount, currency, allocation, project_id, frequency, payment_method, payment_reference, status, received_at, message, created_at, updated_at) VALUES (6, 'DON-2026-0006', 13, NULL, 700000.00, 'MGA', 'PROJECT', 2, 'ONE_TIME', 'PayPal', NULL, 'RECEIVED', '2026-08-19 00:00:00+03', NULL, '2026-09-07 19:59:35.953+03', '2026-09-07 19:59:35.953+03');
INSERT INTO public.donations (id, reference, donor_id, donor_account_id, amount, currency, allocation, project_id, frequency, payment_method, payment_reference, status, received_at, message, created_at, updated_at) VALUES (7, 'DON-2026-0007', 8, 4, 800000.00, 'MGA', 'PROJECT', 2, 'ONE_TIME', 'Virement bancaire local', 'VBL-2026-0077', 'RECEIVED', '2026-08-27 00:00:00+03', 'Notre contribution annuelle à la santé publique.', '2026-09-07 19:59:35.970027+03', '2026-09-07 19:59:35.970027+03');
INSERT INTO public.donations (id, reference, donor_id, donor_account_id, amount, currency, allocation, project_id, frequency, payment_method, payment_reference, status, received_at, message, created_at, updated_at) VALUES (8, 'DON-2026-0008', 11, 2, 600000.00, 'MGA', 'PROJECT', 3, 'MONTHLY', 'Carte bancaire', 'CB-2026-7741', 'RECEIVED', '2026-08-08 00:00:00+03', NULL, '2026-09-07 19:59:35.985272+03', '2026-09-07 19:59:35.985272+03');
INSERT INTO public.donations (id, reference, donor_id, donor_account_id, amount, currency, allocation, project_id, frequency, payment_method, payment_reference, status, received_at, message, created_at, updated_at) VALUES (9, 'DON-2026-0009', 5, NULL, 180000.00, 'MGA', 'PROJECT', 3, 'ONE_TIME', 'Mvola', NULL, 'RECEIVED', '2026-08-22 00:00:00+03', NULL, '2026-09-07 19:59:36.001594+03', '2026-09-07 19:59:36.001594+03');
INSERT INTO public.donations (id, reference, donor_id, donor_account_id, amount, currency, allocation, project_id, frequency, payment_method, payment_reference, status, received_at, message, created_at, updated_at) VALUES (10, 'DON-2026-0010', 14, NULL, 300000.00, 'MGA', 'PROJECT', 3, 'MONTHLY', 'Carte bancaire', NULL, 'RECEIVED', '2026-08-31 00:00:00+03', NULL, '2026-09-07 19:59:36.016812+03', '2026-09-07 19:59:36.016812+03');
INSERT INTO public.donations (id, reference, donor_id, donor_account_id, amount, currency, allocation, project_id, frequency, payment_method, payment_reference, status, received_at, message, created_at, updated_at) VALUES (11, 'DON-2026-0011', 2, NULL, 400000.00, 'MGA', 'PROJECT', 4, 'ONE_TIME', 'Orange Money', NULL, 'RECEIVED', '2026-08-26 00:00:00+03', NULL, '2026-09-07 19:59:36.035472+03', '2026-09-07 19:59:36.035472+03');
INSERT INTO public.donations (id, reference, donor_id, donor_account_id, amount, currency, allocation, project_id, frequency, payment_method, payment_reference, status, received_at, message, created_at, updated_at) VALUES (12, 'DON-2026-0012', 4, NULL, 160000.00, 'MGA', 'PROJECT', 4, 'ONE_TIME', 'Airtel Money', NULL, 'RECEIVED', '2026-08-29 00:00:00+03', NULL, '2026-09-07 19:59:36.049261+03', '2026-09-07 19:59:36.049261+03');
INSERT INTO public.donations (id, reference, donor_id, donor_account_id, amount, currency, allocation, project_id, frequency, payment_method, payment_reference, status, received_at, message, created_at, updated_at) VALUES (13, 'DON-2026-0013', 1, 1, 2000000.00, 'MGA', 'PROJECT', 5, 'ONE_TIME', 'Virement bancaire local', 'VBL-2025-0410', 'RECEIVED', '2026-07-09 00:00:00+03', NULL, '2026-09-07 19:59:36.062785+03', '2026-09-07 19:59:36.062785+03');
INSERT INTO public.donations (id, reference, donor_id, donor_account_id, amount, currency, allocation, project_id, frequency, payment_method, payment_reference, status, received_at, message, created_at, updated_at) VALUES (14, 'DON-2026-0014', 10, NULL, 4500000.00, 'MGA', 'HOPE', NULL, 'ONE_TIME', 'Virement international', 'VIR-2026-0451', 'RECEIVED', '2026-08-13 00:00:00+03', 'Utilisez ce don là où le besoin est le plus urgent.', '2026-09-07 19:59:36.076858+03', '2026-09-07 19:59:36.076858+03');
INSERT INTO public.donations (id, reference, donor_id, donor_account_id, amount, currency, allocation, project_id, frequency, payment_method, payment_reference, status, received_at, message, created_at, updated_at) VALUES (15, 'DON-2026-0015', 11, 2, 300000.00, 'MGA', 'HOPE', NULL, 'MONTHLY', 'PayPal', NULL, 'RECEIVED', '2026-08-23 00:00:00+03', NULL, '2026-09-07 19:59:36.086867+03', '2026-09-07 19:59:36.086867+03');
INSERT INTO public.donations (id, reference, donor_id, donor_account_id, amount, currency, allocation, project_id, frequency, payment_method, payment_reference, status, received_at, message, created_at, updated_at) VALUES (16, 'DON-2026-0016', 6, NULL, 350000.00, 'MGA', 'HOPE', NULL, 'ONE_TIME', 'Espèces', NULL, 'RECEIVED', '2026-08-25 00:00:00+03', NULL, '2026-09-07 19:59:36.096546+03', '2026-09-07 19:59:36.096546+03');
INSERT INTO public.donations (id, reference, donor_id, donor_account_id, amount, currency, allocation, project_id, frequency, payment_method, payment_reference, status, received_at, message, created_at, updated_at) VALUES (17, 'DON-2026-0017', 9, NULL, 250000.00, 'MGA', 'HOPE', NULL, 'ONE_TIME', 'Espèces', NULL, 'RECEIVED', '2026-09-01 00:00:00+03', NULL, '2026-09-07 19:59:36.106782+03', '2026-09-07 19:59:36.106782+03');
INSERT INTO public.donations (id, reference, donor_id, donor_account_id, amount, currency, allocation, project_id, frequency, payment_method, payment_reference, status, received_at, message, created_at, updated_at) VALUES (18, 'DON-2026-0018', 15, NULL, 1200000.00, 'MGA', 'HOPE', NULL, 'ONE_TIME', 'Virement international', NULL, 'RECEIVED', '2026-09-02 00:00:00+03', NULL, '2026-09-07 19:59:36.115835+03', '2026-09-07 19:59:36.115835+03');
INSERT INTO public.donations (id, reference, donor_id, donor_account_id, amount, currency, allocation, project_id, frequency, payment_method, payment_reference, status, received_at, message, created_at, updated_at) VALUES (19, 'DON-2026-0019', 13, NULL, 200000.00, 'MGA', 'HOPE', NULL, 'MONTHLY', 'PayPal', NULL, 'RECEIVED', '2026-09-05 00:00:00+03', NULL, '2026-09-07 19:59:36.125531+03', '2026-09-07 19:59:36.125531+03');

-- ------------------------------------------------------------
-- Investissements du fonds HOPE, chacun justifie
-- 3 ligne(s)
-- ------------------------------------------------------------
INSERT INTO public.investments (id, reference, project_id, amount, currency, justification, invested_at, created_at, updated_at) VALUES (1, 'INV-2026-0001', 2, 2500000.00, 'MGA', 'Achat des médicaments essentiels de la campagne de consultations. Aucun don affecté ne couvre ce projet à ce jour.', '2026-08-18', '2026-09-07 19:59:36.135566+03', '2026-09-07 19:59:36.135566+03');
INSERT INTO public.investments (id, reference, project_id, amount, currency, justification, invested_at, created_at, updated_at) VALUES (2, 'INV-2026-0002', 1, 1200000.00, 'MGA', 'Complément pour couvrir le transport scolaire, non financé par les dons affectés reçus.', '2026-08-20', '2026-09-07 19:59:36.151532+03', '2026-09-07 19:59:36.151532+03');
INSERT INTO public.investments (id, reference, project_id, amount, currency, justification, invested_at, created_at, updated_at) VALUES (3, 'INV-2026-0003', 4, 800000.00, 'MGA', 'Démarrage des jardins potagers avant la saison des pluies.', '2026-08-28', '2026-09-07 19:59:36.162839+03', '2026-09-07 19:59:36.162839+03');

-- ------------------------------------------------------------
-- Depenses engagees sur les projets
-- 6 ligne(s)
-- ------------------------------------------------------------
INSERT INTO public.expenses (id, project_id, amount, currency, description, category, supplier, expense_date, status, created_at, updated_at) VALUES (1, 1, 300000.00, 'MGA', 'Achat de fournitures scolaires pour 25 enfants', 'Fournitures', 'Librairie Ambatonakanga', '2026-08-23', 'RECORDED', '2026-09-07 19:59:36.174144+03', '2026-09-07 19:59:36.174144+03');
INSERT INTO public.expenses (id, project_id, amount, currency, description, category, supplier, expense_date, status, created_at, updated_at) VALUES (2, 1, 750000.00, 'MGA', 'Écolages du premier trimestre', 'Formation', 'EPP Andohalo', '2026-08-28', 'RECORDED', '2026-09-07 19:59:36.200474+03', '2026-09-07 19:59:36.200474+03');
INSERT INTO public.expenses (id, project_id, amount, currency, description, category, supplier, expense_date, status, created_at, updated_at) VALUES (3, 2, 1200000.00, 'MGA', 'Commande de médicaments essentiels', 'Santé', 'Pharmacie Centrale de Toamasina', '2026-09-01', 'RECORDED', '2026-09-07 19:59:36.217843+03', '2026-09-07 19:59:36.217843+03');
INSERT INTO public.expenses (id, project_id, amount, currency, description, category, supplier, expense_date, status, created_at, updated_at) VALUES (4, 4, 350000.00, 'MGA', 'Semences et outillage pour les jardins potagers', 'Matériel', 'Coopérative Vatovavy', '2026-09-03', 'RECORDED', '2026-09-07 19:59:36.232932+03', '2026-09-07 19:59:36.232932+03');
INSERT INTO public.expenses (id, project_id, amount, currency, description, category, supplier, expense_date, status, created_at, updated_at) VALUES (5, 5, 1600000.00, 'MGA', 'Forage du puits et pose de la pompe manuelle', 'Matériel', 'Entreprise Hydro Boeny', '2026-05-10', 'RECORDED', '2026-09-07 19:59:36.241743+03', '2026-09-07 19:59:36.241743+03');
INSERT INTO public.expenses (id, project_id, amount, currency, description, category, supplier, expense_date, status, created_at, updated_at) VALUES (6, 5, 250000.00, 'MGA', 'Analyse de potabilité de l''eau et formation du comité de gestion', 'Formation', 'Laboratoire régional Mahajanga', '2026-05-30', 'RECORDED', '2026-09-07 19:59:36.257251+03', '2026-09-07 19:59:36.257251+03');

-- ------------------------------------------------------------
-- Justificatifs rattaches aux depenses
-- 4 ligne(s)
-- ------------------------------------------------------------
INSERT INTO public.supporting_documents (id, expense_id, document_type, file_name, file_path, mime_type, file_size, reference, issued_at, created_at, updated_at) VALUES (1, 1, 'INVOICE', 'facture_fournitures.pdf', 'justificatif-1788800376188-0c9c5143f0.pdf', 'application/pdf', 611, 'FAC-2026-118', '2026-08-28', '2026-09-07 19:59:36.195267+03', '2026-09-07 19:59:36.195267+03');
INSERT INTO public.supporting_documents (id, expense_id, document_type, file_name, file_path, mime_type, file_size, reference, issued_at, created_at, updated_at) VALUES (2, 2, 'RECEIPT', 'recu_ecolages_T1.pdf', 'justificatif-1788800376210-bc379b8d17.pdf', 'application/pdf', 613, 'REC-2026-042', '2026-08-28', '2026-09-07 19:59:36.214491+03', '2026-09-07 19:59:36.214491+03');
INSERT INTO public.supporting_documents (id, expense_id, document_type, file_name, file_path, mime_type, file_size, reference, issued_at, created_at, updated_at) VALUES (3, 3, 'INVOICE', 'facture_medicaments.pdf', 'justificatif-1788800376225-643a65a923.pdf', 'application/pdf', 601, 'BC-2026-77', '2026-08-28', '2026-09-07 19:59:36.22953+03', '2026-09-07 19:59:36.22953+03');
INSERT INTO public.supporting_documents (id, expense_id, document_type, file_name, file_path, mime_type, file_size, reference, issued_at, created_at, updated_at) VALUES (4, 5, 'INVOICE', 'facture_forage_puits.pdf', 'justificatif-1788800376249-fdaa5a4b4f.pdf', 'application/pdf', 605, 'HB-2026-009', '2026-08-28', '2026-09-07 19:59:36.253263+03', '2026-09-07 19:59:36.253263+03');

-- ------------------------------------------------------------
-- Beneficiaires suivis
-- 12 ligne(s)
-- ------------------------------------------------------------
INSERT INTO public.beneficiaries (id, first_name, last_name, beneficiary_type, gender, birth_date, country, city, status, notes, created_at, updated_at) VALUES (1, 'Soa', 'Rabe', 'ORPHAN', 'F', '2015-04-12', 'Madagascar', 'Antananarivo', 'ACTIVE', NULL, '2026-09-07 19:59:36.26588+03', '2026-09-07 19:59:36.26588+03');
INSERT INTO public.beneficiaries (id, first_name, last_name, beneficiary_type, gender, birth_date, country, city, status, notes, created_at, updated_at) VALUES (2, 'Tojo', 'Randria', 'ORPHAN', 'M', '2014-09-03', 'Madagascar', 'Antananarivo', 'ACTIVE', NULL, '2026-09-07 19:59:36.291453+03', '2026-09-07 19:59:36.291453+03');
INSERT INTO public.beneficiaries (id, first_name, last_name, beneficiary_type, gender, birth_date, country, city, status, notes, created_at, updated_at) VALUES (3, 'Fanja', 'Raso', 'ORPHAN', 'F', '2016-01-25', 'Madagascar', 'Antananarivo', 'ACTIVE', NULL, '2026-09-07 19:59:36.30669+03', '2026-09-07 19:59:36.30669+03');
INSERT INTO public.beneficiaries (id, first_name, last_name, beneficiary_type, gender, birth_date, country, city, status, notes, created_at, updated_at) VALUES (4, 'Naina', 'Rakoto', 'ORPHAN', 'M', '2013-11-08', 'Madagascar', 'Antananarivo', 'ACTIVE', NULL, '2026-09-07 19:59:36.323591+03', '2026-09-07 19:59:36.323591+03');
INSERT INTO public.beneficiaries (id, first_name, last_name, beneficiary_type, gender, birth_date, country, city, status, notes, created_at, updated_at) VALUES (5, 'Vola', 'Ramanana', 'SINGLE_MOTHER', 'F', '1994-06-17', 'Madagascar', 'Antsirabe', 'ACTIVE', NULL, '2026-09-07 19:59:36.338428+03', '2026-09-07 19:59:36.338428+03');
INSERT INTO public.beneficiaries (id, first_name, last_name, beneficiary_type, gender, birth_date, country, city, status, notes, created_at, updated_at) VALUES (6, 'Hanta', 'Razafy', 'SINGLE_MOTHER', 'F', '1990-02-28', 'Madagascar', 'Antsirabe', 'ACTIVE', NULL, '2026-09-07 19:59:36.355567+03', '2026-09-07 19:59:36.355567+03');
INSERT INTO public.beneficiaries (id, first_name, last_name, beneficiary_type, gender, birth_date, country, city, status, notes, created_at, updated_at) VALUES (7, 'Lalao', 'Andry', 'SINGLE_MOTHER', 'F', '1997-08-05', 'Madagascar', 'Antsirabe', 'ACTIVE', NULL, '2026-09-07 19:59:36.371774+03', '2026-09-07 19:59:36.371774+03');
INSERT INTO public.beneficiaries (id, first_name, last_name, beneficiary_type, gender, birth_date, country, city, status, notes, created_at, updated_at) VALUES (8, 'Famille', 'Rasoamalala', 'FAMILY', NULL, NULL, 'Madagascar', 'Toamasina', 'ACTIVE', NULL, '2026-09-07 19:59:36.38817+03', '2026-09-07 19:59:36.38817+03');
INSERT INTO public.beneficiaries (id, first_name, last_name, beneficiary_type, gender, birth_date, country, city, status, notes, created_at, updated_at) VALUES (9, 'Famille', 'Andrianjafy', 'FAMILY', NULL, NULL, 'Madagascar', 'Toamasina', 'ACTIVE', NULL, '2026-09-07 19:59:36.404142+03', '2026-09-07 19:59:36.404142+03');
INSERT INTO public.beneficiaries (id, first_name, last_name, beneficiary_type, gender, birth_date, country, city, status, notes, created_at, updated_at) VALUES (10, 'Zo', 'Rafalimanana', 'ORPHAN', 'M', '2012-03-19', 'Madagascar', 'Fianarantsoa', 'ACTIVE', NULL, '2026-09-07 19:59:36.419129+03', '2026-09-07 19:59:36.419129+03');
INSERT INTO public.beneficiaries (id, first_name, last_name, beneficiary_type, gender, birth_date, country, city, status, notes, created_at, updated_at) VALUES (11, 'Famille', 'Ravelonarivo', 'FAMILY', NULL, NULL, 'Madagascar', 'Mahajanga', 'ACTIVE', NULL, '2026-09-07 19:59:36.435545+03', '2026-09-07 19:59:36.435545+03');
INSERT INTO public.beneficiaries (id, first_name, last_name, beneficiary_type, gender, birth_date, country, city, status, notes, created_at, updated_at) VALUES (12, 'Famille', 'Bemananjara', 'FAMILY', NULL, NULL, 'Madagascar', 'Mahajanga', 'ACTIVE', NULL, '2026-09-07 19:59:36.450986+03', '2026-09-07 19:59:36.450986+03');

-- ------------------------------------------------------------
-- Rattachement des beneficiaires aux projets
-- 12 ligne(s)
-- ------------------------------------------------------------
INSERT INTO public.project_beneficiaries (id, project_id, beneficiary_id, joined_at, left_at, status, notes, created_at, updated_at) VALUES (1, 1, 1, '2026-09-07', NULL, 'ACTIVE', NULL, '2026-09-07 19:59:36.282845+03', '2026-09-07 19:59:36.282845+03');
INSERT INTO public.project_beneficiaries (id, project_id, beneficiary_id, joined_at, left_at, status, notes, created_at, updated_at) VALUES (2, 1, 2, '2026-09-07', NULL, 'ACTIVE', NULL, '2026-09-07 19:59:36.301508+03', '2026-09-07 19:59:36.301508+03');
INSERT INTO public.project_beneficiaries (id, project_id, beneficiary_id, joined_at, left_at, status, notes, created_at, updated_at) VALUES (3, 1, 3, '2026-09-07', NULL, 'ACTIVE', NULL, '2026-09-07 19:59:36.317447+03', '2026-09-07 19:59:36.317447+03');
INSERT INTO public.project_beneficiaries (id, project_id, beneficiary_id, joined_at, left_at, status, notes, created_at, updated_at) VALUES (4, 1, 4, '2026-09-07', NULL, 'ACTIVE', NULL, '2026-09-07 19:59:36.333384+03', '2026-09-07 19:59:36.333384+03');
INSERT INTO public.project_beneficiaries (id, project_id, beneficiary_id, joined_at, left_at, status, notes, created_at, updated_at) VALUES (5, 3, 5, '2026-09-07', NULL, 'ACTIVE', NULL, '2026-09-07 19:59:36.34976+03', '2026-09-07 19:59:36.34976+03');
INSERT INTO public.project_beneficiaries (id, project_id, beneficiary_id, joined_at, left_at, status, notes, created_at, updated_at) VALUES (6, 3, 6, '2026-09-07', NULL, 'ACTIVE', NULL, '2026-09-07 19:59:36.366404+03', '2026-09-07 19:59:36.366404+03');
INSERT INTO public.project_beneficiaries (id, project_id, beneficiary_id, joined_at, left_at, status, notes, created_at, updated_at) VALUES (7, 3, 7, '2026-09-07', NULL, 'ACTIVE', NULL, '2026-09-07 19:59:36.38333+03', '2026-09-07 19:59:36.38333+03');
INSERT INTO public.project_beneficiaries (id, project_id, beneficiary_id, joined_at, left_at, status, notes, created_at, updated_at) VALUES (8, 2, 8, '2026-09-07', NULL, 'ACTIVE', NULL, '2026-09-07 19:59:36.39864+03', '2026-09-07 19:59:36.39864+03');
INSERT INTO public.project_beneficiaries (id, project_id, beneficiary_id, joined_at, left_at, status, notes, created_at, updated_at) VALUES (9, 2, 9, '2026-09-07', NULL, 'ACTIVE', NULL, '2026-09-07 19:59:36.41456+03', '2026-09-07 19:59:36.41456+03');
INSERT INTO public.project_beneficiaries (id, project_id, beneficiary_id, joined_at, left_at, status, notes, created_at, updated_at) VALUES (10, 4, 10, '2026-09-07', NULL, 'ACTIVE', NULL, '2026-09-07 19:59:36.430212+03', '2026-09-07 19:59:36.430212+03');
INSERT INTO public.project_beneficiaries (id, project_id, beneficiary_id, joined_at, left_at, status, notes, created_at, updated_at) VALUES (11, 5, 11, '2026-09-07', NULL, 'ACTIVE', NULL, '2026-09-07 19:59:36.446447+03', '2026-09-07 19:59:36.446447+03');
INSERT INTO public.project_beneficiaries (id, project_id, beneficiary_id, joined_at, left_at, status, notes, created_at, updated_at) VALUES (12, 5, 12, '2026-09-07', NULL, 'ACTIVE', NULL, '2026-09-07 19:59:36.461284+03', '2026-09-07 19:59:36.461284+03');

-- ------------------------------------------------------------
-- Impacts mesures
-- 4 ligne(s)
-- ------------------------------------------------------------
INSERT INTO public.impacts (id, project_id, beneficiary_id, title, description, indicator, value, unit, measured_at, created_at, updated_at) VALUES (1, 5, NULL, 'Habitants desservis en eau potable', 'Relevé effectué avec le comité de quartier après la mise en service.', 'people_with_water_access', 400.00, 'personnes', '2026-08-08', '2026-09-07 19:59:36.471157+03', '2026-09-07 19:59:36.471157+03');
INSERT INTO public.impacts (id, project_id, beneficiary_id, title, description, indicator, value, unit, measured_at, created_at, updated_at) VALUES (2, 5, NULL, 'Comité de gestion formé', NULL, 'people_trained', 6.00, 'personnes', '2026-08-10', '2026-09-07 19:59:36.483888+03', '2026-09-07 19:59:36.483888+03');
INSERT INTO public.impacts (id, project_id, beneficiary_id, title, description, indicator, value, unit, measured_at, created_at, updated_at) VALUES (3, 1, NULL, 'Enfants ayant reçu un kit scolaire complet', NULL, 'kits_distributed', 25.00, 'kits', '2026-08-24', '2026-09-07 19:59:36.492496+03', '2026-09-07 19:59:36.492496+03');
INSERT INTO public.impacts (id, project_id, beneficiary_id, title, description, indicator, value, unit, measured_at, created_at, updated_at) VALUES (4, 2, NULL, 'Consultations médicales gratuites réalisées', NULL, 'medical_consultations', 340.00, 'consultations', '2026-09-04', '2026-09-07 19:59:36.500143+03', '2026-09-07 19:59:36.500143+03');

-- ------------------------------------------------------------
-- Messages envoyes par les donateurs disposant d un compte
-- 4 ligne(s)
-- ------------------------------------------------------------
INSERT INTO public.messages (id, donor_account_id, subject, body, status, reply, replied_at, created_at, updated_at) VALUES (1, 1, 'Nouvelles du soutien scolaire', 'Bonjour,
Pourrais-je recevoir des nouvelles des enfants du projet de soutien scolaire que je finance ? J''aimerais savoir combien ont pu faire leur rentrée.
Merci pour votre travail.', 'NEW', NULL, NULL, '2026-09-07 19:59:36.50367+03', '2026-09-07 19:59:36.50367+03');
INSERT INTO public.messages (id, donor_account_id, subject, body, status, reply, replied_at, created_at, updated_at) VALUES (3, 3, 'Passer mon don mensuel à 600 000 Ar', 'Bonjour,
Je souhaite augmenter mon don mensuel pour le soutien scolaire, de 450 000 à 600 000 Ar à partir du mois prochain. Que dois-je faire de mon côté ?
Marc', 'NEW', NULL, NULL, '2026-09-07 19:59:36.521788+03', '2026-09-07 19:59:36.521788+03');
INSERT INTO public.messages (id, donor_account_id, subject, body, status, reply, replied_at, created_at, updated_at) VALUES (4, 4, 'Convention de mécénat 2027', 'Bonjour,
Notre direction souhaite formaliser un partenariat sur trois ans avec HOPE. Pourriez-vous nous indiquer si l''association peut établir une convention de mécénat, et quels documents vous seraient nécessaires ?
Bien cordialement,
Entreprise Tafita Mada', 'READ', NULL, NULL, '2026-09-07 19:59:36.528163+03', '2026-09-07 20:07:26.428224+03');
INSERT INTO public.messages (id, donor_account_id, subject, body, status, reply, replied_at, created_at, updated_at) VALUES (2, 2, 'Reçu fiscal 2026', 'Bonjour,
Je souhaiterais obtenir un reçu fiscal pour mes dons mensuels de cette année. Faut-il en faire la demande chaque année ?
Bien cordialement,
Sophie', 'ANSWERED', 'bonjour', '2026-09-07 20:07:35.955491+03', '2026-09-07 19:59:36.515699+03', '2026-09-07 20:07:35.955491+03');

-- ------------------------------------------------------------
-- Notifications produites par les ecritures ci-dessus
-- 26 ligne(s)
-- ------------------------------------------------------------
INSERT INTO public.notifications (id, type, label, donation_id, message_id, project_id, donor_id, is_read, created_at) VALUES (1, 'DONATION', 'Jean Rakotoarisoa a fait un don ponctuel de 1 000 000 MGA pour le projet « Soutien scolaire Antananarivo »', 1, NULL, 1, 1, false, '2026-09-07 19:59:35.808767+03');
INSERT INTO public.notifications (id, type, label, donation_id, message_id, project_id, donor_id, is_read, created_at) VALUES (2, 'DONATION', 'Hery Andrianarison a fait un don ponctuel de 250 000 MGA pour le projet « Soutien scolaire Antananarivo »', 2, NULL, 1, 3, false, '2026-09-07 19:59:35.883647+03');
INSERT INTO public.notifications (id, type, label, donation_id, message_id, project_id, donor_id, is_read, created_at) VALUES (3, 'DONATION', 'Marc Delaunay a fait un don mensuel de 450 000 MGA pour le projet « Soutien scolaire Antananarivo »', 3, NULL, 1, 12, false, '2026-09-07 19:59:35.902376+03');
INSERT INTO public.notifications (id, type, label, donation_id, message_id, project_id, donor_id, is_read, created_at) VALUES (4, 'DONATION', 'Association Diaspora Malagasy a fait un don ponctuel de 900 000 MGA pour le projet « Soutien scolaire Antananarivo »', 4, NULL, 1, 15, false, '2026-09-07 19:59:35.919209+03');
INSERT INTO public.notifications (id, type, label, donation_id, message_id, project_id, donor_id, is_read, created_at) VALUES (5, 'DONATION', 'Noro Rasoarimalala a fait un don ponctuel de 160 000 MGA pour le projet « Santé pour tous »', 5, NULL, 2, 7, false, '2026-09-07 19:59:35.936927+03');
INSERT INTO public.notifications (id, type, label, donation_id, message_id, project_id, donor_id, is_read, created_at) VALUES (6, 'DONATION', 'Anna Schmidt a fait un don ponctuel de 700 000 MGA pour le projet « Santé pour tous »', 6, NULL, 2, 13, false, '2026-09-07 19:59:35.953+03');
INSERT INTO public.notifications (id, type, label, donation_id, message_id, project_id, donor_id, is_read, created_at) VALUES (7, 'DONATION', 'Entreprise Tafita Mada a fait un don ponctuel de 800 000 MGA pour le projet « Santé pour tous »', 7, NULL, 2, 8, false, '2026-09-07 19:59:35.970027+03');
INSERT INTO public.notifications (id, type, label, donation_id, message_id, project_id, donor_id, is_read, created_at) VALUES (8, 'DONATION', 'Sophie Bernard a fait un don mensuel de 600 000 MGA pour le projet « Autonomisation des mères célibataires »', 8, NULL, 3, 11, false, '2026-09-07 19:59:35.985272+03');
INSERT INTO public.notifications (id, type, label, donation_id, message_id, project_id, donor_id, is_read, created_at) VALUES (9, 'DONATION', 'Vero Razanadrakoto a fait un don ponctuel de 180 000 MGA pour le projet « Autonomisation des mères célibataires »', 9, NULL, 3, 5, false, '2026-09-07 19:59:36.001594+03');
INSERT INTO public.notifications (id, type, label, donation_id, message_id, project_id, donor_id, is_read, created_at) VALUES (10, 'DONATION', 'Luca Moretti a fait un don mensuel de 300 000 MGA pour le projet « Autonomisation des mères célibataires »', 10, NULL, 3, 14, false, '2026-09-07 19:59:36.016812+03');
INSERT INTO public.notifications (id, type, label, donation_id, message_id, project_id, donor_id, is_read, created_at) VALUES (11, 'DONATION', 'Miora Randrianasolo a fait un don ponctuel de 400 000 MGA pour le projet « Cantines scolaires de Fianarantsoa »', 11, NULL, 4, 2, false, '2026-09-07 19:59:36.035472+03');
INSERT INTO public.notifications (id, type, label, donation_id, message_id, project_id, donor_id, is_read, created_at) VALUES (12, 'DONATION', 'Lanto Rakotobe a fait un don ponctuel de 160 000 MGA pour le projet « Cantines scolaires de Fianarantsoa »', 12, NULL, 4, 4, false, '2026-09-07 19:59:36.049261+03');
INSERT INTO public.notifications (id, type, label, donation_id, message_id, project_id, donor_id, is_read, created_at) VALUES (13, 'DONATION', 'Jean Rakotoarisoa a fait un don ponctuel de 2 000 000 MGA pour le projet « Puits d''eau potable Mahajanga »', 13, NULL, 5, 1, false, '2026-09-07 19:59:36.062785+03');
INSERT INTO public.notifications (id, type, label, donation_id, message_id, project_id, donor_id, is_read, created_at) VALUES (14, 'DONATION', 'Fondation Solidarité Océan Indien a fait un don ponctuel de 4 500 000 MGA pour HOPE', 14, NULL, NULL, 10, false, '2026-09-07 19:59:36.076858+03');
INSERT INTO public.notifications (id, type, label, donation_id, message_id, project_id, donor_id, is_read, created_at) VALUES (15, 'DONATION', 'Sophie Bernard a fait un don mensuel de 300 000 MGA pour HOPE', 15, NULL, NULL, 11, false, '2026-09-07 19:59:36.086867+03');
INSERT INTO public.notifications (id, type, label, donation_id, message_id, project_id, donor_id, is_read, created_at) VALUES (16, 'DONATION', 'Rado Raharimanana a fait un don ponctuel de 350 000 MGA pour HOPE', 16, NULL, NULL, 6, false, '2026-09-07 19:59:36.096546+03');
INSERT INTO public.notifications (id, type, label, donation_id, message_id, project_id, donor_id, is_read, created_at) VALUES (17, 'DONATION', 'Donateur anonyme a fait un don ponctuel de 250 000 MGA pour HOPE', 17, NULL, NULL, 9, false, '2026-09-07 19:59:36.106782+03');
INSERT INTO public.notifications (id, type, label, donation_id, message_id, project_id, donor_id, is_read, created_at) VALUES (18, 'DONATION', 'Association Diaspora Malagasy a fait un don ponctuel de 1 200 000 MGA pour HOPE', 18, NULL, NULL, 15, false, '2026-09-07 19:59:36.115835+03');
INSERT INTO public.notifications (id, type, label, donation_id, message_id, project_id, donor_id, is_read, created_at) VALUES (19, 'DONATION', 'Anna Schmidt a fait un don mensuel de 200 000 MGA pour HOPE', 19, NULL, NULL, 13, false, '2026-09-07 19:59:36.125531+03');
INSERT INTO public.notifications (id, type, label, donation_id, message_id, project_id, donor_id, is_read, created_at) VALUES (20, 'INVESTMENT', '2500000.00 MGA du fonds HOPE investis dans « Santé pour tous »', NULL, NULL, 2, NULL, false, '2026-09-07 19:59:36.135566+03');
INSERT INTO public.notifications (id, type, label, donation_id, message_id, project_id, donor_id, is_read, created_at) VALUES (21, 'INVESTMENT', '1200000.00 MGA du fonds HOPE investis dans « Soutien scolaire Antananarivo »', NULL, NULL, 1, NULL, false, '2026-09-07 19:59:36.151532+03');
INSERT INTO public.notifications (id, type, label, donation_id, message_id, project_id, donor_id, is_read, created_at) VALUES (22, 'INVESTMENT', '800000.00 MGA du fonds HOPE investis dans « Cantines scolaires de Fianarantsoa »', NULL, NULL, 4, NULL, false, '2026-09-07 19:59:36.162839+03');
INSERT INTO public.notifications (id, type, label, donation_id, message_id, project_id, donor_id, is_read, created_at) VALUES (23, 'MESSAGE', 'Jean Rakotoarisoa a envoyé un message : « Nouvelles du soutien scolaire »', NULL, 1, NULL, 1, false, '2026-09-07 19:59:36.50367+03');
INSERT INTO public.notifications (id, type, label, donation_id, message_id, project_id, donor_id, is_read, created_at) VALUES (24, 'MESSAGE', 'Sophie Bernard a envoyé un message : « Reçu fiscal 2026 »', NULL, 2, NULL, 11, false, '2026-09-07 19:59:36.515699+03');
INSERT INTO public.notifications (id, type, label, donation_id, message_id, project_id, donor_id, is_read, created_at) VALUES (25, 'MESSAGE', 'Marc Delaunay a envoyé un message : « Passer mon don mensuel à 600 000 Ar »', NULL, 3, NULL, 12, false, '2026-09-07 19:59:36.521788+03');
INSERT INTO public.notifications (id, type, label, donation_id, message_id, project_id, donor_id, is_read, created_at) VALUES (26, 'MESSAGE', 'Entreprise Tafita Mada a envoyé un message : « Convention de mécénat 2027 »', NULL, 4, NULL, 8, false, '2026-09-07 19:59:36.528163+03');

-- ------------------------------------------------------------
-- Sequences : la prochaine insertion doit suivre le dernier id
-- ------------------------------------------------------------
SELECT pg_catalog.setval('public.admins_id_seq', 1, true);
SELECT pg_catalog.setval('public.beneficiaries_id_seq', 12, true);
SELECT pg_catalog.setval('public.donations_id_seq', 19, true);
SELECT pg_catalog.setval('public.donor_accounts_id_seq', 4, true);
SELECT pg_catalog.setval('public.donors_id_seq', 15, true);
SELECT pg_catalog.setval('public.expenses_id_seq', 6, true);
SELECT pg_catalog.setval('public.impacts_id_seq', 4, true);
SELECT pg_catalog.setval('public.investments_id_seq', 3, true);
SELECT pg_catalog.setval('public.messages_id_seq', 4, true);
SELECT pg_catalog.setval('public.notifications_id_seq', 26, true);
SELECT pg_catalog.setval('public.project_beneficiaries_id_seq', 12, true);
SELECT pg_catalog.setval('public.project_categories_id_seq', 91, true);
SELECT pg_catalog.setval('public.projects_id_seq', 5, true);
SELECT pg_catalog.setval('public.supporting_documents_id_seq', 4, true);

COMMIT;
