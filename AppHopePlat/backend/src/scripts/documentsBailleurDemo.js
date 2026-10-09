import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

import { DOSSIER_MEDIAS, PREFIXE_MEDIAS } from '../middleware/upload.middleware.js';
import { construirePdf } from '../shared/pdfRapport.js';

export function jour(decalage = 0) {
  const date = new Date();
  date.setDate(date.getDate() + decalage);
  return date.toISOString().slice(0, 10);
}

function instant(decalage) {
  const date = new Date();
  date.setDate(date.getDate() + decalage);
  date.setHours(10, 30, 0, 0);
  return date.toISOString();
}

function ariary(montant) {
  return `${Number(montant).toLocaleString('fr-FR').replace(/[\u202f\u00a0]/g, ' ')} Ar`;
}

function dateFr(iso) {
  const [annee, mois, jourDuMois] = iso.slice(0, 10).split('-');
  return `${jourDuMois}/${mois}/${annee}`;
}

function rapportImpact(d) {
  return [
    { t: 'h2', texte: 'Synthèse' },
    { t: 'p', texte: d.synthese },
    { t: 'h2', texte: 'Chiffres clés' },
    { t: 'kv', lignes: d.chiffres },
    { t: 'h2', texte: 'Activités menées' },
    ...d.activites.map((a) => ({ t: 'puce', texte: a })),
    { t: 'h2', texte: 'Ce qu’en disent les personnes accompagnées' },
    { t: 'p', texte: d.temoignage },
    { t: 'h2', texte: 'Prochaines étapes' },
    ...d.suite.map((a) => ({ t: 'puce', texte: a })),
    { t: 'h2', texte: 'Méthode' },
    {
      t: 'p',
      texte:
        'Les chiffres de ce rapport sont tirés du suivi tenu par les équipes de terrain et ' +
        'rapprochés des pièces comptables de HOPE. Les bénéficiaires ne sont jamais nommés : ' +
        'les témoignages sont rapportés avec leur accord et attribués à un rôle.',
    },
  ];
}

function justificatif(d) {
  const total = d.postes.reduce((somme, [, montant]) => somme + montant, 0);
  return [
    { t: 'h2', texte: 'Objet' },
    { t: 'p', texte: d.objet },
    { t: 'h2', texte: 'Versement' },
    { t: 'kv', lignes: d.versement },
    { t: 'h2', texte: 'Emploi des fonds' },
    { t: 'kv', lignes: [...d.postes.map(([l, m]) => [l, ariary(m)]), ['Total justifié', ariary(total)]] },
    { t: 'h2', texte: 'Pièces justificatives' },
    ...d.pieces.map((p) => ({ t: 'puce', texte: p })),
    { t: 'h2', texte: 'Attestation' },
    {
      t: 'p',
      texte:
        'Le trésorier de HOPE atteste que les montants ci-dessus correspondent aux dépenses ' +
        'enregistrées dans la comptabilité de l’association, et que les pièces originales sont ' +
        'tenues à la disposition du partenaire.',
    },
  ];
}

function convention(d) {
  return [
    { t: 'h2', texte: 'Entre les parties' },
    { t: 'p', texte: d.parties },
    { t: 'h2', texte: 'Article 1 — Objet' },
    { t: 'p', texte: d.objet },
    { t: 'h2', texte: 'Article 2 — Engagement' },
    { t: 'kv', lignes: d.engagement },
    { t: 'h2', texte: 'Article 3 — Modalités' },
    ...d.modalites.map((m) => ({ t: 'puce', texte: m })),
    { t: 'h2', texte: 'Article 4 — Compte rendu' },
    {
      t: 'p',
      texte:
        'HOPE transmet au partenaire un rapport d’impact à chaque période convenue et un ' +
        'justificatif financier pour chaque versement reçu. Ces pièces sont publiées dans ' +
        'l’espace partenaire.',
    },
    { t: 'h2', texte: 'Article 5 — Durée' },
    { t: 'p', texte: d.duree },
  ];
}

function certificat(d) {
  return [
    { t: 'h2', texte: 'Attestation de partenariat' },
    {
      t: 'p',
      texte: `HOPE — Hope for a Better Life certifie que ${d.raisonSociale} est partenaire de ` +
        'l’association et soutient ses programmes en faveur des enfants et des familles ' +
        'vulnérables de Madagascar.',
    },
    { t: 'h2', texte: 'Ce que ce partenariat représente' },
    { t: 'kv', lignes: d.chiffres },
    {
      t: 'p',
      texte:
        'Ce certificat est généré automatiquement depuis les engagements enregistrés à la date ' +
        'd’édition. Il peut être présenté au conseil d’administration ou joint à un rapport ' +
        'de responsabilité sociale.',
    },
  ];
}

function catalogue({ fondation, telma }) {
  const AOI = 'Fondation Avenir Océan Indien';
  const TLM = 'Telma Entreprise Citoyenne';

  return [
    {
      bailleur: fondation.id, engagement: fondation.education, projet: 'Soutien scolaire Antananarivo',
      type: 'rapport_impact', titre: 'Rapport d’impact — Éducation, 3e trimestre 2026',
      debut: -92, fin: -2, publie: -1, lectures: 0,
      corps: rapportImpact({
        synthese:
          'Le trimestre a couvert la rentrée scolaire. Les 100 enfants du programme d’Antananarivo ' +
          'ont repris les cours avec leurs écolages réglés et un kit complet. L’assiduité se ' +
          'maintient au-dessus de l’objectif fixé dans la convention.',
        chiffres: [
          ['Enfants scolarisés', '100 sur 100'],
          ['Taux de présence moyen', '94 %'],
          ['Kits scolaires distribués', '100'],
          ['Montant affecté au projet', ariary(9000000)],
          ['Dépensé sur le trimestre', ariary(1050000)],
        ],
        activites: [
          'Règlement des écolages du premier trimestre dans les cinq écoles partenaires.',
          'Distribution de 100 kits : cahiers, stylos, ardoise, règle et sac.',
          'Suivi individuel des douze enfants dont les notes avaient baissé au trimestre précédent.',
          'Réunion de rentrée avec les familles, en malgache, à Ankadifotsy.',
        ],
        temoignage:
          '« Avant, ma fille manquait l’école quand il fallait choisir entre les frais et le repas. ' +
          'Cette année, elle n’a pas manqué un seul jour. » — une mère de famille d’Ankadifotsy.',
        suite: [
          'Bulletins du premier trimestre attendus mi-décembre.',
          'Ateliers de soutien en mathématiques pour 18 enfants repérés.',
        ],
      }),
    },
    {
      bailleur: fondation.id, engagement: fondation.education, projet: 'Soutien scolaire Antananarivo',
      type: 'rapport_impact', titre: 'Rapport d’impact — Éducation, 2e trimestre 2026',
      debut: -183, fin: -93, publie: -85, lectures: 3, lu: -61,
      corps: rapportImpact({
        synthese:
          'Fin d’année scolaire : 96 des 100 enfants passent en classe supérieure. Les quatre ' +
          'redoublements concernent des enfants arrivés en cours d’année ; un accompagnement ' +
          'renforcé est prévu pour eux.',
        chiffres: [
          ['Passage en classe supérieure', '96 %'],
          ['Taux de présence moyen', '91 %'],
          ['Heures de soutien scolaire', '420'],
          ['Dépensé sur le trimestre', ariary(1900000)],
        ],
        activites: [
          'Soutien scolaire deux fois par semaine, animé par des bénévoles enseignants.',
          'Préparation des examens de fin de cycle primaire pour 22 élèves.',
          'Fête de fin d’année avec les familles et les enseignants.',
        ],
        temoignage:
          '« Les enfants du programme arrivent à l’heure et avec leurs affaires. Cela change la ' +
          'classe entière. » — une enseignante d’Ankadifotsy.',
        suite: ['Rentrée de septembre : écolages et kits.', 'Recrutement de deux bénévoles en mathématiques.'],
      }),
    },
    {
      bailleur: fondation.id, engagement: fondation.education, projet: 'Cantines scolaires de Fianarantsoa',
      type: 'rapport_impact', titre: 'Rapport d’impact — Cantines scolaires de Fianarantsoa, 1er semestre',
      debut: -200, fin: -20, publie: -15, lectures: 1, lu: -12,
      corps: rapportImpact({
        synthese:
          'Quatre écoles servent désormais un repas chaud par jour. Les directeurs constatent une ' +
          'baisse nette des absences l’après-midi, et les premiers jardins potagers fournissent ' +
          'une partie des légumes.',
        chiffres: [
          ['Élèves nourris chaque jour', '200'],
          ['Repas servis sur le semestre', '21 400'],
          ['Jardins potagers en culture', '3 sur 4'],
          ['Montant affecté au projet', ariary(5500000)],
        ],
        activites: [
          'Achat groupé de riz auprès de producteurs de la région.',
          'Formation de quatre cuisinières aux règles d’hygiène.',
          'Aménagement de trois jardins avec les parents d’élèves.',
        ],
        temoignage:
          '« L’après-midi, les enfants ne dorment plus sur les bancs. On peut enfin faire cours. » ' +
          '— un directeur d’école de Fianarantsoa.',
        suite: ['Quatrième jardin avant la saison des pluies.', 'Pesée des élèves en début d’année scolaire.'],
      }),
    },
    {
      bailleur: fondation.id, engagement: fondation.sante, projet: 'Santé pour tous',
      type: 'rapport_impact', titre: 'Rapport d’impact — Santé communautaire, premier bilan',
      debut: -140, fin: -30, publie: -25, lectures: 2, lu: -18,
      corps: rapportImpact({
        synthese:
          'La campagne de consultations gratuites de Toamasina a touché deux fois plus de familles ' +
          'que prévu. Le stock de médicaments essentiels a tenu, grâce à la première tranche reçue.',
        chiffres: [
          ['Consultations gratuites', '1 240'],
          ['Familles suivies', '350'],
          ['Enfants vaccinés', '186'],
          ['Montant affecté au projet', ariary(6000000)],
        ],
        activites: [
          'Consultations hebdomadaires dans deux quartiers de Toamasina.',
          'Recensement des enfants à vacciner avec le registre scolaire.',
          'Ateliers d’hygiène dans trois écoles.',
        ],
        temoignage:
          '« On venait au dispensaire trop tard, quand il n’y avait plus rien à faire. Maintenant on ' +
          'vient dès la fièvre. » — une mère de famille de Toamasina.',
        suite: [
          'La deuxième tranche, attendue, conditionne le réapprovisionnement de décembre.',
          'Extension des consultations à un troisième quartier.',
        ],
      }),
    },
    {
      bailleur: fondation.id, engagement: null, projet: null,
      type: 'rapport_impact', titre: 'Rapport annuel HOPE 2025',
      debut: -620, fin: -256, publie: -240, lectures: 5, lu: -120,
      corps: rapportImpact({
        synthese:
          'En 2025, HOPE a accompagné plus de 600 enfants et familles dans cinq programmes, avec ' +
          'une équipe de bénévoles passée de 12 à 31 personnes. Ce rapport présente l’ensemble des ' +
          'activités de l’association, tous financements confondus.',
        chiffres: [
          ['Bénéficiaires accompagnés', '640'],
          ['Programmes actifs', '5'],
          ['Bénévoles engagés', '31'],
          ['Part des fonds allant au terrain', '87 %'],
        ],
        activites: [
          'Ouverture du programme d’autonomisation des mères célibataires à Antsirabe.',
          'Mise en service d’un puits d’eau potable à Mahajanga.',
          'Premier partenariat avec une fondation internationale.',
        ],
        temoignage:
          '« HOPE ne vient pas donner puis repartir. Ils reviennent, ils demandent ce qui a marché. » ' +
          '— un responsable de quartier de Mahajanga.',
        suite: ['Doubler le nombre d’enfants suivis à Fianarantsoa.', 'Publier un rapport trimestriel par programme.'],
      }),
    },
    {
      bailleur: fondation.id, engagement: fondation.education, projet: null,
      type: 'justificatif_financier', titre: 'Justificatif financier — Éducation, tranche 1',
      debut: -248, fin: -160, publie: -150, lectures: 4, lu: -140,
      corps: justificatif({
        objet: 'Emploi de la première tranche du financement Éducation 2026 (convention CONV-AOI-2026-01).',
        versement: [
          ['Tranche', '1 sur 3'],
          ['Montant reçu', ariary(8000000)],
          ['Date de réception', dateFr(jour(-248))],
          ['Référence du virement', 'VIR-AOI-88120'],
        ],
        postes: [
          ['Écolages — Soutien scolaire', 3200000],
          ['Fournitures et kits', 1400000],
          ['Repas — Cantines de Fianarantsoa', 2300000],
          ['Équipement des cuisines', 700000],
          ['Suivi et transport', 400000],
        ],
        pieces: [
          '42 reçus d’écolage signés par les écoles.',
          'Factures du fournisseur de fournitures n° F-2026-118 à F-2026-121.',
          'Bons de livraison du riz, janvier à mars.',
        ],
      }),
    },
    {
      bailleur: fondation.id, engagement: fondation.education, projet: null,
      type: 'justificatif_financier', titre: 'Justificatif financier — Éducation, tranche 2',
      debut: -88, fin: -10, publie: -6, lectures: 0,
      corps: justificatif({
        objet: 'Emploi de la deuxième tranche du financement Éducation 2026 (convention CONV-AOI-2026-01).',
        versement: [
          ['Tranche', '2 sur 3'],
          ['Montant reçu', ariary(6500000)],
          ['Date de réception', dateFr(jour(-88))],
          ['Référence du virement', 'VIR-AOI-90455'],
        ],
        postes: [
          ['Écolages de la rentrée', 3100000],
          ['Kits scolaires de la rentrée', 1300000],
          ['Repas — Cantines de Fianarantsoa', 1800000],
          ['Semences et outils des jardins', 300000],
        ],
        pieces: [
          'Reçus d’écolage du premier trimestre.',
          'Facture groupée des 100 kits scolaires.',
          'Relevé mensuel des repas servis par école.',
        ],
      }),
    },
    {
      bailleur: fondation.id, engagement: fondation.sante, projet: null,
      type: 'justificatif_financier', titre: 'Justificatif financier — Santé, tranche 1',
      debut: -137, fin: -40, publie: -35, lectures: 2, lu: -30,
      corps: justificatif({
        objet: 'Emploi de la première tranche du financement Santé communautaire (convention CONV-AOI-2026-02).',
        versement: [
          ['Tranche', '1 sur 2'],
          ['Montant reçu', ariary(4500000)],
          ['Date de réception', dateFr(jour(-137))],
          ['Référence du virement', 'VIR-AOI-91002'],
        ],
        postes: [
          ['Médicaments essentiels', 2100000],
          ['Honoraires des consultations', 1500000],
          ['Matériel de vaccination', 600000],
          ['Sensibilisation dans les écoles', 300000],
        ],
        pieces: [
          'Factures de la pharmacie centrale de Toamasina.',
          'Registre des consultations tenu par le dispensaire.',
          'Bons de commande du matériel de vaccination.',
        ],
      }),
    },
    {
      bailleur: fondation.id, engagement: fondation.education, projet: null,
      type: 'justificatif_financier', titre: 'Relevé des affectations — Éducation 2026',
      debut: -250, fin: -60, publie: -58, lectures: 1, lu: -57,
      corps: justificatif({
        objet:
          'Répartition du financement Éducation 2026 entre les projets de HOPE, telle qu’elle ' +
          'figure dans la comptabilité à la date d’édition.',
        versement: [
          ['Montant engagé', ariary(15000000)],
          ['Montant reçu à date', ariary(14500000)],
          ['Montant affecté aux projets', ariary(14500000)],
        ],
        postes: [
          ['Soutien scolaire Antananarivo', 9000000],
          ['Cantines scolaires de Fianarantsoa', 5500000],
        ],
        pieces: ['Décisions d’affectation signées par le bureau de HOPE.'],
      }),
    },
    {
      bailleur: fondation.id, engagement: fondation.education, projet: null,
      type: 'convention', titre: 'Convention de partenariat CONV-AOI-2026-01 — Éducation',
      debut: null, fin: null, publie: -258, lectures: 6, lu: -200,
      corps: convention({
        parties: `L’association HOPE — Hope for a Better Life, d’une part, et ${AOI}, d’autre part.`,
        objet:
          'Le financement de la scolarité et de l’alimentation d’enfants vulnérables à Antananarivo ' +
          'et à Fianarantsoa pendant l’année scolaire 2026.',
        engagement: [
          ['Montant engagé', ariary(15000000)],
          ['Versement', 'en trois tranches'],
          ['Affectation', 'projets désignés par la convention'],
        ],
        modalites: [
          'Tranche 1 : 8 000 000 Ar à la signature.',
          'Tranche 2 : 6 500 000 Ar sur présentation du rapport du premier semestre.',
          'Tranche 3 : 500 000 Ar au bilan de fin de convention.',
        ],
        duree: 'La convention prend effet à sa signature et court jusqu’au bilan de fin d’année scolaire.',
      }),
    },
    {
      bailleur: fondation.id, engagement: fondation.sante, projet: null,
      type: 'convention', titre: 'Convention de partenariat CONV-AOI-2026-02 — Santé communautaire',
      debut: null, fin: null, publie: -148, lectures: 2, lu: -146,
      corps: convention({
        parties: `L’association HOPE — Hope for a Better Life, d’une part, et ${AOI}, d’autre part.`,
        objet:
          'Le financement de consultations gratuites et de l’accès aux médicaments essentiels. ' +
          'HOPE choisit les projets bénéficiaires et en rend compte.',
        engagement: [
          ['Montant engagé', ariary(9000000)],
          ['Versement', 'en deux tranches'],
          ['Affectation', 'libre, décidée par HOPE'],
        ],
        modalites: ['Tranche 1 : 4 500 000 Ar à la signature.', 'Tranche 2 : 4 500 000 Ar à mi-parcours.'],
        duree: 'Douze mois à compter de la signature, renouvelable par avenant.',
      }),
    },
    {
      bailleur: fondation.id, engagement: fondation.formation, projet: null,
      type: 'convention', titre: 'Convention de mécénat de compétences CONV-AOI-2026-03',
      debut: null, fin: null, publie: -198, lectures: 1, lu: -197,
      corps: convention({
        parties: `L’association HOPE — Hope for a Better Life, d’une part, et ${AOI}, d’autre part.`,
        objet: 'La formation des équipes de HOPE par des professionnels de la fondation.',
        engagement: [
          ['Sessions prévues', '12'],
          ['Valorisation', ariary(3600000)],
          ['Nature', 'mécénat de compétences'],
        ],
        modalites: [
          'Sessions d’une journée, à Antananarivo ou à distance.',
          'Thèmes : gestion de projet, comptabilité associative, suivi d’impact.',
        ],
        duree: 'Jusqu’à la réalisation des douze sessions, et au plus tard dans un an.',
      }),
    },
    {
      bailleur: fondation.id, engagement: null, projet: null, genereAuto: true,
      type: 'certificat', titre: 'Certificat de partenariat HFBL-PART-000112',
      debut: null, fin: null, publie: -45, lectures: 1, lu: -45,
      corps: certificat({
        raisonSociale: AOI,
        chiffres: [
          ['Montant engagé', ariary(24000000)],
          ['Projets financés', '3'],
          ['Bénéficiaires touchés', '650'],
          ['Domaines', 'Scolarité, Soins, Alimentation'],
        ],
      }),
    },

    {
      bailleur: telma.id, engagement: telma.eau, projet: "Puits d'eau potable Mahajanga",
      type: 'rapport_impact', titre: 'Rapport d’impact — Accès à l’eau potable, bilan final',
      debut: -270, fin: -30, publie: -28, lectures: 2, lu: -20,
      corps: rapportImpact({
        synthese:
          'Le puits d’Amborovy est en service depuis six mois. Il alimente le quartier sans ' +
          'interruption, et le comité de gestion formé par HOPE assure seul l’entretien courant.',
        chiffres: [
          ['Habitants desservis', '400'],
          ['Litres distribués par jour', '9 000'],
          ['Jours sans interruption', '181'],
          ['Montant affecté au projet', ariary(2000000)],
        ],
        activites: [
          'Forage à 38 mètres et installation d’une pompe manuelle.',
          'Analyse de potabilité par un laboratoire agréé.',
          'Formation du comité de gestion : entretien, petite caisse, registre.',
        ],
        temoignage:
          '« Les enfants ne font plus deux heures de marche pour l’eau. Ils vont à l’école le matin. » ' +
          '— une membre du comité de gestion d’Amborovy.',
        suite: ['Contrôle de potabilité annuel.', 'Étude d’un second puits pour le quartier voisin.'],
      }),
    },
    {
      bailleur: telma.id, engagement: telma.eau, projet: 'Autonomisation des mères célibataires',
      type: 'rapport_impact', titre: 'Rapport d’impact — Autonomisation des mères célibataires, mi-parcours',
      debut: -200, fin: -50, publie: -45, lectures: 1, lu: -44,
      corps: rapportImpact({
        synthese:
          'Vingt-cinq mères suivent la formation à la couture. Onze ont déjà vendu leurs premières ' +
          'pièces, et quatre ont ouvert un petit atelier chez elles.',
        chiffres: [
          ['Mères formées', '25'],
          ['Premières ventes', '11'],
          ['Ateliers ouverts', '4'],
          ['Montant affecté au projet', ariary(4000000)],
        ],
        activites: [
          'Achat de huit machines à coudre partagées.',
          'Cours de gestion d’une micro-activité, deux fois par mois.',
          'Garde des jeunes enfants pendant les ateliers.',
        ],
        temoignage:
          '« J’ai payé la rentrée de mon fils avec ce que j’ai cousu. C’est la première fois que je ' +
          'n’ai rien demandé à personne. » — une participante de l’atelier d’Antsirabe.',
        suite: ['Achat de tissu en gros pour réduire les coûts.', 'Marché de fin d’année pour vendre les créations.'],
      }),
    },
    {
      bailleur: telma.id, engagement: telma.eau, projet: null,
      type: 'justificatif_financier', titre: 'Justificatif financier — versement unique',
      debut: -265, fin: -120, publie: -110, lectures: 3, lu: -90,
      corps: justificatif({
        objet: 'Emploi du financement Accès à l’eau potable (convention RSE-TLM-2025-14).',
        versement: [
          ['Tranche', 'versement unique'],
          ['Montant reçu', ariary(6000000)],
          ['Date de réception', dateFr(jour(-265))],
          ['Référence du virement', 'VIR-TLM-55210'],
        ],
        postes: [
          ['Forage et pompe — Mahajanga', 1650000],
          ['Analyse de potabilité', 150000],
          ['Formation du comité de gestion', 200000],
          ['Machines à coudre — Antsirabe', 2400000],
          ['Tissus et fournitures des ateliers', 1600000],
        ],
        pieces: [
          'Facture de l’entreprise de forage n° FOR-2025-044.',
          'Rapport d’analyse du laboratoire.',
          'Factures d’achat des huit machines à coudre.',
        ],
      }),
    },
    {
      bailleur: telma.id, engagement: telma.materiel, projet: null,
      type: 'justificatif_financier', titre: 'Attestation de réception — 25 kits informatiques',
      debut: -110, fin: -100, publie: -100, lectures: 1, lu: -99,
      corps: justificatif({
        objet:
          'Réception et mise en service du don matériel (convention RSE-TLM-2026-03). Le don ' +
          'étant en nature, les montants indiqués sont la valorisation convenue.',
        versement: [
          ['Nature', 'don matériel'],
          ['Quantité reçue', '25 kits'],
          ['Date de réception', dateFr(jour(-110))],
        ],
        postes: [
          ['Ordinateurs portables (20)', 4000000],
          ['Imprimantes (5)', 1000000],
        ],
        pieces: ['Bon de livraison signé à la réception.', 'Inventaire du matériel par site.'],
      }),
    },
    {
      bailleur: telma.id, engagement: telma.eau, projet: null,
      type: 'convention', titre: 'Convention RSE-TLM-2025-14 — Accès à l’eau potable',
      debut: null, fin: null, publie: -278, lectures: 2, lu: -270,
      corps: convention({
        parties: `L’association HOPE — Hope for a Better Life, d’une part, et ${TLM}, d’autre part.`,
        objet: 'Le financement de l’accès à l’eau potable et de l’autonomie économique de familles vulnérables.',
        engagement: [
          ['Montant engagé', ariary(6000000)],
          ['Versement', 'unique, à la signature'],
          ['Affectation', 'projets désignés par la convention'],
        ],
        modalites: ['Versement unique de 6 000 000 Ar.', 'Bilan final dans le mois suivant la fin du chantier.'],
        duree: 'Neuf mois à compter de la signature.',
      }),
    },
    {
      bailleur: telma.id, engagement: telma.materiel, projet: null,
      type: 'convention', titre: 'Convention de don matériel RSE-TLM-2026-03',
      debut: null, fin: null, publie: -118, lectures: 1, lu: -117,
      corps: convention({
        parties: `L’association HOPE — Hope for a Better Life, d’une part, et ${TLM}, d’autre part.`,
        objet: 'Le don de 25 kits informatiques destinés au suivi des programmes et au soutien scolaire.',
        engagement: [
          ['Quantité', '25 kits'],
          ['Valorisation', ariary(5000000)],
          ['Nature', 'don matériel'],
        ],
        modalites: ['Livraison en une fois à Antananarivo.', 'Attestation de réception remise par HOPE.'],
        duree: 'La convention prend fin à la réception du matériel.',
      }),
    },
  ];
}

export async function installerDocumentsDemo(executer, contexte, ecrits = []) {
  await fs.mkdir(DOSSIER_MEDIAS, { recursive: true });
  const documents = catalogue(contexte);

  for (const d of documents) {
    const sousTitre =
      (d.debut !== null ? `Période du ${dateFr(jour(d.debut))} au ${dateFr(jour(d.fin))} · ` : '') +
      `Publié le ${dateFr(jour(d.publie))}`;
    const { contenu, pages } = construirePdf({ titre: d.titre, sousTitre, blocs: d.corps });

    const nom = `document-${d.type}-${Date.now()}-${crypto.randomBytes(8).toString('hex')}.pdf`;
    const chemin = path.join(DOSSIER_MEDIAS, nom);
    await fs.writeFile(chemin, contenu);
    ecrits.push(chemin);

    await executer(
      `INSERT INTO document_bailleur
         (bailleur_id, engagement_id, projet_id, type, titre, periode_debut, periode_fin,
          fichier_url, nb_pages, genere_auto, publie_le, publie_par,
          telecharge_le, nb_telechargements, contenu)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
      [
        d.bailleur,
        d.engagement ?? null,
        d.projet ? contexte.projet(d.projet) : null,
        d.type,
        d.titre,
        d.debut !== null ? jour(d.debut) : null,
        d.fin !== null ? jour(d.fin) : null,
        `${PREFIXE_MEDIAS}/${nom}`,
        pages,
        d.genereAuto ?? false,
        instant(d.publie),
        d.genereAuto ? null : contexte.adminId,
        d.lectures > 0 ? instant(d.lu) : null,
        d.lectures,
        JSON.stringify({ sousTitre, blocs: d.corps }),
      ]
    );
  }
  return documents.length;
}

export async function fichiersDesDocuments(executer, bailleurIds) {
  const resultat = await executer(
    'SELECT fichier_url FROM document_bailleur WHERE bailleur_id = ANY($1::UUID[])',
    [bailleurIds]
  );
  return resultat.rows
    .map((ligne) => path.basename(String(ligne.fichier_url ?? '')))
    .filter((nom) => /^(document|certificat)-[\w.-]+\.pdf$/.test(nom))
    .map((nom) => path.join(DOSSIER_MEDIAS, nom));
}
