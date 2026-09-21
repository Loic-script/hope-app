import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import HopeLogo from '../HopeLogo.jsx';
import {
  IconeBeneficiaires,
  IconeBudgets,
  IconeDepenses,
  IconeDonateurs,
} from './AdminIcons.jsx';
import { urlMedia } from '../../services/api.js';
import * as fmt from '../../utils/format.js';
import { PhotoAgrandissable } from '../VisionneuseImage.jsx';

/**
 * Jauge horizon : la part financee du projet.
 *
 * Le logo HOPE est un soleil qui monte vers une ligne d'horizon ; un taux
 * de financement est une valeur qui monte vers sa cible. On reprend donc
 * la grammaire de la marque : la ligne porte la part recue en plein, la
 * part manquante en hachures, et le soleil se tient exactement a la
 * frontiere entre les deux.
 */
export function JaugeHorizon({ taux, recu, manque, devise }) {
  const [anime, setAnime] = useState(false);
  const borne = Math.max(0, Math.min(100, Number(taux) || 0));

  // Le soleil part de zero puis rejoint sa position : la montee ne se
  // declenche qu'apres le premier rendu.
  useEffect(() => {
    const image = requestAnimationFrame(() => setAnime(true));
    return () => cancelAnimationFrame(image);
  }, []);

  const atteint = borne >= 100;
  const position = anime ? `${borne}%` : '0%';

  return (
    <div className={`jauge${atteint ? ' jauge--atteint' : ''}`}>
      <div className="jauge__legende">
        <span className="jauge__recu">
          <strong>{fmt.montant(recu, devise)}</strong> reçus
          <span className="jauge__taux">{fmt.pourcent(borne)}</span>
        </span>
        <span className="jauge__manque">
          {atteint ? 'Budget atteint' : <>manque {fmt.montant(manque, devise)}</>}
        </span>
      </div>

      <div
        className="jauge__ligne"
        style={{ '--position': position }}
        role="progressbar"
        aria-valuenow={Math.round(borne)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Part du budget deja financee"
      >
        <span className="jauge__plein" />
        <span className="jauge__soleil" />
      </div>
    </div>
  );
}

/** Le visuel du projet, ou une invitation a en ajouter un. */
function Visuel({ projet }) {
  const adresse = urlMedia(projet.mediaUrl);

  if (adresse && projet.mediaType === 'VIDEO') {
    return (
      <video
        className="publication__video"
        src={adresse}
        preload="metadata"
        controls
        playsInline
      />
    );
  }

  if (adresse) {
    return (
      <PhotoAgrandissable
        className="publication__photo"
        src={adresse}
        alt={`Projet ${projet.name}`}
        legende={projet.name}
      />
    );
  }

  // Sans visuel, on ne montre pas un cadre vide : on propose d'en poser un.
  return (
    <Link className="publication__sans-visuel" to={`/admin/projects/${projet.id}/edit`}>
      <HopeLogo compact />
      <span>Ajouter un visuel</span>
    </Link>
  );
}

/** Une donnee chiffree de la ligne de pied. */
function Mesure({ Icone, libelle, valeur }) {
  return (
    <div className="publication__mesure">
      <Icone />
      <span className="publication__mesure-valeur">{valeur}</span>
      <span className="publication__mesure-libelle">{libelle}</span>
    </div>
  );
}

/**
 * Un projet en cours, presente comme une publication : le visuel a gauche,
 * ce qu'il faut savoir pour decider a droite.
 *
 * La liste des projets y ajoute deux choses, facultatives : des
 * etiquettes (le statut) en face du surtitre, et une rangee d'actions
 * (Voir, Modifier, Terminer...) au pied, a droite des mesures. Sans elles,
 * la carte est celle de l'accueil.
 *
 * @param {{ projet: object, rang?: number, etiquettes?: React.ReactNode,
 *           actions?: React.ReactNode }} proprietes
 */
export default function PublicationProjet({ projet, rang = 0, etiquettes = null, actions = null }) {
  const devise = projet.currency ?? 'MGA';
  const cible = Number(projet.beneficiaryTarget) || 0;
  const atteints = Number(projet.beneficiariesCount) || 0;

  return (
    <article className="publication" style={{ '--rang': rang }}>
      <div className="publication__media">
        <Visuel projet={projet} />
        <span className="publication__reference">{projet.reference}</span>
      </div>

      <div className="publication__corps">
        <div className="publication__haut">
          <p className="publication__surtitre">
            {[projet.categoryName, projet.location].filter(Boolean).join(' · ') || 'Projet'}
          </p>
          {etiquettes && <div className="publication__etiquettes">{etiquettes}</div>}
        </div>

        <h3 className="publication__titre">
          <Link to={`/admin/projects/${projet.id}`}>{projet.name}</Link>
        </h3>

        {projet.description && <p className="publication__texte">{projet.description}</p>}

        <JaugeHorizon
          taux={projet.fundingRate}
          recu={projet.fundedTotal}
          manque={projet.remainingNeed}
          devise={devise}
        />

        <div className="publication__pied">
          <div className="publication__mesures">
            <Mesure
              Icone={IconeBudgets}
              libelle="budget nécessaire"
              valeur={fmt.montant(projet.requiredBudget, devise)}
            />
            <Mesure
              Icone={IconeBeneficiaires}
              libelle={cible ? `bénéficiaires sur ${fmt.nombre(cible)}` : 'bénéficiaires'}
              valeur={fmt.nombre(atteints)}
            />
            <Mesure
              Icone={IconeDonateurs}
              libelle={Number(projet.donorsCount) === 1 ? 'donateur' : 'donateurs'}
              valeur={fmt.nombre(projet.donorsCount)}
            />
            <Mesure
              Icone={IconeDepenses}
              libelle="déjà dépensé"
              valeur={fmt.montant(projet.spentTotal, devise)}
            />
          {actions && <div className="publication__actions">{actions}</div>}
        </div>
        </div>
      </div>
    </article>
  );
}
