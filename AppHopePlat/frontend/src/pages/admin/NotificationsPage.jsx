import { Link, useOutletContext } from 'react-router-dom';

import {
  IconeBudgets,
  IconeDons,
  IconeMessages,
  IconeOrganisation,
  IconePersonne,
  IconePreuves,
  IconeTaches,
  IconeValide,
} from '../../components/admin/AdminIcons.jsx';
import { ONGLET_DU_ROLE } from '../../components/admin/GestionUtilisateur.jsx';
import {
  Alerte,
  BarreOutils,
  Chargement,
  EntetePage,
  EtatVide,
  Panneau,
} from '../../components/admin/ui.jsx';
import NotificationMessages from '../../components/messagerie/NotificationMessages.jsx';
import { useChargement, useSoumission } from '../../hooks/useChargement.js';
import * as notificationService from '../../services/notification.service.js';
import * as fmt from '../../utils/format.js';
import { useState } from 'react';

const FILTRES = [
  { valeur: 'TOUTES', label: 'Toutes' },
  { valeur: 'NON_LUES', label: 'Non lues' },
  { valeur: 'DONATION', label: 'Dons' },
  { valeur: 'INVESTMENT', label: 'Investissements' },
  { valeur: 'MESSAGE', label: 'Messages' },
  { valeur: 'PROJECT_COMPLETED', label: 'Projets terminés' },
  { valeur: 'ACCOUNT_CREATED', label: 'Nouveaux comptes' },
  { valeur: 'TASK_REQUEST', label: 'Demandes de tâche' },
  { valeur: 'TASK_DELIVERED', label: 'Tâches livrées' },
  { valeur: 'FUNDER_INTEREST', label: 'Partenaires intéressés' },
  { valeur: 'FIELD_PROOF', label: 'Preuves terrain' },
];

/** Les types qui appellent une reponse de l'equipe. */
const DEMANDES = ['ACCOUNT_CREATED', 'TASK_REQUEST', 'TASK_DELIVERED', 'FUNDER_INTEREST', 'FIELD_PROOF'];

/** Icone et teinte de la pastille selon la nature de l'evenement. */
const APPARENCE = {
  DONATION: { Icone: IconeDons, classe: 'don' },
  INVESTMENT: { Icone: IconeBudgets, classe: 'investi' },
  MESSAGE: { Icone: IconeMessages, classe: 'message' },
  PROJECT_COMPLETED: { Icone: IconeValide, classe: 'projet' },
  ACCOUNT_CREATED: { Icone: IconePersonne, classe: 'compte' },
  TASK_REQUEST: { Icone: IconeTaches, classe: 'demande' },
  TASK_DELIVERED: { Icone: IconeValide, classe: 'livraison' },
  FUNDER_INTEREST: { Icone: IconeOrganisation, classe: 'partenaire' },
  FIELD_PROOF: { Icone: IconePreuves, classe: 'preuve' },
};

/**
 * Ou mene une notification.
 *
 * On vise l'endroit ou l'on peut AGIR, pas seulement la page qui parle du
 * sujet : un investissement ouvre l'onglet Financement du projet, un projet
 * termine son onglet Impact, un message sa conversation.
 *
 * Un don affecte mene a son projet ; un don pour le fonds n'en a pas, il
 * mene alors au journal des dons.
 *
 * @returns {string|null} null si l'evenement n'a plus de cible -- la
 *          notification reste alors affichee, simplement non cliquable.
 */
function destination(notification) {
  const { type, projectId } = notification;

  if (type === 'INVESTMENT' && projectId) {
    return `/admin/projects/${projectId}?onglet=financement`;
  }
  if (type === 'PROJECT_COMPLETED' && projectId) {
    return `/admin/projects/${projectId}?onglet=impact`;
  }
  if (type === 'MESSAGE') {
    // Le courrier des donateurs a rejoint la messagerie commune : il
    // n'y a plus qu'un seul endroit ou lire ce qu'on nous ecrit.
    return '/admin/conversations';
  }
  if (type === 'DONATION') {
    return projectId ? `/admin/projects/${projectId}?onglet=financement` : '/admin/dons';
  }
  // Un compte qui vient de s'ouvrir mene a son profil, dans l'onglet de
  // son role : c'est la qu'on le valide ou qu'on lui ecrit.
  if (type === 'ACCOUNT_CREATED' && notification.utilisateurId) {
    const onglet = ONGLET_DU_ROLE[notification.compteRole] ?? 'donateurs';
    return `/admin/utilisateurs/compte/${notification.utilisateurId}?depuis=${onglet}`;
  }
  // Une demande de tache s'ouvre sur l'ecran des taches, filtre sur
  // celles qui attendent une decision ; une livraison, sur la tache.
  if (type === 'TASK_REQUEST') {
    return notification.tacheId
      ? `/admin/taches?demandes=1&tache=${notification.tacheId}`
      : '/admin/taches?demandes=1';
  }
  if (type === 'TASK_DELIVERED') {
    return notification.tacheId ? `/admin/taches?tache=${notification.tacheId}` : '/admin/taches';
  }
  // Un partenaire interesse : l'ecran ou l'equipe suit les
  // manifestations, sous l'appel qui les a suscitees.
  if (type === 'FUNDER_INTEREST') return '/admin/actualites';
  if (type === 'FIELD_PROOF') return '/admin/proofs';
  return null;
}

/**
 * Ecran Notifications : le journal de ce qui arrive a HOPE.
 *
 * Un don reçu y apparait sous la forme demandee :
 *   « <donateur> a fait un don <ponctuel|mensuel> de <somme> pour
 *     <HOPE|projet> ».
 */
export default function NotificationsPage() {
  const { rafraichirCompteurs, api, racineConversations, cheminMessages } = useOutletContext();
  const [filtre, setFiltre] = useState('TOUTES');

  const { donnees, chargement, erreur, recharger } = useChargement(
    () =>
      notificationService.lister({
        unread: filtre === 'NON_LUES' ? true : undefined,
        type: FILTRES.some((f) => f.valeur === filtre && !['TOUTES', 'NON_LUES'].includes(filtre))
          ? filtre
          : undefined,
      }),
    [filtre]
  );

  const { envoi, erreur: erreurAction, soumettre } = useSoumission();

  async function marquerLue(notification) {
    await soumettre(() => notificationService.marquerLue(notification.id), {
      onSucces: () => {
        recharger();
        rafraichirCompteurs?.();
      },
    });
  }

  /**
   * Ouvrir une notification vaut lecture : on la marque avant de partir.
   *
   * Sans recharger la liste -- on la quitte -- mais en rafraichissant la
   * pastille de l'en-tete, qui reste visible sur la page d'arrivee.
   */
  function ouvrir(notification) {
    if (notification.isRead) return;
    notificationService
      .marquerLue(notification.id)
      .then(() => rafraichirCompteurs?.())
      .catch(() => {});
  }

  async function toutMarquerLu() {
    await soumettre(() => notificationService.toutMarquerLu(), {
      onSucces: () => {
        recharger();
        rafraichirCompteurs?.();
      },
    });
  }

  const notifications = donnees?.items ?? [];
  const nonLues = donnees?.unreadCount ?? 0;

  return (
    <>
      <EntetePage
        titre="Notifications"
        accroche="Tout ce qui attend une réponse : une inscription, une demande de tâche, une livraison, un partenaire intéressé — et chaque don reçu."
        actions={
          nonLues > 0 && (
            <button
              type="button"
              className="btn btn--neutre"
              onClick={toutMarquerLu}
              disabled={envoi}
            >
              Tout marquer comme lu
            </button>
          )
        }
      />

      {erreur && <Alerte>{erreur}</Alerte>}
      {erreurAction && <Alerte>{erreurAction}</Alerte>}

      <NotificationMessages api={api} racine={racineConversations} cheminMessages={cheminMessages} />

      <Panneau serre>
        <BarreOutils
          filtres={FILTRES}
          filtreActif={filtre}
          onFiltre={setFiltre}
          compteur={
            donnees
              ? `${fmt.nombre(notifications.length)} notification(s) · ${fmt.nombre(nonLues)} non lue(s)`
              : undefined
          }
        />

        {chargement ? (
          <Chargement />
        ) : notifications.length === 0 ? (
          <EtatVide
            titre={filtre === 'TOUTES' ? 'Aucune notification' : 'Aucune notification pour ce filtre'}
            texte={
              filtre === 'TOUTES'
                ? 'Les événements apparaîtront ici dès la première inscription ou le premier don.'
                : 'Changez de filtre pour voir les autres événements.'
            }
          />
        ) : (
          <div>
            {notifications.map((notification) => {
              const apparence = APPARENCE[notification.type] ?? APPARENCE.DONATION;
              const Icone = apparence.Icone;
              const cible = destination(notification);
              // Quelqu'un attend une reponse tant qu'elle n'est pas lue :
              // la ligne le dit, plutot que de se fondre dans le journal.
              const aTraiter = !notification.isRead && DEMANDES.includes(notification.type);

              return (
                <article
                  className={
                    `notif${notification.isRead ? '' : ' notif--non-lue'}` +
                    (cible ? ' notif--cliquable' : '') +
                    (aTraiter ? ' notif--demande' : '')
                  }
                  key={notification.id}
                >
                  <span
                    className={`notif__marque notif__marque--${apparence.classe}`}
                    aria-hidden="true"
                  >
                    <Icone />
                  </span>

                  <div className="notif__contenu">
                    {aTraiter && <span className="notif__attente">À traiter</span>}
                    <p className="notif__texte">
                      {cible ? (
                        // Le lien s'etire sur toute la ligne via son ::after,
                        // ce qui rend la notification entiere cliquable sans
                        // imbriquer le bouton "marquer comme lu" dedans.
                        <Link className="notif__lien" to={cible} onClick={() => ouvrir(notification)}>
                          {notification.label}
                        </Link>
                      ) : (
                        notification.label
                      )}
                    </p>
                    <p className="notif__meta">
                      {fmt.depuis(notification.createdAt)} · {fmt.date(notification.createdAt)}
                      {notification.donationReference ? ` · ${notification.donationReference}` : ''}
                    </p>
                  </div>

                  {!notification.isRead && (
                    <div className="notif__actions">
                      <button
                        type="button"
                        className="lien-action"
                        onClick={() => marquerLue(notification)}
                        disabled={envoi}
                      >
                        Marquer comme lu
                      </button>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </Panneau>
    </>
  );
}
