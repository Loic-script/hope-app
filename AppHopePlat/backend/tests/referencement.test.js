/*
 * Le referencement : les moteurs lisent les pages publiques, jamais les
 * espaces ; le plan du site donne des adresses absolues.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { PAGES_PUBLIQUES, robotsTxt, sitemapXml } from '../src/shared/referencement.js';

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
