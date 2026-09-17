import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { messageErreur } from '../../services/api.js';
import * as service from '../../services/messagerie.service.js';

/**
 * "Envoyer un message", depuis la fiche d'une personne ou d'une organisation.
 *
 * Le bouton declenche une action serveur, pas une navigation : le fil est
 * retrouve ou cree, puis on y entre. Il se desactive des le premier clic --
 * un double clic ne part pas deux fois --, et le serveur, sous verrou, ne
 * creerait de toute facon qu'un seul fil.
 *
 * @param {{ api: object, racine: string, cheminMessages: string,
 *           cible: {personne?: object, entreprise?: string},
 *           libelle?: string, onErreur?: (message: string) => void }} props
 */
export default function BoutonMessage({ api, racine, cheminMessages, cible, libelle = 'Envoyer un message', onErreur }) {
  const [envoi, setEnvoi] = useState(false);
  const enCours = useRef(false);
  const navigate = useNavigate();

  async function ouvrir() {
    // Le ref ferme la porte avant meme que React ait desactive le bouton.
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
    <button type="button" className="btn btn--neutre btn--petit" onClick={ouvrir} disabled={envoi} aria-busy={envoi}>
      {envoi ? 'Ouverture…' : libelle}
    </button>
  );
}
