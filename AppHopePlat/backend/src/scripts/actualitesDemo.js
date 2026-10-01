/**
 * Les actualites de demonstration de HOPE.
 *
 * Partagees par le jeu de donnees des bailleurs (seedFunderData.js), qui
 * les publie, et par le jeu de reference (database/data.sql), qui les
 * reprend a l'identique. Chacune raconte un moment d'un des projets de
 * demonstration ; sans visuel propre, elle prend la photo du projet.
 *
 * `joursAvant` : la date de publication, en jours avant aujourd'hui.
 */
export const ACTUALITES_DEMO = [
  {
    titre: 'Rentrée scolaire : 100 enfants accompagnés à Antananarivo',
    corps:
      'Les écolages du premier trimestre sont réglés et les kits distribués. Les 100 enfants du programme ont fait leur rentrée.',
    projet: 'Soutien scolaire Antananarivo',
    media: 'rentree.jpg',
    joursAvant: 12,
  },
  {
    titre: 'Dix mères célibataires diplômées de l’atelier couture d’Antsirabe',
    corps:
      'Après six mois de formation, dix mères célibataires ont reçu leur attestation à Antsirabe. Chacune repart avec une machine à coudre et un premier carnet de commandes : uniformes scolaires, linge de maison, retouches.\n\nQuatre d’entre elles ont déjà ouvert un petit atelier à domicile. L’équipe les suit chaque mois pour les aider à tenir leurs comptes et à trouver de nouveaux clients.',
    projet: 'Autonomisation des mères célibataires',
    joursAvant: 21,
  },
  {
    titre: 'Journée de consultations gratuites à Toamasina : 240 personnes reçues',
    corps:
      'Samedi dernier, deux médecins et trois infirmières bénévoles ont tenu une journée de consultations dans le quartier d’Ankirihiry. 240 personnes ont été reçues, dont 90 enfants de moins de cinq ans.\n\nLes médicaments essentiels ont été remis sur place et douze familles ont été orientées vers l’hôpital pour un suivi. La prochaine journée est prévue le mois prochain.',
    projet: 'Santé pour tous',
    joursAvant: 33,
  },
  {
    titre: 'Les jardins potagers des cantines de Fianarantsoa donnent leurs premières récoltes',
    corps:
      'Plantés en début d’année avec les parents d’élèves, les quatre jardins potagers des cantines scolaires ont livré leurs premières brèdes, carottes et haricots. Ils couvrent désormais un tiers des légumes servis aux enfants.\n\nLes élèves de CM2 tiennent le calendrier des cultures : arrosage, désherbage, récolte. Une façon d’apprendre en mangeant mieux.',
    projet: 'Cantines scolaires de Fianarantsoa',
    joursAvant: 47,
  },
  {
    titre: 'Un nouveau partenaire pour les kits scolaires',
    corps:
      'Une entreprise de la place s’engage à fournir cahiers et stylos à l’ensemble des enfants du programme de soutien scolaire pour les deux prochaines années. Les premiers cartons arrivent avant la fin du mois.\n\nCe partenariat libère des fonds que HOPE consacrera au transport des enfants les plus éloignés de leur école.',
    projet: 'Soutien scolaire Antananarivo',
    joursAvant: 62,
  },
  {
    titre: 'Bilan du premier semestre : ce que vos dons ont permis',
    corps:
      'Au premier semestre, HOPE a accompagné 100 enfants à l’école, servi plus de 18 000 repas dans quatre cantines, formé dix mères à un métier et reçu près de 700 personnes en consultation.\n\nChaque ariary est suivi dans la plateforme : les donateurs retrouvent dans leur espace les dépenses et les justificatifs des projets qu’ils soutiennent. Merci à toutes celles et ceux qui rendent cela possible.',
    projet: null,
    joursAvant: 80,
  },
];
