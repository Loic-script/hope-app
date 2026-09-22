import { useCallback, useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation, useNavigate, useOutletContext } from 'react-router-dom';

import {
  PleineAccueil,
  PleineDons,
  PleineGraphique,
  PleineMessages,
  PleinePersonne,
  PleineProjets,
} from '../components/IconesPleines.jsx';
import { apiDonateur } from '../services/apiDonateur.js';
import * as espaceService from '../services/espace.service.js';
import * as utilisateurService from '../services/utilisateur.service.js';
import CoqueEspace from './CoqueEspace.jsx';

/**
 * Les ecrans de l'espace donateur, dans l'ordre de la lecture : ce qui se
 * passe chez HOPE, donner, suivre ses dons, les projets ; puis ce qui lui
 * appartient en propre.
 *
 * Meme decoupage que les autres espaces : l'entree d'accueil seule en
 * tete, puis des familles nommees.
 */
const GROUPES = [
  {
    titre: null,
    entrees: [{ to: '/donateur', label: 'Accueil', Icone: PleineAccueil, exact: true }],
  },
  {
    titre: 'Mes dons',
    entrees: [
      { to: '/donateur/faire-un-don', label: 'Faire un don', Icone: PleineDons },
      { to: '/donateur/mes-dons', label: 'Mes dons', Icone: PleineGraphique },
      { to: '/donateur/projets', label: 'Projets', Icone: PleineProjets },
    ],
  },
  {
    titre: 'Mon compte',
    entrees: [
      // La messagerie commune aux espaces : meme nom, meme icone.
      { to: '/donateur/messages', label: 'Messages', Icone: PleineMessages, compteur: 'messages' },
      { to: '/donateur/profil', label: 'Mon profil', Icone: PleinePersonne },
    ],
  },
];

/**
 * Ossature de l'espace donateur, sur la coque commune.
 *
 * Montee a l'interieur de RequireDonateur : le compte verifie par
 * GET /api/donateur/me arrive par le contexte, avec de quoi le relire
 * (la photo change depuis "Mon profil").
 *
 * Un compte dont le parcours d'accueil n'est pas termine y retourne :
 * l'espace a besoin de sa devise, de ses preferences de don.
 */
export default function DonateurLayout() {
  const { donateur, rafraichir } = useOutletContext();
  const navigate = useNavigate();
  const emplacement = useLocation();

  const [compteurs, setCompteurs] = useState({ notifications: 0, messages: 0 });

  /** Recharge les pastilles : a chaque changement de page, et sur demande. */
  const rafraichirCompteurs = useCallback(async () => {
    try {
      setCompteurs(await espaceService.badges(apiDonateur));
    } catch {
      // Un echec de compteur ne doit jamais bloquer la navigation.
    }
  }, []);

  useEffect(() => {
    rafraichirCompteurs();
  }, [emplacement.pathname, rafraichirCompteurs]);

  if (donateur && !donateur.profilComplete) {
    return <Navigate to="/donateur/completer-profil" replace />;
  }

  async function seDeconnecter() {
    await utilisateurService.deconnecterDonateur();
    navigate('/authentification', { replace: true });
  }

  const nom = `${donateur?.prenom ?? ''} ${donateur?.nom ?? ''}`.trim() || 'Donateur';

  return (
    <CoqueEspace
      groupes={GROUPES}
      espace="Espace donateur"
      accueil="/donateur"
      cleRail="hope.donateur.rail-replie"
      identite={{ nom, role: 'Donateur', photoUrl: donateur?.photoUrl }}
      onDeconnexion={seDeconnecter}
      compteurs={compteurs}
      notifications={{ to: '/donateur/notifications', cle: 'notifications' }}
    >
      <Outlet
        context={{
          donateur,
          rafraichirDonateur: rafraichir,
          api: apiDonateur,
          rafraichirCompteurs,
          racineConversations: '/espace',
          // Le chemin de la messagerie dans CET espace : l'ecran est
          // partage, et c'est lui qui construit le lien vers une
          // conversation.
          cheminMessages: '/donateur/messages',
          titreMessagerie: 'Messages',
        }}
      />
    </CoqueEspace>
  );
}
