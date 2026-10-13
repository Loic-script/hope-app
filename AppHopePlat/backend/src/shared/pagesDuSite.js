export const NOM_DU_SITE = 'HOPE – Hope for a Better Life';

const SUFFIXE = ' — HOPE';
const LONGUEUR_DESCRIPTION = 160;

export const DESCRIPTION_DE_PARTAGE =
  'Scolarité, employabilité, soins et alimentation pour les orphelins et les mères célibataires de Madagascar.';

export const PAGES_PUBLIQUES = [
  {
    chemin: '/',
    priorite: '1.0',
    frequence: 'weekly',
    titre: 'HOPE – Hope for a Better Life, association à Madagascar',
    description:
      'HOPE accompagne les enfants orphelins et les mères célibataires de Madagascar : scolarité, employabilité, soins et alimentation. Faites un don ou engagez-vous.',
    descriptionDePartage: DESCRIPTION_DE_PARTAGE,
  },
  {
    chemin: '/nous-decouvrir',
    priorite: '0.8',
    frequence: 'monthly',
    titre: `Qui sommes-nous ? Raison d’être, vision et mission${SUFFIXE}`,
    description:
      'Fondée en 2023, HOPE est une association à but non lucratif au service des orphelins et des mères célibataires de Madagascar : vision, mission, équipe.',
  },
  {
    chemin: '/nos-projets',
    priorite: '0.8',
    frequence: 'weekly',
    titre: `Nos projets à Madagascar${SUFFIXE}`,
    description:
      'Les projets de HOPE à Madagascar, réalisés ou en cours : scolarité, employabilité, soins et alimentation pour les orphelins et les mères célibataires.',
  },
  {
    chemin: '/actualites',
    priorite: '0.8',
    frequence: 'weekly',
    titre: `Actualités de l’association${SUFFIXE}`,
    description:
      'Les dernières nouvelles de HOPE à Madagascar : les actions menées sur le terrain et l’avancée des projets auprès des orphelins et des mères célibataires.',
  },
  {
    chemin: '/s-engager',
    priorite: '0.7',
    frequence: 'monthly',
    titre: `S’engager : devenir partenaire, donateur ou bénévole${SUFFIXE}`,
    description:
      'Institution, entreprise ou particulier : trois façons de s’engager aux côtés de HOPE pour les orphelins et les mères célibataires de Madagascar.',
  },
  {
    chemin: '/faire-un-don',
    priorite: '0.7',
    frequence: 'monthly',
    titre: `Faire un don${SUFFIXE}`,
    description:
      'En quelques minutes, sans créer de compte, votre don rejoint les enfants orphelins et les mères célibataires que HOPE accompagne à Madagascar.',
  },
  {
    chemin: '/contact',
    priorite: '0.6',
    frequence: 'yearly',
    titre: `Contacter l’association${SUFFIXE}`,
    description:
      'Une question, une envie d’aider, un projet à proposer ? Écrivez à HOPE, association à Madagascar : une personne de l’équipe vous répond.',
  },
  {
    chemin: '/confidentialite',
    priorite: '0.3',
    frequence: 'yearly',
    titre: `Politique de confidentialité${SUFFIXE}`,
    description: 'Ce que HOPE fait de vos données, pourquoi, et comment garder la main dessus.',
  },
  {
    chemin: '/conditions-utilisation',
    priorite: '0.3',
    frequence: 'yearly',
    titre: `Conditions générales d’utilisation${SUFFIXE}`,
    description: 'Les règles communes aux donateurs, bénévoles et bailleurs de la plateforme HOPE.',
  },
];

export const ESPACES_FERMES = [
  { chemin: '/admin', titre: `Administration${SUFFIXE}` },
  { chemin: '/donateur', titre: `Espace donateur${SUFFIXE}` },
  { chemin: '/benevole', titre: `Espace bénévole${SUFFIXE}` },
  { chemin: '/bailleur', titre: `Espace bailleur${SUFFIXE}` },
  { chemin: '/espaces', titre: `Choisir son espace${SUFFIXE}` },
  { chemin: '/authentification', titre: `Connexion${SUFFIXE}` },
];

const PAGES_HORS_INDEX = [
  ...ESPACES_FERMES,
  { chemin: '/faire-un-don', titre: `Paiement de votre don${SUFFIXE}` },
  { chemin: '/mot-de-passe-oublie', titre: `Mot de passe oublié${SUFFIXE}` },
  { chemin: '/reinitialiser-mot-de-passe', titre: `Nouveau mot de passe${SUFFIXE}` },
  { chemin: '/verifier-courriel', titre: `Confirmation de votre adresse${SUFFIXE}` },
];

const FICHES = [
  { genre: 'projet', liste: '/nos-projets' },
  { genre: 'actualite', liste: '/actualites' },
];

const ANCIENNES_ADRESSES = [{ de: '/nos-realisations', vers: '/nos-projets' }];

export const PAGE_INTROUVABLE = { genre: 'inconnue', titre: `Page introuvable${SUFFIXE}`, indexable: false };

function sous(chemin, prefixe) {
  return chemin === prefixe || chemin.startsWith(`${prefixe}/`);
}

function normaliser(chemin) {
  const propre = String(chemin ?? '').split(/[?#]/)[0].toLowerCase().replace(/\/+$/, '');
  return propre === '' ? '/' : propre;
}

export function estEspaceFerme(chemin) {
  const propre = normaliser(chemin);
  return ESPACES_FERMES.some((espace) => sous(propre, espace.chemin));
}

export function decrirePage(chemin) {
  const propre = normaliser(chemin);

  const publique = PAGES_PUBLIQUES.find((page) => page.chemin === propre);
  if (publique) return { ...publique, genre: 'publique', indexable: true };

  for (const fiche of FICHES) {
    const id = propre.startsWith(`${fiche.liste}/`) ? propre.slice(fiche.liste.length + 1) : '';
    if (id && !id.includes('/')) {
      const liste = PAGES_PUBLIQUES.find((page) => page.chemin === fiche.liste);
      return { genre: fiche.genre, chemin: propre, id, titre: liste.titre, indexable: false };
    }
  }

  const ancienne = ANCIENNES_ADRESSES.find((adresse) => sous(propre, adresse.de));
  if (ancienne) return { genre: 'redirection', vers: `${ancienne.vers}${propre.slice(ancienne.de.length)}` };

  const horsIndex = PAGES_HORS_INDEX.find((page) => sous(propre, page.chemin));
  if (horsIndex) return { genre: 'privee', chemin: propre, titre: horsIndex.titre, indexable: false };

  return PAGE_INTROUVABLE;
}

function resume(texte) {
  const propre = String(texte ?? '').replace(/\s+/g, ' ').trim();
  if (propre.length <= LONGUEUR_DESCRIPTION) return propre;
  return `${propre.slice(0, LONGUEUR_DESCRIPTION - 1).replace(/\s+\S*$/, '')}…`;
}

export function ficheDuProjet(projet) {
  const lieu = projet.location ? ` à ${projet.location}` : '';
  return {
    titre: `${projet.name}${SUFFIXE}`,
    description: resume(projet.description || projet.descriptionTitre || `Un projet de HOPE${lieu}.`),
  };
}

export function ficheDeLActualite(actualite) {
  return {
    titre: `${actualite.titre}${SUFFIXE}`,
    description: resume(actualite.corps || actualite.titre),
  };
}
