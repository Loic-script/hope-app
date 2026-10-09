import { useCallback, useEffect, useState, Suspense } from 'react';
import { Outlet, useLocation, useNavigate, useOutletContext } from 'react-router-dom';

import {
  PleineAccueil,
  PleineBudget,
  PleineGraphique,
  PleineMessages,
  PleineOrganisation,
  PleineProjets,
} from '../components/IconesPleines.jsx';
import { apiBailleur } from '../services/apiBailleur.js';
import * as bailleurService from '../services/bailleur.service.js';
import * as espaceService from '../services/espace.service.js';
import ChargementPage from '../components/ChargementPage.jsx';
import CoqueEspace from './CoqueEspace.jsx';
import BandeauVerification from '../components/compte/BandeauVerification.jsx';
import DonFlottant from '../components/DonFlottant.jsx';

const GROUPES = [
  {
    titre: null,
    entrees: [{ to: '/bailleur', label: 'Accueil', Icone: PleineAccueil, exact: true }],
  },
  {
    titre: 'Notre partenariat',
    entrees: [
      { to: '/bailleur/paiements', label: 'Paiements effectués', Icone: PleineBudget },
      { to: '/bailleur/rapports', label: 'Rapports', Icone: PleineGraphique },
    ],
  },
  {
    titre: 'Sur le terrain',
    entrees: [
      { to: '/bailleur/projets', label: 'Découvrir le projet', Icone: PleineProjets },
    ],
  },
  {
    titre: 'Mon compte',
    entrees: [
      { to: '/bailleur/messages', label: 'Messages', Icone: PleineMessages, compteur: 'messages' },
      { to: '/bailleur/organisation', label: 'Mon organisation', Icone: PleineOrganisation },
    ],
  },
];

const NIVEAUX = { bronze: 'Partenaire Bronze', argent: 'Partenaire Argent', or: 'Partenaire Or' };

export default function BailleurLayout() {
  const { bailleur, rafraichir } = useOutletContext();
  const navigate = useNavigate();
  const emplacement = useLocation();

  const [compteurs, setCompteurs] = useState({});

  const rafraichirCompteurs = useCallback(async () => {
    try {
      setCompteurs(await espaceService.badges(apiBailleur));
    } catch {
    }
  }, []);

  useEffect(() => {
    rafraichirCompteurs();
  }, [emplacement.pathname, rafraichirCompteurs]);

  async function seDeconnecter() {
    await bailleurService.deconnecter();
    navigate('/bailleur/login', { replace: true });
  }

  const nom = bailleur?.raisonSociale || `${bailleur?.prenom ?? ''} ${bailleur?.nom ?? ''}`.trim();

  const surLeDon = /^\/bailleur\/(faire-un-don|payer)/.test(emplacement.pathname);

  return (
    <CoqueEspace
      groupes={GROUPES}
      espace="Espace partenaire"
      accueil="/bailleur"
      cleRail="hope.bailleur.rail-replie"
      identite={{
        nom: nom || 'Organisation',
        role: NIVEAUX[bailleur?.niveau] ?? bailleur?.typeLibelle ?? 'Partenaire',
        photoUrl: bailleur?.photoUrl,
      }}
      onDeconnexion={seDeconnecter}
      compteurs={compteurs}
      notifications={{ to: '/bailleur/notifications', cle: 'notifications' }}
    >
      <BandeauVerification espace="bailleur" />
      <Suspense fallback={<ChargementPage />}>
        <Outlet
          context={{
            bailleur,
            rafraichirBailleur: rafraichir,
            api: apiBailleur,
            rafraichirCompteurs,
            racineConversations: '/espace',
            cheminMessages: '/bailleur/messages',
            titreMessagerie: 'Messages',
          }}
        />
      </Suspense>
      {!surLeDon && <DonFlottant to="/bailleur/faire-un-don" cle="hope.bailleur.don-flottant" />}
    </CoqueEspace>
  );
}
