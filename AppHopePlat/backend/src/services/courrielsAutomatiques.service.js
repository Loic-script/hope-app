import { config } from '../config/env.js';
import { query } from '../config/database.js';
import * as courriel from './courriel.service.js';

const site = () => config.siteUrl.replace(/\/$/, '');

function montant(valeur, devise = 'MGA') {
  const nombre = Number(valeur ?? 0);
  const lisible = (texte) => texte.replace(/\s/g, ' ');
  if (devise === 'MGA') return `${lisible(Math.round(nombre).toLocaleString('fr-FR'))} Ar`;
  return `${lisible(nombre.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))} ${devise}`;
}

async function sansEchec(nom, travail) {
  try {
    await travail();
  } catch (erreur) {
    console.error(`[HOPE] Courriel automatique « ${nom} » non envoye :`, erreur.message);
  }
}

async function destinataireDuDon(donationId) {
  const { rows } = await query(
    `SELECT d.id, d.reference, d.amount, d.currency, d.allocation, d.payment_method, d.status,
            d.received_at, d.created_at, p.name AS projet,
            o.email AS email_fiche, o.first_name AS prenom_fiche,
            u.email AS email_compte, u.prenom AS prenom_compte
       FROM donations d
       JOIN donors o ON o.id = d.donor_id
       LEFT JOIN projects p ON p.id = d.project_id
       LEFT JOIN utilisateur u ON u.id = o.utilisateur_id
      WHERE d.id = $1`,
    [donationId]
  );
  const don = rows[0];
  if (!don) return null;
  if (don.email_compte) {
    return { ...don, a: don.email_compte, prenom: don.prenom_compte || don.prenom_fiche, avecCompte: true };
  }
  return don.email_fiche ? { ...don, a: don.email_fiche, prenom: don.prenom_fiche, avecCompte: false } : null;
}

export function donRecu(donationId) {
  return sansEchec('don recu', async () => {
    const don = await destinataireDuDon(donationId);
    if (!don) return;
    const pour = don.allocation === 'PROJECT' && don.projet ? `au projet « ${don.projet} »` : 'au fonds HOPE, réparti là où le besoin est le plus grand';
    await courriel.envoyer({
      a: don.a,
      sujet: `HOPE — merci pour votre don de ${montant(don.amount, don.currency)}`,
      titre: `Merci${don.prenom ? ` ${don.prenom}` : ''} !`,
      paragraphes: [
        `Nous avons bien reçu votre don de ${montant(don.amount, don.currency)}, affecté ${pour}.`,
        `Référence : ${don.reference}${don.payment_method ? ` · moyen : ${don.payment_method}` : ''}.`,
        'Vous pourrez suivre ce qu’il devient : l’équipe publie l’avancement des projets, les dépenses et les preuves de terrain.',
      ],
      bouton: don.avecCompte ? { texte: 'Ouvrir mon espace', lien: `${site()}/authentification` } : null,
      note: 'Conservez ce courriel : il vaut accusé de réception de votre don.',
    });
  });
}

export function promesseEnregistree(donationId) {
  return sansEchec('promesse enregistree', async () => {
    const don = await destinataireDuDon(donationId);
    if (!don) return;
    await courriel.envoyer({
      a: don.a,
      sujet: `HOPE — votre promesse de don ${don.reference}`,
      titre: `Merci${don.prenom ? ` ${don.prenom}` : ''}, c’est noté.`,
      paragraphes: [
        `Votre promesse de don de ${montant(don.amount, don.currency)} est enregistrée sous la référence ${don.reference}.`,
        'Dès que votre paiement nous parvient, l’équipe HOPE le confirme et vous recevez un courriel de remerciement.',
      ],
      bouton: don.avecCompte ? { texte: 'Suivre mon don', lien: `${site()}/authentification` } : null,
      note: 'Vous n’êtes pas à l’origine de ce don ? Répondez à ce courriel ou écrivez à l’équipe HOPE.',
    });
  });
}

const ESPACES = {
  benevole: {
    nom: 'bénévole',
    chemin: '/benevole',
    usage: 'Vous y trouverez les tâches à prendre près de chez vous, et celles qui vous sont confiées.',
  },
  bailleur: {
    nom: 'bailleur',
    chemin: '/bailleur',
    usage: 'Vous y suivez les projets que vous financez : avancement, dépenses, rapports.',
  },
  donateur: {
    nom: 'donateur',
    chemin: '/donateur',
    usage: 'Vous y retrouvez vos dons et suivez l’avancement des projets que vous soutenez.',
  },
};

async function compteJoignable(utilisateurId) {
  const { rows } = await query(
    `SELECT u.email, u.prenom, u.statut, u.email_verifie_le,
            ARRAY(SELECT r.role FROM utilisateur_role r WHERE r.utilisateur_id = u.id) AS roles
       FROM utilisateur u
      WHERE u.id = $1`,
    [utilisateurId]
  );
  const compte = rows[0];
  if (!compte?.email || !compte.email_verifie_le) return null;
  const type = ['bailleur', 'benevole'].find((role) => compte.roles.includes(role)) ?? 'donateur';
  return { ...compte, espace: ESPACES[type] };
}

export function compteValide(utilisateurId, type) {
  return sansEchec('compte valide', async () => {
    const compte = await compteJoignable(utilisateurId);
    if (!compte) return;
    const espace = ESPACES[type] ?? ESPACES.benevole;
    await courriel.envoyer({
      a: compte.email,
      sujet: `HOPE — votre compte ${espace.nom} est validé`,
      titre: `Bienvenue${compte.prenom ? ` ${compte.prenom}` : ''} !`,
      paragraphes: [`L’équipe HOPE a validé votre compte ${espace.nom}. Votre espace est ouvert.`, espace.usage],
      bouton: { texte: 'Ouvrir mon espace', lien: `${site()}/authentification` },
    });
  });
}

export function bienvenue(utilisateurId) {
  return sansEchec('bienvenue', async () => {
    const compte = await compteJoignable(utilisateurId);
    if (!compte || !['actif', 'en_attente'].includes(compte.statut)) return;
    const { espace } = compte;
    const ouvert = compte.statut === 'actif';
    await courriel.envoyer({
      a: compte.email,
      sujet: ouvert ? `HOPE — bienvenue dans votre espace ${espace.nom}` : 'HOPE — votre adresse est confirmée',
      titre: `Bienvenue${compte.prenom ? ` ${compte.prenom}` : ''} !`,
      paragraphes: ouvert
        ? [`Votre adresse est confirmée et votre espace ${espace.nom} est ouvert.`, espace.usage]
        : [
            `Votre adresse est confirmée. L’équipe HOPE vérifie maintenant votre inscription comme ${espace.nom}.`,
            'Vous recevrez un courriel dès que votre espace sera ouvert.',
          ],
      bouton: ouvert ? { texte: 'Ouvrir mon espace', lien: `${site()}${espace.chemin}` } : null,
    });
  });
}

export function accesRetire(utilisateurId, { statut, enAttente = false, motif = null }) {
  return sansEchec('acces retire', async () => {
    const compte = await compteJoignable(utilisateurId);
    if (!compte) return;
    const { espace } = compte;
    const courrielDe = {
      suspendu: {
        sujet: 'HOPE — votre espace est suspendu',
        titre: 'Votre espace HOPE est suspendu',
        paragraphes: [
          `L’équipe HOPE a suspendu l’accès à votre espace ${espace.nom}. Vos informations sont conservées : rien n’est effacé.`,
          'Pour en connaître la raison ou demander sa réouverture, écrivez à l’équipe.',
        ],
      },
      refuse: {
        sujet: 'HOPE — votre inscription n’a pas été retenue',
        titre: 'Votre inscription n’a pas été retenue',
        paragraphes: [
          `L’équipe HOPE n’a pas retenu votre inscription comme ${espace.nom}.`,
          'Vous pensez qu’il s’agit d’une erreur, ou vous voulez en savoir plus ? Écrivez à l’équipe.',
        ],
      },
      supprime: {
        sujet: 'HOPE — votre compte est fermé',
        titre: 'Votre compte HOPE est fermé',
        paragraphes: [
          `L’équipe HOPE a fermé votre compte ${espace.nom} : vous ne pouvez plus vous connecter à votre espace.`,
          'Pour en connaître la raison, écrivez à l’équipe.',
        ],
      },
    }[statut === 'supprime' && enAttente ? 'refuse' : statut];
    if (!courrielDe) return;
    const [constat, suite] = courrielDe.paragraphes;
    await courriel.envoyer({
      a: compte.email,
      ...courrielDe,
      paragraphes: motif ? [constat, `Motif indiqué par l’équipe : « ${motif} »`, suite] : courrielDe.paragraphes,
      bouton: { texte: 'Écrire à l’équipe HOPE', lien: `${site()}/contact` },
    });
  });
}

export function motDePasseChange(utilisateurId) {
  return sansEchec('mot de passe change', async () => {
    const compte = await compteJoignable(utilisateurId);
    if (!compte) return;
    await courriel.envoyer({
      a: compte.email,
      sujet: 'HOPE — votre mot de passe a été changé',
      titre: 'Votre mot de passe a été changé',
      paragraphes: [
        'Le mot de passe de votre compte HOPE vient d’être changé, et vos autres sessions ont été fermées.',
        'C’était vous ? Vous n’avez rien à faire.',
        'Ce n’était pas vous ? Choisissez tout de suite un nouveau mot de passe, puis prévenez l’équipe HOPE.',
      ],
      bouton: { texte: 'Choisir un nouveau mot de passe', lien: `${site()}/mot-de-passe-oublie` },
    });
  });
}

export function adresseChangee({ ancienne, nouvelle, prenom }) {
  return sansEchec('adresse changee', async () => {
    await courriel.envoyer({
      a: ancienne,
      sujet: 'HOPE — l’adresse de votre compte a changé',
      titre: `${prenom ? `${prenom}, l` : 'L'}’adresse de votre compte a changé`,
      paragraphes: [
        `L’équipe HOPE a remplacé l’adresse de votre compte par ${nouvelle}. C’est désormais elle qui sert à vous connecter, et à laquelle HOPE vous écrit.`,
        'Vous n’avez pas demandé ce changement ? Écrivez à l’équipe.',
      ],
      bouton: { texte: 'Écrire à l’équipe HOPE', lien: `${site()}/contact` },
    });
  });
}

export function rapportPublie({ bailleurIds, projet, titre }) {
  return sansEchec('rapport publie', async () => {
    const { rows } = await query(
      `SELECT DISTINCT u.email, u.prenom
         FROM bailleur_contact c
         JOIN utilisateur u ON u.id = c.utilisateur_id
        WHERE c.bailleur_id = ANY($1::uuid[]) AND u.statut = 'actif' AND u.email_verifie_le IS NOT NULL`,
      [bailleurIds]
    );
    for (const contact of rows) {
      await courriel.envoyer({
        a: contact.email,
        sujet: `HOPE — nouveau rapport d’impact : « ${projet} »`,
        titre: `${contact.prenom ? `${contact.prenom}, v` : 'V'}otre rapport d’impact est disponible`,
        paragraphes: [
          `L’équipe HOPE vient de publier « ${titre} » pour le projet « ${projet} », que vous financez.`,
          'Le rapport vous attend dans votre espace bailleur, avec l’avancement du projet et ses dépenses.',
        ],
        bouton: { texte: 'Lire le rapport', lien: `${site()}/bailleur/rapports` },
      });
    }
  });
}

export function projetTermine(projetId) {
  return sansEchec('projet termine', async () => {
    const { rows } = await query(
      `SELECT DISTINCT ON (t.adresse) t.adresse, t.prenom, t.projet, t.resultat
         FROM (SELECT COALESCE(u.email, o.email) AS adresse,
                      COALESCE(NULLIF(u.prenom, ''), o.first_name) AS prenom,
                      p.name AS projet, p.outcome AS resultat
                 FROM donations d
                 JOIN projects p ON p.id = d.project_id
                 JOIN donors o ON o.id = d.donor_id
                 LEFT JOIN utilisateur u ON u.id = o.utilisateur_id
                WHERE d.project_id = $1 AND d.status = 'RECEIVED'
                  AND (u.id IS NULL OR u.statut <> 'supprime')) t
        WHERE t.adresse IS NOT NULL
        ORDER BY t.adresse`,
      [projetId]
    );
    for (const donateur of rows) {
      await courriel.envoyer({
        a: donateur.adresse,
        sujet: `HOPE — le projet « ${donateur.projet} » est terminé`,
        titre: `Merci${donateur.prenom ? ` ${donateur.prenom}` : ''} : « ${donateur.projet} » est terminé`,
        paragraphes: [
          'Vous avez soutenu ce projet, et il vient d’aboutir. Voici ce que votre don a permis :',
          `« ${extrait(donateur.resultat, 600)} »`,
          'Les photos, les dépenses et les preuves de terrain restent consultables sur la fiche du projet.',
        ],
        bouton: { texte: 'Voir le projet', lien: `${site()}/nos-projets/${projetId}` },
      });
    }
  });
}

function extrait(texte, longueur = 280) {
  const propre = String(texte ?? '').replace(/\s+/g, ' ').trim();
  return propre.length <= longueur ? propre : `${propre.slice(0, longueur - 1).trimEnd()}…`;
}

export function avisDeTache(benevoleIds, { titre, corps }) {
  return sansEchec('avis de tache', async () => {
    const { rows } = await query(
      `SELECT u.email, u.prenom
         FROM benevole b
         JOIN utilisateur u ON u.id = b.utilisateur_id
        WHERE b.id = ANY($1::uuid[]) AND u.statut = 'actif' AND u.email_verifie_le IS NOT NULL`,
      [benevoleIds]
    );
    for (const benevole of rows) {
      await courriel.envoyer({
        a: benevole.email,
        sujet: `HOPE — ${titre.charAt(0).toLowerCase()}${titre.slice(1)}`,
        titre: `${titre}${benevole.prenom ? `, ${benevole.prenom}` : ''}`,
        paragraphes: [corps, 'Le détail vous attend dans votre espace bénévole.'],
        bouton: { texte: 'Voir mes tâches', lien: `${site()}/benevole/taches` },
      });
    }
  });
}

export function nouveauMessage(messageId) {
  return sansEchec('nouveau message', async () => {
    const { rows } = await query(
      `SELECT m.id, m.conversation_id, m.utilisateur_id, m.admin_id, m.auteur_nom, m.corps,
              c.type, c.assistance,
              (SELECT p.utilisateur_id
                 FROM conversation_message p
                WHERE p.conversation_id = m.conversation_id AND p.id < m.id AND p.supprime_le IS NULL
                ORDER BY p.id DESC
                LIMIT 1) AS precedent_utilisateur_id
         FROM conversation_message m
         JOIN conversation c ON c.id = m.conversation_id
        WHERE m.id = $1 AND m.supprime_le IS NULL`,
      [messageId]
    );
    const message = rows[0];
    if (!message) return;
    const contenu = extrait(message.corps);

    if (message.utilisateur_id) {
      if (!message.assistance || message.precedent_utilisateur_id === message.utilisateur_id) return;
      await alerterEquipe(
        `un message de ${message.auteur_nom}`,
        [
          contenu ? `« ${contenu} »` : `${message.auteur_nom} vous a envoyé un fichier.`,
          'Répondez-lui depuis la messagerie de l’administration.',
        ],
        `/admin/conversations/${message.conversation_id}`
      );
      return;
    }

    if (message.type !== 'individuel') return;
    const destinataires = await query(
      `SELECT u.email, u.prenom,
              ARRAY(SELECT r.role FROM utilisateur_role r WHERE r.utilisateur_id = u.id) AS roles
         FROM conversation_participant p
         JOIN utilisateur u ON u.id = p.utilisateur_id
        WHERE p.conversation_id = $1
          AND u.statut = 'actif'
          AND u.email_verifie_le IS NOT NULL
          AND NOT EXISTS (
                SELECT 1 FROM conversation_message x
                 WHERE x.conversation_id = p.conversation_id
                   AND x.id < $2
                   AND x.supprime_le IS NULL
                   AND x.utilisateur_id IS DISTINCT FROM p.utilisateur_id
                   AND (p.lu_jusqu_a IS NULL OR x.cree_le > p.lu_jusqu_a))`,
      [message.conversation_id, message.id]
    );
    for (const personne of destinataires.rows) {
      const type = ['bailleur', 'benevole'].find((role) => personne.roles.includes(role)) ?? 'donateur';
      await courriel.envoyer({
        a: personne.email,
        sujet: 'HOPE — un nouveau message de l’équipe',
        titre: `${message.auteur_nom} vous a écrit`,
        paragraphes: [
          contenu ? `« ${contenu} »` : 'Un fichier vous attend dans votre messagerie HOPE.',
          'Lisez la suite et répondez depuis votre espace.',
        ],
        bouton: {
          texte: 'Lire le message',
          lien: `${site()}${ESPACES[type].chemin}/messages/${message.conversation_id}`,
        },
        note: 'Vous ne recevrez pas d’autre courriel pour cette conversation tant que vous ne l’aurez pas ouverte.',
      });
    }
  });
}

export function paiementInabouti(donationId) {
  return sansEchec('paiement inabouti', async () => {
    const don = await destinataireDuDon(donationId);
    if (!don || don.status === 'RECEIVED') return;
    const { rows } = await query(
      `SELECT 1
         FROM donations d
         JOIN donations e ON e.donor_id = d.donor_id AND e.id <> d.id AND e.created_at > d.created_at
        WHERE d.id = $1
        LIMIT 1`,
      [donationId]
    );
    if (rows.length > 0) return;
    await courriel.envoyer({
      a: don.a,
      sujet: 'HOPE — votre don n’a pas abouti',
      titre: 'Votre don n’a pas pu aboutir',
      paragraphes: [
        `Votre don de ${montant(don.amount, don.currency)} par carte (référence ${don.reference}) n’a pas été finalisé : aucun montant n’a été débité.`,
        'Si vous le souhaitez, vous pouvez recommencer en quelques minutes.',
      ],
      bouton: { texte: 'Faire un don', lien: `${site()}/faire-un-don` },
      note: 'Vous avez déjà donné autrement ? Ignorez simplement ce courriel, et merci !',
    });
  });
}

function alerterEquipe(sujet, paragraphes, chemin) {
  return sansEchec('alerte equipe', async () => {
    if (!config.equipe.email) return;
    await courriel.envoyer({
      a: config.equipe.email,
      sujet: `HOPE équipe — ${sujet}`,
      titre: sujet,
      paragraphes,
      bouton: { texte: 'Ouvrir l’administration', lien: `${site()}${chemin}` },
      note: 'Courriel automatique de la plateforme HOPE.',
    });
  });
}

export function compteAValider({ email, type }) {
  const espace = ESPACES[type]?.nom ?? type;
  return alerterEquipe(
    `un compte ${espace} attend sa validation`,
    [`${email} vient de s’inscrire comme ${espace}.`, 'Vérifiez sa fiche, puis validez ou refusez son accès.'],
    '/admin/utilisateurs'
  );
}

async function donPourEquipe(donationId) {
  const { rows } = await query(
    `SELECT d.reference, d.amount, d.currency, d.payment_method, d.payment_reference, p.name AS projet,
            COALESCE(NULLIF(TRIM(CONCAT_WS(' ', o.first_name, o.last_name)), ''), o.organization_name) AS qui
       FROM donations d
       JOIN donors o ON o.id = d.donor_id
       LEFT JOIN projects p ON p.id = d.project_id
      WHERE d.id = $1`,
    [donationId]
  );
  return rows[0] ?? null;
}

export function donParCarte(donationId) {
  return sansEchec('alerte don par carte', async () => {
    const don = await donPourEquipe(donationId);
    if (!don) return;
    await alerterEquipe(
      `don par carte de ${montant(don.amount, don.currency)}`,
      [
        `${don.qui ?? 'Un donateur'} a donné ${montant(don.amount, don.currency)} par carte${don.projet ? ` pour « ${don.projet} »` : ''}.`,
        `Référence ${don.reference}. Stripe a encaissé le paiement et le donateur a reçu son remerciement.`,
      ],
      '/admin/dons'
    );
  });
}

export function demandeDeTache({ qui, tache, projet }) {
  return alerterEquipe(
    'une demande de tâche à valider',
    [
      `${qui} souhaite prendre la tâche « ${tache} »${projet ? ` (${projet})` : ''}.`,
      'Acceptez ou refusez sa demande : la personne est prévenue de votre réponse.',
    ],
    '/admin/taches'
  );
}

export function tacheLivree({ qui, tache, projet }) {
  return alerterEquipe(
    'une tâche livrée, à vérifier',
    [
      `${qui} a livré la tâche « ${tache} »${projet ? ` (${projet})` : ''}.`,
      'Sa preuve et son commentaire vous attendent sur la page Tâches.',
    ],
    '/admin/taches'
  );
}

export function interetDeBailleur({ organisation, projet, message }) {
  return alerterEquipe(
    `${organisation} souhaite financer ${projet ? `« ${projet} »` : 'un projet'}`,
    [
      ...(message ? [`Son message : « ${extrait(message, 600)} »`] : []),
      'Recontactez ce partenaire pour formaliser le financement.',
    ],
    '/admin/actualites'
  );
}

export function promesseAConfirmer(donationId) {
  return sansEchec('alerte promesse', async () => {
    const don = await donPourEquipe(donationId);
    if (!don) return;
    await alerterEquipe(
      `promesse de don ${don.reference} à confirmer`,
      [
        `${don.qui ?? 'Un donateur'} promet ${montant(don.amount, don.currency)}${don.payment_method ? ` par ${don.payment_method}` : ''}${don.payment_reference ? ` (réf. ${don.payment_reference})` : ''}.`,
        'Confirmez-la dans « Dons reçus » dès que le paiement arrive : le donateur recevra alors son remerciement.',
      ],
      '/admin/dons'
    );
  });
}

export function messageDeContact(message) {
  return alerterEquipe(
    `un message du site — ${message.sujetLibelle}`,
    [
      `De ${message.nom} (${message.email}${message.telephone ? `, ${message.telephone}` : ''}) :`,
      message.message,
      'Répondez-lui directement par courriel.',
    ],
    '/admin/notifications'
  );
}

export function contactRecu(message) {
  return sansEchec('contact recu', async () => {
    await courriel.envoyer({
      a: message.email,
      sujet: 'HOPE — nous avons bien reçu votre message',
      titre: 'Merci, votre message est bien arrivé.',
      paragraphes: [
        `Vous nous écrivez au sujet de : ${message.sujetLibelle}. Une personne de l’équipe HOPE vous répond à cette adresse sous 48 h ouvrées.`,
      ],
      note: 'Vous n’êtes pas à l’origine de ce message ? Ignorez simplement ce courriel.',
    });
  });
}
