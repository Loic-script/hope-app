import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Une carte que la personne peut deplacer et reduire.
 *
 * Le besoin : une carte de reperes occupe un coin de l'ecran ; chacun ne
 * la veut pas au meme endroit, et parfois pas du tout. Plutot que de
 * figer un choix, on lui laisse la main -- et on retient ce qu'elle a
 * choisi d'une visite a l'autre.
 *
 * Trois regles ont guide l'ecriture :
 *
 *   - la souris n'est pas la seule facon de deplacer. La poignee est un
 *     vrai bouton : les fleches la deplacent de 16 px (64 px avec Maj),
 *     "Origine" la remet en place. Le glisser n'est jamais le seul
 *     chemin (WCAG 2.2, "Dragging Movements") ;
 *   - la carte ne peut pas se perdre. La position est bornee : il en
 *     reste toujours de quoi la rattraper a l'ecran ;
 *   - ce que la personne a choisi lui appartient. La position et l'etat
 *     replie vivent dans son navigateur, jamais sur le serveur.
 *
 * Le glisser se fait aux evenements "pointer" : souris, doigt et stylet
 * suivent le meme chemin, et la capture du pointeur garde le mouvement
 * meme si le doigt sort de la poignee.
 *
 * @param {string} cle  ou retenir le choix (localStorage)
 * @param {{ pas?: number, grandPas?: number }} [options]
 */
export function useCarteDeplacable(cle, { pas = 16, grandPas = 64 } = {}) {
  const enveloppe = useRef(null);
  const glissement = useRef(null);

  const [position, setPosition] = useState(() => lireChoix(cle).position);
  const [reduite, setReduite] = useState(() => lireChoix(cle).reduite);
  const [enDeplacement, setEnDeplacement] = useState(false);

  // Le choix survit a la visite : on l'ecrit des qu'il change.
  useEffect(() => {
    ecrireChoix(cle, { position, reduite });
  }, [cle, position, reduite]);

  /** Borne la position pour qu'il reste toujours de la carte a l'ecran. */
  const borner = useCallback((x, y) => {
    const element = enveloppe.current;
    if (!element) return { x, y };

    const cadre = element.getBoundingClientRect();
    // La place naturelle de la carte : sa position a l'ecran, moins le
    // deplacement deja applique.
    const gauche = cadre.left - position.x;
    const haut = cadre.top - position.y;
    const visible = 72; // ce qu'il faut voir pour pouvoir la reprendre

    return {
      x: Math.round(
        Math.min(
          Math.max(x, visible - gauche - cadre.width),
          window.innerWidth - gauche - visible
        )
      ),
      y: Math.round(
        Math.min(Math.max(y, -haut + 8), window.innerHeight - haut - visible)
      ),
    };
  }, [position.x, position.y]);

  const deplacerDe = useCallback(
    (dx, dy) => setPosition((actuelle) => borner(actuelle.x + dx, actuelle.y + dy)),
    [borner]
  );

  const remettre = useCallback(() => setPosition({ x: 0, y: 0 }), []);

  /* ------------------------- Le glisser ------------------------- */

  function commencer(evenement) {
    // Seul le bouton principal fait glisser ; le clic droit ouvre le menu.
    if (evenement.button !== 0) return;

    evenement.currentTarget.setPointerCapture?.(evenement.pointerId);
    glissement.current = {
      pointeur: evenement.pointerId,
      departX: evenement.clientX,
      departY: evenement.clientY,
      origine: position,
    };
    setEnDeplacement(true);
  }

  function suivre(evenement) {
    const en_cours = glissement.current;
    if (!en_cours || en_cours.pointeur !== evenement.pointerId) return;

    setPosition(
      borner(
        en_cours.origine.x + (evenement.clientX - en_cours.departX),
        en_cours.origine.y + (evenement.clientY - en_cours.departY)
      )
    );
  }

  function terminer(evenement) {
    if (!glissement.current) return;
    evenement.currentTarget.releasePointerCapture?.(evenement.pointerId);
    glissement.current = null;
    setEnDeplacement(false);
  }

  /* ------------------------- Le clavier ------------------------- */

  function auClavier(evenement) {
    const grand = evenement.shiftKey;
    const d = grand ? grandPas : pas;
    const mouvements = {
      ArrowLeft: [-d, 0],
      ArrowRight: [d, 0],
      ArrowUp: [0, -d],
      ArrowDown: [0, d],
    };

    if (mouvements[evenement.key]) {
      evenement.preventDefault();
      deplacerDe(...mouvements[evenement.key]);
      return;
    }
    if (evenement.key === 'Home') {
      evenement.preventDefault();
      remettre();
    }
  }

  // Un changement de taille de fenetre peut sortir la carte de l'ecran.
  useEffect(() => {
    function recadrer() {
      setPosition((actuelle) =>
        actuelle.x === 0 && actuelle.y === 0 ? actuelle : borner(actuelle.x, actuelle.y)
      );
    }
    window.addEventListener('resize', recadrer);
    return () => window.removeEventListener('resize', recadrer);
  }, [borner]);

  const deplacee = position.x !== 0 || position.y !== 0;

  return {
    deplacee,
    reduite,
    enDeplacement,
    basculerReduction: () => setReduite((repliee) => !repliee),
    remettre,
    /** A poser sur l'enveloppe de la carte. */
    enveloppe: {
      ref: enveloppe,
      className: `carte-mobile${enDeplacement ? ' carte-mobile--saisie' : ''}${
        deplacee ? ' carte-mobile--deplacee' : ''
      }${reduite ? ' carte-mobile--reduite' : ''}`,
      style: { '--x': `${position.x}px`, '--y': `${position.y}px` },
    },
    /** A poser sur le bouton qui sert de poignee. */
    poignee: {
      onPointerDown: commencer,
      onPointerMove: suivre,
      onPointerUp: terminer,
      onPointerCancel: terminer,
      onKeyDown: auClavier,
    },
  };
}

/* ------------------------------------------------------------------
   Ce que le navigateur retient
   ------------------------------------------------------------------ */

const VIDE = { position: { x: 0, y: 0 }, reduite: false };

/**
 * Le choix precedent, s'il y en a un.
 *
 * Tout est enveloppe : en navigation privee, ou quand les donnees de
 * site sont bloquees, la lecture leve une exception. La carte doit
 * s'afficher quand meme, a sa place d'origine.
 */
function lireChoix(cle) {
  try {
    const brut = window.localStorage.getItem(cle);
    if (!brut) return VIDE;

    const lu = JSON.parse(brut);
    return {
      position: {
        x: Number.isFinite(lu?.position?.x) ? lu.position.x : 0,
        y: Number.isFinite(lu?.position?.y) ? lu.position.y : 0,
      },
      reduite: Boolean(lu?.reduite),
    };
  } catch {
    return VIDE;
  }
}

function ecrireChoix(cle, choix) {
  try {
    window.localStorage.setItem(cle, JSON.stringify(choix));
  } catch {
    // Rien a faire : le choix ne vaudra que pour cette visite.
  }
}
