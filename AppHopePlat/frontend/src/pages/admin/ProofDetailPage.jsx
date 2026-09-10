import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { ModaleConfirmation } from '../../components/admin/forms.jsx';
import { Alerte, Badge, Chargement, EntetePage, EtatVide, Panneau } from '../../components/admin/ui.jsx';
import VignettePreuve from '../../components/admin/VignettePreuve.jsx';
import { useChargement, useSoumission } from '../../hooks/useChargement.js';
import * as catalogService from '../../services/catalog.service.js';
import * as fieldProofService from '../../services/fieldProof.service.js';
import * as fmt from '../../utils/format.js';

/**
 * Charge le fichier d'une preuve et rend une URL locale utilisable.
 *
 * Le fichier est servi derriere le jeton : ni <img src> ni <video src> ne
 * peuvent l'atteindre directement, ils ne portent pas d'en-tete
 * Authorization. On passe donc par un blob, libere au demontage -- sans
 * quoi le navigateur garderait la video entiere en memoire apres coup.
 *
 * @returns {{ url: string|null, chargement: boolean, echec: boolean }}
 */
function useFichier(preuve) {
  const [etat, setEtat] = useState({ url: null, chargement: false, echec: false });

  useEffect(() => {
    if (!preuve?.filePath) {
      setEtat({ url: null, chargement: false, echec: false });
      return undefined;
    }

    let annule = false;
    let courante = null;
    setEtat({ url: null, chargement: true, echec: false });

    fieldProofService
      .urlDuFichier(preuve)
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
  }, [preuve]);

  return etat;
}

/**
 * Le lecteur lui-meme : image, video, ou repli.
 *
 * Le type MIME prime sur le type declare de la preuve. Les deux
 * concordent depuis que le service les verifie, mais les lignes creees
 * avant cette verification peuvent encore porter une video sous le type
 * "Photo" : c'est le fichier qui a raison, pas l'etiquette.
 */
function Lecteur({ preuve }) {
  const { url, chargement, echec } = useFichier(preuve);

  const mime = preuve.mimeType ?? '';
  const estImage = mime.startsWith('image/');
  const estVideo = mime.startsWith('video/');

  if (!preuve.filePath) {
    return (
      <div className="lecteur lecteur--texte">
        <p className="lecteur__citation">{preuve.description}</p>
        <p className="lecteur__mention">Témoignage — cette preuve n’a pas de fichier.</p>
      </div>
    );
  }

  if (chargement) {
    return (
      <div className="lecteur lecteur--attente">
        <Chargement texte={estVideo ? 'Chargement de la vidéo…' : 'Chargement de l’image…'} />
      </div>
    );
  }

  if (echec || !url) {
    return (
      <div className="lecteur lecteur--attente">
        <EtatVide
          titre="Fichier introuvable"
          texte="Le fichier n’est plus sur le serveur. La preuve, elle, reste enregistrée."
        />
      </div>
    );
  }

  if (estImage) {
    return <img className="lecteur__media" src={url} alt={preuve.description} />;
  }

  if (estVideo) {
    // controls et non autoPlay : on ne lance pas le son d'une video de
    // terrain dans un bureau sans l'avoir demande.
    return <video className="lecteur__media" src={url} controls playsInline preload="metadata" />;
  }

  // Un PDF : le navigateur sait l'afficher, mais dans un cadre a lui.
  return (
    <div className="lecteur lecteur--texte">
      <p className="lecteur__mention">Ce document ne s’affiche pas ici.</p>
      <a className="btn btn--principal" href={url} target="_blank" rel="noreferrer">
        Ouvrir le document
      </a>
    </div>
  );
}

/**
 * Lecture d'une preuve terrain.
 *
 * Une preuve est le plus souvent une photo ou une video : elle merite
 * d'etre vue en grand, pas dans une vignette de 64 px. L'ecran suit donc
 * la disposition d'un lecteur -- le media occupe la place, ce qui le
 * decrit vient dessous, et les autres preuves du meme projet attendent
 * dans la colonne de droite.
 */
export default function ProofDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [aSupprimer, setASupprimer] = useState(false);

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

  return (
    <>
      <EntetePage
        fil={[{ label: 'Preuves terrain', to: '/admin/proofs' }]}
        titre={preuve.projectName}
        accroche={`${fmt.date(preuve.occurredOn)} · ajouté par ${preuve.authorLog ?? 'compte supprimé'}`}
        actions={
          <>
            <Link className="btn btn--neutre" to={`/admin/projects/${preuve.projectId}?onglet=impact`}>
              Ouvrir le projet
            </Link>
            <button
              type="button"
              className="btn btn--neutre"
              onClick={() => setASupprimer(true)}
            >
              Supprimer
            </button>
          </>
        }
      />

      {erreurAction && <Alerte>{erreurAction}</Alerte>}

      <div className="lecture">
        <div className="lecture__principal">
          <Lecteur preuve={preuve} />

          {/* Ce qui decrit la preuve vient sous le media, comme sous une
              video : le titre d'abord, la fiche technique ensuite. */}
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
            {preuve.fileName && (
              <div>
                <dt>Fichier</dt>
                <dd>
                  {preuve.fileName}
                  <span className="lecture__discret"> · {fmt.tailleFichier(preuve.fileSize)}</span>
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

      <ModaleConfirmation
        ouverte={aSupprimer}
        titre="Supprimer cette preuve ?"
        message={`« ${fmt.tronquer(preuve.description, 90)} » sera retirée, ainsi que son fichier.`}
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
