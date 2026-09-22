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

/**
 * Mon journal.
 *
 * Le compte de ce que le benevole a livre a HOPE : ses taches terminees,
 * et les projets qu'elles ont servis. Une tache ne porte pas de duree ;
 * le journal compte donc ce qui a ete fait, et non des heures qu'il
 * faudrait inventer.
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

  const taches = donnees?.tachesLivrees ?? 0;
  const projets = donnees?.projetsAides ?? 0;
  const badges = donnees?.badges ?? [];
  const lignes = donnees?.lignes ?? [];
  const obtenus = badges.filter((b) => b.obtenu);
  const enAttente = lignes.filter((l) => !l.validee).length;

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
        <h1 className="page-benevole__titre">Mon journal</h1>
        <p className="page-benevole__accroche">
          Le compte de ce que vous avez livré à HOPE.
        </p>
      </header>

      {erreur && <p className="alerte-benevole">{erreur}</p>}

      <div className="reperes">
        <Repere
          valeur={taches}
          libelle={taches > 1 ? 'Tâches livrées' : 'Tâche livrée'}
          detail={
            donnees?.derniereLivraison
              ? `La dernière le ${fmt.date(donnees.derniereLivraison)}`
              : 'Aucune pour le moment'
          }
          Icone={PleineJournal}
          teinte="violet"
        />
        <Repere
          valeur={projets}
          libelle={projets > 1 ? 'Projets soutenus' : 'Projet soutenu'}
          detail={
            (donnees?.tachesEnCours ?? 0) > 0
              ? `${donnees.tachesEnCours} tâche${donnees.tachesEnCours > 1 ? 's' : ''} en cours`
              : 'Rien en cours'
          }
          Icone={PleineProjets}
          teinte="orange"
        />
        <Repere
          valeur={
            <>
              {obtenus.length}
              <span className="repere__sur">/{badges.length}</span>
            </>
          }
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
            <Palier key={badge.cle} badge={badge} taches={taches} projets={projets} />
          ))}
        </ul>
      </section>

      {/* ---------- Le detail ---------- */}
      <section className="bloc">
        <div className="bloc__entete">
          <h2 className="bloc__titre">Tâches livrées</h2>
          {lignes.length > 0 && (
            <p className="bloc__sous-titre">
              {enAttente > 0
                ? `${enAttente} en attente de validation`
                : 'Toutes validées par HOPE'}
            </p>
          )}
        </div>

        {lignes.length === 0 ? (
          <p className="bloc__vide">
            Aucune tâche livrée pour l’instant. Elles apparaîtront ici dès que vous en
            aurez terminé une.{' '}
            <Link to="/benevole/taches">Voir les tâches à prendre</Link>
          </p>
        ) : (
          <div className="table-enveloppe">
            <table className="table table--empilable">
              <thead>
                <tr>
                  <th>Tâche</th>
                  <th>Projet</th>
                  <th>Prise le</th>
                  <th>Livrée le</th>
                  <th>Validation</th>
                </tr>
              </thead>
              <tbody>
                {lignes.map((ligne) => (
                  <tr key={ligne.id}>
                    <td data-libelle="Tâche">{ligne.titre}</td>
                    <td data-libelle="Projet">
                      {ligne.projetId ? (
                        <Link className="table__lien" to={`/benevole/projets/${ligne.projetId}`}>
                          {ligne.projetNom}
                        </Link>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td data-libelle="Prise le">{fmt.date(ligne.priseLe)}</td>
                    <td data-libelle="Livrée le">{fmt.date(ligne.livreeLe)}</td>
                    <td data-libelle="Validation">
                      {/* Une livraison n'est reconnue qu'une fois relue par
                          l'equipe : l'ecran le dit, plutot que de laisser
                          croire que tout est acquis. */}
                      <span className={`pastille pastille--${ligne.validee ? 'valide' : 'orange'}`}>
                        {ligne.validee ? 'Validée' : 'En attente'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              {/* Le total au pied : c'est le chiffre que le benevole vient
                  verifier, et il ne doit pas etre a recompter de tete. */}
              <tfoot>
                <tr>
                  <td colSpan={4}>Total</td>
                  <td data-libelle="Total">
                    {taches} tâche{taches > 1 ? 's' : ''}
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
function Palier({ badge, taches, projets }) {
  const manques = [];
  if (badge.taches && taches < badge.taches) {
    const reste = badge.taches - taches;
    manques.push(`${reste} tâche${reste > 1 ? 's' : ''}`);
  }
  if (badge.projets && projets < badge.projets) {
    const reste = badge.projets - projets;
    manques.push(`${reste} projet${reste > 1 ? 's' : ''}`);
  }

  // L'avancement du palier : la plus basse des deux conditions, car
  // c'est elle qui retient le badge.
  const parts = [];
  if (badge.taches) parts.push(Math.min(1, taches / badge.taches));
  if (badge.projets) parts.push(Math.min(1, projets / badge.projets));
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
