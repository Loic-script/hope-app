/**
 * Les courriels que la plateforme envoie d'elle-meme, au fil des
 * evenements.
 *
 *   Aux donateurs, benevoles et bailleurs :
 *     - un don est recu (confirme par l'equipe, ou paye par carte) :
 *       remerciement et recapitulatif ;
 *     - une promesse de don est enregistree : ce qui se passe ensuite ;
 *     - un compte benevole ou bailleur est valide par l'equipe.
 *   A l'equipe (EQUIPE_EMAIL) :
 *     - un compte attend sa validation ;
 *     - une promesse de don attend d'etre confirmee a reception.
 *
 * Regles :
 *   - rien ici ne fait echouer l'action qui l'a declenche : un courriel
 *     rate est journalise, l'action reste faite ;
 *   - un compte d'utilisateur ne recoit de courriel que si son adresse est
 *     confirmee -- le courriel de confirmation le promet ("sans
 *     confirmation, l'adresse ne sera pas utilisee"). Une fiche donateur
 *     saisie par l'equipe, elle, porte une adresse donnee en personne.
 */
import { config } from '../config/env.js';
import { query } from '../config/database.js';
import * as courriel from './courriel.service.js';

const site = () => config.siteUrl.replace(/\/$/, '');

/** Un montant lisible : "150 000 Ar", "25,00 EUR". */
function montant(valeur, devise = 'MGA') {
  const nombre = Number(valeur ?? 0);
  // Les espaces fines du format francais deviennent des espaces simples,
  // lisibles par tous les logiciels de messagerie.
  const lisible = (texte) => texte.replace(/\s/g, ' ');
  if (devise === 'MGA') return `${lisible(Math.round(nombre).toLocaleString('fr-FR'))} Ar`;
  return `${lisible(nombre.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))} ${devise}`;
}

/** Lance l'envoi sans jamais lever. */
async function sansEchec(nom, travail) {
  try {
    await travail();
  } catch (erreur) {
    console.error(`[HOPE] Courriel automatique « ${nom} » non envoye :`, erreur.message);
  }
}

/**
 * Le destinataire d'un don : le compte du donateur (si son adresse est
 * confirmee), sinon l'adresse de la fiche saisie par l'equipe.
 */
async function destinataireDuDon(donationId) {
  const { rows } = await query(
    `SELECT d.id, d.reference, d.amount, d.currency, d.allocation, d.payment_method, d.status,
            d.received_at, d.created_at, p.name AS projet,
            o.email AS email_fiche, o.first_name AS prenom_fiche,
            u.email AS email_compte, u.prenom AS prenom_compte, u.email_verifie_le
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
    if (!don.email_verifie_le) return null;
    return { ...don, a: don.email_compte, prenom: don.prenom_compte || don.prenom_fiche, avecCompte: true };
  }
  return don.email_fiche ? { ...don, a: don.email_fiche, prenom: don.prenom_fiche, avecCompte: false } : null;
}

/** Un don est recu : merci, et le recapitulatif. */
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
      bouton: don.avecCompte ? { texte: 'Voir mes dons', lien: `${site()}/donateur/dons` } : null,
      note: 'Conservez ce courriel : il vaut accusé de réception de votre don.',
    });
  });
}

/** Une promesse de don est enregistree : la suite, et la reference. */
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
      bouton: don.avecCompte ? { texte: 'Suivre mon don', lien: `${site()}/donateur/dons` } : null,
      note: 'Vous n’êtes pas à l’origine de ce don ? Répondez à ce courriel ou écrivez à l’équipe HOPE.',
    });
  });
}

const ESPACES = {
  benevole: { nom: 'bénévole', chemin: '/benevole' },
  bailleur: { nom: 'bailleur', chemin: '/bailleur' },
  donateur: { nom: 'donateur', chemin: '/donateur' },
};

/** Un compte benevole ou bailleur est valide par l'equipe. */
export function compteValide(utilisateurId, type) {
  return sansEchec('compte valide', async () => {
    const { rows } = await query('SELECT email, prenom, email_verifie_le FROM utilisateur WHERE id = $1', [utilisateurId]);
    const compte = rows[0];
    if (!compte?.email || !compte.email_verifie_le) return;
    const espace = ESPACES[type] ?? ESPACES.benevole;
    await courriel.envoyer({
      a: compte.email,
      sujet: `HOPE — votre compte ${espace.nom} est validé`,
      titre: `Bienvenue${compte.prenom ? ` ${compte.prenom}` : ''} !`,
      paragraphes: [
        `L’équipe HOPE a validé votre compte ${espace.nom}. Votre espace est ouvert.`,
        type === 'benevole'
          ? 'Vous y trouverez les tâches à prendre près de chez vous, et celles qui vous sont confiées.'
          : 'Vous y suivez les projets que vous financez : avancement, dépenses, rapports.',
      ],
      bouton: { texte: 'Ouvrir mon espace', lien: `${site()}/authentification` },
    });
  });
}

/**
 * Une alerte a l'equipe (EQUIPE_EMAIL) : ce qui attend une action de sa
 * part. Rien si l'adresse n'est pas configuree.
 */
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

/** Un compte benevole ou bailleur attend la validation. */
export function compteAValider({ email, type }) {
  const espace = ESPACES[type]?.nom ?? type;
  return alerterEquipe(
    `un compte ${espace} attend sa validation`,
    [`${email} vient de s’inscrire comme ${espace}.`, 'Vérifiez sa fiche, puis validez ou refusez son accès.'],
    '/admin/utilisateurs'
  );
}

/** Une promesse de don attend d'etre confirmee a reception. */
export function promesseAConfirmer(donationId) {
  return sansEchec('alerte promesse', async () => {
    const { rows } = await query(
      `SELECT d.reference, d.amount, d.currency, d.payment_method, d.payment_reference,
              COALESCE(NULLIF(TRIM(CONCAT_WS(' ', o.first_name, o.last_name)), ''), o.organization_name) AS qui
         FROM donations d JOIN donors o ON o.id = d.donor_id WHERE d.id = $1`,
      [donationId]
    );
    const don = rows[0];
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
