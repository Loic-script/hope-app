import { fermerPool } from '../config/database.js';
import * as catalogService from '../services/catalog.service.js';

async function executer() {
  const categories = await catalogService.installerCategoriesParDefaut();

  console.log(`[HOPE] ${categories.length} categorie(s) de projet disponible(s) :`);
  for (const categorie of categories) {
    console.log(`       - ${categorie.name}`);
  }
}

executer()
  .catch((erreur) => {
    console.error('[HOPE] Echec de l installation des categories :', erreur.message);
    process.exitCode = 1;
  })
  .finally(() => fermerPool());
