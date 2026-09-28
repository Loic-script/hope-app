import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import { BeneficiaireModale } from '../../components/admin/modales.jsx';
import Visage from '../../components/admin/Visage.jsx';
import {
  Alerte,
  Badge,
  BarreOutils,
  BoutonAjout,
  CelluleDouble,
  EntetePage,
  EtatVide,
  Panneau,
  Tableau,
} from '../../components/admin/ui.jsx';
import { useChargement } from '../../hooks/useChargement.js';
import * as beneficiaryService from '../../services/beneficiary.service.js';
import * as catalogService from '../../services/catalog.service.js';
import * as projectService from '../../services/project.service.js';
import * as fmt from '../../utils/format.js';

/** Les trois vues de la liste. */
const FILTRES = [
  { valeur: 'tous', label: 'Tous' },
  { valeur: 'ACTIVE', label: 'Actifs' },
  { valeur: 'INACTIVE', label: 'Inactifs' },
];

/**
 * Ecran Beneficiaires : qui a ete aide.
 *
 * Le pendant des donateurs -- l'autre bout de l'argent. Jusqu'ici, un
 * beneficiaire ne se voyait que depuis la fiche du projet auquel il est
 * rattache : impossible de savoir combien de personnes HOPE suit en
 * tout, ni de retrouver quelqu'un sans se souvenir de son projet.
 *
 * Ces donnees sont personnelles et restent internes a l'espace
 * administrateur : aucune route publique ne les sert.
 */
export default function BeneficiariesPage() {
  const navigate = useNavigate();
  const [parametres, setParametres] = useSearchParams();
  const [recherche, setRecherche] = useState('');
  const [filtre, setFiltre] = useState('tous');
  const [modale, setModale] = useState({ ouverte: false, cible: null });

  // Ouverture directe depuis l'action rapide de l'accueil. Le parametre
  // est efface aussitot : un rafraichissement ne doit pas rouvrir le
  // formulaire, et un retour arriere non plus.
  useEffect(() => {
    if (parametres.get('nouveau') === '1') {
      setModale({ ouverte: true, cible: null });
      setParametres({}, { replace: true });
    }
  }, [parametres, setParametres]);

  const { donnees, chargement, erreur, recharger } = useChargement(
    () => beneficiaryService.lister(),
    []
  );
  const { donnees: catalogue } = useChargement(() => catalogService.recuperer(), []);
  // Les projets proposes pour rattacher une nouvelle fiche.
  const { donnees: listeProjets } = useChargement(() => projectService.lister({ pageSize: 200 }), []);

  const libelles = catalogue?.labels ?? {};
  const tous = useMemo(() => donnees?.items ?? [], [donnees]);

  /*
   * Recherche et filtre s'appliquent ici plutot que cote serveur : la
   * liste tient en memoire -- une association suit des centaines de
   * personnes, pas des centaines de milliers -- et filtrer sans
   * aller-retour rend la frappe immediate.
   */
  const affiches = useMemo(() => {
    const terme = recherche.trim().toLowerCase();
    return tous.filter((personne) => {
      if (filtre !== 'tous' && personne.status !== filtre) return false;
      if (terme === '') return true;
      return [personne.fullName, personne.city, personne.typeLabel, personne.projectNames]
        .filter(Boolean)
        .some((champ) => champ.toLowerCase().includes(terme));
    });
  }, [tous, recherche, filtre]);

  const chiffres = useMemo(
    () => ({
      total: tous.length,
      actifs: tous.filter((personne) => personne.status === 'ACTIVE').length,
      rattaches: tous.filter((personne) => personne.projectsCount > 0).length,
      sansProjet: tous.filter((personne) => !personne.projectsCount).length,
    }),
    [tous]
  );

  function fermer() {
    setModale({ ouverte: false, cible: null });
  }

  return (
    <>
      <EntetePage
        titre="Bénéficiaires"
        accroche="Les personnes que HOPE accompagne. Données personnelles : elles restent internes à l’espace administrateur."
        actions={
          <BoutonAjout onClick={() => setModale({ ouverte: true, cible: null })}>
            Ajouter un bénéficiaire
          </BoutonAjout>
        }
      />

      {erreur && <Alerte>{erreur}</Alerte>}

      <div className="cartes-chiffres">
        <div className="carte-chiffre">
          <p className="carte-chiffre__libelle">Bénéficiaires suivis</p>
          <p className="carte-chiffre__valeur">{fmt.nombre(chiffres.total)}</p>
        </div>
        <div className="carte-chiffre">
          <p className="carte-chiffre__libelle">Actifs</p>
          <p className="carte-chiffre__valeur">{fmt.nombre(chiffres.actifs)}</p>
        </div>
        <div className="carte-chiffre">
          <p className="carte-chiffre__libelle">Rattachés à un projet</p>
          <p className="carte-chiffre__valeur">{fmt.nombre(chiffres.rattaches)}</p>
        </div>
        {/*
          Le chiffre qui appelle une action : une personne enregistree que
          rien ne rattache a un projet ne recevra rien.
        */}
        <div className="carte-chiffre">
          <p className="carte-chiffre__libelle">Sans projet</p>
          <p className="carte-chiffre__valeur">{fmt.nombre(chiffres.sansProjet)}</p>
        </div>
      </div>

      <Panneau serre>
        <BarreOutils
          recherche={recherche}
          onRecherche={setRecherche}
          placeholder="Rechercher un nom, une ville, un projet…"
          filtres={FILTRES}
          filtreActif={filtre}
          onFiltre={setFiltre}
          compteur={`${affiches.length} bénéficiaire(s)`}
        />

        <Tableau
          chargement={chargement && !donnees}
          lignes={affiches}
          cleLigne={(personne) => personne.id}
          // Une ligne ouvre le profil de la personne.
          onLigne={(personne) => navigate(`/admin/beneficiaries/${personne.id}`)}
          colonnes={[
            {
              cle: 'fullName',
              titre: 'Bénéficiaire',
              // Le visage d'abord : il dit qui c'est avant le nom.
              rendu: (personne) => (
                <span className="cellule-visage">
                  <Visage src={personne.photoUrl} nom={personne.fullName} />
                  <CelluleDouble
                    principal={personne.fullName}
                    secondaire={[personne.city, personne.country].filter(Boolean).join(' · ')}
                  />
                </span>
              ),
            },
            {
              cle: 'beneficiaryType',
              titre: 'Type',
              rendu: (personne) => (
                <Badge valeur={personne.beneficiaryType} libelles={libelles.beneficiaryType} />
              ),
            },
            {
              cle: 'age',
              titre: 'Âge',
              aligne: 'droite',
              // Une famille n'a pas d'age, et une date de naissance
              // inconnue est frequente sur le terrain.
              rendu: (personne) => (personne.age === null ? '—' : `${personne.age} ans`),
            },
            {
              cle: 'gender',
              titre: 'Genre',
              rendu: (personne) =>
                personne.gender ? (libelles.gender?.[personne.gender] ?? personne.gender) : '—',
            },
            {
              cle: 'projectNames',
              titre: 'Projets',
              rendu: (personne) =>
                personne.projectsCount > 0 ? (
                  <CelluleDouble
                    principal={`${personne.projectsCount} projet(s)`}
                    secondaire={fmt.tronquer(personne.projectNames, 46)}
                  />
                ) : (
                  <span className="table__secondaire">Aucun</span>
                ),
            },
            {
              cle: 'spentTotal',
              titre: 'Dépensé',
              aligne: 'droite',
              rendu: (personne) =>
                Number(personne.spentTotal) > 0 ? (
                  <CelluleDouble
                    principal={fmt.montant(personne.spentTotal)}
                    secondaire={`${personne.expensesCount} dépense(s)`}
                  />
                ) : (
                  <span className="table__secondaire">—</span>
                ),
            },
            {
              cle: 'status',
              titre: 'Statut',
              rendu: (personne) => (
                <Badge valeur={personne.status} libelles={libelles.beneficiaryStatus} />
              ),
            },
            {
              cle: 'actions',
              titre: 'Actions',
              aligne: 'droite',
              rendu: (personne) => (
                <span className="actions-ligne">
                  <Link className="lien-action" to={`/admin/beneficiaries/${personne.id}`}>
                    Profil
                  </Link>
                  <button
                    type="button"
                    className="lien-action"
                    onClick={() => setModale({ ouverte: true, cible: personne })}
                  >
                    Modifier
                  </button>
                </span>
              ),
            },
          ]}
          vide={
            <EtatVide
              titre={
                tous.length === 0
                  ? 'Aucun bénéficiaire enregistré'
                  : 'Aucun bénéficiaire ne correspond'
              }
              texte={
                tous.length === 0
                  ? 'Enregistrez les personnes accompagnées : ce sont elles que mesurent les impacts.'
                  : 'Modifiez la recherche ou changez de filtre.'
              }
              action={
                tous.length === 0 ? (
                  <BoutonAjout onClick={() => setModale({ ouverte: true, cible: null })}>
                    Ajouter un bénéficiaire
                  </BoutonAjout>
                ) : null
              }
            />
          }
        />
      </Panneau>

      {/*
        Le rattachement a un projet ne se fait pas ici mais depuis la
        fiche du projet, ou l'on sait ce qu'on rattache et pourquoi.
      */}
      <p className="mention-page">
        Pour rattacher un bénéficiaire à un projet, ouvrez la fiche du projet, onglet{' '}
        <Link to="/admin/projects">Bénéficiaires</Link>.
      </p>

      <BeneficiaireModale
        ouverte={modale.ouverte}
        beneficiaire={modale.cible}
        libelles={libelles}
        projets={listeProjets?.items ?? []}
        categories={catalogue?.expenseCategories ?? []}
        onFermer={fermer}
        onEnregistre={() => {
          fermer();
          recharger();
        }}
      />
    </>
  );
}
