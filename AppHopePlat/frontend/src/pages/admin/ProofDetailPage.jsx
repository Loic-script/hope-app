import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { IconeChevronDroit, IconeCroix } from '../../components/admin/AdminIcons.jsx';
import { ModaleConfirmation } from '../../components/admin/forms.jsx';
import {
  Alerte,
  Badge,
  Chargement,
  EntetePage,
  EtatVide,
  Panneau,
} from '../../components/admin/ui.jsx';
import VignettePreuve from '../../components/admin/VignettePreuve.jsx';
import { useChargement, useSoumission } from '../../hooks/useChargement.js';
import * as catalogService from '../../services/catalog.service.js';
import * as fieldProofService from '../../services/fieldProof.service.js';
import * as fmt from '../../utils/format.js';

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
 * Le fichier est servi derriere le jeton : ni <img src> ni <video src> ne
 * peuvent l'atteindre directement, ils ne portent pas d'en-tete
 * Authorization. On passe donc par un blob, libere au demontage -- sans
 * quoi le navigateur garderait chaque image en memoire apres coup.
 *
 * @returns {{ url: string|null, chargement: boolean, echec: boolean }}
 */
function useFichier(preuve, fichier) {
  const [etat, setEtat] = useState({ url: null, chargement: false, echec: false });

  useEffect(() => {
    if (!fichier?.id) {
      setEtat({ url: null, chargement: false, echec: false });
      return undefined;
    }

    let annule = false;
    let courante = null;
    setEtat({ url: null, chargement: true, echec: false });

    fieldProofService
      .urlDuFichier(preuve, fichier)
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
  }, [preuve, fichier]);

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
function Media({ preuve, fichier, classe, commandes = false }) {
  const { url, chargement, echec } = useFichier(preuve, fichier);

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
function Galerie({ preuve, onOuvrir }) {
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
        <Media preuve={preuve} fichier={fichiers[0]} classe="lecteur__media" />
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
          <Media preuve={preuve} fichier={fichier} classe="galerie__media" />
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
 * Pose dans la page plutot que dans un portail : l'espace admin n'a pas
 * d'autre couche flottante au-dessus, et position: fixed suffit.
 */
function Carrousel({ preuve, rang, onRang, onFermer }) {
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
        <Media preuve={preuve} fichier={fichier} classe="visionneuse__media" commandes />
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
 * Lecture d'une preuve terrain.
 *
 * Une preuve est rarement une seule image : la remise de fournitures,
 * c'est le carton ouvert, les enfants, la signature du registre. L'ecran
 * les montre en mosaique, et le carrousel les ouvre en grand. Ce qui
 * decrit la preuve vient dessous, et les autres preuves du meme projet
 * attendent dans la colonne de droite.
 */
export default function ProofDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [aSupprimer, setASupprimer] = useState(false);

  /** Rang ouvert dans le carrousel ; null quand il est ferme. */
  const [rangOuvert, setRangOuvert] = useState(null);

  const { donnees: preuve, chargement, erreur } = useChargement(
    () => fieldProofService.recuperer(id),
    [id]
  );
  const { donnees: catalogue } = useChargement(() => catalogService.recuperer(), []);

  // Les voisines n'arrivent qu'une fois le projet connu.
  const { donnees: voisines } = useChargement(
    () => (preuve ? fieldProofService.listerParProjet(preuve.projectId) : Promise.resolve(null)),
    [preuve?.projectId]
  );

  const { envoi, erreur: erreurAction, soumettre } = useSoumission();

  const libelles = catalogue?.labels?.proofType ?? {};

  async function supprimer() {
    await soumettre(() => fieldProofService.supprimer(preuve.id), {
      onSucces: () => navigate('/admin/proofs', { replace: true }),
    });
  }

  if (chargement && !preuve) return <Chargement texte="Chargement de la preuve…" />;
  if (erreur) return <Alerte>{erreur}</Alerte>;
  if (!preuve) return null;

  const autres = (voisines?.items ?? []).filter((element) => element.id !== preuve.id);
  const fichiers = preuve.files ?? [];
  const poids = fichiers.reduce((total, fichier) => total + (fichier.fileSize ?? 0), 0);

  return (
    <>
      <EntetePage
        fil={[{ label: 'Preuves terrain', to: '/admin/proofs' }]}
        titre={preuve.projectName}
        accroche={`${fmt.date(preuve.occurredOn)} · ajouté par ${preuve.authorLog ?? 'compte supprimé'}`}
        actions={
          <>
            <Link
              className="btn btn--neutre"
              to={`/admin/projects/${preuve.projectId}?onglet=impact`}
            >
              Ouvrir le projet
            </Link>
            <button type="button" className="btn btn--neutre" onClick={() => setASupprimer(true)}>
              Supprimer
            </button>
          </>
        }
      />

      {erreurAction && <Alerte>{erreurAction}</Alerte>}

      <div className="lecture">
        <div className="lecture__principal">
          <Galerie preuve={preuve} onOuvrir={setRangOuvert} />

          {/* Ce qui decrit la preuve vient sous les images, comme sous
              une video : le titre d'abord, la fiche technique ensuite. */}
          <div className="lecture__entete">
            <Badge valeur={preuve.proofType} libelles={libelles} />
            <p className="lecture__description">{preuve.description}</p>
          </div>

          <dl className="lecture__fiche">
            <div>
              <dt>Projet</dt>
              <dd>
                <Link to={`/admin/projects/${preuve.projectId}?onglet=impact`}>
                  {preuve.projectName}
                </Link>
                <span className="lecture__discret"> · {preuve.projectReference}</span>
              </dd>
            </div>
            <div>
              <dt>Date de l’action</dt>
              <dd>{fmt.date(preuve.occurredOn)}</dd>
            </div>
            <div>
              <dt>Publiée le</dt>
              <dd>{fmt.date(preuve.createdAt)}</dd>
            </div>
            <div>
              <dt>Auteur</dt>
              <dd>{preuve.authorLog ?? 'compte supprimé'}</dd>
            </div>
            {fichiers.length > 0 && (
              <div>
                <dt>Fichiers</dt>
                <dd>
                  {fichiers.length} fichier(s)
                  <span className="lecture__discret"> · {fmt.tailleFichier(poids)}</span>
                </dd>
              </div>
            )}
          </dl>
        </div>

        {/* La colonne de droite : les autres preuves du meme projet. */}
        <Panneau titre="Autres preuves du projet" sousTitre={`${autres.length} preuve(s)`}>
          {autres.length === 0 ? (
            <EtatVide
              titre="Aucune autre preuve"
              texte="C’est la seule preuve publiée pour ce projet."
            />
          ) : (
            <ul className="suggestions">
              {autres.map((voisine) => (
                <li className="suggestion" key={voisine.id}>
                  <VignettePreuve preuve={voisine} />
                  <div className="suggestion__corps">
                    {/* Le lien s'etire sur toute la ligne via son ::after. */}
                    <Link className="suggestion__lien" to={`/admin/proofs/${voisine.id}`}>
                      {fmt.tronquer(voisine.description, 70)}
                    </Link>
                    <p className="suggestion__signature">
                      {libelles[voisine.proofType] ?? voisine.proofType} ·{' '}
                      {fmt.date(voisine.occurredOn)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panneau>
      </div>

      {rangOuvert !== null && (
        <Carrousel
          preuve={preuve}
          rang={rangOuvert}
          onRang={setRangOuvert}
          onFermer={() => setRangOuvert(null)}
        />
      )}

      <ModaleConfirmation
        ouverte={aSupprimer}
        titre="Supprimer cette preuve ?"
        message={`« ${fmt.tronquer(preuve.description, 90)} » sera retirée, ainsi que ses ${fichiers.length} fichier(s).`}
        onFermer={() => setASupprimer(false)}
        onConfirmer={supprimer}
        envoi={envoi}
        erreur={erreurAction}
        libelleConfirmer="Supprimer"
        danger
      />
    </>
  );
}
