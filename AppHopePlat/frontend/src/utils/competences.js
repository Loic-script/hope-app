/**
 * Les savoir-faire de HOPE, en un seul endroit.
 *
 * Deux ecrans s'en servent, et c'est tout l'interet : le benevole coche
 * ce qu'il sait faire, l'equipe coche ce qu'une tache demande. Les deux
 * ecrivent alors les memes intitules -- une tache se rapproche d'un
 * benevole, ce qu'un texte libre ne permettait pas.
 *
 * La liste n'est pas un catalogue de metiers : elle reprend ce que les
 * taches des projets demandent reellement. "Autre" reste des deux
 * cotes : aucune liste ne prevoit tout, et un savoir-faire inattendu
 * est precisement celui qu'il ne faut pas perdre.
 */

/** Les familles, dans l'ordre ou elles se lisent. */
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

/** Les langues qu'on entend le plus souvent sur les projets. */
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

/** Toutes les competences proposees, a plat. */
export const COMPETENCES = FAMILLES_COMPETENCES.flatMap((famille) => famille.competences);
