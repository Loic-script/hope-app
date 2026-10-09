import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { PleineMessages } from '../IconesPleines.jsx';
import * as service from '../../services/messagerie.service.js';

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
