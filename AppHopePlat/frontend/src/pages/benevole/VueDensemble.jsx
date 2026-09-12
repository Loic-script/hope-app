import { Link, useOutletContext } from 'react-router-dom';

import { useChargement } from '../../hooks/useChargement.js';
import * as service from '../../services/espaceBenevole.service.js';
import * as fmt from '../../utils/format.js';
import { CarteMission } from './composants.jsx';

/**
 * Vue d'ensemble de l'espace benevole.
 *
 * Trois chiffres, puis ce qui attend le benevole : ses prochaines
 * missions et ses taches en cours. Le reste a son ecran.
 */
export default function VueDensemble() {
  const { benevole } = useOutletContext();

  const { donnees: chiffres } = useChargement(() => service.apercu(), []);
  const { donnees: miennes } = useChargement(() => service.mesMissions(), []);
  const { donnees: taches } = useChargement(() => service.mesTaches(), []);

  // Les inscriptions encore actives, du plus proche au plus lointain.
  const aVenir = (miennes ?? [])
    .filter(
      (m) =>
        ['inscrit', 'confirme'].includes(m.inscriptionStatut) &&
        new Date(m.dateDebut) >= new Date()
    )
    .sort((a, b) => new Date(a.dateDebut) - new Date(b.dateDebut));

  const enCours = (taches?.items ?? []).filter((t) => t.statut === 'en_cours');

  return (
    <>
      <header className="page-benevole__entete">
        <h1 className="page-benevole__titre">Bonjour, {benevole?.prenom ?? 'bénévole'}</h1>
        <p className="page-benevole__accroche">
          Voici ce qui se passe chez HOPE en ce moment.
        </p>
      </header>

      <div className="chiffres">
        <Chiffre
          valeur={chiffres?.missionsOuvertes}
          libelle="missions ouvertes"
          teinte="violet"
        />
        <Chiffre
          valeur={chiffres?.missionsCetteSemaine}
          libelle="cette semaine"
          teinte="orange"
        />
        <Chiffre
          valeur={chiffres?.benevolesMobilises}
          libelle="bénévoles mobilisés"
          teinte="bleu"
        />
        <Chiffre valeur={chiffres?.tachesLibres} libelle="tâches à prendre" teinte="vert" />
      </div>

      <section className="bloc">
        <div className="bloc__entete">
          <h2 className="bloc__titre">Mes prochaines missions</h2>
          <Link className="bloc__lien" to="/benevole/missions">
            Voir toutes les missions
          </Link>
        </div>

        {aVenir.length === 0 ? (
          <p className="bloc__vide">
            Aucune mission prévue. <Link to="/benevole/missions">Parcourez les missions
            ouvertes</Link> pour vous inscrire.
          </p>
        ) : (
          <div className="cartes">
            {aVenir.slice(0, 3).map((mission) => (
              <CarteMission key={mission.inscriptionId} mission={mission} />
            ))}
          </div>
        )}
      </section>

      <section className="bloc">
        <div className="bloc__entete">
          <h2 className="bloc__titre">Mes tâches en cours</h2>
          <Link className="bloc__lien" to="/benevole/taches">
            Voir mes tâches
          </Link>
        </div>

        {enCours.length === 0 ? (
          <p className="bloc__vide">
            Rien en cours. <Link to="/benevole/taches">Prenez une tâche libre</Link> quand
            vous avez un moment.
          </p>
        ) : (
          <ul className="liste-simple">
            {enCours.map((tache) => (
              <li key={tache.id} className="liste-simple__ligne">
                <div>
                  <strong>{tache.titre}</strong>
                  <span className="liste-simple__meta">{tache.projetNom}</span>
                </div>
                {tache.echeance && (
                  <span className="liste-simple__date">
                    à rendre le {fmt.date(tache.echeance)}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

/** Un chiffre cle de la vue d'ensemble. */
function Chiffre({ valeur, libelle, teinte }) {
  return (
    <article className={`chiffre chiffre--${teinte}`}>
      <p className="chiffre__valeur">{valeur ?? '—'}</p>
      <p className="chiffre__libelle">{libelle}</p>
    </article>
  );
}
