import { useCallback, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';

import { IconePlus } from '../../components/admin/AdminIcons.jsx';
import { ModaleConfirmation } from '../../components/admin/forms.jsx';
import {
  BeneficiaireModale,
  DepenseModale,
  ImpactModale,
  TacheModale,
  InvestirModale,
  JustificatifModale,
  PreuveModale,
  RattachementModale,
  TerminerProjetModale,
} from '../../components/admin/modales.jsx';
import {
  Alerte,
  Badge,
  Chargement,
  EntetePage,
  EtatVide,
  LigneFiche,
  Onglets,
  Panneau,
  Progression,
  Tableau,
} from '../../components/admin/ui.jsx';
import OngletRapport from '../../components/admin/OngletRapport.jsx';
import VignettePreuve from '../../components/admin/VignettePreuve.jsx';
import { PhotoAgrandissable } from '../../components/VisionneuseImage.jsx';
import { urlMedia } from '../../services/api.js';
import { useChargement, useSoumission } from '../../hooks/useChargement.js';
import * as beneficiaryService from '../../services/beneficiary.service.js';
import * as catalogService from '../../services/catalog.service.js';
import * as documentService from '../../services/document.service.js';
import * as expenseService from '../../services/expense.service.js';
import { Carrousel } from '../../components/preuves/MediasPreuve.jsx';
import * as taskService from '../../services/task.service.js';
import FenetreTache from '../../components/admin/FenetreTache.jsx';
import { EquipeEnBref } from './TachesPage.jsx';
import * as fieldProofService from '../../services/fieldProof.service.js';
import * as fundService from '../../services/fund.service.js';
import * as impactService from '../../services/impact.service.js';
import * as projectService from '../../services/project.service.js';
import * as fmt from '../../utils/format.js';

/**
 * Fiche complete d'un projet : le centre du systeme.
 *
 * Un seul appel a /api/admin/projects/:id/overview alimente les six
 * onglets. Chaque action recharge cette vue pour que les totaux restent
 * coherents.
 */
/** Statut d'une tache, tel qu'il s'affiche. */
const STATUTS_TACHE = { a_faire: 'À faire', en_cours: 'En cours', livree: 'Livrée' };

/** Le financement d'un bailleur : son organisation, son engagement. */
const TYPES_ORGANISATION = {
  fondation_privee: 'Fondation privée',
  entreprise: 'Entreprise',
  agence_publique: 'Agence publique',
  ong: 'ONG',
  ambassade: 'Ambassade',
  autre: 'Organisation',
};
const TYPES_SOUTIEN = { financier: 'Financier', competences: 'Compétences', materiel: 'Matériel' };
const STATUTS_ENGAGEMENT = {
  en_cours: 'En cours',
  finalise: 'Finalisé',
  suspendu: 'Suspendu',
  annule: 'Annulé',
};
const COULEURS_ENGAGEMENT = { en_cours: 'bleu', finalise: 'vert', suspendu: 'ambre', annule: 'gris' };

export default function ProjectDetailPage() {
  const { id } = useParams();
  const [parametres, setParametres] = useSearchParams();
  const [ongletActif, setOngletActif] = useState(parametres.get('onglet') ?? 'general');

  const [modale, setModale] = useState({ nom: null, cible: null });
  // La preuve d'une tache livree, ouverte en grand.
  const [preuveTache, setPreuveTache] = useState(null);
  // La tache ouverte dans sa fenetre : equipe, demandes, preuve.
  const [tacheOuverte, setTacheOuverte] = useState(null);
  const ouvrir = (nom, cible = null) => setModale({ nom, cible });
  const fermer = () => setModale({ nom: null, cible: null });

  const { donnees, chargement, erreur, recharger } = useChargement(
    () => projectService.recupererApercu(id),
    [id]
  );
  const { donnees: catalogue } = useChargement(() => catalogService.recuperer(), []);
  /*
   * Les preuves ne viennent pas de l'apercu : celui-ci alimente les six
   * onglets d'un seul appel, et rien ne sert d'aller chercher des images
   * pour six visiteurs sur sept qui n'ouvriront jamais l'onglet Impact.
   */
  const { donnees: preuves, recharger: rechargerPreuves } = useChargement(
    () => fieldProofService.listerParProjet(id),
    [id]
  );
  const { donnees: fonds, recharger: rechargerFonds } = useChargement(() => fundService.etat(), []);
  const { donnees: tousBeneficiaires, recharger: rechargerBeneficiaires } = useChargement(
    () => beneficiaryService.lister({ status: 'ACTIVE' }),
    []
  );

  const { envoi, erreur: erreurAction, setErreur, soumettre } = useSoumission();

  const rechargerTout = useCallback(() => {
    recharger();
    rechargerFonds();
    rechargerBeneficiaires();
    rechargerPreuves();
    fermer();
  }, [recharger, rechargerFonds, rechargerBeneficiaires, rechargerPreuves]);

  function changerOnglet(cle) {
    setOngletActif(cle);
    setParametres({ ...Object.fromEntries(parametres.entries()), onglet: cle }, { replace: true });
  }

  const libelles = catalogue?.labels ?? {};
  const listePreuves = preuves?.items ?? [];
  // Meme mise en forme que l'ecran Impact : sans elle, le tableau affiche
  // "people_with_water_access" au lieu de "Personnes ayant acces a l'eau".
  const libelleIndicateur = (code) =>
    fmt.libelleIndicateur(code, catalogue?.indicators ?? []);
  const projet = donnees?.project;
  const finance = donnees?.finance;

  /*
   * Le tableau du budget : une ligne par categorie, prevu et reel.
   *
   * Les deux sources sont reunies ici plutot qu'en base : le devis dit ce
   * qui etait prevu, les depenses ce qui a eu lieu, et une categorie peut
   * n'exister que d'un cote. Une depense hors budget doit se voir -- c'est
   * meme le premier interet de la colonne.
   *
   * "prevu" vaut null, et non zero, quand la categorie ne figure pas au
   * devis : un zero laisserait croire a une enveloppe vide, alors qu'il
   * n'y avait pas d'enveloppe du tout.
   */
  const lignesBudget = useMemo(() => {
    const lignes = new Map();

    for (const poste of projet?.quoteItems ?? []) {
      const categorie = poste.category ?? '—';
      const prevu = Number(poste.amount ?? 0);
      const existante = lignes.get(categorie);
      // Deux postes de meme categorie ne peuvent plus etre saisis, mais
      // les devis d'avant en contiennent : on les additionne.
      lignes.set(categorie, {
        categorie,
        prevu: (existante?.prevu ?? 0) + prevu,
        reel: existante?.reel ?? 0,
      });
    }

    for (const depense of projet?.spendByCategory ?? []) {
      const categorie = depense.category ?? '—';
      const existante = lignes.get(categorie);
      lignes.set(categorie, {
        categorie,
        prevu: existante?.prevu ?? null,
        reel: Number(depense.amount ?? 0),
      });
    }

    return [...lignes.values()]
      .map((ligne) => ({
        ...ligne,
        // Le reste de l'enveloppe. Sans enveloppe, tout ce qui est sorti
        // est un depassement : le reste est alors negatif.
        reste: (ligne.prevu ?? 0) - ligne.reel,
        depasse: ligne.prevu !== null && ligne.reel > ligne.prevu,
      }))
      .sort((a, b) => a.categorie.localeCompare(b.categorie, 'fr'));
  }, [projet]);

  /**
   * Les trois totaux du budget.
   *
   * Sommes des lignes, et non des champs du projet : le budget
   * necessaire enregistre peut avoir ete saisi a la main, sans devis, et
   * ne couvrirait alors aucune des categories du tableau. Additionner ce
   * qu'on affiche garantit que la colonne et son total disent la meme
   * chose.
   */
  const totauxBudget = useMemo(() => {
    const prevu = lignesBudget.reduce((somme, l) => somme + (l.prevu ?? 0), 0);
    const reel = lignesBudget.reduce((somme, l) => somme + l.reel, 0);
    return { prevu, reel, reste: prevu - reel };
  }, [lignesBudget]);

  const beneficiairesDisponibles = useMemo(() => {
    const rattaches = new Set((donnees?.beneficiaries ?? []).map((b) => b.beneficiaryId));
    return (tousBeneficiaires?.items ?? []).filter((b) => !rattaches.has(b.id));
  }, [donnees, tousBeneficiaires]);

  async function rouvrir() {
    await soumettre(() => projectService.rouvrir(projet.id), { onSucces: rechargerTout });
  }
  async function archiver() {
    await soumettre(() => projectService.archiver(projet.id), { onSucces: rechargerTout });
  }
  /**
   * Confirme la reception d'un don en attente.
   *
   * Rien n'a ete preleve : la plateforme n'est reliee a aucun prestataire
   * de paiement. C'est l'administrateur qui atteste que l'argent est
   * arrive, et le don entre alors dans les totaux.
   */
  async function encaisser() {
    await soumettre(() => donationService.changerStatut(modale.cible.id, 'RECEIVED'), {
      onSucces: rechargerTout,
    });
  }
  async function annulerDepense() {
    await soumettre(() => expenseService.annuler(modale.cible.id), { onSucces: rechargerTout });
  }
  async function supprimerJustificatif() {
    await soumettre(() => documentService.supprimer(modale.cible.id), { onSucces: rechargerTout });
  }
  async function supprimerTache() {
    await soumettre(() => taskService.supprimer(modale.cible.id), { onSucces: rechargerTout });
  }
  async function supprimerImpact() {
    await soumettre(() => impactService.supprimer(modale.cible.id), { onSucces: rechargerTout });
  }
  async function supprimerPreuve() {
    await soumettre(() => fieldProofService.supprimer(modale.cible.id), { onSucces: rechargerTout });
  }
  async function ouvrirJustificatif(document) {
    setErreur('');
    await soumettre(() => documentService.ouvrir(document));
  }

  if (chargement && !donnees) return <Chargement texte="Chargement du projet…" />;
  if (erreur) return <Alerte>{erreur}</Alerte>;
  if (!projet) return null;

  const enCours = projet.status === 'IN_PROGRESS';
  const archive = projet.status === 'ARCHIVED';

  // Les financements des bailleurs, et leur total quand ils partagent
  // une meme devise : additionner ariary et euros ne voudrait rien dire.
  const affectationsBailleurs = donnees.funderAllocations ?? [];
  const devisesBailleurs = [...new Set(affectationsBailleurs.map((a) => a.devise))];
  const totalBailleurs = affectationsBailleurs.reduce((somme, a) => somme + Number(a.montant), 0);
  const nombreBailleurs = new Set(affectationsBailleurs.map((a) => a.bailleurId)).size;

  /*
   * Une mesure appartient a l'un des deux tableaux selon qu'elle nomme
   * un objectif. Le partage se fait ici, et non en base : c'est la meme
   * table, et une mesure passe de l'un a l'autre en changeant d'objectif.
   */
  const impactsGeneraux = donnees.impacts.filter((impact) => !impact.objectiveId);
  const impactsParObjectif = donnees.impacts.filter((impact) => impact.objectiveId);

  // Sans objectifs, il n'y a rien a mesurer objectif par objectif.
  const sansObjectifs = (projet.objectives?.length ?? 0) === 0;

  /**
   * Le nom d'une mesure, qui ouvre sa fenetre de modification -- d'ou
   * l'on peut aussi la supprimer. Il remplace la colonne d'actions : on
   * agit sur une mesure en la designant. Sur un projet archive, plus rien
   * ne se modifie : le nom reste un simple texte.
   */
  function nomMesure(impact, portee, className) {
    if (archive) return <strong className={className}>{impact.title}</strong>;
    return (
      <button
        type="button"
        className={`${className} nom-mesure`}
        onClick={() => ouvrir(portee === 'objectif' ? 'impactObjectif' : 'impactGeneral', impact)}
        title="Modifier ou supprimer"
      >
        {impact.title}
      </button>
    );
  }

  /**
   * Les mesures par objectif : toutes les colonnes centrees, et Modifier
   * / Supprimer en fin de ligne. Un projet archive ne se modifie plus :
   * la colonne des actions disparait avec lui.
   */
  const colonnesMesures = [
    {
      cle: 'title',
      titre: 'Impact',
      aligne: 'centre',
      rendu: (i) => (
        <div>
          <div className="table__principal">{i.title}</div>
          {i.description && (
            <div className="table__secondaire">{fmt.tronquer(i.description, 70)}</div>
          )}
        </div>
      ),
    },
    {
      cle: 'objectiveLabel',
      titre: 'Objectif',
      aligne: 'centre',
      rendu: (i) => <span className="table__principal">{i.objectiveLabel}</span>,
    },
    {
      cle: 'value',
      titre: 'Valeur',
      aligne: 'centre',
      rendu: (i) => (
        <strong>
          {fmt.nombre(i.value)} {i.unit ?? ''}
        </strong>
      ),
    },
    { cle: 'measuredAt', titre: 'Mesuré le', aligne: 'centre', rendu: (i) => fmt.date(i.measuredAt) },
    ...(archive
      ? []
      : [
          {
            cle: 'actions',
            titre: 'Actions',
            aligne: 'centre',
            rendu: (impact) => (
              <div className="cellule-actions cellule-actions--centre">
                <button
                  type="button"
                  className="lien-action"
                  onClick={() => ouvrir('impactObjectif', impact)}
                  aria-label={`Modifier la mesure ${impact.title}`}
                >
                  Modifier
                </button>
                <button
                  type="button"
                  className="lien-action lien-action--danger"
                  onClick={() => ouvrir('supprimerImpact', impact)}
                  aria-label={`Supprimer la mesure ${impact.title}`}
                >
                  Supprimer
                </button>
              </div>
            ),
          },
        ]),
  ];

  const ONGLETS = [
    { cle: 'general', label: 'Vue générale' },
    {
      cle: 'financement',
      label: 'Financement',
      compteur:
        donnees.donations.length + affectationsBailleurs.length + donnees.investments.length,
    },
    { cle: 'depenses', label: 'Dépenses', compteur: donnees.expenses.length },
    {
      // Les justificatifs ne sont plus un onglet : ils se rattachent a
      // une depense, et c'est en face d'elle qu'on les ajoute et qu'on
      // les ouvre, dans l'onglet Depenses.
      cle: 'taches',
      label: 'Tâches à faire',
      compteur: (donnees.tasks ?? []).length,
    },
    { cle: 'beneficiaires', label: 'Bénéficiaires', compteur: donnees.beneficiaries.length },
    { cle: 'impact', label: 'Impact', compteur: donnees.impacts.length },
    // Pas de compteur : les rapports envoyes ne viennent pas de la vue du
    // projet, et l'onglet ne les charge qu'a son ouverture.
    { cle: 'rapport', label: 'Rapport' },
  ];

  return (
    <>
      {/*
        La photo du projet, en couverture de sa fiche : on reconnait le
        projet avant d'en lire le nom, et elle reste en vue quel que soit
        l'onglet ouvert. Une photo s'agrandit d'un clic ; une video se
        regarde sur place. Sans media, pas de couverture : un cadre vide
        n'apprendrait rien.
      */}
      {projet.mediaUrl && (
        <div
          className={`couverture-projet${
            projet.mediaType === 'VIDEO' ? ' couverture-projet--video' : ''
          }`}
        >
          {projet.mediaType === 'VIDEO' ? (
            <video
              src={`${urlMedia(projet.mediaUrl)}#t=0.5`}
              controls
              playsInline
              preload="metadata"
              aria-label={`Vidéo du projet ${projet.name}`}
            />
          ) : (
            <PhotoAgrandissable
              src={urlMedia(projet.mediaUrl)}
              alt={projet.name}
              legende={projet.name}
            />
          )}
        </div>
      )}

      <EntetePage
        fil={[{ label: 'Projets', to: '/admin/projects' }, { label: projet.reference }]}
        titre={projet.name}
        accroche={projet.description ? fmt.tronquer(projet.description, 180) : undefined}
        actions={
          <>
            {enCours && (
              <>
                <Link className="btn btn--neutre" to={`/admin/projects/${projet.id}/edit`}>
                  Modifier
                </Link>
                <button
                  type="button"
                  className="btn btn--principal"
                  onClick={() => ouvrir('terminer')}
                >
                  Terminer le projet
                </button>
              </>
            )}
            {projet.status === 'COMPLETED' && (
              <>
                <button type="button" className="btn btn--neutre" onClick={rouvrir} disabled={envoi}>
                  Rouvrir
                </button>
                <button
                  type="button"
                  className="btn btn--principal"
                  onClick={() => ouvrir('archiver')}
                >
                  Archiver
                </button>
              </>
            )}
            {archive && (
              <button type="button" className="btn btn--neutre" onClick={rouvrir} disabled={envoi}>
                Rouvrir
              </button>
            )}
          </>
        }
      />

      {erreurAction && modale.nom === null && <Alerte>{erreurAction}</Alerte>}

      {projet.status === 'COMPLETED' && (
        <Alerte type="succes">
          Projet terminé le {fmt.date(projet.completedAt)}. Il apparaît désormais dans l’écran
          Impact.
        </Alerte>
      )}
      {archive && (
        <Alerte type="info">
          Projet archivé le {fmt.date(projet.archivedAt)}. Ses données restent consultables, mais
          plus aucune écriture n’est possible.
        </Alerte>
      )}

      {/* ---------- Bandeau financier ---------- */}
      <div className="resume-financier" style={{ margin: '18px 0' }}>
        <div className="resume-financier__bloc">
          <p className="resume-financier__libelle">Budget nécessaire</p>
          <p className="resume-financier__valeur">
            {fmt.montant(finance.requiredBudget, projet.currency)}
          </p>
          <p className="resume-financier__detail">
            {projet.beneficiaryTarget
              ? `${fmt.nombre(projet.beneficiaryTarget)} bénéficiaires visés`
              : 'Objectif de bénéficiaires non fixé'}
          </p>
        </div>
        <div className="resume-financier__bloc">
          <p className="resume-financier__libelle">Somme investie</p>
          <p className="resume-financier__valeur">
            {fmt.montant(finance.fundedTotal, projet.currency)}
          </p>
          <p className="resume-financier__detail">{fmt.pourcent(finance.fundingRate)} du besoin</p>
        </div>
        <div className="resume-financier__bloc">
          <p className="resume-financier__libelle">Dépensé</p>
          <p className="resume-financier__valeur">
            {fmt.montant(finance.spentTotal, projet.currency)}
          </p>
          <p className="resume-financier__detail">
            {fmt.pourcent(finance.spendingRate)} des fonds reçus
          </p>
        </div>
        <div className="resume-financier__bloc">
          <p className="resume-financier__libelle">Fonds disponibles</p>
          <p className="resume-financier__valeur">
            {fmt.montant(finance.availableFunds, projet.currency)}
          </p>
          <p className="resume-financier__detail">
            Besoin restant : {fmt.montant(finance.remainingNeed, projet.currency)}
          </p>
        </div>
      </div>

      <Onglets onglets={ONGLETS} actif={ongletActif} onChange={changerOnglet} />

      {/* ================= Vue generale ================= */}
      {ongletActif === 'general' && (
        <>
          <Panneau titre="Informations du projet">
            <dl className="fiche">
              <LigneFiche terme="Identifiant">{projet.reference}</LigneFiche>
              <LigneFiche terme="Type">
                <Badge
                  valeur={projet.projectType}
                  libelles={libelles.projectType}
                  couleur={projet.projectType === 'INTERNAL' ? 'violet' : 'bleu'}
                />
              </LigneFiche>
              <LigneFiche terme="Catégorie">{projet.categoryName}</LigneFiche>
              <LigneFiche terme="Statut">
                <Badge valeur={projet.status} libelles={libelles.projectStatus} />
              </LigneFiche>
              <LigneFiche terme="Localisation">{projet.location}</LigneFiche>
              <LigneFiche terme="Responsable">{projet.managerName}</LigneFiche>
              <LigneFiche terme="Début">{fmt.date(projet.startDate)}</LigneFiche>
              <LigneFiche terme="Fin">{fmt.date(projet.completedAt)}</LigneFiche>
              <LigneFiche terme="Public bénéficiaire">{projet.beneficiaryProfile}</LigneFiche>
              <LigneFiche terme="Bénéficiaires suivis">
                {fmt.nombre(projet.beneficiariesCount)}
                {projet.beneficiaryTarget ? ` sur ${fmt.nombre(projet.beneficiaryTarget)}` : ''}
              </LigneFiche>
            </dl>
          </Panneau>

          {(projet.description || projet.descriptionTitre) && (
            <Panneau titre="Description">
              {projet.descriptionTitre && (
                <p className="bloc-texte__titre">{projet.descriptionTitre}</p>
              )}
              {projet.description && <p className="bloc-texte">{projet.description}</p>}
            </Panneau>
          )}

          {/*
            Les objectifs specifiques, juste sous la description : elle
            dit ce qu'est le projet, eux ce qu'il doit avoir accompli. Le
            panneau se montre meme vide -- un projet sans objectif doit se
            voir, puisque l'impact se mesure objectif par objectif.
          */}
          <Panneau
            titre="Objectifs spécifiques"
            sousTitre={sansObjectifs ? undefined : `${projet.objectives.length} objectif(s)`}
          >
            {sansObjectifs ? (
              <EtatVide
                titre="Aucun objectif spécifique"
                texte="Précisez ce que le projet doit accomplir : l’impact se mesure ensuite objectif par objectif."
                action={
                  enCours && (
                    <Link className="btn btn--neutre" to={`/admin/projects/${projet.id}/edit`}>
                      Ajouter des objectifs
                    </Link>
                  )
                }
              />
            ) : (
              <ol className="objectifs">
                {projet.objectives.map((objectif) => (
                  <li className="objectifs__ligne" key={objectif.id}>
                    {objectif.label}
                  </li>
                ))}
              </ol>
            )}
          </Panneau>

          {/*
            Le budget, categorie par categorie : ce qui etait prevu, et ce
            qui a ete depense. Il n'apparait que s'il y a quelque chose a
            montrer -- un projet dont le montant a ete saisi directement,
            et ou rien n'a encore ete depense, n'a pas de tableau.
          */}
          {lignesBudget.length > 0 && (
            <Panneau
              titre="Budget"
              sousTitre={`${lignesBudget.length} catégorie(s) — le budget vient du devis, la dépense des écritures enregistrées`}
              serre
            >
              <Tableau
                lignes={lignesBudget}
                cleLigne={(ligne) => ligne.categorie}
                colonnes={[
                  { cle: 'categorie', titre: 'Catégorie' },
                  {
                    cle: 'prevu',
                    titre: 'Budget nécessaire',
                    aligne: 'droite',
                    rendu: (ligne) =>
                      ligne.prevu === null ? (
                        // Depense dans une categorie que le budget n'avait
                        // pas prevue : le tiret le dit, un zero laisserait
                        // croire a une enveloppe vide.
                        <span className="budget__hors">—</span>
                      ) : (
                        <strong>{fmt.montant(ligne.prevu, projet.currency)}</strong>
                      ),
                  },
                  {
                    cle: 'reel',
                    titre: 'Dépensé',
                    aligne: 'droite',
                    rendu: (ligne) => (
                      <span className={ligne.depasse ? 'budget__depasse' : undefined}>
                        {ligne.reel > 0 ? fmt.montant(ligne.reel, projet.currency) : '—'}
                      </span>
                    ),
                  },
                  {
                    // Ce qui reste de l'enveloppe. Negatif, c'est un
                    // depassement : la couleur le dit, et le signe aussi.
                    cle: 'reste',
                    titre: 'Reste',
                    aligne: 'droite',
                    rendu: (ligne) => (
                      <strong className={ligne.reste < 0 ? 'budget__depasse' : undefined}>
                        {fmt.montant(ligne.reste, projet.currency)}
                      </strong>
                    ),
                  },
                ]}
              />
              {/*
                Les trois totaux, dans l'ordre des colonnes : ce qu'il
                faut, ce qui est sorti, ce qui reste. Ce reste est celui du
                budget, et non de la tresorerie -- l'argent disponible est
                une autre affaire, et il a son propre panneau.
              */}
              <dl className="budget__totaux">
                <div>
                  <dt>Budget nécessaire</dt>
                  <dd>{fmt.montant(totauxBudget.prevu, projet.currency)}</dd>
                </div>
                <div>
                  <dt>Dépense totale</dt>
                  <dd>{fmt.montant(totauxBudget.reel, projet.currency)}</dd>
                </div>
                <div className={totauxBudget.reste < 0 ? 'budget__totaux--depasse' : undefined}>
                  <dt>Reste</dt>
                  <dd>{fmt.montant(totauxBudget.reste, projet.currency)}</dd>
                </div>
              </dl>
            </Panneau>
          )}

          {projet.outcome && (
            <Panneau titre="Résultat du projet">
              <p className="bloc-texte">{projet.outcome}</p>
            </Panneau>
          )}
        </>
      )}

      {/* ================= Financement ================= */}
      {ongletActif === 'financement' && (
        <>
          {/* Deux tableaux, deux origines : les dons des donateurs, puis
              les financements des bailleurs. */}
          <Panneau
            titre="Dons des donateurs"
            sousTitre={`${fmt.montant(finance.designatedTotal, projet.currency)} versés directement par des donateurs`}
            serre
          >
            <Tableau
              lignes={donnees.donations}
              colonnes={[
                {
                  cle: 'reference',
                  titre: 'Don',
                  rendu: (don) => (
                    <div>
                      <div className="table__principal">{don.reference}</div>
                      <div className="table__secondaire">{fmt.date(don.receivedAt)}</div>
                    </div>
                  ),
                },
                {
                  cle: 'donorName',
                  titre: 'Donateur',
                  rendu: (don) => (
                    <div>
                      <div>{don.donorName}</div>
                      <div className="table__secondaire">
                        {libelles.donorOrigin?.[don.donorOrigin] ?? don.donorOrigin}
                        {don.fromAccount ? ' · a un compte' : ''}
                      </div>
                    </div>
                  ),
                },
                {
                  cle: 'frequency',
                  titre: 'Fréquence',
                  rendu: (don) => (
                    <Badge
                      valeur={don.frequency}
                      libelles={libelles.donationFrequency}
                      couleur={don.frequency === 'MONTHLY' ? 'violet' : 'gris'}
                    />
                  ),
                },
                { cle: 'paymentMethod', titre: 'Paiement', rendu: (d) => d.paymentMethod ?? '—' },
                {
                  cle: 'amount',
                  titre: 'Montant',
                  aligne: 'droite',
                  rendu: (d) => <strong>{fmt.montant(d.amount, d.currency)}</strong>,
                },
                {
                  cle: 'status',
                  titre: 'Statut',
                  rendu: (d) => <Badge valeur={d.status} libelles={libelles.donationStatus} />,
                },
                {
                  cle: 'encaisser',
                  titre: '',
                  rendu: (don) =>
                    don.status === 'PENDING' ? (
                      <button
                        type="button"
                        className="lien-action"
                        onClick={() => ouvrir('encaisser', don)}
                      >
                        Encaisser
                      </button>
                    ) : null,
                },
              ]}
              vide={
                <EtatVide
                  titre="Aucun don affecté à ce projet"
                  texte="Les dons fléchés par les donateurs apparaîtront ici."
                />
              }
            />
          </Panneau>

          <Panneau
            titre="Financements des bailleurs"
            sousTitre={
              affectationsBailleurs.length === 0
                ? 'Engagements des bailleurs affectés à ce projet'
                : `${
                    devisesBailleurs.length === 1
                      ? fmt.montant(totalBailleurs, devisesBailleurs[0])
                      : `${affectationsBailleurs.length} financements`
                  } affectés par ${nombreBailleurs} bailleur${nombreBailleurs > 1 ? 's' : ''}`
            }
            serre
          >
            <Tableau
              lignes={affectationsBailleurs}
              colonnes={[
                {
                  cle: 'bailleurNom',
                  titre: 'Bailleur',
                  rendu: (a) => (
                    <div>
                      <div className="table__principal">{a.bailleurNom}</div>
                      <div className="table__secondaire">
                        {TYPES_ORGANISATION[a.typeOrganisation] ?? a.typeOrganisation}
                        {a.pays ? ` · ${a.pays}` : ''}
                      </div>
                    </div>
                  ),
                },
                {
                  cle: 'engagementIntitule',
                  titre: 'Engagement',
                  rendu: (a) => (
                    <div>
                      <div>{a.engagementIntitule}</div>
                      <div className="table__secondaire">
                        {a.referenceConvention
                          ? `Convention ${a.referenceConvention}`
                          : 'Sans référence de convention'}
                      </div>
                    </div>
                  ),
                },
                {
                  cle: 'typeSoutien',
                  titre: 'Soutien',
                  rendu: (a) => (
                    <Badge
                      valeur={a.typeSoutien}
                      libelles={TYPES_SOUTIEN}
                      couleur={a.typeSoutien === 'financier' ? 'gris' : 'violet'}
                    />
                  ),
                },
                {
                  cle: 'dateAffectation',
                  titre: 'Affecté le',
                  rendu: (a) => fmt.date(a.dateAffectation),
                },
                {
                  cle: 'montant',
                  titre: 'Montant',
                  aligne: 'droite',
                  rendu: (a) => <strong>{fmt.montant(a.montant, a.devise)}</strong>,
                },
                {
                  cle: 'engagementStatut',
                  titre: 'Statut',
                  rendu: (a) => (
                    <Badge
                      valeur={a.engagementStatut}
                      libelles={STATUTS_ENGAGEMENT}
                      couleur={COULEURS_ENGAGEMENT[a.engagementStatut]}
                    />
                  ),
                },
              ]}
              vide={
                <EtatVide
                  titre="Aucun bailleur ne finance ce projet"
                  texte="Les engagements des bailleurs affectés à ce projet apparaîtront ici."
                />
              }
            />
          </Panneau>

          <Panneau
            titre="Investissements du fonds HOPE"
            sousTitre={`${fmt.montant(finance.investedHopeTotal, projet.currency)} pris sur les dons non affectés`}
            actions={
              enCours && (
                <button
                  type="button"
                  className="btn btn--principal"
                  onClick={() => ouvrir('investir')}
                >
                  <IconePlus />
                  Investir dans ce projet
                </button>
              )
            }
            serre
          >
            <Tableau
              lignes={donnees.investments}
              colonnes={[
                { cle: 'reference', titre: 'Référence' },
                { cle: 'investedAt', titre: 'Date', rendu: (i) => fmt.date(i.investedAt) },
                {
                  cle: 'justification',
                  titre: 'Justification',
                  rendu: (i) => fmt.tronquer(i.justification, 90),
                },
                {
                  cle: 'amount',
                  titre: 'Montant',
                  aligne: 'droite',
                  rendu: (i) => <strong>{fmt.montant(i.amount, i.currency)}</strong>,
                },
              ]}
              vide={
                <EtatVide
                  titre="Aucun investissement du fonds HOPE"
                  texte={
                    enCours
                      ? `Il reste ${fmt.montant(finance.remainingNeed, projet.currency)} à financer sur ce projet.`
                      : 'Ce projet n’a pas été financé par le fonds HOPE.'
                  }
                  action={
                    enCours && (
                      <button
                        type="button"
                        className="btn btn--principal"
                        onClick={() => ouvrir('investir')}
                      >
                        <IconePlus />
                        Investir dans ce projet
                      </button>
                    )
                  }
                />
              }
            />
          </Panneau>
        </>
      )}

      {/* ================= Depenses ================= */}
      {ongletActif === 'depenses' && (
        <Panneau
          titre="Utilisation des fonds"
          sousTitre={`${fmt.montant(finance.spentTotal, projet.currency)} dépensés sur ${fmt.montant(
            finance.fundedTotal,
            projet.currency
          )} reçus`}
          actions={
            enCours && (
              <button
                type="button"
                className="btn btn--principal"
                onClick={() => ouvrir('depense')}
              >
                <IconePlus />
                Enregistrer une dépense
              </button>
            )
          }
          serre
        >
          <Tableau
            lignes={donnees.expenses}
            colonnes={[
              { cle: 'expenseDate', titre: 'Date', rendu: (d) => fmt.date(d.expenseDate) },
              {
                cle: 'description',
                titre: 'Description',
                rendu: (d) => (
                  <div>
                    <div className="table__principal">{fmt.tronquer(d.description, 60)}</div>
                    {d.supplier && <div className="table__secondaire">{d.supplier}</div>}
                  </div>
                ),
              },
              {
                // Sortie de la ligne secondaire de la description, ou elle
                // se lisait mal : c'est elle qui rapproche la depense du
                // budget, elle merite sa colonne.
                cle: 'category',
                titre: 'Catégorie',
                rendu: (d) =>
                  d.category ?? <span className="budget__hors">Non classée</span>,
              },
              {
                cle: 'amount',
                titre: 'Montant',
                aligne: 'droite',
                rendu: (d) => fmt.montant(d.amount, d.currency),
              },
              {
                cle: 'status',
                titre: 'Statut',
                rendu: (d) => <Badge valeur={d.status} libelles={libelles.expenseStatus} />,
              },
              {
                cle: 'documentsCount',
                titre: 'Justificatif',
                rendu: (d) =>
                  d.documentsCount > 0 ? (
                    <Badge
                      valeur="OUI"
                      couleur="vert"
                      libelles={{ OUI: `${d.documentsCount} pièce(s)` }}
                    />
                  ) : (
                    <Badge valeur="NON" couleur="ambre" libelles={{ NON: 'Manquant' }} />
                  ),
              },
              {
                cle: 'actions',
                titre: 'Actions',
                aligne: 'droite',
                rendu: (depense) =>
                  archive ? null : (
                    <div className="cellule-actions">
                      <button
                        type="button"
                        className="lien-action"
                        onClick={() => ouvrir('justificatif', depense)}
                      >
                        Justifier
                      </button>
                      {enCours && depense.status !== 'CANCELLED' && (
                        <>
                          <button
                            type="button"
                            className="lien-action"
                            onClick={() => ouvrir('depense', depense)}
                          >
                            Modifier
                          </button>
                          <button
                            type="button"
                            className="lien-action lien-action--danger"
                            onClick={() => ouvrir('annulerDepense', depense)}
                          >
                            Annuler
                          </button>
                        </>
                      )}
                    </div>
                  ),
              },
            ]}
            vide={
              <EtatVide
                titre="Aucune dépense enregistrée"
                texte={`Les dépenses sont plafonnées par les fonds reçus : ${fmt.montant(
                  finance.availableFunds,
                  projet.currency
                )} disponibles.`}
                action={
                  enCours && (
                    <button
                      type="button"
                      className="btn btn--principal"
                      onClick={() => ouvrir('depense')}
                    >
                      <IconePlus />
                      Enregistrer une dépense
                    </button>
                  )
                }
              />
            }
          />
        </Panneau>
      )}

      {/* ================= Justificatifs ================= */}
      {/* ================= Taches ================= */}
      {ongletActif === 'taches' && (
        <Panneau
          titre="Tâches à faire"
          sousTitre="Ce que les bénévoles prennent en charge sur ce projet. Cliquez une tâche pour voir son équipe et les demandes."
          serre
          actions={
            !archive &&
            enCours && (
              <button
                type="button"
                className="btn btn--principal btn--petit"
                onClick={() => ouvrir('tache')}
              >
                <IconePlus />
                Ajouter une tâche
              </button>
            )
          }
        >
          <Tableau
            lignes={donnees.tasks ?? []}
            // Un clic sur la tache ouvre sa fenetre.
            onLigne={(tache) => setTacheOuverte(tache.id)}
            colonnes={[
              {
                cle: 'titre',
                titre: 'Tâche',
                rendu: (tache) => (
                  <div>
                    <button
                      type="button"
                      className="table__principal lien-tache"
                      onClick={() => setTacheOuverte(tache.id)}
                      aria-haspopup="dialog"
                    >
                      {tache.titre}
                    </button>
                    {tache.description && (
                      <div className="table__secondaire">
                        {fmt.tronquer(tache.description, 80)}
                      </div>
                    )}
                  </div>
                ),
              },
              {
                cle: 'echeance',
                titre: 'Date de fin',
                rendu: (tache) =>
                  tache.echeance ? (
                    fmt.date(tache.echeance)
                  ) : (
                    <span className="budget__hors">—</span>
                  ),
              },
              {
                cle: 'statut',
                titre: 'Statut',
                rendu: (tache) => (
                  <Badge valeur={tache.statut} libelles={STATUTS_TACHE} couleur={
                    { a_faire: 'ambre', en_cours: 'violet', livree: 'vert' }[tache.statut]
                  } />
                ),
              },
              {
                // Qui y travaille : une tache se confie a une equipe.
                cle: 'equipe',
                titre: 'Équipe',
                rendu: (tache) => <EquipeEnBref equipe={tache.equipe} />,
              },
              {
                // Les benevoles qui demandent a la prendre ou a la
                // rejoindre : c'est a l'equipe de trancher.
                cle: 'demandes',
                titre: 'Demandes',
                rendu: (tache) =>
                  tache.demandes?.length > 0 ? (
                    <Badge
                      valeur="demandes"
                      libelles={{ demandes: `${tache.demandes.length} à valider` }}
                      couleur="ambre"
                    />
                  ) : (
                    <span className="budget__hors">—</span>
                  ),
              },
              {
                // La preuve jointe a la livraison : c'est sur elle que
                // l'equipe juge qu'une tache est vraiment faite.
                cle: 'files',
                titre: 'Preuve',
                rendu: (tache) =>
                  tache.files?.length > 0 ? (
                    <button
                      type="button"
                      className="lien-action"
                      onClick={() => setPreuveTache({ tache, rang: 0 })}
                    >
                      Voir ({tache.files.length})
                    </button>
                  ) : (
                    <span className="budget__hors">—</span>
                  ),
              },
              {
                cle: 'actions',
                titre: 'Actions',
                aligne: 'droite',
                rendu: (tache) =>
                  archive || tache.equipe?.length > 0 ? null : (
                    <button
                      type="button"
                      className="lien-action lien-action--danger"
                      onClick={() => ouvrir('supprimerTache', tache)}
                    >
                      Supprimer
                    </button>
                  ),
              },
            ]}
            vide={
              <EtatVide
                titre="Aucune tâche"
                texte="Ajoutez-en une : elle apparaîtra aussitôt dans l’espace bénévole. Affectez-y des bénévoles, ou validez leurs demandes."
              />
            }
          />
        </Panneau>
      )}

      {tacheOuverte && (
        <FenetreTache
          tacheId={tacheOuverte}
          onFermer={() => setTacheOuverte(null)}
          onChange={rechargerTout}
        />
      )}

      {/* ================= Beneficiaires ================= */}
      {ongletActif === 'beneficiaires' && (
        <Panneau
          titre="Qui a été aidé"
          sousTitre="Informations confidentielles, réservées à l’équipe HOPE."
          actions={
            !archive && (
              <>
                <button
                  type="button"
                  className="btn btn--neutre"
                  onClick={() => ouvrir('rattachement')}
                >
                  Rattacher
                </button>
                <button
                  type="button"
                  className="btn btn--principal"
                  onClick={() => ouvrir('beneficiaire')}
                >
                  <IconePlus />
                  Nouveau bénéficiaire
                </button>
              </>
            )
          }
          serre
        >
          <Tableau
            lignes={donnees.beneficiaries}
            colonnes={[
              {
                cle: 'fullName',
                titre: 'Bénéficiaire',
                rendu: (b) => (
                  <div>
                    <div className="table__principal">{b.fullName}</div>
                    <div className="table__secondaire">
                      {b.age !== null && b.age !== undefined ? `${b.age} ans` : 'Âge non renseigné'}
                      {b.city ? ` · ${b.city}` : ''}
                    </div>
                  </div>
                ),
              },
              {
                cle: 'beneficiaryType',
                titre: 'Type',
                rendu: (b) => (
                  <Badge
                    valeur={b.beneficiaryType}
                    libelles={libelles.beneficiaryType}
                    couleur="violet"
                  />
                ),
              },
              { cle: 'joinedAt', titre: 'Entrée', rendu: (b) => fmt.date(b.joinedAt) },
              {
                cle: 'status',
                titre: 'Suivi',
                rendu: (b) => <Badge valeur={b.status} libelles={libelles.membershipStatus} />,
              },
              { cle: 'notes', titre: 'Notes', rendu: (b) => fmt.tronquer(b.notes, 50) || '—' },
            ]}
            vide={
              <EtatVide
                titre="Aucun bénéficiaire rattaché"
                texte={
                  projet.beneficiaryProfile
                    ? `Public visé : ${projet.beneficiaryProfile}.`
                    : 'Nommez les personnes que ce projet a aidées.'
                }
                action={
                  !archive && (
                    <button
                      type="button"
                      className="btn btn--principal"
                      onClick={() => ouvrir('beneficiaire')}
                    >
                      <IconePlus />
                      Nouveau bénéficiaire
                    </button>
                  )
                }
              />
            }
          />
        </Panneau>
      )}

      {/* ================= Impact ================= */}
      {ongletActif === 'impact' && (
        <>
          {/*
            Les totaux, en tete : ils additionnent tout ce qui a ete
            mesure, general et par objectif. C'est un resume, pas une
            liste -- les deux tableaux qui suivent, eux, s'editent.
          */}
          {donnees.impactSummary.length > 0 && (
            <div className="cartes-chiffres">
              {donnees.impactSummary.map((ligne) => (
                <div className="carte-chiffre" key={`${ligne.indicator}|${ligne.unit ?? ''}`}>
                  <div>
                    <p className="carte-chiffre__libelle">{libelleIndicateur(ligne.indicator)}</p>
                    <p className="carte-chiffre__variation">
                      {fmt.nombre(ligne.entriesCount)} mesure(s)
                    </p>
                  </div>
                  <p className="carte-chiffre__valeur">
                    {fmt.nombre(ligne.total)} {ligne.unit ?? ''}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/*
            Deux tableaux, deux questions. Celui-ci porte ce que le projet
            a produit dans son ensemble -- ce que sa description annonce.
            Celui du dessous detaille objectif par objectif. Une mesure
            appartient a l'un ou a l'autre selon qu'elle nomme un
            objectif, et se modifie des deux cotes de la meme facon.
          */}
          <Panneau
            titre="Impact général du projet"
            sousTitre={
              impactsGeneraux.length > 0 && !archive
                ? 'Ce que le projet a produit dans son ensemble. Cliquez sur un impact pour le modifier.'
                : 'Ce que le projet a produit dans son ensemble, sans se rattacher à un objectif précis'
            }
            actions={
              !archive && (
                <button
                  type="button"
                  className="btn btn--principal"
                  onClick={() => ouvrir('impactGeneral')}
                >
                  <IconePlus />
                  Ajouter un impact général
                </button>
              )
            }
          >
            {/*
              Un texte, et non un tableau : une phrase par impact, qui se
              lit comme un compte rendu. "Habitants desservis en eau
              potable : 400 personnes, mesure le 17/08/2026."
            */}
            {impactsGeneraux.length > 0 ? (
              <div className="impact-texte">
                {impactsGeneraux.map((impact) => (
                  <p className="impact-texte__paragraphe" key={impact.id}>
                    {nomMesure(impact, 'general', 'impact-texte__titre')}
                    {' : '}
                    <strong className="impact-texte__valeur">
                      {fmt.nombre(impact.value)}
                      {impact.unit ? ` ${impact.unit}` : ''}
                    </strong>
                    {impact.beneficiaryName ? ` pour ${impact.beneficiaryName}` : ''}
                    <span className="impact-texte__date">
                      , mesuré le {fmt.date(impact.measuredAt)}.
                    </span>
                    {impact.description && ` ${impact.description}`}
                  </p>
                ))}
              </div>
            ) : (
                <EtatVide
                  titre="Aucun impact général"
                  texte="Chiffrez ce que le projet a permis de changer dans son ensemble : personnes aidées, matériel distribué, services rendus."
                  action={
                    !archive && (
                      <button
                        type="button"
                        className="btn btn--principal"
                        onClick={() => ouvrir('impactGeneral')}
                      >
                        <IconePlus />
                        Ajouter un impact général
                      </button>
                    )
                  }
                />
            )}
          </Panneau>

          <Panneau
            titre="Mesures par objectif"
            sousTitre="Chaque mesure enregistrée, et l’objectif spécifique qu’elle documente"
            actions={
              /* Un projet sans objectifs n'a rien a mesurer ici. Le
                 bouton reste en place -- le faire disparaitre laisse
                 chercher -- mais inactif, et il dit pourquoi. */
              !archive && (
                <button
                  type="button"
                  className="btn btn--principal"
                  onClick={() => ouvrir('impactObjectif')}
                  disabled={sansObjectifs}
                  title={
                    sansObjectifs
                      ? 'Ce projet n’a pas encore d’objectifs spécifiques : ajoutez-en depuis « Modifier le projet ».'
                      : undefined
                  }
                >
                  <IconePlus />
                  Ajouter une mesure
                </button>
              )
            }
            serre
          >
            <Tableau
              lignes={impactsParObjectif}
              colonnes={colonnesMesures}
              vide={
                <EtatVide
                  titre="Aucune mesure par objectif"
                  texte={
                    sansObjectifs
                      ? 'Ce projet n’a pas encore d’objectifs spécifiques : ce sont eux que les mesures documentent.'
                      : 'Rattachez une mesure à l’un des objectifs du projet pour suivre ce que chacun a produit.'
                  }
                  action={
                    archive ? null : sansObjectifs ? (
                      // La suite est ailleurs : autant y mener.
                      <Link className="btn btn--principal" to={`/admin/projects/${projet.id}/edit`}>
                        Ajouter des objectifs
                      </Link>
                    ) : (
                      <button
                        type="button"
                        className="btn btn--principal"
                        onClick={() => ouvrir('impactObjectif')}
                      >
                        <IconePlus />
                        Ajouter une mesure
                      </button>
                    )
                  }
                />
              }
            />
          </Panneau>

          {/*
            Les preuves ferment l'onglet, apres les chiffres : un impact
            dit COMBIEN, une preuve montre QUE c'est arrive. L'ordre suit
            la lecture -- le total, puis le detail, puis ce qui l'atteste.

            A ne pas confondre avec les justificatifs de l'onglet du meme
            nom : ceux-la prouvent une depense, ceux-ci une action.
          */}
          <Panneau
            titre="Preuves terrain"
            sousTitre="Une photo et deux lignes suffisent — c’est ce que verra le donateur."
            actions={
              !archive && (
                <button
                  type="button"
                  className="btn btn--principal"
                  onClick={() => ouvrir('preuve')}
                >
                  <IconePlus />
                  Ajouter une preuve
                </button>
              )
            }
          >
            {listePreuves.length === 0 ? (
              <EtatVide
                titre="Aucune preuve pour ce projet"
                texte="Publiez la première : c’est elle qui montrera au donateur ce que son don a permis."
                action={
                  !archive && (
                    <button
                      type="button"
                      className="btn btn--principal"
                      onClick={() => ouvrir('preuve')}
                    >
                      <IconePlus />
                      Ajouter une preuve
                    </button>
                  )
                }
              />
            ) : (
              <ul className="preuves">
                {listePreuves.map((preuve) => (
                  <li className="preuve preuve--cliquable" key={preuve.id}>
                    <VignettePreuve preuve={preuve} />

                    <div className="preuve__corps">
                      <p className="preuve__projet">
                        <Badge valeur={preuve.proofType} libelles={libelles.proofType ?? {}} />
                      </p>
                      <p className="preuve__description">
                        <Link className="preuve__lien" to={`/admin/proofs/${preuve.id}`}>
                          {preuve.description}
                        </Link>
                      </p>
                      <p className="preuve__signature">
                        {fmt.date(preuve.occurredOn)} · ajouté par{' '}
                        {fmt.auteurPreuve(preuve)}
                      </p>
                    </div>

                    {!archive && (
                      <button
                        type="button"
                        className="btn btn--neutre btn--petit preuve__action"
                        onClick={() => ouvrir('supprimerPreuve', preuve)}
                      >
                        Supprimer
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Panneau>
        </>
      )}

      {/* ================= Rapport ================= */}
      {ongletActif === 'rapport' && <OngletRapport projet={projet} />}

      {/* ================= Modales ================= */}
      <InvestirModale
        ouverte={modale.nom === 'investir'}
        projetVerrouille={{ ...projet, remainingNeed: finance.remainingNeed }}
        disponible={fonds?.summary?.availableTotal ?? '0'}
        onFermer={fermer}
        onEnregistre={rechargerTout}
      />

      <DepenseModale
        ouverte={modale.nom === 'depense'}
        projet={{ ...projet, availableFunds: finance.availableFunds }}
        depense={modale.cible}
        categories={catalogue?.expenseCategories ?? []}
        onFermer={fermer}
        onEnregistre={rechargerTout}
      />

      <JustificatifModale
        ouverte={modale.nom === 'justificatif'}
        depense={modale.cible}
        depenses={donnees.expenses}
        libelles={libelles}
        onFermer={fermer}
        onEnregistre={rechargerTout}
      />

      <PreuveModale
        ouverte={modale.nom === 'preuve'}
        projet={projet}
        libelles={libelles.proofType ?? {}}
        onFermer={fermer}
        onEnregistre={rechargerTout}
      />

      <BeneficiaireModale
        ouverte={modale.nom === 'beneficiaire'}
        projet={projet}
        libelles={libelles}
        onFermer={fermer}
        onEnregistre={rechargerTout}
      />

      <RattachementModale
        ouverte={modale.nom === 'rattachement'}
        projet={projet}
        beneficiaires={beneficiairesDisponibles}
        onFermer={fermer}
        onEnregistre={rechargerTout}
      />

      {preuveTache && (
        <Carrousel
          preuve={{ ...preuveTache.tache, description: preuveTache.tache.titre }}
          charger={taskService.urlDuFichier}
          rang={preuveTache.rang}
          onRang={(rang) => setPreuveTache((actuel) => ({ ...actuel, rang }))}
          onFermer={() => setPreuveTache(null)}
        />
      )}

      {/* Une seule fenetre pour les deux tableaux : ce qui change est la
          portee de la mesure -- le projet entier, ou un objectif. */}
      <ImpactModale
        ouverte={modale.nom === 'impactGeneral' || modale.nom === 'impactObjectif'}
        portee={modale.nom === 'impactObjectif' ? 'objectif' : 'general'}
        projet={projet}
        impact={modale.cible}
        indicateurs={catalogue?.indicators ?? []}
        objectifs={projet.objectives ?? []}
        beneficiaires={donnees.beneficiaries}
        onFermer={fermer}
        onEnregistre={rechargerTout}
        // Supprimer se demande depuis la fenetre : la confirmation prend
        // sa place.
        onSupprimer={(impact) => ouvrir('supprimerImpact', impact)}
      />

      <TacheModale
        ouverte={modale.nom === 'tache'}
        projet={projet}
        onFermer={fermer}
        onEnregistre={rechargerTout}
      />

      <TerminerProjetModale
        ouverte={modale.nom === 'terminer'}
        projet={projet}
        onFermer={fermer}
        onEnregistre={rechargerTout}
      />

      <ModaleConfirmation
        ouverte={modale.nom === 'encaisser'}
        titre="Marquer ce don comme reçu ?"
        message={
          modale.cible
            ? `${modale.cible.reference} — ${fmt.montant(modale.cible.amount, modale.cible.currency)} de ${modale.cible.donorName}. Il comptera alors dans les fonds du projet.`
            : ''
        }
        onFermer={fermer}
        onConfirmer={encaisser}
        envoi={envoi}
        erreur={erreurAction}
        libelleConfirmer="Marquer comme reçu"
      />

      <ModaleConfirmation
        ouverte={modale.nom === 'archiver'}
        titre="Archiver ce projet ?"
        message="Il sortira des listes courantes. Ses données restent consultables depuis l’écran Impact, mais plus aucune écriture ne sera possible."
        onFermer={fermer}
        onConfirmer={archiver}
        envoi={envoi}
        erreur={erreurAction}
        libelleConfirmer="Archiver"
      />

      <ModaleConfirmation
        ouverte={modale.nom === 'annulerDepense'}
        titre="Annuler cette dépense ?"
        message="Son montant retournera aux fonds disponibles du projet. La dépense reste visible dans l’historique."
        onFermer={fermer}
        onConfirmer={annulerDepense}
        envoi={envoi}
        erreur={erreurAction}
        libelleConfirmer="Annuler la dépense"
        danger
      />

      <ModaleConfirmation
        ouverte={modale.nom === 'supprimerTache'}
        titre="Supprimer cette tâche ?"
        message={
          modale.cible
            ? `« ${modale.cible.titre} » disparaîtra de l’espace bénévole. Personne ne l’a prise, rien ne sera perdu.`
            : ''
        }
        onFermer={fermer}
        onConfirmer={supprimerTache}
        envoi={envoi}
        erreur={erreurAction}
        libelleConfirmer="Supprimer"
        danger
      />

      <ModaleConfirmation
        ouverte={modale.nom === 'supprimerDocument'}
        titre="Supprimer ce justificatif ?"
        message="Le fichier sera définitivement effacé du serveur. La dépense, elle, est conservée."
        onFermer={fermer}
        onConfirmer={supprimerJustificatif}
        envoi={envoi}
        erreur={erreurAction}
        libelleConfirmer="Supprimer"
        danger
      />

      <ModaleConfirmation
        ouverte={modale.nom === 'supprimerPreuve'}
        titre="Supprimer cette preuve ?"
        message={
          modale.cible
            ? `« ${fmt.tronquer(modale.cible.description, 90)} » sera retirée, ainsi que son fichier.`
            : ''
        }
        onFermer={fermer}
        onConfirmer={supprimerPreuve}
        envoi={envoi}
        erreur={erreurAction}
        libelleValider="Supprimer"
        libelleConfirmer="Supprimer"
        danger
      />

      <ModaleConfirmation
        ouverte={modale.nom === 'supprimerImpact'}
        titre="Supprimer cet impact ?"
        message="Cette mesure sera retirée du suivi du projet."
        onFermer={fermer}
        onConfirmer={supprimerImpact}
        envoi={envoi}
        erreur={erreurAction}
        libelleConfirmer="Supprimer"
        danger
      />
    </>
  );
}
