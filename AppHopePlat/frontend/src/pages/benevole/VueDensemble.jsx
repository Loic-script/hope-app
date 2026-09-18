import { Link, useOutletContext } from 'react-router-dom';

import photoInvitation from '../../assets/hope-children.jpg';
import photoTache from '../../assets/hope-couverture.jpg';
import {
  IconeCalendrier,
  IconeChevronDroit,
  IconeJournal,
  IconePlus,
} from '../../components/admin/AdminIcons.jsx';
/*
 * Les carres de couleur portent des icones pleines, comme le menu : a
 * cette taille et sur un fond teinte, un contour de 1,7 px ne pese rien.
 * Les reperes de la tache -- echeance, prise en charge -- restent au
 * trait : ils accompagnent du texte gris, et ne doivent pas le dominer.
 */
import { PleineJournal, PleineProjets, PleineTaches } from '../../components/IconesPleines.jsx';
import { useChargement } from '../../hooks/useChargement.js';
import * as service from '../../services/espaceBenevole.service.js';
import * as fmt from '../../utils/format.js';

/** Du plus urgent au moins urgent ; une tache sans echeance passe en dernier. */
function parEcheance(a, b) {
  if (!a.echeance) return 1;
  if (!b.echeance) return -1;
  return new Date(a.echeance) - new Date(b.echeance);
}

/** "1 tâche", "3 tâches" : le pluriel suit le nombre. */
function pluriel(nombre, singulier, plurielForme = `${singulier}s`) {
  return `${nombre} ${nombre > 1 ? plurielForme : singulier}`;
}

/**
 * Vue d'ensemble de l'espace benevole.
 *
 * La page ne liste pas : elle met en avant. Ce qu'un benevole vient
 * verifier, c'est la tache qu'il doit rendre en premier, et celle qu'il
 * pourrait prendre ensuite -- deux elements, pas deux listes. Le reste de
 * l'espace a ses propres ecrans, et chaque bloc y renvoie.
 *
 * Les trois reperes du haut parlent de lui d'abord : ce qu'il a en cours,
 * ce qu'il a deja livre, et seulement ensuite ce qui attend quelqu'un.
 */
export default function VueDensemble() {
  const { benevole } = useOutletContext();

  const { donnees: chiffres } = useChargement(() => service.apercu(), []);
  const { donnees: taches } = useChargement(() => service.mesTaches(), []);
  const { donnees: libres } = useChargement(() => service.tachesLibres(), []);
  const { donnees: journal } = useChargement(() => service.journal(), []);

  const enCours = (taches?.items ?? []).filter((t) => t.statut === 'en_cours');
  const prioritaire = [...enCours].sort(parEcheance)[0];
  const aPrendre = [...(libres ?? [])].sort(parEcheance)[0];

  const nbLibres = chiffres?.tachesLibres ?? 0;
  const nbProjets = chiffres?.projetsEnAttente ?? 0;
  const nbLivrees = journal?.tachesLivrees ?? 0;

  return (
    <div className="accueil-benevole">
      <header className="accueil-benevole__entete">
        <div>
          <p className="surtitre">
            <span className="trait-hope surtitre__trait" aria-hidden="true" />
            Votre espace bénévole
          </p>
          <h1 className="accueil-benevole__titre">
            Bonjour, {benevole?.prenom || 'bénévole'}
          </h1>
          <p className="accueil-benevole__accroche">
            Vos tâches, et ce que vous avez déjà livré, au même endroit.
          </p>
        </div>

        <Link className="bouton-hope" to="/benevole/taches">
          <IconePlus />
          Prendre une tâche
        </Link>
      </header>

      {/* ---------- Trois reperes ---------- */}
      <div className="reperes">
        <Repere
          valeur={enCours.length}
          libelle={enCours.length > 1 ? 'Tâches en cours' : 'Tâche en cours'}
          Icone={PleineTaches}
          teinte="violet"
          detail={
            prioritaire?.echeance
              ? `La prochaine à rendre le ${fmt.date(prioritaire.echeance)}`
              : 'Aucune pour le moment'
          }
        />
        <Repere
          valeur={nbLivrees}
          libelle={nbLivrees > 1 ? 'Tâches livrées' : 'Tâche livrée'}
          Icone={PleineJournal}
          teinte="bleu"
          detail={
            journal?.derniereLivraison
              ? `La dernière le ${fmt.date(journal.derniereLivraison)}`
              : 'Pas encore'
          }
        />
        <Repere
          valeur={nbLibres}
          libelle={nbLibres > 1 ? 'Tâches à prendre' : 'Tâche à prendre'}
          Icone={PleineProjets}
          teinte="orange"
          detail={nbProjets > 0 ? `Sur ${pluriel(nbProjets, 'projet')}` : 'Tout est pris'}
        />
      </div>

      {/* ---------- La tache a rendre, et celle a prendre ---------- */}
      <div className="accueil-benevole__paire">
        <section className="tache-phare">
          <div className="tache-phare__corps">
            <div className="tache-phare__haut">
              <h2 className="tache-phare__intitule">Ma tâche prioritaire</h2>
              {prioritaire && <span className="pastille pastille--orange">En cours</span>}
            </div>

            {prioritaire ? (
              <>
                <p className="tache-phare__projet">{prioritaire.projetNom}</p>
                <h3 className="tache-phare__titre">{prioritaire.titre}</h3>
                {prioritaire.description && (
                  <p className="tache-phare__texte">{prioritaire.description}</p>
                )}

                <div className="tache-phare__quand">
                  {/* La pastille de date n'a de sens qu'avec une echeance :
                      sans elle, les faits suffisent. */}
                  {prioritaire.echeance && (
                    <span className="jour">
                      <strong>{fmt.jourDuMois(prioritaire.echeance)}</strong>
                      <em>{fmt.moisCourt(prioritaire.echeance)}</em>
                    </span>
                  )}
                  <dl className="tache-phare__faits">
                    <div>
                      <dt aria-hidden="true"><IconeCalendrier /></dt>
                      <dd>
                        {prioritaire.echeance
                          ? `À rendre le ${fmt.dateLongue(prioritaire.echeance)}`
                          : 'Sans échéance'}
                      </dd>
                    </div>
                    {prioritaire.priseLe && (
                      <div>
                        <dt aria-hidden="true"><IconeJournal /></dt>
                        <dd>Prise le {fmt.dateLongue(prioritaire.priseLe)}</dd>
                      </div>
                    )}
                  </dl>
                </div>

                <div className="tache-phare__actions">
                  <Link className="bouton-hope" to="/benevole/taches">
                    Ouvrir mes tâches
                    <IconeChevronDroit />
                  </Link>
                  {prioritaire.projetId && (
                    <Link className="lien-hope" to={`/benevole/projets/${prioritaire.projetId}`}>
                      Voir le projet
                    </Link>
                  )}
                </div>
              </>
            ) : (
              <div className="tache-phare__vide">
                <p>
                  Aucune tâche en cours.{' '}
                  {nbLibres > 0
                    ? `${pluriel(nbLibres, 'tâche')} ${nbLibres > 1 ? 'attendent' : 'attend'} un volontaire.`
                    : 'Toutes les tâches sont prises pour le moment.'}
                </p>
                <Link className="bouton-hope" to="/benevole/taches">
                  Prendre une tâche
                  <IconeChevronDroit />
                </Link>
              </div>
            )}
          </div>

          {/* Decorative : la tache est deja decrite en toutes lettres. */}
          <div className="tache-phare__image">
            <img src={photoTache} alt="" />
          </div>
        </section>

        <section className="tache-active">
          <div className="tache-active__haut">
            <h2 className="tache-active__intitule">
              À prendre
              {nbLibres > 0 && <span className="tache-active__compte">{nbLibres}</span>}
            </h2>
            {aPrendre && <span className="pastille pastille--bleu">Libre</span>}
          </div>

          {aPrendre ? (
            <>
              <div className="tache-active__ligne">
                <span className="carre-icone carre-icone--violet" aria-hidden="true">
                  <PleineTaches />
                </span>
                <div>
                  <h3 className="tache-active__titre">{aPrendre.titre}</h3>
                  <p className="tache-active__projet">{aPrendre.projetNom}</p>
                </div>
              </div>

              {aPrendre.description && (
                <p className="tache-active__texte">{aPrendre.description}</p>
              )}

              {aPrendre.echeance && (
                <p className="tache-active__echeance">
                  <IconeCalendrier />
                  À rendre le {fmt.date(aPrendre.echeance)}
                </p>
              )}

              <div className="tache-active__actions">
                <Link className="bouton-hope bouton-hope--creux" to="/benevole/taches">
                  La prendre
                  <IconeChevronDroit />
                </Link>
                <Link className="lien-hope" to="/benevole/taches">
                  Toutes les tâches à prendre
                </Link>
              </div>
            </>
          ) : (
            <div className="tache-active__vide">
              <p>Toutes les tâches ont trouvé un volontaire. Merci à tous.</p>
              <Link className="bouton-hope bouton-hope--creux" to="/benevole/projets">
                Voir les projets
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
              <span className="trait-hope surtitre__trait" aria-hidden="true" />
              Envie de participer davantage ?
            </p>
            <h2 className="invitation__titre">Une tâche pour chaque savoir-faire.</h2>
            <p className="invitation__compte">
              {pluriel(nbLibres, 'tâche')} à prendre
              {nbProjets > 0 && ` · sur ${pluriel(nbProjets, 'projet')}`}
            </p>
            <Link className="lien-hope lien-hope--fleche" to="/benevole/projets">
              Explorer les projets
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
              <p className="journal-apercu__accroche">Le compte de ce que vous avez livré.</p>
            </div>
          </div>

          <div className="journal-apercu__chiffres">
            <p>
              <strong>{nbLivrees}</strong>
              {nbLivrees > 1 ? 'tâches livrées' : 'tâche livrée'}
            </p>
            <p>
              <strong>{journal?.projetsAides ?? 0}</strong>
              {(journal?.projetsAides ?? 0) > 1 ? 'projets soutenus' : 'projet soutenu'}
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
 * La precision n'est pas un ornement : "2 taches en cours" ne dit pas
 * laquelle presse, et c'est justement ce qu'on vient verifier.
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
