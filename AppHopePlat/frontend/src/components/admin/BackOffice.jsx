import { useState } from 'react';

import { IconePlus } from './AdminIcons.jsx';
import { ChampTexte, ModaleFormulaire } from './forms.jsx';
import { Alerte, Badge, EtatVide, Panneau, Tableau } from './ui.jsx';
import { useChargement, useSoumission } from '../../hooks/useChargement.js';
import { api, messageErreur } from '../../services/api.js';
import * as fmt from '../../utils/format.js';

/**
 * L'onglet Back office des utilisateurs : les comptes de l'equipe crees
 * par l'administrateur principal, en deux roles.
 *
 * A la creation, le mot de passe est genere par le serveur et part par
 * courriel avec un lien direct vers la connexion. Il ne s'affiche ici
 * que si le courriel n'a pas pu partir.
 */
const ROLES = [
  {
    cle: 'ADMIN',
    libelle: 'Admin',
    texte: 'Gère les comptes des donateurs, bénévoles et bailleurs, et suit les projets. Ne voit pas le back office.',
  },
  {
    cle: 'MANAGER',
    libelle: 'Manager',
    texte: 'Consulte l’espace et crée ou modifie les projets. Ne gère pas les utilisateurs.',
  },
];
const CLE_DU_ROLE = { GESTIONNAIRE: 'ADMIN', MANAGER: 'MANAGER' };

/** Le mot de passe a transmettre en personne, quand le courriel n'est pas parti. */
function MotDePasseATransmettre({ resultat, onFermer }) {
  const [copie, setCopie] = useState(false);
  if (!resultat) return null;
  return (
    <div className={`backoffice__resultat${resultat.motDePasseProvisoire ? ' backoffice__resultat--alerte' : ''}`} role="status">
      <p>{resultat.message}</p>
      {resultat.motDePasseProvisoire && (
        <p className="backoffice__secret">
          <code>{resultat.motDePasseProvisoire}</code>
          <button
            type="button"
            className="btn btn--neutre btn--petit"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(resultat.motDePasseProvisoire);
                setCopie(true);
              } catch {
                setCopie(false);
              }
            }}
          >
            {copie ? 'Copié' : 'Copier'}
          </button>
        </p>
      )}
      <button type="button" className="backoffice__fermer" onClick={onFermer} aria-label="Masquer ce message">
        ×
      </button>
    </div>
  );
}

function CreationModale({ ouverte, onFermer, onCree }) {
  const [champs, setChamps] = useState({ fullName: '', email: '', role: 'MANAGER' });
  const { envoi, erreur, soumettre } = useSoumission();

  async function enregistrer() {
    await soumettre(
      async () => {
        const { data } = await api.post('/admin/backoffice', champs);
        return data;
      },
      {
        onSucces: (resultat) => {
          setChamps({ fullName: '', email: '', role: 'MANAGER' });
          onCree(resultat);
        },
      }
    );
  }

  return (
    <ModaleFormulaire
      ouverte={ouverte}
      titre="Ajouter un utilisateur back office"
      sousTitre="Un mot de passe est généré et envoyé par courriel, avec un lien direct vers son espace."
      onFermer={onFermer}
      onSoumettre={enregistrer}
      envoi={envoi}
      erreur={erreur}
      libelleValider="Créer et envoyer les accès"
    >
      <div className="formulaire-grille">
        <ChampTexte
          label="Nom complet"
          id="backoffice-nom"
          obligatoire
          required
          value={champs.fullName}
          onChange={(e) => setChamps((c) => ({ ...c, fullName: e.target.value }))}
          placeholder="Ex. Njara Rakoto"
          disabled={envoi}
        />
        <ChampTexte
          label="Adresse électronique"
          id="backoffice-email"
          type="email"
          obligatoire
          required
          value={champs.email}
          onChange={(e) => setChamps((c) => ({ ...c, email: e.target.value }))}
          placeholder="prenom@exemple.mg"
          aide="Elle sert d’identifiant de connexion et reçoit le mot de passe."
          disabled={envoi}
        />
        <fieldset className="backoffice__roles">
          <legend className="champ-admin__label">Rôle</legend>
          {ROLES.map((role) => (
            <label key={role.cle} className={`backoffice__role${champs.role === role.cle ? ' backoffice__role--choisi' : ''}`}>
              <input
                type="radio"
                name="backoffice-role"
                value={role.cle}
                checked={champs.role === role.cle}
                onChange={() => setChamps((c) => ({ ...c, role: role.cle }))}
                disabled={envoi}
              />
              <span className="backoffice__role-titre">{role.libelle}</span>
              <span className="backoffice__role-texte">{role.texte}</span>
            </label>
          ))}
        </fieldset>
      </div>
    </ModaleFormulaire>
  );
}

export default function BackOffice() {
  const { donnees, chargement, erreur, recharger } = useChargement(
    () => api.get('/admin/backoffice').then((r) => r.data),
    []
  );
  const [creation, setCreation] = useState(false);
  const [resultat, setResultat] = useState(null);
  const [refus, setRefus] = useState('');
  const [enCours, setEnCours] = useState(null);

  async function agir(id, action) {
    setRefus('');
    setEnCours(id);
    try {
      const { data } = await action();
      if (data?.message) setResultat(data);
      recharger();
    } catch (echec) {
      setRefus(messageErreur(echec, 'L’action n’a pas pu être faite.'));
    } finally {
      setEnCours(null);
    }
  }

  const comptes = donnees?.items ?? [];

  return (
    <Panneau
      titre="Back office"
      sousTitre="Les comptes de l’équipe que vous créez : Admin (gère les utilisateurs) ou Manager (crée les projets)."
      actions={
        <button type="button" className="btn btn--principal btn--petit" onClick={() => setCreation(true)}>
          <IconePlus />
          Ajouter un utilisateur back office
        </button>
      }
      serre
    >
      <MotDePasseATransmettre resultat={resultat} onFermer={() => setResultat(null)} />
      {refus && <Alerte>{refus}</Alerte>}
      {erreur && <Alerte>{erreur}</Alerte>}

      <Tableau
        empilable
        chargement={chargement && !donnees}
        lignes={comptes}
        cleLigne={(c) => c.id}
        colonnes={[
          {
            cle: 'nom',
            titre: 'Nom',
            rendu: (c) => (
              <div>
                <div className="table__principal">{c.fullName}</div>
                <div className="table__secondaire">{c.email}</div>
              </div>
            ),
          },
          {
            cle: 'role',
            titre: 'Rôle',
            rendu: (c) => (
              <select
                className="backoffice__choix-role"
                aria-label={`Rôle de ${c.fullName}`}
                value={CLE_DU_ROLE[c.role]}
                disabled={enCours === c.id}
                onChange={(e) => agir(c.id, () => api.patch(`/admin/backoffice/${c.id}`, { role: e.target.value }))}
              >
                <option value="ADMIN">Admin</option>
                <option value="MANAGER">Manager</option>
              </select>
            ),
          },
          {
            cle: 'statut',
            titre: 'Statut',
            rendu: (c) => (
              <Badge
                valeur={c.status}
                libelles={{ ACTIVE: 'Actif', SUSPENDED: 'Suspendu' }}
                couleur={c.status === 'ACTIVE' ? 'vert' : 'gris'}
              />
            ),
          },
          {
            cle: 'connexion',
            titre: 'Dernière connexion',
            rendu: (c) => (c.lastLoginAt ? fmt.depuis(c.lastLoginAt) : <span className="table__secondaire">Jamais</span>),
          },
          {
            cle: 'actions',
            titre: 'Actions',
            aligne: 'droite',
            rendu: (c) => (
              <span className="actions-ligne">
                <button
                  type="button"
                  className="lien-action"
                  disabled={enCours === c.id}
                  onClick={() => agir(c.id, () => api.post(`/admin/backoffice/${c.id}/acces`))}
                >
                  Renvoyer un mot de passe
                </button>
                <button
                  type="button"
                  className={`lien-action${c.status === 'ACTIVE' ? ' lien-action--danger' : ''}`}
                  disabled={enCours === c.id}
                  onClick={() =>
                    agir(c.id, () =>
                      api.patch(`/admin/backoffice/${c.id}`, { status: c.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE' })
                    )
                  }
                >
                  {c.status === 'ACTIVE' ? 'Suspendre' : 'Réactiver'}
                </button>
              </span>
            ),
          },
        ]}
        vide={
          <EtatVide
            titre="Aucun compte back office"
            texte="Créez un Admin pour gérer les utilisateurs, ou un Manager pour les projets. Ses accès partent par courriel."
          />
        }
      />

      <CreationModale
        ouverte={creation}
        onFermer={() => setCreation(false)}
        onCree={(r) => {
          setCreation(false);
          setResultat(r);
          recharger();
        }}
      />
    </Panneau>
  );
}
