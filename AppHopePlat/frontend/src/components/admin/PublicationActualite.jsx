import { useId, useState } from 'react';
import { Link } from 'react-router-dom';

import { IconeCoeur, IconeOeil, IconeSoleil } from '../HopeIcons.jsx';
import * as fmt from '../../utils/format.js';
import { depuisCourt, LONGUEUR_REPLIEE, MediaPublication } from './PublicationFil.jsx';

export default function PublicationActualite({
  publication,
  rang = 0,
  lienProjet = null,
  lienDon = null,
  appel = false,
  compteurs,
  actions,
}) {
  const idTitre = useId();
  const [deplie, setDeplie] = useState(false);

  const corps = publication.corps ?? '';
  const longue = corps.length > LONGUEUR_REPLIEE;

  return (
    <article
      className={`fil-post fil-post--actualite${appel ? ' fil-post--appel' : ''}`}
      style={{ '--rang': rang }}
      aria-labelledby={idTitre}
    >
      <header className="fil-post__entete">
        <span className="fil-post__avatar" aria-hidden="true">
          <IconeSoleil />
        </span>
        <div className="fil-post__qui">
          <p className="fil-post__titre">
            HOPE
            <span className="fil-post__point" aria-hidden="true">
              ·
            </span>
            <span className={`fil-post__type${appel ? ' fil-post__type--appel' : ''}`}>
              {appel ? 'Appel à financement' : 'Actualité'}
            </span>
          </p>
          <p className="fil-post__meta">
            <time dateTime={publication.publieLe} title={`Publiée le ${fmt.date(publication.publieLe)}`}>
              {depuisCourt(publication.publieLe)}
            </time>
            {publication.projetNom &&
              (lienProjet ? (
                <Link className="fil-post__projet" to={lienProjet}>
                  {publication.projetNom}
                </Link>
              ) : (
                <span>{publication.projetNom}</span>
              ))}
          </p>
        </div>
      </header>

      <div className="fil-post__texte">
        <p className="fil-post__accroche" id={idTitre}>
          {publication.titre}
        </p>
        {corps && (
          <p className={`fil-post__description${longue && !deplie ? ' fil-post__description--repliee' : ''}`}>
            {corps}
          </p>
        )}
        {longue && (
          <button
            type="button"
            className="fil-post__voir-plus"
            onClick={() => setDeplie((ouvert) => !ouvert)}
            aria-expanded={deplie}
          >
            {deplie ? 'Voir moins' : 'Voir plus'}
          </button>
        )}
      </div>

      {publication.mediaUrl && (
        <MediaPublication
          projet={{ mediaUrl: publication.mediaUrl, mediaType: 'PHOTO', name: publication.titre }}
          lienAjoutVisuel={null}
        />
      )}

      {compteurs && <div className="fil-post__compteurs">{compteurs}</div>}

      {actions ??
        (lienProjet && (
          <div className={`fil-post__actions${lienDon ? ' fil-post__actions--double' : ''}`}>
            <Link
              className="fil-post__action"
              to={lienProjet}
              aria-label={`Voir le projet ${publication.projetNom ?? ''}`.trim()}
            >
              <IconeOeil />
              Voir le projet
            </Link>
            {lienDon && (
              <Link
                className="fil-post__action fil-post__action--don"
                to={lienDon}
                aria-label={`Faire un don au projet ${publication.projetNom ?? ''}`.trim()}
              >
                <IconeCoeur />
                Faire un don
              </Link>
            )}
          </div>
        ))}
    </article>
  );
}
