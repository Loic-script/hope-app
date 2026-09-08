/**
 * Creation de l'administrateur HOPE par defaut.
 *
 *   npm run db:seed
 *
 * Le mot de passe lu dans .env (ADMIN_PASSWORD) n'est jamais ecrit tel quel en
 * base : seul son hash bcrypt est enregistre dans password_hash.
 *
 * Le script verifie d'abord si l'identifiant existe deja, afin d'eviter les
 * doublons quand on le relance. Passer --force pour reinitialiser le mot de
 * passe d'un compte existant.
 */
import * as adminRepository from '../repositories/admin.repository.js';
import { hasherMotDePasse } from '../services/adminAuth.service.js';
import { config } from '../config/env.js';
import { fermerPool } from '../config/database.js';

const FORCER = process.argv.includes('--force');

async function executer() {
  const login = config.admin.log;
  const motDePasse = config.admin.password;

  if (!login || !motDePasse) {
    throw new Error(
      'ADMIN_LOG et ADMIN_PASSWORD doivent etre renseignes dans backend/.env pour executer le seed.'
    );
  }

  const existant = await adminRepository.trouverParLogin(login);

  if (existant && !FORCER) {
    console.log(`[HOPE] L'administrateur "${login}" existe deja (id ${existant.id}) : rien a faire.`);
    console.log('[HOPE] Utilisez "npm run db:seed -- --force" pour reinitialiser son mot de passe.');
    return;
  }

  // Le hash est calcule ici, jamais le mot de passe en clair vers la base.
  const hash = await hasherMotDePasse(motDePasse);

  if (existant) {
    await adminRepository.mettreAJourMotDePasse(existant.id, hash);
    console.log(`[HOPE] Mot de passe de "${login}" reinitialise (id ${existant.id}).`);
  } else {
    const cree = await adminRepository.creer({
      adminLog: login,
      passwordHash: hash,
      fullName: login,
      role: 'ADMIN',
    });
    console.log(`[HOPE] Administrateur "${login}" cree (id ${cree.id}).`);
  }

  console.log(`[HOPE] Hash bcrypt enregistre (cout ${config.admin.saltRounds}), mot de passe jamais stocke en clair.`);
}

executer()
  .catch((erreur) => {
    console.error('[HOPE] Echec du seed :', erreur.message);
    process.exitCode = 1;
  })
  .finally(() => fermerPool());
