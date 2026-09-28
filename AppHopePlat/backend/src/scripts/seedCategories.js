/**
 * Installation des categories de projet.
 *
 *   npm run db:categories
 *
 * Ce sont des donnees de reference, pas des exemples : elles alimentent le
 * formulaire de creation de projet et les statistiques par categorie.
 * L'administrateur peut les completer ou en ajouter depuis l'ecran
 * Parametres.
 *
 * Le script est idempotent : une categorie deja presente n'est pas dupliquee.
 */
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
