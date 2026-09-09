import { useState } from 'react';
import { Link } from 'react-router-dom';

import { IconePlus } from '../../components/admin/AdminIcons.jsx';
import { ModaleConfirmation } from '../../components/admin/forms.jsx';
import { ImpactModale } from '../../components/admin/modales.jsx';
import {
  Alerte,
  Badge,
  Chargement,
  EntetePage,
  EtatVide,
  Onglets,
  Panneau,
  Tableau,
} from '../../components/admin/ui.jsx';
import { useChargement, useSoumission } from '../../hooks/useChargement.js';
import * as catalogService from '../../services/catalog.service.js';
import * as fieldProofService from '../../services/fieldProof.service.js';
import * as impactService from '../../services/impact.service.js';
import * as projectService from '../../services/project.service.js';
import * as fmt from '../../utils/format.js';

/**
 * Ecran Impact : le resultat des projets.
 *
 * Deux lectures complementaires :
 *   les projets termines, avec leur date de fin et leur resultat ecrit ;
 *   les indicateurs chiffres, tous projets confondus.
 */
export default function ImpactPage() {
  const [ongletActif, setOngletActif] = useState('resultats');
  const [modale, setModale] = useState({ nom: null, cible: null });

  const ouvrir = (nom, cible = null) => setModale({ nom, cible });
  const fermer = () => setModale({ nom: null, cible: null });

  const {
    donnees: termines,
    chargement: chargementTermines,
    erreur: erreurTermines,
    recharger: rechargerTermines,
  } = useChargement(() => projectService.listerTermines(), []);

  const {
    donnees: impacts,
    chargement: chargementImpacts,
    recharger: rechargerImpacts,
  } = useChargement(() => impactService.lister(), []);

  // Les preuves terrain alimentent la ligne "Activite" : ce qui a ete
  // fait avec l'argent, entre la depense et le resultat. Une seule
  // requete, regroupee ensuite par projet, plutot qu'une par projet.
  const { donnees: preuves } = useChargement(() => fieldProofService.lister(), []);

  const { donnees: catalogue } = useChargement(() => catalogService.recuperer(), []);
  const { donnees: tousProjets } = useChargement(
    () => projectService.lister({ pageSize: 200, includeArchived: true }),
    []
  );

  const { envoi, erreur: erreurAction, soumettre } = useSoumission();

  async function supprimer() {
    await soumettre(() => impactService.supprimer(modale.cible.id), {
      onSucces: () => {
        fermer();
        rechargerImpacts();
      },
    });
  }

  function apresEnregistrement() {
    fermer();
    rechargerImpacts();
    rechargerTermines();
  }

  const libelles = catalogue?.labels ?? {};

  /**
   * Nom lisible d'un indicateur.
   *
   * Le backend renvoie les indicateurs qu'il suggere, avec leur libelle.
   * Mais le champ reste libre : une mesure peut porter un code absent de
   * cette liste. On le rend alors presentable -- "people_with_water_access"
   * devient "People with water access" -- plutot que d'afficher tel quel
   * un identifiant technique.
   */
  const libelleIndicateur = (code) => {
    const connu = (impacts?.indicators ?? []).find((i) => i.code === code);
    if (connu) return connu.label;
    const mots = String(code).replace(/[_-]+/g, ' ').trim();
    return mots.charAt(0).toUpperCase() + mots.slice(1);
  };
  const projetsTermines = termines?.items ?? [];
  const mesures = impacts?.items ?? [];

  // Cumul des indicateurs, toutes mesures confondues.
  const cumul = mesures.reduce((total, impact) => {
    const cle = `${impact.indicator}|${impact.unit ?? ''}`;
    total[cle] = total[cle] ?? { indicator: impact.indicator, unit: impact.unit, total: 0, nombre: 0 };
    total[cle].total += Number(impact.value);
    total[cle].nombre += 1;
    return total;
  }, {});
  const indicateursCumules = Object.values(cumul).sort((a, b) => b.total - a.total);

  /** Regroupe une liste par projet, pour la chaine de resultats. */
  function parProjet(liste) {
    const groupes = {};
    for (const element of liste ?? []) {
      (groupes[element.projectId] ??= []).push(element);
    }
    return groupes;
  }

  const activitesParProjet = parProjet(preuves?.items);
  const impactsParProjet = parProjet(impacts?.items);

  return (
    <>
      <EntetePage
        titre="Impact"
        accroche="Ce que les dons ont concrètement changé : projets menés à leur terme et indicateurs mesurés."
        actions={
          <button type="button" className="btn btn--principal" onClick={() => ouvrir('impact')}>
            <IconePlus />
            Ajouter un impact
          </button>
        }
      />

      {erreurTermines && <Alerte>{erreurTermines}</Alerte>}
      {erreurAction && modale.nom === null && <Alerte>{erreurAction}</Alerte>}

      {indicateursCumules.length > 0 && (
        <div className="cartes-chiffres" style={{ marginBottom: '18px' }}>
          {indicateursCumules.slice(0, 4).map((ligne) => (
            <article className="carte-chiffre" key={ligne.indicator}>
              <div>
                <p className="carte-chiffre__libelle">{libelleIndicateur(ligne.indicator)}</p>
                <p className="carte-chiffre__valeur">
                  {fmt.nombre(ligne.total)} {ligne.unit ?? ''}
                </p>
                <p className="carte-chiffre__variation">
                  {fmt.nombre(ligne.nombre)} mesure(s) enregistrée(s)
                </p>
              </div>
            </article>
          ))}
        </div>
      )}

      <Onglets
        onglets={[
          { cle: 'resultats', label: 'Projets terminés', compteur: projetsTermines.length },
          { cle: 'mesures', label: 'Indicateurs mesurés', compteur: mesures.length },
        ]}
        actif={ongletActif}
        onChange={setOngletActif}
      />

      {/* ================= Projets termines ================= */}
      {ongletActif === 'resultats' && (
        <>
          <Panneau
            titre="Résultats des projets terminés"
            sousTitre="Un projet rejoint cet écran dès qu’il est terminé depuis sa fiche."
            serre
          >
            <Tableau
              chargement={chargementTermines}
              lignes={projetsTermines}
              colonnes={[
                {
                  cle: 'reference',
                  titre: 'Projet',
                  rendu: (projet) => (
                    <div>
                      <Link className="table__lien" to={`/admin/projects/${projet.id}`}>
                        {projet.name}
                      </Link>
                      <div className="table__secondaire">
                        {projet.reference} · {projet.location ?? 'Lieu non précisé'}
                      </div>
                    </div>
                  ),
                },
                {
                  cle: 'completedAt',
                  titre: 'Date de fin',
                  rendu: (p) => fmt.date(p.completedAt),
                },
                {
                  cle: 'status',
                  titre: 'Statut',
                  rendu: (p) => <Badge valeur={p.status} libelles={libelles.projectStatus} />,
                },
                {
                  cle: 'fundedTotal',
                  titre: 'Investi',
                  aligne: 'droite',
                  rendu: (p) => fmt.montant(p.fundedTotal, p.currency),
                },
                {
                  cle: 'spentTotal',
                  titre: 'Dépensé',
                  aligne: 'droite',
                  rendu: (p) => fmt.montant(p.spentTotal, p.currency),
                },
                {
                  cle: 'beneficiariesCount',
                  titre: 'Bénéficiaires',
                  aligne: 'droite',
                  rendu: (p) => fmt.nombre(p.beneficiariesCount),
                },
                {
                  cle: 'impactsCount',
                  titre: 'Impacts',
                  aligne: 'droite',
                  rendu: (p) => fmt.nombre(p.impactsCount),
                },
              ]}
              vide={
                <EtatVide
                  titre="Aucun projet terminé"
                  texte="Terminez un projet depuis sa fiche : il apparaîtra ici avec son résultat et sa date de fin."
                  action={
                    <Link className="btn btn--principal" to="/admin/projects">
                      Voir les projets
                    </Link>
                  }
                />
              }
            />
          </Panneau>

          {projetsTermines
            .filter((projet) => projet.outcome)
            .map((projet) => (
              <Panneau
                key={projet.id}
                titre={projet.name}
                sousTitre={`Terminé le ${fmt.date(projet.completedAt)} · ${projet.reference}`}
                actions={
                  <Link className="lien-action" to={`/admin/projects/${projet.id}?onglet=impact`}>
                    Ouvrir la fiche
                  </Link>
                }
              >
                {/*
                  La chaine de resultats, dans l'ordre ou elle se lit :
                  ce qu'on a depense, ce qu'on a fait, ce qu'on a obtenu,
                  ce que cela a change.
                */}
                <dl className="chaine">
                  <dt className="chaine__terme">Dépenses</dt>
                  <dd className="chaine__valeur">
                    <strong>{fmt.montant(projet.spentTotal, projet.currency)}</strong>
                    {' engagés sur '}
                    {fmt.montant(projet.fundedTotal, projet.currency)}
                    {' reçus'}
                  </dd>

                  <dt className="chaine__terme">Activité</dt>
                  <dd className="chaine__valeur">
                    {(activitesParProjet[projet.id] ?? []).length === 0 ? (
                      <span className="chaine__vide">
                        Aucune preuve terrain publiée pour ce projet.
                      </span>
                    ) : (
                      <ul className="chaine__liste">
                        {activitesParProjet[projet.id].map((preuve) => (
                          <li key={preuve.id}>
                            <span className="chaine__date">{fmt.date(preuve.occurredOn)}</span>
                            {preuve.description}
                          </li>
                        ))}
                      </ul>
                    )}
                  </dd>

                  <dt className="chaine__terme">Résultat</dt>
                  <dd className="chaine__valeur">{projet.outcome}</dd>

                  <dt className="chaine__terme">Impact</dt>
                  <dd className="chaine__valeur">
                    {(impactsParProjet[projet.id] ?? []).length === 0 ? (
                      <span className="chaine__vide">Aucun indicateur mesuré pour l’instant.</span>
                    ) : (
                      <ul className="chaine__liste">
                        {impactsParProjet[projet.id].map((impact) => (
                          <li key={impact.id}>
                            <strong>
                              {fmt.nombre(impact.value)} {impact.unit}
                            </strong>{' '}
                            — {impact.title}
                          </li>
                        ))}
                      </ul>
                    )}
                  </dd>
                </dl>
              </Panneau>
            ))}
        </>
      )}

      {/* ================= Indicateurs ================= */}
      {ongletActif === 'mesures' && (
        <>
          {indicateursCumules.length > 0 && (
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
                    rendu: (l) => (
                      <strong>
                        {fmt.nombre(l.total)} {l.unit ?? ''}
                      </strong>
                    ),
                  },
                  {
                    cle: 'nombre',
                    titre: 'Mesures',
                    aligne: 'droite',
                    rendu: (l) => fmt.nombre(l.nombre),
                  },
                ]}
                lignes={indicateursCumules}
                cleLigne={(l) => `${l.indicator}|${l.unit ?? ''}`}
              />
            </Panneau>
          )}

          <Panneau titre="Toutes les mesures" serre>
            <Tableau
              chargement={chargementImpacts}
              lignes={mesures}
              colonnes={[
                {
                  cle: 'projectName',
                  titre: 'Projet',
                  rendu: (i) => (
                    <Link className="table__lien" to={`/admin/projects/${i.projectId}?onglet=impact`}>
                      {i.projectName}
                    </Link>
                  ),
                },
                {
                  cle: 'title',
                  titre: 'Impact',
                  rendu: (i) => (
                    <div>
                      <div className="table__principal">{i.title}</div>
                      {i.description && (
                        <div className="table__secondaire">{fmt.tronquer(i.description, 60)}</div>
                      )}
                    </div>
                  ),
                },
                {
                  cle: 'indicator',
                  titre: 'Indicateur',
                  rendu: (l) => libelleIndicateur(l.indicator),
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
                { cle: 'measuredAt', titre: 'Mesuré le', rendu: (i) => fmt.date(i.measuredAt) },
                {
                  cle: 'actions',
                  titre: 'Actions',
                  aligne: 'droite',
                  rendu: (impact) => (
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
                        onClick={() => ouvrir('supprimer', impact)}
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
                  texte="Chiffrez ce que les projets ont permis de changer."
                  action={
                    <button
                      type="button"
                      className="btn btn--principal"
                      onClick={() => ouvrir('impact')}
                    >
                      <IconePlus />
                      Ajouter un impact
                    </button>
                  }
                />
              }
            />
          </Panneau>
        </>
      )}

      <ImpactModale
        ouverte={modale.nom === 'impact'}
        impact={modale.cible}
        projets={tousProjets?.items ?? []}
        indicateurs={catalogue?.indicators ?? []}
        onFermer={fermer}
        onEnregistre={apresEnregistrement}
      />

      <ModaleConfirmation
        ouverte={modale.nom === 'supprimer'}
        titre="Supprimer cet impact ?"
        message="Cette mesure sera retirée du suivi du projet."
        onFermer={fermer}
        onConfirmer={supprimer}
        envoi={envoi}
        erreur={erreurAction}
        libelleConfirmer="Supprimer"
        danger
      />
    </>
  );
}
