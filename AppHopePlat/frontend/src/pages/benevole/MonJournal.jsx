import { Link } from 'react-router-dom';

import { useChargement } from '../../hooks/useChargement.js';
import * as service from '../../services/espaceBenevole.service.js';
import * as fmt from '../../utils/format.js';
import { EtiquetteFormat } from './composants.jsx';

/**
 * Mon journal d'heures.
 *
 * Seules les missions ou la presence a ete constatee comptent : une
 * inscription ne vaut pas une participation, et le compteur doit rester
 * une reconnaissance sincere.
 */
export default function MonJournal() {
  const { donnees, chargement, erreur } = useChargement(() => service.journal(), []);

  if (chargement && !donnees) {
    return <p className="bloc__vide">Chargement de votre journal…</p>;
  }

  const heures = donnees?.heuresDonnees ?? 0;
  const badges = donnees?.badges ?? [];
  const lignes = donnees?.lignes ?? [];
  const obtenus = badges.filter((b) => b.obtenu);

  return (
    <>
      <header className="page-benevole__entete">
        <h1 className="page-benevole__titre">Mon journal d’heures</h1>
        <p className="page-benevole__accroche">
          Le compte de ce que vous avez donné à HOPE.
        </p>
      </header>

      {erreur && <p className="alerte-benevole">{erreur}</p>}

      <div className="chiffres">
        <article className="chiffre chiffre--violet">
          <p className="chiffre__valeur">{fmt.nombre(heures, heures % 1 === 0 ? 0 : 1)}</p>
          <p className="chiffre__libelle">heures données</p>
        </article>
        <article className="chiffre chiffre--orange">
          <p className="chiffre__valeur">{donnees?.missionsRealisees ?? 0}</p>
          <p className="chiffre__libelle">missions réalisées</p>
        </article>
        <article className="chiffre chiffre--bleu">
          <p className="chiffre__valeur">{obtenus.length}</p>
          <p className="chiffre__libelle">
            badge{obtenus.length > 1 ? 's' : ''} sur {badges.length}
          </p>
        </article>
        <article className="chiffre chiffre--vert">
          <p className="chiffre__valeur">
            {donnees?.benevoleDepuis ? fmt.date(donnees.benevoleDepuis) : '—'}
          </p>
          <p className="chiffre__libelle">bénévole depuis</p>
        </article>
      </div>

      <section className="bloc">
        <div className="bloc__entete">
          <h2 className="bloc__titre">Badges</h2>
        </div>
        <div className="badges">
          {badges.map((badge) => (
            <span
              key={badge.cle}
              className={`badge-benevole${badge.obtenu ? ' badge-benevole--obtenu' : ''}`}
              title={badge.obtenu ? 'Obtenu' : 'Pas encore obtenu'}
            >
              {badge.libelle}
            </span>
          ))}
        </div>
      </section>

      <section className="bloc">
        <div className="bloc__entete">
          <h2 className="bloc__titre">Missions effectuées</h2>
        </div>

        {lignes.length === 0 ? (
          <p className="bloc__vide">
            Aucune mission encore validée. Vos heures apparaîtront ici dès qu’un encadrant
            aura constaté votre présence.{' '}
            <Link to="/benevole/missions">Voir les missions ouvertes</Link>
          </p>
        ) : (
          <div className="table-enveloppe">
            <table className="table">
              <thead>
                <tr>
                  <th>Mission</th>
                  <th>Projet</th>
                  <th>Format</th>
                  <th>Date</th>
                  <th className="table__nombre">Heures</th>
                </tr>
              </thead>
              <tbody>
                {lignes.map((ligne) => (
                  <tr key={ligne.missionId}>
                    <td>
                      <Link className="table__lien" to={`/benevole/missions/${ligne.missionId}`}>
                        {ligne.titre}
                      </Link>
                    </td>
                    <td>{ligne.projetNom ?? '—'}</td>
                    <td>
                      <EtiquetteFormat format={ligne.format} />
                    </td>
                    <td>{fmt.date(ligne.dateDebut)}</td>
                    <td className="table__nombre">
                      {ligne.heuresValidees === null ? '—' : fmt.nombre(ligne.heuresValidees, 1)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
