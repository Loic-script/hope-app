import { useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';

import {
  IconeCalendrier,
  IconeChevronBas,
  IconeChevronDroit,
  IconePlus,
  IconePoignee,
  IconeRecentrer,
} from '../../components/admin/AdminIcons.jsx';
/*
 * Les carres de couleur portent des icones pleines, comme le menu : a
 * cette taille et sur un fond teinte, un contour de 1,7 px ne pese rien.
 * Les reperes de la tache -- echeance, prise en charge -- restent au
 * trait : ils accompagnent du texte gris, et ne doivent pas le dominer.
 */
import { PleineJournal, PleineProjets, PleineTaches } from '../../components/IconesPleines.jsx';
import { elementsDuFil, FiltresFil } from '../../components/admin/FilActualite.jsx';
import PublicationActualite from '../../components/admin/PublicationActualite.jsx';
import PublicationFil from '../../components/admin/PublicationFil.jsx';
import { useCarteDeplacable } from '../../hooks/useCarteDeplacable.js';
import { useChargement } from '../../hooks/useChargement.js';
import { useColonneCollante } from '../../hooks/useColonneCollante.js';
import { useDecompte } from '../../hooks/useDecompte.js';
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
 * Actualites : la page d'entree de l'espace benevole.
 *
 * Elle reunit l'ancien accueil et l'ancienne page Actualites. La page ne
 * liste pas : elle met en avant. Au centre, le fil d'actualite -- les
 * projets et les nouvelles de HOPE ensemble, que trois filtres separent ;
 * a droite, la carte de ses trois chiffres, la tache qu'il pourrait
 * prendre et son journal, dans une colonne qui suit l'ecran. Des elements, pas des listes : le reste
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
  const colonne = useColonneCollante();
  // La carte des reperes : la personne la place ou elle veut, et son
  // navigateur s'en souvient.
  const carte = useCarteDeplacable('hope.benevole.reperes');

  const { donnees: chiffres } = useChargement(() => service.apercu(), []);
  const { donnees: taches } = useChargement(() => service.mesTaches(), []);
  const { donnees: libres } = useChargement(() => service.tachesLibres(), []);
  const { donnees: journal } = useChargement(() => service.journal(), []);
  // Les projets, en fil de publications -- comme l'accueil de l'equipe,
  // sans l'argent : un benevole y lit ce qu'il y a a faire.
  const { donnees: projets } = useChargement(() => service.listerProjets(), []);
  // Les nouvelles publiees par l'equipe : les actualites seules, sans
  // aucun chiffre -- l'API ne rend ni appel a financement ni montant.
  const { donnees: actualites } = useChargement(() => service.actualites(), []);
  const [filtre, setFiltre] = useState('tout');
  const fil = elementsDuFil(projets ?? [], actualites ?? [], filtre);
  // Les projets en cours : chacun se soutient depuis le fil ("Faire un don").
  const enCoursIds = new Set((projets ?? []).filter((p) => p.status === 'IN_PROGRESS').map((p) => p.id));

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
            Accueil
          </p>
          <h1 className="accueil-benevole__titre">
            Bonjour, {benevole?.prenom || 'bénévole'}
          </h1>
          <p className="accueil-benevole__accroche">
            Vos tâches, ce que vous avez déjà livré, et les nouvelles de HOPE.
          </p>
        </div>

        <Link className="bouton-hope" to="/benevole/taches">
          <IconePlus />
          Prendre une tâche
        </Link>
      </header>

      {/*
        Deux colonnes, comme l'accueil de l'administrateur : le fil
        d'actualite, et a droite ce qui regarde le benevole -- ses
        chiffres, la tache a prendre, son journal. La colonne de droite
        suit l'ecran (useColonneCollante). Sur une seule colonne, elle
        passe avant le fil.
      */}
      <div className="accueil__colonnes accueil__colonnes--benevole">
        {/* ---------- Le fil d'actualite : projets et nouvelles ---------- */}
        <div className="accueil__pile">
          {(projets ?? []).length + (actualites ?? []).length > 0 && (
            <section className="fil-accueil" aria-labelledby="fil-benevole-titre">
              <div className="fil-accueil__entete">
                <div>
                  <h2 className="fil-accueil__titre" id="fil-benevole-titre">
                    Fil d’actualité
                  </h2>
                  <p className="fil-accueil__sous-titre">
                    Les projets de HOPE, ce qu’il y a à y faire, et ses nouvelles
                  </p>
                </div>
                <Link className="bouton-hope bouton-hope--creux fil-accueil__tous" to="/benevole/projets">
                  Tous les projets
                  <IconeChevronDroit />
                </Link>
              </div>

              <FiltresFil
                actif={filtre}
                onChange={setFiltre}
                compteurs={{
                  tout: (projets ?? []).length + (actualites ?? []).length,
                  projet: (projets ?? []).length,
                  actualite: (actualites ?? []).length,
                }}
              />

              {fil.length === 0 ? (
                <p className="bloc__vide">
                  {filtre === 'actualite'
                    ? 'Aucune actualité pour l’instant.'
                    : 'Aucun projet ouvert pour l’instant.'}
                </p>
              ) : (
                fil.map(({ type, cle, element }, rang) =>
                  type === 'projet' ? (
                    <PublicationFil
                      key={cle}
                      projet={element}
                      rang={Math.min(rang, 5)}
                      lien={`/benevole/projets/${element.id}`}
                      lienDon={element.status === 'IN_PROGRESS' ? `/benevole/faire-un-don?projet=${element.id}` : null}
                      lienAjoutVisuel={null}
                      compteurs={<TachesDuProjet projet={element} />}
                    />
                  ) : (
                    <PublicationActualite
                      key={cle}
                      publication={element}
                      rang={Math.min(rang, 5)}
                      lienProjet={element.projetId ? `/benevole/projets/${element.projetId}` : null}
                      lienDon={enCoursIds.has(element.projetId) ? `/benevole/faire-un-don?projet=${element.projetId}` : null}
                    />
                  )
                )
              )}
            </section>
          )}
        </div>

        {/* ---------- Ses chiffres, la tache a prendre, son journal ---------- */}
        <aside className="accueil__pile" ref={colonne} aria-label="Mes tâches">
          {/*
            La carte des trois reperes se deplace et se replie : chacun la
            met ou il veut, ou la range quand il travaille dans le fil. Son
            enveloppe porte le deplacement ; la carte garde son animation
            d'entree.
          */}
          <div {...carte.enveloppe}>
          <section className="invitation" aria-labelledby="invitation-titre">
            <div className="invitation__barre">
              <button
                type="button"
                className="invitation__poignee"
                title="Déplacer la carte — flèches du clavier, Origine pour la remettre en place"
                aria-label="Déplacer la carte : glissez-la, ou déplacez-la avec les flèches du clavier"
                {...carte.poignee}
              >
                <IconePoignee />
              </button>

              <h2 className="invitation__titre" id="invitation-titre">
                Vos tâches
              </h2>

              {/* Repliee, la carte garde ses trois nombres : elle se reduit
                  sans rien perdre de ce qu'elle disait. */}
              {carte.reduite && (
                <ul className="invitation__resume">
                  <Pastille teinte="jaune" valeur={taches ? enCours.length : null} quoi="en cours" />
                  <Pastille teinte="bleu" valeur={journal ? nbLivrees : null} quoi="livrée(s)" />
                  <Pastille teinte="orange" valeur={chiffres ? nbLibres : null} quoi="à prendre" />
                </ul>
              )}

              {carte.deplacee && (
                <button
                  type="button"
                  className="invitation__action"
                  onClick={carte.remettre}
                  aria-label="Remettre la carte à sa place"
                  title="Remettre la carte à sa place"
                >
                  <IconeRecentrer />
                </button>
              )}

              <button
                type="button"
                className="invitation__action invitation__action--pliage"
                onClick={carte.basculerReduction}
                aria-expanded={!carte.reduite}
                aria-controls="invitation-corps"
                aria-label={carte.reduite ? 'Déplier la carte' : 'Réduire la carte'}
                title={carte.reduite ? 'Déplier' : 'Réduire'}
              >
                <IconeChevronBas />
              </button>
            </div>

            <div className="invitation__pliage" id="invitation-corps">
            <div className="invitation__corps">
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
            </div>
          </section>
          </div>

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
        </aside>
      </div>
    </div>
  );
}

/** Delai d'entree d'un chiffre, apres la carte : ils arrivent l'un apres l'autre. */
const DELAI_CHIFFRE = 260;
const ECART_CHIFFRE = 110;

/**
 * Un nombre de la carte repliee.
 *
 * Reduire ne doit pas effacer : la barre garde les trois nombres, aux
 * couleurs de leurs tuiles. Le chiffre seul ne dit rien a qui n'a pas la
 * couleur sous les yeux, d'ou la phrase complete pour les lecteurs
 * d'ecran.
 */
function Pastille({ teinte, valeur, quoi }) {
  return (
    <li className={`invitation__pastille invitation__pastille--${teinte}`}>
      <span aria-hidden="true">{valeur === null ? '—' : fmt.nombre(valeur)}</span>
      <span className="sr-only">
        {valeur === null ? 'chiffre en cours de chargement' : `${fmt.nombre(valeur)} ${quoi}`}
      </span>
    </li>
  );
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
