import { useCallback, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { IconePlus } from '../../components/admin/AdminIcons.jsx';
import { ModaleConfirmation } from '../../components/admin/forms.jsx';
import ModaleSuppressionForcee from '../../components/admin/ModaleSuppressionForcee.jsx';
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
  Tableau,
} from '../../components/admin/ui.jsx';
import OngletRapport from '../../components/admin/OngletRapport.jsx';
import VignettePreuve from '../../components/admin/VignettePreuve.jsx';
import { PhotoAgrandissable } from '../../components/VisionneuseImage.jsx';
import { messageErreur, urlMedia } from '../../services/api.js';
import { useChargement, useSoumission } from '../../hooks/useChargement.js';
import * as beneficiaryService from '../../services/beneficiary.service.js';
import * as catalogService from '../../services/catalog.service.js';
import * as documentService from '../../services/document.service.js';
import * as donationService from '../../services/donation.service.js';
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

const STATUTS_TACHE = { a_faire: 'À faire', en_cours: 'En cours', livree: 'Livrée' };

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
  const navigate = useNavigate();
  const { id } = useParams();
  const [parametres, setParametres] = useSearchParams();
  const [ongletActif, setOngletActif] = useState(parametres.get('onglet') ?? 'general');

  const [modale, setModale] = useState({ nom: null, cible: null });
  const [retenu, setRetenu] = useState(null);
  const [preuveTache, setPreuveTache] = useState(null);
  const [tacheOuverte, setTacheOuverte] = useState(null);
  const ouvrir = (nom, cible = null) => setModale({ nom, cible });
  const fermer = () => setModale({ nom: null, cible: null });

  const { donnees, chargement, erreur, recharger } = useChargement(
    () => projectService.recupererApercu(id),
    [id]
  );
  const { donnees: catalogue } = useChargement(() => catalogService.recuperer(), []);
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
  const libelleIndicateur = (code) =>
    fmt.libelleIndicateur(code, catalogue?.indicators ?? []);
  const projet = donnees?.project;
  const finance = donnees?.finance;

  const lignesBudget = useMemo(() => {
    const lignes = new Map();

    for (const poste of projet?.quoteItems ?? []) {
      const categorie = poste.category ?? '—';
      const prevu = Number(poste.amount ?? 0);
      const existante = lignes.get(categorie);
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
        reste: (ligne.prevu ?? 0) - ligne.reel,
        depasse: ligne.prevu !== null && ligne.reel > ligne.prevu,
      }))
      .sort((a, b) => a.categorie.localeCompare(b.categorie, 'fr'));
  }, [projet]);

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
  async function supprimerProjet() {
    try {
      await projectService.supprimer(projet.id);
      navigate('/admin/projects', { replace: true });
    } catch (echec) {
      const donnees = echec?.response?.data;
      if (donnees?.code === 'PROJET_AVEC_ECRITURES') {
        setRetenu(donnees.details ?? {});
        ouvrir('supprimerQuandMeme');
        return;
      }
      setErreur(messageErreur(echec, 'Le projet n’a pas pu être supprimé.'));
    }
  }

  async function supprimerQuandMeme() {
    await soumettre(() => projectService.supprimer(projet.id, { force: true }), {
      onSucces: () => navigate('/admin/projects', { replace: true }),
    });
  }
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

  if (chargement && !donnees) return <Chargement texte="Chargement du projet…" />;
  if (erreur) return <Alerte>{erreur}</Alerte>;
  if (!projet) return null;

  const enCours = projet.status === 'IN_PROGRESS';
  const archive = projet.status === 'ARCHIVED';

  const affectationsBailleurs = donnees.funderAllocations ?? [];
  const devisesBailleurs = [...new Set(affectationsBailleurs.map((a) => a.devise))];
  const totalBailleurs = affectationsBailleurs.reduce((somme, a) => somme + Number(a.montant), 0);
  const nombreBailleurs = new Set(affectationsBailleurs.map((a) => a.bailleurId)).size;

  const impactsGeneraux = donnees.impacts.filter((impact) => !impact.objectiveId);
  const impactsParObjectif = donnees.impacts.filter((impact) => impact.objectiveId);

  const sansObjectifs = (projet.objectives?.length ?? 0) === 0;

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
      cle: 'taches',
      label: 'Tâches à faire',
      compteur: (donnees.tasks ?? []).length,
    },
    { cle: 'beneficiaires', label: 'Bénéficiaires', compteur: donnees.beneficiaries.length },
    { cle: 'impact', label: 'Impact', compteur: donnees.impacts.length },
    { cle: 'rapport', label: 'Rapport' },
  ];

  return (
    <>
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
                <button
                  type="button"
                  className="btn btn--danger"
                  onClick={() => ouvrir('supprimerProjet')}
                >
                  Supprimer
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

      {ongletActif === 'financement' && (
        <>
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
                cle: 'equipe',
                titre: 'Équipe',
                rendu: (tache) => <EquipeEnBref equipe={tache.equipe} />,
              },
              {
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

      {ongletActif === 'impact' && (
        <>
          {donnees.impactSummary.length > 0 && (
            <div className="cartes-chiffres">
              {donnees.impactSummary.map((ligne) => (
                <div className="carte-chiffre carte-chiffre--impact" key={`${ligne.indicator}|${ligne.unit ?? ''}`}>
                  <p className="carte-chiffre__libelle">{libelleIndicateur(ligne.indicator)}</p>
                  <p className="carte-chiffre__valeur">
                    {fmt.nombre(ligne.total)}
                    {ligne.unit && <span className="carte-chiffre__unite">{ligne.unit}</span>}
                  </p>
                  <p className="carte-chiffre__variation">{fmt.nombre(ligne.entriesCount)} mesure(s)</p>
                </div>
              ))}
            </div>
          )}

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

      {ongletActif === 'rapport' && <OngletRapport projet={projet} />}

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

      <ModaleSuppressionForcee
        ouverte={modale.nom === 'supprimerQuandMeme'}
        projet={projet}
        ecritures={retenu}
        onFermer={fermer}
        onConfirmer={supprimerQuandMeme}
        envoi={envoi}
        erreur={erreurAction}
      />

      <ModaleConfirmation
        ouverte={modale.nom === 'supprimerProjet'}
        titre="Supprimer ce projet ?"
        message={`« ${projet.name} » sera définitivement effacé. La suppression n’est possible que si aucun don, investissement ou dépense ne s’y rattache : sinon, archivez-le pour conserver son historique.`}
        onFermer={fermer}
        onConfirmer={supprimerProjet}
        envoi={envoi}
        erreur={erreurAction}
        libelleConfirmer="Supprimer"
        danger
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
