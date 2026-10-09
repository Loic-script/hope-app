import * as adminRepository from '../repositories/admin.repository.js';
import { hasherMotDePasse } from '../services/adminAuth.service.js';
import { config } from '../config/env.js';
import { fermerPool } from '../config/database.js';
import { poserMedia } from './mediasDemo.js';

const FORCER = process.argv.includes('--force');

async function poserAvatar(admin) {
  if (admin.photoUrl) return;

  const { mediaUrl } = await poserMedia('equipe-hope.png', 'avatar');
  await adminRepository.mettreAJourPhoto(admin.id, mediaUrl);
  console.log(`[HOPE] Avatar de l'equipe pose sur "${admin.adminLog}".`);
}

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
    console.log(`[HOPE] L'administrateur "${login}" existe deja (id ${existant.id}).`);
    console.log('[HOPE] Utilisez "npm run db:seed -- --force" pour reinitialiser son mot de passe.');
    await poserAvatar(existant);
    return;
  }

  const hash = await hasherMotDePasse(motDePasse);

  if (existant) {
    await adminRepository.mettreAJourMotDePasse(existant.id, hash);
    console.log(`[HOPE] Mot de passe de "${login}" reinitialise (id ${existant.id}).`);
    await poserAvatar(existant);
  } else {
    const cree = await adminRepository.creer({
      adminLog: login,
      passwordHash: hash,
      fullName: login,
      role: 'ADMIN',
    });
    console.log(`[HOPE] Administrateur "${login}" cree (id ${cree.id}).`);
    await poserAvatar(cree);
  }

  console.log(`[HOPE] Hash bcrypt enregistre (cout ${config.admin.saltRounds}), mot de passe jamais stocke en clair.`);
}

executer()
  .catch((erreur) => {
    console.error('[HOPE] Echec du seed :', erreur.message);
    process.exitCode = 1;
  })
  .finally(() => fermerPool());
