import { useId, useState } from 'react';
import { Link } from 'react-router-dom';

import HopeLogo from '../HopeLogo.jsx';
import { IconeCoeur, IconeOeil, IconeRepere, IconeSoleil } from '../HopeIcons.jsx';
import { PhotoAgrandissable } from '../VisionneuseImage.jsx';
import { urlMedia } from '../../services/api.js';
import * as fmt from '../../utils/format.js';
import { JaugeHorizon } from './PublicationProjet.jsx';

export const LONGUEUR_REPLIEE = 180;

export function depuisCourt(valeur) {
  if (!valeur) return '';
  const date = new Date(valeur);
  if (Number.isNaN(date.getTime())) return '';
  const minutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
  if (minutes < 1) return 'à l’instant';
  if (minutes < 60) return `${minutes} min`;
  const heures = Math.floor(minutes / 60);
  if (heures < 24) return `${heures} h`;
  const jours = Math.floor(heures / 24);
  if (jours < 7) return `${jours} j`;
  if (jours < 31) return `${Math.floor(jours / 7)} sem`;
  const mois = Math.floor(jours / 30);
  if (mois < 12) return `${mois} mois`;
  return `${Math.floor(mois / 12)} an${mois >= 24 ? 's' : ''}`;
}

export function MediaPublication({ projet, lienAjoutVisuel }) {
  const adresse = urlMedia(projet.mediaUrl);

  if (!adresse) {
    return lienAjoutVisuel ? (
      <Link className="fil-post__sans-media" to={lienAjoutVisuel}>
        <HopeLogo compact />
        <span>Ajouter une photo ou une vidéo</span>
      </Link>
    ) : (
      <div className="fil-post__sans-media" aria-hidden="true">
        <HopeLogo compact />
      </div>
    );
  }

  if (projet.mediaType === 'VIDEO') {
    return (
      <div className="fil-post__media fil-post__media--video">
        <video src={`${adresse}#t=0.5`} controls playsInline preload="metadata" aria-label={`Vidéo du projet ${projet.name}`} />
      </div>
    );
  }

  return (
    <div className="fil-post__media" style={{ '--fond': `url("${adresse}")` }}>
      <PhotoAgrandissable src={adresse} alt={projet.name} legende={projet.name}>
        <img src={adresse} alt={projet.name} loading="lazy" decoding="async" />
      </PhotoAgrandissable>
    </div>
  );
}

export default function PublicationFil({
  projet,
  rang = 0,
  lien = `/admin/projects/${projet.id}`,
  lienDon = null,
  compteurs,
  lienAjoutVisuel = `/admin/projects/${projet.id}/edit`,
}) {
  const idTitre = useId();
  const [deplie, setDeplie] = useState(false);

  const devise = projet.currency ?? 'MGA';
  const cible = Number(projet.beneficiaryTarget) || 0;
  const atteints = Number(projet.beneficiariesCount) || 0;
  const donateurs = Number(projet.donorsCount) || 0;
  const lance = projet.startDate ?? projet.createdAt;

  const description = projet.description ?? '';
  const longue = description.length > LONGUEUR_REPLIEE;

  return (
    <article className="fil-post" style={{ '--rang': rang }} aria-labelledby={idTitre}>
      <header className="fil-post__entete">
        <span className="fil-post__avatar" aria-hidden="true">
          <IconeSoleil />
        </span>
        <div className="fil-post__qui">
          <p className="fil-post__titre">
            <Link id={idTitre} to={lien}>
              {projet.name}
            </Link>
            {projet.categoryName && (
              <>
                <span className="fil-post__point" aria-hidden="true">
                  ·
                </span>
                <span className="fil-post__categorie">{projet.categoryName}</span>
              </>
            )}
          </p>
          <p className="fil-post__meta">
            {projet.managerName && <span>{projet.managerName}</span>}
            {lance && (
              <time dateTime={lance} title={`Lancé le ${fmt.date(lance)}`}>
                {depuisCourt(lance)}
              </time>
            )}
            {projet.location && (
              <span className="fil-post__lieu">
                <IconeRepere />
                {projet.location}
              </span>
            )}
          </p>
        </div>
        <span className="fil-post__reference">{projet.reference}</span>
      </header>

      {(projet.descriptionTitre || description) && (
        <div className="fil-post__texte">
          {projet.descriptionTitre && <p className="fil-post__accroche">{projet.descriptionTitre}</p>}
          {description && (
            <p className={`fil-post__description${longue && !deplie ? ' fil-post__description--repliee' : ''}`}>
              {description}
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
      )}

      <MediaPublication projet={projet} lienAjoutVisuel={lienAjoutVisuel} />

      {compteurs !== undefined ? (
        <div className="fil-post__compteurs">{compteurs}</div>
      ) : (
        <div className="fil-post__compteurs">
          <JaugeHorizon
            taux={projet.fundingRate}
            recu={projet.fundedTotal}
            manque={projet.remainingNeed}
            devise={devise}
          />
          <p className="fil-post__chiffres">
            <span>
              Budget <strong>{fmt.montant(projet.requiredBudget, devise)}</strong>
            </span>
            <span>
              <strong>{fmt.nombre(atteints)}</strong>{' '}
              {cible ? `bénéficiaire${atteints > 1 ? 's' : ''} sur ${fmt.nombre(cible)}` : `bénéficiaire${atteints > 1 ? 's' : ''}`}
            </span>
            <span>
              <strong>{fmt.nombre(donateurs)}</strong> donateur{donateurs > 1 ? 's' : ''}
            </span>
            <span>
              <strong>{fmt.montant(projet.spentTotal, devise)}</strong> dépensés
            </span>
          </p>
        </div>
      )}

      <div className={`fil-post__actions${lienDon ? ' fil-post__actions--double' : ''}`}>
        <Link
          className="fil-post__action"
          to={lien}
          aria-label={`Voir le projet ${projet.name}`}
        >
          <IconeOeil />
          Voir le projet
        </Link>
        {lienDon && (
          <Link
            className="fil-post__action fil-post__action--don"
            to={lienDon}
            aria-label={`Faire un don au projet ${projet.name}`}
          >
            <IconeCoeur />
            Faire un don
          </Link>
        )}
      </div>
    </article>
  );
}
