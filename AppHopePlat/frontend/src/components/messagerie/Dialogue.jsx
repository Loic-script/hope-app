import { useEffect, useId, useRef } from 'react';

/**
 * Une fenetre, par l'element <dialog> natif.
 *
 * showModal() apporte ce qu'il faudrait sinon reecrire : la couche
 * superieure -- au-dessus du fil plein ecran comme de tout le reste --,
 * Echap pour fermer, le focus garde a l'interieur et rendu ensuite a
 * l'element qui l'avait. Un clic sur le fond ferme aussi.
 *
 * @param {{ ouvert: boolean, titre: string, onFermer: () => void,
 *           pied?: React.ReactNode, large?: boolean, bloque?: boolean,
 *           children: React.ReactNode }} props
 *        bloque : pendant un envoi, ni Echap ni le fond ne ferment
 */
export default function Dialogue({ ouvert, titre, onFermer, pied, large = false, bloque = false, children }) {
  const element = useRef(null);
  // Deux fenetres coexistent dans un fil : leurs titres doivent avoir
  // chacun son identifiant.
  const idTitre = useId();

  useEffect(() => {
    const dialogue = element.current;
    if (!dialogue) return;
    if (ouvert && !dialogue.open) dialogue.showModal();
    if (!ouvert && dialogue.open) dialogue.close();
  }, [ouvert]);

  return (
    <dialog
      ref={element}
      className={`msg-dialogue${large ? ' msg-dialogue--large' : ''}`}
      aria-labelledby={idTitre}
      onCancel={(evenement) => {
        // Echap : le navigateur fermerait tout seul ; on garde la main.
        evenement.preventDefault();
        if (!bloque) onFermer();
      }}
      onClick={(evenement) => {
        // Le clic sur le fond atteint le <dialog> lui-meme, pas son contenu.
        if (evenement.target === element.current && !bloque) onFermer();
      }}
    >
      {ouvert && (
        <div className="msg-dialogue__cadre">
          <header className="msg-dialogue__entete">
            <h2 id={idTitre} className="msg-dialogue__titre">
              {titre}
            </h2>
            <button type="button" className="msg-icone" onClick={onFermer} disabled={bloque} aria-label="Fermer">
              <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="m6 6 12 12M18 6 6 18" />
              </svg>
            </button>
          </header>
          <div className="msg-dialogue__corps">{children}</div>
          {pied && <footer className="msg-dialogue__pied">{pied}</footer>}
        </div>
      )}
    </dialog>
  );
}
