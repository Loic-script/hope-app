import { Link } from 'react-router-dom';

import { PleineProjets, PleineTaches } from '../../components/IconesPleines.jsx';
import { useChargement } from '../../hooks/useChargement.js';
import { urlMedia } from '../../services/api.js';
import * as service from '../../services/espaceBenevole.service.js';

/**
 * Les projets de HOPE, vus par un benevole.
 *
 * L'espace montre ce que HOPE mene reellement : des projets, chacun
 * portant les taches qu'un benevole peut prendre.
 *
 * Rien de financier ici : un benevole vient voir ou il peut aider, pas
 * ce que le projet coute. L'API ne renvoie d'ailleurs aucun montant.
 */
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

/**
 * Un projet en carte : son image, ce qu'il est, ce qu'il y a a y faire.
 *
 * La carte entiere est cliquable par un lien etire -- le titre porte le
 * lien, son ::after couvre la carte. Un <div onClick> aurait exclu le
 * clavier et les lecteurs d'ecran.
 */
function CarteProjet({ projet }) {
  const libre = projet.tachesLibres > 0;

  return (
    <article className="carte-projet">
      <div className="carte-projet__image">
        {projet.mediaUrl && projet.mediaType === 'VIDEO' ? (
          // Une video en vignette : muette, sans commandes, arretee sur
          // une image de son debut (#t=0.5). Seules ses premieres donnees
          // sont chargees.
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
          {/* Le total situe le libre : "2 libres" ne dit pas si le
              projet en compte trois ou trente. */}
          <span>{projet.tachesTotal} au total</span>
        </p>
      </div>
    </article>
  );
}
