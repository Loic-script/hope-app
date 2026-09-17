import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import ChampPhotoActualite from '../../components/admin/ChampPhotoActualite.jsx';
import {
  ChampSelection,
  ChampTexte,
  ChampTexteLong,
  ModaleConfirmation,
  ModaleFormulaire,
} from '../../components/admin/forms.jsx';
import {
  Alerte,
  Badge,
  BoutonAjout,
  EntetePage,
  EtatVide,
  Onglets,
  Panneau,
  Progression,
} from '../../components/admin/ui.jsx';
import BoutonMessage from '../../components/messagerie/BoutonMessage.jsx';
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
 * Actualites de l'espace bailleur.
 *
 * Ce que l'equipe publie ici, chaque bailleur le lit dans sa page
 * Actualites, et sa cloche l'en previent. Deux natures : l'actualite,
 * qui informe, et l'appel a financement, dont la barre suit le budget du
 * projet lie et qui porte le bouton "Financer ce projet".
 *
 * Sous chaque appel, les bailleurs qui ont clique ce bouton : c'est ici
 * que l'equipe les retrouve pour les recontacter.
 */
export default function PublicationsPage() {
  const [filtre, setFiltre] = useState('tous');
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
  const affichees = filtre === 'tous' ? publications : publications.filter((p) => p.type === filtre);

  const onglets = [
    { cle: 'tous', label: 'Toutes', compteur: compteurs.tous ?? 0 },
    { cle: 'actualite', label: 'Actualités', compteur: compteurs.actualite ?? 0 },
    {
      cle: 'appel_financement',
      label: 'Appels à financement',
      compteur: compteurs.appel_financement ?? 0,
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
        annoncer(`« ${publication.titre} » est retirée de l’espace bailleur.`);
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
        accroche="Ce que lisent les bailleurs dans leur espace : les nouvelles de HOPE et les appels à financement."
        actions={
          <BoutonAjout onClick={() => setEdition({ publication: null })}>Nouvelle actualité</BoutonAjout>
        }
      />

      {erreur && <Alerte>{erreur}</Alerte>}
      {erreurAction && !aSupprimer && <Alerte>{erreurAction}</Alerte>}
      {succes && <Alerte type="succes">{succes}</Alerte>}

      <Panneau>
        <Onglets onglets={onglets} actif={filtre} onChange={setFiltre} />

        {chargement && publications.length === 0 ? (
          <p className="actualites-admin__attente">Chargement…</p>
        ) : affichees.length === 0 ? (
          <EtatVide
            titre="Aucune publication"
            texte="Une actualité publiée ici apparaît aussitôt dans l’espace de chaque bailleur."
            action={
              <BoutonAjout onClick={() => setEdition({ publication: null })}>
                Nouvelle actualité
              </BoutonAjout>
            }
          />
        ) : (
          <div className="actualites-admin">
            {affichees.map((publication) => (
              <CarteActualite
                key={publication.id}
                publication={publication}
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
      </Panneau>

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
            ? `« ${aSupprimer.titre} » disparaîtra de l’espace des bailleurs.` +
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

function CarteActualite({ publication, envoi, onModifier, onSupprimer, onStatut, onErreur }) {
  const appel = publication.type === 'appel_financement';
  const photo = urlMedia(publication.mediaUrl);
  const suitLeProjet = !publication.photoPropre && Boolean(publication.photoProjet);
  const nouveaux = publication.interets.filter((i) => i.statut === 'nouvelle').length;

  return (
    <article className={`actualite-admin${appel ? ' actualite-admin--appel' : ''}`}>
      <div className="actualite-admin__visuel">
        {photo ? (
          <>
            <img src={photo} alt="" loading="lazy" />
            {suitLeProjet && <span className="actualite-admin__source">Photo du projet</span>}
          </>
        ) : (
          <span className="actualite-admin__sans-photo">Sans photo</span>
        )}
      </div>

      <div className="actualite-admin__corps">
        <div className="actualite-admin__haut">
          <Badge
            valeur={publication.type}
            libelles={TYPES}
            couleur={COULEURS_TYPE[publication.type]}
          />
          <span className="actualite-admin__date">
            Publiée le {fmt.date(publication.publieLe)}
            {publication.publieParNom && ` par ${publication.publieParNom}`}
          </span>
        </div>

        <h2 className="actualite-admin__titre">{publication.titre}</h2>

        {publication.projetId ? (
          <p className="actualite-admin__projet">
            <Link to={`/admin/projects/${publication.projetId}`}>{publication.projetNom}</Link>
            {publication.projetReference && ` · ${publication.projetReference}`}
          </p>
        ) : (
          appel && (
            <p className="actualite-admin__projet actualite-admin__projet--manquant">
              Projet supprimé : l’appel n’a plus de barre de financement.
            </p>
          )
        )}

        {publication.corps && (
          <p className="actualite-admin__texte">{fmt.tronquer(publication.corps, 320)}</p>
        )}

        {appel && publication.avancement !== null && (
          <div className="actualite-admin__financement">
            <p>
              <strong>{fmt.montant(publication.montantFinance, publication.devise)}</strong> de dons
              et de fonds HOPE, sur un budget de{' '}
              {fmt.montant(publication.budgetProjet, publication.devise)}
            </p>
            <Progression valeur={publication.avancement} />
            {(publication.objectifAtteint || publication.projetTermine) && (
              <p className="actualite-admin__note">
                {publication.projetTermine ? 'Projet terminé' : 'Budget atteint'} : le bouton
                « Financer ce projet » n’est plus proposé aux bailleurs.
              </p>
            )}
          </div>
        )}

        <div className="actualite-admin__actions">
          <button type="button" className="btn btn--neutre btn--petit" onClick={onModifier}>
            Modifier
          </button>
          <button
            type="button"
            className="lien-action lien-action--danger"
            onClick={onSupprimer}
            disabled={envoi}
          >
            Supprimer
          </button>
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
              ? `Publiée dans l’espace bailleur. ${resultat.notifies} contact(s) bailleur prévenu(s) dans leur cloche.`
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
          ? 'Elle apparaît aussitôt dans l’espace de chaque bailleur, qui en est prévenu dans sa cloche.'
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
