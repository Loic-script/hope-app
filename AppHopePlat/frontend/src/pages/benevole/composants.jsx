import { Link } from 'react-router-dom';

import * as fmt from '../../utils/format.js';

/** Les trois formats d'une mission, tels qu'ils s'affichent. */
export const FORMATS = {
  presentiel: 'Présentiel',
  terrain: 'Terrain',
  distance: 'À distance',
};

/** Statut d'une mission. */
export const STATUTS_MISSION = {
  brouillon: 'Brouillon',
  ouverte: 'Ouverte',
  complete: 'Complète',
  terminee: 'Terminée',
  annulee: 'Annulée',
};

/** Statut d'une inscription, du point de vue du benevole. */
export const STATUTS_INSCRIPTION = {
  inscrit: 'Inscrit',
  confirme: 'Confirmé',
  present: 'Présent',
  absent: 'Absent',
  annule: 'Annulé',
};

/** Statut d'une tache. */
export const STATUTS_TACHE = {
  a_faire: 'À faire',
  en_cours: 'En cours',
  livree: 'Livrée',
};

/**
 * Le format d'une mission.
 *
 * Terrain est mis en avant : c'est le seul qui demande une validation
 * prealable du profil, donc la seule information qui change ce que le
 * benevole peut faire.
 */
export function EtiquetteFormat({ format }) {
  return (
    <span className={`etiquette etiquette--${format}`}>{FORMATS[format] ?? format}</span>
  );
}

/** Une pastille de statut, quel que soit le domaine. */
export function Pastille({ valeur, libelles, teinte }) {
  return (
    <span className={`pastille pastille--${teinte ?? 'gris'}`}>
      {libelles?.[valeur] ?? valeur}
    </span>
  );
}

/** Teinte associee au statut d'une inscription. */
export function teinteInscription(statut) {
  return (
    {
      inscrit: 'bleu',
      confirme: 'vert',
      present: 'vert',
      absent: 'rouge',
      annule: 'gris',
    }[statut] ?? 'gris'
  );
}

/**
 * Une mission presentee en carte.
 *
 * Sert aussi bien la liste des missions que "mes prochaines missions" :
 * dans le second cas l'objet porte en plus son inscription, et la carte
 * l'affiche.
 */
export function CarteMission({ mission }) {
  const complete = mission.placesRestantes !== undefined && mission.placesRestantes <= 0;

  return (
    <article className="carte-mission-benevole">
      <div className="carte-mission-benevole__haut">
        <EtiquetteFormat format={mission.format} />
        {mission.inscriptionStatut && (
          <Pastille
            valeur={mission.inscriptionStatut}
            libelles={STATUTS_INSCRIPTION}
            teinte={teinteInscription(mission.inscriptionStatut)}
          />
        )}
      </div>

      <h3 className="carte-mission-benevole__titre">
        <Link to={`/benevole/missions/${mission.id}`}>{mission.titre}</Link>
      </h3>

      {mission.projetNom && (
        <p className="carte-mission-benevole__projet">{mission.projetNom}</p>
      )}

      <dl className="carte-mission-benevole__faits">
        <div>
          <dt>Quand</dt>
          <dd>{fmt.dateHeure(mission.dateDebut)}</dd>
        </div>
        {mission.lieuNom && (
          <div>
            <dt>Où</dt>
            <dd>{mission.lieuNom}</dd>
          </div>
        )}
        {mission.placesTotal !== undefined && (
          <div>
            <dt>Places</dt>
            <dd className={complete ? 'carte-mission-benevole__complet' : undefined}>
              {complete
                ? 'complète'
                : `${mission.placesRestantes} sur ${mission.placesTotal}`}
            </dd>
          </div>
        )}
      </dl>
    </article>
  );
}
