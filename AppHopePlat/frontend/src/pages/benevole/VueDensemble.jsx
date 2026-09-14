import { Link, useOutletContext } from 'react-router-dom';

import photoInvitation from '../../assets/hope-children.jpg';
import photoMission from '../../assets/hope-couverture.jpg';
import {
  IconeCalendrier,
  IconeChevronDroit,
  IconeJournal,
  IconeLieu,
  IconePlus,
} from '../../components/admin/AdminIcons.jsx';
/*
 * Les carres de couleur portent des icones pleines, comme le menu : a
 * cette taille et sur un fond teinte, un contour de 1,7 px ne pese rien.
 * Les trois reperes de la mission -- date, heure, lieu -- restent au
 * trait : ils accompagnent du texte gris, et ne doivent pas le dominer.
 */
import {
  PleineCalendrier,
  PleineJournal,
  PleineProjets,
  PleineTaches,
} from '../../components/IconesPleines.jsx';
import { useChargement } from '../../hooks/useChargement.js';
import * as service from '../../services/espaceBenevole.service.js';
import * as fmt from '../../utils/format.js';
import { FORMATS, Pastille, STATUTS_INSCRIPTION, teinteInscription } from './composants.jsx';

/**
 * Vue d'ensemble de l'espace benevole.
 *
 * La page ne liste pas : elle met en avant. Ce qu'un benevole vient
 * verifier, c'est sa prochaine mission et la tache qu'il a prise -- deux
 * elements, pas deux listes. Le reste de l'espace a ses propres ecrans,
 * et chaque bloc y renvoie.
 *
 * Les trois reperes du haut parlent de lui d'abord : sa mission a venir,
 * sa tache en cours, et seulement ensuite ce que HOPE propose a tous.
 */
export default function VueDensemble() {
  const { benevole } = useOutletContext();

  const { donnees: chiffres } = useChargement(() => service.apercu(), []);
  const { donnees: miennes } = useChargement(() => service.mesMissions(), []);
  const { donnees: taches } = useChargement(() => service.mesTaches(), []);
  const { donnees: journal } = useChargement(() => service.journal(), []);

  // Les inscriptions encore actives, du plus proche au plus lointain.
  const aVenir = (miennes ?? [])
    .filter(
      (m) =>
        ['inscrit', 'confirme'].includes(m.inscriptionStatut) &&
        new Date(m.dateDebut) >= new Date()
    )
    .sort((a, b) => new Date(a.dateDebut) - new Date(b.dateDebut));

  const enCours = (taches?.items ?? []).filter((t) => t.statut === 'en_cours');

  // La plus urgente d'abord : c'est celle-la qu'on met en avant.
  const tachesTriees = [...enCours].sort((a, b) => {
    if (!a.echeance) return 1;
    if (!b.echeance) return -1;
    return new Date(a.echeance) - new Date(b.echeance);
  });

  const prochaine = aVenir[0];
  const tache = tachesTriees[0];

  return (
    <div className="accueil-benevole">
      <header className="accueil-benevole__entete">
        <div>
          <p className="surtitre">
            <span className="surtitre__trait" aria-hidden="true" />
            Votre espace bénévole
          </p>
          <h1 className="accueil-benevole__titre">
            Bonjour, {benevole?.prenom ?? 'bénévole'}
          </h1>
          <p className="accueil-benevole__accroche">
            Votre prochaine mission et vos tâches, au même endroit.
          </p>
        </div>

        <Link className="bouton-hope" to="/benevole/missions">
          <IconePlus />
          Trouver une mission
        </Link>
      </header>

      {/* ---------- Trois reperes ---------- */}
      <div className="reperes">
        <Repere
          valeur={aVenir.length}
          libelle={aVenir.length > 1 ? 'Missions à venir' : 'Mission à venir'}
          Icone={PleineCalendrier}
          teinte="violet"
          detail={
            prochaine
              ? fmt.dateLongue(prochaine.dateDebut)
              : 'Aucune pour le moment'
          }
        />
        <Repere
          valeur={enCours.length}
          libelle={enCours.length > 1 ? 'Tâches en cours' : 'Tâche en cours'}
          Icone={PleineTaches}
          teinte="bleu"
          detail={
            tache?.echeance
              ? `À rendre le ${fmt.date(tache.echeance)}`
              : `${chiffres?.tachesLibres ?? 0} à prendre`
          }
        />
        <Repere
          valeur={chiffres?.missionsOuvertes}
          libelle="Missions ouvertes"
          Icone={PleineProjets}
          teinte="orange"
          detail="Découvrez où apporter votre aide"
        />
      </div>

      {/* ---------- La mission, et la tache ---------- */}
      <div className="accueil-benevole__paire">
        <section className="mission-phare">
          <div className="mission-phare__corps">
            <div className="mission-phare__haut">
              <h2 className="mission-phare__intitule">Ma prochaine mission</h2>
              {prochaine && (
                <Pastille
                  valeur={prochaine.inscriptionStatut}
                  libelles={STATUTS_INSCRIPTION}
                  teinte={teinteInscription(prochaine.inscriptionStatut)}
                />
              )}
            </div>

            {prochaine ? (
              <>
                <p className="mission-phare__projet">{prochaine.projetNom}</p>
                <h3 className="mission-phare__titre">{prochaine.titre}</h3>
                {prochaine.description && (
                  <p className="mission-phare__texte">{prochaine.description}</p>
                )}

                <div className="mission-phare__quand">
                  <span className="jour">
                    <strong>{fmt.jourDuMois(prochaine.dateDebut)}</strong>
                    <em>{fmt.moisCourt(prochaine.dateDebut)}</em>
                  </span>
                  <dl className="mission-phare__faits">
                    <div>
                      <dt aria-hidden="true"><IconeCalendrier /></dt>
                      <dd>{fmt.dateLongue(prochaine.dateDebut)}</dd>
                    </div>
                    <div>
                      <dt aria-hidden="true"><IconeJournal /></dt>
                      <dd>{fmt.heure(prochaine.dateDebut)}</dd>
                    </div>
                    <div>
                      <dt aria-hidden="true"><IconeLieu /></dt>
                      <dd>{prochaine.lieuNom ?? FORMATS[prochaine.format] ?? '—'}</dd>
                    </div>
                  </dl>
                </div>

                <div className="mission-phare__actions">
                  <Link className="bouton-hope" to={`/benevole/missions/${prochaine.id}`}>
                    Voir ma mission
                    <IconeChevronDroit />
                  </Link>
                  <Link className="lien-hope" to="/benevole/missions">
                    Toutes mes missions
                  </Link>
                </div>
              </>
            ) : (
              <div className="mission-phare__vide">
                <p>
                  Vous n’êtes inscrit à aucune mission pour l’instant.
                  {chiffres?.missionsOuvertes
                    ? ` ${chiffres.missionsOuvertes} sont ouvertes.`
                    : ''}
                </p>
                <Link className="bouton-hope" to="/benevole/missions">
                  Parcourir les missions
                  <IconeChevronDroit />
                </Link>
              </div>
            )}
          </div>

          {/* Decorative : la mission est deja decrite en toutes lettres. */}
          <div className="mission-phare__image">
            <img src={photoMission} alt="" />
          </div>
        </section>

        <section className="tache-active">
          <div className="tache-active__haut">
            <h2 className="tache-active__intitule">
              Ma tâche en cours
              {enCours.length > 0 && (
                <span className="tache-active__compte">{enCours.length}</span>
              )}
            </h2>
            {tache && <span className="pastille pastille--orange">En cours</span>}
          </div>

          {tache ? (
            <>
              <div className="tache-active__ligne">
                <span className="carre-icone carre-icone--violet" aria-hidden="true">
                  <PleineTaches />
                </span>
                <div>
                  <h3 className="tache-active__titre">{tache.titre}</h3>
                  <p className="tache-active__projet">{tache.projetNom}</p>
                </div>
              </div>

              {tache.description && (
                <p className="tache-active__texte">{tache.description}</p>
              )}

              {tache.echeance && (
                <p className="tache-active__echeance">
                  <IconeCalendrier />
                  À rendre le {fmt.date(tache.echeance)}
                </p>
              )}

              <div className="tache-active__actions">
                <Link className="bouton-hope bouton-hope--creux" to="/benevole/taches">
                  Ouvrir la tâche
                  <IconeChevronDroit />
                </Link>
                <Link className="lien-hope" to="/benevole/taches">
                  Voir mes tâches
                </Link>
              </div>
            </>
          ) : (
            <div className="tache-active__vide">
              <p>
                Rien en cours. {chiffres?.tachesLibres ?? 0} tâche
                {(chiffres?.tachesLibres ?? 0) > 1 ? 's attendent' : ' attend'} un
                volontaire.
              </p>
              <Link className="bouton-hope bouton-hope--creux" to="/benevole/taches">
                Prendre une tâche
                <IconeChevronDroit />
              </Link>
            </div>
          )}
        </section>
      </div>

      {/* ---------- Invitation, et journal ---------- */}
      <div className="accueil-benevole__paire accueil-benevole__paire--basse">
        <section className="invitation">
          <div className="invitation__image">
            <img src={photoInvitation} alt="" />
          </div>
          <div className="invitation__corps">
            <p className="surtitre surtitre--clair">
              <span className="surtitre__trait" aria-hidden="true" />
              Envie de participer davantage ?
            </p>
            <h2 className="invitation__titre">Une mission pour chaque engagement.</h2>
            <p className="invitation__compte">
              {chiffres?.missionsOuvertes ?? 0} mission
              {(chiffres?.missionsOuvertes ?? 0) > 1 ? 's' : ''} ouverte
              {(chiffres?.missionsOuvertes ?? 0) > 1 ? 's' : ''}
              {' · '}
              {chiffres?.tachesLibres ?? 0} tâche
              {(chiffres?.tachesLibres ?? 0) > 1 ? 's' : ''} disponible
              {(chiffres?.tachesLibres ?? 0) > 1 ? 's' : ''}
            </p>
            <Link className="lien-hope lien-hope--fleche" to="/benevole/missions">
              Explorer les possibilités
              <IconeChevronDroit />
            </Link>
          </div>
        </section>

        <section className="journal-apercu">
          <div className="tache-active__ligne">
            <span className="carre-icone carre-icone--bleu" aria-hidden="true">
              <PleineJournal />
            </span>
            <div>
              <h2 className="journal-apercu__titre">Mon journal</h2>
              <p className="journal-apercu__accroche">Le compte de ce que vous avez donné.</p>
            </div>
          </div>

          <div className="journal-apercu__chiffres">
            <p>
              <strong>
                {fmt.nombre(journal?.heuresDonnees ?? 0, (journal?.heuresDonnees ?? 0) % 1 === 0 ? 0 : 1)}
              </strong>
              heures données
            </p>
            <p>
              <strong>{journal?.missionsRealisees ?? 0}</strong>
              missions réalisées
            </p>
          </div>

          <Link className="bouton-hope bouton-hope--creux" to="/benevole/journal">
            Ouvrir mon journal
            <IconeChevronDroit />
          </Link>
        </section>
      </div>
    </div>
  );
}

/**
 * Un repere du haut : un nombre, ce qu'il compte, et une precision.
 *
 * La precision n'est pas un ornement : "1 mission a venir" ne dit pas
 * quand, et c'est justement ce qu'on vient verifier.
 */
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
