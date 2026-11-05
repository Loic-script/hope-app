import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

import {
  IMAGE_DE_PARTAGE,
  LOGO,
  PAGES_PUBLIQUES,
  pagesDesActualites,
  pagesDesProjets,
  preparerCoquille,
  robotsTxt,
  sitemapXml,
} from '../src/shared/referencement.js';
import {
  ESPACES_FERMES,
  PAGE_INTROUVABLE,
  decrirePage,
  estEspaceFerme,
  ficheDeLActualite,
  ficheDuProjet,
} from '../src/shared/pagesDuSite.js';

const FRONTEND = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'frontend');
const GABARIT = fs.readFileSync(path.join(FRONTEND, 'index.html'), 'utf8');
const SITE = 'https://hope.example';

function compter(html, motif) {
  return [...html.matchAll(motif)].length;
}

function contenu(html, attribut, nom) {
  const balise = html.match(new RegExp(`<meta[^>]*${attribut}="${nom}"[^>]*>`))?.[0] ?? '';
  return balise.match(/content="([^"]*)"/)?.[1] ?? null;
}

test('robots.txt ferme les espaces et l API, et donne le plan du site', () => {
  const texte = robotsTxt('https://hope.example/');
  for (const chemin of ['/api/', '/media/', ...ESPACES_FERMES.map((espace) => espace.chemin)]) {
    assert.match(texte, new RegExp(`^Disallow: ${chemin}$`, 'm'));
  }
  assert.match(texte, /^Allow: \/$/m);
  assert.match(texte, /^Sitemap: https:\/\/hope\.example\/sitemap\.xml$/m);
});

test('sitemap.xml liste les pages publiques en adresses absolues', () => {
  const xml = sitemapXml('https://hope.example');
  assert.match(xml, /^<\?xml version="1.0" encoding="UTF-8"\?>/);
  const adresses = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  assert.equal(adresses.length, PAGES_PUBLIQUES.length);
  assert.ok(adresses.every((a) => a.startsWith('https://hope.example/')));
  assert.ok(adresses.includes('https://hope.example/'));
  assert.ok(!adresses.some((a) => /\/(admin|donateur|benevole|bailleur)/.test(a)));
});

test('le plan du site ajoute la fiche de chaque projet, datee de sa mise a jour', () => {
  const xml = sitemapXml(
    'https://hope.example',
    pagesDesProjets([{ id: 7, updatedAt: '2026-09-01T10:00:00.000Z' }, { id: 9 }])
  );
  assert.match(xml, /<loc>https:\/\/hope\.example\/nos-projets\/7<\/loc>\s*<lastmod>2026-09-01<\/lastmod>/);
  assert.match(xml, /<loc>https:\/\/hope\.example\/nos-projets\/9<\/loc>\s*<changefreq>monthly/);
  assert.equal([...xml.matchAll(/<loc>/g)].length, PAGES_PUBLIQUES.length + 2);
});

test('le plan du site ajoute chaque actualite, datee de sa publication', () => {
  const xml = sitemapXml(
    'https://hope.example',
    pagesDesActualites([{ id: '0d7e2a2e-7d3f-4a6f-9c1b-2f8a3e5b1c11', publieLe: '2026-09-20T08:00:00.000Z' }])
  );
  assert.match(xml, /<loc>https:\/\/hope\.example\/actualites\/0d7e2a2e-7d3f-4a6f-9c1b-2f8a3e5b1c11<\/loc>\s*<lastmod>2026-09-20<\/lastmod>/);
});

test('chaque page publique a son titre et sa description, a la bonne longueur', () => {
  for (const page of PAGES_PUBLIQUES) {
    assert.ok(page.titre.length >= 15 && page.titre.length <= 60, `titre de ${page.chemin} : ${page.titre.length}`);
    assert.ok(
      page.description.length >= 50 && page.description.length <= 160,
      `description de ${page.chemin} : ${page.description.length}`
    );
  }
  assert.equal(new Set(PAGES_PUBLIQUES.map((page) => page.titre)).size, PAGES_PUBLIQUES.length);
  assert.equal(new Set(PAGES_PUBLIQUES.map((page) => page.description)).size, PAGES_PUBLIQUES.length);
});

test('decrirePage reconnait les pages publiques, les fiches, les espaces fermes et les anciennes adresses', () => {
  assert.equal(decrirePage('/').genre, 'publique');
  assert.equal(decrirePage('/Nos-Projets/?page=2').chemin, '/nos-projets');
  assert.deepEqual(
    [decrirePage('/nos-projets/12').genre, decrirePage('/nos-projets/12').id],
    ['projet', '12']
  );
  assert.equal(decrirePage('/actualites/0d7e2a2e-7d3f-4a6f-9c1b-2f8a3e5b1c11').genre, 'actualite');
  assert.equal(decrirePage('/nos-projets/12/photos').genre, 'inconnue');

  for (const chemin of ['/admin', '/admin/projects/3', '/donateur/payer/carte', '/authentification', '/espaces']) {
    assert.equal(decrirePage(chemin).indexable, false, chemin);
    assert.equal(decrirePage(chemin).genre, 'privee', chemin);
    assert.equal(estEspaceFerme(chemin), true, chemin);
  }
  assert.equal(decrirePage('/faire-un-don').indexable, true);
  assert.equal(decrirePage('/faire-un-don/carte').indexable, false);
  assert.equal(estEspaceFerme('/faire-un-don/carte'), false);
  assert.equal(decrirePage('/reinitialiser-mot-de-passe').genre, 'privee');

  assert.deepEqual(decrirePage('/nos-realisations/7'), { genre: 'redirection', vers: '/nos-projets/7' });
  assert.deepEqual(decrirePage('/nos-realisations'), { genre: 'redirection', vers: '/nos-projets' });

  for (const chemin of ['/nulle-part', '/favicon.ico', '/sitemap_index.xml', '/donateurs', '/administration']) {
    assert.equal(decrirePage(chemin), PAGE_INTROUVABLE, chemin);
  }
});

test('les fiches : le titre porte le nom, la description est un resume sans retour a la ligne', () => {
  const projet = ficheDuProjet({ name: 'Cantine de Betafo', description: `Un repas\n\n chaque midi. ${'x '.repeat(200)}` });
  assert.equal(projet.titre, 'Cantine de Betafo — HOPE');
  assert.ok(projet.description.startsWith('Un repas chaque midi. x'));
  assert.ok(projet.description.length <= 160 && projet.description.endsWith('…'));
  assert.equal(ficheDuProjet({ name: 'Puits', location: 'Sakaraha' }).description, 'Un projet de HOPE à Sakaraha.');
  assert.equal(ficheDuProjet({ name: 'Puits', descriptionTitre: 'De l’eau pour tous' }).description, 'De l’eau pour tous');

  assert.deepEqual(ficheDeLActualite({ titre: 'Rentrée', corps: 'Les cartables sont prêts.' }), {
    titre: 'Rentrée — HOPE',
    description: 'Les cartables sont prêts.',
  });
  assert.equal(ficheDeLActualite({ titre: 'Rentrée', corps: null }).description, 'Rentrée');
});

test('la coquille d une page publique : ses propres balises, une seule fois, en adresses absolues', () => {
  const rendre = preparerCoquille(GABARIT, `${SITE}/`);
  const accueil = rendre(decrirePage('/'));
  const projets = rendre(decrirePage('/nos-projets'));

  for (const html of [accueil, projets]) {
    assert.equal(compter(html, /<title>/g), 1);
    assert.equal(compter(html, /name="description"/g), 1);
    assert.equal(compter(html, /rel="canonical"/g), 1);
    for (const propriete of ['og:title', 'og:description', 'og:url', 'og:image', 'og:type', 'og:locale', 'og:site_name']) {
      assert.equal(compter(html, new RegExp(`property="${propriete}"`, 'g')), 1, propriete);
    }
    assert.equal(contenu(html, 'name', 'twitter:card'), 'summary_large_image');
    assert.equal(contenu(html, 'property', 'og:image'), `${SITE}${IMAGE_DE_PARTAGE.chemin}`);
    assert.match(html, /<link rel="apple-touch-icon" href="\/apple-touch-icon\.png" \/>/);
    assert.doesNotMatch(html, /name="robots"/);
    assert.match(html, /<div id="root"><\/div>/);
  }

  assert.match(projets, /<title>Nos projets à Madagascar — HOPE<\/title>/);
  assert.match(projets, new RegExp(`<link rel="canonical" href="${SITE}/nos-projets" />`));
  assert.equal(contenu(projets, 'property', 'og:url'), `${SITE}/nos-projets`);
  assert.equal(contenu(projets, 'property', 'og:title'), 'Nos projets à Madagascar — HOPE');
  assert.match(accueil, new RegExp(`<link rel="canonical" href="${SITE}/" />`));
  assert.notEqual(contenu(accueil, 'name', 'description'), contenu(projets, 'name', 'description'));
});

test('sans le serveur, index.html porte deja le titre et les descriptions de l accueil', () => {
  const accueil = decrirePage('/');
  assert.equal(GABARIT.match(/<title>([^<]*)<\/title>/)[1], accueil.titre);
  assert.equal(contenu(GABARIT, 'name', 'description'), accueil.description);
  assert.equal(contenu(GABARIT, 'property', 'og:title'), accueil.titre);
  assert.equal(contenu(GABARIT, 'property', 'og:description'), accueil.descriptionDePartage);
  assert.equal(contenu(preparerCoquille(GABARIT, SITE)(accueil), 'property', 'og:description'), accueil.descriptionDePartage);
});

test('un espace ferme et une page introuvable : noindex, sans adresse canonique', () => {
  const rendre = preparerCoquille(GABARIT, SITE);
  for (const page of [decrirePage('/admin/projects'), decrirePage('/donateur'), PAGE_INTROUVABLE]) {
    const html = rendre(page);
    assert.equal(contenu(html, 'name', 'robots'), 'noindex');
    assert.doesNotMatch(html, /rel="canonical"|property="og:url"|name="description"/);
    assert.match(html, new RegExp(`<title>${page.titre}</title>`));
  }
});

test('un texte venu de la base est echappe partout ou il est ecrit', () => {
  const rendre = preparerCoquille(GABARIT, SITE);
  const fiche = ficheDuProjet({
    name: '</title><script>alert(1)</script>',
    description: 'Une "citation" & un <b>gras</b>, l\'apostrophe aussi.',
  });
  const html = rendre({ ...decrirePage('/nos-projets/3'), ...fiche, indexable: true });
  assert.equal(compter(html, /<script>alert/g), 0);
  assert.equal(compter(html, /<title>/g), 1);
  assert.match(html, /<title>&lt;\/title&gt;&lt;script&gt;alert\(1\)&lt;\/script&gt; — HOPE<\/title>/);
  assert.equal(
    contenu(html, 'name', 'description'),
    'Une &quot;citation&quot; &amp; un &lt;b&gt;gras&lt;/b&gt;, l&#39;apostrophe aussi.'
  );
  assert.match(html, new RegExp(`<link rel="canonical" href="${SITE}/nos-projets/3" />`));
});

test('les donnees structurees recoivent l adresse et le logo, sans reseau social invente', () => {
  const html = preparerCoquille(GABARIT, SITE)(decrirePage('/'));
  const donnees = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
  const [association, site] = donnees['@graph'];
  assert.equal(association['@type'], 'NGO');
  assert.equal(association['@id'], `${SITE}/#hope`);
  assert.equal(association.url, `${SITE}/`);
  assert.equal(association.logo, `${SITE}${LOGO}`);
  assert.equal(association.name, 'HOPE – Hope for a Better Life');
  assert.equal('sameAs' in association, false);
  assert.equal(site.url, `${SITE}/`);
  assert.equal(site.publisher['@id'], association['@id']);
});

test('les balises d origine sont retirees entieres, meme quand leur texte contient un chevron', () => {
  const gabarit = [
    '<!doctype html><html><head>',
    '<title>Ancien</title>',
    '<meta name="description" content="a > b" />',
    "<meta property='og:locale' content='fr_FR' />",
    '<meta property="og:title" content="x > y" />',
    '<link rel="canonical" href="https://ailleurs.example/?a=1&gt;2" />',
    '<meta name="twitter:description" content="garde" />',
    '<link rel="icon" href="/favicon.svg" />',
    '</head><body><div id="root"></div></body></html>',
  ].join('\n');
  const html = preparerCoquille(gabarit, SITE)(decrirePage('/contact'));
  assert.doesNotMatch(html, /Ancien|a > b|x > y|ailleurs/);
  assert.equal(compter(html, /rel="canonical"/g), 1);
  assert.match(html, /<meta property='og:locale' content='fr_FR' \/>/);
  assert.match(html, /<meta name="twitter:description" content="garde" \/>/);
  assert.match(html, /<link rel="icon" href="\/favicon\.svg" \/>/);
  assert.match(html, /<title>Contacter l’association — HOPE<\/title>/);
});

test('une coquille sans titre est rendue telle quelle', () => {
  const nue = '<!doctype html><html><head></head><body><div id="root"></div></body></html>';
  assert.equal(preparerCoquille(nue, SITE)(decrirePage('/')), nue);
});

test('l image de partage, le logo et l icone existent, aux dimensions annoncees', async () => {
  const dimensions = async (chemin) => {
    const { width, height, hasAlpha } = await sharp(path.join(FRONTEND, 'public', chemin)).metadata();
    return { width, height, hasAlpha };
  };
  assert.deepEqual(await dimensions(IMAGE_DE_PARTAGE.chemin), {
    width: IMAGE_DE_PARTAGE.largeur,
    height: IMAGE_DE_PARTAGE.hauteur,
    hasAlpha: false,
  });
  assert.deepEqual([IMAGE_DE_PARTAGE.largeur, IMAGE_DE_PARTAGE.hauteur], [1200, 630]);
  assert.deepEqual(await dimensions('/apple-touch-icon.png'), { width: 180, height: 180, hasAlpha: false });
  assert.ok((await dimensions(LOGO)).width >= 112);
});

test('l icone du site est carree, et declaree en ICO et en PNG pour les moteurs de recherche', async () => {
  const dossier = path.join(FRONTEND, 'public');
  const [, , largeur, hauteur] = fs
    .readFileSync(path.join(dossier, 'favicon.svg'), 'utf8')
    .match(/viewBox="([^"]+)"/)[1]
    .split(' ')
    .map(Number);
  assert.equal(largeur, hauteur);

  const png = await sharp(path.join(dossier, 'favicon-96x96.png')).metadata();
  assert.deepEqual([png.format, png.width, png.height], ['png', 96, 96]);
  assert.equal(png.width % 48, 0);

  const ico = fs.readFileSync(path.join(dossier, 'favicon.ico'));
  assert.deepEqual([ico.readUInt16LE(0), ico.readUInt16LE(2)], [0, 1]);
  const tailles = [];
  for (let rang = 0; rang < ico.readUInt16LE(4); rang += 1) {
    const entree = 6 + 16 * rang;
    const image = ico.subarray(ico.readUInt32LE(entree + 12), ico.readUInt32LE(entree + 12) + ico.readUInt32LE(entree + 8));
    const { format, width, height } = await sharp(image).metadata();
    assert.deepEqual([format, width, height], ['png', ico.readUInt8(entree), ico.readUInt8(entree + 1)]);
    tailles.push(width);
  }
  assert.deepEqual(tailles, [16, 32, 48]);

  const html = preparerCoquille(GABARIT, SITE)(decrirePage('/'));
  assert.match(html, /<link rel="icon" href="\/favicon\.ico" sizes="48x48" \/>/);
  assert.match(html, /<link rel="icon" type="image\/png" sizes="96x96" href="\/favicon-96x96\.png" \/>/);
  assert.match(html, /<link rel="icon" type="image\/svg\+xml" href="\/favicon\.svg" \/>/);
});
