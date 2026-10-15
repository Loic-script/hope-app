import { expect, test } from '@playwright/test';

import { adresseUnique, courrielsPour, donateurPret } from './outils.js';

test('un donateur inscrit recoit le lien de confirmation, puis l accuse de son don sans avoir confirme son adresse', async ({ request }, testInfo) => {
  const email = adresseUnique(testInfo, 'courriels');
  const token = await donateurPret(request, email, 'courriels-2026');
  await expect.poll(() => courrielsPour(email).some((b) => b.includes('verifier-courriel?jeton='))).toBe(true);

  const reponse = await request.post('/api/donateur/dons', {
    headers: { Authorization: `Bearer ${token}` },
    data: { affectation: 'HOPE', montant: '25000', devise: 'MGA', mode: 'virement_bancaire', frequence: 'ONE_TIME' },
  });
  expect(reponse.status(), await reponse.text()).toBe(201);
  const { don } = await reponse.json();

  await expect.poll(() => courrielsPour(email).some((b) => b.includes(`votre promesse de don ${don.reference}`))).toBe(true);
  const accuse = courrielsPour(email).find((b) => b.includes(`votre promesse de don ${don.reference}`));
  expect(accuse).toContain('/authentification');
  expect(accuse).not.toContain('/donateur/dons');
});
