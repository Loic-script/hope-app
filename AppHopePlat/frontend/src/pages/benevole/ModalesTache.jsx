import { useEffect, useRef, useState } from 'react';

import { Modale } from '../../components/admin/forms.jsx';
import { PleineLieu } from '../../components/IconesPleines.jsx';
import { PhotoAgrandissable } from '../../components/VisionneuseImage.jsx';
import { messageErreur, urlMedia } from '../../services/api.js';
import * as service from '../../services/espaceBenevole.service.js';
import * as fmt from '../../utils/format.js';
import { delaiRestant, LIBELLES_PRIORITE } from '../../utils/priorites.js';
import { ActionDemande, EquipeTache } from './composants.jsx';

export function DetailTacheModale({
  tache,
  onFermer,
  onDemander,
  onAnnuler,
  envoi = false,
  actions = null,
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

const MAX_FICHIERS = 6;
const MAX_PHOTO = 10 * 1024 * 1024;
const MAX_VIDEO = 50 * 1024 * 1024;

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

export function FormulaireLivraison({ tache, onAnnuler, onLivree, onEnvoi = () => {} }) {
  const [fichiers, setFichiers] = useState([]);
  const [commentaire, setCommentaire] = useState('');
  const [refus, setRefus] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [survol, setSurvol] = useState(false);
  const champ = useRef(null);

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
    setEnvoi(true);
    onEnvoi(true);
    setRefus('');
    try {
      await service.livrerTache(tache.id, fichiers, commentaire);
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
        Dites en quelques mots ce que vous avez fait. Une photo ou une courte vidéo aide l’équipe
        HOPE à valider la livraison, mais n’est pas obligatoire.
      </p>

      <div className="livraison__commentaire">
        <label className="livraison__libelle" htmlFor="livraison-commentaire">
          Commentaire <span className="livraison__facultatif">facultatif</span>
        </label>
        <textarea
          id="livraison-commentaire"
          value={commentaire}
          onChange={(e) => setCommentaire(e.target.value)}
          maxLength={2000}
          rows={3}
          placeholder="Ex. Fiche traduite et relue avec l’enseignante ; il reste la version imprimée à valider."
          disabled={envoi}
        />
        <span className="livraison__compteur" aria-hidden="true">
          {commentaire.length} / 2000
        </span>
      </div>

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
        <button type="submit" className="btn btn--principal" disabled={envoi}>
          {envoi ? 'Envoi en cours…' : `Livrer la tâche${fichiers.length ? ` (${fichiers.length})` : ''}`}
        </button>
      </div>
    </form>
  );
}

function Repere({ intitule, large = false, children }) {
  return (
    <div className={`reperes-tache__ligne${large ? ' reperes-tache__ligne--large' : ''}`}>
      <dt>{intitule}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function tailleVoulue({ benevolesMin, benevolesMax }) {
  if (benevolesMin && benevolesMax) {
    return benevolesMin === benevolesMax ? `${benevolesMin} bénévole(s)` : `${benevolesMin} à ${benevolesMax}`;
  }
  if (benevolesMin) return `Au moins ${benevolesMin}`;
  if (benevolesMax) return `Au plus ${benevolesMax}`;
  return null;
}
