import {
  Apple,
  Briefcase,
  GraduationCap,
  HandHeart,
  HeartPulse,
  LifeBuoy,
  Wrench,
  type LucideIcon,
} from 'lucide-react';

/**
 * LES ACTIVITES DE HOPE.
 *
 * Elles correspondent aux categories de projet du backend, mais vivent ici
 * parce qu'elles portent quelque chose que la base ne stocke pas : une
 * couleur, une icone, un texte de presentation. Le champ `categoryName` fait
 * le lien avec la base, et c'est lui qui sert a filtrer les projets reels.
 *
 * REPARTITION DES COULEURS (imposee par la charte HOPE)
 *   Scolarite ..... bleu
 *   Employabilite . violet
 *   Soins ......... orange
 *   Alimentation .. jaune
 * Les trois activites suivantes reprennent ces teintes, sans en inventer de
 * nouvelle : une palette qui s'etire perd son identite.
 */

export type ActivityTone = 'blue' | 'purple' | 'orange' | 'yellow';

export interface Activity {
  /** Nom EXACT de la categorie en base : sert a filtrer les projets. */
  categoryName: string;
  title: string;
  tagline: string;
  description: string;
  icon: LucideIcon;
  tone: ActivityTone;
  /** Mise en avant sur la page d'accueil. */
  featured: boolean;
}

export const ACTIVITIES: Activity[] = [
  {
    categoryName: 'Scolarité',
    title: 'Scolarité',
    tagline: 'Retourner à l’école, et y rester',
    description:
      'Écolages, fournitures, uniformes et transport. HOPE prend en charge ce qui empêche un enfant orphelin de franchir la porte de sa classe, puis suit sa scolarité année après année.',
    icon: GraduationCap,
    tone: 'blue',
    featured: true,
  },
  {
    categoryName: 'Employabilité',
    title: 'Employabilité',
    tagline: 'Un revenu qui tient dans la durée',
    description:
      'Accompagnement vers l’emploi, aide à la recherche, appui à la création de petites activités. L’autonomie financière est ce qui permet à une mère célibataire de ne plus dépendre de l’aide.',
    icon: Briefcase,
    tone: 'purple',
    featured: true,
  },
  {
    categoryName: 'Soins',
    title: 'Soins',
    tagline: 'Se soigner sans devoir choisir',
    description:
      'Consultations, médicaments essentiels, suivi médical. Sans cela, une fièvre ordinaire devient un arbitrage entre la santé d’un enfant et le repas du soir.',
    icon: HeartPulse,
    tone: 'orange',
    featured: true,
  },
  {
    categoryName: 'Alimentation',
    title: 'Alimentation',
    tagline: 'Manger à sa faim, chaque mois',
    description:
      'Paniers alimentaires mensuels : riz, légumineuses, huile. Une base stable, sans laquelle ni l’école ni le travail ne tiennent.',
    icon: Apple,
    tone: 'yellow',
    featured: true,
  },
  {
    categoryName: 'Formation professionnelle',
    title: 'Formation professionnelle',
    tagline: 'Apprendre un métier',
    description:
      'Couture, cuisine, informatique : des formations courtes et qualifiantes, suivies d’un accompagnement à l’installation.',
    icon: Wrench,
    tone: 'purple',
    featured: false,
  },
  {
    categoryName: 'Soutien social',
    title: 'Soutien social',
    tagline: 'Ne pas rester seul face aux démarches',
    description:
      'Écoute, accompagnement psychologique, aide administrative et médiation familiale.',
    icon: HandHeart,
    tone: 'blue',
    featured: false,
  },
  {
    categoryName: 'Urgence',
    title: 'Urgence',
    tagline: 'Répondre quand tout s’effondre',
    description:
      'Cyclone, maladie grave, expulsion : une réponse rapide pour éviter qu’une crise ponctuelle ne détruise des années de progrès.',
    icon: LifeBuoy,
    tone: 'orange',
    featured: false,
  },
];

export const FEATURED_ACTIVITIES = ACTIVITIES.filter((activity) => activity.featured);

/** Retrouve l'activite correspondant a une categorie de la base. */
export function findActivity(categoryName: string | null | undefined): Activity | undefined {
  if (!categoryName) return undefined;
  return ACTIVITIES.find(
    (activity) => activity.categoryName.toLowerCase() === categoryName.toLowerCase(),
  );
}

/**
 * Classes de style par tonalite.
 *
 * Regroupees ici pour que toutes les cartes d'activite du site restent
 * coherentes : changer une teinte se fait a un seul endroit.
 */
export const TONE_STYLES: Record<
  ActivityTone,
  { surface: string; icon: string; border: string; accent: string }
> = {
  blue: {
    surface: 'bg-hope-blue-light',
    icon: 'bg-hope-blue text-hope-purple-deep',
    border: 'border-hope-blue',
    accent: 'text-hope-purple',
  },
  purple: {
    surface: 'bg-hope-lavender',
    icon: 'bg-hope-purple text-white',
    border: 'border-hope-purple-light',
    accent: 'text-hope-purple',
  },
  orange: {
    surface: 'bg-hope-orange/12',
    icon: 'bg-hope-orange text-hope-ink',
    border: 'border-hope-orange-light',
    accent: 'text-hope-orange-deep',
  },
  yellow: {
    surface: 'bg-hope-yellow/35',
    icon: 'bg-hope-yellow text-hope-ink',
    border: 'border-hope-yellow',
    accent: 'text-hope-orange-deep',
  },
};
