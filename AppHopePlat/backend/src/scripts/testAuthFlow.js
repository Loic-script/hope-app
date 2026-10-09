import { config } from '../config/env.js';

const BASE = `http://localhost:${config.port}/api`;
const LOGIN = config.admin.log;
const MOT_DE_PASSE = config.admin.password;

let reussis = 0;
let echoues = 0;

function verifier(libelle, condition, detail = '') {
  if (condition) {
    reussis += 1;
    console.log(`  OK   ${libelle}`);
  } else {
    echoues += 1;
    console.log(`  ECHEC ${libelle}${detail ? ` -> ${detail}` : ''}`);
  }
}

async function appeler(chemin, options = {}) {
  const reponse = await fetch(`${BASE}${chemin}`, options);
  let corps = null;
  try {
    corps = await reponse.json();
  } catch {
    corps = null;
  }
  return { statut: reponse.status, corps };
}

function postJson(donnees, jeton) {
  return {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(jeton ? { Authorization: `Bearer ${jeton}` } : {}),
    },
    body: JSON.stringify(donnees),
  };
}

async function executer() {
  console.log(`\n[HOPE] Tests du parcours d'authentification sur ${BASE}\n`);

  const sante = await appeler('/health');
  verifier('GET /api/health repond 200', sante.statut === 200, `statut ${sante.statut}`);

  console.log('\nCAS 1 : AdminHope + bon mot de passe');
  const bon = await appeler('/admin/login', postJson({ adminLog: LOGIN, password: MOT_DE_PASSE }));
  verifier('statut 200', bon.statut === 200, `statut ${bon.statut}`);
  verifier('success = true', bon.corps?.success === true);
  verifier('un jeton JWT est renvoye', typeof bon.corps?.token === 'string' && bon.corps.token.split('.').length === 3);
  verifier('admin.adminLog = ' + LOGIN, bon.corps?.admin?.adminLog === LOGIN);
  verifier(
    'la reponse ne contient jamais password_hash',
    !JSON.stringify(bon.corps ?? {}).toLowerCase().includes('password_hash')
  );

  const jeton = bon.corps?.token;

  console.log('\nCAS 2 : AdminHope + mauvais mot de passe');
  const mauvais = await appeler('/admin/login', postJson({ adminLog: LOGIN, password: 'mauvaismotdepasse' }));
  verifier('statut 401', mauvais.statut === 401, `statut ${mauvais.statut}`);
  verifier('message generique "Identifiants incorrects"', mauvais.corps?.message === 'Identifiants incorrects');

  console.log('\nCAS 3 : login inconnu');
  const inconnu = await appeler('/admin/login', postJson({ adminLog: 'FantomeHope', password: MOT_DE_PASSE }));
  verifier('statut 401', inconnu.statut === 401, `statut ${inconnu.statut}`);
  verifier(
    'meme message que le CAS 2 (aucune fuite sur l\'existence du compte)',
    inconnu.corps?.message === mauvais.corps?.message
  );

  console.log('\nCAS 3 bis : champs manquants');
  const vide = await appeler('/admin/login', postJson({ adminLog: '', password: '' }));
  verifier('statut 400', vide.statut === 400, `statut ${vide.statut}`);

  console.log('\nCAS 4 : GET /api/admin/me sans jeton');
  const sansJeton = await appeler('/admin/me');
  verifier('statut 401', sansJeton.statut === 401, `statut ${sansJeton.statut}`);

  console.log('\nCAS 5 : GET /api/admin/me avec un jeton valide');
  const avecJeton = await appeler('/admin/me', { headers: { Authorization: `Bearer ${jeton}` } });
  verifier('statut 200', avecJeton.statut === 200, `statut ${avecJeton.statut}`);
  verifier('authenticated = true', avecJeton.corps?.authenticated === true);
  verifier('admin.adminLog = ' + LOGIN, avecJeton.corps?.admin?.adminLog === LOGIN);

  console.log('\nCAS 6 : GET /api/admin/me avec un jeton altere');
  const altere = await appeler('/admin/me', { headers: { Authorization: `Bearer ${jeton}modifie` } });
  verifier('statut 401', altere.statut === 401, `statut ${altere.statut}`);

  console.log('\nCAS 7 : POST /api/admin/logout');
  const deconnexion = await appeler('/admin/logout', postJson({}, jeton));
  verifier('statut 200', deconnexion.statut === 200, `statut ${deconnexion.statut}`);

  console.log(`\n[HOPE] Resultat : ${reussis} test(s) reussi(s), ${echoues} echec(s).\n`);
  process.exit(echoues === 0 ? 0 : 1);
}

executer().catch((erreur) => {
  console.error(
    `\n[HOPE] Impossible de joindre l'API sur ${BASE} : ${erreur.message}\n` +
      '       Demarrez le backend avec "npm run dev" avant de lancer ces tests.\n'
  );
  process.exit(1);
});
