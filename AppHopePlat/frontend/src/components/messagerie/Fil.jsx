import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

import { Link } from 'react-router-dom';

import { IconeChevronGauche } from '../admin/AdminIcons.jsx';
import { messageErreur } from '../../services/api.js';
import * as service from '../../services/messagerie.service.js';
import ActionsFil, { useActionsFil } from './ActionsFil.jsx';
import Avatar from './Avatar.jsx';
import { ActionsGroupe } from './Groupes.jsx';
import MenuMessage from './MenuMessage.jsx';
import PanneauInfo from './PanneauInfo.jsx';
import PiecesMessage from './PiecesMessage.jsx';
import { lienProfil } from './profil.js';
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
 *   onOuvrirFil: (id: number) => void,
 *   espace: 'admin'|'benevole'|'bailleur',
 *   onQuitte: (nom: string) => void,
 * }} props
 */
export default function Fil({ api, racine, id, pleinEcran, onRetour, onLu, onActivite, onOuvrirFil, espace, onQuitte }) {
  const [donnees, setDonnees] = useState(null);
  // Le panneau d'information : ferme a chaque changement de fil, puisque
  // le fil est remonte (sa cle est son identifiant).
  const [panneau, setPanneau] = useState(false);
  const [eclat, setEclat] = useState(null);
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

  /** Un message modifie ou supprime prend la place de l'ancien, sans recharger le fil. */
  const remplacer = useCallback(
    (message) =>
      setDonnees((actuel) =>
        actuel && actuel.conversation.id === id
          ? { ...actuel, messages: actuel.messages.map((m) => (m.id === message.id ? message : m)) }
          : actuel
      ),
    [id]
  );

  /*
   * Apres un transfert vers un seul fil, on l'ouvre -- et si c'est celui-ci,
   * on le recharge : la copie doit y apparaitre.
   */
  const ouvrirFil = useCallback(
    (cible) => {
      if (Number(cible) === Number(id)) charger();
      else onOuvrirFil?.(cible);
    },
    [id, charger, onOuvrirFil]
  );

  /*
   * Aller a un message trouve par la recherche : le faire defiler au centre
   * et le faire briller un instant, pour que l'oeil le retrouve.
   */
  const allerAuMessage = useCallback((messageId) => {
    const element = document.getElementById(`message-${messageId}`);
    if (!element) return;
    element.scrollIntoView({ block: 'center', behavior: 'smooth' });
    setEclat(messageId);
    setTimeout(() => setEclat((actuel) => (actuel === messageId ? null : actuel)), 2200);
  }, []);

  const conversation = donnees?.conversation?.id === id ? donnees.conversation : null;
  const groupe = conversation?.type === 'groupe';

  // Le nom mene au profil de la personne quand il en existe un ; sinon il
  // ouvre le panneau, qui en tient lieu.
  const interlocuteur = conversation?.interlocuteur
    ? conversation.participants.find(
        (p) => p.type === conversation.interlocuteur.type && p.id === conversation.interlocuteur.id
      )
    : null;
  const profil = interlocuteur ? lienProfil(interlocuteur, espace) : null;

  return (
    <ActionsFil
      api={api}
      racine={racine}
      filId={id}
      onRemplacer={remplacer}
      onOuvrirFil={ouvrirFil}
      onActivite={onActivite}
    >
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
          <>
            {profil ? (
              <Link className="msg-fil__identite" to={profil} title="Voir le profil">
                <IdentiteFil conversation={conversation} />
              </Link>
            ) : (
              <button
                type="button"
                className="msg-fil__identite"
                onClick={() => setPanneau(true)}
                aria-label={`Informations sur ${conversation.nom}`}
              >
                <IdentiteFil conversation={conversation} />
              </button>
            )}
            <button
              type="button"
              className={`msg-icone msg-fil__info${panneau ? ' msg-icone--actif' : ''}`}
              onClick={() => setPanneau((ouvert) => !ouvert)}
              aria-label="Informations sur la conversation"
              aria-expanded={panneau}
              aria-pressed={panneau}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 11v5.5M12 7.6v.1" />
              </svg>
            </button>
          </>
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
              <Bulle message={message} groupe={groupe} eclat={eclat === message.id} />
            </Fragment>
          );
        })}
      </div>

      {conversation && <Saisie onEnvoyer={envoyer} />}

      {conversation && panneau && (
        <PanneauInfo
          api={api}
          racine={racine}
          conversation={conversation}
          messages={messages ?? []}
          equipe={donnees?.equipe ?? null}
          espace={espace}
          pleinEcran={pleinEcran}
          onFermer={() => setPanneau(false)}
          onAllerAuMessage={allerAuMessage}
          actionsGroupe={
            groupe && (
              <ActionsGroupe
                api={api}
                racine={racine}
                conversation={conversation}
                onAjoutes={() => {
                  charger();
                  onActivite?.();
                }}
                onQuitte={onQuitte}
              />
            )
          }
        />
      )}
    </section>
    </ActionsFil>
  );
}

/** L'avatar, le nom et le sous-titre de l'en-tete. */
function IdentiteFil({ conversation }) {
  return (
    <>
      <Avatar nom={conversation.nom} photoUrl={conversation.photoUrl} src={conversation.photoSrc} equipe={conversation.equipe} />
      <span className="msg-fil__noms">
        <span className="msg-fil__nom">{conversation.nom}</span>
        {conversation.sousTitre && <span className="msg-fil__sous-titre">{conversation.sousTitre}</span>}
      </span>
    </>
  );
}

/** Hauteur maximale du champ d'edition, dans la bulle. */
const HAUTEUR_EDITION = 200;

/**
 * Une bulle.
 *
 * Les siennes a droite, dans la couleur principale ; celles des autres a
 * gauche, en gris. Dans un groupe, le nom de l'auteur se pose au-dessus.
 *
 * Le bouton ⋯ ouvre les actions : transferer et copier pour tous, modifier
 * et supprimer pour l'auteur seulement. Un message supprime n'en a plus.
 */
export function Bulle({ message, groupe, eclat = false }) {
  const actions = useActionsFil();
  const moi = message.estDeMoi;
  const [edition, setEdition] = useState(false);

  const liste = [];
  if (!message.supprime && actions) {
    liste.push({ cle: 'transferer', libelle: 'Transférer', onChoisir: () => actions.demanderTransfert(message) });
    if (message.texte) {
      liste.push({ cle: 'copier', libelle: 'Copier le texte', onChoisir: () => actions.copier(message.texte) });
    }
    if (moi) {
      liste.push({ cle: 'modifier', libelle: 'Modifier', onChoisir: () => setEdition(true) });
      liste.push({ cle: 'supprimer', libelle: 'Supprimer', danger: true, onChoisir: () => actions.demanderSuppression(message) });
    }
  }

  return (
    <div
      className={`msg-rang msg-rang--${moi ? 'moi' : 'autre'}${eclat ? ' msg-rang--eclat' : ''}`}
      id={`message-${message.id}`}
    >
      {groupe && !moi && <p className="msg-rang__auteur">{message.auteur.nom}</p>}

      <div className="msg-rang__ligne">
        <div className={`msg-bulle${message.supprime ? ' msg-bulle--supprimee' : ''}${edition ? ' msg-bulle--edition' : ''}`}>
          {message.transfere && !message.supprime && <p className="msg-bulle__transfere">Transféré</p>}

          {message.supprime ? (
            <p className="msg-bulle__texte msg-bulle__texte--supprime">
              {moi ? 'Vous avez supprimé ce message' : 'Ce message a été supprimé'}
            </p>
          ) : (
            <>
              {message.pieces.length > 0 && <PiecesMessage pieces={message.pieces} />}
              {edition ? (
                <EditionBulle message={message} onFermer={() => setEdition(false)} />
              ) : (
                message.texte && (
                  <p className="msg-bulle__texte">
                    <TexteMessage texte={message.texte} />
                  </p>
                )
              )}
            </>
          )}

          {!edition && (
            <p className="msg-bulle__heure">
              {message.modifieLe && !message.supprime ? 'modifié · ' : ''}
              <time dateTime={message.creeLe}>{heure(message.creeLe)}</time>
            </p>
          )}
        </div>

        {!edition && liste.length > 0 && <MenuMessage actions={liste} cote={moi ? 'droite' : 'gauche'} />}
      </div>
    </div>
  );
}

/**
 * L'edition d'un message, dans sa bulle.
 *
 * Entree enregistre, Echap annule. L'edition ne se ferme qu'une fois
 * l'enregistrement termine : un clic ne suffit pas, et le bouton garde
 * son etat "en cours" jusqu'a la reponse.
 */
function EditionBulle({ message, onFermer }) {
  const actions = useActionsFil();
  const [texte, setTexte] = useState(message.texte);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState('');
  const champ = useRef(null);

  useLayoutEffect(() => {
    const element = champ.current;
    if (!element) return;
    element.style.height = 'auto';
    element.style.height = `${Math.min(element.scrollHeight, HAUTEUR_EDITION)}px`;
  }, [texte]);

  useEffect(() => {
    const element = champ.current;
    element?.focus();
    element?.setSelectionRange(element.value.length, element.value.length);
  }, []);

  const vide = texte.trim() === '';
  const sansPiece = message.pieces.length === 0;

  async function enregistrer() {
    if (envoi) return;
    if (vide && sansPiece) {
      setErreur('Un message sans pièce jointe ne peut pas être vide.');
      return;
    }
    if (texte.trim() === message.texte.trim()) {
      onFermer();
      return;
    }
    setEnvoi(true);
    setErreur('');
    try {
      await actions.modifier(message, texte);
      onFermer();
    } catch (echec) {
      setErreur(messageErreur(echec, 'La modification n’a pas pu être enregistrée.'));
      setEnvoi(false);
    }
  }

  function surTouche(evenement) {
    const composition = evenement.nativeEvent.isComposing || evenement.keyCode === 229;
    if (evenement.key === 'Enter' && !evenement.shiftKey && !composition) {
      evenement.preventDefault();
      enregistrer();
    } else if (evenement.key === 'Escape') {
      evenement.preventDefault();
      if (!envoi) onFermer();
    }
  }

  return (
    <div className="msg-edition">
      <label>
        <span className="sr-only">Modifier le message</span>
        <textarea
          ref={champ}
          rows={1}
          value={texte}
          onChange={(evenement) => {
            setTexte(evenement.target.value);
            setErreur('');
          }}
          onKeyDown={surTouche}
          maxLength={4000}
          disabled={envoi}
        />
      </label>

      {erreur && (
        <p className="msg-edition__erreur" role="alert">
          {erreur}
          {vide && sansPiece && (
            <>
              {' '}
              <button
                type="button"
                className="msg-edition__lien"
                onClick={() => {
                  onFermer();
                  actions.demanderSuppression(message);
                }}
              >
                Le supprimer
              </button>
            </>
          )}
        </p>
      )}

      <div className="msg-edition__boutons">
        <button type="button" className="msg-edition__bouton" onClick={onFermer} disabled={envoi}>
          Annuler
        </button>
        <button
          type="button"
          className="msg-edition__bouton msg-edition__bouton--principal"
          onClick={enregistrer}
          disabled={envoi}
        >
          {envoi ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>
    </div>
  );
}
