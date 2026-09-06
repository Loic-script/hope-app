import { useOutletContext } from 'react-router-dom';

import {
  IconeBudgets,
  IconeDons,
  IconeJustificatifs,
  IconeValide,
} from '../../components/admin/AdminIcons.jsx';
import {
  Alerte,
  BarreOutils,
  Chargement,
  EntetePage,
  EtatVide,
  Panneau,
} from '../../components/admin/ui.jsx';
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
];

/** Icone et teinte de la pastille selon la nature de l'evenement. */
const APPARENCE = {
  DONATION: { Icone: IconeDons, classe: 'don' },
  INVESTMENT: { Icone: IconeBudgets, classe: 'investi' },
  MESSAGE: { Icone: IconeJustificatifs, classe: 'message' },
  PROJECT_COMPLETED: { Icone: IconeValide, classe: 'projet' },
};

/**
 * Ecran Notifications : le journal de ce qui arrive a HOPE.
 *
 * Un don reçu y apparait sous la forme demandee :
 *   « <donateur> a fait un don <ponctuel|mensuel> de <somme> pour
 *     <HOPE|projet> ».
 */
export default function NotificationsPage() {
  const { rafraichirCompteurs } = useOutletContext();
  const [filtre, setFiltre] = useState('TOUTES');

  const { donnees, chargement, erreur, recharger } = useChargement(
    () =>
      notificationService.lister({
        unread: filtre === 'NON_LUES' ? true : undefined,
        type: ['DONATION', 'INVESTMENT', 'MESSAGE', 'PROJECT_COMPLETED'].includes(filtre)
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
        accroche="Chaque don reçu, chaque investissement du fonds, chaque message et chaque projet terminé."
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
                ? 'Les événements apparaîtront ici dès le premier don enregistré.'
                : 'Changez de filtre pour voir les autres événements.'
            }
          />
        ) : (
          <div>
            {notifications.map((notification) => {
              const apparence = APPARENCE[notification.type] ?? APPARENCE.DONATION;
              const Icone = apparence.Icone;

              return (
                <article
                  className={`notif${notification.isRead ? '' : ' notif--non-lue'}`}
                  key={notification.id}
                >
                  <span
                    className={`notif__marque notif__marque--${apparence.classe}`}
                    aria-hidden="true"
                  >
                    <Icone />
                  </span>

                  <div className="notif__contenu">
                    <p className="notif__texte">{notification.label}</p>
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
