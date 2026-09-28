import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { IconePlus } from '../../components/admin/AdminIcons.jsx';
import CartesBudget from '../../components/admin/CartesBudget.jsx';
import DetailDepenses from '../../components/admin/DetailDepenses.jsx';
import FluxDesFonds from '../../components/admin/FluxDesFonds.jsx';
import FondsFlottant from '../../components/admin/FondsFlottant.jsx';
import { DepenseModale, DonModale, InvestirModale } from '../../components/admin/modales.jsx';
import {
  Alerte,
  Badge,
  Chargement,
  EntetePage,
  EtatVide,
  Panneau,
  Tableau,
} from '../../components/admin/ui.jsx';
import { useChargement } from '../../hooks/useChargement.js';
import * as catalogService from '../../services/catalog.service.js';
import * as donorService from '../../services/donor.service.js';
import * as expenseService from '../../services/expense.service.js';
import * as fundService from '../../services/fund.service.js';
import * as projectService from '../../services/project.service.js';
import * as fmt from '../../utils/format.js';

/** Une somme en centimes : additionner des montants sans erreur d'arrondi. */
const enCentimes = (valeur) => Math.round(Number(valeur ?? 0) * 100);

/**
 * Le total des projets, devise par devise : une ligne par devise, placee
 * sous les projets. Additionner des ariary et des euros ne voudrait rien
 * dire.
 */
function lignesDeTotal(projets) {
  const parDevise = new Map();
  for (const projet of projets) {
    const devise = projet.currency ?? 'MGA';
    const total = parDevise.get(devise) ?? {
      id: `total-${devise}`,
      total: true,
      currency: devise,
      nombre: 0,
      requis: 0,
      recu: 0,
      hope: 0,
      reste: 0,
      depense: 0,
    };
    total.nombre += 1;
    total.requis += enCentimes(projet.requiredBudget);
    total.recu += enCentimes(projet.fundedTotal);
    total.hope += enCentimes(projet.investedHopeTotal);
    total.reste += enCentimes(projet.remainingNeed);
    total.depense += enCentimes(projet.spentTotal);
    parDevise.set(devise, total);
  }
  return [...parDevise.values()].map((total) => ({
    ...total,
    requiredBudget: total.requis / 100,
    fundedTotal: total.recu / 100,
    investedHopeTotal: total.hope / 100,
    remainingNeed: total.reste / 100,
    spentTotal: total.depense / 100,
  }));
}

/**
 * Une somme des totaux, devise par devise : "12 400 000 Ar", ou
 * "12 400 000 Ar + 3 000 EUR" si les projets ne partagent pas une devise.
 */
function somme(totaux, champ) {
  if (totaux.length === 0) return fmt.montant(null);
  return totaux.map((total) => fmt.montant(total[champ], total.currency)).join(' + ');
}

/** Une part, en pourcentage entier : "76 %". */
function part(valeur, sur) {
  const base = enCentimes(sur);
  return base > 0 ? `${Math.round((enCentimes(valeur) * 100) / base)} %` : '—';
}

/**
 * Ecran Budget : l'etat du fonds et son emploi.
 *
 * Il repond a trois questions dans cet ordre :
 *   combien avons-nous reçu, et sous quelle forme ?
 *   qu'avons-nous deja engage ?
 *   que reste-t-il a investir, et sur quel projet ?
 */
export default function BudgetPage() {
  const [parametres, setParametres] = useSearchParams();
  const [modaleOuverte, setModaleOuverte] = useState(false);
  const [depenseOuverte, setDepenseOuverte] = useState(false);
  const [fondOuvert, setFondOuvert] = useState(false);

  const { donnees, chargement, erreur, recharger } = useChargement(() => fundService.etat(), []);
  /*
   * L'etat du fonds ne porte des projets que ce qu'il faut pour
   * investir : leur besoin restant. Une depense se heurte a une autre
   * limite -- les fonds deja recus et pas encore depenses -- que seule
   * la liste complete des projets connait.
   */
  const { donnees: listeProjets, recharger: rechargerProjets } = useChargement(
    () => projectService.lister({ status: 'IN_PROGRESS', pageSize: 200 }),
    []
  );
  // Le budget de chaque projet, termines compris : ce qu'il fallait,
  // ce qui est arrive, ce qui manque, ce qui est sorti. Les projets
  // archives n'y figurent plus.
  const { donnees: tousLesProjets, recharger: rechargerBudgets } = useChargement(
    () => projectService.lister({ pageSize: 200 }),
    []
  );
  const { donnees: catalogue } = useChargement(() => catalogService.recuperer(), []);
  // Le detail des depenses : les plus recentes d'abord.
  const { donnees: listeDepenses, chargement: chargementDepenses, recharger: rechargerDepenses } = useChargement(
    () => expenseService.lister({ pageSize: 200 }),
    []
  );
  // Un fonds s'alimente d'un don : il faut donc savoir de qui il vient.
  const { donnees: donateurs, recharger: rechargerDonateurs } = useChargement(
    () => donorService.lister({ pageSize: 200 }),
    []
  );

  // Ouvertures directes depuis les actions rapides de l'accueil.
  useEffect(() => {
    if (parametres.get('investir') === '1') {
      setModaleOuverte(true);
      setParametres({}, { replace: true });
    }
    if (parametres.get('depense') === '1') {
      setDepenseOuverte(true);
      setParametres({}, { replace: true });
    }
  }, [parametres, setParametres]);

  if (chargement && !donnees) return <Chargement texte="Chargement du budget…" />;

  const resume = donnees?.summary;
  const projets = donnees?.projects ?? [];
  const investissements = donnees?.investments ?? [];
  // Le service refuse une depense sur un projet qui n'est pas en cours :
  // autant ne pas le proposer.
  const projetsOuverts = (listeProjets?.items ?? []).filter(
    (projet) => projet.status === 'IN_PROGRESS'
  );
  const listeDonateurs = donateurs?.items ?? [];
  const budgets = tousLesProjets?.items ?? [];
  const totaux = lignesDeTotal(budgets);
  const lignesBudget = budgets.length > 0 ? [...budgets, ...totaux] : [];
  // Les parts ne se calculent que dans une seule devise.
  const unique = totaux.length === 1 ? totaux[0] : null;

  return (
    <>
      <EntetePage
        titre="Budget"
        accroche="Les dons affectés vont directement aux projets. Les dons non affectés forment le fonds HOPE, que vous répartissez."
        actions={
          <>
            {/*
              Alimenter le fonds et le repartir sont les deux mouvements
              de cet ecran : l'argent qui entre, puis celui qui part vers
              un projet. D'ou deux boutons cote a cote.

              Le don s'ouvre sur "Non affecte (fonds HOPE)", qui est la
              valeur par defaut du formulaire : c'est bien le fonds que
              l'on alimente ici. L'affectation reste modifiable -- un don
              recu pour un projet precis s'enregistre aussi bien d'ici.
            */}
            <button
              type="button"
              className="btn btn--neutre"
              onClick={() => setFondOuvert(true)}
              disabled={listeDonateurs.length === 0}
            >
              <IconePlus />
              Ajouter un fond
            </button>
            <button
              type="button"
              className="btn btn--principal"
              onClick={() => setModaleOuverte(true)}
              disabled={Number(resume?.availableTotal ?? 0) <= 0 || projets.length === 0}
            >
              <IconePlus />
              Investir
            </button>
          </>
        }
      />

      {erreur && <Alerte>{erreur}</Alerte>}

      {/* Le budget de HOPE, toujours sous les yeux : une carte que l'on deplace. */}
      <FondsFlottant
        resume={resume}
        onInvestir={() => setModaleOuverte(true)}
        peutInvestir={Number(resume?.availableTotal ?? 0) > 0 && projets.length > 0}
      />

      {/*
        ---------- Les quatre sommes du budget ----------
        Ce que HOPE a recu, ce qu'il faut aux projets, ce qui reste a
        trouver, ce que le fonds HOPE a deja investi. Le detail suit :
        ou va l'argent, le budget de chaque projet, les depenses.
      */}
      <CartesBudget
        resume={resume}
        // Aucun projet : des sommes nulles plutot qu'un tiret.
        total={totaux.length === 0 ? { requiredBudget: 0, fundedTotal: 0, remainingNeed: 0, currency: 'MGA' } : unique}
        texteNecessaire={somme(totaux, 'requiredBudget')}
        texteRestant={somme(totaux, 'remainingNeed')}
        nombreProjets={budgets.length}
      />

      {/* ---------- Lecture visuelle du budget ---------- */}
      <Panneau
        titre="Où va l’argent"
        sousTitre="Les largeurs des segments sont proportionnelles aux montants réellement reçus."
        serre
      >
        <FluxDesFonds summary={resume} />
      </Panneau>

      {/*
        ---------- Le budget des projets ----------
        Les quatre sommes de chaque projet, et leur total : le budget
        necessaire, les sommes recues (dons affectes et fonds HOPE
        investi), ce qui reste a financer, et ce qui est deja depense.
      */}
      <Panneau
        titre="Budget des projets"
        sousTitre="Le reste à financer, c’est le budget nécessaire moins les sommes reçues."
        serre
      >
        <Tableau
          chargement={!tousLesProjets}
          lignes={lignesBudget}
          cleLigne={(ligne) => ligne.id}
          classeLigne={(ligne) => (ligne.total ? 'ligne--total' : '')}
          colonnes={[
            {
              cle: 'name',
              titre: 'Projet',
              aligne: 'centre',
              rendu: (ligne) =>
                ligne.total ? (
                  <div>
                    <div>Total</div>
                    <div className="table__secondaire">
                      {ligne.nombre} projet{ligne.nombre > 1 ? 's' : ''}
                    </div>
                  </div>
                ) : (
                  <div>
                    <Link className="table__lien" to={`/admin/projects/${ligne.id}`}>
                      {ligne.name}
                    </Link>
                    <div className="table__secondaire">
                      {ligne.reference}
                      {ligne.status === 'COMPLETED' && (
                        <>
                          {' · '}
                          <Badge valeur="COMPLETED" libelles={{ COMPLETED: 'Terminé' }} couleur="bleu" />
                        </>
                      )}
                    </div>
                  </div>
                ),
            },
            {
              cle: 'requiredBudget',
              titre: 'Budget nécessaire',
              aligne: 'centre',
              rendu: (ligne) => fmt.montant(ligne.requiredBudget, ligne.currency),
            },
            {
              cle: 'fundedTotal',
              titre: 'Sommes reçues',
              aligne: 'centre',
              rendu: (ligne) => (
                <div>
                  <strong>{fmt.montant(ligne.fundedTotal, ligne.currency)}</strong>
                  {!ligne.total && Number(ligne.investedHopeTotal) > 0 && (
                    <div className="table__secondaire">
                      dont {fmt.montant(ligne.investedHopeTotal, ligne.currency)} du fonds HOPE
                    </div>
                  )}
                </div>
              ),
            },
            {
              cle: 'remainingNeed',
              titre: 'Reste à financer',
              aligne: 'centre',
              rendu: (ligne) => (
                <div>
                  <strong className={Number(ligne.remainingNeed) > 0 ? 'budget__manque' : 'budget__atteint'}>
                    {fmt.montant(ligne.remainingNeed, ligne.currency)}
                  </strong>
                  <div className="table__secondaire">
                    {Number(ligne.remainingNeed) > 0
                      ? `${part(ligne.fundedTotal, ligne.requiredBudget)} financé`
                      : 'Budget atteint'}
                  </div>
                </div>
              ),
            },
            {
              cle: 'spentTotal',
              titre: 'Sommes dépensées',
              aligne: 'centre',
              rendu: (ligne) => (
                <div>
                  <strong>{fmt.montant(ligne.spentTotal, ligne.currency)}</strong>
                  <div className="table__secondaire">
                    {part(ligne.spentTotal, ligne.fundedTotal)} des sommes reçues
                  </div>
                </div>
              ),
            },
          ]}
          vide={
            <EtatVide
              titre="Aucun projet"
              texte="Créez un projet pour suivre son budget."
              action={
                <Link className="btn btn--principal" to="/admin/projects/new">
                  <IconePlus />
                  Créer un projet
                </Link>
              }
            />
          }
        />
      </Panneau>

      {/* ---------- Le detail des depenses ---------- */}
      <Panneau
        titre="Détail des dépenses"
        sousTitre="Chaque sortie d’argent, sa catégorie et son justificatif. Une ligne mène à l’onglet Dépenses du projet."
        serre
      >
        <DetailDepenses
          depenses={listeDepenses?.items}
          chargement={chargementDepenses && !listeDepenses}
          sommesRecues={unique?.fundedTotal ?? null}
        />
      </Panneau>

      {/* ---------- Historique des investissements ---------- */}
      <Panneau
        titre="Investissements du fonds HOPE"
        sousTitre="Chaque décision d’emploi du fonds, avec sa justification."
        serre
      >
        <Tableau
          lignes={investissements}
          colonnes={[
            { cle: 'reference', titre: 'Référence' },
            { cle: 'investedAt', titre: 'Date', rendu: (i) => fmt.date(i.investedAt) },
            {
              cle: 'projectName',
              titre: 'Projet',
              rendu: (i) => (
                <Link className="table__lien" to={`/admin/projects/${i.projectId}`}>
                  {i.projectName}
                </Link>
              ),
            },
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
              titre="Le fonds HOPE n’a pas encore été investi"
              texte={
                Number(resume?.availableTotal ?? 0) > 0
                  ? `${fmt.montant(resume.availableTotal)} attendent d’être affectés à un projet.`
                  : 'Aucun don non affecté n’a encore été reçu.'
              }
              action={
                Number(resume?.availableTotal ?? 0) > 0 &&
                projets.length > 0 && (
                  <button
                    type="button"
                    className="btn btn--principal"
                    onClick={() => setModaleOuverte(true)}
                  >
                    <IconePlus />
                    Investir maintenant
                  </button>
                )
              }
            />
          }
        />
      </Panneau>

      <DonModale
        ouverte={fondOuvert}
        donateurs={listeDonateurs}
        projets={projets}
        libelles={catalogue?.labels ?? {}}
        moyensPaiement={catalogue?.paymentMethods ?? {}}
        devises={catalogue?.currencies ?? ['MGA']}
        onFermer={() => setFondOuvert(false)}
        onEnregistre={() => {
          setFondOuvert(false);
          recharger();
          rechargerProjets();
          rechargerBudgets();
          rechargerDonateurs();
        }}
      />

      {/*
        La depense n'a plus de bouton sur cet ecran, mais l'action rapide
        de l'accueil ouvre toujours son formulaire ici : c'est la seule
        page qui connaisse a la fois les projets et leurs fonds
        disponibles.
      */}
      <DepenseModale
        ouverte={depenseOuverte}
        projets={projetsOuverts}
        categories={catalogue?.expenseCategories ?? []}
        onFermer={() => setDepenseOuverte(false)}
        onEnregistre={() => {
          setDepenseOuverte(false);
          recharger();
          rechargerProjets();
          rechargerBudgets();
          rechargerDepenses();
        }}
      />

      <InvestirModale
        ouverte={modaleOuverte}
        projets={projets}
        disponible={resume?.availableTotal ?? '0'}
        onFermer={() => setModaleOuverte(false)}
        onEnregistre={() => {
          setModaleOuverte(false);
          recharger();
          rechargerBudgets();
        }}
      />
    </>
  );
}
