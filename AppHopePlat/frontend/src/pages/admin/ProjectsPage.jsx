import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import {
  IconeArchive,
  IconeCorbeille,
  IconeCrayon,
  IconePlus,
  IconeValide,
} from '../../components/admin/AdminIcons.jsx';
import { ModaleConfirmation } from '../../components/admin/forms.jsx';
import ModaleSuppressionForcee from '../../components/admin/ModaleSuppressionForcee.jsx';
import { TerminerProjetModale } from '../../components/admin/modales.jsx';
import PublicationProjet from '../../components/admin/PublicationProjet.jsx';
import {
  Alerte,
  Badge,
  BarreOutils,
  Chargement,
  EntetePage,
  EtatVide,
  Panneau,
} from '../../components/admin/ui.jsx';
import { useChargement, useSoumission } from '../../hooks/useChargement.js';
import * as catalogService from '../../services/catalog.service.js';
import { messageErreur } from '../../services/api.js';
import * as projectService from '../../services/project.service.js';
import * as fmt from '../../utils/format.js';

const TYPES = [
  { valeur: 'TOUS', label: 'Tous les types' },
  { valeur: 'HOPE', label: 'Projets HOPE' },
  { valeur: 'INTERNAL', label: 'Projets internes' },
];

const FILTRES = [
  { valeur: 'TOUS', label: 'Tous' },
  { valeur: 'IN_PROGRESS', label: 'En cours' },
  { valeur: 'COMPLETED', label: 'Terminés' },
  { valeur: 'ARCHIVED', label: 'Archivés' },
];

function ActionsProjet({ projet, onDemander }) {
  return (
    <>
      <Link
        className="btn btn--neutre btn--petit"
        to={`/admin/projects/${projet.id}`}
        aria-label={`Voir le projet ${projet.name}`}
      >
        Voir
      </Link>
      {projet.status === 'IN_PROGRESS' && (
        <>
          <Link
            className="btn btn--neutre btn--petit"
            to={`/admin/projects/${projet.id}/edit`}
            aria-label={`Modifier le projet ${projet.name}`}
          >
            <IconeCrayon />
            Modifier
          </Link>
          <button
            type="button"
            className="btn btn--neutre btn--petit"
            onClick={() => onDemander('terminer', projet)}
            aria-label={`Terminer le projet ${projet.name}`}
          >
            <IconeValide />
            Terminer
          </button>
          <button
            type="button"
            className="btn btn--danger btn--petit"
            onClick={() => onDemander('supprimer', projet)}
            aria-label={`Supprimer le projet ${projet.name}`}
          >
            <IconeCorbeille />
            Supprimer
          </button>
        </>
      )}
      {projet.status === 'COMPLETED' && (
        <>
          <button
            type="button"
            className="btn btn--neutre btn--petit"
            onClick={() => onDemander('archiver', projet)}
            aria-label={`Archiver le projet ${projet.name}`}
          >
            <IconeArchive />
            Archiver
          </button>
          <button
            type="button"
            className="btn btn--danger btn--petit"
            onClick={() => onDemander('supprimer', projet)}
            aria-label={`Supprimer le projet ${projet.name}`}
          >
            <IconeCorbeille />
            Supprimer
          </button>
        </>
      )}
    </>
  );
}

export default function ProjectsPage() {
  const [parametres, setParametres] = useSearchParams();

  const [recherche, setRecherche] = useState(parametres.get('search') ?? '');
  const [rechercheAppliquee, setRechercheAppliquee] = useState(parametres.get('search') ?? '');
  const [statut, setStatut] = useState(parametres.get('status') ?? 'TOUS');
  const [type, setType] = useState(parametres.get('projectType') ?? 'TOUS');
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
    if (type !== 'TOUS') nouveaux.projectType = type;
    setParametres(nouveaux, { replace: true });
  }, [rechercheAppliquee, statut, type, setParametres]);

  const { donnees, chargement, erreur, recharger } = useChargement(
    () =>
      projectService.lister({
        search: rechercheAppliquee || undefined,
        status: statut === 'TOUS' ? undefined : statut,
        projectType: type === 'TOUS' ? undefined : type,
        includeArchived: statut === 'TOUS' ? true : undefined,
        pageSize: 100,
      }),
    [rechercheAppliquee, statut, type]
  );

  const { donnees: catalogue } = useChargement(() => catalogService.recuperer(), []);
  const libelles = catalogue?.labels?.projectStatus ?? {};
  const libellesType = catalogue?.labels?.projectType ?? {};

  const { envoi, erreur: erreurAction, setErreur, soumettre } = useSoumission();
  const [retenu, setRetenu] = useState(null);

  function demander(nom, projet) {
    setErreur('');
    setRetenu(null);
    ouvrir(nom, projet);
  }

  async function supprimer() {
    try {
      await projectService.supprimer(modale.cible.id);
      fermer();
      recharger();
    } catch (echec) {
      const donnees = echec?.response?.data;
      if (donnees?.code === 'PROJET_AVEC_ECRITURES') {
        setRetenu(donnees.details ?? {});
        ouvrir('supprimerQuandMeme', modale.cible);
        return;
      }
      setErreur(messageErreur(echec, 'Le projet n’a pas pu être supprimé.'));
    }
  }

  async function supprimerQuandMeme() {
    await soumettre(() => projectService.supprimer(modale.cible.id, { force: true }), {
      onSucces: () => {
        fermer();
        setRetenu(null);
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
          actions={
            <select
              className="outils__selection"
              value={type}
              onChange={(evenement) => setType(evenement.target.value)}
              aria-label="Filtrer par type de projet"
            >
              {TYPES.map((option) => (
                <option key={option.valeur} value={option.valeur}>
                  {option.label}
                </option>
              ))}
            </select>
          }
        />
      </Panneau>

      {chargement ? (
        <Chargement texte="Chargement des projets…" />
      ) : projets.length === 0 ? (
        <Panneau className="publications--page">
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
        </Panneau>
      ) : (
        <div className="publications publications--page">
          {projets.map((projet, rang) => (
            <PublicationProjet
              key={projet.id}
              projet={projet}
              rang={Math.min(rang, 5)}
              etiquettes={
                <>
                  {projet.projectType === 'INTERNAL' && (
                    <span className="badge badge--violet">
                      {libellesType.INTERNAL ?? 'Projet interne'}
                    </span>
                  )}
                  <Badge valeur={projet.status} libelles={libelles} />
                </>
              }
              actions={<ActionsProjet projet={projet} onDemander={demander} />}
            />
          ))}
        </div>
      )}

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
              'que si aucun don, investissement ou dépense ne s’y rattache : sinon, archivez-le ' +
              'pour conserver son historique.'
            : ''
        }
        onFermer={fermer}
        onConfirmer={supprimer}
        envoi={envoi}
        erreur={erreurAction}
        libelleConfirmer="Supprimer"
        danger
      />

      <ModaleSuppressionForcee
        ouverte={modale.nom === 'supprimerQuandMeme'}
        projet={modale.cible}
        ecritures={retenu}
        onFermer={fermer}
        onConfirmer={supprimerQuandMeme}
        envoi={envoi}
        erreur={erreurAction}
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
