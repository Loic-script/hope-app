/**
 * Le referencement du site vitrine : robots.txt et sitemap.xml.
 *
 * Les moteurs de recherche ne doivent lire que les pages publiques : le
 * site vitrine et les textes legaux. Les espaces (administration,
 * donateur, benevole, bailleur) et l'API leur sont fermes.
 *
 * Les adresses du plan du site doivent etre absolues : elles partent de
 * HOPE_SITE_URL, l'adresse publique du site.
 */

/** Les pages publiques, dans l'ordre d'importance. */
export const PAGES_PUBLIQUES = [
  { chemin: '/', priorite: '1.0', frequence: 'weekly' },
  { chemin: '/nous-decouvrir', priorite: '0.8', frequence: 'monthly' },
  { chemin: '/nos-realisations', priorite: '0.8', frequence: 'weekly' },
  { chemin: '/actualites', priorite: '0.8', frequence: 'weekly' },
  { chemin: '/s-engager', priorite: '0.7', frequence: 'monthly' },
  { chemin: '/contact', priorite: '0.6', frequence: 'yearly' },
  { chemin: '/confidentialite', priorite: '0.3', frequence: 'yearly' },
  { chemin: '/conditions-utilisation', priorite: '0.3', frequence: 'yearly' },
];

/** Ce qui n'a rien a faire dans un moteur de recherche. */
const FERMES = ['/api/', '/media/', '/admin', '/donateur', '/benevole', '/bailleur', '/espaces', '/authentification'];

/** L'adresse du site, sans barre finale. */
function base(siteUrl) {
  return String(siteUrl ?? '').replace(/\/+$/, '');
}

/** robots.txt : les pages publiques ouvertes, les espaces fermes, le plan du site. */
export function robotsTxt(siteUrl) {
  return [
    'User-agent: *',
    'Allow: /',
    ...FERMES.map((chemin) => `Disallow: ${chemin}`),
    '',
    `Sitemap: ${base(siteUrl)}/sitemap.xml`,
    '',
  ].join('\n');
}

/** sitemap.xml : les pages publiques, en adresses absolues. */
export function sitemapXml(siteUrl) {
  const racine = base(siteUrl);
  const entrees = PAGES_PUBLIQUES.map(
    (page) =>
      `  <url>\n    <loc>${racine}${page.chemin}</loc>\n` +
      `    <changefreq>${page.frequence}</changefreq>\n    <priority>${page.priorite}</priority>\n  </url>`
  );
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    `${entrees.join('\n')}\n` +
    '</urlset>\n'
  );
}
