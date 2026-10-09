export const PAGES_PUBLIQUES = [
  { chemin: '/', priorite: '1.0', frequence: 'weekly' },
  { chemin: '/nous-decouvrir', priorite: '0.8', frequence: 'monthly' },
  { chemin: '/nos-projets', priorite: '0.8', frequence: 'weekly' },
  { chemin: '/actualites', priorite: '0.8', frequence: 'weekly' },
  { chemin: '/s-engager', priorite: '0.7', frequence: 'monthly' },
  { chemin: '/contact', priorite: '0.6', frequence: 'yearly' },
  { chemin: '/confidentialite', priorite: '0.3', frequence: 'yearly' },
  { chemin: '/conditions-utilisation', priorite: '0.3', frequence: 'yearly' },
];

const FERMES = ['/api/', '/media/', '/admin', '/donateur', '/benevole', '/bailleur', '/espaces', '/authentification'];

function base(siteUrl) {
  return String(siteUrl ?? '').replace(/\/+$/, '');
}

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

export function pagesDesProjets(projets = []) {
  return projets.map((projet) => ({
    chemin: `/nos-projets/${projet.id}`,
    priorite: '0.6',
    frequence: 'monthly',
    modifie: projet.updatedAt ? String(projet.updatedAt).slice(0, 10) : undefined,
  }));
}

export function pagesDesActualites(actualites = []) {
  return actualites.map((actualite) => ({
    chemin: `/actualites/${actualite.id}`,
    priorite: '0.6',
    frequence: 'monthly',
    modifie: actualite.publieLe ? String(actualite.publieLe).slice(0, 10) : undefined,
  }));
}

export function sitemapXml(siteUrl, pagesEnPlus = []) {
  const racine = base(siteUrl);
  const entrees = [...PAGES_PUBLIQUES, ...pagesEnPlus].map(
    (page) =>
      `  <url>\n    <loc>${racine}${page.chemin}</loc>\n` +
      (page.modifie ? `    <lastmod>${page.modifie}</lastmod>\n` : '') +
      `    <changefreq>${page.frequence}</changefreq>\n    <priority>${page.priorite}</priority>\n  </url>`
  );
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    `${entrees.join('\n')}\n` +
    '</urlset>\n'
  );
}
