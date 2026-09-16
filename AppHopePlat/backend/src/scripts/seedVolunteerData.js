/**
 * Jeu de donnees de demonstration de l'espace benevole.
 *
 *   npm run db:seed-volunteers             installe si l'espace est vide
 *   npm run db:seed-volunteers -- --force  efface et recommence
 *
 * Cree six benevoles et une trentaine de taches reparties sur les cinq
 * projets : a prendre, en cours, et livrees.
 *
 * Le jeu est volontairement retrospectif : un espace ou tout est a
 * faire ne montre ni journal, ni badge. Une quinzaine de taches sont
 * donc deja livrees, et s'etalent sur trois mois pour que le journal ait
 * une histoire a raconter -- les plus recentes attendent encore la
 * validation de HOPE, pour que les deux etats se voient.
 *
 * L'espace ne propose plus de missions. Les tables existent encore dans
 * le schema ; le script les vide pour qu'une base plus ancienne ne garde
 * pas de donnees que plus rien n'affiche.
 *
 * Le script suppose que les projets existent : lancer d'abord
 * "npm run db:seed-demo -- --force".
 */
import { fermerPool, query } from '../config/database.js';
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

// Les tables de missions restent listees : sur une base anterieure,
// elles contiennent encore des lignes que plus aucun ecran ne montre.
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
 * Cinq sont valides par HOPE ; la derniere, inscrite la semaine passee,
 * ne l'est pas encore. Cet etat reste represente : c'est lui que
 * l'administrateur voit en attente dans l'ecran Benevoles.
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
    // Inscrite la semaine derniere : HOPE ne l'a pas encore validee.
    valideParHope: false,
    depuis: -6,
    contactUrgenceNom: 'Fara Razafindrakoto',
    contactUrgenceTel: '+261 34 88 501 62',
  },
];

async function installer() {
  // --- Projets d'accueil des taches ---------------------------------
  //
  // On ne filtre pas sur le statut : une tache livree il y a trois mois
  // peut tres bien porter sur un projet aujourd'hui termine.
  const projets = await query('SELECT id, name FROM projects ORDER BY id');
  if (projets.rowCount === 0) {
    throw new Error('Aucun projet en base. Lancez d abord : npm run db:seed-demo -- --force');
  }

  const parNom = new Map(projets.rows.map((p) => [p.name, p.id]));

  /**
   * Identifiant d'un projet, par son nom.
   *
   * Volontairement sans repli : un nom mal orthographie rattacherait
   * la tache au mauvais projet sans que personne ne le voie. Mieux
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

  // --- Taches -----------------------------------------------------------
  //
  // Une tache "a_faire" n'a pas de titulaire -- la base l'impose, et
  // c'est ce qui la rend visible a tous dans "tâches à prendre".
  //
  // "prise" et "livree" sont des decalages en jours. Une tache livree
  // depuis moins d'une semaine n'est pas encore validee par HOPE : le
  // journal montre ainsi les deux etats.
  const TACHES = [
    // ----- En cours -----
    { projet: 'Soutien scolaire Antananarivo', titre: 'Préparer 30 kits de fournitures',
      description: 'Composer les kits : cahiers, stylos, ardoise, règle. Liste fournie par la coordinatrice.',
      echeance: jour(9), statut: 'en_cours', benevole: 'tokiana', prise: -3 },
    { projet: 'Santé pour tous', titre: 'Vérifier les fiches de consultation saisies',
      description: 'Relire les 120 premières fiches saisies et signaler les écarts avec le papier.',
      echeance: jour(14), statut: 'en_cours', benevole: 'faniry', prise: -5 },
    { projet: 'Cantines scolaires de Fianarantsoa', titre: 'Consolider le tableur des repas du trimestre',
      description: 'Réunir les quatre fichiers d’école en un seul, avec un total par mois et par site.',
      echeance: jour(5), statut: 'en_cours', benevole: 'faniry', prise: -2 },
    { projet: "Puits d'eau potable Mahajanga", titre: 'Organiser la tournée de relevé des puits',
      description: 'Fixer l’itinéraire et prévenir les trois comités de gestion de la date de passage.',
      echeance: jour(6), statut: 'en_cours', benevole: 'hery', prise: -4 },

    // ----- Livrees : trois mois d'histoire -----
    { projet: "Puits d'eau potable Mahajanga", titre: 'Rédiger le compte rendu de la sensibilisation',
      description: 'Deux pages : ce qui a été dit, les questions revenues le plus souvent, ce qu’il reste à faire.',
      statut: 'livree', benevole: 'tokiana', prise: -9, livree: -4 },
    { projet: 'Soutien scolaire Antananarivo', titre: 'Relire les bulletins du premier trimestre',
      description: 'Repérer les enfants dont les notes chutent, pour un point avec leur famille.',
      statut: 'livree', benevole: 'tokiana', prise: -25, livree: -21 },
    { projet: 'Soutien scolaire Antananarivo', titre: 'Traduire le règlement intérieur en malgache',
      statut: 'livree', benevole: 'tokiana', prise: -44, livree: -38 },
    { projet: 'Soutien scolaire Antananarivo', titre: 'Accompagner la distribution des kits de rentrée',
      description: 'Pointer chaque enfant sur la liste et noter les absents pour une seconde distribution.',
      statut: 'livree', benevole: 'tokiana', prise: -74, livree: -72 },
    { projet: 'Soutien scolaire Antananarivo', titre: 'Préparer la fête de fin d’année',
      statut: 'livree', benevole: 'tokiana', prise: -90, livree: -85 },

    { projet: 'Santé pour tous', titre: 'Contrôler les doublons du registre numérique',
      description: 'Repérer les patients saisis deux fois lors de la reprise des dossiers 2025.',
      statut: 'livree', benevole: 'faniry', prise: -16, livree: -11 },
    { projet: 'Santé pour tous', titre: 'Sauvegarder les fichiers du dispensaire',
      description: 'Copier les dossiers sur le disque externe et vérifier qu’ils se rouvrent.',
      statut: 'livree', benevole: 'faniry', prise: -32, livree: -30 },
    { projet: 'Santé pour tous', titre: 'Créer le formulaire de saisie des consultations',
      statut: 'livree', benevole: 'faniry', prise: -62, livree: -55 },
    { projet: "Puits d'eau potable Mahajanga", titre: 'Monter le tableau de suivi des puits',
      description: 'Une ligne par puits : index du compteur, date du relevé, anomalie éventuelle.',
      statut: 'livree', benevole: 'faniry', prise: -68, livree: -64 },

    { projet: 'Santé pour tous', titre: 'Animer l’atelier d’hygiène à l’école',
      statut: 'livree', benevole: 'miora', prise: -20, livree: -17 },
    { projet: 'Santé pour tous', titre: 'Recenser les enfants à vacciner',
      description: 'Croiser le registre scolaire et les carnets de santé présentés par les familles.',
      statut: 'livree', benevole: 'miora', prise: -52, livree: -46 },

    { projet: 'Cantines scolaires de Fianarantsoa', titre: 'Organiser le transport des sacs de riz',
      statut: 'livree', benevole: 'hery', prise: -12, livree: -9 },
    { projet: 'Soutien scolaire Antananarivo', titre: 'Livrer les kits à l’école d’Ambohipo',
      statut: 'livree', benevole: 'hery', prise: -60, livree: -58 },
    { projet: "Puits d'eau potable Mahajanga", titre: 'Inventorier le matériel de forage',
      description: 'Lister l’outillage restant après le chantier, et ce qui doit être réparé.',
      statut: 'livree', benevole: 'hery', prise: -83, livree: -80 },

    { projet: 'Autonomisation des mères célibataires', titre: 'Trier et légender les photos de l’atelier',
      description: 'Garder les vingt meilleures, écrire une légende courte pour chacune.',
      statut: 'livree', benevole: 'anjara', prise: -5, livree: -2 },
    { projet: 'Autonomisation des mères célibataires', titre: 'Rédiger le portrait d’une mère accompagnée',
      description: 'Une page, avec son accord écrit, pour la lettre aux donateurs.',
      statut: 'livree', benevole: 'anjara', prise: -30, livree: -26 },

    // ----- A prendre -----
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

  let livrees = 0;
  for (const t of TACHES) {
    const statut = t.statut ?? 'a_faire';
    const livree = statut === 'livree';
    if (livree) livrees += 1;

    await query(
      `INSERT INTO tache
         (projet_id, titre, description, echeance, statut, benevole_id,
          prise_le, livree_le, validee_par)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        projet(t.projet),
        t.titre,
        t.description ?? null,
        // Une tache livree avait son echeance quelques jours apres la
        // livraison : une date passee, mais tenue.
        t.echeance ?? (livree ? jour(t.livree + 3) : null),
        statut,
        t.benevole ? benevole(t.benevole) : null,
        t.benevole ? quand(t.prise ?? 0, 9) : null,
        livree ? quand(t.livree, 16) : null,
        // Moins d'une semaine : HOPE n'a pas encore valide la livraison.
        livree && t.livree <= -7 ? encadreur : null,
      ]
    );
  }

  return {
    benevoles: BENEVOLES.length,
    taches: TACHES.length,
    livrees,
    enCours: TACHES.filter((t) => t.statut === 'en_cours').length,
  };
}

async function executer() {
  if (FORCER) await vider();

  const existantes = await query('SELECT COUNT(*)::int AS total FROM tache');
  if (existantes.rows[0].total > 0) {
    console.log(
      `[HOPE] ${existantes.rows[0].total} tache(s) deja en base : donnees ignorees.`
    );
    console.log('[HOPE] Utilisez "npm run db:seed-volunteers -- --force" pour recommencer.');
    return;
  }

  const resume = await installer();

  console.log('[HOPE] Espace benevole : donnees de demonstration installees.');
  console.log(`       ${resume.benevoles} benevoles, ${resume.taches} taches :`);
  console.log(`       ${resume.enCours} en cours, ${resume.livrees} livrees sur trois mois.`);
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
