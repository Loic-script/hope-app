import { Link, useOutletContext } from 'react-router-dom';

import {
  IconeBudgets,
  IconeDons,
  IconeMessages,
  IconePersonne,
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
];

/** Icone et teinte de la pastille selon la nature de l'evenement. */
const APPARENCE = {
  DONATION: { Icone: IconeDons, classe: 'don' },
  INVESTMENT: { Icone: IconeBudgets, classe: 'investi' },
  MESSAGE: { Icone: IconeMessages, classe: 'message' },
  PROJECT_COMPLETED: { Icone: IconeValide, classe: 'projet' },
  ACCOUNT_CREATED: { Icone: IconePersonne, classe: 'compte' },
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
  const { type, projectId, donorAccountId } = notification;

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
        type: ['DONATION', 'INVESTMENT', 'MESSAGE', 'PROJECT_COMPLETED', 'ACCOUNT_CREATED'].includes(
          filtre
        )
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
        accroche="Chaque compte ouvert, chaque don reçu, chaque investissement du fonds, chaque message et chaque projet terminé."
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

              return (
                <article
                  className={
                    `notif${notification.isRead ? '' : ' notif--non-lue'}` +
                    (cible ? ' notif--cliquable' : '')
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
