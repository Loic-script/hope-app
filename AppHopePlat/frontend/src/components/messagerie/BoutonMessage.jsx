import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { messageErreur } from '../../services/api.js';
import * as service from '../../services/messagerie.service.js';

export default function BoutonMessage({
  api,
  racine,
  cheminMessages,
  cible,
  libelle = 'Envoyer un message',
  onErreur,
  className = 'btn btn--neutre btn--petit',
  children = null,
}) {
  const [envoi, setEnvoi] = useState(false);
  const enCours = useRef(false);
  const navigate = useNavigate();

  async function ouvrir() {
    if (enCours.current) return;
    enCours.current = true;
    setEnvoi(true);
    try {
      const id = await service.depuisFiche(api, racine, cible);
      navigate(`${cheminMessages}?t=${id}`);
    } catch (echec) {
      onErreur?.(messageErreur(echec, 'La conversation n’a pas pu être ouverte.'));
      enCours.current = false;
      setEnvoi(false);
    }
  }

  return (
    <button type="button" className={className} onClick={ouvrir} disabled={envoi} aria-busy={envoi}>
      {children}
      {envoi ? 'Ouverture…' : libelle}
    </button>
  );
}
