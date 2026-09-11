/**
 * Jeu de donnees de demonstration de l'espace benevole.
 *
 *   npm run db:seed-volunteers             installe si l'espace est vide
 *   npm run db:seed-volunteers -- --force  efface et recommence
 *
 * Cree des missions rattachees aux projets existants, des taches, deux
 * benevoles deja actifs, et l'historique qui alimente le journal
 * d'heures -- une mission passee ou la presence est constatee, avec ses
 * heures et son avis.
 *
 * Le script suppose que les projets existent : lancer d'abord
 * "npm run db:seed-demo -- --force".
 */
import { fermerPool, query, transaction } from '../config/database.js';
import * as volunteerAuthService from '../services/volunteerAuth.service.js';

const FORCER = process.argv.includes('--force');

/** Horodatage decale de n jours, a l'heure indiquee. */
function quand(joursDecalage, heure = 8) {
  const date = new Date();
  date.setDate(date.getDate() + joursDecalage);
  date.setHours(heure, 0, 0, 0);
  return date.toISOString();
}

/** Date nue AAAA-MM-JJ, decalee de n jours. */
function jour(decalage = 0) {
  const date = new Date();
  date.setDate(date.getDate() + decalage);
  return date.toISOString().slice(0, 10);
}

const TABLES = ['avis_mission', 'inscription_mission', 'tache', 'mission'];

async function vider() {
  console.log('[HOPE] --force : suppression des donnees de l espace benevole...');
  await query(`TRUNCATE ${TABLES.join(', ')} CASCADE`);
  // Les comptes de demonstration repartent aussi, fiche comprise.
  await query(`DELETE FROM utilisateur WHERE email LIKE '%@benevole.hope.example'`);
}

/** Les deux benevoles de demonstration, deja actifs. */
const BENEVOLES = [
  {
    nom: 'Randriamanana',
    prenom: 'Tokiana',
    email: 'tokiana@benevole.hope.example',
    profession: 'Enseignante',
    competences: ['soutien scolaire', 'traduction', 'malgache'],
    langues: ['malgache', 'francais'],
    disponibilites: { mercredi: ['matin'], samedi: ['journee'] },
    rayonKm: 15,
    valideParHope: true,
    contactUrgenceNom: 'Rasoa Randriamanana',
    contactUrgenceTel: '+261 34 55 112 20',
  },
  {
    nom: 'Andrianjaka',
    prenom: 'Faniry',
    email: 'faniry@benevole.hope.example',
    profession: 'Développeur',
    competences: ['informatique', 'saisie de donnees'],
    langues: ['malgache', 'francais', 'anglais'],
    disponibilites: { mardi: ['soir'], jeudi: ['soir'] },
    rayonKm: 5,
    // Pas encore valide : il ne peut pas prendre de mission de terrain.
    valideParHope: false,
    contactUrgenceNom: 'Naina Andrianjaka',
    contactUrgenceTel: '+261 32 78 445 91',
  },
];

async function installer() {
  // --- Projets d'accueil des missions -------------------------------
  //
  // On ne filtre pas sur le statut : une mission passee peut tres bien
  // porter sur un projet aujourd'hui termine, et c'est meme le cas de
  // celle qui alimente le journal d'heures.
  const projets = await query('SELECT id, name FROM projects ORDER BY id');
  if (projets.rowCount === 0) {
    throw new Error('Aucun projet en base. Lancez d abord : npm run db:seed-demo -- --force');
  }

  const parNom = new Map(projets.rows.map((p) => [p.name, p.id]));

  /**
   * Identifiant d'un projet, par son nom.
   *
   * Volontairement sans repli : un nom mal orthographie rattacherait
   * la mission au mauvais projet sans que personne ne le voie. Mieux
   * vaut arreter le script.
   */
  const projet = (nom) => {
    const id = parNom.get(nom);
    if (id === undefined) {
      throw new Error(
        `Projet introuvable : « ${nom} ». Projets disponibles : ` +
          projets.rows.map((p) => p.name).join(', ')
      );
    }
    return id;
  };

  const admin = await query('SELECT id FROM admins ORDER BY id LIMIT 1');
  const encadreur = admin.rows[0]?.id ?? null;

  // --- Benevoles ------------------------------------------------------
  const fiches = [];
  for (const profil of BENEVOLES) {
    const compte = await volunteerAuthService.inscrire({
      nom: profil.nom,
      prenom: profil.prenom,
      email: profil.email,
      motDePasse: 'benevole2026',
      confirmation: 'benevole2026',
    });

    // Les comptes de demonstration sont directement utilisables : on
    // saute l'etape d'activation, deja eprouvee ailleurs.
    await query(`UPDATE utilisateur SET statut = 'actif' WHERE id = $1`, [compte.id]);

    const fiche = await query(
      `UPDATE benevole
          SET profession = $2, competences = $3, langues = $4,
              disponibilites = $5::JSONB, rayon_km = $6,
              contact_urgence_nom = $7, contact_urgence_tel = $8,
              valide_par_hope = $9,
              valide_le = CASE WHEN $9 THEN NOW() ELSE NULL END,
              valide_par = CASE WHEN $9 THEN $10::INTEGER ELSE NULL END,
              benevole_depuis = $11
        WHERE utilisateur_id = $1
        RETURNING id`,
      [
        compte.id,
        profil.profession,
        profil.competences,
        profil.langues,
        JSON.stringify(profil.disponibilites),
        profil.rayonKm,
        profil.contactUrgenceNom,
        profil.contactUrgenceTel,
        profil.valideParHope,
        encadreur,
        jour(-120),
      ]
    );
    fiches.push({ ...profil, utilisateurId: compte.id, benevoleId: fiche.rows[0].id });
  }

  // --- Missions -------------------------------------------------------
  const MISSIONS = [
    {
      cle: 'soutien',
      projetId: projet('Soutien scolaire Antananarivo'),
      titre: 'Soutien scolaire du mercredi',
      description:
        'Accompagnement aux devoirs pour un groupe de douze enfants de 8 à 12 ans. Lecture, calcul, et préparation des contrôles.',
      lieuNom: 'Ankadifotsy, Antananarivo',
      latitude: -18.902_5,
      longitude: 47.526_1,
      format: 'presentiel',
      dateDebut: quand(4, 14),
      dateFin: quand(4, 17),
      recurrence: 'FREQ=WEEKLY;BYDAY=WE',
      placesTotal: 6,
      besoins: ['tenue confortable', 'bouteille d’eau'],
    },
    {
      cle: 'cantine',
      projetId: projet('Cantines scolaires de Fianarantsoa'),
      titre: 'Service à la cantine scolaire',
      description:
        'Préparation et service du repas de midi dans deux écoles primaires, puis rangement de la cuisine.',
      lieuNom: 'Fianarantsoa centre',
      format: 'terrain',
      dateDebut: quand(6, 9),
      dateFin: quand(6, 14),
      placesTotal: 8,
      besoins: ['tablier', 'chaussures fermées'],
    },
    {
      cle: 'saisie',
      projetId: projet('Santé pour tous'),
      titre: 'Saisie des fiches de consultation',
      description:
        'Report des fiches papier de la campagne médicale dans le tableur de suivi. Travail à distance, à votre rythme.',
      format: 'distance',
      dateDebut: quand(2, 18),
      dateFin: quand(9, 20),
      placesTotal: 4,
      besoins: ['ordinateur', 'connexion internet'],
    },
    {
      cle: 'couture',
      projetId: projet('Autonomisation des mères célibataires'),
      titre: 'Atelier couture : encadrement',
      description:
        'Épauler les formatrices lors de l’atelier de couture : installation des machines, aide individuelle, rangement.',
      lieuNom: 'Antsirabe, quartier Mahazoarivo',
      format: 'terrain',
      dateDebut: quand(11, 8),
      dateFin: quand(11, 12),
      placesTotal: 5,
      besoins: ['tenue confortable'],
    },
    {
      cle: 'traduction',
      projetId: projet('Soutien scolaire Antananarivo'),
      titre: 'Traduction des supports pédagogiques',
      description:
        'Traduire en malgache les fiches d’exercices rédigées en français, pour les niveaux CP à CM2.',
      format: 'distance',
      dateDebut: quand(1, 19),
      dateFin: quand(20, 21),
      placesTotal: 3,
      besoins: [],
    },
    {
      // Mission passee : elle alimente le journal d'heures.
      cle: 'passee',
      projetId: projet("Puits d'eau potable Mahajanga"),
      titre: 'Sensibilisation à l’hygiène de l’eau',
      description:
        'Deux demi-journées de porte-à-porte avec le comité de quartier pour expliquer l’entretien du puits.',
      lieuNom: 'Amborovy, Mahajanga',
      format: 'terrain',
      dateDebut: quand(-21, 8),
      dateFin: quand(-21, 16),
      placesTotal: 6,
      statut: 'terminee',
      besoins: ['chapeau', 'bouteille d’eau'],
    },
  ];

  const missions = new Map();
  for (const m of MISSIONS) {
    const resultat = await query(
      `INSERT INTO mission
         (projet_id, titre, description, lieu_nom, latitude, longitude, format,
          date_debut, date_fin, recurrence, places_total, encadreur_id,
          besoins_a_apporter, statut)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       RETURNING id`,
      [
        m.projetId, m.titre, m.description, m.lieuNom ?? null,
        m.latitude ?? null, m.longitude ?? null, m.format,
        m.dateDebut, m.dateFin, m.recurrence ?? null, m.placesTotal,
        encadreur, m.besoins, m.statut ?? 'ouverte',
      ]
    );
    missions.set(m.cle, resultat.rows[0].id);
  }

  // --- Inscriptions ---------------------------------------------------
  const tokiana = fiches[0];
  const faniry = fiches[1];

  // Tokiana a effectue la mission passee : heures validees et avis.
  await transaction(async (client) => {
    const inscription = await query(
      `INSERT INTO inscription_mission
         (mission_id, benevole_id, statut, heures_validees, valide_par)
       VALUES ($1, $2, 'present', 7.5, $3)
       RETURNING id`,
      [missions.get('passee'), tokiana.benevoleId, encadreur],
      client
    );
    await query(
      `INSERT INTO avis_mission (mission_id, benevole_id, note, commentaire)
       VALUES ($1, $2, 5, $3)`,
      [
        missions.get('passee'),
        tokiana.benevoleId,
        'Accueil du comité de quartier remarquable. Les habitants avaient de vraies questions sur l’entretien de la pompe.',
      ],
      client
    );
    return inscription;
  });

  // Et elle est inscrite au soutien scolaire a venir.
  await query(
    `INSERT INTO inscription_mission (mission_id, benevole_id, statut)
     VALUES ($1, $2, 'confirme')`,
    [missions.get('soutien'), tokiana.benevoleId]
  );

  // Faniry prend une mission a distance : son profil n'est pas encore
  // valide pour le terrain.
  await query(
    `INSERT INTO inscription_mission (mission_id, benevole_id, statut)
     VALUES ($1, $2, 'inscrit')`,
    [missions.get('saisie'), faniry.benevoleId]
  );

  // --- Taches ---------------------------------------------------------
  const TACHES = [
    {
      projetId: projet('Soutien scolaire Antananarivo'),
      titre: 'Préparer 30 kits de fournitures',
      description: 'Composer les kits : cahiers, stylos, ardoise, règle. Liste fournie par la coordinatrice.',
      echeance: jour(9),
      statut: 'en_cours',
      benevoleId: tokiana.benevoleId,
    },
    {
      projetId: projet('Santé pour tous'),
      titre: 'Vérifier les fiches de consultation saisies',
      description: 'Relire les 120 premières fiches saisies et signaler les écarts avec le papier.',
      echeance: jour(14),
      statut: 'en_cours',
      benevoleId: faniry.benevoleId,
    },
    {
      projetId: projet("Puits d'eau potable Mahajanga"),
      titre: 'Rédiger le compte rendu de la sensibilisation',
      description: 'Deux pages : ce qui a été dit, les questions revenues le plus souvent, ce qu’il reste à faire.',
      echeance: jour(-4),
      statut: 'livree',
      benevoleId: tokiana.benevoleId,
    },
    {
      projetId: projet('Cantines scolaires de Fianarantsoa'),
      titre: 'Établir la liste des fournisseurs de riz',
      description: 'Comparer trois fournisseurs locaux : prix au kilo, capacité, délai de livraison.',
      echeance: jour(12),
    },
    {
      projetId: projet('Autonomisation des mères célibataires'),
      titre: 'Photographier les créations de l’atelier',
      description: 'Une dizaine de photos exploitables pour présenter le travail des mères aux donateurs.',
      echeance: jour(18),
    },
    {
      projetId: projet('Soutien scolaire Antananarivo'),
      titre: 'Traduire la fiche d’inscription en malgache',
      echeance: jour(7),
    },
  ];

  for (const t of TACHES) {
    await query(
      // Le type de $5 est fixe a chaque usage : sinon PostgreSQL le
      // deduit varchar dans l'insertion et text dans la comparaison,
      // et refuse la requete (42P08).
      `INSERT INTO tache
         (projet_id, titre, description, echeance, statut, benevole_id,
          prise_le, livree_le, validee_par)
       VALUES ($1,$2,$3,$4,$5::VARCHAR,$6::UUID,
               CASE WHEN $6::UUID IS NULL THEN NULL ELSE NOW() END,
               CASE WHEN $5::VARCHAR = 'livree' THEN NOW() ELSE NULL END,
               CASE WHEN $5::VARCHAR = 'livree' THEN $7::INTEGER ELSE NULL END)`,
      [
        t.projetId, t.titre, t.description ?? null, t.echeance ?? null,
        t.statut ?? 'a_faire', t.benevoleId ?? null, encadreur,
      ]
    );
  }

  return {
    benevoles: fiches.length,
    missions: MISSIONS.length,
    taches: TACHES.length,
  };
}

async function executer() {
  if (FORCER) await vider();

  const existantes = await query('SELECT COUNT(*)::int AS total FROM mission');
  if (existantes.rows[0].total > 0) {
    console.log(
      `[HOPE] ${existantes.rows[0].total} mission(s) deja en base : donnees ignorees.`
    );
    console.log('[HOPE] Utilisez "npm run db:seed-volunteers -- --force" pour recommencer.');
    return;
  }

  const resume = await installer();

  console.log('[HOPE] Espace benevole : donnees de demonstration installees.');
  console.log(`       ${resume.benevoles} benevoles, ${resume.missions} missions,`);
  console.log(`       ${resume.taches} taches, inscriptions, heures et avis.`);
  console.log('       Connexion : tokiana@benevole.hope.example / benevole2026');
  console.log('                   faniry@benevole.hope.example  / benevole2026');
}

executer()
  .catch((erreur) => {
    console.error('[HOPE] Echec du seed benevole :', erreur.message);
    if (erreur.details) console.error('       details :', erreur.details);
    process.exitCode = 1;
  })
  .finally(() => fermerPool());
