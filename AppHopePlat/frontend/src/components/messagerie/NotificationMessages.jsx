import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { PleineMessages } from '../IconesPleines.jsx';
import * as service from '../../services/messagerie.service.js';

/**
 * La notification "N messages non lus".
 *
 * Elle n'est pas stockee : elle se calcule a l'affichage, et disparait
 * d'elle-meme une fois les messages lus. Elle mene droit au fil du
 * message non lu le plus recent -- pas a la liste, ou il faudrait encore
 * le chercher.
 *
 * @param {{ api: object, racine: string, cheminMessages: string }} props
 */
export default function NotificationMessages({ api, racine, cheminMessages }) {
  const [etat, setEtat] = useState(null);

  useEffect(() => {
    let annule = false;
    service
      .nonLus(api, racine)
      .then((resultat) => {
        if (!annule) setEtat(resultat);
      })
      .catch(() => {
        // Sans compteur, pas de notification : rien a signaler de plus.
      });
    return () => {
      annule = true;
    };
  }, [api, racine]);

  if (!etat || etat.total === 0 || !etat.dernierFil) return null;

  return (
    <Link className="msg-notif" to={`${cheminMessages}?t=${etat.dernierFil}`}>
      <span className="msg-notif__icone" aria-hidden="true">
        <PleineMessages />
      </span>
      <span className="msg-notif__corps">
        <span className="msg-notif__titre">
          {etat.total} message{etat.total > 1 ? 's' : ''} non lu{etat.total > 1 ? 's' : ''}
        </span>
        <span className="msg-notif__texte">Ouvrir la conversation du plus récent</span>
      </span>
    </Link>
  );
}
