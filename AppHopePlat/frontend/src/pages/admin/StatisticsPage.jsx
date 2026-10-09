import { Link } from 'react-router-dom';

import {
  Alerte,
  Badge,
  Chargement,
  EntetePage,
  EtatVide,
  Panneau,
  Progression,
  Tableau,
} from '../../components/admin/ui.jsx';
import { useChargement } from '../../hooks/useChargement.js';
import * as catalogService from '../../services/catalog.service.js';
import * as statisticsService from '../../services/statistics.service.js';
import * as fmt from '../../utils/format.js';

const MOIS_COURTS = [
  'janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin',
  'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.',
];

function libelleMois(periode) {
  const [, mois] = periode.split('-');
  return MOIS_COURTS[Number(mois) - 1] ?? periode;
}

function Serie({ lignes, champLibelle, champValeur, maximum, format = fmt.montant, teinte }) {
  if (!lignes || lignes.length === 0) return <EtatVide titre="Aucune donnée" />;

  return (
    <div className="serie">
      {lignes.map((ligne) => {
        const valeur = Number(ligne[champValeur] ?? 0);
        const echelle = maximum > 0 ? (valeur / (maximum / 100)) * 100 : 0;

        return (
          <div className="serie__ligne" key={ligne[champLibelle]}>
            <span className="serie__libelle" title={ligne[champLibelle]}>
              {ligne[champLibelle]}
            </span>
            <div className="serie__piste">
              <div
                className={`serie__barre${teinte ? ` serie__barre--${teinte}` : ''}`}
                style={{ width: `${Math.max(0, Math.min(100, echelle))}%` }}
              />
            </div>
            <span className="serie__valeur">{format(valeur)}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function StatisticsPage() {
  const { donnees, chargement, erreur } = useChargement(() => statisticsService.recuperer(), []);
  const { donnees: catalogue } = useChargement(() => catalogService.recuperer(), []);

  if (chargement && !donnees) return <Chargement texte="Calcul des statistiques…" />;
  if (erreur) return <Alerte>{erreur}</Alerte>;

  const libelles = catalogue?.labels ?? {};
  const { budget, projects, donors } = donnees;

  const maxMensuel = Number(budget.monthlyMax) / 100 || 1;

  return (
    <>
      <EntetePage
        titre="Statistiques"
        accroche="Le budget, les projets et les donateurs en chiffres, sur les douze derniers mois."
      />

      <Panneau
        titre="Dons reçus mois par mois"
        sousTitre="Part affectée à un projet et part versée au fonds HOPE."
      >
        {budget.monthlySeries.every((mois) => Number(mois.total) === 0) ? (
          <EtatVide
            titre="Aucun don sur les douze derniers mois"
            texte="L’histogramme se remplira dès le premier don enregistré."
          />
        ) : (
          <>
            <div className="histogramme">
              {budget.monthlySeries.map((mois) => {
                const affectes = Number(mois.affectes);
                const hope = Number(mois.hope);
                const total = affectes + hope;

                return (
                  <div className="histogramme__mois" key={mois.periode}>
                    <div className="histogramme__colonne">
                      {total === 0 ? (
                        <div className="histogramme__vide" />
                      ) : (
                        <>
                          {hope > 0 && (
                            <div
                              className="histogramme__part histogramme__part--hope"
                              style={{ height: `${(hope / maxMensuel) * 100}%` }}
                              title={`Fonds HOPE : ${fmt.montant(hope)}`}
                            />
                          )}
                          {affectes > 0 && (
                            <div
                              className="histogramme__part histogramme__part--affecte"
                              style={{ height: `${(affectes / maxMensuel) * 100}%` }}
                              title={`Dons affectés : ${fmt.montant(affectes)}`}
                            />
                          )}
                        </>
                      )}
                    </div>
                    <span className="histogramme__etiquette">{libelleMois(mois.periode)}</span>
                  </div>
                );
              })}
            </div>

            <div className="legende">
              <span className="legende__entree">
                <span
                  className="legende__pastille"
                  style={{ backgroundColor: 'var(--hope-violet)' }}
                />
                Dons affectés — {fmt.montant(budget.designatedTotal)}
              </span>
              <span className="legende__entree">
                <span
                  className="legende__pastille"
                  style={{ backgroundColor: 'var(--hope-bleu)' }}
                />
                Fonds HOPE — {fmt.montant(budget.hopeTotal)}
              </span>
              <span className="legende__entree">
                Total reçu : <strong>{fmt.montant(budget.grandTotal)}</strong>
              </span>
            </div>
          </>
        )}
      </Panneau>

      <div className="stats-grille" style={{ marginTop: '18px' }}>
        <Panneau
          titre="Moyens de paiement"
          sousTitre="Ils dépendent de la localisation du donateur."
        >
          <Serie
            lignes={budget.paymentBreakdown}
            champLibelle="moyen"
            champValeur="montant"
            maximum={budget.paymentMax}
          />
        </Panneau>

        <Panneau titre="Dépenses par catégorie" sousTitre="À quoi servent les fonds engagés.">
          <Serie
            lignes={budget.expenseBreakdown}
            champLibelle="category"
            champValeur="montant"
            maximum={budget.expenseMax}
            teinte="orange"
          />
        </Panneau>
      </div>

      <div style={{ marginTop: '18px' }} />
      <Panneau
        titre="Projets par catégorie"
        sousTitre="Montant réellement investi dans chaque type de projet."
      >
        <Serie
          lignes={projects.byCategory}
          champLibelle="categorie"
          champValeur="finance"
          maximum={projects.categoryMax}
        />
      </Panneau>

      <div className="stats-grille" style={{ marginTop: '18px' }}>
        <Panneau titre="Projets par statut" serre>
          <Tableau
            lignes={projects.byStatus}
            cleLigne={(ligne) => ligne.status}
            colonnes={[
              {
                cle: 'status',
                titre: 'Statut',
                rendu: (ligne) => (
                  <Badge valeur={ligne.status} libelles={libelles.projectStatus} />
                ),
              },
              {
                cle: 'nombre',
                titre: 'Projets',
                aligne: 'droite',
                rendu: (ligne) => fmt.nombre(ligne.nombre),
              },
              {
                cle: 'budgetRequis',
                titre: 'Budget nécessaire',
                aligne: 'droite',
                rendu: (ligne) => fmt.montant(ligne.budgetRequis),
              },
            ]}
          />
        </Panneau>

        <Panneau titre="Projets les mieux financés" serre>
          <Tableau
            lignes={projects.topFunded}
            colonnes={[
              {
                cle: 'name',
                titre: 'Projet',
                rendu: (projet) => (
                  <Link className="table__lien" to={`/admin/projects/${projet.id}`}>
                    {projet.name}
                  </Link>
                ),
              },
              {
                cle: 'fundedTotal',
                titre: 'Investi',
                aligne: 'droite',
                rendu: (p) => fmt.montant(p.fundedTotal, p.currency),
              },
              {
                cle: 'fundingRate',
                titre: 'Couverture',
                rendu: (p) => <Progression valeur={p.fundingRate} />,
              },
            ]}
            vide={<EtatVide titre="Aucun projet financé" />}
          />
        </Panneau>
      </div>

      <div className="cartes-chiffres" style={{ marginTop: '18px' }}>
        <article className="carte-chiffre">
          <div>
            <p className="carte-chiffre__libelle">Donateurs</p>
            <p className="carte-chiffre__valeur">{fmt.nombre(donors.total)}</p>
            <p className="carte-chiffre__variation">
              {fmt.nombre(donors.avecCompte)} avec un compte
            </p>
          </div>
        </article>
        <article className="carte-chiffre">
          <div>
            <p className="carte-chiffre__libelle">Donateurs réguliers</p>
            <p className="carte-chiffre__valeur">{fmt.pourcent(donors.accountShare)}</p>
            <p className="carte-chiffre__variation">
              {fmt.nombre(donors.sansCompte)} donnent sans compte
            </p>
          </div>
        </article>
        <article className="carte-chiffre">
          <div>
            <p className="carte-chiffre__libelle">Depuis l’étranger</p>
            <p className="carte-chiffre__valeur">{fmt.pourcent(donors.internationalShare)}</p>
            <p className="carte-chiffre__variation">
              {fmt.nombre(donors.internationaux)} donateurs internationaux
            </p>
          </div>
        </article>
        <article className="carte-chiffre">
          <div>
            <p className="carte-chiffre__libelle">Dons mensuels</p>
            <p className="carte-chiffre__valeur">{fmt.pourcent(donors.monthlyShare)}</p>
            <p className="carte-chiffre__variation">
              {fmt.nombre(donors.donsMensuels)} mensuels · {fmt.nombre(donors.donsPonctuels)}{' '}
              ponctuels
            </p>
          </div>
        </article>
      </div>

      <Panneau titre="Donateurs les plus engagés" sousTitre="Cumul de tous leurs dons encaissés.">
        <Serie
          lignes={donors.top.map((donateur) => ({
            ...donateur,
            libelle: `${donateur.displayName}${donateur.hasAccount ? ' (compte)' : ''}`,
          }))}
          champLibelle="libelle"
          champValeur="donationsTotal"
          maximum={donors.topMax}
        />
      </Panneau>
    </>
  );
}
