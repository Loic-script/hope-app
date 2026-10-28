/** Navigation principale du site. */
export interface NavItem {
  label: string;
  to: string;
}

export const MAIN_NAV: NavItem[] = [
  { label: 'Accueil', to: '/' },
  { label: 'Nos activites', to: '/activities' },
  { label: 'Nos projets', to: '/projects' },
  { label: 'Nos impacts', to: '/impact' },
  { label: 'Transparence', to: '/transparency' },
  { label: 'A propos', to: '/about' },
  { label: 'Contact', to: '/contact' },
];

export const FOOTER_NAV: { title: string; items: NavItem[] }[] = [
  {
    title: 'Decouvrir',
    items: [
      { label: 'Nos activites', to: '/activities' },
      { label: 'Nos projets', to: '/projects' },
      { label: 'Nos impacts', to: '/impact' },
    ],
  },
  {
    title: 'S’engager',
    items: [
      { label: 'Faire un don', to: '/donate' },
      { label: 'Devenir partenaire', to: '/partner' },
      { label: 'Nous contacter', to: '/contact' },
    ],
  },
  {
    title: 'Comprendre',
    items: [
      { label: 'Transparence', to: '/transparency' },
      { label: 'A propos de HOPE', to: '/about' },
    ],
  },
];
