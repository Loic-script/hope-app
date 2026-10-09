import { fermerPool, query } from '../config/database.js';

const FORCER = process.argv.includes('--force');

function ilYA(heures) {
  const date = new Date();
  date.setHours(date.getHours() - heures, 0, 0, 0);
  return date.toISOString();
}

const NOTIFICATIONS = {
  benevole: [
    { type: 'tache', titre: 'Votre livraison a été validée',
      corps: 'Relire les bulletins du premier trimestre — merci, la coordinatrice a tout repris.',
      lien: '/benevole/journal', heures: 3, lu: false },
    { type: 'tache', titre: 'Une tâche vous a été attribuée',
      corps: 'Consolider le tableur des repas du trimestre, à rendre sous cinq jours.',
      lien: '/benevole/taches', heures: 20, lu: false },
    { type: 'journal', titre: 'Nouveau badge : 5 tâches livrées',
      corps: 'Votre journal compte désormais cinq tâches livrées. Merci pour votre constance.',
      lien: '/benevole/journal', heures: 52, lu: false },
    { type: 'tache', titre: 'De nouvelles tâches à prendre',
      corps: 'Cantines scolaires de Fianarantsoa : dessiner le plan du futur potager.',
      lien: '/benevole/taches', heures: 96, lu: true },
    { type: 'profil', titre: 'Profil validé par HOPE',
      corps: 'Votre profil est complet et validé : toutes les tâches vous sont ouvertes.',
      lien: '/benevole/profil', heures: 240, lu: true },
  ],
  bailleur: [
    { type: 'rapport', titre: 'De nouveaux justificatifs sont disponibles',
      corps: 'Cantines scolaires de Fianarantsoa — factures du trimestre.',
      lien: '/bailleur/rapports', heures: 5, lu: false },
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

const MESSAGES = {
  benevole: [
    {
      sujet: 'Disponibilité pour les samedis de novembre',
      corps:
        'Bonjour, je peux me libérer les samedis matin à partir du 8 novembre. Y a-t-il des tâches de soutien scolaire à prendre ? Merci.',
      heures: 8,
      reponse:
        'Bonjour, merci pour votre disponibilité. Deux tâches de soutien scolaire à Ankadifotsy seront publiées la semaine prochaine ; vous les trouverez dans « Tâches à prendre ».',
      reponseHeures: 5,
      reponseLue: false,
    },
    {
      sujet: 'Attestation de bénévolat',
      corps:
        'Mon employeur me demande une attestation de mon engagement cette année. Pouvez-vous me l’établir ?',
      heures: 340,
      reponse:
        'C’est fait, l’attestation part par courriel aujourd’hui. Elle reprend les tâches validées de votre journal, arrêtées à hier.',
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
  await query('TRUNCATE notification_utilisateur, message_utilisateur, message_entree');

  const efface = await query(
    `DELETE FROM conversation c
      WHERE NOT EXISTS (
              SELECT 1 FROM conversation_participant p
               WHERE p.conversation_id = c.id AND p.utilisateur_id IS NOT NULL)
         OR EXISTS (
              SELECT 1 FROM conversation_participant p
                JOIN utilisateur_role r ON r.utilisateur_id = p.utilisateur_id
               WHERE p.conversation_id = c.id
                 AND r.role IN ('benevole', 'bailleur'))`
  );
  console.log(`[HOPE] --force : ${efface.rowCount} conversation(s) des espaces effacee(s).`);
}

async function installer() {
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
      const envoiLe = ilYA(m.heures);
      const reponseLe = m.reponse ? ilYA(m.reponseHeures) : null;

      const fil = await query(
        `INSERT INTO message_utilisateur
           (utilisateur_id, sujet, statut, cree_le, updated_at)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [
          compte.id,
          m.sujet,
          m.reponse ? 'repondu' : 'envoye',
          envoiLe,
          reponseLe ?? envoiLe,
        ]
      );
      const filId = fil.rows[0].id;

      await query(
        `INSERT INTO message_entree (fil_id, auteur, corps, lu, cree_le)
         VALUES ($1, 'utilisateur', $2, $3, $4)`,
        [filId, m.corps, m.reponse !== null && m.reponse !== undefined, envoiLe]
      );

      if (m.reponse) {
        await query(
          `INSERT INTO message_entree
             (fil_id, auteur, corps, admin_id, lu, cree_le)
           VALUES ($1, 'hope', $2, $3, $4, $5)`,
          [filId, m.reponse, repondant, m.reponseLue ?? true, reponseLe]
        );
      }

      const conversation = await query(
        `INSERT INTO conversation (sujet, cree_le, maj_le)
         VALUES ($1, $2, $3) RETURNING id`,
        [m.sujet, envoiLe, reponseLe ?? envoiLe]
      );
      const conversationId = conversation.rows[0].id;

      await query(
        `INSERT INTO conversation_participant
           (conversation_id, utilisateur_id, lu_jusqu_a)
         VALUES ($1, $2, $3)`,
        [conversationId, compte.id, m.reponse && !(m.reponseLue ?? true) ? envoiLe : (reponseLe ?? envoiLe)]
      );

      if (repondant !== null) {
        await query(
          `INSERT INTO conversation_participant
             (conversation_id, admin_id, lu_jusqu_a)
           VALUES ($1, $2, $3)`,
          [conversationId, repondant, reponseLe ?? envoiLe]
        );
      }

      await query(
        `INSERT INTO conversation_message
           (conversation_id, utilisateur_id, corps, cree_le)
         VALUES ($1, $2, $3, $4)`,
        [conversationId, compte.id, m.corps, envoiLe]
      );

      if (m.reponse && repondant !== null) {
        await query(
          `INSERT INTO conversation_message
             (conversation_id, admin_id, corps, cree_le)
           VALUES ($1, $2, $3, $4)`,
          [conversationId, repondant, m.reponse, reponseLe]
        );
      }

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
