/**
 * Jeu de donnees de demonstration de l'espace bailleur.
 *
 *   npm run db:seed-funders             installe si l'espace est vide
 *   npm run db:seed-funders -- --force  efface et recommence
 *
 * Rejoue le parcours reel d'un financement institutionnel :
 *
 *   bailleur -> engagement (ce qui est promis)
 *            -> versements (ce qui arrive vraiment, par tranches)
 *            -> affectations (la part attribuee a chaque projet)
 *            -> rapports et justificatifs
 *
 * Le script suppose que les projets existent : lancer d'abord
 * "npm run db:seed-demo -- --force".
 */
import fs from 'node:fs/promises';
import path from 'node:path';

import { fermerPool, query } from '../config/database.js';
import { DOSSIER_MEDIAS } from '../middleware/upload.middleware.js';
import * as funderAuthService from '../services/funderAuth.service.js';
import { installerDocumentsDemo } from './documentsBailleurDemo.js';
import { poserMedia } from './mediasDemo.js';
import { ACTUALITES_DEMO } from './actualitesDemo.js';

const FORCER = process.argv.includes('--force');

/** Date nue AAAA-MM-JJ, decalee de n jours. */
function jour(decalage = 0) {
  const date = new Date();
  date.setDate(date.getDate() + decalage);
  return date.toISOString().slice(0, 10);
}

const TABLES = [
  'manifestation_interet',
  'publication',
  'bailleur_distinction',
  'document_bailleur',
  'affectation',
  'versement',
  'engagement',
  'bailleur_contact',
  'bailleur',
];

async function vider() {
  console.log('[HOPE] --force : suppression des donnees de l espace bailleur...');
  await query(`TRUNCATE ${TABLES.join(', ')} CASCADE`);
  await query(`DELETE FROM utilisateur WHERE email LIKE '%@bailleur.hope.example'`);

  // Les visuels des publications n'ont plus de ligne en base. Sans ce
  // menage, chaque passage en laisserait une copie de plus sur le
  // disque, que rien ne viendrait jamais reclamer.
  try {
    const fichiers = await fs.readdir(DOSSIER_MEDIAS);
    await Promise.all(
      fichiers
        // Visuels des publications, et PDF des documents et certificats :
        // leurs lignes viennent d'etre videes.
        .filter((nom) => /^(publication|document|certificat)-/.test(nom))
        .map((nom) => fs.unlink(path.join(DOSSIER_MEDIAS, nom)))
    );
  } catch (erreur) {
    if (erreur.code !== 'ENOENT') throw erreur;
  }
}

/** Les distinctions du referentiel, et leur regle en clair. */
const DISTINCTIONS = [
  ['partenaire_or', 'Partenaire Or', 'Plus de 20 000 000 Ar engages, tous engagements confondus.'],
  ['multi_domaines', 'Multi-domaines', 'Finance des projets dans au moins trois domaines.'],
  ['renouvele_2x', 'Renouvele deux fois', 'Au moins trois engagements signes avec HOPE.'],
  ['premier_partenaire', 'Premier partenaire', 'Partenaire de HOPE depuis plus de deux ans.'],
];

/** Les deux organisations de demonstration. */
const BAILLEURS = [
  {
    cle: 'fondation',
    raisonSociale: 'Fondation Avenir Océan Indien',
    typeOrganisation: 'fondation_privee',
    secteur: 'Éducation et santé',
    pays: 'France',
    siteWeb: 'https://avenir-oi.example',
    nif: 'FR-4471902',
    adresse: '18 rue de la Solidarité, 75011 Paris',
    niveau: 'or',
    partenaireDepuis: jour(-800),
    contact: {
      nom: 'Lefebvre',
      prenom: 'Claire',
      fonction: 'Responsable partenariats',
      email: 'claire.lefebvre@bailleur.hope.example',
    },
    distinctions: ['partenaire_or', 'multi_domaines', 'renouvele_2x', 'premier_partenaire'],
  },
  {
    cle: 'entreprise',
    raisonSociale: 'Telma Entreprise Citoyenne',
    typeOrganisation: 'entreprise',
    secteur: 'Télécommunications',
    pays: 'Madagascar',
    siteWeb: 'https://telma-citoyen.example.mg',
    nif: 'MG-2019-88410',
    adresse: 'Zone Galaxy Andraharo, Antananarivo',
    niveau: 'argent',
    partenaireDepuis: jour(-300),
    contact: {
      nom: 'Rakotonirina',
      prenom: 'Solofo',
      fonction: 'Directeur RSE',
      email: 'solofo.rakotonirina@bailleur.hope.example',
    },
    distinctions: ['multi_domaines'],
  },
];

async function installer() {
  const projets = await query('SELECT id, name, media_url FROM projects ORDER BY id');
  if (projets.rowCount === 0) {
    throw new Error('Aucun projet en base. Lancez d abord : npm run db:seed-demo -- --force');
  }

  const parNom = new Map(projets.rows.map((p) => [p.name, p.id]));
  const visuelParNom = new Map(projets.rows.map((p) => [p.name, p.media_url]));

  /** Identifiant d'un projet par son nom. Sans repli : un nom errone
   *  rattacherait le financement au mauvais projet sans qu'on le voie. */
  const projet = (nom) => {
    const id = parNom.get(nom);
    if (id === undefined) {
      throw new Error(
        `Projet introuvable : « ${nom} ». Disponibles : ` +
          projets.rows.map((p) => p.name).join(', ')
      );
    }
    return id;
  };

  const admin = await query('SELECT id FROM admins ORDER BY id LIMIT 1');
  const adminId = admin.rows[0]?.id ?? null;

  // --- Referentiel des distinctions ---------------------------------
  for (const [code, libelle, regle] of DISTINCTIONS) {
    await query(
      `INSERT INTO distinction (code, libelle, regle)
       VALUES ($1, $2, $3)
       ON CONFLICT (code) DO UPDATE SET libelle = EXCLUDED.libelle, regle = EXCLUDED.regle`,
      [code, libelle, regle]
    );
  }

  // --- Organisations et comptes -------------------------------------
  const fiches = new Map();
  for (const b of BAILLEURS) {
    const inscrit = await funderAuthService.inscrire({
      raisonSociale: b.raisonSociale,
      typeOrganisation: b.typeOrganisation,
      secteur: b.secteur,
      pays: b.pays,
      siteWeb: b.siteWeb,
      nom: b.contact.nom,
      prenom: b.contact.prenom,
      fonction: b.contact.fonction,
      email: b.contact.email,
      motDePasse: 'bailleur2026',
      confirmation: 'bailleur2026',
    });

    // Les comptes de demonstration sont directement utilisables : on
    // saute l'activation, deja eprouvee ailleurs.
    await query(`UPDATE utilisateur SET statut = 'actif' WHERE id = $1`, [inscrit.utilisateurId]);

    await query(
      `UPDATE bailleur
          SET statut = 'actif', niveau = $2, nif = $3, adresse = $4,
              partenaire_depuis = $5
        WHERE id = $1`,
      [inscrit.bailleurId, b.niveau, b.nif, b.adresse, b.partenaireDepuis]
    );

    for (const code of b.distinctions) {
      await query(
        `INSERT INTO bailleur_distinction (bailleur_id, distinction_code, obtenue_le)
         VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
        [inscrit.bailleurId, code, jour(-200)]
      );
    }

    fiches.set(b.cle, inscrit.bailleurId);
  }

  const fondation = fiches.get('fondation');
  const entreprise = fiches.get('entreprise');

  /** Cree un engagement et renvoie son identifiant. */
  async function engager(bailleurId, e) {
    const resultat = await query(
      `INSERT INTO engagement
         (bailleur_id, intitule, type_soutien, montant_engage, unite,
          quantite_engagee, quantite_realisee, valorisation,
          date_signature, date_debut, date_fin, reference_convention,
          affectation_libre, statut)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       RETURNING id`,
      [
        bailleurId, e.intitule, e.typeSoutien, e.montantEngage ?? null,
        e.unite ?? null, e.quantiteEngagee ?? null, e.quantiteRealisee ?? 0,
        e.valorisation ?? null, e.dateSignature, e.dateDebut, e.dateFin ?? null,
        e.reference ?? null, e.affectationLibre ?? false, e.statut ?? 'en_cours',
      ]
    );
    return resultat.rows[0].id;
  }

  /** Cree un versement. */
  async function verser(engagementId, v) {
    await query(
      `INSERT INTO versement
         (engagement_id, numero_tranche, montant, date_prevue, date_recue,
          moyen, reference_bancaire, saisi_par, statut)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        engagementId, v.tranche ?? null, v.montant, v.datePrevue ?? null,
        v.dateRecue ?? null, v.moyen ?? null, v.reference ?? null,
        adminId, v.statut ?? 'attendu',
      ]
    );
  }

  /** Cree une affectation. Le declencheur SQL verifie le plafond. */
  async function affecter(engagementId, nomProjet, montant, commentaire = null) {
    await query(
      `INSERT INTO affectation (engagement_id, projet_id, montant, date_affectation, commentaire)
       VALUES ($1, $2, $3, $4, $5)`,
      [engagementId, projet(nomProjet), montant, jour(-120), commentaire]
    );
  }

  // ---------------------------------------------------------------
  // Fondation Avenir : trois engagements, dont un a affectation libre
  // ---------------------------------------------------------------
  const education = await engager(fondation, {
    intitule: 'Financement — Éducation 2026',
    typeSoutien: 'financier',
    montantEngage: 15000000,
    dateSignature: jour(-260),
    dateDebut: jour(-250),
    dateFin: jour(115),
    reference: 'CONV-AOI-2026-01',
  });
  // 8 000 000 au lancement, puis le volet Education : l'historique des
  // maquettes.
  await verser(education, {
    tranche: 1, montant: 8000000, datePrevue: jour(-250), dateRecue: jour(-248),
    moyen: 'virement', reference: 'VIR-AOI-88120', statut: 'recu',
  });
  await verser(education, {
    tranche: 2, montant: 6500000, datePrevue: jour(-90), dateRecue: jour(-88),
    moyen: 'virement', reference: 'VIR-AOI-90455', statut: 'recu',
  });
  await verser(education, {
    tranche: 3, montant: 500000, datePrevue: jour(40), statut: 'attendu',
  });
  await affecter(education, 'Soutien scolaire Antananarivo', 9000000, 'Écolages et fournitures');
  await affecter(education, 'Cantines scolaires de Fianarantsoa', 5500000, 'Repas et jardins');

  const sante = await engager(fondation, {
    intitule: 'Financement — Santé communautaire',
    typeSoutien: 'financier',
    montantEngage: 9000000,
    dateSignature: jour(-150),
    dateDebut: jour(-140),
    dateFin: jour(225),
    reference: 'CONV-AOI-2026-02',
    // HOPE choisit les projets : le pendant du don non affecte.
    affectationLibre: true,
  });
  await verser(sante, {
    tranche: 1, montant: 4500000, datePrevue: jour(-140), dateRecue: jour(-137),
    moyen: 'virement', reference: 'VIR-AOI-91002', statut: 'recu',
  });
  await verser(sante, {
    tranche: 2, montant: 4500000, datePrevue: jour(-10), statut: 'en_retard',
  });
  await affecter(sante, 'Santé pour tous', 6000000, 'Médicaments et consultations');

  const formation = await engager(fondation, {
    intitule: 'Mécénat de compétences — formation des équipes',
    typeSoutien: 'competences',
    unite: 'session',
    quantiteEngagee: 12,
    quantiteRealisee: 7,
    valorisation: 3600000,
    dateSignature: jour(-200),
    dateDebut: jour(-190),
    dateFin: jour(170),
    reference: 'CONV-AOI-2026-03',
  });

  // ---------------------------------------------------------------
  // Telma : un financement et un don materiel
  // ---------------------------------------------------------------
  const eau = await engager(entreprise, {
    intitule: 'Financement — Accès à l’eau potable',
    typeSoutien: 'financier',
    montantEngage: 6000000,
    dateSignature: jour(-280),
    dateDebut: jour(-270),
    dateFin: jour(-30),
    reference: 'RSE-TLM-2025-14',
    statut: 'finalise',
  });
  await verser(eau, {
    tranche: 1, montant: 6000000, datePrevue: jour(-270), dateRecue: jour(-265),
    moyen: 'virement', reference: 'VIR-TLM-55210', statut: 'recu',
  });
  await affecter(eau, "Puits d'eau potable Mahajanga", 2000000, 'Forage et pompe');
  await affecter(eau, 'Autonomisation des mères célibataires', 4000000, 'Ateliers et machines');

  const materiel = await engager(entreprise, {
    intitule: 'Don matériel — équipement informatique',
    typeSoutien: 'materiel',
    unite: 'kit',
    quantiteEngagee: 25,
    quantiteRealisee: 25,
    valorisation: 5000000,
    dateSignature: jour(-120),
    dateDebut: jour(-110),
    reference: 'RSE-TLM-2026-03',
    statut: 'finalise',
  });

  // --- Documents ------------------------------------------------------
  //
  // Rapports d'impact, justificatifs, conventions et un certificat, chacun
  // avec son vrai PDF. Le catalogue vit dans documentsBailleurDemo.js, que
  // "npm run db:seed-rapports" rejoue aussi sans toucher aux comptes.
  const documents = await installerDocumentsDemo((sql, valeurs) => query(sql, valeurs), {
    fondation: { id: fondation, education, sante, formation },
    telma: { id: entreprise, eau, materiel },
    projet,
    adminId,
  });

  // --- Fil d'actualite -------------------------------------------------
  const PUBLICATIONS = [
    // Les actualites de demonstration (actualitesDemo.js). La rentree a
    // une photo propre a l'annonce, et non celle du projet : une salle de
    // classe malgache le jour de la rentree dit la nouvelle mieux que le
    // visuel generique du programme.
    ...ACTUALITES_DEMO.map((a) => ({
      type: 'actualite',
      titre: a.titre,
      corps: a.corps,
      projet: a.projet,
      media: a.media,
      publieLe: jour(-a.joursAvant),
    })),
    {
      type: 'appel_financement',
      titre: 'Appel à financement : cantines de Fianarantsoa',
      corps:
        'Il manque 2 640 000 Ar pour assurer un repas chaud par jour jusqu’à la fin de l’année scolaire dans quatre écoles.',
      projet: 'Cantines scolaires de Fianarantsoa',
      montantCible: 4000000,
      publieLe: jour(-6),
    },
    {
      type: 'appel_financement',
      titre: 'Appel à financement : autonomisation des mères célibataires',
      corps:
        'Le programme de formation à la couture cherche un partenaire pour couvrir les 4 920 000 Ar restants.',
      projet: 'Autonomisation des mères célibataires',
      montantCible: 6000000,
      publieLe: jour(-3),
    },
  ];

  for (const p of PUBLICATIONS) {
    // Une publication illustree se lit ; une liste de titres se
    // survole. A defaut de visuel propre, elle reprend celui de son
    // projet : le bailleur reconnait alors le programme d'un coup
    // d'oeil, d'une carte a l'autre.
    const media = p.media
      ? (await poserMedia(p.media, 'publication')).mediaUrl
      : (p.projet ? visuelParNom.get(p.projet) ?? null : null);

    await query(
      `INSERT INTO publication
         (type, titre, corps, projet_id, cibles, montant_cible, publie_le,
          publie_par, media_url)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        p.type, p.titre, p.corps ?? null, p.projet ? projet(p.projet) : null,
        ['bailleurs', 'donateurs'], p.montantCible ?? null, p.publieLe, adminId,
        media,
      ]
    );
  }

  return {
    bailleurs: BAILLEURS.length,
    engagements: 5,
    documents,
    publications: PUBLICATIONS.length,
  };
}

async function executer() {
  if (FORCER) await vider();

  const existants = await query('SELECT COUNT(*)::int AS total FROM bailleur');
  if (existants.rows[0].total > 0) {
    console.log(`[HOPE] ${existants.rows[0].total} bailleur(s) deja en base : donnees ignorees.`);
    console.log('[HOPE] Utilisez "npm run db:seed-funders -- --force" pour recommencer.');
    return;
  }

  const resume = await installer();

  console.log('[HOPE] Espace bailleur : donnees de demonstration installees.');
  console.log(`       ${resume.bailleurs} bailleurs, ${resume.engagements} engagements,`);
  console.log(`       versements, affectations, ${resume.documents} documents,`);
  console.log(`       ${resume.publications} publications et les distinctions.`);
  console.log('       Connexion : claire.lefebvre@bailleur.hope.example / bailleur2026');
  console.log('                   solofo.rakotonirina@bailleur.hope.example / bailleur2026');
}

executer()
  .catch((erreur) => {
    console.error('[HOPE] Echec du seed bailleur :', erreur.message);
    if (erreur.details) console.error('       details :', erreur.details);
    process.exitCode = 1;
  })
  .finally(() => fermerPool());
