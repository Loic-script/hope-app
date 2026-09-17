import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { messageErreur } from '../../services/api.js';
import * as service from '../../services/messagerie.service.js';
import Avatar from './Avatar.jsx';
import Dialogue from './Dialogue.jsx';
import { correspond } from './outils.js';

/** Nombre de destinations d'un transfert. */
const MAX_CIBLES = 10;

const Contexte = createContext(null);

/** Les actions d'un fil, pour une bulle. */
export function useActionsFil() {
  return useContext(Contexte);
}

/**
 * Les actions sur les messages d'un fil, et leurs fenetres.
 *
 * Une seule fenetre "Supprimer" et une seule "Transferer" par fil,
 * pilotees d'ici : posees dans le menu d'une bulle, elles disparaitraient
 * avec lui des qu'il se referme.
 *
 * @param {{ api: object, racine: string, filId: number,
 *           onRemplacer: (message: object) => void,
 *           onOuvrirFil: (id: number) => void,
 *           onActivite: () => void, children: React.ReactNode }} props
 */
export default function ActionsFil({ api, racine, filId, onRemplacer, onOuvrirFil, onActivite, children }) {
  const [aSupprimer, setASupprimer] = useState(null);
  const [aTransferer, setATransferer] = useState(null);
  const [annonce, setAnnonce] = useState('');
  const minuterie = useRef(null);

  const annoncer = useCallback((texte) => {
    clearTimeout(minuterie.current);
    setAnnonce(texte);
    minuterie.current = setTimeout(() => setAnnonce(''), 3500);
  }, []);
  useEffect(() => () => clearTimeout(minuterie.current), []);

  const valeur = useMemo(
    () => ({
      demanderSuppression: setASupprimer,
      demanderTransfert: setATransferer,
      annoncer,
      /** Enregistre une modification ; la bulle attend la fin pour se refermer. */
      async modifier(message, corps) {
        const modifie = await service.modifier(api, racine, filId, message.id, corps);
        onRemplacer(modifie);
        onActivite?.();
        return modifie;
      },
      /** Copie le texte, avec un repli pour les navigateurs sans presse-papiers asynchrone. */
      async copier(texte) {
        try {
          await navigator.clipboard.writeText(texte);
        } catch {
          const zone = document.createElement('textarea');
          zone.value = texte;
          zone.setAttribute('readonly', '');
          zone.style.position = 'fixed';
          zone.style.opacity = '0';
          document.body.appendChild(zone);
          zone.select();
          document.execCommand('copy');
          zone.remove();
        }
        annoncer('Texte copié');
      },
    }),
    [api, racine, filId, onRemplacer, onActivite, annoncer]
  );

  return (
    <Contexte.Provider value={valeur}>
      {children}

      <SuppressionDialogue
        api={api}
        racine={racine}
        filId={filId}
        message={aSupprimer}
        onFermer={() => setASupprimer(null)}
        onSupprime={(message) => {
          onRemplacer(message);
          onActivite?.();
          setASupprimer(null);
        }}
      />

      <TransfertDialogue
        api={api}
        racine={racine}
        filId={filId}
        message={aTransferer}
        onFermer={() => setATransferer(null)}
        onTransfere={(fils) => {
          setATransferer(null);
          onActivite?.();
          if (fils.length === 1) {
            onOuvrirFil(fils[0]);
          } else {
            annoncer(`Message transféré dans ${fils.length} conversations`);
          }
        }}
      />

      <p className="msg-annonce" role="status" aria-live="polite">
        {annonce}
      </p>
    </Contexte.Provider>
  );
}

/* ================================================================
   Supprimer
   ================================================================ */

function SuppressionDialogue({ api, racine, filId, message, onFermer, onSupprime }) {
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState('');

  useEffect(() => {
    setErreur('');
    setEnvoi(false);
  }, [message]);

  async function confirmer() {
    setEnvoi(true);
    setErreur('');
    try {
      onSupprime(await service.supprimer(api, racine, filId, message.id));
    } catch (echec) {
      setErreur(messageErreur(echec, 'Le message n’a pas pu être supprimé.'));
    } finally {
      setEnvoi(false);
    }
  }

  const pieces = message?.pieces?.length ?? 0;

  return (
    <Dialogue
      ouvert={Boolean(message)}
      titre="Supprimer ce message ?"
      onFermer={onFermer}
      bloque={envoi}
      pied={
        <>
          <button type="button" className="btn btn--neutre" onClick={onFermer} disabled={envoi}>
            Annuler
          </button>
          <button type="button" className="btn btn--danger" onClick={confirmer} disabled={envoi}>
            {envoi ? 'Suppression…' : 'Supprimer'}
          </button>
        </>
      }
    >
      <p className="msg-dialogue__texte">
        Il sera supprimé pour tous les participants
        {pieces > 0 ? `, avec ses ${pieces > 1 ? `${pieces} pièces jointes` : 'pièce jointe'}` : ''}. Cette action
        ne peut pas être annulée.
      </p>
      {erreur && (
        <p className="msg-dialogue__erreur" role="alert">
          {erreur}
        </p>
      )}
    </Dialogue>
  );
}

/* ================================================================
   Transferer
   ================================================================ */

function TransfertDialogue({ api, racine, filId, message, onFermer, onTransfere }) {
  const [fils, setFils] = useState(null);
  const [personnes, setPersonnes] = useState(null);
  const [recherche, setRecherche] = useState('');
  const [choisis, setChoisis] = useState([]);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState('');

  // A chaque ouverture, une selection vide et des listes fraiches.
  useEffect(() => {
    if (!message) return undefined;
    setRecherche('');
    setChoisis([]);
    setErreur('');
    setFils(null);
    setPersonnes(null);

    let annule = false;
    Promise.all([service.lister(api, racine), service.joignables(api, racine)])
      .then(([liste, annuaire]) => {
        if (annule) return;
        setFils(liste.items);
        // "Autres personnes" : celles avec qui aucun fil a deux n'existe.
        setPersonnes(annuaire.filter((personne) => !personne.filId));
      })
      .catch((echec) => {
        if (!annule) setErreur(messageErreur(echec, 'Les destinations n’ont pas pu être chargées.'));
      });
    return () => {
      annule = true;
    };
  }, [message, api, racine]);

  const filsVisibles = useMemo(
    () => (fils ?? []).filter((fil) => correspond(recherche, fil.nom, fil.sousTitre)),
    [fils, recherche]
  );
  const personnesVisibles = useMemo(
    () => (personnes ?? []).filter((personne) => correspond(recherche, personne.nom, personne.sousTitre)),
    [personnes, recherche]
  );

  const estChoisi = (cle) => choisis.some((choix) => choix.cle === cle);
  function basculer(choix) {
    setChoisis((actuels) =>
      actuels.some((c) => c.cle === choix.cle)
        ? actuels.filter((c) => c.cle !== choix.cle)
        : actuels.length >= MAX_CIBLES
          ? actuels
          : [...actuels, choix]
    );
  }

  async function transferer() {
    setEnvoi(true);
    setErreur('');
    try {
      const cibles = choisis.map((choix) => ({ type: choix.type, id: choix.id }));
      onTransfere(await service.transferer(api, racine, filId, message.id, cibles));
    } catch (echec) {
      setErreur(messageErreur(echec, 'Le message n’a pas pu être transféré.'));
    } finally {
      setEnvoi(false);
    }
  }

  const pieces = message?.pieces ?? [];

  return (
    <Dialogue
      ouvert={Boolean(message)}
      titre="Transférer le message"
      onFermer={onFermer}
      bloque={envoi}
      large
      pied={
        <>
          <span className="msg-transfert__compteur">
            {choisis.length} sélectionné{choisis.length > 1 ? 's' : ''} sur {MAX_CIBLES} au plus
          </span>
          <button type="button" className="btn btn--neutre" onClick={onFermer} disabled={envoi}>
            Annuler
          </button>
          <button
            type="button"
            className="btn btn--principal"
            onClick={transferer}
            disabled={envoi || choisis.length === 0}
          >
            {envoi ? 'Transfert…' : `Transférer (${choisis.length})`}
          </button>
        </>
      }
    >
      {message && (
        <blockquote className="msg-transfert__rappel">
          <p className="msg-transfert__auteur">{message.auteur.nom}</p>
          {message.texte ? (
            <p className="msg-transfert__texte">{message.texte}</p>
          ) : (
            <p className="msg-transfert__texte">{pieces.map((piece) => `📎 ${piece.nom}`).join(' · ')}</p>
          )}
          {message.texte && pieces.length > 0 && (
            <p className="msg-transfert__pieces">{pieces.map((piece) => `📎 ${piece.nom}`).join(' · ')}</p>
          )}
        </blockquote>
      )}

      <label className="msg-recherche msg-transfert__recherche">
        <span className="sr-only">Rechercher une conversation ou une personne</span>
        <input
          type="search"
          value={recherche}
          onChange={(evenement) => setRecherche(evenement.target.value)}
          placeholder="Rechercher…"
          disabled={envoi}
        />
      </label>

      {choisis.length > 0 && (
        <ul className="msg-etiquettes msg-transfert__choisis" aria-label="Destinations choisies">
          {choisis.map((choix) => (
            <li key={choix.cle} className="msg-etiquette">
              <span className="msg-etiquette__nom">{choix.nom}</span>
              <button
                type="button"
                className="msg-etiquette__retirer"
                onClick={() => basculer(choix)}
                disabled={envoi}
                aria-label={`Retirer ${choix.nom}`}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      {erreur && (
        <p className="msg-dialogue__erreur" role="alert">
          {erreur}
        </p>
      )}

      <div className="msg-transfert__liste">
        {fils === null ? (
          !erreur && <p className="msg-liste__vide">Chargement…</p>
        ) : (
          <>
            <Section
              titre="Conversations"
              elements={filsVisibles.map((fil) => ({
                cle: `fil:${fil.id}`,
                type: 'fil',
                id: fil.id,
                nom: fil.nom,
                sousTitre: fil.type === 'groupe' ? `Groupe · ${fil.sousTitre}` : fil.sousTitre,
                photoUrl: fil.photoUrl,
                src: fil.photoSrc,
                equipe: fil.equipe,
                groupe: fil.type === 'groupe',
              }))}
              estChoisi={estChoisi}
              plein={choisis.length >= MAX_CIBLES}
              onBasculer={basculer}
              desactive={envoi}
            />
            <Section
              titre="Autres personnes"
              elements={personnesVisibles.map((personne) => ({
                cle: `${personne.type}:${personne.id}`,
                type: personne.type,
                id: personne.id,
                nom: personne.nom,
                sousTitre: personne.sousTitre,
                photoUrl: personne.photoUrl,
                equipe: personne.type === 'equipe',
              }))}
              estChoisi={estChoisi}
              plein={choisis.length >= MAX_CIBLES}
              onBasculer={basculer}
              desactive={envoi}
            />
            {filsVisibles.length === 0 && personnesVisibles.length === 0 && (
              <p className="msg-liste__vide">Rien ne correspond à « {recherche} ».</p>
            )}
          </>
        )}
      </div>
    </Dialogue>
  );
}

/** Une section de la liste a cocher. */
function Section({ titre, elements, estChoisi, plein, onBasculer, desactive }) {
  if (elements.length === 0) return null;
  return (
    <fieldset className="msg-choix">
      <legend className="msg-liste__section">{titre}</legend>
      {elements.map((element) => {
        const coche = estChoisi(element.cle);
        return (
          <label key={element.cle} className={`msg-choix__ligne${coche ? ' msg-choix__ligne--coche' : ''}`}>
            <input
              type="checkbox"
              checked={coche}
              disabled={desactive || (!coche && plein)}
              onChange={() => onBasculer(element)}
            />
            <Avatar nom={element.nom} photoUrl={element.photoUrl} src={element.src} equipe={element.equipe} taille="petite" />
            <span className="msg-choix__texte">
              <span className="msg-choix__nom">
                {element.groupe && (
                  <span className="msg-choix__groupe" aria-label="Groupe" title="Groupe">
                    <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
                      <path d="M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm7-1a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM2.5 19c0-3.3 2.9-6 6.5-6s6.5 2.7 6.5 6v1h-13v-1Zm14.5 1v-1c0-1.9-.7-3.6-1.9-4.9.4-.1.9-.1 1.4-.1 3 0 5.5 2.2 5.5 5v1H17Z" />
                    </svg>
                  </span>
                )}
                {element.nom}
              </span>
              {element.sousTitre && <span className="msg-choix__sous-titre">{element.sousTitre}</span>}
            </span>
          </label>
        );
      })}
    </fieldset>
  );
}
