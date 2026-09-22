import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { IconeCalendrier, IconePersonne } from '../../components/admin/AdminIcons.jsx';
import ChampPhotoActualite from '../../components/admin/ChampPhotoActualite.jsx';
import {
  ChampSelection,
  ChampTexte,
  ChampTexteLong,
  ModaleConfirmation,
  ModaleFormulaire,
} from '../../components/admin/forms.jsx';
import { JaugeHorizon, Mesure } from '../../components/admin/PublicationProjet.jsx';
import {
  Alerte,
  Badge,
  BarreOutils,
  BoutonAjout,
  Chargement,
  EntetePage,
  EtatVide,
  Panneau,
} from '../../components/admin/ui.jsx';
import HopeLogo from '../../components/HopeLogo.jsx';
import BoutonMessage from '../../components/messagerie/BoutonMessage.jsx';
import { PhotoAgrandissable } from '../../components/VisionneuseImage.jsx';
import { useChargement, useSoumission } from '../../hooks/useChargement.js';
import { api, urlMedia } from '../../services/api.js';
import * as projectService from '../../services/project.service.js';
import * as publicationService from '../../services/publication.service.js';
import * as fmt from '../../utils/format.js';

const TYPES = {
  actualite: 'Actualité',
  appel_financement: 'Appel à financement',
};

const COULEURS_TYPE = { actualite: 'bleu', appel_financement: 'ambre' };

const STATUTS_INTERET = {
  nouvelle: 'Nouveau',
  contactee: 'Contacté',
  convertie: 'Partenariat conclu',
  classee: 'Classé',
};

const COULEURS_INTERET = { nouvelle: 'ambre', contactee: 'bleu', convertie: 'vert', classee: 'gris' };

const VIDE = { type: 'actualite', titre: '', corps: '', projetId: '', mediaUrl: '' };

/**
 * Ou se lit une publication, selon sa nature : l'actualite chez les
 * bailleurs et les benevoles, l'appel a financement chez les bailleurs
 * seuls.
 */
const ESPACES = {
  actualite: 'des espaces bailleur et bénévole',
  appel_financement: 'de l’espace bailleur',
};

/** Ce qu'une recherche parcourt dans une publication. */
function texteCherchable(publication) {
  return [
    publication.titre,
    publication.corps,
    publication.projetNom,
    publication.projetReference,
    publication.publieParNom,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

/**
 * Actualites des espaces bailleur et benevole.
 *
 * Ce que l'equipe publie ici, chaque bailleur le lit dans sa page
 * Actualites, et sa cloche l'en previent. Deux natures : l'actualite,
 * qui informe, et l'appel a financement, dont la jauge suit le budget du
 * projet lie et qui porte le bouton "Financer ce projet".
 *
 * Les benevoles lisent aussi les actualites, dans leur propre page
 * Actualites -- jamais les appels a financement, qui parlent d'argent.
 *
 * Sous chaque appel, les bailleurs qui ont clique ce bouton : c'est ici
 * que l'equipe les retrouve pour les recontacter.
 *
 * La page se lit comme celle des projets : la meme barre d'outils --
 * recherche, filtres, compteur -- puis les memes cartes, visuel a gauche
 * et contenu a droite.
 */
export default function PublicationsPage() {
  const [filtre, setFiltre] = useState('tous');
  const [recherche, setRecherche] = useState('');
  const [edition, setEdition] = useState(null); // null, { publication: null } ou { publication }
  const [aSupprimer, setASupprimer] = useState(null);
  const [succes, setSucces] = useState('');

  const { donnees, chargement, erreur, recharger } = useChargement(
    () => publicationService.lister(),
    []
  );
  const { soumettre, envoi, erreur: erreurAction, setErreur } = useSoumission();

  const publications = donnees?.items ?? [];
  const compteurs = donnees?.counts ?? {};
  const cherche = recherche.trim().toLowerCase();

  const affichees = publications.filter(
    (p) =>
      (filtre === 'tous' || p.type === filtre) &&
      (!cherche || texteCherchable(p).includes(cherche))
  );

  // Le nombre accompagne chaque filtre, comme les onglets le faisaient.
  const filtres = [
    { valeur: 'tous', label: `Toutes (${compteurs.tous ?? publications.length})` },
    { valeur: 'actualite', label: `Actualités (${compteurs.actualite ?? 0})` },
    {
      valeur: 'appel_financement',
      label: `Appels à financement (${compteurs.appel_financement ?? 0})`,
    },
  ];

  function annoncer(texte) {
    setSucces(texte);
    setTimeout(() => setSucces(''), 6000);
  }

  function supprimer() {
    const publication = aSupprimer;
    setErreur('');
    soumettre(() => publicationService.supprimer(publication.id), {
      onSucces: () => {
        setASupprimer(null);
        annoncer(`« ${publication.titre} » est retirée ${ESPACES[publication.type]}.`);
        recharger();
      },
    });
  }

  function changerStatut(interet, statut) {
    soumettre(() => publicationService.changerStatutInteret(interet.id, statut), {
      onSucces: recharger,
    });
  }

  return (
    <>
      <EntetePage
        fil={[{ label: 'Accueil', to: '/admin' }, { label: 'Actualités' }]}
        titre="Actualités"
        accroche="Les nouvelles de HOPE, lues par les bailleurs et les bénévoles, et les appels à financement, lus par les bailleurs seuls."
        actions={
          <BoutonAjout onClick={() => setEdition({ publication: null })}>Nouvelle actualité</BoutonAjout>
        }
      />

      {erreur && <Alerte>{erreur}</Alerte>}
      {erreurAction && !aSupprimer && <Alerte>{erreurAction}</Alerte>}
      {succes && <Alerte type="succes">{succes}</Alerte>}

      <Panneau serre>
        <BarreOutils
          recherche={recherche}
          onRecherche={setRecherche}
          placeholder="Rechercher un titre, un texte, un projet, un auteur…"
          filtres={filtres}
          filtreActif={filtre}
          onFiltre={setFiltre}
          compteur={`${fmt.nombre(affichees.length)} publication(s)`}
        />
      </Panneau>

      {chargement && publications.length === 0 ? (
        <Chargement texte="Chargement des actualités…" />
      ) : affichees.length === 0 ? (
        <Panneau className="publications--page">
          <EtatVide
            titre={
              cherche || filtre !== 'tous'
                ? 'Aucune publication ne correspond à ces critères'
                : 'Aucune publication'
            }
            texte={
              cherche || filtre !== 'tous'
                ? 'Modifiez la recherche ou changez de filtre.'
                : 'Une actualité publiée ici apparaît aussitôt dans l’espace de chaque bailleur et de chaque bénévole.'
            }
            action={
              <BoutonAjout onClick={() => setEdition({ publication: null })}>
                Nouvelle actualité
              </BoutonAjout>
            }
          />
        </Panneau>
      ) : (
        <div className="publications publications--page">
          {affichees.map((publication, rang) => (
            <CarteActualite
              key={publication.id}
              publication={publication}
              // Les premieres cartes se remplissent l'une apres l'autre ; au-dela,
              // attendre ne dirait plus rien.
              rang={Math.min(rang, 5)}
              envoi={envoi}
              onModifier={() => setEdition({ publication })}
              onSupprimer={() => {
                setErreur('');
                setASupprimer(publication);
              }}
              onStatut={changerStatut}
              onErreur={setErreur}
            />
          ))}
        </div>
      )}

      {edition && (
        <ModaleActualite
          publication={edition.publication}
          onFermer={() => setEdition(null)}
          onEnregistre={(message) => {
            setEdition(null);
            annoncer(message);
            recharger();
          }}
        />
      )}

      <ModaleConfirmation
        ouverte={Boolean(aSupprimer)}
        titre="Supprimer cette publication ?"
        message={
          aSupprimer
            ? `« ${aSupprimer.titre} » disparaîtra ${ESPACES[aSupprimer.type]}.` +
              (aSupprimer.interets.length > 0
                ? ` ${aSupprimer.interets.length} bailleur(s) s’étaient manifesté(s) : leurs intérêts restent enregistrés, mais ne seront plus affichés ici.`
                : '')
            : ''
        }
        onFermer={() => setASupprimer(null)}
        onConfirmer={supprimer}
        envoi={envoi}
        erreur={aSupprimer ? erreurAction : ''}
        libelleConfirmer="Supprimer"
        danger
      />
    </>
  );
}

/* ==================================================================
   Une publication
   ================================================================== */

/**
 * Une publication, dans la carte des projets : le visuel a gauche, ce
 * qu'il faut savoir pour decider a droite.
 *
 * Le surtitre porte le projet lie, l'etiquette la nature de la
 * publication, et le pied les memes mesures qu'un projet -- la date,
 * l'auteur, et pour un appel le nombre de bailleurs interesses. La jauge
 * horizon d'un appel est celle du projet : la part deja financee.
 */
function CarteActualite({
  publication,
  rang = 0,
  envoi,
  onModifier,
  onSupprimer,
  onStatut,
  onErreur,
}) {
  const appel = publication.type === 'appel_financement';
  const photo = urlMedia(publication.mediaUrl);
  const suitLeProjet = !publication.photoPropre && Boolean(publication.photoProjet);
  const nouveaux = publication.interets.filter((i) => i.statut === 'nouvelle').length;
  const manque = Math.max(0, Number(publication.budgetProjet) - Number(publication.montantFinance));

  return (
    <article
      className={`publication publication--actualite${appel ? ' publication--appel' : ''}`}
      style={{ '--rang': rang }}
    >
      <div className="publication__media">
        {photo ? (
          <PhotoAgrandissable
            className="publication__photo"
            src={photo}
            alt={`Illustration : ${publication.titre}`}
            legende={publication.titre}
          />
        ) : (
          // Sans photo, le cadre reste habite : le logo, et ce qui manque.
          <span className="publication__sans-visuel publication__sans-visuel--fige">
            <HopeLogo compact />
            <span>Sans photo</span>
          </span>
        )}
        {photo && suitLeProjet && <span className="publication__reference">Photo du projet</span>}
      </div>

      <div className="publication__corps">
        <div className="publication__haut">
          <p className="publication__surtitre">
            {publication.projetId ? (
              <>
                <Link to={`/admin/projects/${publication.projetId}`}>{publication.projetNom}</Link>
                {publication.projetReference && ` · ${publication.projetReference}`}
              </>
            ) : appel ? (
              <span className="publication__surtitre--alerte">
                Projet supprimé : plus de jauge de financement
              </span>
            ) : (
              'Actualité de HOPE'
            )}
          </p>
          <div className="publication__etiquettes">
            <Badge
              valeur={publication.type}
              libelles={TYPES}
              couleur={COULEURS_TYPE[publication.type]}
            />
          </div>
        </div>

        <h2 className="publication__titre publication__titre--actualite">{publication.titre}</h2>

        {publication.corps && (
          <p className="publication__texte publication__texte--actualite">
            {fmt.tronquer(publication.corps, 320)}
          </p>
        )}

        {appel && publication.avancement !== null && (
          <>
            <JaugeHorizon
              taux={publication.avancement}
              recu={publication.montantFinance}
              manque={manque}
              devise={publication.devise}
            />
            {(publication.objectifAtteint || publication.projetTermine) && (
              <p className="publication__note">
                {publication.projetTermine ? 'Projet terminé' : 'Budget atteint'} : le bouton
                « Financer ce projet » n’est plus proposé aux bailleurs.
              </p>
            )}
          </>
        )}

        <div className="publication__pied">
          <div className="publication__mesures">
            <Mesure
              Icone={IconeCalendrier}
              libelle="date de publication"
              valeur={fmt.date(publication.publieLe)}
            />
            {publication.publieParNom && (
              <Mesure Icone={IconePersonne} libelle="a publié" valeur={publication.publieParNom} />
            )}
            {/* Le nombre de bailleurs interesses n'est pas repris ici : il
                se lit dans la section qui les liste, juste en dessous. */}
          </div>

          <div className="publication__actions">
            <button type="button" className="btn btn--neutre btn--petit" onClick={onModifier}>
              Modifier
            </button>
            <button
              type="button"
              className="btn btn--danger btn--petit"
              onClick={onSupprimer}
              disabled={envoi}
            >
              Supprimer
            </button>
          </div>
        </div>

        {appel && (
          <section className="interets-admin" aria-label="Bailleurs intéressés">
            <h3 className="interets-admin__titre">
              Bailleurs intéressés
              <span className="interets-admin__compte">{publication.interets.length}</span>
              {nouveaux > 0 && (
                <Badge valeur="nouvelle" libelles={{ nouvelle: `${nouveaux} à recontacter` }} couleur="ambre" />
              )}
            </h3>

            {publication.interets.length === 0 ? (
              <p className="interets-admin__vide">
                Aucun bailleur n’a encore cliqué « Financer ce projet ».
              </p>
            ) : (
              <ul className="interets-admin__liste">
                {publication.interets.map((interet) => (
                  <Interet
                    key={interet.id}
                    interet={interet}
                    envoi={envoi}
                    onStatut={onStatut}
                    onErreur={onErreur}
                  />
                ))}
              </ul>
            )}
          </section>
        )}
      </div>
    </article>
  );
}

/** Un bailleur qui s'est manifeste, et le suivi de son interet. */
function Interet({ interet, envoi, onStatut, onErreur }) {
  const contact = [interet.contactNom, interet.contactFonction].filter(Boolean).join(' · ');

  // Le contact lui-meme s'il a un compte joignable ; sinon l'organisation,
  // dont le serveur trouve le contact principal.
  const cible =
    interet.contactUtilisateurId && interet.contactJoignable
      ? { personne: { type: 'utilisateur', id: interet.contactUtilisateurId } }
      : { entreprise: interet.bailleurId };

  return (
    <li className="interet-admin">
      <div className="interet-admin__qui">
        <strong>{interet.organisation}</strong>
        {contact && <span>{contact}</span>}
        {interet.contactEmail && (
          <a href={`mailto:${interet.contactEmail}`}>{interet.contactEmail}</a>
        )}
        <span className="interet-admin__date">Le {fmt.date(interet.creeLe)}</span>
      </div>

      {interet.message && <blockquote className="interet-admin__message">{interet.message}</blockquote>}

      <div className="interet-admin__suivi">
        <Badge
          valeur={interet.statut}
          libelles={STATUTS_INTERET}
          couleur={COULEURS_INTERET[interet.statut]}
        />
        <label className="interet-admin__statut">
          <span className="sr-only">Suivi de l’intérêt de {interet.organisation}</span>
          <select
            value={interet.statut}
            onChange={(e) => onStatut(interet, e.target.value)}
            disabled={envoi}
          >
            {Object.entries(STATUTS_INTERET).map(([cle, libelle]) => (
              <option key={cle} value={cle}>
                {libelle}
              </option>
            ))}
          </select>
        </label>
        <BoutonMessage
          api={api}
          racine="/admin"
          cheminMessages="/admin/conversations"
          cible={cible}
          libelle="Écrire"
          onErreur={onErreur}
        />
      </div>
    </li>
  );
}

/* ==================================================================
   Creer ou modifier
   ================================================================== */

function ModaleActualite({ publication, onFermer, onEnregistre }) {
  const creation = !publication;
  const [formulaire, setFormulaire] = useState(() =>
    publication
      ? {
          type: publication.type,
          titre: publication.titre ?? '',
          corps: publication.corps ?? '',
          projetId: publication.projetId ? String(publication.projetId) : '',
          mediaUrl: publication.photoPropre ?? '',
        }
      : VIDE
  );

  const { donnees: projetsCharges } = useChargement(
    () => projectService.lister({ pageSize: 200 }),
    []
  );
  const { soumettre, envoi, erreur } = useSoumission();

  const projets = useMemo(() => projetsCharges?.items ?? [], [projetsCharges]);
  const appel = formulaire.type === 'appel_financement';
  const projet = projets.find((p) => String(p.id) === formulaire.projetId) ?? null;

  // Changer de projet ramene la photo a celle du nouveau projet : une
  // photo propre choisie pour l'ancien n'a plus de raison d'etre gardee.
  function changerProjet(valeur) {
    setFormulaire((actuel) => ({
      ...actuel,
      projetId: valeur,
      mediaUrl: valeur === actuel.projetId ? actuel.mediaUrl : '',
    }));
  }

  /*
   * Un appel ne vise qu'un projet en cours. Le projet deja rattache reste
   * propose meme s'il s'est termine depuis : sans cela, modifier le titre
   * d'un ancien appel viderait son projet.
   */
  const options = useMemo(() => {
    const liste = projets
      .filter((p) => !appel || p.status === 'IN_PROGRESS' || (publication && p.id === publication.projetId))
      .map((p) => ({
        valeur: String(p.id),
        label: `${p.name}${p.status === 'IN_PROGRESS' ? '' : ' (terminé)'}`,
      }));
    if (
      publication?.projetId &&
      !liste.some((o) => o.valeur === String(publication.projetId))
    ) {
      // Pendant le chargement, le projet est absent de la liste sans etre
      // archive : on ne le qualifie qu'une fois la liste connue.
      liste.push({
        valeur: String(publication.projetId),
        label: `${publication.projetNom}${projetsCharges ? ' (archivé)' : ''}`,
      });
    }
    return liste;
  }, [projets, projetsCharges, appel, publication]);

  useEffect(() => {
    // Passer en appel avec un projet termine le deselectionne.
    if (appel && formulaire.projetId && !options.some((o) => o.valeur === formulaire.projetId)) {
      setFormulaire((actuel) => ({ ...actuel, projetId: '', mediaUrl: '' }));
    }
  }, [appel, options, formulaire.projetId]);

  const photoProjet = projet
    ? projet.mediaType === 'PHOTO'
      ? projet.mediaUrl
      : null
    : publication && String(publication.projetId) === formulaire.projetId
      ? publication.photoProjet
      : null;

  // Une actualite se lit aussi chez les benevoles ; un appel, non.
  const actualite = formulaire.type === 'actualite';

  function enregistrer() {
    const corps = {
      type: formulaire.type,
      titre: formulaire.titre,
      corps: formulaire.corps,
      projetId: formulaire.projetId ? Number(formulaire.projetId) : null,
      mediaUrl: formulaire.mediaUrl || null,
    };
    soumettre(
      () =>
        creation
          ? publicationService.creer(corps)
          : publicationService.modifier(publication.id, corps),
      {
        onSucces: (resultat) =>
          onEnregistre(
            creation
              ? `Publiée ${actualite ? 'dans les espaces bailleur et bénévole' : 'dans l’espace bailleur'}. ${resultat.notifies} contact(s) bailleur prévenu(s) dans leur cloche.`
              : actualite
                ? 'Publication modifiée. Bailleurs et bénévoles voient la nouvelle version.'
                : 'Publication modifiée. Les bailleurs voient la nouvelle version.'
          ),
      }
    );
  }

  const champ = (nom) => (e) => setFormulaire((actuel) => ({ ...actuel, [nom]: e.target.value }));

  return (
    <ModaleFormulaire
      ouverte
      titre={creation ? 'Nouvelle actualité' : 'Modifier la publication'}
      sousTitre={
        creation
          ? actualite
            ? 'Elle apparaît aussitôt chez chaque bailleur, prévenu dans sa cloche, et chez chaque bénévole.'
            : 'Il apparaît aussitôt chez chaque bailleur, prévenu dans sa cloche. Les bénévoles ne le voient pas.'
          : 'La modification ne renvoie pas de notification aux bailleurs.'
      }
      onFermer={onFermer}
      onSoumettre={enregistrer}
      envoi={envoi}
      erreur={erreur}
      libelleValider={creation ? 'Publier' : 'Enregistrer'}
      large
    >
      <div className="formulaire-grille">
        <div className="champ-admin champ-admin--pleine-largeur">
          <span className="champ-admin__label" id="type-actualite">
            Type
          </span>
          <div className="filtres actualite-form__types" role="group" aria-labelledby="type-actualite">
            {Object.entries(TYPES).map(([cle, libelle]) => (
              <button
                key={cle}
                type="button"
                className={`filtres__bouton${formulaire.type === cle ? ' filtres__bouton--actif' : ''}`}
                aria-pressed={formulaire.type === cle}
                onClick={() => setFormulaire((actuel) => ({ ...actuel, type: cle }))}
                disabled={envoi}
              >
                {libelle}
              </button>
            ))}
          </div>
          <p className="champ-admin__aide">
            {appel
              ? 'Cherche un partenaire pour un projet en cours. La barre suit le budget du projet, et le bouton « Financer ce projet » disparaît quand il est atteint ou que le projet se termine.'
              : 'Une nouvelle de HOPE, pour information.'}
          </p>
        </div>

        <ChampTexte
          label="Titre"
          id="actualite-titre"
          obligatoire
          required
          maxLength={200}
          value={formulaire.titre}
          onChange={champ('titre')}
          pleineLargeur
        />

        <ChampTexteLong
          label="Texte"
          id="actualite-corps"
          rows={5}
          maxLength={5000}
          value={formulaire.corps}
          onChange={champ('corps')}
        />

        <ChampSelection
          label="Projet lié"
          id="actualite-projet"
          obligatoire={appel}
          required={appel}
          vide={appel ? 'Choisir un projet en cours' : 'Aucun projet'}
          options={options}
          value={formulaire.projetId}
          onChange={(e) => changerProjet(e.target.value)}
          aide={
            appel && projet
              ? `La barre affichera ${fmt.montant(projet.fundedTotal, projet.currency)} sur un budget de ${fmt.montant(projet.requiredBudget, projet.currency)} (${fmt.pourcent(projet.fundingRate)}).`
              : 'Son nom s’affiche sous le titre, et sa photo illustre l’actualité.'
          }
          pleineLargeur
        />

        <ChampPhotoActualite
          photoPropre={formulaire.mediaUrl}
          photoProjet={photoProjet}
          nomProjet={projet?.name ?? (formulaire.projetId ? publication?.projetNom : undefined)}
          onChange={(adresse) => setFormulaire((actuel) => ({ ...actuel, mediaUrl: adresse }))}
          desactive={envoi}
        />
      </div>
    </ModaleFormulaire>
  );
}
