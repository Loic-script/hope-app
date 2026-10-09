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

const enCentimes = (valeur) => Math.round(Number(valeur ?? 0) * 100);

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

function somme(totaux, champ) {
  if (totaux.length === 0) return fmt.montant(null);
  return totaux.map((total) => fmt.montant(total[champ], total.currency)).join(' + ');
}

function part(valeur, sur) {
  const base = enCentimes(sur);
  return base > 0 ? `${Math.round((enCentimes(valeur) * 100) / base)} %` : '—';
}

export default function BudgetPage() {
  const [parametres, setParametres] = useSearchParams();
  const [modaleOuverte, setModaleOuverte] = useState(false);
  const [depenseOuverte, setDepenseOuverte] = useState(false);
  const [fondOuvert, setFondOuvert] = useState(false);

  const { donnees, chargement, erreur, recharger } = useChargement(() => fundService.etat(), []);
  const { donnees: listeProjets, recharger: rechargerProjets } = useChargement(
    () => projectService.lister({ status: 'IN_PROGRESS', pageSize: 200 }),
    []
  );
  const { donnees: tousLesProjets, recharger: rechargerBudgets } = useChargement(
    () => projectService.lister({ pageSize: 200 }),
    []
  );
  const { donnees: catalogue } = useChargement(() => catalogService.recuperer(), []);
  const { donnees: listeDepenses, chargement: chargementDepenses, recharger: rechargerDepenses } = useChargement(
    () => expenseService.lister({ pageSize: 200 }),
    []
  );
  const { donnees: donateurs, recharger: rechargerDonateurs } = useChargement(
    () => donorService.lister({ pageSize: 200 }),
    []
  );

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
  const projetsOuverts = (listeProjets?.items ?? []).filter(
    (projet) => projet.status === 'IN_PROGRESS'
  );
  const listeDonateurs = donateurs?.items ?? [];
  const budgets = tousLesProjets?.items ?? [];
  const totaux = lignesDeTotal(budgets);
  const lignesBudget = budgets.length > 0 ? [...budgets, ...totaux] : [];
  const unique = totaux.length === 1 ? totaux[0] : null;

  return (
    <>
      <EntetePage
        titre="Budget"
        accroche="Les dons affectés vont directement aux projets. Les dons non affectés forment le fonds HOPE, que vous répartissez."
        actions={
          <>
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

      <FondsFlottant
        resume={resume}
        onInvestir={() => setModaleOuverte(true)}
        peutInvestir={Number(resume?.availableTotal ?? 0) > 0 && projets.length > 0}
      />

      <CartesBudget
        resume={resume}
        total={totaux.length === 0 ? { requiredBudget: 0, fundedTotal: 0, remainingNeed: 0, currency: 'MGA' } : unique}
        texteNecessaire={somme(totaux, 'requiredBudget')}
        texteRestant={somme(totaux, 'remainingNeed')}
        nombreProjets={budgets.length}
      />

      <Panneau
        titre="Où va l’argent"
        sousTitre="Les largeurs des segments sont proportionnelles aux montants réellement reçus."
        serre
      >
        <FluxDesFonds summary={resume} />
      </Panneau>

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
