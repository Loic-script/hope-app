import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { IconePlus } from '../../components/admin/AdminIcons.jsx';
import { ModaleConfirmation } from '../../components/admin/forms.jsx';
import { TerminerProjetModale } from '../../components/admin/modales.jsx';
import {
  Alerte,
  Badge,
  BarreOutils,
  EntetePage,
  EtatVide,
  Panneau,
  Progression,
  Tableau,
} from '../../components/admin/ui.jsx';
import { useChargement, useSoumission } from '../../hooks/useChargement.js';
import * as catalogService from '../../services/catalog.service.js';
import * as projectService from '../../services/project.service.js';
import * as fmt from '../../utils/format.js';

const FILTRES = [
  { valeur: 'TOUS', label: 'Tous' },
  { valeur: 'IN_PROGRESS', label: 'En cours' },
  { valeur: 'COMPLETED', label: 'Terminés' },
  { valeur: 'ARCHIVED', label: 'Archivés' },
];

/**
 * Liste des projets.
 *
 * Chaque ligne repond aux questions de l'ecran "Voir les projets" :
 * l'identifiant, qui a donné, combien a été investi, où en est le
 * financement, et les actions Modifier / Terminer / Supprimer.
 */
export default function ProjectsPage() {
  const [parametres, setParametres] = useSearchParams();

  const [recherche, setRecherche] = useState(parametres.get('search') ?? '');
  const [rechercheAppliquee, setRechercheAppliquee] = useState(parametres.get('search') ?? '');
  const [statut, setStatut] = useState(parametres.get('status') ?? 'TOUS');
  const [modale, setModale] = useState({ nom: null, cible: null });

  const ouvrir = (nom, cible = null) => setModale({ nom, cible });
  const fermer = () => setModale({ nom: null, cible: null });

  useEffect(() => {
    const minuterie = setTimeout(() => setRechercheAppliquee(recherche.trim()), 300);
    return () => clearTimeout(minuterie);
  }, [recherche]);

  useEffect(() => {
    const nouveaux = {};
    if (rechercheAppliquee) nouveaux.search = rechercheAppliquee;
    if (statut !== 'TOUS') nouveaux.status = statut;
    setParametres(nouveaux, { replace: true });
  }, [rechercheAppliquee, statut, setParametres]);

  const { donnees, chargement, erreur, recharger } = useChargement(
    () =>
      projectService.lister({
        search: rechercheAppliquee || undefined,
        status: statut === 'TOUS' ? undefined : statut,
        includeArchived: statut === 'TOUS' ? true : undefined,
        pageSize: 100,
      }),
    [rechercheAppliquee, statut]
  );

  const { donnees: catalogue } = useChargement(() => catalogService.recuperer(), []);
  const libelles = catalogue?.labels?.projectStatus ?? {};

  const { envoi, erreur: erreurAction, setErreur, soumettre } = useSoumission();

  function demander(nom, projet) {
    setErreur('');
    ouvrir(nom, projet);
  }

  async function supprimer() {
    await soumettre(() => projectService.supprimer(modale.cible.id), {
      onSucces: () => {
        fermer();
        recharger();
      },
    });
  }

  async function archiver() {
    await soumettre(() => projectService.archiver(modale.cible.id), {
      onSucces: () => {
        fermer();
        recharger();
      },
    });
  }

  const projets = donnees?.items ?? [];

  return (
    <>
      <EntetePage
        titre="Projets"
        accroche="Chaque projet porte son budget nécessaire, ses donateurs, ses dépenses, ses bénéficiaires et son impact."
        actions={
          <Link className="btn btn--principal" to="/admin/projects/new">
            <IconePlus />
            Créer un projet
          </Link>
        }
      />

      {erreur && <Alerte>{erreur}</Alerte>}
      {erreurAction && modale.nom === null && <Alerte>{erreurAction}</Alerte>}

      <Panneau serre>
        <BarreOutils
          recherche={recherche}
          onRecherche={setRecherche}
          placeholder="Rechercher un projet, un lieu, un responsable, une référence…"
          filtres={FILTRES}
          filtreActif={statut}
          onFiltre={setStatut}
          compteur={donnees ? `${fmt.nombre(donnees.total ?? projets.length)} projet(s)` : undefined}
        />

        <Tableau
          chargement={chargement}
          lignes={projets}
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
                    {projet.reference} · {projet.categoryName ?? 'Sans catégorie'}
                    {projet.location ? ` · ${projet.location}` : ''}
                  </div>
                </div>
              ),
            },
            {
              cle: 'donorNames',
              titre: 'Donateurs',
              rendu: (projet) =>
                projet.donorsCount > 0 ? (
                  <div>
                    <div>{fmt.tronquer(projet.donorNames, 38)}</div>
                    <div className="table__secondaire">
                      {projet.donorsCount} donateur(s) · {projet.donationsCount} don(s)
                    </div>
                  </div>
                ) : (
                  <span style={{ color: 'var(--admin-texte-faible)' }}>Aucun don direct</span>
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
              titre: 'Somme investie',
              aligne: 'droite',
              rendu: (projet) => (
                <div>
                  <strong>{fmt.montant(projet.fundedTotal, projet.currency)}</strong>
                  <div className="table__secondaire">
                    dont {fmt.montant(projet.investedHopeTotal, projet.currency)} du fonds HOPE
                  </div>
                </div>
              ),
            },
            {
              cle: 'fundingRate',
              titre: 'Financement',
              rendu: (p) => <Progression valeur={p.fundingRate} />,
            },
            {
              cle: 'status',
              titre: 'Statut',
              rendu: (p) => <Badge valeur={p.status} libelles={libelles} />,
            },
            {
              cle: 'actions',
              titre: 'Actions',
              aligne: 'droite',
              rendu: (projet) => (
                <div className="cellule-actions">
                  <Link className="lien-action" to={`/admin/projects/${projet.id}`}>
                    Voir
                  </Link>
                  {projet.status === 'IN_PROGRESS' && (
                    <>
                      <Link className="lien-action" to={`/admin/projects/${projet.id}/edit`}>
                        Modifier
                      </Link>
                      <button
                        type="button"
                        className="lien-action"
                        onClick={() => demander('terminer', projet)}
                      >
                        Terminer
                      </button>
                      <button
                        type="button"
                        className="lien-action lien-action--danger"
                        onClick={() => demander('supprimer', projet)}
                      >
                        Supprimer
                      </button>
                    </>
                  )}
                  {projet.status === 'COMPLETED' && (
                    <button
                      type="button"
                      className="lien-action"
                      onClick={() => demander('archiver', projet)}
                    >
                      Archiver
                    </button>
                  )}
                </div>
              ),
            },
          ]}
          vide={
            <EtatVide
              titre={
                rechercheAppliquee || statut !== 'TOUS'
                  ? 'Aucun projet ne correspond à ces critères'
                  : 'Aucun projet enregistré'
              }
              texte={
                rechercheAppliquee || statut !== 'TOUS'
                  ? 'Modifiez la recherche ou changez de filtre.'
                  : 'Créez un premier projet pour suivre son financement et son impact.'
              }
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

      <TerminerProjetModale
        ouverte={modale.nom === 'terminer'}
        projet={modale.cible}
        onFermer={fermer}
        onEnregistre={() => {
          fermer();
          recharger();
        }}
      />

      <ModaleConfirmation
        ouverte={modale.nom === 'supprimer'}
        titre="Supprimer ce projet ?"
        message={
          modale.cible
            ? `« ${modale.cible.name} » sera définitivement effacé. La suppression n’est possible ` +
              'que si aucun don, investissement ou dépense ne s’y rattache : sinon, terminez le ' +
              'projet puis archivez-le pour conserver son historique.'
            : ''
        }
        onFermer={fermer}
        onConfirmer={supprimer}
        envoi={envoi}
        erreur={erreurAction}
        libelleConfirmer="Supprimer"
        danger
      />

      <ModaleConfirmation
        ouverte={modale.nom === 'archiver'}
        titre="Archiver ce projet ?"
        message={
          modale.cible
            ? `« ${modale.cible.name} » sortira des listes courantes. Ses données restent ` +
              'consultables depuis l’écran Impact, mais plus aucune écriture ne sera possible.'
            : ''
        }
        onFermer={fermer}
        onConfirmer={archiver}
        envoi={envoi}
        erreur={erreurAction}
        libelleConfirmer="Archiver"
      />
    </>
  );
}
