import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { IconePlus, IconeProjets } from '../../components/admin/AdminIcons.jsx';
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
import { urlMedia } from '../../services/api.js';
import * as catalogService from '../../services/catalog.service.js';
import * as projectService from '../../services/project.service.js';
import * as fmt from '../../utils/format.js';

/** Le filtre par type, a cote de celui des statuts. */
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

/**
 * L'image du projet, en vignette devant son nom : on reconnait un projet
 * a sa photo plus vite qu'a son intitule. Une video montre une image de
 * son debut ; sans media, un emplacement neutre garde les lignes
 * alignees. Elle mene a la fiche, comme le nom.
 */
function VignetteProjet({ projet }) {
  const video = projet.mediaType === 'VIDEO';
  return (
    <Link
      to={`/admin/projects/${projet.id}`}
      className={`table__vignette${video ? ' table__vignette--video' : ''}${
        projet.mediaUrl ? '' : ' table__vignette--vide'
      }`}
      // Le nom, juste a cote, porte deja le lien : la vignette ne
      // l'annonce pas une seconde fois.
      tabIndex={-1}
      aria-hidden="true"
    >
      {!projet.mediaUrl ? (
        <IconeProjets />
      ) : video ? (
        <video src={`${urlMedia(projet.mediaUrl)}#t=0.5`} muted playsInline preload="metadata" />
      ) : (
        <img src={urlMedia(projet.mediaUrl)} alt="" loading="lazy" decoding="async" />
      )}
    </Link>
  );
}

/**
 * Liste des projets.
 *
 * Chaque ligne repond aux questions de l'ecran "Voir les projets" : la
 * photo et l'identifiant, combien a été investi, où en est le
 * financement, et les actions Modifier / Terminer / Supprimer. Les
 * donateurs se lisent dans la fiche du projet, onglet Financement.
 */
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

        <Tableau
          chargement={chargement}
          lignes={projets}
          colonnes={[
            {
              cle: 'reference',
              titre: 'Projet',
              rendu: (projet) => (
                <div className="table__projet">
                  <VignetteProjet projet={projet} />
                  <div>
                    <Link className="table__lien" to={`/admin/projects/${projet.id}`}>
                      {projet.name}
                    </Link>
                    {/* Seul le projet interne porte l'etiquette : les projets
                        HOPE sont la regle, les marquer tous ferait du bruit. */}
                    {projet.projectType === 'INTERNAL' && (
                      <span className="badge badge--violet table__etiquette">
                        {libellesType.INTERNAL ?? 'Projet interne'}
                      </span>
                    )}
                    <div className="table__secondaire">
                      {projet.reference} · {projet.categoryName ?? 'Sans catégorie'}
                      {projet.location ? ` · ${projet.location}` : ''}
                    </div>
                  </div>
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
              titre: 'Somme investie',
              aligne: 'droite',
              rendu: (projet) => (
                <div>
                  <strong>{fmt.montant(projet.fundedTotal, projet.currency)}</strong>
                  <div className="table__secondaire table__secondaire--repliable">
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
                <div className="cellule-actions cellule-actions--repliable">
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
