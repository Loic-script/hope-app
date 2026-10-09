export const FAMILLES_COMPETENCES = [
  {
    titre: 'Sur le terrain',
    competences: [
      'Distribution de repas',
      'Cuisine',
      'Logistique et transport',
      'Conduite',
      'Bricolage et montage',
      'Jardinage et agriculture',
      'Construction',
      'Eau et assainissement',
    ],
  },
  {
    titre: 'Enfance et éducation',
    competences: [
      'Soutien scolaire',
      'Animation d’activités',
      'Alphabétisation',
      'Formation professionnelle',
      'Encadrement de groupe',
    ],
  },
  {
    titre: 'Santé et accompagnement',
    competences: [
      'Premiers secours',
      'Soins infirmiers',
      'Écoute et soutien moral',
      'Accompagnement social',
      'Nutrition',
    ],
  },
  {
    titre: 'Communication',
    competences: [
      'Photographie',
      'Vidéo',
      'Réseaux sociaux',
      'Rédaction',
      'Traduction et interprétariat',
      'Graphisme',
    ],
  },
  {
    titre: 'Gestion et bureau',
    competences: [
      'Gestion de projet',
      'Comptabilité',
      'Secrétariat',
      'Collecte de fonds',
      'Informatique',
      'Saisie de données',
    ],
  },
];

export const LANGUES = [
  'Malgache',
  'Français',
  'Anglais',
  'Allemand',
  'Italien',
  'Espagnol',
  'Chinois',
  'Arabe',
];

export const COMPETENCES = FAMILLES_COMPETENCES.flatMap((famille) => famille.competences);
