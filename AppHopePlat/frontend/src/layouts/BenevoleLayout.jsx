import { useCallback, useEffect, useState, Suspense } from 'react';
import { Outlet, useLocation, useNavigate, useOutletContext } from 'react-router-dom';

import {
  PleineAccueil,
  PleineGroupe,
  PleineJournal,
  PleineMessages,
  PleinePersonne,
  PleineProjets,
  PleineTaches,
} from '../components/IconesPleines.jsx';
import { apiBenevole } from '../services/apiBenevole.js';
import * as benevoleService from '../services/benevole.service.js';
import * as espaceService from '../services/espace.service.js';
import ChargementPage from '../components/ChargementPage.jsx';
import CoqueEspace from './CoqueEspace.jsx';
import BandeauVerification from '../components/compte/BandeauVerification.jsx';

const GROUPES = [
  {
    titre: null,
    entrees: [{ to: '/benevole', label: 'Accueil', Icone: PleineAccueil, exact: true }],
  },
  {
    titre: 'Mon engagement',
    entrees: [
      { to: '/benevole/projets', label: 'Projets', Icone: PleineProjets },
      { to: '/benevole/taches', label: 'Mes tâches', Icone: PleineTaches },
      { to: '/benevole/journal', label: 'Mon journal', Icone: PleineJournal },
      { to: '/benevole/benevoles', label: 'Bénévoles', Icone: PleineGroupe },
    ],
  },
  {
    titre: 'Mon compte',
    entrees: [
      {
        to: '/benevole/messages',
        label: 'Messages',
        Icone: PleineMessages,
        compteur: 'messages',
      },
      { to: '/benevole/profil', label: 'Mon profil', Icone: PleinePersonne },
    ],
  },
];

export default function BenevoleLayout() {
  const { benevole } = useOutletContext();
  const navigate = useNavigate();
  const emplacement = useLocation();

  const [compteurs, setCompteurs] = useState({});

  const rafraichirCompteurs = useCallback(async () => {
    try {
      setCompteurs(await espaceService.badges(apiBenevole));
    } catch {
    }
  }, []);

  useEffect(() => {
    rafraichirCompteurs();
  }, [emplacement.pathname, rafraichirCompteurs]);

  async function seDeconnecter() {
    await benevoleService.deconnecter();
    navigate('/benevole/login', { replace: true });
  }

  const nom = `${benevole?.prenom ?? ''} ${benevole?.nom ?? ''}`.trim() || 'Bénévole';

  return (
    <CoqueEspace
      groupes={GROUPES}
      espace="Espace bénévole"
      accueil="/benevole"
      cleRail="hope.benevole.rail-replie"
      identite={{ nom, role: 'Bénévole', photoUrl: benevole?.photoUrl }}
      onDeconnexion={seDeconnecter}
      compteurs={compteurs}
      notifications={{ to: '/benevole/notifications', cle: 'notifications' }}
    >
      <BandeauVerification espace="benevole" />
      <Suspense fallback={<ChargementPage />}>
        <Outlet
          context={{
            benevole,
            api: apiBenevole,
            rafraichirCompteurs,
            racineConversations: '/espace',
            cheminMessages: '/benevole/messages',
            titreMessagerie: 'Messages',
          }}
        />
      </Suspense>
    </CoqueEspace>
  );
}
