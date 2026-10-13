import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defautAdresseDuSite } from '../src/config/env.js';

const BACKEND = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function demarrer(env) {
  return spawnSync(
    process.execPath,
    ['--input-type=module', '-e', "const { config } = await import('./src/config/env.js'); console.log(config.siteUrl);"],
    {
      cwd: BACKEND,
      encoding: 'utf8',
      env: {
        PATH: process.env.PATH,
        JWT_SECRET: 'a1b2c3d4e5f6'.repeat(6),
        DATABASE_URL: 'postgres://hope:hope@localhost:5432/hope',
        HOPE_SITE_URL: '',
        ...env,
      },
    }
  );
}

test('defautAdresseDuSite : une adresse publique en https, rien d autre', () => {
  assert.equal(defautAdresseDuSite('https://hope.example'), null);
  assert.equal(defautAdresseDuSite('https://www.hope.example/'), null);
  assert.match(defautAdresseDuSite(''), /absente/);
  assert.match(defautAdresseDuSite(undefined), /absente/);
  assert.match(defautAdresseDuSite('hope.example'), /adresse complete/);
  assert.match(defautAdresseDuSite('http://hope.example'), /https/);
  assert.match(defautAdresseDuSite('http://localhost:5173'), /https/);
  assert.match(defautAdresseDuSite('https://localhost:3000'), /ce poste/);
  assert.match(defautAdresseDuSite('https://127.0.0.1'), /ce poste/);
});

test('en production, le serveur refuse de demarrer sans HOPE_SITE_URL, et dit pourquoi', () => {
  for (const valeur of ['', 'http://localhost:5173', 'hope.example']) {
    const essai = demarrer({ NODE_ENV: 'production', HOPE_SITE_URL: valeur });
    assert.equal(essai.status, 1, `HOPE_SITE_URL="${valeur}"`);
    assert.match(essai.stderr, /HOPE_SITE_URL ne convient pas a la production/);
    assert.equal(essai.stdout, '');
  }
  assert.match(demarrer({ NODE_ENV: 'production' }).stderr, /elle est absente/);
});

test('en production, une adresse en https est acceptee telle quelle', () => {
  const essai = demarrer({ NODE_ENV: 'production', HOPE_SITE_URL: 'https://hope.example' });
  assert.equal(essai.status, 0, essai.stderr);
  assert.equal(essai.stdout.trim(), 'https://hope.example');
});

test('hors production, rien n est exige : le poste local sert de valeur par defaut', () => {
  for (const mode of ['development', 'test']) {
    const essai = demarrer({ NODE_ENV: mode });
    assert.equal(essai.status, 0, essai.stderr);
    assert.equal(essai.stdout.trim(), 'http://localhost:5173');
  }
  assert.equal(demarrer({ NODE_ENV: 'test', HOPE_SITE_URL: 'http://localhost:3100' }).stdout.trim(), 'http://localhost:3100');
});
