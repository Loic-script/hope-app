import { useCallback, useEffect, useState, Suspense } from 'react';
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
import ChargementPage from '../components/ChargementPage.jsx';
import CoqueEspace from './CoqueEspace.jsx';
import BandeauVerification from '../components/compte/BandeauVerification.jsx';

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
      { to: '/donateur/messages', label: 'Messages', Icone: PleineMessages, compteur: 'messages' },
      { to: '/donateur/profil', label: 'Mon profil', Icone: PleinePersonne },
    ],
  },
];

export default function DonateurLayout() {
  const { donateur, rafraichir } = useOutletContext();
  const navigate = useNavigate();
  const emplacement = useLocation();

  const [compteurs, setCompteurs] = useState({});

  const rafraichirCompteurs = useCallback(async () => {
    try {
      setCompteurs(await espaceService.badges(apiDonateur));
    } catch {
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
      <BandeauVerification espace="donateur" />
      <Suspense fallback={<ChargementPage />}>
        <Outlet
          context={{
            donateur,
            rafraichirDonateur: rafraichir,
            api: apiDonateur,
            rafraichirCompteurs,
            racineConversations: '/espace',
            cheminMessages: '/donateur/messages',
            titreMessagerie: 'Messages',
          }}
        />
      </Suspense>
    </CoqueEspace>
  );
}
