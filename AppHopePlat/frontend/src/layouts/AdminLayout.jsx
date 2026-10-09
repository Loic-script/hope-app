import { useCallback, useEffect, useState, Suspense } from 'react';
import { Outlet, useLocation, useNavigate, useOutletContext } from 'react-router-dom';

import { IconeParametres } from '../components/admin/AdminIcons.jsx';
import {
  PleineAccueil,
  PleineActualites,
  PleineBudget,
  PleineDons,
  PleineFamille,
  PleineGraphique,
  PleineGroupe,
  PleineMessages,
  PleinePreuves,
  PleineProjets,
  PleineTaches,
} from '../components/IconesPleines.jsx';
import { api } from '../services/api.js';
import * as authService from '../services/auth.service.js';
import ChargementPage from '../components/ChargementPage.jsx';
import CoqueEspace from './CoqueEspace.jsx';

const GROUPES = [
  {
    titre: null,
    entrees: [{ to: '/admin', label: 'Accueil', Icone: PleineAccueil, exact: true }],
  },
  {
    titre: 'Gestion des projets',
    entrees: [
      { to: '/admin/projects', label: 'Projets', Icone: PleineProjets },
      {
        to: '/admin/taches',
        label: 'Tâches',
        Icone: PleineTaches,
        compteur: 'taches',
        annonce: (n) => `${n} demande(s) à valider`,
      },
      { to: '/admin/beneficiaries', label: 'Bénéficiaires', Icone: PleineFamille },
      { to: '/admin/proofs', label: 'Preuves terrain', Icone: PleinePreuves },
    ],
  },
  {
    titre: 'Communauté & contacts',
    entrees: [
      {
        to: '/admin/conversations',
        label: 'Messages',
        Icone: PleineMessages,
        compteur: 'conversations',
      },
      { to: '/admin/utilisateurs', label: 'Utilisateurs', Icone: PleineGroupe },
      { to: '/admin/actualites', label: 'Actualités', Icone: PleineActualites },
    ],
  },
  {
    titre: 'Finances & analyse',
    entrees: [
      { to: '/admin/budget', label: 'Budget', Icone: PleineBudget },
      { to: '/admin/dons', label: 'Dons reçus', Icone: PleineDons },
      { to: '/admin/statistics', label: 'Statistiques', Icone: PleineGraphique },
    ],
  },
];

const ENTREES_PROFIL = [{ to: '/admin/settings', label: 'Paramètres', Icone: IconeParametres }];

const LIBELLES_ROLES = {
  ADMIN: 'Administrateur',
  COORDINATOR: 'Coordinateur',
  VIEWER: 'Lecture seule',
  GESTIONNAIRE: 'Admin back office',
  MANAGER: 'Manager',
};

function groupesDuRole(role) {
  if (role !== 'MANAGER') return GROUPES;
  return GROUPES.map((groupe) => ({
    ...groupe,
    entrees: groupe.entrees.filter((entree) => entree.to !== '/admin/utilisateurs'),
  })).filter((groupe) => groupe.entrees.length > 0);
}

export default function AdminLayout() {
  const { admin, rafraichir } = useOutletContext();
  const navigate = useNavigate();
  const emplacement = useLocation();

  const [compteurs, setCompteurs] = useState({});

  const rafraichirCompteurs = useCallback(async () => {
    try {
      const { data } = await api.get('/admin/badges');
      setCompteurs(data);
    } catch {
    }
  }, []);

  useEffect(() => {
    rafraichirCompteurs();
  }, [emplacement.pathname, rafraichirCompteurs]);

  useEffect(() => {
    let minuterie = null;

    function battre() {
      clearInterval(minuterie);
      if (document.visibilityState !== 'visible') return;
      rafraichirCompteurs();
      minuterie = setInterval(rafraichirCompteurs, 40_000);
    }

    battre();
    document.addEventListener('visibilitychange', battre);
    return () => {
      clearInterval(minuterie);
      document.removeEventListener('visibilitychange', battre);
    };
  }, [rafraichirCompteurs]);

  async function seDeconnecter() {
    await authService.deconnecter();
    navigate('/authentification', { replace: true });
  }

  return (
    <CoqueEspace
      groupes={groupesDuRole(admin?.role)}
      espace="Espace administrateur"
      accueil="/admin"
      cleRail="hope.admin.rail-replie"
      identite={{
        nom: admin?.fullName ?? admin?.adminLog ?? 'AdminHope',
        role: LIBELLES_ROLES[admin?.role] ?? 'Administrateur',
        photoUrl: admin?.photoUrl,
      }}
      onDeconnexion={seDeconnecter}
      compteurs={compteurs}
      notifications={{ to: '/admin/notifications', cle: 'notifications' }}
      entreesProfil={ENTREES_PROFIL}
    >
      <Suspense fallback={<ChargementPage />}>
        <Outlet
          context={{
            admin,
            rafraichirAdmin: rafraichir,
            rafraichirCompteurs,
            api,
            racineConversations: '/admin',
            cheminMessages: '/admin/conversations',
            titreMessagerie: 'Messages',
          }}
        />
      </Suspense>
    </CoqueEspace>
  );
}
