import { Link } from 'react-router-dom';

import { useChargement } from '../../hooks/useChargement.js';
import * as service from '../../services/bailleur.service.js';
import * as fmt from '../../utils/format.js';
import {
  BarreRepartition,
  ChaineEngagement,
  EntetePage,
  Panneau,
  Pastille,
  STATUTS_VERSEMENT,
  TEINTES_VERSEMENT,
} from './composants.jsx';

/**
 * Tableau de bord consolide du bailleur.
 *
 * Les quatre chiffres du haut sont des agregats calcules a la volee :
 * aucun n'est stocke, sinon ils se desynchroniseraient des la saisie du
 * versement suivant.
 */
export default function TableauDeBord() {
  const { donnees, chargement, erreur } = useChargement(() => service.tableauDeBord(), []);

  if (chargement && !donnees) {
    return <p className="vide-bailleur">Chargement de votre tableau de bord…</p>;
  }
  if (erreur) return <p className="alerte-bailleur">{erreur}</p>;

  const i = donnees?.indicateurs ?? {};
  const projets = donnees?.projets ?? [];
  const versements = donnees?.versements ?? [];
  const origine = donnees?.origineDesFonds ?? {};
  const distinctions = donnees?.distinctions ?? [];

  return (
    <>
      <EntetePage
        titre="Tableau de bord"
        accroche="Ce que votre organisation a engagé, ce qui est arrivé, et ce que cela a financé."
      />

      <div className="kpi">
        <Kpi libelle="Montant engagé" valeur={fmt.montant(i.montantEngage)} teinte="violet" />
        <Kpi
          libelle="Taux d’exécution"
          valeur={`${i.tauxExecution ?? 0} %`}
          note={`${fmt.montant(i.montantRecu)} reçus`}
          teinte="orange"
        />
        <Kpi
          libelle="Projets financés"
          valeur={fmt.nombre(i.projetsFinances)}
          teinte="bleu"
        />
        <Kpi
          libelle="Bénéficiaires touchés"
          valeur={fmt.nombre(i.beneficiairesTouches)}
          teinte="vert"
        />
      </div>

      <Panneau
        titre="Promis, reçu, affecté"
        sousTitre="Trois montants distincts, sur un même axe"
      >
        <ChaineEngagement
          promis={i.montantEngage}
          recu={i.montantRecu}
          affecte={projets.reduce((somme, p) => somme + Number(p.montantAffecte ?? 0), 0)}
        />
        {Number(i.montantAttendu) > 0 && (
          <p className="triade__attendu">
            <strong>{fmt.montant(i.montantAttendu)}</strong> encore attendus sur les tranches à
            venir.
          </p>
        )}
      </Panneau>

      <div className="deux-colonnes">
        <Panneau titre="Répartition par domaine">
          <BarreRepartition lignes={donnees?.domaines ?? []} cleLibelle="domaine" />
        </Panneau>

        <Panneau titre="Origine des fonds HOPE" sousTitre="Toutes sources confondues">
          <BarreRepartition
            lignes={[
              {
                domaine: 'Financements institutionnels',
                part: origine.partInstitutionnel ?? 0,
                montant: origine.institutionnel,
              },
              {
                domaine: 'Dons individuels',
                part: origine.partIndividuel ?? 0,
                montant: origine.individuel,
              },
            ]}
          />
        </Panneau>
      </div>

      {/*
        Tous les projets HOPE, et non plus les seuls que le partenaire
        finance : ceux-la viennent en tete, et "Votre affectation" reste
        vide sur les autres.
      */}
      <Panneau
        titre="Tous les projets"
        sousTitre="« Votre affectation » est le montant que vous y avez attribué, non le budget total du projet"
        actions={
          <Link className="lien-bailleur" to="/bailleur/projets">
            Voir les fiches
          </Link>
        }
      >
        {projets.length === 0 ? (
          <p className="vide-bailleur">Aucun projet pour l’instant.</p>
        ) : (
          <div className="table-bailleur">
            <table>
              <thead>
                <tr>
                  <th>Projet</th>
                  <th>Domaine</th>
                  <th>Zone</th>
                  <th className="nombre">Votre affectation</th>
                  <th className="nombre">Budget du projet</th>
                </tr>
              </thead>
              <tbody>
                {projets.map((projet) => (
                  <tr key={projet.id}>
                    <td>
                      <strong>{projet.name}</strong>
                      <span className="table-bailleur__meta">{projet.reference}</span>
                    </td>
                    <td>{projet.categorie ?? '—'}</td>
                    <td>{projet.location ?? '—'}</td>
                    <td className="nombre">
                      {projet.financeParMoi ? (
                        <strong>{fmt.montant(projet.montantAffecte)}</strong>
                      ) : (
                        <span className="table-bailleur__discret" aria-label="Aucune affectation">
                          —
                        </span>
                      )}
                    </td>
                    <td className="nombre table-bailleur__discret">
                      {fmt.montant(projet.requiredBudget)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panneau>

      <div className="deux-colonnes">
        <Panneau
          titre="Derniers versements reçus"
          actions={
            <Link className="lien-bailleur" to="/bailleur/partenariat">
              Tout l’historique
            </Link>
          }
        >
          {versements.length === 0 ? (
            <p className="vide-bailleur">Aucun versement enregistré à ce jour.</p>
          ) : (
            <ul className="lignes">
              {versements.map((versement) => (
                <li key={versement.id} className="ligne">
                  <div className="ligne__gauche">
                    <strong>{fmt.montant(versement.montant, versement.devise)}</strong>
                    <span className="ligne__meta">{versement.engagementIntitule}</span>
                  </div>
                  <div className="ligne__droite">
                    <Pastille teinte={TEINTES_VERSEMENT[versement.statut]}>
                      {STATUTS_VERSEMENT[versement.statut]}
                    </Pastille>
                    <span className="ligne__date">{fmt.date(versement.dateRecue)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panneau>

        <Panneau titre="Zones d’intervention">
          {(donnees?.zones ?? []).length === 0 ? (
            <p className="vide-bailleur">Aucune zone à afficher.</p>
          ) : (
            <ul className="lignes">
              {donnees.zones.map((zone) => (
                <li key={zone.zone} className="ligne">
                  <div className="ligne__gauche">
                    <strong>{zone.zone}</strong>
                    <span className="ligne__meta">
                      {zone.projets} projet{zone.projets > 1 ? 's' : ''}
                    </span>
                  </div>
                  <span className="ligne__date">{fmt.montant(zone.montant)}</span>
                </li>
              ))}
            </ul>
          )}

          {distinctions.length > 0 && (
            <div className="distinctions">
              <p className="distinctions__titre">Distinctions</p>
              {distinctions.map((distinction) => (
                <span
                  key={distinction.code}
                  className="distinction"
                  title={distinction.regle ?? ''}
                >
                  {distinction.libelle}
                </span>
              ))}
            </div>
          )}
        </Panneau>
      </div>
    </>
  );
}

/** Un chiffre cle du haut de page. */
function Kpi({ libelle, valeur, note, teinte }) {
  return (
    <article className={`kpi__carte kpi__carte--${teinte}`}>
      <p className="kpi__libelle">{libelle}</p>
      <p className="kpi__valeur">{valeur}</p>
      {note && <p className="kpi__note">{note}</p>}
    </article>
  );
}
