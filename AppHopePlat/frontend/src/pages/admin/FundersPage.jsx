import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import {
  Alerte,
  Badge,
  CelluleDouble,
  EntetePage,
  EtatVide,
  Onglets,
  Panneau,
  Tableau,
} from '../../components/admin/ui.jsx';
import { useChargement, useSoumission } from '../../hooks/useChargement.js';
import * as consultationService from '../../services/consultation.service.js';
import * as funderService from '../../services/funder.service.js';
import * as fmt from '../../utils/format.js';

/** Libelles des statuts de compte. */
const LIBELLES = {
  en_attente: 'En attente',
  actif: 'Actif',
  suspendu: 'Suspendu',
  supprime: 'Supprimé',
};

const COULEURS = {
  en_attente: 'ambre',
  actif: 'vert',
  suspendu: 'rouge',
  supprime: 'gris',
};

/** Libelles des types d'organisation. */
const TYPES = {
  fondation_privee: 'Fondation privée',
  entreprise: 'Entreprise',
  agence_publique: 'Agence publique',
  ong: 'ONG',
  ambassade: 'Ambassade',
};

/**
 * Comptes bailleurs.
 *
 * Une organisation candidate reste en "prospect" et son contact en
 * "en attente" jusqu'a ce que l'acces soit ouvert ici. Activer un
 * compte fait passer l'organisation a "actif" du meme geste : un
 * partenaire dont personne ne peut se connecter n'est pas encore un
 * partenaire.
 */
export default function FundersPage() {
  const navigate = useNavigate();
  const [filtre, setFiltre] = useState('');
  const { donnees, chargement, erreur, recharger } = useChargement(
    () => funderService.lister(filtre ? { statut: filtre } : {}),
    [filtre]
  );
  const { soumettre, envoi, erreur: erreurAction } = useSoumission();

  const comptes = donnees?.items ?? [];
  const compteurs = donnees?.counts ?? {};

  function agir(action) {
    soumettre(action, { onSucces: recharger });
  }

  /*
   * Ouvre l'espace du compte sous son identite.
   *
   * On navigue dans le meme onglet : chaque espace range son jeton dans
   * sa propre cle, si bien que la session d'administration reste intacte
   * et qu'un retour a /admin ne redemande pas de connexion.
   */
  function ouvrirEspace(compte) {
    soumettre(() => consultationService.consulter(compte.id), {
      onSucces: (session) => navigate(session.espace),
    });
  }

  const onglets = [
    { cle: '', label: 'Tous' },
    { cle: 'en_attente', label: 'En attente', compteur: compteurs.en_attente ?? 0 },
    { cle: 'actif', label: 'Actifs', compteur: compteurs.actif ?? 0 },
    { cle: 'suspendu', label: 'Suspendus', compteur: compteurs.suspendu ?? 0 },
  ];

  const colonnes = [
    {
      cle: 'organisation',
      titre: 'Organisation',
      rendu: (compte) => (
        <CelluleDouble
          principal={compte.raisonSociale ?? 'Organisation manquante'}
          secondaire={`${TYPES[compte.typeOrganisation] ?? compte.typeOrganisation ?? '—'}${
            compte.pays ? ` · ${compte.pays}` : ''
          }`}
        />
      ),
    },
    {
      cle: 'contact',
      titre: 'Contact',
      rendu: (compte) => (
        <CelluleDouble
          principal={`${compte.prenom} ${compte.nom}`.trim()}
          secondaire={`${compte.email}${compte.fonction ? ` · ${compte.fonction}` : ''}`}
        />
      ),
    },
    {
      cle: 'statut',
      titre: 'Compte',
      rendu: (compte) => (
        <Badge valeur={compte.statut} libelles={LIBELLES} couleur={COULEURS[compte.statut]} />
      ),
    },
    {
      cle: 'bailleurStatut',
      titre: 'Organisation',
      rendu: (compte) => (
        <Badge
          valeur={compte.bailleurStatut ?? 'prospect'}
          libelles={{
            prospect: 'Prospect',
            actif: 'Actif',
            en_pause: 'En pause',
            termine: 'Terminé',
          }}
          couleur={compte.bailleurStatut === 'actif' ? 'vert' : 'gris'}
        />
      ),
    },
    {
      cle: 'creeLe',
      titre: 'Demande du',
      rendu: (compte) => fmt.date(compte.creeLe),
    },
    {
      cle: 'actions',
      titre: '',
      rendu: (compte) => (
        <div className="tableau__actions">
            {/*
              Consulter, c'est ouvrir l'espace du compte et le voir tel
              que son occupant le voit. Seul un compte actif en a un.
            */}
            {compte.statut === 'actif' && (
              <button
                type="button"
                className="btn btn--neutre btn--petit"
                disabled={envoi}
                onClick={() => ouvrirEspace(compte)}
              >
                Consulter
              </button>
            )}
          {compte.statut !== 'actif' && (
            <button
              type="button"
              className="btn btn--principal btn--petit"
              disabled={envoi}
              onClick={() => agir(() => funderService.activer(compte.id))}
            >
              Activer
            </button>
          )}
          {compte.statut === 'actif' && (
            <button
              type="button"
              className="btn btn--neutre btn--petit"
              disabled={envoi}
              onClick={() => agir(() => funderService.changerStatut(compte.id, 'suspendu'))}
            >
              Suspendre
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <EntetePage
        fil={[{ label: 'Accueil', to: '/admin' }, { label: 'Bailleurs' }]}
        titre="Bailleurs"
        accroche="Activez les comptes pour ouvrir l’accès à l’espace partenaire."
      />

      {erreur && <Alerte>{erreur}</Alerte>}
      {erreurAction && <Alerte>{erreurAction}</Alerte>}

      <Panneau>
        <Onglets onglets={onglets} actif={filtre} onChange={setFiltre} />

        {!chargement && comptes.length === 0 ? (
          <EtatVide
            titre="Aucun bailleur"
            texte="Les demandes de partenariat apparaîtront ici, en attente de votre validation."
          />
        ) : (
          <Tableau
            colonnes={colonnes}
            lignes={comptes}
            cleLigne={(compte) => compte.id}
            // L'ancre que vise la messagerie : un clic sur un nom y mene.
            idLigne={(compte) => `compte-${compte.id}`}
            chargement={chargement}
          />
        )}
      </Panneau>
    </>
  );
}
