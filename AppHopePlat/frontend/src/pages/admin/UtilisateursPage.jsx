import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { IconePlus } from '../../components/admin/AdminIcons.jsx';
import {
  STATUTS_UTILISATEUR,
  LIBELLES_STATUT,
  lienProfil,
  useGestionUtilisateur,
} from '../../components/admin/GestionUtilisateur.jsx';
import { DonateurModale, DonModale } from '../../components/admin/modales.jsx';
import {
  Alerte,
  Badge,
  BarreOutils,
  EntetePage,
  EtatVide,
  Onglets,
  Panneau,
  Tableau,
} from '../../components/admin/ui.jsx';
import { useChargement } from '../../hooks/useChargement.js';
import * as catalogService from '../../services/catalog.service.js';
import * as donorService from '../../services/donor.service.js';
import * as fundService from '../../services/fund.service.js';
import * as utilisateursService from '../../services/utilisateurs.service.js';
import * as fmt from '../../utils/format.js';

const ONGLETS = ['donateurs', 'benevoles', 'bailleurs'];

/** Ce qui change d'un onglet a l'autre : les mots. */
const TEXTES = {
  donateurs: {
    colonne: 'Nom ou entreprise',
    recherche: 'Rechercher un donateur, une entreprise, une adresse…',
    vide: 'Aucun donateur',
    videTexte: 'Les donateurs inscrits en ligne et ceux que vous enregistrez apparaîtront ici.',
    unite: 'donateur(s)',
  },
  benevoles: {
    colonne: 'Nom',
    recherche: 'Rechercher un bénévole, une adresse…',
    vide: 'Aucun bénévole',
    videTexte: 'Les inscriptions apparaîtront ici, en attente de votre validation.',
    unite: 'bénévole(s)',
  },
  bailleurs: {
    colonne: 'Entreprise',
    recherche: 'Rechercher une entreprise, un contact, une adresse…',
    vide: 'Aucun bailleur',
    videTexte: 'Les demandes de partenariat apparaîtront ici, en attente de votre validation.',
    unite: 'bailleur(s)',
  },
};

/**
 * Ecran "Utilisateurs" : donateurs, benevoles et bailleurs, un onglet
 * chacun, un meme tableau -- le nom (ou celui de l'entreprise), le
 * statut, le profil, les actions.
 *
 * Modifier et supprimer valent pour tous. Activer et desactiver un
 * compte, pour les benevoles et les bailleurs : leur acces s'ouvre sur
 * decision de l'equipe. Un donateur, lui, entre des son inscription.
 *
 * Les donateurs reunissent deux origines : les comptes inscrits en
 * ligne, et les fiches que l'equipe enregistre pour rattacher des dons.
 */
export default function UtilisateursPage() {
  const [parametres, setParametres] = useSearchParams();
  const onglet = ONGLETS.includes(parametres.get('onglet')) ? parametres.get('onglet') : 'donateurs';
  const textes = TEXTES[onglet];

  const [recherche, setRecherche] = useState('');
  const [rechercheAppliquee, setRechercheAppliquee] = useState('');
  const [fenetre, setFenetre] = useState(null);

  useEffect(() => {
    const minuterie = setTimeout(() => setRechercheAppliquee(recherche.trim()), 300);
    return () => clearTimeout(minuterie);
  }, [recherche]);

  function changerOnglet(cle) {
    setRecherche('');
    setRechercheAppliquee('');
    setParametres({ onglet: cle }, { replace: true });
  }

  // Les trois listes, pour les compteurs des onglets ; la recherche ne
  // porte que sur celle qui est affichee.
  const { donnees, chargement, erreur, recharger } = useChargement(
    () =>
      Promise.all(
        ONGLETS.map((cle) =>
          utilisateursService.lister(
            cle,
            cle === onglet && rechercheAppliquee ? { recherche: rechercheAppliquee } : {}
          )
        )
      ),
    [onglet, rechercheAppliquee]
  );
  const listes = Object.fromEntries(ONGLETS.map((cle, rang) => [cle, donnees?.[rang]?.items ?? []]));
  const lignes = listes[onglet];

  const { donnees: catalogue } = useChargement(() => catalogService.recuperer(), []);
  const libelles = catalogue?.labels ?? {};

  const gestion = useGestionUtilisateur({
    onModifie: recharger,
    onSupprime: recharger,
    onStatut: recharger,
    libelles,
  });

  // Enregistrer un don depuis l'onglet des donateurs : la fenetre a
  // besoin des fiches et des projets ouverts.
  const { donnees: fiches } = useChargement(
    () => (fenetre === 'don' ? donorService.lister({}) : Promise.resolve(null)),
    [fenetre]
  );
  const { donnees: fonds } = useChargement(
    () => (fenetre === 'don' ? fundService.etat() : Promise.resolve(null)),
    [fenetre]
  );

  const enAttente = (cle) => listes[cle].filter((ligne) => ligne.statut === 'en_attente').length;

  // Quatre colonnes centrees, a largeur fixe : l'en-tete se tient au-dessus
  // de son contenu, et les colonnes ne bougent pas d'un onglet a l'autre.
  const colonnes = [
    {
      cle: 'nom',
      titre: textes.colonne,
      aligne: 'centre',
      largeur: '34%',
      rendu: (ligne) => (
        <div>
          <Link className="table__lien" to={lienProfil(ligne, onglet)}>
            {ligne.nom ?? 'Nom à renseigner'}
          </Link>
          {ligne.sousTitre && <div className="table__secondaire">{ligne.sousTitre}</div>}
        </div>
      ),
    },
    {
      cle: 'statut',
      titre: 'Statut',
      aligne: 'centre',
      largeur: '16%',
      rendu: (ligne) => (
        <div>
          <Badge
            valeur={ligne.statut}
            libelles={LIBELLES_STATUT}
            couleur={STATUTS_UTILISATEUR[ligne.statut]?.couleur}
          />
          {ligne.parcoursInacheve && (
            <div className="table__secondaire">Parcours d’accueil à terminer</div>
          )}
        </div>
      ),
    },
    {
      cle: 'profil',
      titre: 'Profil',
      aligne: 'centre',
      largeur: '16%',
      rendu: (ligne) => (
        <Link
          className="lien-action"
          to={lienProfil(ligne, onglet)}
          aria-label={`Voir le profil de ${ligne.nom ?? 'cet utilisateur'}`}
        >
          Voir le profil
        </Link>
      ),
    },
    {
      cle: 'actions',
      titre: 'Actions',
      aligne: 'centre',
      largeur: '34%',
      rendu: (ligne) => {
        const cible = { genre: ligne.genre, id: ligne.id, nom: ligne.nom, onglet };
        const nom = ligne.nom ?? 'cet utilisateur';
        // Activer, desactiver : l'acces des benevoles et des bailleurs.
        const gereLAcces = onglet !== 'donateurs';
        return (
          <div className="cellule-actions cellule-actions--centre">
            {gereLAcces && ligne.statut !== 'actif' && (
              <button
                type="button"
                className="lien-action lien-action--succes"
                onClick={() => gestion.demander('activer', cible)}
                disabled={gestion.envoi}
                aria-label={`Activer le compte de ${nom}`}
              >
                Activer
              </button>
            )}
            {gereLAcces && ligne.statut === 'actif' && (
              <button
                type="button"
                className="lien-action"
                onClick={() => gestion.demander('desactiver', cible)}
                aria-label={`Désactiver le compte de ${nom}`}
              >
                Désactiver
              </button>
            )}
            <button
              type="button"
              className="lien-action"
              onClick={() => gestion.demander('modifier', cible)}
              aria-label={`Modifier ${nom}`}
            >
              Modifier
            </button>
            <button
              type="button"
              className="lien-action lien-action--danger"
              onClick={() => gestion.demander('supprimer', cible)}
              aria-label={`Supprimer ${nom}`}
            >
              Supprimer
            </button>
          </div>
        );
      },
    },
  ];

  return (
    <>
      <EntetePage
        titre="Utilisateurs"
        accroche="Donateurs, bénévoles et bailleurs : leurs comptes, leurs profils, et ce qu’ils ont apporté à HOPE."
        actions={
          onglet === 'donateurs' && (
            <>
              <Link className="btn btn--neutre" to="/admin/dons">
                Dons reçus
              </Link>
              <button type="button" className="btn btn--neutre" onClick={() => setFenetre('donateur')}>
                Nouveau donateur
              </button>
              <button type="button" className="btn btn--principal" onClick={() => setFenetre('don')}>
                <IconePlus />
                Enregistrer un don
              </button>
            </>
          )
        }
      />

      {erreur && <Alerte>{erreur}</Alerte>}
      {gestion.erreur && <Alerte>{gestion.erreur}</Alerte>}

      <Onglets
        onglets={[
          { cle: 'donateurs', label: 'Donateurs', compteur: listes.donateurs.length },
          {
            cle: 'benevoles',
            label: enAttente('benevoles') ? `Bénévoles · ${enAttente('benevoles')} en attente` : 'Bénévoles',
            compteur: listes.benevoles.length,
          },
          {
            cle: 'bailleurs',
            label: enAttente('bailleurs') ? `Bailleurs · ${enAttente('bailleurs')} en attente` : 'Bailleurs',
            compteur: listes.bailleurs.length,
          },
        ]}
        actif={onglet}
        onChange={changerOnglet}
      />

      <Panneau serre>
        <BarreOutils
          recherche={recherche}
          onRecherche={setRecherche}
          placeholder={textes.recherche}
          compteur={`${fmt.nombre(lignes.length)} ${textes.unite}`}
        />
        <Tableau
          chargement={chargement && !donnees}
          lignes={lignes}
          cleLigne={(ligne) => ligne.cle}
          // L'ancre que visent les anciens liens (#compte-xxx).
          idLigne={(ligne) => ligne.cle}
          colonnes={colonnes}
          vide={
            <EtatVide
              titre={rechercheAppliquee ? 'Aucun résultat' : textes.vide}
              texte={
                rechercheAppliquee
                  ? `Personne ne correspond à « ${rechercheAppliquee} ».`
                  : textes.videTexte
              }
            />
          }
        />
      </Panneau>

      {gestion.fenetres}

      <DonateurModale
        ouverte={fenetre === 'donateur'}
        libelles={libelles}
        onFermer={() => setFenetre(null)}
        onEnregistre={() => {
          setFenetre(null);
          recharger();
        }}
      />

      <DonModale
        ouverte={fenetre === 'don'}
        donateurs={fiches?.items ?? []}
        projets={fonds?.projects ?? []}
        libelles={libelles}
        moyensPaiement={catalogue?.paymentMethods ?? {}}
        devises={catalogue?.currencies ?? ['MGA']}
        onFermer={() => setFenetre(null)}
        onEnregistre={() => {
          setFenetre(null);
          recharger();
        }}
      />
    </>
  );
}
