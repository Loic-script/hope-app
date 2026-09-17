import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

import { IconeChevronGauche } from '../admin/AdminIcons.jsx';
import { messageErreur } from '../../services/api.js';
import * as service from '../../services/messagerie.service.js';
import Avatar from './Avatar.jsx';
import PiecesMessage from './PiecesMessage.jsx';
import { heure, libelleJour, memeJour } from './outils.js';
import Saisie from './Saisie.jsx';
import TexteMessage from './TexteMessage.jsx';

/**
 * Un fil ouvert : son en-tete, ses messages, sa zone de saisie.
 *
 * Il n'est rendu que s'il est affiche. C'est ce qui permet de le marquer
 * lu ici, sans autre precaution : sur un telephone, un fil choisi par
 * defaut mais cache derriere la liste n'est tout simplement pas monte.
 *
 * @param {{
 *   api: object, racine: string, id: number,
 *   pleinEcran: boolean, onRetour: () => void,
 *   onLu: (id: number, nonLus: {total: number}) => void,
 *   onActivite: () => void,
 * }} props
 */
export default function Fil({ api, racine, id, pleinEcran, onRetour, onLu, onActivite }) {
  const [donnees, setDonnees] = useState(null);
  const [erreur, setErreur] = useState('');
  const defilement = useRef(null);
  const dejaLu = useRef('');

  const charger = useCallback(async () => {
    try {
      const reponse = await service.recuperer(api, racine, id);
      setDonnees(reponse);
      setErreur('');
    } catch (echec) {
      setErreur(
        echec.response?.status === 404
          ? 'Cette conversation est introuvable.'
          : messageErreur(echec, 'La conversation n’a pas pu être chargée.')
      );
    }
  }, [api, racine, id]);

  // Changer de fil repart d'un ecran vide : sinon les messages du fil
  // precedent resteraient affiches sous le nom du nouveau.
  useEffect(() => {
    setDonnees(null);
    setErreur('');
    dejaLu.current = '';
    charger();
  }, [charger]);

  const messages = donnees?.conversation?.id === id ? donnees.messages : null;
  const dernier = messages?.[messages.length - 1] ?? null;

  /*
   * Marquer lu, depuis le navigateur, une fois le fil affiche.
   *
   * Jusqu'au dernier message montre, et pas "maintenant" : un message
   * arrive entre le chargement et cet appel n'a pas ete vu. On designe
   * ce message par son identifiant -- son heure, arrondie a la
   * milliseconde par JavaScript, le laisserait non lu. Un onglet en
   * arriere-plan attend d'etre regarde.
   */
  useEffect(() => {
    if (!messages) return undefined;
    const cle = `${id}:${dernier?.id ?? 'vide'}`;
    if (dejaLu.current === cle) return undefined;

    const marquer = () => {
      if (document.visibilityState !== 'visible' || dejaLu.current === cle) return;
      dejaLu.current = cle;
      service
        .marquerLu(api, racine, id, dernier?.id ?? null)
        .then((resultat) => onLu?.(id, resultat))
        .catch(() => {
          // Un echec laisse le fil non lu : on reessaiera au prochain affichage.
          dejaLu.current = '';
        });
    };

    marquer();
    document.addEventListener('visibilitychange', marquer);
    return () => document.removeEventListener('visibilitychange', marquer);
  }, [messages, dernier, id, api, racine, onLu]);

  // En plein ecran, la page dessous ne doit pas defiler avec le fil.
  useEffect(() => {
    if (!pleinEcran) return undefined;
    const avant = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = avant;
    };
  }, [pleinEcran]);

  // En bas a l'ouverture, et a chaque nouveau message.
  useLayoutEffect(() => {
    const element = defilement.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [id, messages?.length]);

  async function envoyer(contenu) {
    const message = await service.envoyer(api, racine, id, contenu);
    setDonnees((actuel) =>
      actuel && actuel.conversation.id === id ? { ...actuel, messages: [...actuel.messages, message] } : actuel
    );
    onActivite?.();
  }

  const conversation = donnees?.conversation?.id === id ? donnees.conversation : null;
  const groupe = conversation?.type === 'groupe';

  return (
    <section
      className={`msg-fil${pleinEcran ? ' msg-fil--plein-ecran' : ''}`}
      aria-label={conversation ? `Conversation avec ${conversation.nom}` : 'Conversation'}
    >
      <header className="msg-fil__entete">
        {pleinEcran && (
          <button type="button" className="msg-icone" onClick={onRetour} aria-label="Retour aux conversations">
            <IconeChevronGauche />
          </button>
        )}
        {conversation && (
          <div className="msg-fil__identite">
            <Avatar
              nom={conversation.nom}
              photoUrl={conversation.photoUrl}
              equipe={conversation.equipe}
            />
            <div className="msg-fil__noms">
              <h2 className="msg-fil__nom">{conversation.nom}</h2>
              {conversation.sousTitre && <p className="msg-fil__sous-titre">{conversation.sousTitre}</p>}
            </div>
          </div>
        )}
      </header>

      <div className="msg-fil__messages" ref={defilement}>
        {erreur && (
          <p className="msg-fil__etat" role="alert">
            {erreur}
          </p>
        )}
        {!erreur && !messages && <p className="msg-fil__etat">Chargement…</p>}
        {messages && messages.length === 0 && (
          <p className="msg-fil__etat">Aucun message. Écrivez le premier.</p>
        )}

        {messages?.map((message, index) => {
          const nouveauJour = index === 0 || !memeJour(messages[index - 1].creeLe, message.creeLe);
          return (
            <Fragment key={message.id}>
              {nouveauJour && (
                <div className="msg-jour" role="separator">
                  <span>{libelleJour(message.creeLe)}</span>
                </div>
              )}
              <Bulle message={message} groupe={groupe} />
            </Fragment>
          );
        })}
      </div>

      {conversation && <Saisie onEnvoyer={envoyer} />}
    </section>
  );
}

/**
 * Une bulle.
 *
 * Les siennes a droite, dans la couleur principale ; celles des autres a
 * gauche, en gris. Dans un groupe, le nom de l'auteur se pose au-dessus.
 */
export function Bulle({ message, groupe }) {
  const moi = message.estDeMoi;
  return (
    <div className={`msg-rang msg-rang--${moi ? 'moi' : 'autre'}`} id={`message-${message.id}`}>
      {groupe && !moi && <p className="msg-rang__auteur">{message.auteur.nom}</p>}

      <div className={`msg-bulle${message.supprime ? ' msg-bulle--supprimee' : ''}`}>
        {message.transfere && !message.supprime && <p className="msg-bulle__transfere">Transféré</p>}

        {message.supprime ? (
          <p className="msg-bulle__texte msg-bulle__texte--supprime">
            {moi ? 'Vous avez supprimé ce message' : 'Ce message a été supprimé'}
          </p>
        ) : (
          <>
            {message.pieces.length > 0 && <PiecesMessage pieces={message.pieces} />}
            {message.texte && (
              <p className="msg-bulle__texte">
                <TexteMessage texte={message.texte} />
              </p>
            )}
          </>
        )}

        <p className="msg-bulle__heure">
          {message.modifieLe && !message.supprime ? 'modifié · ' : ''}
          <time dateTime={message.creeLe}>{heure(message.creeLe)}</time>
        </p>
      </div>
    </div>
  );
}
