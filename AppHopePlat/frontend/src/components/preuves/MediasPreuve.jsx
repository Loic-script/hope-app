import { useCallback, useEffect, useState } from 'react';

import { IconeChevronDroit, IconeCroix } from '../admin/AdminIcons.jsx';
import { Chargement, EtatVide } from '../admin/ui.jsx';

const MAX_TUILES = 6;

export function useFichier(preuve, fichier, charger) {
  const [etat, setEtat] = useState({ url: null, chargement: false, echec: false });

  useEffect(() => {
    if (!fichier?.id) {
      setEtat({ url: null, chargement: false, echec: false });
      return undefined;
    }

    let annule = false;
    let courante = null;
    setEtat({ url: null, chargement: true, echec: false });

    charger(preuve, fichier)
      .then((resultat) => {
        if (annule) {
          if (resultat) URL.revokeObjectURL(resultat);
          return;
        }
        courante = resultat;
        setEtat({ url: resultat, chargement: false, echec: !resultat });
      })
      .catch(() => {
        if (!annule) setEtat({ url: null, chargement: false, echec: true });
      });

    return () => {
      annule = true;
      if (courante) URL.revokeObjectURL(courante);
    };
  }, [preuve, fichier, charger]);

  return etat;
}

export function Media({ preuve, fichier, charger, classe, commandes = false }) {
  const { url, chargement, echec } = useFichier(preuve, fichier, charger);

  const mime = fichier?.mimeType ?? '';
  const estVideo = mime.startsWith('video/');

  if (chargement) {
    return <Chargement texte={estVideo ? 'Chargement de la vidéo…' : 'Chargement…'} />;
  }

  if (echec || !url) {
    return (
      <EtatVide
        titre="Fichier introuvable"
        texte="Le fichier n’est plus sur le serveur. La preuve, elle, reste enregistrée."
      />
    );
  }

  if (mime.startsWith('image/')) {
    return <img className={classe} src={url} alt={preuve.description} />;
  }

  if (estVideo) {
    return (
      <video className={classe} src={url} controls={commandes} playsInline preload="metadata" />
    );
  }

  return (
    <a className="btn btn--principal" href={url} target="_blank" rel="noreferrer">
      Ouvrir le document
    </a>
  );
}

export function Galerie({ preuve, charger, onOuvrir }) {
  const fichiers = preuve.files ?? [];

  if (fichiers.length === 0) {
    return (
      <div className="lecteur lecteur--texte">
        <p className="lecteur__citation">{preuve.description}</p>
        <p className="lecteur__mention">Témoignage — cette preuve n’a pas de fichier.</p>
      </div>
    );
  }

  if (fichiers.length === 1) {
    return (
      <button
        type="button"
        className="lecteur lecteur--media lecteur--ouvrable"
        onClick={() => onOuvrir(0)}
        aria-label="Ouvrir en grand"
      >
        <Media preuve={preuve} fichier={fichiers[0]} charger={charger} classe="lecteur__media" />
      </button>
    );
  }

  const visibles = fichiers.slice(0, MAX_TUILES);
  const reste = fichiers.length - visibles.length;

  return (
    <div className="galerie" data-nombre={visibles.length}>
      {visibles.map((fichier, rang) => (
        <button
          type="button"
          className="galerie__tuile"
          key={fichier.id}
          onClick={() => onOuvrir(rang)}
          aria-label={`Ouvrir le fichier ${rang + 1} sur ${fichiers.length}`}
        >
          <Media preuve={preuve} fichier={fichier} charger={charger} classe="galerie__media" />
          {fichier.mimeType?.startsWith('video/') && (
            <span className="galerie__lecture" aria-hidden="true">
              ▶
            </span>
          )}
          {rang === visibles.length - 1 && reste > 0 && (
            <span className="galerie__reste" aria-hidden="true">
              +{reste}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

export function Carrousel({ preuve, charger, rang, onRang, onFermer }) {
  const fichiers = preuve.files ?? [];
  const total = fichiers.length;

  const precedent = useCallback(() => onRang((rang - 1 + total) % total), [rang, total, onRang]);
  const suivant = useCallback(() => onRang((rang + 1) % total), [rang, total, onRang]);

  useEffect(() => {
    const surTouche = (evenement) => {
      if (evenement.key === 'Escape') onFermer();
      if (evenement.key === 'ArrowLeft') precedent();
      if (evenement.key === 'ArrowRight') suivant();
    };
    document.addEventListener('keydown', surTouche);

    const defilement = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', surTouche);
      document.body.style.overflow = defilement;
    };
  }, [onFermer, precedent, suivant]);

  const fichier = fichiers[rang];
  if (!fichier) return null;

  return (
    <div
      className="visionneuse"
      role="dialog"
      aria-modal="true"
      aria-label={`Fichier ${rang + 1} sur ${total}`}
      onClick={onFermer}
    >
      <button type="button" className="visionneuse__fermer" onClick={onFermer} aria-label="Fermer">
        <IconeCroix />
      </button>

      <p className="visionneuse__compteur" aria-hidden="true">
        {rang + 1} / {total}
      </p>

      {total > 1 && (
        <button
          type="button"
          className="visionneuse__fleche visionneuse__fleche--gauche"
          onClick={(evenement) => {
            evenement.stopPropagation();
            precedent();
          }}
          aria-label="Fichier précédent"
        >
          <IconeChevronDroit />
        </button>
      )}

      <div className="visionneuse__scene" onClick={(evenement) => evenement.stopPropagation()}>
        <Media
          preuve={preuve}
          fichier={fichier}
          charger={charger}
          classe="visionneuse__media"
          commandes
        />
      </div>

      {total > 1 && (
        <button
          type="button"
          className="visionneuse__fleche visionneuse__fleche--droite"
          onClick={(evenement) => {
            evenement.stopPropagation();
            suivant();
          }}
          aria-label="Fichier suivant"
        >
          <IconeChevronDroit />
        </button>
      )}
    </div>
  );
}

export function Vignette({ preuve, charger }) {
  const principal = preuve?.files?.[0] ?? null;
  const [url, setUrl] = useState(null);

  useEffect(() => {
    let annule = false;
    let courante = null;

    if (principal?.mimeType?.startsWith('image/')) {
      charger(preuve, principal).then((resultat) => {
        if (annule) {
          if (resultat) URL.revokeObjectURL(resultat);
          return;
        }
        courante = resultat;
        setUrl(resultat);
      });
    }

    return () => {
      annule = true;
      if (courante) URL.revokeObjectURL(courante);
    };
  }, [preuve, principal, charger]);

  if (url) {
    return (
      <span className="preuve__vignette-cadre">
        <img className="preuve__vignette" src={url} alt="" />
        {preuve.files?.length > 1 && (
          <span className="preuve__compte" aria-hidden="true">
            +{preuve.files.length - 1}
          </span>
        )}
      </span>
    );
  }

  const etiquette = { TESTIMONY: '“”', VIDEO: '▶', DOCUMENT: 'PDF' }[preuve.proofType] ?? 'PDF';
  return (
    <span className="preuve__vignette preuve__vignette--vide" aria-hidden="true">
      {etiquette}
    </span>
  );
}
