import { useEffect, useLayoutEffect, useRef, useState } from 'react';

import { messageErreur } from '../../services/api.js';
import { poids } from './outils.js';
import { ACCEPTE, MAX_PIECES, ajouterFichiers, natureDe } from './pieces.js';

/** Hauteur maximale du champ, au-dela il defile. */
const HAUTEUR_MAX = 160;

/**
 * Une trentaine d'emojis, choisis.
 *
 * Des reactions de travail, et les drapeaux des pays avec qui HOPE
 * echange. Une bibliotheque entiere pesait plus lourd que la messagerie
 * elle-meme, pour des milliers de symboles que personne n'envoie ici.
 */
export const EMOJIS = [
  ['👍', 'Pouce levé'], ['👏', 'Applaudissements'], ['🙏', 'Merci'], ['🙂', 'Sourire'],
  ['😊', 'Content'], ['😄', 'Rire'], ['😉', 'Clin d’œil'], ['🤝', 'Poignée de main'],
  ['💪', 'Courage'], ['🎉', 'Bravo'], ['✅', 'Fait'], ['❌', 'Non'],
  ['⚠️', 'Attention'], ['❗', 'Important'], ['❓', 'Question'], ['💡', 'Idée'],
  ['📌', 'À retenir'], ['📎', 'Pièce jointe'], ['📅', 'Date'], ['⏰', 'Heure'],
  ['📞', 'Appel'], ['✉️', 'Courriel'], ['👀', 'Je regarde'], ['🔥', 'Urgent'],
  ['❤️', 'Cœur'], ['👋', 'Bonjour'], ['🇲🇬', 'Madagascar'], ['🇫🇷', 'France'],
  ['🇬🇧', 'Royaume-Uni'], ['🇺🇸', 'États-Unis'],
];

/**
 * La zone de saisie.
 *
 * - le champ grandit avec le texte, jusqu'a HAUTEUR_MAX ;
 * - Entree envoie, Maj+Entree passe a la ligne, et rien ne part pendant
 *   une composition IME -- l'Entree qui valide un caractere en chinois ou
 *   en japonais n'est pas un envoi ;
 * - un emoji s'insere au curseur, qui se replace juste apres lui ;
 * - le trombone joint jusqu'a cinq photos, videos ou PDF, affiches en
 *   etiquettes qu'on retire avant l'envoi.
 *
 * @param {{ onEnvoyer: (contenu: {corps: string, fichiers: File[]}) => Promise<void>,
 *           desactive?: boolean }} props
 */
export default function Saisie({ onEnvoyer, desactive = false }) {
  const [texte, setTexte] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState('');
  const [palette, setPalette] = useState(false);
  const [fichiers, setFichiers] = useState([]);
  const champ = useRef(null);
  const selecteur = useRef(null);

  /*
   * Le champ fichier cache reflete la selection affichee.
   *
   * Retirer une etiquette doit aussi retirer le fichier du champ : sa
   * liste n'est pas modifiable, on la reconstruit donc par DataTransfer.
   */
  useEffect(() => {
    if (!selecteur.current || typeof DataTransfer === 'undefined') return;
    const transfert = new DataTransfer();
    for (const fichier of fichiers) transfert.items.add(fichier);
    selecteur.current.files = transfert.files;
  }, [fichiers]);

  function choisir(liste) {
    const { retenus, erreurs } = ajouterFichiers(fichiers, liste);
    setFichiers(retenus);
    setErreur(erreurs.join(' '));
  }

  function retirer(index) {
    setFichiers((actuels) => actuels.filter((_, i) => i !== index));
    setErreur('');
  }

  // Le champ suit la hauteur de son contenu.
  useLayoutEffect(() => {
    const element = champ.current;
    if (!element) return;
    element.style.height = 'auto';
    element.style.height = `${Math.min(element.scrollHeight, HAUTEUR_MAX)}px`;
    element.style.overflowY = element.scrollHeight > HAUTEUR_MAX ? 'auto' : 'hidden';
  }, [texte]);

  const peutEnvoyer = (texte.trim() !== '' || fichiers.length > 0) && !envoi && !desactive;

  async function envoyer() {
    if (!peutEnvoyer) return;
    setEnvoi(true);
    setErreur('');
    try {
      await onEnvoyer({ corps: texte, fichiers });
      // Reinitialise seulement une fois l'envoi confirme : un echec garde
      // le texte et les pieces, qu'on n'a pas a reprendre.
      setTexte('');
      setFichiers([]);
    } catch (echec) {
      setErreur(messageErreur(echec, 'Le message n’a pas pu être envoyé.'));
    } finally {
      setEnvoi(false);
      champ.current?.focus();
    }
  }

  function surTouche(evenement) {
    // keyCode 229 : ce que certains navigateurs envoient pendant une
    // composition, quand isComposing n'est pas encore pose.
    const composition = evenement.nativeEvent.isComposing || evenement.keyCode === 229;
    if (evenement.key === 'Enter' && !evenement.shiftKey && !composition) {
      evenement.preventDefault();
      envoyer();
    }
  }

  function insererEmoji(emoji) {
    const element = champ.current;
    const debut = element?.selectionStart ?? texte.length;
    const fin = element?.selectionEnd ?? debut;
    setTexte(texte.slice(0, debut) + emoji + texte.slice(fin));
    setPalette(false);

    // Le curseur se replace apres l'emoji, une fois le texte rendu.
    requestAnimationFrame(() => {
      if (!element) return;
      element.focus();
      const position = debut + emoji.length;
      element.setSelectionRange(position, position);
    });
  }

  return (
    <div className="msg-saisie">
      {fichiers.length > 0 && (
        <ul className="msg-etiquettes" aria-label="Pièces jointes à envoyer">
          {fichiers.map((fichier, index) => (
            <li key={`${fichier.name}-${fichier.size}-${fichier.lastModified}`} className="msg-etiquette">
              <span className="msg-etiquette__icone" aria-hidden="true">
                {{ image: '🖼️', video: '🎬', pdf: '📄' }[natureDe(fichier)]}
              </span>
              <span className="msg-etiquette__nom">{fichier.name}</span>
              <span className="msg-etiquette__poids">{poids(fichier.size)}</span>
              <button
                type="button"
                className="msg-etiquette__retirer"
                onClick={() => retirer(index)}
                disabled={envoi}
                aria-label={`Retirer ${fichier.name}`}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      <form
        className="msg-saisie__ligne"
        onSubmit={(evenement) => {
          evenement.preventDefault();
          envoyer();
        }}
      >
        <PaletteEmojis ouverte={palette} onBasculer={setPalette} onChoisir={insererEmoji} />

        <button
          type="button"
          className="msg-saisie__outil"
          onClick={() => selecteur.current?.click()}
          disabled={envoi || desactive || fichiers.length >= MAX_PIECES}
          aria-label={
            fichiers.length >= MAX_PIECES ? 'Cinq pièces jointes au plus' : 'Joindre une photo, une vidéo ou un PDF'
          }
        >
          <IconeTrombone />
        </button>
        <input
          ref={selecteur}
          type="file"
          multiple
          accept={ACCEPTE}
          hidden
          onChange={(evenement) => {
            const liste = [...(evenement.target.files ?? [])];
            // Les fichiers deja retenus sont dans l'etat : le champ, lui,
            // ne garde que la derniere selection du systeme.
            choisir(liste.filter((f) => !fichiers.includes(f)));
          }}
        />

        <label className="msg-saisie__champ">
          <span className="sr-only">Votre message</span>
          <textarea
            ref={champ}
            rows={1}
            value={texte}
            onChange={(evenement) => setTexte(evenement.target.value)}
            onKeyDown={surTouche}
            placeholder="Écrire un message…"
            maxLength={4000}
            disabled={desactive}
          />
        </label>

        <button
          type="submit"
          className="msg-saisie__envoyer"
          disabled={!peutEnvoyer}
          aria-label={envoi ? 'Envoi en cours' : 'Envoyer'}
        >
          {envoi ? <span className="msg-rotation" aria-hidden="true" /> : <IconeEnvoyer />}
        </button>
      </form>

      {erreur && (
        <p className="msg-saisie__erreur" role="alert">
          {erreur}
        </p>
      )}
    </div>
  );
}

/**
 * La palette d'emojis : un bouton, et une grille qu'on parcourt au clavier.
 *
 * Fleches pour se deplacer, Entree pour choisir, Echap pour refermer --
 * le focus revient alors au bouton qui l'avait ouverte.
 */
function PaletteEmojis({ ouverte, onBasculer, onChoisir }) {
  const bouton = useRef(null);
  const grille = useRef(null);
  const COLONNES = 6;

  // Ouverte : le premier emoji prend le focus.
  useEffect(() => {
    if (ouverte) grille.current?.querySelector('button')?.focus();
  }, [ouverte]);

  // Un clic ailleurs referme.
  useEffect(() => {
    if (!ouverte) return undefined;
    const surClic = (evenement) => {
      if (!grille.current?.contains(evenement.target) && !bouton.current?.contains(evenement.target)) {
        onBasculer(false);
      }
    };
    document.addEventListener('mousedown', surClic);
    return () => document.removeEventListener('mousedown', surClic);
  }, [ouverte, onBasculer]);

  function surTouche(evenement) {
    const boutons = [...grille.current.querySelectorAll('button')];
    const actuel = boutons.indexOf(document.activeElement);
    const deplacements = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: COLONNES, ArrowUp: -COLONNES };

    if (evenement.key === 'Escape') {
      evenement.preventDefault();
      onBasculer(false);
      bouton.current?.focus();
      return;
    }
    if (deplacements[evenement.key] !== undefined) {
      evenement.preventDefault();
      const suivant = Math.min(boutons.length - 1, Math.max(0, actuel + deplacements[evenement.key]));
      boutons[suivant]?.focus();
    }
  }

  return (
    <div className="msg-emojis">
      <button
        ref={bouton}
        type="button"
        className="msg-saisie__outil"
        aria-label="Insérer un émoji"
        aria-expanded={ouverte}
        aria-haspopup="true"
        onClick={() => onBasculer(!ouverte)}
      >
        <span aria-hidden="true">🙂</span>
      </button>

      {ouverte && (
        <div ref={grille} className="msg-emojis__grille" role="group" aria-label="Émojis" onKeyDown={surTouche}>
          {EMOJIS.map(([emoji, nom]) => (
            <button
              key={emoji}
              type="button"
              className="msg-emojis__emoji"
              aria-label={nom}
              title={nom}
              onClick={() => onChoisir(emoji)}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function IconeTrombone() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="m20.5 11.5-8.3 8.3a5.2 5.2 0 0 1-7.4-7.4l8.6-8.6a3.5 3.5 0 0 1 4.9 4.9l-8.6 8.6a1.7 1.7 0 0 1-2.5-2.5l7.9-7.9" />
    </svg>
  );
}

function IconeEnvoyer() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M3.4 20.4 21 12 3.4 3.6l-.02 6.53L15 12 3.38 13.87z" fill="currentColor" />
    </svg>
  );
}
