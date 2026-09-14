import { useCallback, useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate, useOutletContext } from 'react-router-dom';

import {
  IconeAccueil,
  IconeBeneficiaires,
  IconeBudgets,
  IconeDonateurs,
  IconeDons,
  IconeGraphique,
  IconeMessages,
  IconeParametres,
  IconePreuves,
  IconeProjets,
} from '../components/admin/AdminIcons.jsx';
import { api } from '../services/api.js';
import * as authService from '../services/auth.service.js';
import CoqueEspace from './CoqueEspace.jsx';

/**
 * Les dix sections de travail.
 *
 * Accueil ouvre la liste, seul et sans famille : c'est le point de
 * depart, il n'appartient a aucun des trois metiers qui suivent.
 *
 * Viennent ensuite trois familles qui repondent chacune a une question.
 * "Gestion des projets" : ce que HOPE mene sur le terrain, du projet aux
 * preuves qui l'attestent. "Communaute & contacts" : les gens autour --
 * ceux qui ecrivent, ceux qui donnent, ceux qui aident, ceux qui
 * financent. "Finances & analyse" : ce que tout cela coute et ce que ca
 * produit.
 *
 * Deux entrees n'y figurent pas, et c'est voulu :
 *   * Notifications reste une alerte et non une destination : la barre du
 *     haut la montre avec sa pastille depuis n'importe ou ;
 *   * Parametres releve du compte : il vit dans le menu du profil, en
 *     haut a droite, avec la deconnexion.
 *
 * Impact a ete retire du menu. La route /admin/impact existe toujours,
 * mais plus rien n'y mene : l'onglet Impact de chaque fiche projet porte
 * desormais la meme lecture, projet par projet.
 */
const GROUPES = [
  {
    // Sans intitule : une seule entree, et rien a nommer au-dessus.
    titre: null,
    entrees: [{ to: '/admin', label: 'Accueil', Icone: IconeAccueil, exact: true }],
  },
  {
    titre: 'Gestion des projets',
    entrees: [
      { to: '/admin/projects', label: 'Projets', Icone: IconeProjets },
      { to: '/admin/beneficiaries', label: 'Bénéficiaires', Icone: IconeBeneficiaires },
      { to: '/admin/proofs', label: 'Preuves terrain', Icone: IconePreuves },
    ],
  },
  {
    titre: 'Communauté & contacts',
    entrees: [
      // "compteur" designe la cle des pastilles renvoyees par
      // /admin/badges : l'entree porte alors son nombre de non-lus.
      { to: '/admin/messages', label: 'Messages', Icone: IconeMessages, compteur: 'messages' },
      { to: '/admin/donors', label: 'Donateurs', Icone: IconeDonateurs },
      { to: '/admin/volunteers', label: 'Bénévoles', Icone: IconeBeneficiaires },
      { to: '/admin/funders', label: 'Bailleurs', Icone: IconeDons },
    ],
  },
  {
    titre: 'Finances & analyse',
    entrees: [
      { to: '/admin/budget', label: 'Budget', Icone: IconeBudgets },
      { to: '/admin/statistics', label: 'Statistiques', Icone: IconeGraphique },
    ],
  },
];

/** Le menu du profil, en haut a droite : ce qui releve du compte. */
const ENTREES_PROFIL = [{ to: '/admin/settings', label: 'Paramètres', Icone: IconeParametres }];

/**
 * Ossature de l'espace administrateur.
 *
 * La mise en page vient de CoqueEspace, partagee avec les autres
 * espaces. Ne reste ici que ce qui est propre a l'administrateur : ses
 * dix sections, et les pastilles de non-lus qu'il est seul a avoir.
 *
 * Monte a l'interieur de RequireAuth : le profil verifie par
 * GET /api/admin/me arrive par le contexte et redescend vers les pages.
 */
export default function AdminLayout() {
  const { admin } = useOutletContext();
  const navigate = useNavigate();
  const emplacement = useLocation();

  const [compteurs, setCompteurs] = useState({ notifications: 0, messages: 0 });

  /** Recharge les pastilles : a chaque changement de page, et sur demande. */
  const rafraichirCompteurs = useCallback(async () => {
    try {
      const { data } = await api.get('/admin/badges');
      setCompteurs(data);
    } catch {
      // Un echec de compteur ne doit jamais bloquer la navigation.
    }
  }, []);

  useEffect(() => {
    rafraichirCompteurs();
  }, [emplacement.pathname, rafraichirCompteurs]);

  async function seDeconnecter() {
    await authService.deconnecter();
    navigate('/admin/login', { replace: true });
  }

  return (
    <CoqueEspace
      groupes={GROUPES}
      espace="Espace administrateur"
      accueil="/admin"
      cleRail="hope.admin.rail-replie"
      identite={{ nom: admin?.adminLog ?? 'AdminHope', role: 'Administrateur' }}
      onDeconnexion={seDeconnecter}
      compteurs={compteurs}
      notifications={{ to: '/admin/notifications', cle: 'notifications' }}
      entreesProfil={ENTREES_PROFIL}
    >
      <Outlet context={{ admin, rafraichirCompteurs }} />
    </CoqueEspace>
  );
}
