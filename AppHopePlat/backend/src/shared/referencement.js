import { DESCRIPTION_DE_PARTAGE, ESPACES_FERMES, NOM_DU_SITE, PAGES_PUBLIQUES } from './pagesDuSite.js';

export { PAGES_PUBLIQUES };

export const IMAGE_DE_PARTAGE = { chemin: '/partage.png', largeur: 1200, hauteur: 630 };
export const LOGO = '/logo.png';

const FERMES = ['/api/', '/media/', ...ESPACES_FERMES.map((espace) => espace.chemin)];

const BALISE = /\s*<(?:meta|link)\b(?:[^>"']|"[^"]*"|'[^']*')*>/gi;
const DE_PAGE = /\s(?:name="(?:description|robots)"|property="og:(?:title|description|url|image[^"]*)"|rel="canonical")/i;
const TITRE = /<title>[\s\S]*?<\/title>/i;
const DONNEES_STRUCTUREES = /(<script\b[^>]*\btype="application\/ld\+json"[^>]*>)([\s\S]*?)(<\/script>)/i;

function base(siteUrl) {
  return String(siteUrl ?? '').replace(/\/+$/, '');
}

export function echapper(texte) {
  return String(texte ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
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

export function balisesDeLaPage(siteUrl, page) {
  const racine = base(siteUrl);
  const balises = [`<title>${echapper(page.titre)}</title>`];
  if (page.indexable) {
    balises.push(
      `<meta name="description" content="${echapper(page.description)}" />`,
      `<link rel="canonical" href="${echapper(racine + page.chemin)}" />`,
      `<meta property="og:url" content="${echapper(racine + page.chemin)}" />`
    );
  } else {
    balises.push('<meta name="robots" content="noindex" />');
  }
  balises.push(
    `<meta property="og:title" content="${echapper(page.titre)}" />`,
    `<meta property="og:description" content="${echapper(page.descriptionDePartage ?? page.description ?? DESCRIPTION_DE_PARTAGE)}" />`,
    `<meta property="og:image" content="${echapper(racine + IMAGE_DE_PARTAGE.chemin)}" />`,
    `<meta property="og:image:width" content="${IMAGE_DE_PARTAGE.largeur}" />`,
    `<meta property="og:image:height" content="${IMAGE_DE_PARTAGE.hauteur}" />`,
    `<meta property="og:image:alt" content="${echapper(NOM_DU_SITE)}" />`
  );
  return balises.join('\n    ');
}

function completerDonnees(json, racine) {
  let donnees;
  try {
    donnees = JSON.parse(json, (cle, valeur) =>
      cle === '@id' && typeof valeur === 'string' && valeur.startsWith('#') ? `${racine}/${valeur}` : valeur
    );
  } catch {
    return json;
  }
  for (const noeud of donnees['@graph'] ?? [donnees]) {
    if (noeud['@type'] === 'NGO') Object.assign(noeud, { url: `${racine}/`, logo: `${racine}${LOGO}` });
    if (noeud['@type'] === 'WebSite') noeud.url = `${racine}/`;
  }
  return JSON.stringify(donnees).replace(/</g, '\\u003c');
}

export function preparerCoquille(gabarit, siteUrl) {
  const racine = base(siteUrl);
  if (!TITRE.test(gabarit)) return () => gabarit;

  let html = gabarit.replace(BALISE, (balise) => (DE_PAGE.test(balise) ? '' : balise));
  html = html.replace(
    DONNEES_STRUCTUREES,
    (_tout, ouverture, json, fermeture) => `${ouverture}${completerDonnees(json, racine)}${fermeture}`
  );
  const titre = html.match(TITRE);
  const avant = html.slice(0, titre.index);
  const apres = html.slice(titre.index + titre[0].length);

  return (page) => `${avant}${balisesDeLaPage(racine, page)}${apres}`;
}
