import { Link } from 'react-router-dom';

import {
  PleineJournal,
  PleinePersonne,
  PleineProjets,
  PleineTaches,
} from '../../components/IconesPleines.jsx';
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
 *
 * L'ecran ne se contente pas d'afficher des totaux : il dit d'ou ils
 * viennent -- depuis quand, la derniere fois, ce qu'il manque pour le
 * palier suivant. Un nombre seul ne recompense personne.
 */
export default function MonJournal() {
  const { donnees, chargement, erreur } = useChargement(() => service.journal(), []);

  if (chargement && !donnees) {
    return <p className="bloc__vide">Chargement de votre journal…</p>;
  }

  const heures = donnees?.heuresDonnees ?? 0;
  const missions = donnees?.missionsRealisees ?? 0;
  const badges = donnees?.badges ?? [];
  const lignes = donnees?.lignes ?? [];
  const obtenus = badges.filter((b) => b.obtenu);

  // Le premier palier non atteint : c'est lui qui donne un cap.
  const prochain = badges.find((b) => !b.obtenu);

  const mois = moisDepuis(donnees?.benevoleDepuis);

  return (
    <div className="journal">
      <header>
        <p className="surtitre">
          <span className="trait-hope surtitre__trait" aria-hidden="true" />
          Mon engagement
        </p>
        <h1 className="page-benevole__titre">Mon journal d’heures</h1>
        <p className="page-benevole__accroche">
          Le compte de ce que vous avez donné à HOPE.
        </p>
      </header>

      {erreur && <p className="alerte-benevole">{erreur}</p>}

      <div className="reperes">
        <Repere
          valeur={fmt.nombre(heures, heures % 1 === 0 ? 0 : 1)}
          libelle={heures > 1 ? 'Heures données' : 'Heure donnée'}
          detail={
            missions > 0
              ? `Sur ${missions} mission${missions > 1 ? 's' : ''}`
              : 'Aucune heure constatée'
          }
          Icone={PleineJournal}
          teinte="violet"
        />
        <Repere
          valeur={missions}
          libelle={missions > 1 ? 'Missions réalisées' : 'Mission réalisée'}
          detail={
            donnees?.derniereMission
              ? `La dernière le ${fmt.date(donnees.derniereMission)}`
              : 'Aucune pour le moment'
          }
          Icone={PleineProjets}
          teinte="orange"
        />
        <Repere
          valeur={`${obtenus.length} / ${badges.length}`}
          libelle={obtenus.length > 1 ? 'Badges obtenus' : 'Badge obtenu'}
          detail={prochain ? `Prochain : ${prochain.libelle}` : 'Tous obtenus, bravo'}
          Icone={PleineTaches}
          teinte="bleu"
        />
        <Repere
          valeur={mois === null ? '—' : mois}
          libelle="Mois de bénévolat"
          detail={
            donnees?.benevoleDepuis
              ? `Depuis le ${fmt.date(donnees.benevoleDepuis)}`
              : 'Date inconnue'
          }
          Icone={PleinePersonne}
          teinte="jaune"
        />
      </div>

      {/* ---------- Les paliers ---------- */}
      <section className="bloc">
        <div className="bloc__entete">
          <h2 className="bloc__titre">Paliers de reconnaissance</h2>
          <p className="bloc__sous-titre">
            {obtenus.length} sur {badges.length} atteints
          </p>
        </div>

        <ul className="paliers">
          {badges.map((badge) => (
            <Palier key={badge.cle} badge={badge} heures={heures} missions={missions} />
          ))}
        </ul>
      </section>

      {/* ---------- Le detail ---------- */}
      <section className="bloc">
        <div className="bloc__entete">
          <h2 className="bloc__titre">Missions effectuées</h2>
          {lignes.length > 0 && (
            <p className="bloc__sous-titre">
              {lignes.length} ligne{lignes.length > 1 ? 's' : ''}
            </p>
          )}
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
              {/* Le total au pied : c'est le chiffre que le benevole vient
                  verifier, et il ne doit pas etre a recalculer de tete. */}
              <tfoot>
                <tr>
                  <td colSpan={4}>Total</td>
                  <td className="table__nombre">
                    {fmt.nombre(heures, heures % 1 === 0 ? 0 : 1)} h
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

/**
 * Un palier, atteint ou non.
 *
 * Non atteint, il dit ce qui manque plutot que de rester ferme : c'est
 * la seule chose qui en fasse un objectif et non un reproche.
 */
function Palier({ badge, heures, missions }) {
  const manques = [];
  if (badge.heures && heures < badge.heures) {
    const reste = badge.heures - heures;
    manques.push(`${fmt.nombre(reste, reste % 1 === 0 ? 0 : 1)} h`);
  }
  if (badge.missions && missions < badge.missions) {
    const reste = badge.missions - missions;
    manques.push(`${reste} mission${reste > 1 ? 's' : ''}`);
  }

  // L'avancement du palier : la plus basse des deux conditions, car
  // c'est elle qui retient le badge.
  const parts = [];
  if (badge.heures) parts.push(Math.min(1, heures / badge.heures));
  if (badge.missions) parts.push(Math.min(1, missions / badge.missions));
  const avancement = parts.length ? Math.min(...parts) : 0;

  return (
    <li className={`palier${badge.obtenu ? ' palier--obtenu' : ''}`}>
      <span className="palier__marque" aria-hidden="true">
        {badge.obtenu ? <Coche /> : Math.round(avancement * 100) + '%'}
      </span>
      <span className="palier__corps">
        <span className="palier__libelle">{badge.libelle}</span>
        <span className="palier__etat">
          {badge.obtenu ? 'Atteint' : `Encore ${manques.join(' et ')}`}
        </span>
        {!badge.obtenu && (
          <span className="palier__jauge">
            <span className="palier__plein" style={{ width: `${avancement * 100}%` }} />
          </span>
        )}
      </span>
    </li>
  );
}

/** La coche des paliers atteints. */
function Coche() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m5 12.6 4.6 4.6L19 7.4" />
    </svg>
  );
}

/** Un repere du haut : un nombre, ce qu'il compte, et une precision. */
function Repere({ valeur, libelle, detail, Icone, teinte }) {
  return (
    <article className={`repere repere--${teinte}`}>
      <div className="repere__corps">
        <p className="repere__tete">
          <strong className="repere__valeur">{valeur ?? '—'}</strong>
          <span className="repere__libelle">{libelle}</span>
        </p>
        <p className="repere__detail">{detail}</p>
      </div>
      <span className={`carre-icone carre-icone--${teinte}`} aria-hidden="true">
        <Icone />
      </span>
    </article>
  );
}

/**
 * Nombre de mois entiers ecoules depuis une date.
 *
 * Un quantieme plus petit que celui du depart signifie que le mois n'est
 * pas termine : on en retire un.
 */
function moisDepuis(valeur) {
  if (!valeur) return null;
  const depart = new Date(valeur);
  if (Number.isNaN(depart.getTime())) return null;

  const maintenant = new Date();
  let mois =
    (maintenant.getFullYear() - depart.getFullYear()) * 12 +
    (maintenant.getMonth() - depart.getMonth());
  if (maintenant.getDate() < depart.getDate()) mois -= 1;
  return Math.max(0, mois);
}
