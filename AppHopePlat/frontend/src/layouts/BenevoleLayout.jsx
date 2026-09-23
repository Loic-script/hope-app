import { useCallback, useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate, useOutletContext } from 'react-router-dom';

import {
  PleineAccueil,
  PleineJournal,
  PleineMessages,
  PleinePersonne,
  PleineProjets,
  PleineTaches,
} from '../components/IconesPleines.jsx';
import { apiBenevole } from '../services/apiBenevole.js';
import * as benevoleService from '../services/benevole.service.js';
import * as espaceService from '../services/espace.service.js';
import CoqueEspace from './CoqueEspace.jsx';

/**
 * Les ecrans de l'espace benevole, dans l'ordre du parcours : on
 * regarde ce qui se passe, on ouvre un projet et on y prend une tache,
 * on suit ses taches, on retrouve ce qu'on a livre dans son journal,
 * on tient son profil a jour.
 *
 * L'espace ne propose que des taches. Les missions -- des creneaux a
 * date et heure fixes, avec inscription -- ont ete retirees : la tache
 * suffit a ce que HOPE demande a ses benevoles.
 *
 * Meme decoupage que chez l'administrateur : l'entree d'accueil seule en
 * tete, puis des familles nommees. Deux ici -- ce que le benevole donne
 * a HOPE, et ce qui lui appartient en propre.
 *
 * L'entree de tete s'appelle "Accueil" : elle ouvre une page unique ou
 * les projets et les nouvelles de HOPE se suivent dans un meme fil.
 * Aucune n'y porte de chiffre.
 */
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
    ],
  },
  {
    titre: 'Mon compte',
    entrees: [
      {
        // La messagerie, avec l'equipe comme avec les autres membres :
        // meme nom et meme icone que dans les espaces administrateur et
        // bailleur.
        //
        // L'adresse reste /benevole/messages : les liens deja envoyes
        // dans les notifications continuent d'y mener.
        //
        // "compteur" designe la cle des pastilles renvoyees par
        // /espace/badges. Elle garde le nom "messages" cote serveur, ou
        // elle compte deja les conversations non lues : la renommer ici
        // eteindrait la pastille.
        to: '/benevole/messages',
        label: 'Messages',
        Icone: PleineMessages,
        compteur: 'messages',
      },
      { to: '/benevole/profil', label: 'Mon profil', Icone: PleinePersonne },
    ],
  },
];

/**
 * Ossature de l'espace benevole.
 *
 * Elle etait faite d'onglets en haut ; elle reprend depuis la coque
 * commune, celle de l'administrateur. Un benevole peut aussi etre
 * coordinateur, et passer d'un espace a l'autre sans reapprendre ou
 * cliquer.
 *
 * Monte a l'interieur de RequireBenevole : le profil verifie par
 * GET /api/benevole/me arrive par le contexte et redescend vers les
 * pages.
 */
export default function BenevoleLayout() {
  const { benevole } = useOutletContext();
  const navigate = useNavigate();
  const emplacement = useLocation();

  // Vide tant que le serveur n'a pas repondu : un zero de depart
  // ferait sonner la cloche au premier chargement.
  const [compteurs, setCompteurs] = useState({});

  /** Recharge les pastilles : a chaque changement de page, et sur demande. */
  const rafraichirCompteurs = useCallback(async () => {
    try {
      setCompteurs(await espaceService.badges(apiBenevole));
    } catch {
      // Un echec de compteur ne doit jamais bloquer la navigation.
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
      <Outlet
        context={{
          benevole,
          api: apiBenevole,
          rafraichirCompteurs,
          racineConversations: '/espace',
          // Le chemin de la messagerie dans CET espace : l'ecran est
          // partage par les trois, et c'est lui qui construit le lien
          // vers une conversation.
          cheminMessages: '/benevole/messages',
          titreMessagerie: 'Messages',
        }}
      />
    </CoqueEspace>
  );
}
