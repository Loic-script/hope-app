/**
 * Les fichiers d'une preuve terrain : mosaique et carrousel.
 *
 * Ecrit d'abord pour le back-office, puis partage avec l'espace
 * bailleur, qui montre les memes preuves vues du dehors. Ce qui change
 * d'un espace a l'autre tient dans "charger" : le fichier est servi
 * derriere le jeton, et chaque espace a le sien.
 *
 * Une balise <img src="..."> ne peut donc pas l'atteindre -- elle ne
 * porte pas d'en-tete Authorization. On passe par un blob, libere au
 * demontage : sans quoi le navigateur garderait chaque image en memoire
 * apres coup.
 */
import { useCallback, useEffect, useState } from 'react';

import { IconeChevronDroit, IconeCroix } from '../admin/AdminIcons.jsx';
import { Chargement, EtatVide } from '../admin/ui.jsx';

/**
 * Nombre de vignettes montrees par la mosaique.
 *
 * Six, et la sixieme porte le "+N" du reste. Au-dela, la mosaique
 * deviendrait une planche-contact : le carrousel est fait pour ca.
 */
const MAX_TUILES = 6;

/**
 * Charge un fichier et rend une URL locale utilisable.
 *
 * @returns {{ url: string|null, chargement: boolean, echec: boolean }}
 */
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
          // Le composant est parti pendant le telechargement : l'URL
          // n'ira nulle part, autant la rendre tout de suite.
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

/**
 * Un fichier affiche : image, video, ou repli.
 *
 * Le type MIME prime sur le type declare de la preuve. Les deux
 * concordent depuis que le service les verifie, mais les lignes creees
 * avant cette verification peuvent encore porter une video sous le type
 * "Photo" : c'est le fichier qui a raison, pas l'etiquette.
 *
 * @param {{ commandes?: boolean }} props une tuile de mosaique montre la
 *        premiere image d'une video, sans lecteur ; le carrousel, lui,
 *        donne les commandes.
 */
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
    // controls et non autoPlay : on ne lance pas le son d'une video de
    // terrain dans un bureau sans l'avoir demande.
    return (
      <video className={classe} src={url} controls={commandes} playsInline preload="metadata" />
    );
  }

  // Un PDF : le navigateur sait l'afficher, mais dans un cadre a lui.
  return (
    <a className="btn btn--principal" href={url} target="_blank" rel="noreferrer">
      Ouvrir le document
    </a>
  );
}

/**
 * La mosaique.
 *
 * Un seul fichier occupe tout le cadre ; a partir de deux, les tuiles se
 * rangent en grille et la premiere prend la place d'honneur. Au-dela de
 * six, la derniere porte le compte de ce qui reste.
 */
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
          {/* Le compte du reste, sur la derniere tuile seulement. */}
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

/**
 * Le carrousel plein ecran.
 *
 * Pose dans la page plutot que dans un portail : aucun des espaces n'a
 * d'autre couche flottante au-dessus, et position: fixed suffit.
 */
export function Carrousel({ preuve, charger, rang, onRang, onFermer }) {
  const fichiers = preuve.files ?? [];
  const total = fichiers.length;

  const precedent = useCallback(() => onRang((rang - 1 + total) % total), [rang, total, onRang]);
  const suivant = useCallback(() => onRang((rang + 1) % total), [rang, total, onRang]);

  // Fleches pour circuler, Echap pour sortir : un carrousel qu'il faut
  // viser a la souris se referme mal.
  useEffect(() => {
    const surTouche = (evenement) => {
      if (evenement.key === 'Escape') onFermer();
      if (evenement.key === 'ArrowLeft') precedent();
      if (evenement.key === 'ArrowRight') suivant();
    };
    document.addEventListener('keydown', surTouche);

    // La page derriere ne doit pas defiler pendant la lecture.
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
    /* Le clic sur le fond ferme ; celui sur la scene est arrete plus bas. */
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

/**
 * La vignette d'une preuve, dans une liste.
 *
 * Elle montre le premier fichier -- celui qui represente la preuve --
 * et le compte de ceux qui suivent.
 */
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
        {/* Le compte des images en plus, comme sur une annonce. */}
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
