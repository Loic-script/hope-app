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

function morceaux(valeur) {
  if (!valeur) return null;
  const texte = valeur instanceof Date ? valeur.toISOString() : String(valeur);
  const trouve = texte.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return trouve ? { annee: trouve[1], mois: trouve[2], jour: trouve[3] } : null;
}

function dateNue(valeur) {
  const m = morceaux(valeur);
  return m ? `${m.annee}-${m.mois}-${m.jour}` : null;
}

function dateFr(valeur) {
  const m = morceaux(valeur);
  return m ? `${m.jour}/${m.mois}/${m.annee}` : '';
}

function montant(valeur, devise = 'MGA') {
  const texte = Number(valeur ?? 0).toLocaleString('fr-FR', { maximumFractionDigits: 0 });
  return `${texte} ${devise === 'MGA' ? 'Ar' : devise}`;
}

function pourcent(taux) {
  return `${Number(taux ?? 0).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %`;
}

function nombre(valeur) {
  return Number(valeur ?? 0).toLocaleString('fr-FR', { maximumFractionDigits: 2 });
}

function pluriel(n, singulier, forme = `${singulier}s`) {
  return `${nombre(n)} ${Number(n) > 1 ? forme : singulier}`;
}

function libelleIndicateur(code, indicateurs) {
  const connu = indicateurs.find((i) => i.code === code);
  if (connu?.label) return connu.label;
  const texte = String(code ?? '').replace(/_/g, ' ').trim();
  return texte ? texte.charAt(0).toUpperCase() + texte.slice(1) : 'Indicateur';
}

function composer(apercu, bailleurs, indicateurs, aujourdhui) {
  const projet = apercu.project;
  const finance = apercu.finance;
  const devise = projet.currency ?? 'MGA';

  const periodeDebut = dateNue(projet.startDate);
  const periodeFin =
    projet.status === 'IN_PROGRESS' ? aujourdhui : (dateNue(projet.completedAt) ?? aujourdhui);

  const titre = `Rapport d’impact — ${projet.name}`;
  const sousTitre = [
    periodeDebut ? `Période du ${dateFr(periodeDebut)} au ${dateFr(periodeFin)}` : null,
    `Édité le ${dateFr(aujourdhui)}`,
    projet.reference ? `Projet ${projet.reference}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const blocs = [];

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
  const collectifs = (apercu.impacts ?? []).filter((i) => !i.beneficiaryId && i.title);
  for (const impact of collectifs.slice(0, 8)) {
    const valeur =
      impact.value != null ? ` — ${nombre(impact.value)}${impact.unit ? ` ${impact.unit}` : ''}` : '';
    blocs.push({ t: 'puce', texte: `${impact.title}${valeur}` });
  }
  if (!synthese.length && !collectifs.length) {
    blocs.push({ t: 'p', texte: 'Aucun résultat n’a encore été mesuré sur ce projet.' });
  }

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

export async function rapportDuJour(projetId) {
  const { rapport } = await charger(projetId);
  return rapport;
}

export async function pdf(projetId) {
  const { apercu, rapport } = await charger(projetId);
  const { contenu } = construirePdf(rapport);
  const date = new Date().toISOString().slice(0, 10);
  return {
    contenu,
    nomFichier: `rapport-impact-${apercu.project.reference ?? apercu.project.id}-${date}.pdf`,
  };
}

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

export async function publier(projetId, admin) {
  const { apercu, bailleurs, rapport, aujourdhui } = await charger(projetId);
  const projet = apercu.project;

  if (bailleurs.length === 0) {
    throw new ErreurRegleMetier(
      'Aucun bailleur ne finance ce projet : il n’y a personne à qui envoyer le rapport.',
      'AUCUN_BAILLEUR'
    );
  }

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
    await Promise.all(ecrits.map((chemin) => fs.rm(chemin, { force: true })));
    throw erreur;
  }
}
