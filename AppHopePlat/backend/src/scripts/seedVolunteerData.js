/**
 * Jeu de donnees de demonstration de l'espace benevole.
 *
 *   npm run db:seed-volunteers             installe si l'espace est vide
 *   npm run db:seed-volunteers -- --force  efface et recommence
 *
 * Cree six benevoles, dix-sept missions reparties sur les cinq projets,
 * les inscriptions qui vont avec, les heures constatees, les avis et une
 * quinzaine de taches.
 *
 * Le jeu est volontairement dense et surtout retrospectif : un espace ou
 * tout est a venir ne montre ni journal d'heures, ni avis, ni mission
 * terminee. Sept missions sont donc passees, et s'etalent sur trois mois
 * pour que le journal ait une histoire a raconter.
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

/**
 * Les six benevoles de demonstration.
 *
 * Cinq sont valides par HOPE et peuvent prendre une mission de terrain ;
 * la derniere ne l'est pas encore. Cet etat doit rester represente --
 * c'est lui qui fait apparaitre le refus d'inscription sur les missions
 * de terrain, et il n'y a pas d'autre facon de le voir.
 */
const BENEVOLES = [
  {
    cle: 'tokiana',
    nom: 'Randriamanana',
    prenom: 'Tokiana',
    email: 'tokiana@benevole.hope.example',
    profession: 'Enseignante',
    competences: ['soutien scolaire', 'traduction', 'malgache'],
    langues: ['malgache', 'francais'],
    disponibilites: { mercredi: ['matin'], samedi: ['journee'] },
    rayonKm: 15,
    valideParHope: true,
    depuis: -420,
    contactUrgenceNom: 'Rasoa Randriamanana',
    contactUrgenceTel: '+261 34 55 112 20',
  },
  {
    cle: 'faniry',
    nom: 'Andrianjaka',
    prenom: 'Faniry',
    email: 'faniry@benevole.hope.example',
    profession: 'Développeur',
    competences: ['informatique', 'saisie de donnees', 'tableur'],
    langues: ['malgache', 'francais', 'anglais'],
    disponibilites: { mardi: ['soir'], jeudi: ['soir'], samedi: ['matin'] },
    rayonKm: 8,
    valideParHope: true,
    depuis: -240,
    contactUrgenceNom: 'Naina Andrianjaka',
    contactUrgenceTel: '+261 32 78 445 91',
  },
  {
    cle: 'miora',
    nom: 'Rakotoarisoa',
    prenom: 'Miora',
    email: 'miora@benevole.hope.example',
    profession: 'Infirmière',
    competences: ['soins', 'premiers secours', 'sensibilisation'],
    langues: ['malgache', 'francais'],
    disponibilites: { lundi: ['matin'], vendredi: ['journee'] },
    rayonKm: 40,
    valideParHope: true,
    depuis: -310,
    contactUrgenceNom: 'Zo Rakotoarisoa',
    contactUrgenceTel: '+261 33 12 908 44',
  },
  {
    cle: 'hery',
    nom: 'Rasolofo',
    prenom: 'Hery',
    email: 'hery@benevole.hope.example',
    profession: 'Logisticien',
    competences: ['logistique', 'conduite', 'gestion de stock'],
    langues: ['malgache', 'francais'],
    disponibilites: { mardi: ['journee'], jeudi: ['journee'] },
    rayonKm: 120,
    valideParHope: true,
    depuis: -180,
    contactUrgenceNom: 'Vola Rasolofo',
    contactUrgenceTel: '+261 34 71 220 05',
  },
  {
    cle: 'anjara',
    nom: 'Ravelomanana',
    prenom: 'Anjara',
    email: 'anjara@benevole.hope.example',
    profession: 'Étudiante en droit',
    competences: ['redaction', 'photographie', 'accueil'],
    langues: ['malgache', 'francais', 'anglais'],
    disponibilites: { mercredi: ['apres-midi'], samedi: ['journee'], dimanche: ['matin'] },
    rayonKm: 20,
    valideParHope: true,
    depuis: -95,
    contactUrgenceNom: 'Hanta Ravelomanana',
    contactUrgenceTel: '+261 32 04 663 17',
  },
  {
    cle: 'lalaina',
    nom: 'Razafindrakoto',
    prenom: 'Lalaina',
    email: 'lalaina@benevole.hope.example',
    profession: 'Comptable',
    competences: ['comptabilite', 'saisie de donnees'],
    langues: ['malgache', 'francais'],
    disponibilites: { lundi: ['soir'], mercredi: ['soir'] },
    rayonKm: 5,
    // Inscrite la semaine derniere : HOPE ne l'a pas encore validee, elle
    // ne peut donc prendre que des missions a distance.
    valideParHope: false,
    depuis: -6,
    contactUrgenceNom: 'Fara Razafindrakoto',
    contactUrgenceTel: '+261 34 88 501 62',
  },
];

async function installer() {
  // --- Projets d'accueil des missions -------------------------------
  //
  // On ne filtre pas sur le statut : une mission passee peut tres bien
  // porter sur un projet aujourd'hui termine, et c'est meme le cas de
  // plusieurs de celles qui alimentent le journal d'heures.
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
  const fiches = new Map();
  for (const profil of BENEVOLES) {
    const compte = await volunteerAuthService.inscrire({
      nom: profil.nom,
      prenom: profil.prenom,
      email: profil.email,
      motDePasse: 'benevole2026',
      confirmation: 'benevole2026',
    });

    /*
     * Les comptes de demonstration sont directement utilisables : on
     * saute l'etape d'activation, deja eprouvee ailleurs.
     *
     * Le profil est marque complet dans la foulee. Sans cela, l'espace
     * renvoie sur "Completez votre profil" des la connexion -- alors
     * meme que la fiche posee plus bas contient tout ce que ce
     * formulaire demande.
     */
    await query(
      `UPDATE utilisateur SET statut = 'actif', profil_complete = TRUE WHERE id = $1`,
      [compte.id]
    );

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
        jour(profil.depuis),
      ]
    );
    fiches.set(profil.cle, { ...profil, utilisateurId: compte.id, benevoleId: fiche.rows[0].id });
  }

  /** Identifiant de fiche, par cle -- avec le meme parti pris que projet(). */
  const benevole = (cle) => {
    const fiche = fiches.get(cle);
    if (!fiche) throw new Error(`Benevole introuvable : « ${cle} »`);
    return fiche.benevoleId;
  };

  // --- Missions -------------------------------------------------------
  //
  // Sept sont passees, neuf a venir, une annulee. Les trois formats sont
  // representes a chaque epoque : sans mission a distance dans le passe,
  // un benevole non valide pour le terrain n'aurait aucune heure a son
  // journal.
  const MISSIONS = [
    /* ---------- Missions passees ---------- */
    {
      cle: 'rentree',
      projetId: projet('Soutien scolaire Antananarivo'),
      titre: 'Distribution des kits de rentrée',
      description:
        'Remise des fournitures aux cent enfants suivis, école par école, avec émargement des familles.',
      lieuNom: 'Ankadifotsy, Antananarivo',
      latitude: -18.902_5,
      longitude: 47.526_1,
      format: 'terrain',
      dateDebut: quand(-95, 8),
      dateFin: quand(-95, 15),
      placesTotal: 8,
      statut: 'terminee',
      besoins: ['chapeau', 'bouteille d’eau'],
    },
    {
      cle: 'depistage',
      projetId: projet('Santé pour tous'),
      titre: 'Appui au dépistage à Toamasina',
      description:
        'Accueil, orientation et prise des constantes lors de la campagne de dépistage du diabète.',
      lieuNom: 'Toamasina, dispensaire d’Ambodimanga',
      format: 'terrain',
      dateDebut: quand(-62, 7),
      dateFin: quand(-62, 16),
      placesTotal: 6,
      statut: 'terminee',
      besoins: ['blouse', 'pièce d’identité'],
    },
    {
      cle: 'inventaire',
      projetId: projet('Cantines scolaires de Fianarantsoa'),
      titre: 'Inventaire des stocks de riz',
      description:
        'Comptage contradictoire des sacs dans les quatre écoles, et relevé des écarts avec le registre.',
      lieuNom: 'Fianarantsoa centre',
      format: 'presentiel',
      dateDebut: quand(-40, 9),
      dateFin: quand(-40, 13),
      placesTotal: 4,
      statut: 'terminee',
      besoins: [],
    },
    {
      cle: 'numerisation',
      projetId: projet('Santé pour tous'),
      titre: 'Numérisation des dossiers 2025',
      description:
        'Reprise des dossiers papier de l’an dernier dans le registre numérique, avec contrôle des doublons.',
      format: 'distance',
      dateDebut: quand(-33, 18),
      dateFin: quand(-26, 21),
      placesTotal: 5,
      statut: 'terminee',
      besoins: ['ordinateur', 'connexion internet'],
    },
    {
      cle: 'eau',
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
    {
      cle: 'photos',
      projetId: projet('Autonomisation des mères célibataires'),
      titre: 'Reportage photo de l’atelier',
      description:
        'Photographier le travail des mères et recueillir deux ou trois témoignages courts, avec leur accord écrit.',
      lieuNom: 'Antsirabe, quartier Mahazoarivo',
      format: 'terrain',
      dateDebut: quand(-14, 9),
      dateFin: quand(-14, 14),
      placesTotal: 3,
      statut: 'terminee',
      besoins: ['appareil photo'],
    },
    {
      cle: 'tableur',
      projetId: projet('Cantines scolaires de Fianarantsoa'),
      titre: 'Mise à jour du tableur des repas servis',
      description:
        'Reporter les feuilles de présence du mois dans le tableur de suivi, et sortir le total par école.',
      format: 'distance',
      dateDebut: quand(-7, 19),
      dateFin: quand(-5, 21),
      placesTotal: 3,
      statut: 'terminee',
      besoins: ['ordinateur'],
    },

    /* ---------- Missions a venir ---------- */
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
      // Complete : ses quatre places sont prises. La mission reste
      // visible, mais l'inscription est fermee.
      cle: 'vaccination',
      projetId: projet('Santé pour tous'),
      titre: 'Journée de vaccination à Toamasina',
      description:
        'Tenue du registre, orientation des familles et surveillance du délai d’attente après injection.',
      lieuNom: 'Toamasina, école publique d’Ambodimanga',
      format: 'terrain',
      dateDebut: quand(8, 7),
      dateFin: quand(8, 17),
      placesTotal: 4,
      statut: 'complete',
      besoins: ['pièce d’identité', 'chapeau'],
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
      cle: 'permanence',
      projetId: projet('Autonomisation des mères célibataires'),
      titre: 'Permanence d’écoute juridique',
      description:
        'Accueillir les mères qui ont une question de droit de la famille et orienter vers la juriste partenaire.',
      lieuNom: 'Antsirabe, maison des associations',
      format: 'presentiel',
      dateDebut: quand(13, 9),
      dateFin: quand(13, 12),
      recurrence: 'FREQ=MONTHLY;BYDAY=2SA',
      placesTotal: 2,
      besoins: [],
    },
    {
      cle: 'jardin',
      projetId: projet('Cantines scolaires de Fianarantsoa'),
      titre: 'Création du jardin potager de l’école',
      description:
        'Préparer les planches, semer et poser le grillage, avec les parents d’élèves et l’instituteur.',
      lieuNom: 'Fianarantsoa, école d’Ambalapaiso',
      format: 'terrain',
      dateDebut: quand(16, 7),
      dateFin: quand(17, 16),
      placesTotal: 10,
      besoins: ['gants', 'chapeau', 'bouteille d’eau'],
    },
    {
      cle: 'collecte',
      projetId: projet('Soutien scolaire Antananarivo'),
      titre: 'Collecte de livres d’occasion',
      description:
        'Démarcher librairies et écoles privées d’Antananarivo pour réunir trois cents livres de lecture.',
      format: 'distance',
      dateDebut: quand(25, 8),
      dateFin: quand(55, 18),
      placesTotal: 4,
      besoins: [],
    },
    {
      // Annulee : la saison des pluies a rendu la piste impraticable.
      cle: 'forage',
      projetId: projet("Puits d'eau potable Mahajanga"),
      titre: 'Visite de contrôle du forage',
      description:
        'Relevé du débit et état de la margelle, six mois après la mise en service.',
      lieuNom: 'Amborovy, Mahajanga',
      format: 'terrain',
      dateDebut: quand(19, 8),
      dateFin: quand(19, 15),
      placesTotal: 3,
      statut: 'annulee',
      besoins: [],
    },
  ];

  const missions = new Map();
  for (const m of MISSIONS) {
    const resultat = await query(
      `INSERT INTO mission
         (projet_id, titre, description, lieu_nom, latitude, longitude, format,
          date_debut, date_fin, recurrence, places_total, encadreur_id,
          besoins_a_apporter, statut, cree_le)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       RETURNING id`,
      [
        m.projetId, m.titre, m.description, m.lieuNom ?? null,
        m.latitude ?? null, m.longitude ?? null, m.format,
        m.dateDebut, m.dateFin, m.recurrence ?? null, m.placesTotal,
        encadreur, m.besoins, m.statut ?? 'ouverte',
        // Une mission est publiee avant d'avoir lieu : sans cette date,
        // les missions passees seraient toutes creees aujourd'hui.
        m.creeeLe ?? new Date(new Date(m.dateDebut).getTime() - 21 * 86_400_000).toISOString(),
      ]
    );
    missions.set(m.cle, resultat.rows[0].id);
  }

  /** Identifiant de mission, par cle. */
  const mission = (cle) => {
    const id = missions.get(cle);
    if (!id) throw new Error(`Mission introuvable : « ${cle} »`);
    return id;
  };

  // --- Inscriptions ---------------------------------------------------
  //
  // "present" vaut participation constatee : c'est le seul statut qui
  // alimente le journal d'heures, et il ne va donc qu'aux missions
  // passees. Les heures sont celles reellement faites, pas la duree
  // annoncee -- on part parfois plus tot.
  const INSCRIPTIONS = [
    // Missions passees, presence constatee.
    { m: 'rentree', b: 'tokiana', statut: 'present', heures: 6 },
    { m: 'rentree', b: 'anjara', statut: 'present', heures: 5.5 },
    { m: 'rentree', b: 'hery', statut: 'present', heures: 7 },
    { m: 'depistage', b: 'miora', statut: 'present', heures: 8 },
    { m: 'depistage', b: 'hery', statut: 'present', heures: 8 },
    { m: 'inventaire', b: 'hery', statut: 'present', heures: 4 },
    { m: 'inventaire', b: 'faniry', statut: 'present', heures: 4 },
    { m: 'numerisation', b: 'faniry', statut: 'present', heures: 9.5 },
    { m: 'numerisation', b: 'lalaina', statut: 'present', heures: 3 },
    { m: 'eau', b: 'tokiana', statut: 'present', heures: 7.5 },
    { m: 'eau', b: 'miora', statut: 'present', heures: 7 },
    { m: 'photos', b: 'anjara', statut: 'present', heures: 5 },
    { m: 'photos', b: 'tokiana', statut: 'present', heures: 5 },
    // Une absence : elle existe, et l'espace doit savoir l'afficher.
    { m: 'photos', b: 'hery', statut: 'absent' },
    { m: 'tableur', b: 'faniry', statut: 'present', heures: 6 },
    { m: 'tableur', b: 'anjara', statut: 'present', heures: 2.5 },

    // Missions a venir.
    { m: 'traduction', b: 'faniry', statut: 'confirme' },
    { m: 'traduction', b: 'tokiana', statut: 'inscrit' },
    { m: 'saisie', b: 'faniry', statut: 'inscrit' },
    { m: 'saisie', b: 'lalaina', statut: 'inscrit' },
    { m: 'soutien', b: 'tokiana', statut: 'confirme' },
    { m: 'soutien', b: 'anjara', statut: 'inscrit' },
    { m: 'cantine', b: 'hery', statut: 'confirme' },
    { m: 'cantine', b: 'miora', statut: 'inscrit' },
    // Les quatre places de la vaccination : c'est ce qui la rend complete.
    { m: 'vaccination', b: 'miora', statut: 'confirme' },
    { m: 'vaccination', b: 'hery', statut: 'confirme' },
    { m: 'vaccination', b: 'anjara', statut: 'confirme' },
    { m: 'vaccination', b: 'tokiana', statut: 'confirme' },
    { m: 'couture', b: 'anjara', statut: 'confirme' },
    { m: 'permanence', b: 'anjara', statut: 'inscrit' },
    { m: 'jardin', b: 'faniry', statut: 'inscrit' },
    { m: 'collecte', b: 'lalaina', statut: 'inscrit' },
    // La mission annulee garde son inscription annulee, avec son motif.
    {
      m: 'forage',
      b: 'tokiana',
      statut: 'annule',
      motif: 'Mission annulée par HOPE : piste impraticable après les pluies.',
    },
  ];

  for (const i of INSCRIPTIONS) {
    await query(
      `INSERT INTO inscription_mission
         (mission_id, benevole_id, statut, heures_validees, valide_par,
          inscrit_le, annule_le, motif_annulation)
       -- Meme precaution que pour les taches : un parametre employe a
       -- la fois dans l'insertion et dans une comparaison doit porter
       -- son type aux deux endroits, sinon PostgreSQL en deduit deux
       -- (42P08).
       VALUES ($1,$2,$3::VARCHAR,$4::NUMERIC,
               CASE WHEN $4::NUMERIC IS NULL THEN NULL ELSE $5::INTEGER END,
               -- On s'inscrit avant la mission, pas apres : dix jours
               -- plus tot, ou aujourd'hui si la mission est a venir.
               LEAST(NOW(), (SELECT date_debut FROM mission WHERE id = $1) - INTERVAL '10 days'),
               CASE WHEN $3::VARCHAR = 'annule' THEN NOW() ELSE NULL END,
               $6)`,
      [mission(i.m), benevole(i.b), i.statut, i.heures ?? null, encadreur, i.motif ?? null]
    );
  }

  // --- Avis -------------------------------------------------------------
  //
  // Un avis suppose une participation : chacun porte sur une mission ou
  // son auteur est marque present. Tous ne sont pas elogieux.
  const AVIS = [
    {
      m: 'eau',
      b: 'tokiana',
      note: 5,
      commentaire:
        'Accueil du comité de quartier remarquable. Les habitants avaient de vraies questions sur l’entretien de la pompe.',
    },
    {
      m: 'depistage',
      b: 'miora',
      note: 5,
      commentaire:
        'Organisation impeccable et matériel prêt à l’heure. Nous avons vu deux fois plus de monde que prévu.',
    },
    {
      m: 'numerisation',
      b: 'faniry',
      note: 4,
      commentaire:
        'Travail répétitif mais utile. Les dossiers scannés étaient parfois illisibles : à revoir avant la prochaine campagne.',
    },
    {
      m: 'tableur',
      b: 'faniry',
      note: 4,
      commentaire: 'Consignes claires, fichier bien préparé. Deux heures ont suffi.',
    },
    {
      m: 'photos',
      b: 'anjara',
      note: 5,
      commentaire:
        'Les mères se sont prêtées au jeu avec beaucoup de générosité. J’ai rapporté plus de photos que demandé.',
    },
    {
      m: 'rentree',
      b: 'anjara',
      note: 4,
      commentaire: 'Longue journée, très bien encadrée. Prévoir plus d’ombre pour l’émargement.',
    },
    {
      m: 'inventaire',
      b: 'hery',
      note: 3,
      commentaire:
        'Le registre n’était pas à jour, nous avons perdu une heure à recompter. Rien d’insurmontable, mais à corriger.',
    },
  ];

  for (const a of AVIS) {
    await query(
      `INSERT INTO avis_mission (mission_id, benevole_id, note, commentaire)
       VALUES ($1, $2, $3, $4)`,
      [mission(a.m), benevole(a.b), a.note, a.commentaire]
    );
  }

  // --- Taches -----------------------------------------------------------
  //
  // Une tache "a_faire" n'a pas de titulaire -- la base l'impose, et
  // c'est ce qui la rend visible a tous dans "tâches à prendre".
  const TACHES = [
    { projet: 'Soutien scolaire Antananarivo', titre: 'Préparer 30 kits de fournitures',
      description: 'Composer les kits : cahiers, stylos, ardoise, règle. Liste fournie par la coordinatrice.',
      echeance: jour(9), statut: 'en_cours', benevole: 'tokiana' },
    { projet: 'Santé pour tous', titre: 'Vérifier les fiches de consultation saisies',
      description: 'Relire les 120 premières fiches saisies et signaler les écarts avec le papier.',
      echeance: jour(14), statut: 'en_cours', benevole: 'faniry' },
    { projet: 'Cantines scolaires de Fianarantsoa', titre: 'Consolider le tableur des repas du trimestre',
      description: 'Réunir les quatre fichiers d’école en un seul, avec un total par mois et par site.',
      echeance: jour(5), statut: 'en_cours', benevole: 'faniry' },
    { projet: "Puits d'eau potable Mahajanga", titre: 'Rédiger le compte rendu de la sensibilisation',
      description: 'Deux pages : ce qui a été dit, les questions revenues le plus souvent, ce qu’il reste à faire.',
      echeance: jour(-4), statut: 'livree', benevole: 'tokiana' },
    { projet: 'Santé pour tous', titre: 'Contrôler les doublons du registre numérique',
      description: 'Repérer les patients saisis deux fois lors de la reprise des dossiers 2025.',
      echeance: jour(-11), statut: 'livree', benevole: 'faniry' },
    { projet: 'Autonomisation des mères célibataires', titre: 'Trier et légender les photos de l’atelier',
      description: 'Garder les vingt meilleures, écrire une légende courte pour chacune.',
      echeance: jour(-2), statut: 'livree', benevole: 'anjara' },
    { projet: 'Cantines scolaires de Fianarantsoa', titre: 'Établir la liste des fournisseurs de riz',
      description: 'Comparer trois fournisseurs locaux : prix au kilo, capacité, délai de livraison.',
      echeance: jour(12) },
    { projet: 'Autonomisation des mères célibataires', titre: 'Photographier les créations de l’atelier',
      description: 'Une dizaine de photos exploitables pour présenter le travail des mères aux donateurs.',
      echeance: jour(18) },
    { projet: 'Soutien scolaire Antananarivo', titre: 'Traduire la fiche d’inscription en malgache',
      echeance: jour(7) },
    { projet: 'Soutien scolaire Antananarivo', titre: 'Appeler les familles absentes en septembre',
      description: 'Une douzaine d’appels pour comprendre pourquoi l’enfant ne vient plus, sans insister.',
      echeance: jour(4) },
    { projet: 'Santé pour tous', titre: 'Mettre à jour l’affiche de prévention',
      description: 'Reprendre l’affiche de l’an dernier avec les nouveaux horaires du dispensaire.',
      echeance: jour(21) },
    { projet: "Puits d'eau potable Mahajanga", titre: 'Relever les compteurs des trois puits',
      description: 'Photographier chaque compteur et reporter l’index dans le tableau de suivi.',
      echeance: jour(16) },
    { projet: 'Cantines scolaires de Fianarantsoa', titre: 'Dessiner le plan du futur potager',
      description: 'Un croquis coté des planches et de l’allée, à partir des mesures du terrain.',
      echeance: jour(11) },
    { projet: 'Autonomisation des mères célibataires', titre: 'Préparer le questionnaire de satisfaction',
      description: 'Dix questions maximum, en malgache, lisibles par une personne peu scolarisée.',
      echeance: jour(26) },
    { projet: 'Soutien scolaire Antananarivo', titre: 'Inventorier la bibliothèque de l’école',
      description: 'Compter les livres par niveau et signaler ceux qui sont hors d’usage.',
      echeance: jour(30) },
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
        projet(t.projet), t.titre, t.description ?? null, t.echeance ?? null,
        t.statut ?? 'a_faire', t.benevole ? benevole(t.benevole) : null, encadreur,
      ]
    );
  }

  return {
    benevoles: BENEVOLES.length,
    missions: MISSIONS.length,
    inscriptions: INSCRIPTIONS.length,
    avis: AVIS.length,
    taches: TACHES.length,
    heures: INSCRIPTIONS.reduce((total, i) => total + (i.heures ?? 0), 0),
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
  console.log(`       ${resume.inscriptions} inscriptions dont ${resume.heures} h constatees,`);
  console.log(`       ${resume.avis} avis, ${resume.taches} taches.`);
  console.log('       Connexion : tokiana@benevole.hope.example / benevole2026');
  console.log('                   faniry@benevole.hope.example  / benevole2026');
  console.log('                   (idem pour miora, hery, anjara, lalaina)');
}

executer()
  .catch((erreur) => {
    console.error('[HOPE] Echec du seed benevole :', erreur.message);
    if (erreur.details) console.error('       details :', erreur.details);
    process.exitCode = 1;
  })
  .finally(() => fermerPool());
