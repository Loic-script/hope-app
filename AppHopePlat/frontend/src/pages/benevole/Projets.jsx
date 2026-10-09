import { Link } from 'react-router-dom';

import { PleineProjets, PleineTaches } from '../../components/IconesPleines.jsx';
import { useChargement } from '../../hooks/useChargement.js';
import { urlMedia } from '../../services/api.js';
import * as service from '../../services/espaceBenevole.service.js';

export default function Projets() {
  const { donnees, chargement, erreur } = useChargement(() => service.listerProjets(), []);
  const projets = donnees ?? [];

  const aFaire = projets.reduce((somme, p) => somme + p.tachesLibres, 0);

  return (
    <div className="accueil-benevole">
      <header>
        <p className="surtitre">
          <span className="trait-hope surtitre__trait" aria-hidden="true" />
          Ce que HOPE mène
        </p>
        <h1 className="accueil-benevole__titre">Projets</h1>
        <p className="accueil-benevole__accroche">
          {aFaire > 0
            ? `${aFaire} tâche${aFaire > 1 ? 's' : ''} attend${aFaire > 1 ? 'ent' : ''} un volontaire, réparties sur ${projets.length} projet${projets.length > 1 ? 's' : ''}.`
            : 'Ouvrez un projet pour voir ce qu’il s’y passe.'}
        </p>
      </header>

      {erreur && <p className="alerte-benevole">{erreur}</p>}

      {chargement && projets.length === 0 ? (
        <p className="bloc__vide">Chargement des projets…</p>
      ) : projets.length === 0 ? (
        <p className="bloc__vide">
          Aucun projet ouvert pour l’instant. L’équipe en publiera bientôt.
        </p>
      ) : (
        <ul className="projets-benevole">
          {projets.map((projet) => (
            <li key={projet.id}>
              <CarteProjet projet={projet} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CarteProjet({ projet }) {
  const libre = projet.tachesLibres > 0;

  return (
    <article className="carte-projet">
      <div className="carte-projet__image">
        {projet.mediaUrl && projet.mediaType === 'VIDEO' ? (
          <video
            src={`${urlMedia(projet.mediaUrl)}#t=0.5`}
            muted
            playsInline
            preload="metadata"
            aria-hidden="true"
            tabIndex={-1}
          />
        ) : projet.mediaUrl ? (
          <img src={urlMedia(projet.mediaUrl)} alt="" loading="lazy" />
        ) : (
          <span className="carte-projet__sans-image" aria-hidden="true">
            <PleineProjets />
          </span>
        )}
        {projet.categoryName && (
          <span className="carte-projet__categorie">{projet.categoryName}</span>
        )}
      </div>

      <div className="carte-projet__corps">
        <h2 className="carte-projet__titre">
          <Link to={`/benevole/projets/${projet.id}`}>{projet.name}</Link>
        </h2>
        {projet.location && <p className="carte-projet__lieu">{projet.location}</p>}
        {projet.description && (
          <p className="carte-projet__texte">{projet.description}</p>
        )}

        <p className="carte-projet__compte">
          <span className={libre ? 'carte-projet__vif' : undefined}>
            <PleineTaches />
            {projet.tachesLibres} tâche{projet.tachesLibres > 1 ? 's' : ''} libre
            {projet.tachesLibres > 1 ? 's' : ''}
          </span>
          <span>{projet.tachesTotal} au total</span>
        </p>
      </div>
    </article>
  );
}
