import { useCallback, useEffect, useRef, useState } from 'react';

export function useCarteDeplacable(
  cle,
  { pas = 16, grandPas = 64, reduiteParDefaut = false, entiere = false, margeHaut = 8 } = {}
) {
  const enveloppe = useRef(null);
  const glissement = useRef(null);

  const [position, setPosition] = useState(() => lireChoix(cle, reduiteParDefaut).position);
  const [reduite, setReduite] = useState(() => lireChoix(cle, reduiteParDefaut).reduite);
  const [enDeplacement, setEnDeplacement] = useState(false);

  useEffect(() => {
    ecrireChoix(cle, { position, reduite });
  }, [cle, position, reduite]);

  const borner = useCallback((x, y) => {
    const element = enveloppe.current;
    if (!element) return { x, y };

    const cadre = element.getBoundingClientRect();
    const transformation = getComputedStyle(element).transform;
    const affiche =
      transformation && transformation !== 'none' ? new DOMMatrixReadOnly(transformation) : { m41: 0, m42: 0 };
    const gauche = cadre.left - affiche.m41;
    const haut = cadre.top - affiche.m42;

    if (entiere) {
      const marge = 8;
      return {
        x: Math.round(Math.min(Math.max(x, marge - gauche), window.innerWidth - gauche - cadre.width - marge)),
        y: Math.round(Math.min(Math.max(y, margeHaut - haut), window.innerHeight - haut - cadre.height - marge)),
      };
    }

    const visible = 72;

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
  }, [entiere, margeHaut]);

  const deplacerDe = useCallback(
    (dx, dy) => setPosition((actuelle) => borner(actuelle.x + dx, actuelle.y + dy)),
    [borner]
  );

  const remettre = useCallback(() => setPosition({ x: 0, y: 0 }), []);

  function commencer(evenement) {
    if (evenement.button !== 0) return;

    try {
      evenement.currentTarget.setPointerCapture?.(evenement.pointerId);
    } catch {
    }
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
    try {
      evenement.currentTarget.releasePointerCapture?.(evenement.pointerId);
    } catch {
    }
    glissement.current = null;
    setEnDeplacement(false);
  }

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

  useEffect(() => {
    function recadrer() {
      setPosition((actuelle) =>
        actuelle.x === 0 && actuelle.y === 0 ? actuelle : borner(actuelle.x, actuelle.y)
      );
    }
    window.addEventListener('resize', recadrer);
    return () => window.removeEventListener('resize', recadrer);
  }, [borner]);

  useEffect(() => {
    if (!entiere || reduite) return undefined;
    const minuterie = setTimeout(() => {
      setPosition((actuelle) =>
        actuelle.x === 0 && actuelle.y === 0 ? actuelle : borner(actuelle.x, actuelle.y)
      );
    }, 420);
    return () => clearTimeout(minuterie);
  }, [entiere, reduite, borner]);

  const deplacee = position.x !== 0 || position.y !== 0;

  return {
    deplacee,
    reduite,
    enDeplacement,
    basculerReduction: () => setReduite((repliee) => !repliee),
    remettre,
    enveloppe: {
      ref: enveloppe,
      className: `carte-mobile${enDeplacement ? ' carte-mobile--saisie' : ''}${
        deplacee ? ' carte-mobile--deplacee' : ''
      }${reduite ? ' carte-mobile--reduite' : ''}`,
      style: { '--x': `${position.x}px`, '--y': `${position.y}px` },
    },
    poignee: {
      onPointerDown: commencer,
      onPointerMove: suivre,
      onPointerUp: terminer,
      onPointerCancel: terminer,
      onKeyDown: auClavier,
    },
  };
}

const VIDE = { position: { x: 0, y: 0 }, reduite: false };

function lireChoix(cle, reduiteParDefaut = false) {
  const vide = { ...VIDE, reduite: reduiteParDefaut };
  try {
    const brut = window.localStorage.getItem(cle);
    if (!brut) return vide;

    const lu = JSON.parse(brut);
    return {
      position: {
        x: Number.isFinite(lu?.position?.x) ? lu.position.x : 0,
        y: Number.isFinite(lu?.position?.y) ? lu.position.y : 0,
      },
      reduite: Boolean(lu?.reduite),
    };
  } catch {
    return vide;
  }
}

function ecrireChoix(cle, choix) {
  try {
    window.localStorage.setItem(cle, JSON.stringify(choix));
  } catch {
  }
}
