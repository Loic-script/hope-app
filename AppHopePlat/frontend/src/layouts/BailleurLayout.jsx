import { useCallback, useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate, useOutletContext } from 'react-router-dom';

import {
  PleineAccueil,
  PleineActualites,
  PleineDons,
  PleineGraphique,
  PleineMessages,
  PleineOrganisation,
} from '../components/IconesPleines.jsx';
import { apiBailleur } from '../services/apiBailleur.js';
import * as bailleurService from '../services/bailleur.service.js';
import * as espaceService from '../services/espace.service.js';
import CoqueEspace from './CoqueEspace.jsx';

/**
 * Les ecrans de l'espace, dans l'ordre de la lecture : ce que l'argent a
 * produit, ce qui a ete promis, les pieces, les nouvelles, puis
 * l'organisation.
 *
 * Les preuves terrain n'y figurent plus : ce sont souvent des photos de
 * beneficiaires, et l'equipe les garde dans son back-office.
 *
 * Regroupes comme ailleurs : le tableau de bord seul en tete, puis ce
 * qui lie le bailleur a HOPE, ce qui se passe sur le terrain, et ce qui
 * releve de sa propre maison.
 */
const GROUPES = [
  {
    titre: null,
    entrees: [{ to: '/bailleur', label: 'Tableau de bord', Icone: PleineAccueil, exact: true }],
  },
  {
    titre: 'Notre partenariat',
    entrees: [
      { to: '/bailleur/partenariat', label: 'Partenariat', Icone: PleineDons },
      { to: '/bailleur/rapports', label: 'Rapports', Icone: PleineGraphique },
    ],
  },
  {
    titre: 'Sur le terrain',
    entrees: [
      { to: '/bailleur/actualites', label: 'Actualités', Icone: PleineActualites },
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

/** Libelle du niveau de partenariat, affiche sous le nom dans le bandeau. */
const NIVEAUX = { bronze: 'Partenaire Bronze', argent: 'Partenaire Argent', or: 'Partenaire Or' };

/**
 * Ossature de l'espace bailleur.
 *
 * Elle avait son propre rail, aux libelles en clair. La coque commune
 * les garde -- son rail est deploye par defaut, et un bailleur qui vient
 * deux fois par an n'aura rien a memoriser.
 *
 * Monte a l'interieur de RequireBailleur : l'organisation verifiee par
 * GET /api/bailleur/me arrive par le contexte.
 */
export default function BailleurLayout() {
  const { bailleur, rafraichir } = useOutletContext();
  const navigate = useNavigate();
  const emplacement = useLocation();

  const [compteurs, setCompteurs] = useState({ notifications: 0, messages: 0 });

  /** Recharge les pastilles : a chaque changement de page, et sur demande. */
  const rafraichirCompteurs = useCallback(async () => {
    try {
      setCompteurs(await espaceService.badges(apiBailleur));
    } catch {
      // Un echec de compteur ne doit jamais bloquer la navigation.
    }
  }, []);

  useEffect(() => {
    rafraichirCompteurs();
  }, [emplacement.pathname, rafraichirCompteurs]);

  async function seDeconnecter() {
    await bailleurService.deconnecter();
    navigate('/bailleur/login', { replace: true });
  }

  /*
   * Dans le bandeau, c'est l'organisation qui compte, pas la personne :
   * un bailleur se presente au nom de sa maison. Le niveau de
   * partenariat tient la ligne du dessous, la ou l'administrateur a son
   * role.
   */
  const nom = bailleur?.raisonSociale || `${bailleur?.prenom ?? ''} ${bailleur?.nom ?? ''}`.trim();

  return (
    <CoqueEspace
      groupes={GROUPES}
      espace="Espace partenaire"
      accueil="/bailleur"
      cleRail="hope.bailleur.rail-replie"
      identite={{
        nom: nom || 'Organisation',
        role: NIVEAUX[bailleur?.niveau] ?? bailleur?.typeLibelle ?? 'Partenaire',
        // La photo est celle de la personne connectee, pas un logo :
        // c'est elle qui ecrit dans la messagerie.
        photoUrl: bailleur?.photoUrl,
      }}
      onDeconnexion={seDeconnecter}
      compteurs={compteurs}
      notifications={{ to: '/bailleur/notifications', cle: 'notifications' }}
    >
      <Outlet
        context={{
          bailleur,
          // La fiche de contact s'en sert apres avoir change la photo :
          // le bandeau la relit du serveur plutot que de la deviner.
          rafraichirBailleur: rafraichir,
          api: apiBailleur,
          rafraichirCompteurs,
          racineConversations: '/espace',
          // Le chemin de la messagerie dans CET espace : l'ecran est
          // partage par les trois, et c'est lui qui construit le lien
          // vers une conversation.
          cheminMessages: '/bailleur/messages',
          titreMessagerie: 'Messages',
        }}
      />
    </CoqueEspace>
  );
}
