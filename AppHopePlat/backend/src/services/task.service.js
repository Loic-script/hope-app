/**
 * Service des taches.
 *
 * Une tache se confie a une equipe d'un ou plusieurs benevoles. L'equipe
 * HOPE peut y affecter qui elle veut ; un benevole, lui, demande a la
 * prendre ou a la rejoindre, et sa demande attend la decision de HOPE.
 * N'importe quel membre de l'equipe la declare livree, preuve a l'appui,
 * pour tous.
 *
 * Toute decision prend la tache sous verrou : deux gestes simultanes --
 * deux demandes acceptees, un retrait pendant une livraison -- ne doivent
 * pas laisser un statut qui contredit l'equipe. Chacune previent le
 * benevole concerne dans sa cloche.
 */
import { transaction } from '../config/database.js';
import { plafondPreuve } from '../middleware/upload.middleware.js';
import * as espaceRepository from '../repositories/espace.repository.js';
import * as profileRepository from '../repositories/volunteerProfile.repository.js';
import * as taskRepository from '../repositories/task.repository.js';
import { ErreurIntrouvable, ErreurRegleMetier, ErreurValidation } from '../shared/errors.js';

const STATUTS = ['a_faire', 'en_cours', 'livree'];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Un identifiant de tache ou de benevole : 404 s'il est mal forme. */
function uuid(valeur, quoi) {
  const texte = String(valeur ?? '');
  if (!UUID.test(texte)) throw new ErreurIntrouvable(quoi, valeur);
  return texte;
}

/** La tache verrouillee, ou 404. */
async function verrouiller(id, client) {
  const tache = await taskRepository.verrouiller(uuid(id, 'La tâche'), client);
  if (!tache) throw new ErreurIntrouvable('La tâche', id);
  return tache;
}

/** Une tache livree ne change plus d'equipe. */
function exigerNonLivree(tache) {
  if (tache.statut === 'livree') {
    throw new ErreurRegleMetier('Cette tâche est livrée : son équipe ne change plus.', 'TACHE_LIVREE');
  }
}

/** Previent des benevoles, par leur fiche, dans leur cloche. */
async function prevenir(benevoleIds, { titre, corps }, client) {
  const comptes = await taskRepository.comptesDes(benevoleIds, client);
  for (const compte of comptes) {
    await espaceRepository.creerNotification(
      { utilisateurId: compte.utilisateurId, type: 'tache', titre, corps, lien: '/benevole/taches' },
      client
    );
  }
}

/* ================================================================
   Cote administration
   ================================================================ */

/** Les taches d'un projet, pour la fiche projet du back-office. */
export async function listerParProjet(projetId) {
  return taskRepository.lister({ projetId });
}

/**
 * Toutes les taches, pour la page Taches.
 *
 * @param {{ statut?: string, demandes?: string, projetId?: string }} requete
 *   demandes=1 : seulement celles qui ont des demandes a valider.
 */
export async function listerPourAdmin(requete = {}) {
  const statut = requete.statut ? String(requete.statut) : null;
  if (statut && !STATUTS.includes(statut)) {
    throw new ErreurValidation(`Le champ "statut" doit valoir : ${STATUTS.join(', ')}.`, {
      statut: 'Valeur non autorisée',
    });
  }
  const projetId = /^\d{1,9}$/.test(String(requete.projetId ?? '')) ? Number(requete.projetId) : null;

  const [items, counts] = await Promise.all([
    taskRepository.lister({ statut, projetId, avecDemandes: requete.demandes === '1' }),
    taskRepository.compterPourAdmin(),
  ]);
  return { items, counts };
}

/** Une tache, pour sa fenetre : equipe, demandes, preuve. */
export async function recupererPourAdmin(id) {
  const tache = await taskRepository.trouverParId(uuid(id, 'La tâche'));
  if (!tache) throw new ErreurIntrouvable('La tâche', id);
  return tache;
}

/** Les benevoles qu'on peut affecter. */
export async function benevolesAffectables() {
  return { items: await taskRepository.benevolesAffectables() };
}

/**
 * Cree une tache sur un projet.
 *
 * Elle nait sans equipe : visible de tous les benevoles, qui peuvent la
 * demander. L'echeance est facultative, mais si elle est donnee, elle
 * doit etre une date.
 */
export async function creerPourProjet(projetId, corps = {}) {
  const titre = String(corps.titre ?? '').trim();
  const description = String(corps.description ?? '').trim();
  const echeance = String(corps.echeance ?? '').trim();

  const details = {};
  if (titre === '') details.titre = 'Champ obligatoire';
  else if (titre.length > 160) details.titre = '160 caractères au maximum';
  if (echeance !== '' && Number.isNaN(new Date(echeance).getTime())) {
    details.echeance = 'Date invalide';
  }
  if (Object.keys(details).length > 0) {
    throw new ErreurValidation('La tâche est incomplète.', details);
  }

  return taskRepository.creer({
    projetId,
    titre,
    description: description === '' ? null : description,
    echeance: echeance === '' ? null : echeance,
  });
}

/**
 * Retire une tache.
 *
 * Seulement si personne n'y travaille : effacer sous les pieds d'une
 * equipe lui ferait perdre son travail sans un mot. Les demandes en
 * attente, elles, partent avec la tache.
 */
export async function supprimer(id) {
  return transaction(async (client) => {
    const tache = await verrouiller(id, client);
    const detail = await taskRepository.trouverParId(tache.id, client);
    if (detail.equipe.length > 0) {
      throw new ErreurRegleMetier(
        'Des bénévoles travaillent sur cette tâche : retirez-les avant de la supprimer.',
        'TACHE_PRISE'
      );
    }
    await taskRepository.supprimer(tache.id, client);
    return { id: tache.id };
  });
}

/**
 * Affecte un ou plusieurs benevoles.
 *
 * Une demande en attente d'un benevole affecte vaut acceptation. Ceux qui
 * sont deja dans l'equipe sont ignores sans erreur : cocher deux fois la
 * meme personne ne doit rien casser.
 */
export async function affecter(id, corps = {}, admin = null) {
  const demandes = Array.isArray(corps.benevoleIds) ? corps.benevoleIds : [];
  const benevoleIds = [...new Set(demandes.map((b) => String(b)))];
  if (benevoleIds.length === 0) {
    throw new ErreurValidation('Choisissez au moins un bénévole.', { benevoleIds: 'Champ obligatoire' });
  }
  if (benevoleIds.length > 50 || benevoleIds.some((b) => !UUID.test(b))) {
    throw new ErreurValidation('La liste des bénévoles est invalide.', { benevoleIds: 'Identifiants invalides' });
  }

  const affectables = new Set((await taskRepository.benevolesAffectables()).map((b) => b.benevoleId));
  if (benevoleIds.some((b) => !affectables.has(b))) {
    throw new ErreurValidation('Un des bénévoles choisis n’a pas de compte actif.', {
      benevoleIds: 'Bénévole inconnu ou inactif',
    });
  }

  return transaction(async (client) => {
    const tache = await verrouiller(id, client);
    exigerNonLivree(tache);

    const nouveaux = [];
    for (const benevoleId of benevoleIds) {
      const actuelle = await taskRepository.place(tache.id, benevoleId, client);
      if (actuelle?.statut === 'affectee') continue;
      await taskRepository.affecter(tache.id, benevoleId, admin?.id ?? null, client);
      nouveaux.push(benevoleId);
    }
    await taskRepository.alignerStatut(tache.id, client);

    await prevenir(
      nouveaux,
      {
        titre: 'Une tâche vous est confiée',
        corps: `L’équipe HOPE vous a affecté à « ${tache.titre} ».`,
      },
      client
    );

    return { ...(await taskRepository.trouverParId(tache.id, client)), affectes: nouveaux.length };
  });
}

/** Retire un benevole de l'equipe. Le dernier parti, la tache redevient a faire. */
export async function retirer(id, benevoleId, admin = null) {
  const benevole = uuid(benevoleId, 'Le bénévole');
  return transaction(async (client) => {
    const tache = await verrouiller(id, client);
    exigerNonLivree(tache);

    const actuelle = await taskRepository.place(tache.id, benevole, client);
    if (actuelle?.statut !== 'affectee') {
      throw new ErreurIntrouvable('Ce bénévole dans l’équipe', benevoleId);
    }
    await taskRepository.retirer(tache.id, benevole, client);
    await taskRepository.alignerStatut(tache.id, client);

    await prevenir(
      [benevole],
      {
        titre: 'Tâche retirée',
        corps: `L’équipe HOPE vous a retiré de « ${tache.titre} ».`,
      },
      client
    );
    return taskRepository.trouverParId(tache.id, client);
  });
}

/** Accepte une demande : le benevole rejoint l'equipe. */
export async function accepter(id, benevoleId, admin = null) {
  const benevole = uuid(benevoleId, 'La demande');
  return transaction(async (client) => {
    const tache = await verrouiller(id, client);
    exigerNonLivree(tache);

    const actuelle = await taskRepository.place(tache.id, benevole, client);
    if (actuelle?.statut !== 'demandee') throw new ErreurIntrouvable('La demande', benevoleId);

    await taskRepository.affecter(tache.id, benevole, admin?.id ?? null, client);
    await taskRepository.alignerStatut(tache.id, client);

    await prevenir(
      [benevole],
      {
        titre: 'Demande acceptée',
        corps: `Vous faites partie de l’équipe de « ${tache.titre} ».`,
      },
      client
    );
    return taskRepository.trouverParId(tache.id, client);
  });
}

/** Refuse une demande. Le benevole pourra redemander plus tard. */
export async function refuser(id, benevoleId, admin = null) {
  const benevole = uuid(benevoleId, 'La demande');
  return transaction(async (client) => {
    const tache = await verrouiller(id, client);

    const actuelle = await taskRepository.place(tache.id, benevole, client);
    if (actuelle?.statut !== 'demandee') throw new ErreurIntrouvable('La demande', benevoleId);

    await taskRepository.refuser(tache.id, benevole, admin?.id ?? null, client);

    await prevenir(
      [benevole],
      {
        titre: 'Demande non retenue',
        corps: `L’équipe HOPE n’a pas retenu votre demande pour « ${tache.titre} ».`,
      },
      client
    );
    return taskRepository.trouverParId(tache.id, client);
  });
}

/* ================================================================
   Cote benevole
   ================================================================ */

/** Les chiffres de la vue d'ensemble de l'espace benevole. */
export async function apercu() {
  return taskRepository.apercu();
}

/**
 * Les taches qu'un benevole peut demander : toutes celles qui ne sont pas
 * livrees et dont il ne fait pas deja partie -- libres, ou deja en cours
 * avec d'autres. Chacune dit ou en est sa demande.
 */
export async function listerAPrendre(utilisateurId) {
  const fiche = await profileRepository.garantir(utilisateurId);
  const items = await taskRepository.lister(
    { aPrendrePour: fiche.id },
    { vue: 'benevole', benevoleId: fiche.id }
  );
  return { items };
}

/**
 * "Mes taches" : celles ou il est affecte.
 *
 * @param {string} utilisateurId
 * @param {{ statut?: string }} requete
 */
export async function mesTaches(utilisateurId, requete = {}) {
  const fiche = await profileRepository.garantir(utilisateurId);

  const statut = requete.statut ? String(requete.statut).trim().toLowerCase() : null;
  if (statut && !STATUTS.includes(statut)) {
    throw new ErreurValidation(`Le champ "statut" doit valoir : ${STATUTS.join(', ')}.`, {
      statut: 'Valeur non autorisée',
    });
  }

  const [items, compteurs] = await Promise.all([
    taskRepository.lister({ membre: fiche.id, statut }, { vue: 'benevole', benevoleId: fiche.id }),
    taskRepository.compterParStatut(fiche.id),
  ]);

  return { items, counts: compteurs };
}

/** Les taches d'un projet, vues par un benevole : sa place sur chacune. */
export async function listerPourBenevoleParProjet(projetId, utilisateurId) {
  const fiche = await profileRepository.garantir(utilisateurId);
  return taskRepository.lister({ projetId }, { vue: 'benevole', benevoleId: fiche.id });
}

/**
 * Le benevole demande une tache : la prendre si elle est libre, la
 * rejoindre sinon. Sa demande attend la decision de l'equipe HOPE.
 */
export async function demander(id, utilisateurId) {
  return transaction(async (client) => {
    const fiche = await profileRepository.garantir(utilisateurId, client);
    const tache = await verrouiller(id, client);

    if (tache.statut === 'livree') {
      throw new ErreurRegleMetier('Cette tâche est déjà livrée.', 'TACHE_LIVREE');
    }
    if (tache.projetArchiveLe) {
      throw new ErreurRegleMetier('Ce projet est archivé : ses tâches sont closes.', 'PROJET_ARCHIVE');
    }

    const actuelle = await taskRepository.place(tache.id, fiche.id, client);
    if (actuelle?.statut === 'affectee') {
      throw new ErreurRegleMetier('Vous faites déjà partie de cette tâche.', 'DEJA_AFFECTE');
    }
    if (actuelle?.statut === 'demandee') {
      throw new ErreurRegleMetier('Votre demande est déjà envoyée.', 'DEJA_DEMANDEE');
    }

    await taskRepository.demander(tache.id, fiche.id, client);
    return taskRepository.trouverPourBenevole(tache.id, fiche.id, client);
  });
}

/** Le benevole retire sa demande avant la decision. */
export async function annulerDemande(id, utilisateurId) {
  return transaction(async (client) => {
    const fiche = await profileRepository.garantir(utilisateurId, client);
    const tache = await verrouiller(id, client);

    const actuelle = await taskRepository.place(tache.id, fiche.id, client);
    if (actuelle?.statut !== 'demandee') {
      throw new ErreurRegleMetier('Aucune demande en attente sur cette tâche.', 'PAS_DE_DEMANDE');
    }
    await taskRepository.retirer(tache.id, fiche.id, client);
    return taskRepository.trouverPourBenevole(tache.id, fiche.id, client);
  });
}

/** Le benevole quitte la tache. Le dernier parti, elle redevient a faire. */
export async function relacher(id, utilisateurId) {
  return transaction(async (client) => {
    const fiche = await profileRepository.garantir(utilisateurId, client);
    const tache = await verrouiller(id, client);

    const actuelle = await taskRepository.place(tache.id, fiche.id, client);
    if (actuelle?.statut !== 'affectee') {
      throw new ErreurRegleMetier('Cette tâche n’est pas la vôtre.', 'TACHE_ETRANGERE');
    }
    if (tache.statut === 'livree') {
      throw new ErreurRegleMetier('Une tâche livrée ne peut plus être quittée.', 'TACHE_LIVREE');
    }

    await taskRepository.retirer(tache.id, fiche.id, client);
    await taskRepository.alignerStatut(tache.id, client);
    return taskRepository.trouverPourBenevole(tache.id, fiche.id, client);
  });
}

/** Nombre de fichiers qu'une livraison peut porter. */
const MAX_FICHIERS_LIVRAISON = 6;

/**
 * Verifie les fichiers d'une livraison.
 *
 * Le televersement accepte aussi le PDF, parce qu'il sert aux preuves
 * terrain ; une livraison, elle, se prouve par ce qu'on a vu : une photo
 * ou une video. Le plafond depend du type -- multer ne connait que le
 * plus haut des deux.
 */
function verifierFichiersLivraison(fichiers) {
  if (fichiers.length === 0) {
    throw new ErreurValidation('Joignez au moins une photo ou une vidéo de ce que vous avez fait.', {
      files: 'Preuve obligatoire',
    });
  }
  if (fichiers.length > MAX_FICHIERS_LIVRAISON) {
    throw new ErreurValidation(`Une livraison porte au plus ${MAX_FICHIERS_LIVRAISON} fichiers.`, {
      files: 'Trop de fichiers',
    });
  }

  for (const fichier of fichiers) {
    const type = String(fichier.mimetype ?? '');
    if (!type.startsWith('image/') && !type.startsWith('video/')) {
      throw new ErreurValidation(
        `« ${fichier.originalname} » n’est ni une photo ni une vidéo.`,
        { files: 'Photo ou vidéo attendue' }
      );
    }

    const plafond = plafondPreuve(type);
    if (fichier.size > plafond) {
      throw new ErreurValidation(
        `« ${fichier.originalname} » dépasse la taille maximale de ${Math.round(plafond / (1024 * 1024))} Mo.`,
        { files: 'Fichier trop volumineux' }
      );
    }
  }
}

/**
 * Un membre de l'equipe declare la tache livree, preuve a l'appui, pour
 * toute l'equipe.
 *
 * Les fichiers et le changement de statut vont ensemble, dans la meme
 * transaction : une tache livree sans preuve, ou une preuve sans tache
 * livree, serait un etat que l'ecran ne sait pas montrer.
 *
 * @param {Array<object>} fichiers ceux que multer a deja ecrits sur le
 *        disque. En cas de refus, c'est le controleur qui les efface.
 */
export async function livrer(id, utilisateurId, fichiers = []) {
  verifierFichiersLivraison(fichiers);

  return transaction(async (client) => {
    const fiche = await profileRepository.garantir(utilisateurId, client);
    const tache = await verrouiller(id, client);

    const actuelle = await taskRepository.place(tache.id, fiche.id, client);
    if (actuelle?.statut !== 'affectee') {
      throw new ErreurRegleMetier('Cette tâche n’est pas la vôtre.', 'TACHE_ETRANGERE');
    }
    if (tache.statut === 'livree') {
      throw new ErreurRegleMetier('Cette tâche est déjà livrée.', 'TACHE_LIVREE');
    }

    await taskRepository.ajouterFichiers(
      tache.id,
      fichiers.map((fichier) => ({
        nomFichier: String(fichier.originalname ?? 'preuve').slice(0, 255),
        chemin: fichier.filename,
        typeMime: fichier.mimetype,
        taille: fichier.size,
      })),
      client
    );
    await taskRepository.livrer(tache.id, fiche.id, client);
    return taskRepository.trouverPourBenevole(tache.id, fiche.id, client);
  });
}

/**
 * Un fichier de livraison, pour le servir.
 *
 * Avec un utilisateur : seule l'equipe de la tache y accede. Un refus se
 * dit "introuvable" -- repondre "interdit" confirmerait que la tache
 * d'une autre equipe a une preuve. Sans utilisateur, c'est l'equipe HOPE.
 *
 * @param {string|null} utilisateurId
 */
export async function fichierDeLivraison(tacheId, fichierId, utilisateurId = null) {
  const numero = Number(fichierId);
  if (!Number.isInteger(numero) || numero <= 0 || !UUID.test(String(tacheId ?? ''))) {
    throw new ErreurIntrouvable('Le fichier', fichierId);
  }

  const fichier = await taskRepository.trouverFichier(tacheId, numero);
  if (!fichier) throw new ErreurIntrouvable('Le fichier', fichierId);

  if (utilisateurId !== null) {
    const fiche = await profileRepository.garantir(utilisateurId);
    if (!(fichier.equipe ?? []).includes(fiche.id)) throw new ErreurIntrouvable('Le fichier', fichierId);
  }

  return fichier;
}
