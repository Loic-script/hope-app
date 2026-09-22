import { Link } from 'react-router-dom';

import { useChargement } from '../../hooks/useChargement.js';
import { urlMedia } from '../../services/api.js';
import * as service from '../../services/espaceBenevole.service.js';
import * as fmt from '../../utils/format.js';
import { Pastille } from './composants.jsx';

/**
 * Les actualites de HOPE, vues par un benevole.
 *
 * Le meme fil que dans l'espace bailleur, les memes cartes, mais les
 * actualites seules : les appels a financement n'y figurent pas, et
 * aucune carte ne porte de chiffre. Un benevole ne voit aucun montant --
 * l'API ne lui en renvoie d'ailleurs aucun.
 */
export default function Actualites() {
  const { donnees, chargement, erreur } = useChargement(() => service.actualites(), []);
  const items = donnees ?? [];

  return (
    <div className="accueil-benevole">
      <header>
        <p className="surtitre">
          <span className="trait-hope surtitre__trait" aria-hidden="true" />
          Sur le terrain
        </p>
        <h1 className="accueil-benevole__titre">Actualités</h1>
        <p className="accueil-benevole__accroche">Les nouvelles de HOPE et de ses projets.</p>
      </header>

      {erreur && <p className="alerte-benevole">{erreur}</p>}

      {chargement && items.length === 0 ? (
        <p className="bloc__vide">Chargement du fil…</p>
      ) : items.length === 0 ? (
        <p className="bloc__vide">Aucune actualité pour l’instant.</p>
      ) : (
        <div className="fil">
          {items.map((publication) => (
            <Carte key={publication.id} publication={publication} />
          ))}
        </div>
      )}
    </div>
  );
}

/** Une carte du fil : l'actualite, sa photo, le projet dont elle parle. */
function Carte({ publication }) {
  return (
    <article className="actu">
      <div className="actu__haut">
        <Pastille valeur="Actualité" teinte="bleu" />
        <span className="actu__date">{fmt.date(publication.publieLe)}</span>
      </div>

      {publication.mediaUrl && (
        <div className="actu__visuel">
          <img src={urlMedia(publication.mediaUrl)} alt="" loading="lazy" />
        </div>
      )}

      <h2 className="actu__titre">{publication.titre}</h2>
      {/* Le projet mene a sa page : le benevole peut y prendre une tache. */}
      {publication.projetId && (
        <p className="actu__projet">
          <Link to={`/benevole/projets/${publication.projetId}`}>{publication.projetNom}</Link>
        </p>
      )}
      {publication.corps && <p className="actu__corps">{publication.corps}</p>}
    </article>
  );
}
