import { useCallback, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';

import { IconePlus } from '../../components/admin/AdminIcons.jsx';
import { ModaleConfirmation } from '../../components/admin/forms.jsx';
import {
  BeneficiaireModale,
  DepenseModale,
  ImpactModale,
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
import VignettePreuve from '../../components/admin/VignettePreuve.jsx';
import { urlMedia } from '../../services/api.js';
import { useChargement, useSoumission } from '../../hooks/useChargement.js';
import * as beneficiaryService from '../../services/beneficiary.service.js';
import * as catalogService from '../../services/catalog.service.js';
import * as documentService from '../../services/document.service.js';
import * as expenseService from '../../services/expense.service.js';
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
export default function ProjectDetailPage() {
  const { id } = useParams();
  const [parametres, setParametres] = useSearchParams();
  const [ongletActif, setOngletActif] = useState(parametres.get('onglet') ?? 'general');

  const [modale, setModale] = useState({ nom: null, cible: null });
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
      .map((ligne) => ({ ...ligne, depasse: ligne.prevu !== null && ligne.reel > ligne.prevu }))
      .sort((a, b) => a.categorie.localeCompare(b.categorie, 'fr'));
  }, [projet]);

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

  const ONGLETS = [
    { cle: 'general', label: 'Vue générale' },
    {
      cle: 'financement',
      label: 'Financement',
      compteur: donnees.donations.length + donnees.investments.length,
    },
    { cle: 'depenses', label: 'Dépenses', compteur: donnees.expenses.length },
    { cle: 'justificatifs', label: 'Justificatifs', compteur: donnees.documents.length },
    { cle: 'beneficiaires', label: 'Bénéficiaires', compteur: donnees.beneficiaries.length },
    { cle: 'impact', label: 'Impact', compteur: donnees.impacts.length },
  ];

  return (
    <>
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

          {projet.description && (
            <Panneau titre="Description">
              <p className="bloc-texte">{projet.description}</p>
            </Panneau>
          )}

          {/*
            Le budget, categorie par categorie : ce qui etait prevu, et ce
            qui a ete depense. Il n'apparait que s'il y a quelque chose a
            montrer -- un projet dont le montant a ete saisi directement,
            et ou rien n'a encore ete depense, n'a pas de tableau.
          */}
          {lignesBudget.length > 0 && (
            <Panneau
              titre="Budget"
              sousTitre={`${lignesBudget.length} catégorie(s) — le prévu vient du devis, la réalité des dépenses enregistrées`}
              serre
            >
              <Tableau
                lignes={lignesBudget}
                cleLigne={(ligne) => ligne.categorie}
                colonnes={[
                  { cle: 'categorie', titre: 'Catégorie' },
                  {
                    cle: 'prevu',
                    titre: 'Prévu',
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
                    titre: 'Réalité',
                    aligne: 'droite',
                    rendu: (ligne) => (
                      <span className={ligne.depasse ? 'budget__depasse' : undefined}>
                        {ligne.reel > 0 ? fmt.montant(ligne.reel, projet.currency) : '—'}
                      </span>
                    ),
                  },
                ]}
              />
              <p className="devis__recapitulatif">
                Total
                <strong>{fmt.montant(projet.requiredBudget, projet.currency)}</strong>
                <span className="devis__reel">
                  dépensé {fmt.montant(projet.spentTotal ?? 0, projet.currency)}
                </span>
              </p>
            </Panneau>
          )}

          {/*
            Les objectifs specifiques : ce que le projet doit avoir
            accompli. Ils suivent la description, qui dit ce qu'il est.
          */}
          {projet.objectives?.length > 0 && (
            <Panneau
              titre="Objectifs spécifiques"
              sousTitre={`${projet.objectives.length} objectif(s)`}
            >
              <ol className="objectifs">
                {projet.objectives.map((objectif) => (
                  <li className="objectifs__ligne" key={objectif.id}>
                    {objectif.label}
                  </li>
                ))}
              </ol>
            </Panneau>
          )}

          {projet.outcome && (
            <Panneau titre="Résultat du projet">
              <p className="bloc-texte">{projet.outcome}</p>
            </Panneau>
          )}

          <Panneau titre="Photo / vidéo">
            {projet.mediaUrl ? (
              projet.mediaType === 'VIDEO' ? (
                <video className="media-projet" src={urlMedia(projet.mediaUrl)} controls />
              ) : (
                <img className="media-projet" src={urlMedia(projet.mediaUrl)} alt={projet.name} />
              )
            ) : (
              <div className="media-projet media-projet--absente">
                Aucun média rattaché à ce projet.
              </div>
            )}
          </Panneau>
        </>
      )}

      {/* ================= Financement ================= */}
      {ongletActif === 'financement' && (
        <>
          <Panneau
            titre="Dons affectés à ce projet"
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
                    <div className="table__secondaire">
                      {d.category ?? 'Non classée'}
                      {d.supplier ? ` · ${d.supplier}` : ''}
                    </div>
                  </div>
                ),
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
      {ongletActif === 'justificatifs' && (
        <Panneau
          titre="Justificatifs"
          sousTitre="Factures, reçus, preuves bancaires et contrats prouvant chaque dépense."
          serre
          actions={
            <button
              type="button"
              className="btn btn--principal btn--petit"
              onClick={() => ouvrir('justificatif', null)}
              disabled={donnees.expenses.length === 0}
              title={
                donnees.expenses.length === 0
                  ? 'Enregistrez d’abord une dépense : un justificatif se rattache toujours à l’une d’elles.'
                  : undefined
              }
            >
              <IconePlus />
              Ajouter un justificatif
            </button>
          }
        >
          <Tableau
            lignes={donnees.documents}
            colonnes={[
              {
                cle: 'fileName',
                titre: 'Document',
                rendu: (doc) => (
                  <div>
                    <div className="table__principal">{doc.fileName}</div>
                    <div className="table__secondaire">{fmt.tailleFichier(doc.fileSize)}</div>
                  </div>
                ),
              },
              {
                cle: 'documentType',
                titre: 'Type',
                rendu: (doc) => (
                  <Badge
                    valeur={doc.documentType}
                    libelles={libelles.documentType}
                    couleur="violet"
                  />
                ),
              },
              {
                cle: 'expenseDescription',
                titre: 'Dépense justifiée',
                rendu: (doc) => (
                  <div>
                    <div>{fmt.tronquer(doc.expenseDescription, 50)}</div>
                    <div className="table__secondaire">
                      {fmt.montant(doc.expenseAmount, doc.expenseCurrency)}
                    </div>
                  </div>
                ),
              },
              {
                cle: 'authorName',
                titre: 'Ajouté par',
                rendu: (doc) => doc.authorName ?? doc.authorLog ?? '—',
              },
              { cle: 'reference', titre: 'Référence', rendu: (doc) => doc.reference ?? '—' },
              {
                cle: 'issuedAt',
                titre: 'Date',
                rendu: (doc) => fmt.date(doc.issuedAt ?? doc.createdAt),
              },
              {
                cle: 'actions',
                titre: 'Actions',
                aligne: 'droite',
                rendu: (doc) => (
                  <div className="cellule-actions">
                    <button
                      type="button"
                      className="lien-action"
                      onClick={() => ouvrirJustificatif(doc)}
                    >
                      Ouvrir
                    </button>
                    {!archive && (
                      <button
                        type="button"
                        className="lien-action lien-action--danger"
                        onClick={() => ouvrir('supprimerDocument', doc)}
                      >
                        Supprimer
                      </button>
                    )}
                  </div>
                ),
              },
            ]}
            vide={
              <EtatVide
                titre="Aucun justificatif"
                texte="Ajoutez-en depuis l’onglet Dépenses, en face de la dépense concernée."
              />
            }
          />
        </Panneau>
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
          {donnees.impactSummary.length > 0 && (
            <Panneau titre="Cumul par indicateur" serre>
              <Tableau
                colonnes={[
                  {
                    cle: 'indicator',
                    titre: 'Indicateur',
                    rendu: (l) => libelleIndicateur(l.indicator),
                  },
                  {
                    cle: 'total',
                    titre: 'Total',
                    aligne: 'droite',
                    rendu: (l) => `${fmt.nombre(l.total)} ${l.unit ?? ''}`.trim(),
                  },
                  {
                    cle: 'entriesCount',
                    titre: 'Mesures',
                    aligne: 'droite',
                    rendu: (l) => fmt.nombre(l.entriesCount),
                  },
                ]}
                lignes={donnees.impactSummary}
                cleLigne={(l) => l.indicator}
              />
            </Panneau>
          )}

          <Panneau
            titre="Impacts mesurés"
            actions={
              !archive && (
                <button
                  type="button"
                  className="btn btn--principal"
                  onClick={() => ouvrir('impact')}
                >
                  <IconePlus />
                  Ajouter un impact
                </button>
              )
            }
            serre
          >
            <Tableau
              lignes={donnees.impacts}
              colonnes={[
                {
                  cle: 'title',
                  titre: 'Impact',
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
                  cle: 'indicator',
                  titre: 'Indicateur',
                  rendu: (i) => libelleIndicateur(i.indicator),
                },
                {
                  cle: 'value',
                  titre: 'Valeur',
                  aligne: 'droite',
                  rendu: (i) => (
                    <strong>
                      {fmt.nombre(i.value)} {i.unit ?? ''}
                    </strong>
                  ),
                },
                {
                  cle: 'beneficiaryName',
                  titre: 'Bénéficiaire',
                  rendu: (i) => i.beneficiaryName ?? 'Collectif',
                },
                { cle: 'measuredAt', titre: 'Mesuré le', rendu: (i) => fmt.date(i.measuredAt) },
                {
                  cle: 'actions',
                  titre: 'Actions',
                  aligne: 'droite',
                  rendu: (impact) =>
                    archive ? null : (
                      <div className="cellule-actions">
                        <button
                          type="button"
                          className="lien-action"
                          onClick={() => ouvrir('impact', impact)}
                        >
                          Modifier
                        </button>
                        <button
                          type="button"
                          className="lien-action lien-action--danger"
                          onClick={() => ouvrir('supprimerImpact', impact)}
                        >
                          Supprimer
                        </button>
                      </div>
                    ),
                },
              ]}
              vide={
                <EtatVide
                  titre="Aucun impact mesuré"
                  texte="Chiffrez ce que le projet a permis de changer : personnes aidées, matériel distribué, services rendus."
                  action={
                    !archive && (
                      <button
                        type="button"
                        className="btn btn--principal"
                        onClick={() => ouvrir('impact')}
                      >
                        <IconePlus />
                        Ajouter un impact
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
                        {preuve.authorLog ?? 'compte supprimé'}
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

      <ImpactModale
        ouverte={modale.nom === 'impact'}
        projet={projet}
        impact={modale.cible}
        indicateurs={catalogue?.indicators ?? []}
        beneficiaires={donnees.beneficiaries}
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
