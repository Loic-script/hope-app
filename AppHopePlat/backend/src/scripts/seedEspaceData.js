/**
 * Notifications et messages de demonstration des espaces utilisateurs.
 *
 *   npm run db:seed-espace             installe si les fils sont vides
 *   npm run db:seed-espace -- --force  efface et recommence
 *
 * Les deux tables ne connaissent que "utilisateur" : ce script sert donc
 * les benevoles comme les bailleurs. Il se cale sur les comptes de
 * demonstration deja en base, et ne cree personne.
 */
import { fermerPool, query } from '../config/database.js';

const FORCER = process.argv.includes('--force');

/** Horodatage decale de n heures. */
function ilYA(heures) {
  const date = new Date();
  date.setHours(date.getHours() - heures, 0, 0, 0);
  return date.toISOString();
}

/**
 * Ce que chaque role recoit.
 *
 * Les libelles sont ecrits du point de vue de celui qui lit, et
 * pointent vers l'ecran concerne : une notification qui ne mene nulle
 * part ne sert qu'a inquieter.
 */
const NOTIFICATIONS = {
  benevole: [
    { type: 'mission', titre: 'Votre inscription est confirmée',
      corps: 'Traduction des supports pédagogiques — l’encadrante vous attend mardi à 19:00.',
      lien: '/benevole/missions', heures: 3, lu: false },
    { type: 'tache', titre: 'Une tâche vous a été attribuée',
      corps: 'Consolider le tableur des repas du trimestre, à rendre sous cinq jours.',
      lien: '/benevole/taches', heures: 20, lu: false },
    { type: 'journal', titre: 'Vos heures ont été validées',
      corps: '6 heures constatées sur « Mise à jour du tableur des repas servis ».',
      lien: '/benevole/journal', heures: 52, lu: false },
    { type: 'mission', titre: 'Nouvelle mission près de chez vous',
      corps: 'Création du jardin potager de l’école, à Fianarantsoa, dans seize jours.',
      lien: '/benevole/missions', heures: 96, lu: true },
    { type: 'profil', titre: 'Profil validé par HOPE',
      corps: 'Vous avez désormais accès aux missions de terrain.',
      lien: '/benevole/profil', heures: 240, lu: true },
  ],
  bailleur: [
    { type: 'preuve', titre: 'Trois preuves terrain publiées',
      corps: 'Cantines scolaires de Fianarantsoa — photos du service de midi.',
      lien: '/bailleur/preuves', heures: 5, lu: false },
    { type: 'rapport', titre: 'Votre rapport trimestriel est disponible',
      corps: 'Emploi des fonds au 30 septembre, avec le détail par projet.',
      lien: '/bailleur/rapports', heures: 30, lu: false },
    { type: 'versement', titre: 'Versement enregistré',
      corps: 'La tranche de 5 000 000 Ar a été rapprochée de votre engagement.',
      lien: '/bailleur/partenariat', heures: 74, lu: true },
    { type: 'actualite', titre: 'Une nouvelle des projets que vous financez',
      corps: 'Santé pour tous : la campagne de dépistage a touché deux fois plus de familles que prévu.',
      lien: '/bailleur/actualites', heures: 150, lu: true },
  ],
};

/** Les fils de discussion avec l'equipe. */
const MESSAGES = {
  benevole: [
    {
      sujet: 'Disponibilité pour les samedis de novembre',
      corps:
        'Bonjour, je peux prendre les samedis matin à partir du 8 novembre. Y a-t-il des missions de soutien scolaire ce jour-là ? Merci.',
      heures: 8,
      reponse:
        'Bonjour, merci pour votre disponibilité. Nous ouvrons deux créneaux le samedi matin à Ankadifotsy à partir du 8 ; ils apparaîtront dans vos missions la semaine prochaine.',
      reponseHeures: 5,
      reponseLue: false,
    },
    {
      sujet: 'Attestation de bénévolat',
      corps:
        'Mon employeur me demande une attestation des heures effectuées cette année. Pouvez-vous me l’établir ?',
      heures: 340,
      reponse:
        'C’est fait, l’attestation part par courriel aujourd’hui. Elle reprend les heures validées de votre journal, arrêtées à hier.',
      reponseHeures: 336,
      reponseLue: true,
    },
    {
      sujet: 'Matériel pour l’atelier couture',
      corps:
        'Faut-il apporter sa propre machine pour l’atelier du mois prochain, ou HOPE en fournit ?',
      heures: 2,
      reponse: null,
    },
  ],
  bailleur: [
    {
      sujet: 'Détail de l’affectation du deuxième versement',
      corps:
        'Bonjour, pourriez-vous préciser la répartition du versement de septembre entre les quatre projets soutenus ? Notre conseil d’administration le demande.',
      heures: 26,
      reponse:
        'Bonjour, la répartition figure désormais dans votre rapport trimestriel, section « Emploi des fonds ». En résumé : 43,9 % scolarité, 29,3 % soins, 26,8 % alimentation.',
      reponseHeures: 22,
      reponseLue: false,
    },
    {
      sujet: 'Visite de terrain en décembre',
      corps:
        'Nous souhaiterions visiter deux sites début décembre avec une délégation de trois personnes. Est-ce envisageable ?',
      heures: 100,
      reponse: null,
    },
  ],
};

async function vider() {
  console.log('[HOPE] --force : suppression des notifications et des messages...');
  await query('TRUNCATE notification_utilisateur, message_utilisateur');
}

async function installer() {
  // Les comptes de demonstration, par role. On passe par utilisateur_role
  // plutot que par la presence d'une fiche : c'est le role qui decide de
  // ce qu'on recoit.
  const comptes = await query(
    `SELECT u.id, u.email, r.role
       FROM utilisateur u
       JOIN utilisateur_role r ON r.utilisateur_id = u.id
      WHERE u.statut = 'actif' AND r.role IN ('benevole', 'bailleur')
      ORDER BY r.role, u.cree_le`
  );
  if (comptes.rowCount === 0) {
    throw new Error(
      'Aucun compte benevole ou bailleur actif. Lancez d abord :\n' +
        '       npm run db:seed-volunteers -- --force\n' +
        '       npm run db:seed-funders -- --force'
    );
  }

  const admin = await query('SELECT id FROM admins ORDER BY id LIMIT 1');
  const repondant = admin.rows[0]?.id ?? null;

  let notifications = 0;
  let messages = 0;

  for (const compte of comptes.rows) {
    for (const n of NOTIFICATIONS[compte.role] ?? []) {
      await query(
        `INSERT INTO notification_utilisateur
           (utilisateur_id, type, titre, corps, lien, lu, cree_le)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [compte.id, n.type, n.titre, n.corps, n.lien, n.lu, ilYA(n.heures)]
      );
      notifications += 1;
    }

    for (const m of MESSAGES[compte.role] ?? []) {
      await query(
        `INSERT INTO message_utilisateur
           (utilisateur_id, sujet, corps, statut, reponse, repondu_le,
            repondu_par, reponse_lue, cree_le)
         VALUES ($1, $2, $3,
                 CASE WHEN $4::TEXT IS NULL THEN 'envoye' ELSE 'repondu' END,
                 $4::TEXT,
                 CASE WHEN $4::TEXT IS NULL THEN NULL ELSE $5::TIMESTAMPTZ END,
                 CASE WHEN $4::TEXT IS NULL THEN NULL ELSE $6::INTEGER END,
                 $7, $8)`,
        [
          compte.id, m.sujet, m.corps, m.reponse ?? null,
          m.reponse ? ilYA(m.reponseHeures) : null, repondant,
          // Sans reponse, il n'y a rien a lire : le drapeau reste vrai,
          // sinon la pastille compterait un message qui n'existe pas.
          m.reponse ? (m.reponseLue ?? true) : true,
          ilYA(m.heures),
        ]
      );
      messages += 1;
    }
  }

  return { comptes: comptes.rowCount, notifications, messages };
}

async function executer() {
  if (FORCER) await vider();

  const existantes = await query(
    'SELECT COUNT(*)::int AS total FROM notification_utilisateur'
  );
  if (existantes.rows[0].total > 0) {
    console.log(
      `[HOPE] ${existantes.rows[0].total} notification(s) deja en base : donnees ignorees.`
    );
    console.log('[HOPE] Utilisez "npm run db:seed-espace -- --force" pour recommencer.');
    return;
  }

  const resume = await installer();

  console.log('[HOPE] Espaces : notifications et messages installes.');
  console.log(
    `       ${resume.comptes} comptes servis, ${resume.notifications} notifications,` +
      ` ${resume.messages} messages.`
  );
}

executer()
  .catch((erreur) => {
    console.error('[HOPE] Echec du seed des espaces :', erreur.message);
    process.exitCode = 1;
  })
  .finally(() => fermerPool());
