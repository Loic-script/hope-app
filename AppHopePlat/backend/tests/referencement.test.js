/*
 * Le referencement : les moteurs lisent les pages publiques, jamais les
 * espaces ; le plan du site donne des adresses absolues.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { PAGES_PUBLIQUES, pagesDesActualites, pagesDesProjets, robotsTxt, sitemapXml } from '../src/shared/referencement.js';

test('robots.txt ferme les espaces et l API, et donne le plan du site', () => {
  const texte = robotsTxt('https://hope.example/');
  for (const chemin of ['/api/', '/admin', '/donateur', '/benevole', '/bailleur']) {
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
