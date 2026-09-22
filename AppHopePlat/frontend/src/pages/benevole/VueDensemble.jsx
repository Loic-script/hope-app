import { useEffect, useRef, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';

import {
  IconeCalendrier,
  IconeChevronDroit,
  IconePlus,
} from '../../components/admin/AdminIcons.jsx';
/*
 * Les carres de couleur portent des icones pleines, comme le menu : a
 * cette taille et sur un fond teinte, un contour de 1,7 px ne pese rien.
 * Les reperes de la tache -- echeance, prise en charge -- restent au
 * trait : ils accompagnent du texte gris, et ne doivent pas le dominer.
 */
import { PleineJournal, PleineProjets, PleineTaches } from '../../components/IconesPleines.jsx';
import PublicationFil from '../../components/admin/PublicationFil.jsx';
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
 * Ce qu'un projet propose a un benevole, a la place du financement :
 * les taches qui attendent quelqu'un, et combien il en compte en tout.
 */
function TachesDuProjet({ projet }) {
  const libres = Number(projet.tachesLibres) || 0;
  const total = Number(projet.tachesTotal) || 0;
  return (
    <p className="fil-post__chiffres fil-post__taches">
      <span className={libres > 0 ? 'fil-post__taches-libres' : undefined}>
        <PleineTaches />
        <strong>{fmt.nombre(libres)}</strong> tâche{libres > 1 ? 's' : ''} à prendre
      </span>
      <span>
        <strong>{fmt.nombre(total)}</strong> au total
      </span>
    </p>
  );
}

/**
 * Accueil de l'espace benevole.
 *
 * La page ne liste pas : elle met en avant. En haut, la carte de ses
 * trois chiffres, et la tache qu'il pourrait prendre ; puis les
 * projets ; en bas, son journal. Des elements, pas des listes : le reste
 * de l'espace a ses propres ecrans, et chaque bloc y renvoie. Sa
 * prochaine tache a rendre se lit dans le premier chiffre, et ses taches
 * dans "Mes taches".
 *
 * Les trois chiffres parlent de lui d'abord : ce qu'il a en cours, ce
 * qu'il a deja livre, et seulement ensuite ce qui attend quelqu'un. La
 * carte ne porte rien d'autre -- ni photo, ni titre, ni bouton.
 */
export default function VueDensemble() {
  const { benevole } = useOutletContext();

  const { donnees: chiffres } = useChargement(() => service.apercu(), []);
  const { donnees: taches } = useChargement(() => service.mesTaches(), []);
  const { donnees: libres } = useChargement(() => service.tachesLibres(), []);
  const { donnees: journal } = useChargement(() => service.journal(), []);
  // Les projets, en fil de publications -- comme l'accueil de l'equipe,
  // sans l'argent : un benevole y lit ce qu'il y a a faire.
  const { donnees: projets } = useChargement(() => service.listerProjets(), []);

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

      {/* ---------- La carte des chiffres, et la tache a prendre ---------- */}
      <div className="accueil-benevole__paire">
        <section className="invitation" aria-labelledby="invitation-titre">
          <div className="invitation__corps">
            {/* La carte ne montre que ses chiffres ; le titre reste pour
                les lecteurs d'ecran, qui s'orientent par les titres. */}
            <h2 className="sr-only" id="invitation-titre">
              Vos tâches en chiffres
            </h2>

            {/*
              Les trois chiffres du benevole, du plus personnel au plus
              ouvert : ce qu'il a en cours, ce qu'il a livre, ce qui attend
              quelqu'un. Chacun mene a l'ecran qui le detaille.
            */}
            <ul className="invitation__chiffres">
              <ChiffreInvitation
                rang={0}
                to="/benevole/taches"
                valeur={taches ? enCours.length : null}
                libelles={['Tâche en cours', 'Tâches en cours']}
                detail={
                  enCours.length === 0
                    ? 'Aucune pour le moment'
                    : prioritaire?.echeance
                      ? `À rendre le ${fmt.date(prioritaire.echeance)}`
                      : 'Sans échéance'
                }
                Icone={PleineTaches}
                teinte="jaune"
              />
              <ChiffreInvitation
                rang={1}
                to="/benevole/journal"
                valeur={journal ? nbLivrees : null}
                libelles={['Tâche livrée', 'Tâches livrées']}
                detail={
                  journal?.derniereLivraison
                    ? `Dernière le ${fmt.date(journal.derniereLivraison)}`
                    : 'Pas encore'
                }
                Icone={PleineJournal}
                teinte="bleu"
              />
              <ChiffreInvitation
                rang={2}
                to="/benevole/taches"
                valeur={chiffres ? nbLibres : null}
                libelles={['Tâche à prendre', 'Tâches à prendre']}
                detail={nbProjets > 0 ? `Sur ${pluriel(nbProjets, 'projet')}` : 'Tout est pris'}
                Icone={PleineProjets}
                teinte="orange"
              />
            </ul>
          </div>
        </section>

        <section className="tache-active">
          <div className="tache-active__haut">
            <h2 className="tache-active__intitule">
              À prendre
              {nbLibres > 0 && <span className="tache-active__compte">{nbLibres}</span>}
            </h2>
            {aPrendre && (
              <span className="pastille pastille--bleu">
                {aPrendre.maPlace === 'demandee'
                  ? 'Demandée'
                  : (aPrendre.equipe ?? []).length > 0
                    ? 'À rejoindre'
                    : 'Libre'}
              </span>
            )}
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
                  {aPrendre.maPlace === 'demandee' ? 'Voir ma demande' : 'La demander'}
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

      {/* ---------- Les projets, en publications ---------- */}
      {(projets ?? []).length > 0 && (
        <section className="fil-accueil fil-accueil--benevole" aria-labelledby="fil-benevole-titre">
          <div className="fil-accueil__entete">
            <div>
              <h2 className="fil-accueil__titre" id="fil-benevole-titre">
                Les projets
              </h2>
              <p className="fil-accueil__sous-titre">Ce que HOPE mène, et ce qu’il y a à y faire</p>
            </div>
            <Link className="bouton-hope bouton-hope--creux fil-accueil__tous" to="/benevole/projets">
              Tous les projets
              <IconeChevronDroit />
            </Link>
          </div>
          {projets.map((projet, rang) => (
            <PublicationFil
              key={projet.id}
              projet={projet}
              rang={Math.min(rang, 5)}
              lien={`/benevole/projets/${projet.id}`}
              lienAjoutVisuel={null}
              compteurs={<TachesDuProjet projet={projet} />}
            />
          ))}
        </section>
      )}

      {/* ---------- Le journal, sur toute la largeur ---------- */}
      <section className="journal-apercu journal-apercu--large">
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
  );
}

/** Delai d'entree d'un chiffre, apres la carte : ils arrivent l'un apres l'autre. */
const DELAI_CHIFFRE = 260;
const ECART_CHIFFRE = 110;

/**
 * Le nombre affiche monte de 0 a sa valeur, une seule fois, a l'arrivee
 * des donnees -- en ralentissant, comme un compteur qui se pose.
 *
 * null tant que la valeur n'est pas connue : l'ecran montre un tiret.
 * Rien ne bouge si l'appareil demande de reduire les animations.
 *
 * @param {number|null} valeur
 * @param {number} delai  en millisecondes, avant de commencer a compter
 */
function useDecompte(valeur, delai = 0) {
  const [affiche, setAffiche] = useState(null);
  const depart = useRef(0);

  useEffect(() => {
    if (valeur === null || valeur === undefined) return undefined;

    const reduit = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduit || valeur === depart.current) {
      depart.current = valeur;
      setAffiche(valeur);
      return undefined;
    }

    const de = depart.current;
    const duree = 900;
    const debut = performance.now() + delai;
    let image;
    const avancer = (maintenant) => {
      const t = Math.min(1, Math.max(0, (maintenant - debut) / duree));
      const pose = 1 - (1 - t) ** 3;
      setAffiche(Math.round(de + (valeur - de) * pose));
      if (t < 1) image = requestAnimationFrame(avancer);
      else depart.current = valeur;
    };
    image = requestAnimationFrame(avancer);
    return () => cancelAnimationFrame(image);
  }, [valeur, delai]);

  return affiche;
}

/**
 * Un chiffre de l'invitation : un nombre, ce qu'il compte, une precision,
 * et le lien vers l'ecran qui le detaille.
 *
 * La precision n'est pas un ornement : "2 taches en cours" ne dit pas
 * laquelle presse, et c'est justement ce qu'on vient verifier.
 *
 * Le nombre anime est cache aux lecteurs d'ecran : ils lisent la phrase
 * entiere, avec la valeur finale, et non chaque etape du compteur.
 */
function ChiffreInvitation({ rang, to, valeur, libelles, detail, Icone, teinte }) {
  const delai = DELAI_CHIFFRE + rang * ECART_CHIFFRE;
  const affiche = useDecompte(valeur, delai);
  const libelle = (valeur ?? 0) > 1 ? libelles[1] : libelles[0];

  return (
    <li className="invitation__chiffre" style={{ '--delai': `${delai}ms` }}>
      <Link className={`chiffre-invitation chiffre-invitation--${teinte}`} to={to}>
        <span className="chiffre-invitation__icone" aria-hidden="true">
          <Icone />
        </span>
        <span className="chiffre-invitation__texte">
          <span className="chiffre-invitation__tete">
            <strong className="chiffre-invitation__valeur" aria-hidden="true">
              {affiche ?? '—'}
            </strong>
            <span className="chiffre-invitation__libelle">
              <span className="sr-only">{valeur ?? ''} </span>
              {libelle}
            </span>
          </span>
          <span className="chiffre-invitation__detail">{detail}</span>
        </span>
        <IconeChevronDroit className="chiffre-invitation__fleche" />
      </Link>
    </li>
  );
}
