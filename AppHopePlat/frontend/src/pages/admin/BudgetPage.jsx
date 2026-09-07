import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { IconePlus } from '../../components/admin/AdminIcons.jsx';
import FluxDesFonds from '../../components/admin/FluxDesFonds.jsx';
import { InvestirModale } from '../../components/admin/modales.jsx';
import {
  Alerte,
  Chargement,
  EntetePage,
  EtatVide,
  Panneau,
  Progression,
  Tableau,
} from '../../components/admin/ui.jsx';
import { useChargement } from '../../hooks/useChargement.js';
import * as fundService from '../../services/fund.service.js';
import * as fmt from '../../utils/format.js';

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

  const { donnees, chargement, erreur, recharger } = useChargement(() => fundService.etat(), []);

  // Ouverture directe depuis l'action rapide de l'accueil.
  useEffect(() => {
    if (parametres.get('investir') === '1') {
      setModaleOuverte(true);
      setParametres({}, { replace: true });
    }
  }, [parametres, setParametres]);

  if (chargement && !donnees) return <Chargement texte="Chargement du budget…" />;

  const resume = donnees?.summary;
  const projets = donnees?.projects ?? [];
  const investissements = donnees?.investments ?? [];

  return (
    <>
      <EntetePage
        titre="Budget"
        accroche="Les dons affectés vont directement aux projets. Les dons non affectés forment le fonds HOPE, que vous répartissez."
        actions={
          <button
            type="button"
            className="btn btn--principal"
            onClick={() => setModaleOuverte(true)}
            disabled={Number(resume?.availableTotal ?? 0) <= 0 || projets.length === 0}
          >
            <IconePlus />
            Investir
          </button>
        }
      />

      {erreur && <Alerte>{erreur}</Alerte>}

      {/* ---------- Les trois sommes demandees ---------- */}
      <div className="resume-financier" style={{ marginBottom: '18px' }}>
        <div className="resume-financier__bloc">
          <p className="resume-financier__libelle">Somme des dons affectés</p>
          <p className="resume-financier__valeur">{fmt.montant(resume?.designatedTotal)}</p>
          <p className="resume-financier__detail">
            {fmt.nombre(resume?.designatedCount)} don(s) fléchés sur un projet
          </p>
        </div>
        <div className="resume-financier__bloc">
          <p className="resume-financier__libelle">Somme pour HOPE</p>
          <p className="resume-financier__valeur">{fmt.montant(resume?.hopeTotal)}</p>
          <p className="resume-financier__detail">
            {fmt.nombre(resume?.hopeCount)} don(s) non affectés
          </p>
        </div>
        <div className="resume-financier__bloc">
          <p className="resume-financier__libelle">Somme totale reçue</p>
          <p className="resume-financier__valeur">{fmt.montant(resume?.grandTotal)}</p>
          <p className="resume-financier__detail">
            {fmt.nombre(resume?.donationsCount)} dons, dont {fmt.nombre(resume?.monthlyCount)}{' '}
            mensuels
          </p>
        </div>
        <div className="resume-financier__bloc">
          <p className="resume-financier__libelle">Disponible à investir</p>
          <p className="resume-financier__valeur">{fmt.montant(resume?.availableTotal)}</p>
          <p className="resume-financier__detail">
            {fmt.pourcent(resume?.investedRate)} du fonds HOPE déjà engagé
          </p>
        </div>
      </div>

      {/* ---------- Lecture visuelle du budget ---------- */}
      <Panneau
        titre="Où va l’argent"
        sousTitre="Les largeurs des segments sont proportionnelles aux montants réellement reçus."
        serre
      >
        <FluxDesFonds summary={resume} />
      </Panneau>

      {/* ---------- Projets a financer ---------- */}
      <Panneau
        titre="Projets en attente de financement"
        sousTitre="Le besoin restant, c’est le budget nécessaire moins ce qui est déjà investi."
        serre
      >
        <Tableau
          lignes={projets}
          colonnes={[
            {
              cle: 'name',
              titre: 'Projet',
              rendu: (projet) => (
                <div>
                  <Link className="table__lien" to={`/admin/projects/${projet.id}`}>
                    {projet.name}
                  </Link>
                  <div className="table__secondaire">{projet.reference}</div>
                </div>
              ),
            },
            {
              cle: 'requiredBudget',
              titre: 'Budget nécessaire',
              aligne: 'droite',
              rendu: (p) => fmt.montant(p.requiredBudget, p.currency),
            },
            {
              cle: 'fundedTotal',
              titre: 'Déjà financé',
              aligne: 'droite',
              rendu: (p) => fmt.montant(p.fundedTotal, p.currency),
            },
            {
              cle: 'remainingNeed',
              titre: 'Besoin restant',
              aligne: 'droite',
              rendu: (p) => <strong>{fmt.montant(p.remainingNeed, p.currency)}</strong>,
            },
            {
              cle: 'fundingRate',
              titre: 'Couverture',
              rendu: (p) => <Progression valeur={p.fundingRate} />,
            },
            {
              cle: 'actions',
              titre: 'Actions',
              aligne: 'droite',
              rendu: (projet) => (
                <Link className="lien-action" to={`/admin/projects/${projet.id}?onglet=financement`}>
                  Financement
                </Link>
              ),
            },
          ]}
          vide={
            <EtatVide
              titre="Aucun projet en cours"
              texte="Créez un projet pour pouvoir y investir le fonds HOPE."
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

      <InvestirModale
        ouverte={modaleOuverte}
        projets={projets}
        disponible={resume?.availableTotal ?? '0'}
        onFermer={() => setModaleOuverte(false)}
        onEnregistre={() => {
          setModaleOuverte(false);
          recharger();
        }}
      />
    </>
  );
}
