import { useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';

import { IconePlus } from '../../components/admin/AdminIcons.jsx';
import { ChampTexte, ChampTexteLong, ModaleFormulaire } from '../../components/admin/forms.jsx';
import { Alerte, EntetePage, LigneFiche, Panneau, Tableau } from '../../components/admin/ui.jsx';
import { useChargement, useSoumission } from '../../hooks/useChargement.js';
import { URL_API } from '../../services/api.js';
import * as catalogService from '../../services/catalog.service.js';
import * as fmt from '../../utils/format.js';

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

      <Panneau titre="Compte connecté">
        <dl className="fiche">
          <LigneFiche terme="Identifiant">{admin?.adminLog}</LigneFiche>
          <LigneFiche terme="Rôle">Administrateur HOPE</LigneFiche>
          <LigneFiche terme="Identifiant technique">{admin?.id}</LigneFiche>
          <LigneFiche terme="API">{URL_API}</LigneFiche>
        </dl>
        <p className="champ-admin__aide" style={{ marginTop: '16px' }}>
          Le mot de passe est stocké sous forme de hash bcrypt : il n’est lisible ni en base, ni
          dans l’API. Son changement depuis l’interface sera ajouté prochainement ; en attendant,
          utilisez <code>npm run db:seed -- --force</code> côté backend.
        </p>
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
