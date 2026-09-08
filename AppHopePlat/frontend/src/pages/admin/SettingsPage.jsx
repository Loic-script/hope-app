import { useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';

import { IconePlus } from '../../components/admin/AdminIcons.jsx';
import {
  ChampSelection,
  ChampTexte,
  ChampTexteLong,
  ModaleFormulaire,
} from '../../components/admin/forms.jsx';
import { Alerte, Badge, EntetePage, LigneFiche, Panneau, Tableau } from '../../components/admin/ui.jsx';
import { useChargement, useSoumission } from '../../hooks/useChargement.js';
import { URL_API } from '../../services/api.js';
import * as catalogService from '../../services/catalog.service.js';
import * as teamService from '../../services/team.service.js';
import * as fmt from '../../utils/format.js';

/** Libelles des trois roles, alignes sur team.service.js cote backend. */
const ROLES = {
  ADMIN: 'Administrateur',
  COORDINATOR: 'Coordinateur',
  VIEWER: 'Lecture seule',
};

const STATUTS = { ACTIVE: 'Actif', SUSPENDED: 'Suspendu' };

const COMPTE_VIDE = { adminLog: '', fullName: '', role: 'COORDINATOR', password: '' };

/**
 * Parametres : le compte administrateur et les donnees de reference.
 */
export default function SettingsPage() {
  const { admin } = useOutletContext();
  const [modaleOuverte, setModaleOuverte] = useState(false);
  const [nom, setNom] = useState('');
  const [description, setDescription] = useState('');

  const { donnees, chargement, erreur, recharger } = useChargement(
    () => catalogService.recuperer({ rafraichir: true }),
    []
  );

  const { envoi, erreur: erreurAction, setErreur, soumettre } = useSoumission();

  // --- Equipe et journal ---------------------------------------------
  const estAdministrateur = admin?.role === 'ADMIN';

  const [modaleCompte, setModaleCompte] = useState(false);
  const [modaleMotDePasse, setModaleMotDePasse] = useState(false);
  const [compte, setCompte] = useState(COMPTE_VIDE);
  const [motsDePasse, setMotsDePasse] = useState({ currentPassword: '', newPassword: '' });

  // Un non-administrateur recevrait 403 : on ne tente meme pas l'appel.
  const {
    donnees: equipe,
    chargement: chargementEquipe,
    recharger: rechargerEquipe,
  // Promise.resolve et non null : useChargement enchaine un .then() sur ce
  // que rend le chargeur.
  } = useChargement(
    () => (estAdministrateur ? teamService.lister() : Promise.resolve(null)),
    [estAdministrateur]
  );

  const { donnees: activite, recharger: rechargerActivite } = useChargement(
    () => teamService.journal(20),
    []
  );

  function ouvrirCompte() {
    setErreur('');
    setCompte(COMPTE_VIDE);
    setModaleCompte(true);
  }

  function ouvrirMotDePasse() {
    setErreur('');
    setMotsDePasse({ currentPassword: '', newPassword: '' });
    setModaleMotDePasse(true);
  }

  async function creerCompte() {
    await soumettre(() => teamService.creer(compte), {
      onSucces: () => {
        setModaleCompte(false);
        rechargerEquipe();
        rechargerActivite();
      },
    });
  }

  async function changerMotDePasse() {
    await soumettre(
      () => teamService.changerSonMotDePasse(motsDePasse.currentPassword, motsDePasse.newPassword),
      {
        onSucces: () => {
          setModaleMotDePasse(false);
          rechargerActivite();
        },
      }
    );
  }

  async function basculerStatut(membre) {
    const statut = membre.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    await soumettre(() => teamService.mettreAJour(membre.id, { status: statut }), {
      onSucces: () => {
        rechargerEquipe();
        rechargerActivite();
      },
    });
  }

  function ouvrir() {
    setErreur('');
    setNom('');
    setDescription('');
    setModaleOuverte(true);
  }

  async function creerCategorie() {
    await soumettre(() => catalogService.creerCategorie({ name: nom, description }), {
      onSucces: () => {
        setModaleOuverte(false);
        recharger();
      },
    });
  }

  const moyens = donnees?.paymentMethods ?? {};

  return (
    <>
      <EntetePage
        titre="Paramètres"
        accroche="Compte administrateur et données de référence de la plateforme."
      />

      {erreur && <Alerte>{erreur}</Alerte>}

      <Panneau
        titre="Compte connecté"
        actions={
          <button type="button" className="btn btn--neutre btn--petit" onClick={ouvrirMotDePasse}>
            Changer mon mot de passe
          </button>
        }
      >
        <dl className="fiche">
          <LigneFiche terme="Nom affiché">{admin?.fullName ?? admin?.adminLog}</LigneFiche>
          <LigneFiche terme="Identifiant">{admin?.adminLog}</LigneFiche>
          <LigneFiche terme="Rôle">{ROLES[admin?.role] ?? admin?.role}</LigneFiche>
          <LigneFiche terme="API">{URL_API}</LigneFiche>
        </dl>
        <p className="champ-admin__aide" style={{ marginTop: '16px' }}>
          Le mot de passe est stocké sous forme de hash bcrypt : il n’est lisible ni en base, ni
          dans l’API. Changer le vôtre demande de saisir l’actuel — une session ouverte ne suffit
          pas à s’approprier un compte.
        </p>
      </Panneau>

      {/* La gestion des comptes n'existe que pour un administrateur : le
          backend renvoie 403 aux deux autres rôles. */}
      {estAdministrateur && (
        <Panneau
          titre="Équipe HOPE"
          sousTitre="Chaque membre a son compte : c’est ce qui permet d’attribuer les actions dans le journal."
          actions={
            <button type="button" className="btn btn--principal btn--petit" onClick={ouvrirCompte}>
              <IconePlus />
              Nouveau compte
            </button>
          }
        >
          <Tableau
            colonnes={[
              { cle: 'fullName', titre: 'Membre' },
              { cle: 'adminLog', titre: 'Identifiant' },
              { cle: 'role', titre: 'Rôle' },
              { cle: 'status', titre: 'Statut' },
              { cle: 'lastLoginAt', titre: 'Dernière connexion' },
              { cle: 'actions', titre: '' },
            ]}
            lignes={(equipe?.items ?? []).map((membre) => ({
              cle: membre.id,
              fullName: <strong>{membre.fullName}</strong>,
              adminLog: membre.adminLog,
              role: <Badge valeur={membre.role} libelles={ROLES} />,
              status: <Badge valeur={membre.status} libelles={STATUTS} />,
              lastLoginAt: membre.lastLoginAt ? fmt.date(membre.lastLoginAt) : 'jamais',
              actions:
                membre.id === admin?.id ? (
                  <span className="champ-admin__aide">vous</span>
                ) : (
                  <button
                    type="button"
                    className="btn btn--neutre btn--petit"
                    onClick={() =>
                      basculerStatut(membre)
                    }
                  >
                    {membre.status === 'ACTIVE' ? 'Suspendre' : 'Réactiver'}
                  </button>
                ),
            }))}
            cleLigne="cle"
            chargement={chargementEquipe}
          />
        </Panneau>
      )}

      <Panneau
        titre="Activité récente"
        sousTitre="Qui a fait quoi. Le fil de l’accueil dit ce qui s’est passé ; celui-ci dit par qui."
      >
        {(activite?.items ?? []).length === 0 ? (
          <p className="champ-admin__aide">Aucune action enregistrée pour l’instant.</p>
        ) : (
          <ul className="journal">
            {activite.items.map((entree) => (
              <li className="journal__ligne" key={entree.id}>
                <span className="journal__auteur">{entree.authorLabel}</span>{' '}
                <span className="journal__action">{entree.label}</span>
                <span className="journal__date">{fmt.depuis(entree.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </Panneau>

      <Panneau
        titre="Catégories de projet"
        sousTitre="Elles classent les projets et regroupent les statistiques."
        actions={
          <button type="button" className="btn btn--principal" onClick={ouvrir}>
            <IconePlus />
            Nouvelle catégorie
          </button>
        }
        serre
      >
        <Tableau
          chargement={chargement}
          lignes={donnees?.categories ?? []}
          colonnes={[
            { cle: 'name', titre: 'Catégorie', rendu: (c) => <strong>{c.name}</strong> },
            { cle: 'description', titre: 'Description', rendu: (c) => c.description ?? '—' },
            {
              cle: 'projectsCount',
              titre: 'Projets',
              aligne: 'droite',
              rendu: (c) => fmt.nombre(c.projectsCount),
            },
            {
              cle: 'actions',
              titre: 'Actions',
              aligne: 'droite',
              rendu: (c) => (
                <Link className="lien-action" to={`/admin/projects?categoryId=${c.id}`}>
                  Voir les projets
                </Link>
              ),
            },
          ]}
        />
      </Panneau>

      <Panneau
        titre="Moyens de paiement"
        sousTitre="Le système propose des moyens différents selon la localisation du donateur."
      >
        <dl className="fiche">
          <LigneFiche terme="Donateur à Madagascar">
            {(moyens.LOCAL ?? []).join(', ') || '—'}
          </LigneFiche>
          <LigneFiche terme="Donateur à l’étranger">
            {(moyens.INTERNATIONAL ?? []).join(', ') || '—'}
          </LigneFiche>
        </dl>
      </Panneau>

      <Panneau titre="À propos de cette version">
        <p className="bloc-texte">
          Espace administrateur HOPE : projets et budget nécessaire, dons affectés et fonds HOPE,
          investissements justifiés, dépenses et justificatifs, bénéficiaires, impacts,
          notifications, donateurs, messagerie et statistiques.
          {'\n\n'}
          À venir : l’espace donateur (formulaire de don, historique, projets soutenus, profil) et
          le paiement en ligne.
        </p>
      </Panneau>

      <ModaleFormulaire
        ouverte={modaleCompte}
        titre="Nouveau compte"
        sousTitre="Le membre pourra se connecter immédiatement avec ces identifiants."
        onFermer={() => setModaleCompte(false)}
        onSoumettre={creerCompte}
        envoi={envoi}
        erreur={erreurAction}
        libelleValider="Créer le compte"
      >
        <ChampTexte
          label="Nom affiché"
          id="fullName"
          obligatoire
          aide="C’est ce nom qui apparaîtra dans le journal d’activité."
          value={compte.fullName}
          onChange={(e) => setCompte({ ...compte, fullName: e.target.value })}
        />
        <ChampTexte
          label="Identifiant de connexion"
          id="adminLog"
          obligatoire
          value={compte.adminLog}
          onChange={(e) => setCompte({ ...compte, adminLog: e.target.value })}
        />
        <ChampSelection
          label="Rôle"
          id="role"
          obligatoire
          options={Object.entries(ROLES).map(([valeur, label]) => ({ valeur, label }))}
          value={compte.role}
          onChange={(e) => setCompte({ ...compte, role: e.target.value })}
        />
        <ChampTexte
          label="Mot de passe"
          id="password"
          type="password"
          obligatoire
          aide="8 caractères minimum. À communiquer au membre, qui pourra le changer."
          value={compte.password}
          onChange={(e) => setCompte({ ...compte, password: e.target.value })}
        />
      </ModaleFormulaire>

      <ModaleFormulaire
        ouverte={modaleMotDePasse}
        titre="Changer mon mot de passe"
        onFermer={() => setModaleMotDePasse(false)}
        onSoumettre={changerMotDePasse}
        envoi={envoi}
        erreur={erreurAction}
        libelleValider="Changer"
      >
        <ChampTexte
          label="Mot de passe actuel"
          id="currentPassword"
          type="password"
          obligatoire
          value={motsDePasse.currentPassword}
          onChange={(e) => setMotsDePasse({ ...motsDePasse, currentPassword: e.target.value })}
        />
        <ChampTexte
          label="Nouveau mot de passe"
          id="newPassword"
          type="password"
          obligatoire
          aide="8 caractères minimum."
          value={motsDePasse.newPassword}
          onChange={(e) => setMotsDePasse({ ...motsDePasse, newPassword: e.target.value })}
        />
      </ModaleFormulaire>

      <ModaleFormulaire
        ouverte={modaleOuverte}
        titre="Nouvelle catégorie de projet"
        onFermer={() => setModaleOuverte(false)}
        onSoumettre={creerCategorie}
        envoi={envoi}
        erreur={erreurAction}
        libelleValider="Créer la catégorie"
      >
        <div className="formulaire-grille">
          <ChampTexte
            label="Nom"
            id="categorie-nom"
            obligatoire
            required
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            placeholder="Accès à l’eau"
            disabled={envoi}
            pleineLargeur
          />
          <ChampTexteLong
            label="Description"
            id="categorie-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Ce que regroupe cette catégorie"
            disabled={envoi}
          />
        </div>
      </ModaleFormulaire>
    </>
  );
}
