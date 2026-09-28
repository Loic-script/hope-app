import { useEffect, useRef, useState } from 'react';

import { Modale } from '../../components/admin/forms.jsx';
import { PleineLieu } from '../../components/IconesPleines.jsx';
import { PhotoAgrandissable } from '../../components/VisionneuseImage.jsx';
import { messageErreur, urlMedia } from '../../services/api.js';
import * as service from '../../services/espaceBenevole.service.js';
import * as fmt from '../../utils/format.js';
import { delaiRestant, LIBELLES_PRIORITE } from '../../utils/priorites.js';
import { ActionDemande, EquipeTache } from './composants.jsx';

/**
 * Les deux fenetres de "Mes taches" : lire une tache avant de la prendre,
 * et la livrer preuve a l'appui.
 */

/* ================================================================
   Le detail d'une tache et de son projet
   ================================================================ */

/**
 * Ce qu'on prend, et pour quoi.
 *
 * Une carte ne dit que le titre de la tache et le nom du projet : de quoi
 * la reperer, pas de quoi decider. La fenetre ajoute le projet entier --
 * sa photo, ce qu'il annonce, ses objectifs -- pour qu'on sache a quoi
 * sert ce qu'on s'apprete a faire.
 *
 * Le projet est charge a l'ouverture : la liste des taches ne le porte
 * pas, et le charger pour chaque carte serait payer pour des fenetres
 * que personne n'ouvre.
 */
export function DetailTacheModale({
  tache,
  onFermer,
  onDemander,
  onAnnuler,
  envoi = false,
  actions = null,
  // La livraison, ouverte en bas de la fenetre par « Marquer livree ».
  livraison = null,
}) {
  const [projet, setProjet] = useState(null);
  const blocLivraison = useRef(null);


  const [chargement, setChargement] = useState(false);
  const [refus, setRefus] = useState('');

  useEffect(() => {
    if (!tache) return undefined;

    let annule = false;
    setProjet(null);
    setRefus('');
    setChargement(true);

    service
      .recupererProjet(tache.projetId)
      .then((donnees) => {
        if (!annule) setProjet(donnees?.project ?? null);
      })
      .catch((echec) => {
        if (!annule) setRefus(messageErreur(echec, 'Le projet n’a pas pu être chargé.'));
      })
      .finally(() => {
        if (!annule) setChargement(false);
      });

    return () => {
      annule = true;
    };
  }, [tache]);

  /*
   * La livraison s'ouvre en bas : on y descend, et le depot prend le
   * focus. Une fois a l'ouverture, puis encore quand le projet a fini de
   * charger -- sa photo et son texte repoussent la section vers le bas.
   */
  const livraisonOuverte = Boolean(livraison);
  useEffect(() => {
    if (!livraisonOuverte) return undefined;
    const minuterie = setTimeout(() => {
      const bloc = blocLivraison.current;
      if (!bloc) return;
      const calme = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      bloc.scrollIntoView({ behavior: calme ? 'auto' : 'smooth', block: 'start' });
      bloc.querySelector('input[type="file"]')?.focus({ preventScroll: true });
    }, 60);
    return () => clearTimeout(minuterie);
  }, [livraisonOuverte, chargement]);

  if (!tache) return null;

  const enRetard = tache.echeance && new Date(tache.echeance) < new Date();
  const delai = delaiRestant(tache.echeance, tache.statut);
  const equipeVoulue = tailleVoulue(tache);

  return (
    <Modale
      ouverte
      large
      titre={tache.titre}
      sousTitre={tache.projetNom}
      onFermer={onFermer}
      erreur={refus}
      pied={
        <>
          <button type="button" className="btn btn--neutre" onClick={onFermer} disabled={envoi}>
            Fermer
          </button>
          {/* Les actions de la colonne d'ou l'on vient (en cours, livree),
              ou, pour une tache a prendre, la demande. */}
          {actions}
          {!actions && onDemander && (
            <ActionDemande
              tache={tache}
              envoi={envoi}
              onDemander={onDemander}
              onAnnuler={onAnnuler}
              classeBouton="btn btn--principal"
              classeSecondaire="btn btn--neutre"
            />
          )}
        </>
      }
    >
      {/*
        La tache d'abord : c'est elle qu'on vient lire, et c'est sur elle
        qu'on decide. Quatre reperes, avant le texte : ce qui presse, pour
        quand, ce qu'il faut savoir faire, et a combien.
      */}
      <section className="detail-tache">
        <dl className="reperes-tache">
          <Repere intitule="Priorité">
            <span className={`jeton-priorite jeton-priorite--${tache.priorite ?? 'moyenne'}`}>
              {LIBELLES_PRIORITE[tache.priorite ?? 'moyenne']}
            </span>
          </Repere>

          <Repere intitule="Date de fin">
            {tache.echeance ? (
              <>
                <span className={enRetard ? 'reperes-tache__alerte' : undefined}>
                  {fmt.date(tache.echeance)}
                </span>
                {delai && (
                  <span className={`reperes-tache__delai${delai.pressant ? ' reperes-tache__alerte' : ''}`}>
                    {delai.texte}
                  </span>
                )}
              </>
            ) : (
              <span className="reperes-tache__rien">Sans date</span>
            )}
          </Repere>

          <Repere intitule="Bénévoles">
            {equipeVoulue ?? <span className="reperes-tache__rien">Autant qu’il faudra</span>}
            <span className="reperes-tache__delai">
              {(tache.equipe ?? []).length > 0
                ? `${(tache.equipe ?? []).length} déjà dessus`
                : 'Personne pour l’instant'}
            </span>
          </Repere>

          <Repere intitule="Expérience requise" large>
            {(tache.competencesRequises ?? []).length > 0 ? (
              <span className="reperes-tache__competences">
                {tache.competencesRequises.map((competence) => (
                  <span className="tache-competences__puce" key={competence}>
                    {competence}
                  </span>
                ))}
              </span>
            ) : (
              <span className="reperes-tache__rien">Aucune : la tâche est ouverte à tout le monde</span>
            )}
          </Repere>
        </dl>

        <h3 className="detail-tache__intitule">Ce qu’il y a à faire</h3>
        {tache.description ? (
          <p className="detail-tache__texte">{tache.description}</p>
        ) : (
          <p className="detail-tache__texte detail-tache__texte--vide">
            Pas de consigne détaillée pour cette tâche.
          </p>
        )}
        <EquipeTache tache={tache} className="detail-tache__equipe" />
      </section>

      {/* Puis le projet qu'elle sert. */}
      <section className="detail-projet" aria-busy={chargement}>
        <p className="detail-projet__surtitre">
          <span className="trait-hope surtitre__trait" aria-hidden="true" />
          Le projet
        </p>

        {chargement && !projet ? (
          <p className="detail-projet__attente">Chargement du projet…</p>
        ) : projet ? (
          <div className="detail-projet__grille">
            {projet.mediaUrl && projet.mediaType !== 'VIDEO' && (
              <div className="detail-projet__image">
                <PhotoAgrandissable src={urlMedia(projet.mediaUrl)} alt={projet.name} />
              </div>
            )}

            <div className="detail-projet__corps">
              {projet.categoryName && (
                <p className="detail-projet__categorie">{projet.categoryName}</p>
              )}
              <h3 className="detail-projet__nom">{projet.name}</h3>
              {projet.location && (
                <p className="detail-projet__lieu">
                  <PleineLieu />
                  {projet.location}
                </p>
              )}

              {projet.descriptionTitre && (
                <p className="detail-projet__annonce">{projet.descriptionTitre}</p>
              )}
              {projet.description && (
                <p className="detail-projet__description">{projet.description}</p>
              )}

              {projet.objectives?.length > 0 && (
                <>
                  <p className="detail-projet__intertitre">Objectifs du projet</p>
                  <ul className="detail-projet__objectifs">
                    {projet.objectives.map((objectif) => (
                      <li key={objectif.id}>{objectif.label}</li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </div>
        ) : null}
      </section>

      {livraison && (
        <section className="detail-livraison" ref={blocLivraison} aria-labelledby="detail-livraison-titre">
          <p className="detail-projet__surtitre" id="detail-livraison-titre">
            <span className="trait-hope surtitre__trait" aria-hidden="true" />
            Livrer la tâche
          </p>
          {livraison}
        </section>
      )}
    </Modale>
  );
}

/* ================================================================
   La livraison, preuve a l'appui
   ================================================================ */

/** Plafonds, alignes sur ceux du serveur. */
const MAX_FICHIERS = 6;
const MAX_PHOTO = 10 * 1024 * 1024;
const MAX_VIDEO = 50 * 1024 * 1024;

/**
 * Verifie un fichier avant l'envoi.
 *
 * Le serveur refuserait de toute facon ; le dire ici evite de televerser
 * cinquante megaoctets pour apprendre que le format ne convenait pas.
 *
 * @returns {string|null} la raison du refus, ou null
 */
function refusDuFichier(fichier) {
  const estVideo = fichier.type.startsWith('video/');
  if (!fichier.type.startsWith('image/') && !estVideo) {
    return `« ${fichier.name} » n’est ni une photo ni une vidéo.`;
  }
  const plafond = estVideo ? MAX_VIDEO : MAX_PHOTO;
  if (fichier.size > plafond) {
    return `« ${fichier.name} » dépasse ${estVideo ? '50' : '10'} Mo.`;
  }
  return null;
}

/**
 * Livrer une tache : joindre ce qui montre qu'elle est faite.
 *
 * Au moins une photo ou une video, six au plus. Chaque fichier choisi
 * s'affiche avant l'envoi -- on verifie ce qu'on envoie, et on retire ce
 * qui n'aurait pas du partir.
 */
export function FormulaireLivraison({ tache, onAnnuler, onLivree, onEnvoi = () => {} }) {
  const [fichiers, setFichiers] = useState([]);
  const [refus, setRefus] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [survol, setSurvol] = useState(false);
  const champ = useRef(null);

  // Les apercus vivent en memoire : on les rend quand ils ne servent plus.
  const apercus = useRef(new Map());
  useEffect(() => {
    const enCours = apercus.current;
    return () => {
      for (const url of enCours.values()) URL.revokeObjectURL(url);
      enCours.clear();
    };
  }, []);

  function apercu(fichier) {
    if (!apercus.current.has(fichier)) {
      apercus.current.set(fichier, URL.createObjectURL(fichier));
    }
    return apercus.current.get(fichier);
  }

  function ajouter(liste) {
    const refuses = [];
    const retenus = [];

    for (const fichier of liste) {
      const raison = refusDuFichier(fichier);
      if (raison) refuses.push(raison);
      else retenus.push(fichier);
    }

    const place = MAX_FICHIERS - fichiers.length;
    if (retenus.length > place) {
      refuses.push(`Six fichiers au plus : ${retenus.length - place} n’ont pas été ajoutés.`);
    }

    setFichiers([...fichiers, ...retenus.slice(0, Math.max(0, place))]);
    setRefus(refuses.join(' '));
  }

  function retirer(fichier) {
    const url = apercus.current.get(fichier);
    if (url) URL.revokeObjectURL(url);
    apercus.current.delete(fichier);
    setFichiers((actuels) => actuels.filter((element) => element !== fichier));
  }

  async function livrer(evenement) {
    evenement.preventDefault();
    if (fichiers.length === 0) {
      setRefus('Joignez au moins une photo ou une vidéo de ce que vous avez fait.');
      return;
    }

    setEnvoi(true);
    onEnvoi(true);
    setRefus('');
    try {
      await service.livrerTache(tache.id, fichiers);
      onLivree();
    } catch (echec) {
      setRefus(messageErreur(echec, 'La livraison n’a pas pu être enregistrée.'));
    } finally {
      setEnvoi(false);
      onEnvoi(false);
    }
  }

  if (!tache) return null;

  return (
    <form className="livraison" id="formulaire-livraison" onSubmit={livrer}>
      <p className="livraison__consigne">
        Montrez ce que vous avez fait : une photo du résultat, une courte vidéo. L’équipe HOPE
        s’en sert pour valider la livraison.
      </p>

      {/* La zone de depot est aussi un bouton : on clique, ou on glisse. */}
      <label
        className={`livraison__depot${survol ? ' livraison__depot--survol' : ''}${
          fichiers.length >= MAX_FICHIERS ? ' livraison__depot--plein' : ''
        }`}
        onDragOver={(evenement) => {
          evenement.preventDefault();
          setSurvol(true);
        }}
        onDragLeave={() => setSurvol(false)}
        onDrop={(evenement) => {
          evenement.preventDefault();
          setSurvol(false);
          if (!envoi) ajouter([...evenement.dataTransfer.files]);
        }}
      >
        <input
          ref={champ}
          type="file"
          accept="image/*,video/*"
          multiple
          disabled={envoi || fichiers.length >= MAX_FICHIERS}
          onChange={(evenement) => {
            ajouter([...(evenement.target.files ?? [])]);
            // Sans cela, rechoisir le meme fichier n'emettrait rien.
            evenement.target.value = '';
          }}
        />
        <span className="livraison__depot-titre">
          {fichiers.length >= MAX_FICHIERS
            ? 'Six fichiers : c’est le maximum'
            : 'Importer une photo ou une vidéo'}
        </span>
        <span className="livraison__depot-aide">
          Cliquez ou glissez vos fichiers ici · Photos 10 Mo, vidéos 50 Mo · 6 fichiers au plus
        </span>
      </label>

      {fichiers.length > 0 && (
        <ul className="livraison__fichiers">
          {fichiers.map((fichier) => {
            const estVideo = fichier.type.startsWith('video/');
            return (
              <li className="livraison__fichier" key={`${fichier.name}-${fichier.lastModified}`}>
                <span className="livraison__apercu">
                  {estVideo ? (
                    <video src={apercu(fichier)} muted playsInline preload="metadata" />
                  ) : (
                    <img src={apercu(fichier)} alt="" />
                  )}
                  {estVideo && (
                    <span className="livraison__lecture" aria-hidden="true">
                      ▶
                    </span>
                  )}
                </span>
                <span className="livraison__infos">
                  <span className="livraison__nom">{fichier.name}</span>
                  <span className="livraison__taille">
                    {estVideo ? 'Vidéo' : 'Photo'} · {fmt.tailleFichier(fichier.size)}
                  </span>
                </span>
                <button
                  type="button"
                  className="lien-action lien-action--danger"
                  onClick={() => retirer(fichier)}
                  disabled={envoi}
                >
                  Retirer
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {refus && (
        <p className="livraison__refus" role="alert">
          {refus}
        </p>
      )}

      <div className="livraison__actions">
        <button type="button" className="btn btn--neutre" onClick={onAnnuler} disabled={envoi}>
          Annuler
        </button>
        <button type="submit" className="btn btn--principal" disabled={envoi || fichiers.length === 0}>
          {envoi ? 'Envoi en cours…' : `Livrer la tâche${fichiers.length ? ` (${fichiers.length})` : ''}`}
        </button>
      </div>
    </form>
  );
}

/** Un repere de la tache : son intitule, et ce qu'il vaut. */
function Repere({ intitule, large = false, children }) {
  return (
    <div className={`reperes-tache__ligne${large ? ' reperes-tache__ligne--large' : ''}`}>
      <dt>{intitule}</dt>
      <dd>{children}</dd>
    </div>
  );
}

/** "2 à 4", "au moins 2" : le monde que la tache demande. */
function tailleVoulue({ benevolesMin, benevolesMax }) {
  if (benevolesMin && benevolesMax) {
    return benevolesMin === benevolesMax ? `${benevolesMin} bénévole(s)` : `${benevolesMin} à ${benevolesMax}`;
  }
  if (benevolesMin) return `Au moins ${benevolesMin}`;
  if (benevolesMax) return `Au plus ${benevolesMax}`;
  return null;
}
