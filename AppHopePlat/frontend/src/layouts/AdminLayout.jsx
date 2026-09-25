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
    entrees: [{ to: '/admin', label: 'Accueil', Icone: PleineAccueil, exact: true }],
  },
  {
    titre: 'Gestion des projets',
    entrees: [
      { to: '/admin/projects', label: 'Projets', Icone: PleineProjets },
      // Toutes les taches, et les demandes des benevoles a valider : la
      // pastille dit combien attendent une decision.
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
        // La messagerie de l'equipe : elle parle ici avec les
        // benevoles, les partenaires et les donateurs. Meme nom et meme
        // icone que dans l'espace bailleur : une seule messagerie, un
        // seul mot pour la designer.
        //
        // L'adresse reste /admin/conversations : les liens deja envoyes
        // dans les notifications continuent d'y mener.
        //
        // "compteur" designe la cle des pastilles renvoyees par
        // /admin/badges : l'entree porte alors son nombre de non-lus.
        to: '/admin/conversations',
        label: 'Messages',
        Icone: PleineMessages,
        compteur: 'conversations',
      },
      // Donateurs, benevoles et bailleurs : un seul ecran, un onglet
      // chacun.
      { to: '/admin/utilisateurs', label: 'Utilisateurs', Icone: PleineGroupe },
      // Ce que les bailleurs lisent dans leur espace, et qui s'y est
      // manifeste en retour.
      { to: '/admin/actualites', label: 'Actualités', Icone: PleineActualites },
    ],
  },
  {
    titre: 'Finances & analyse',
    entrees: [
      { to: '/admin/budget', label: 'Budget', Icone: PleineBudget },
      // Le journal des dons, qui vivait dans l'ancien ecran Donateurs.
      { to: '/admin/dons', label: 'Dons reçus', Icone: PleineDons },
      { to: '/admin/statistics', label: 'Statistiques', Icone: PleineGraphique },
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
  const { admin, rafraichir } = useOutletContext();
  const navigate = useNavigate();
  const emplacement = useLocation();

  // Vide tant que le serveur n'a pas repondu : un zero de depart
  // ferait sonner la cloche au premier chargement.
  const [compteurs, setCompteurs] = useState({});

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

  /*
   * Les pastilles se rafraichissent aussi toutes les 40 secondes : une
   * inscription ou un message arrive pendant que l'equipe travaille, et
   * la cloche doit le dire sans attendre un changement de page.
   *
   * Onglet en arriere-plan, on s'arrete : inutile d'interroger le
   * serveur pour un ecran que personne ne regarde. On rattrape au
   * retour, ou la cloche signale d'un coup ce qui est arrive entre-temps.
   */
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
    navigate('/admin/login', { replace: true });
  }

  return (
    <CoqueEspace
      groupes={GROUPES}
      espace="Espace administrateur"
      accueil="/admin"
      cleRail="hope.admin.rail-replie"
      identite={{
        nom: admin?.adminLog ?? 'AdminHope',
        role: 'Administrateur',
        photoUrl: admin?.photoUrl,
      }}
      onDeconnexion={seDeconnecter}
      compteurs={compteurs}
      notifications={{ to: '/admin/notifications', cle: 'notifications' }}
      entreesProfil={ENTREES_PROFIL}
    >
      {/* La page se charge a la demande : l'espace reste affiche pendant ce temps. */}
      <Suspense fallback={<ChargementPage />}>
        <Outlet
          context={{
            admin,
            // Les parametres s'en servent apres un changement de photo.
            rafraichirAdmin: rafraichir,
            rafraichirCompteurs,
            // La messagerie commune est le meme ecran dans les trois
            // espaces : elle prend son client et sa racine du contexte.
            api,
            racineConversations: '/admin',
            // Le chemin de la messagerie dans CET espace : l'ecran est
            // partage par les trois, et c'est lui qui construit le lien
            // vers une conversation.
            cheminMessages: '/admin/conversations',
            titreMessagerie: 'Messages',
          }}
        />
      </Suspense>
    </CoqueEspace>
  );
}
