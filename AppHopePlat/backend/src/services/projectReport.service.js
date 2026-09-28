/**
 * L'onglet Rapport de la fiche projet.
 *
 * Le rapport n'est pas redige a la main : il se compose a partir de ce
 * que l'equipe a deja saisi -- budget, dons, depenses, taches, impacts.
 * Il dit donc toujours l'etat present du projet, et deux rapports edites
 * le meme jour disent la meme chose.
 *
 * Il est destine aux partenaires. Deux regles en decoulent :
 *
 *   * aucune identite n'y figure. Ni beneficiaire (nom, date de
 *     naissance, notes), ni donateur : des totaux, des indicateurs, et
 *     les seuls impacts collectifs -- un impact rattache a une personne
 *     compte dans son indicateur, mais son intitule n'est pas repris ;
 *   * il a la forme exacte des rapports que le partenaire recoit deja :
 *     meme generateur de PDF, meme contenu structure pour la lecture en
 *     ligne.
 */
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

import { transaction } from '../config/database.js';
import { DOSSIER_MEDIAS, PREFIXE_MEDIAS } from '../middleware/upload.middleware.js';
import * as activityLogRepository from '../repositories/activityLog.repository.js';
import * as reportRepository from '../repositories/projectReport.repository.js';
import { ErreurIntrouvable, ErreurRegleMetier } from '../shared/errors.js';
import { construirePdf } from '../shared/pdfRapport.js';
import { recuperer as recupererCatalogue } from './catalog.service.js';
import { recupererApercu } from './project.service.js';

/* ================================================================
   Mise en forme
   ================================================================ */

/** "2026-09-17" ou une date -> ses trois morceaux, sans decalage de fuseau. */
function morceaux(valeur) {
  if (!valeur) return null;
  const texte = valeur instanceof Date ? valeur.toISOString() : String(valeur);
  const trouve = texte.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return trouve ? { annee: trouve[1], mois: trouve[2], jour: trouve[3] } : null;
}

/** "2026-09-17", quelle que soit la forme recue. */
function dateNue(valeur) {
  const m = morceaux(valeur);
  return m ? `${m.annee}-${m.mois}-${m.jour}` : null;
}

/** "17/09/2026" */
function dateFr(valeur) {
  const m = morceaux(valeur);
  return m ? `${m.jour}/${m.mois}/${m.annee}` : '';
}

/** "2 000 000 Ar" -- l'ariary n'a pas de centimes en usage courant. */
function montant(valeur, devise = 'MGA') {
  const texte = Number(valeur ?? 0).toLocaleString('fr-FR', { maximumFractionDigits: 0 });
  return `${texte} ${devise === 'MGA' ? 'Ar' : devise}`;
}

/** "92,5 %" */
function pourcent(taux) {
  return `${Number(taux ?? 0).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %`;
}

function nombre(valeur) {
  return Number(valeur ?? 0).toLocaleString('fr-FR', { maximumFractionDigits: 2 });
}

/** "3 dons", "1 don" */
function pluriel(n, singulier, forme = `${singulier}s`) {
  return `${nombre(n)} ${Number(n) > 1 ? forme : singulier}`;
}

/**
 * Le libelle d'un indicateur.
 *
 * Celui du catalogue quand il existe ; sinon le code rendu lisible, comme
 * l'affiche l'onglet Impact -- "people_trained" devient "People trained".
 */
function libelleIndicateur(code, indicateurs) {
  const connu = indicateurs.find((i) => i.code === code);
  if (connu?.label) return connu.label;
  const texte = String(code ?? '').replace(/_/g, ' ').trim();
  return texte ? texte.charAt(0).toUpperCase() + texte.slice(1) : 'Indicateur';
}

/* ================================================================
   Composition du rapport
   ================================================================ */

/**
 * Le rapport du jour, en blocs.
 *
 * @returns {{ titre: string, sousTitre: string, periodeDebut: string|null,
 *             periodeFin: string, blocs: Array }}
 */
function composer(apercu, bailleurs, indicateurs, aujourdhui) {
  const projet = apercu.project;
  const finance = apercu.finance;
  const devise = projet.currency ?? 'MGA';

  // Un projet termine s'arrete a sa date de fin, pas au jour d'edition.
  const periodeDebut = dateNue(projet.startDate);
  const periodeFin =
    projet.status === 'IN_PROGRESS' ? aujourdhui : (dateNue(projet.completedAt) ?? aujourdhui);

  // Le titre nomme le projet, sans date : celle-ci se lit juste dessous,
  // dans "Edite le ...", et la liste des rapports envoyes a la sienne.
  const titre = `Rapport d’impact — ${projet.name}`;
  const sousTitre = [
    periodeDebut ? `Période du ${dateFr(periodeDebut)} au ${dateFr(periodeFin)}` : null,
    `Édité le ${dateFr(aujourdhui)}`,
    projet.reference ? `Projet ${projet.reference}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const blocs = [];

  // ---------- Synthese ----------
  blocs.push({ t: 'h2', texte: 'Synthèse' });
  const presentation = [projet.descriptionTitre, projet.description]
    .map((texte) => String(texte ?? '').trim())
    .filter(Boolean)
    .join(' — ');
  blocs.push({
    t: 'p',
    texte:
      presentation ||
      `Projet ${projet.categoryName ? `« ${projet.categoryName} » ` : ''}mené` +
        `${projet.location ? ` à ${projet.location}` : ''} par HOPE.`,
  });
  if (projet.status === 'COMPLETED' || projet.status === 'ARCHIVED') {
    blocs.push({
      t: 'p',
      texte:
        `Le projet s’est achevé le ${dateFr(projet.completedAt)}.` +
        (projet.outcome ? ` ${String(projet.outcome).trim()}` : ''),
    });
  } else if (periodeDebut) {
    blocs.push({ t: 'p', texte: `Le projet est en cours depuis le ${dateFr(periodeDebut)}.` });
  }

  // ---------- Chiffres cles ----------
  const suivis = (apercu.beneficiaries ?? []).filter((b) => b.status !== 'WITHDRAWN').length;
  blocs.push({ t: 'h2', texte: 'Chiffres clés' });
  blocs.push({
    t: 'kv',
    lignes: [
      ['Budget nécessaire', montant(finance.requiredBudget, devise)],
      [
        'Somme investie',
        `${montant(finance.fundedTotal, devise)} (${pourcent(finance.fundingRate)} du besoin)`,
      ],
      [
        'Dépensé',
        `${montant(finance.spentTotal, devise)} (${pourcent(finance.spendingRate)} des fonds reçus)`,
      ],
      ['Fonds disponibles', montant(finance.availableFunds, devise)],
      [
        'Bénéficiaires accompagnés',
        projet.beneficiaryTarget
          ? `${nombre(suivis)} sur ${nombre(projet.beneficiaryTarget)} visés`
          : nombre(suivis),
      ],
      ...(projet.location ? [['Lieu', projet.location]] : []),
    ],
  });

  // ---------- Financement ----------
  // Des totaux par origine, jamais le nom d'un donateur.
  const affecteBailleurs = bailleurs.reduce((somme, b) => somme + Number(b.montantAffecte ?? 0), 0);
  const lignesFinancement = [];
  if (Number(projet.donationsCount ?? 0) > 0) {
    lignesFinancement.push([
      'Dons affectés au projet',
      `${montant(finance.designatedTotal, devise)} (${pluriel(projet.donationsCount, 'don')})`,
    ]);
  }
  if (Number(projet.investmentsCount ?? 0) > 0) {
    lignesFinancement.push(['Investissements de HOPE', montant(finance.investedHopeTotal, devise)]);
  }
  if (bailleurs.length > 0) {
    lignesFinancement.push([
      'Affecté par les partenaires',
      `${montant(affecteBailleurs, devise)} (${pluriel(bailleurs.length, 'partenaire')})`,
    ]);
  }
  blocs.push({ t: 'h2', texte: 'Financement' });
  blocs.push(
    lignesFinancement.length
      ? { t: 'kv', lignes: lignesFinancement }
      : { t: 'p', texte: 'Aucun financement n’est encore enregistré sur ce projet.' }
  );

  // ---------- Depenses par poste ----------
  const parPoste = new Map();
  for (const depense of apercu.expenses ?? []) {
    if (depense.status === 'CANCELLED') continue;
    const poste = depense.category || 'Autre';
    parPoste.set(poste, (parPoste.get(poste) ?? 0) + Number(depense.amount ?? 0));
  }
  blocs.push({ t: 'h2', texte: 'Dépenses par poste' });
  blocs.push(
    parPoste.size
      ? {
          t: 'kv',
          lignes: [...parPoste.entries()]
            .sort((a, b) => b[1] - a[1])
            .map(([poste, total]) => [poste, montant(total, devise)]),
        }
      : { t: 'p', texte: 'Aucune dépense n’est encore enregistrée.' }
  );

  // ---------- Resultats mesures ----------
  blocs.push({ t: 'h2', texte: 'Résultats mesurés' });
  const synthese = apercu.impactSummary ?? [];
  if (synthese.length) {
    blocs.push({
      t: 'kv',
      lignes: synthese.map((s) => [
        libelleIndicateur(s.indicator, indicateurs),
        `${nombre(s.total)}${s.unit ? ` ${s.unit}` : ''}`,
      ]),
    });
  }
  // Seuls les impacts collectifs sont nommes : l'intitule d'un impact
  // individuel peut designer la personne.
  const collectifs = (apercu.impacts ?? []).filter((i) => !i.beneficiaryId && i.title);
  for (const impact of collectifs.slice(0, 8)) {
    const valeur =
      impact.value != null ? ` — ${nombre(impact.value)}${impact.unit ? ` ${impact.unit}` : ''}` : '';
    blocs.push({ t: 'puce', texte: `${impact.title}${valeur}` });
  }
  if (!synthese.length && !collectifs.length) {
    blocs.push({ t: 'p', texte: 'Aucun résultat n’a encore été mesuré sur ce projet.' });
  }

  // ---------- Avancement ----------
  const taches = apercu.tasks ?? [];
  if (taches.length) {
    const compte = (statut) => taches.filter((t) => t.statut === statut).length;
    blocs.push({ t: 'h2', texte: 'Avancement des actions' });
    blocs.push({
      t: 'kv',
      lignes: [
        ['Actions réalisées', nombre(compte('livree'))],
        ['Actions en cours', nombre(compte('en_cours'))],
        ['Actions à venir', nombre(compte('a_faire'))],
      ],
    });
    for (const tache of taches.filter((t) => t.statut === 'livree').slice(0, 6)) {
      blocs.push({ t: 'puce', texte: `Réalisé : ${tache.titre}` });
    }
  }

  // ---------- Methode ----------
  blocs.push({ t: 'h2', texte: 'Méthode' });
  blocs.push({
    t: 'p',
    texte:
      'Ce rapport est établi à partir des données saisies par l’équipe HOPE à la date ' +
      'd’édition : budget, dons reçus, dépenses enregistrées, actions et résultats mesurés sur ' +
      'le terrain. Les bénéficiaires et les donateurs n’y sont jamais nommés.',
  });

  return { titre, sousTitre, periodeDebut, periodeFin, blocs };
}

/** Tout ce que le rapport assemble, lu une seule fois. */
async function charger(projetId) {
  const apercu = await recupererApercu(projetId);
  const [bailleurs, catalogue] = await Promise.all([
    reportRepository.bailleursDuProjet(apercu.project.id),
    recupererCatalogue(),
  ]);
  const aujourdhui = new Date().toISOString().slice(0, 10);
  const rapport = composer(apercu, bailleurs, catalogue.indicators ?? [], aujourdhui);
  return { apercu, bailleurs, rapport, aujourdhui };
}

/* ================================================================
   Operations
   ================================================================ */

/**
 * L'onglet : le rapport du jour, ses destinataires, et ce qui a deja
 * ete envoye -- avec, pour chaque envoi, s'il a ete lu.
 */
export async function recuperer(projetId) {
  const { apercu, bailleurs, rapport } = await charger(projetId);
  const publies = await reportRepository.rapportsPublies(apercu.project.id);
  return {
    rapport,
    bailleurs: bailleurs.map((b) => ({
      id: b.id,
      raisonSociale: b.raisonSociale,
      montantAffecte: b.montantAffecte,
    })),
    publies,
  };
}

/**
 * Le rapport du jour seul, sans destinataires ni envois : ce que lit un
 * partenaire depuis son espace. Ces deux listes nomment les autres
 * bailleurs du projet ; le rapport, lui, ne nomme personne.
 */
export async function rapportDuJour(projetId) {
  const { rapport } = await charger(projetId);
  return rapport;
}

/** Le rapport du jour en PDF, pour l'enregistrer ou l'imprimer. */
export async function pdf(projetId) {
  const { apercu, rapport } = await charger(projetId);
  const { contenu } = construirePdf(rapport);
  const date = new Date().toISOString().slice(0, 10);
  return {
    contenu,
    nomFichier: `rapport-impact-${apercu.project.reference ?? apercu.project.id}-${date}.pdf`,
  };
}

/** Le contenu d'un rapport deja publie, tel que le partenaire l'a recu. */
export async function contenuPublie(projetId, documentId) {
  if (!/^[0-9a-f-]{36}$/i.test(String(documentId ?? ''))) {
    throw new ErreurIntrouvable('Le rapport', documentId);
  }
  const document = await reportRepository.contenuPublie(Number(projetId), documentId);
  if (!document) throw new ErreurIntrouvable('Le rapport', documentId);
  return {
    id: document.id,
    titre: document.titre,
    bailleur: document.bailleur,
    publieLe: document.publieLe,
    sousTitre: document.contenu?.sousTitre ?? '',
    blocs: Array.isArray(document.contenu?.blocs) ? document.contenu.blocs : null,
  };
}

/**
 * Publie le rapport du jour chez chaque bailleur du projet.
 *
 * Un fichier par partenaire : chacun a son exemplaire, que l'on peut
 * retirer sans toucher a celui des autres. Un bailleur qui a deja recu
 * l'edition du jour n'en recoit pas une seconde -- un double clic ne
 * doit pas lui faire trouver deux fois le meme rapport.
 */
export async function publier(projetId, admin) {
  const { apercu, bailleurs, rapport, aujourdhui } = await charger(projetId);
  const projet = apercu.project;

  if (bailleurs.length === 0) {
    throw new ErreurRegleMetier(
      'Aucun bailleur ne finance ce projet : il n’y a personne à qui envoyer le rapport.',
      'AUCUN_BAILLEUR'
    );
  }

  // L'edition du jour se reconnait a sa date d'envoi : le titre, sans
  // date, est le meme d'un jour a l'autre.
  const deja = new Set(
    (await reportRepository.rapportsPublies(projet.id))
      .filter((d) => String(d.publieLe ?? '').slice(0, 10) === aujourdhui)
      .map((d) => d.bailleur)
  );
  const destinataires = bailleurs.filter((b) => !deja.has(b.raisonSociale));
  if (destinataires.length === 0) {
    throw new ErreurRegleMetier(
      'Le rapport du jour a déjà été envoyé à tous les bailleurs du projet.',
      'DEJA_PUBLIE'
    );
  }

  const { contenu: octets, pages } = construirePdf(rapport);
  await fs.mkdir(DOSSIER_MEDIAS, { recursive: true });

  const ecrits = [];
  try {
    const crees = await transaction(async (client) => {
      const lignes = [];
      for (const bailleur of destinataires) {
        const nom = `document-rapport_impact-${Date.now()}-${crypto.randomBytes(8).toString('hex')}.pdf`;
        const chemin = path.join(DOSSIER_MEDIAS, nom);
        await fs.writeFile(chemin, octets);
        ecrits.push(chemin);

        lignes.push(
          await reportRepository.publier(
            {
              bailleurId: bailleur.id,
              projetId: projet.id,
              titre: rapport.titre,
              periodeDebut: rapport.periodeDebut,
              periodeFin: rapport.periodeFin,
              fichierUrl: `${PREFIXE_MEDIAS}/${nom}`,
              nbPages: pages,
              publiePar: admin?.id ?? null,
              contenu: { sousTitre: rapport.sousTitre, blocs: rapport.blocs },
            },
            client
          )
        );
      }

      await activityLogRepository.deposer(
        admin,
        {
          action: 'PUBLISH',
          entityType: 'PROJECT',
          entityId: projet.id,
          label: `a envoyé le rapport d’impact de « ${projet.name} » à ${pluriel(lignes.length, 'bailleur')}`,
        },
        client
      );
      return lignes;
    });

    return {
      publies: crees.length,
      destinataires: destinataires.map((b) => b.raisonSociale),
      dejaServis: [...deja],
    };
  } catch (erreur) {
    // La base est revenue en arriere : les fichiers n'ont plus de ligne.
    await Promise.all(ecrits.map((chemin) => fs.rm(chemin, { force: true })));
    throw erreur;
  }
}
