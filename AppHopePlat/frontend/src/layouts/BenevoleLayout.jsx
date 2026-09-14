import { Outlet, useNavigate, useOutletContext } from 'react-router-dom';

import {
  IconeAccueil,
  IconeJournal,
  IconePersonne,
  IconeProjets,
  IconeTaches,
} from '../components/admin/AdminIcons.jsx';
import * as benevoleService from '../services/benevole.service.js';
import CoqueEspace from './CoqueEspace.jsx';

/**
 * Les cinq ecrans de l'espace benevole, dans l'ordre du parcours :
 * on regarde ce qui se passe, on choisit une mission, on suit ses
 * taches, on compte ses heures, on tient son profil a jour.
 *
 * Meme decoupage que chez l'administrateur : l'entree d'accueil seule en
 * tete, puis des familles nommees. Deux ici -- ce que le benevole donne
 * a HOPE, et ce qui lui appartient en propre.
 */
const GROUPES = [
  {
    titre: null,
    entrees: [{ to: '/benevole', label: 'Vue d’ensemble', Icone: IconeAccueil, exact: true }],
  },
  {
    titre: 'Mon engagement',
    entrees: [
      { to: '/benevole/missions', label: 'Missions', Icone: IconeProjets },
      { to: '/benevole/taches', label: 'Mes tâches', Icone: IconeTaches },
      { to: '/benevole/journal', label: 'Mon journal', Icone: IconeJournal },
    ],
  },
  {
    titre: 'Mon compte',
    entrees: [{ to: '/benevole/profil', label: 'Mon profil', Icone: IconePersonne }],
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
      identite={{ nom, role: 'Bénévole' }}
      onDeconnexion={seDeconnecter}
    >
      <Outlet context={{ benevole }} />
    </CoqueEspace>
  );
}
