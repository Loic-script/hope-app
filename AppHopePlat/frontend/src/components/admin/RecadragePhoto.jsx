import { useEffect, useRef, useState } from 'react';

const RAPPORT = 16 / 10;
const ZOOM_MAX = 4;
const LARGEUR_SORTIE = 1600;
const PAS_CLAVIER = 0.02;

function borner(valeur, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, valeur));
}

export default function RecadragePhoto({ source, onValider, onAnnuler, envoi = false }) {
  const cadre = useRef(null);
  const glisse = useRef(null);
  const [image, setImage] = useState(null);
  const [largeur, setLargeur] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [centre, setCentre] = useState({ x: 0.5, y: 0.5 });
  const [erreur, setErreur] = useState('');
  const [saisi, setSaisi] = useState(false);

  useEffect(() => {
    const element = new Image();
    element.onload = () => setImage(element);
    element.onerror = () => setErreur('La photo n’a pas pu être ouverte.');
    element.src = source;
  }, [source]);

  useEffect(() => {
    if (!cadre.current) return undefined;
    const observateur = new ResizeObserver(([entree]) => setLargeur(entree.contentRect.width));
    observateur.observe(cadre.current);
    return () => observateur.disconnect();
  }, []);

  const hauteur = largeur / RAPPORT;
  const echelle = image ? Math.max(largeur / image.naturalWidth, hauteur / image.naturalHeight) * zoom : 1;
  const affichee = image ? { l: image.naturalWidth * echelle, h: image.naturalHeight * echelle } : { l: 0, h: 0 };

  function cadrer(suivant, l = affichee.l, h = affichee.h) {
    if (!l || !h) return suivant;
    const demiX = largeur / (2 * l);
    const demiY = hauteur / (2 * h);
    return { x: borner(suivant.x, demiX, 1 - demiX), y: borner(suivant.y, demiY, 1 - demiY) };
  }

  function changerZoom(valeur) {
    const z = borner(valeur, 1, ZOOM_MAX);
    setZoom(z);
    if (image) {
      const e = Math.max(largeur / image.naturalWidth, hauteur / image.naturalHeight) * z;
      setCentre((c) => cadrer(c, image.naturalWidth * e, image.naturalHeight * e));
    }
  }

  function saisir(evenement) {
    if (!image || envoi) return;
    evenement.preventDefault();
    evenement.currentTarget.focus();
    evenement.currentTarget.setPointerCapture(evenement.pointerId);
    glisse.current = { x: evenement.clientX, y: evenement.clientY };
    setSaisi(true);
  }

  function deplacer(evenement) {
    if (!glisse.current) return;
    const dx = evenement.clientX - glisse.current.x;
    const dy = evenement.clientY - glisse.current.y;
    glisse.current = { x: evenement.clientX, y: evenement.clientY };
    setCentre((c) => cadrer({ x: c.x - dx / affichee.l, y: c.y - dy / affichee.h }));
  }

  function lacher() {
    glisse.current = null;
    setSaisi(false);
  }

  function auClavier(evenement) {
    const sens = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    }[evenement.key];
    if (sens) {
      evenement.preventDefault();
      setCentre((c) => cadrer({ x: c.x + sens[0] * PAS_CLAVIER, y: c.y + sens[1] * PAS_CLAVIER }));
    } else if (evenement.key === '+' || evenement.key === '=') {
      evenement.preventDefault();
      changerZoom(zoom + 0.1);
    } else if (evenement.key === '-') {
      evenement.preventDefault();
      changerZoom(zoom - 0.1);
    }
  }

  function valider() {
    if (!image) return;
    const largeurSource = largeur / echelle;
    const hauteurSource = hauteur / echelle;
    const x = centre.x * image.naturalWidth - largeurSource / 2;
    const y = centre.y * image.naturalHeight - hauteurSource / 2;
    const sortie = Math.round(Math.min(LARGEUR_SORTIE, largeurSource));
    const toile = document.createElement('canvas');
    toile.width = sortie;
    toile.height = Math.round(sortie / RAPPORT);
    const contexte = toile.getContext('2d');
    contexte.fillStyle = '#ffffff';
    contexte.fillRect(0, 0, toile.width, toile.height);
    contexte.imageSmoothingQuality = 'high';
    contexte.drawImage(image, x, y, largeurSource, hauteurSource, 0, 0, toile.width, toile.height);
    toile.toBlob(
      (blob) => {
        if (blob) onValider(blob);
        else setErreur('Le recadrage a échoué.');
      },
      'image/jpeg',
      0.9
    );
  }

  return (
    <div className="recadrage">
      <div
        ref={cadre}
        className={`recadrage__cadre${saisi ? ' recadrage__cadre--saisi' : ''}`}
        role="application"
        tabIndex={0}
        aria-label="Cadrage de la photo. Flèches pour déplacer, plus et moins pour zoomer."
        onPointerDown={saisir}
        onPointerMove={deplacer}
        onPointerUp={lacher}
        onPointerCancel={lacher}
        onKeyDown={auClavier}
      >
        {image && largeur > 0 && (
          <img
            src={source}
            alt=""
            draggable={false}
            className="recadrage__image"
            style={{
              width: affichee.l,
              height: affichee.h,
              left: largeur / 2 - centre.x * affichee.l,
              top: hauteur / 2 - centre.y * affichee.h,
            }}
          />
        )}
        <span className="recadrage__grille" aria-hidden="true" />
        {!image && !erreur && <span className="recadrage__attente">Ouverture de la photo…</span>}
      </div>

      <div className="recadrage__reglages">
        <label className="recadrage__zoom">
          <span>Zoom</span>
          <input
            type="range"
            min={1}
            max={ZOOM_MAX}
            step={0.01}
            value={zoom}
            onChange={(e) => changerZoom(Number(e.target.value))}
            disabled={!image || envoi}
          />
        </label>
        <p className="champ-admin__aide">
          Faites glisser la photo pour la placer. Le cadre montre ce qui apparaîtra sur la carte de l’actualité.
        </p>
      </div>

      {erreur && <p className="champ-admin__message">{erreur}</p>}

      <div className="recadrage__actions">
        <button type="button" className="btn btn--neutre btn--petit" onClick={onAnnuler} disabled={envoi}>
          Annuler
        </button>
        <button type="button" className="btn btn--principal btn--petit" onClick={valider} disabled={!image || envoi}>
          {envoi ? 'Enregistrement…' : 'Valider le cadrage'}
        </button>
      </div>
    </div>
  );
}
