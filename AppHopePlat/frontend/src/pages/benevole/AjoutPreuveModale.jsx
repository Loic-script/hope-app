import { useEffect, useRef, useState } from 'react';

import { Modale } from '../../components/admin/forms.jsx';
import { messageErreur } from '../../services/api.js';
import * as service from '../../services/espaceBenevole.service.js';
import * as fmt from '../../utils/format.js';

/**
 * Les natures d'une preuve, et ce que chacune accepte comme fichier.
 *
 * Un temoignage se suffit de son texte ; les trois autres portent au
 * moins un fichier du bon genre -- le serveur refuserait une video
 * annoncee comme photo.
 */
const NATURES = [
  { cle: 'PHOTO', libelle: 'Photo', accepte: 'image/*', prefixe: 'image/' },
  { cle: 'VIDEO', libelle: 'Vidéo', accepte: 'video/*', prefixe: 'video/' },
  {
    cle: 'DOCUMENT',
    libelle: 'Document',
    accepte: 'application/pdf,image/*',
    prefixe: null,
  },
  { cle: 'TESTIMONY', libelle: 'Témoignage', accepte: null, prefixe: null },
];

/** Plafonds, alignes sur ceux du serveur. */
const MAX_FICHIERS = 12;
const MAX_FICHIER = 10 * 1024 * 1024;
const MAX_VIDEO = 50 * 1024 * 1024;
const FORMATS = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'video/mp4',
  'video/quicktime',
  'video/webm',
  'application/pdf',
]);

/**
 * Verifie un fichier avant l'envoi, pour la nature choisie.
 *
 * Le serveur refuserait de toute facon ; le dire ici evite de televerser
 * cinquante megaoctets pour apprendre que le format ne convenait pas.
 *
 * @returns {string|null} la raison du refus, ou null
 */
function refusDuFichier(fichier, nature) {
  if (!FORMATS.has(fichier.type)) {
    return `« ${fichier.name} » : format non accepté (photos JPG, PNG, WEBP ; vidéos MP4, MOV, WEBM ; PDF).`;
  }
  if (nature.prefixe && !fichier.type.startsWith(nature.prefixe)) {
    return `« ${fichier.name} » n’est pas ${nature.cle === 'PHOTO' ? 'une photo' : 'une vidéo'}.`;
  }
  const estVideo = fichier.type.startsWith('video/');
  if (fichier.size > (estVideo ? MAX_VIDEO : MAX_FICHIER)) {
    return `« ${fichier.name} » dépasse ${estVideo ? '50' : '10'} Mo.`;
  }
  return null;
}

/**
 * Ajouter une preuve terrain a un projet.
 *
 * "Une photo et deux lignes suffisent" : la nature, ce qui s'est passe,
 * le jour, et les fichiers. Chaque fichier choisi s'affiche avant l'envoi
 * -- on verifie ce qu'on envoie, et on retire ce qui n'aurait pas du
 * partir.
 */
export default function AjoutPreuveModale({ projet, onFermer, onAjoutee }) {
  const [nature, setNature] = useState(NATURES[0]);
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(fmt.aujourdhui());
  const [fichiers, setFichiers] = useState([]);
  const [refus, setRefus] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [survol, setSurvol] = useState(false);

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
    if (!apercus.current.has(fichier)) apercus.current.set(fichier, URL.createObjectURL(fichier));
    return apercus.current.get(fichier);
  }

  function oublier(fichier) {
    const url = apercus.current.get(fichier);
    if (url) URL.revokeObjectURL(url);
    apercus.current.delete(fichier);
  }

  function ajouter(liste) {
    const refuses = [];
    const retenus = [];
    for (const fichier of liste) {
      const raison = refusDuFichier(fichier, nature);
      if (raison) refuses.push(raison);
      else retenus.push(fichier);
    }
    const place = MAX_FICHIERS - fichiers.length;
    if (retenus.length > place) {
      refuses.push(`Douze fichiers au plus : ${retenus.length - place} n’ont pas été ajoutés.`);
    }
    setFichiers([...fichiers, ...retenus.slice(0, Math.max(0, place))]);
    setRefus(refuses.join(' '));
  }

  function retirer(fichier) {
    oublier(fichier);
    setFichiers((actuels) => actuels.filter((element) => element !== fichier));
  }

  /**
   * Changer de nature garde les fichiers qui lui conviennent : une photo
   * reste valable pour un document, pas pour une video. Un temoignage
   * n'en garde aucun.
   */
  function choisirNature(suivante) {
    const gardes = suivante.accepte
      ? fichiers.filter((fichier) => !refusDuFichier(fichier, suivante))
      : [];
    fichiers.filter((fichier) => !gardes.includes(fichier)).forEach(oublier);
    if (gardes.length < fichiers.length) {
      setRefus(
        suivante.accepte
          ? `${fichiers.length - gardes.length} fichier(s) retiré(s) : ils ne conviennent pas à une preuve « ${suivante.libelle} ».`
          : 'Un témoignage se suffit de son texte : les fichiers ont été retirés.'
      );
    } else {
      setRefus('');
    }
    setFichiers(gardes);
    setNature(suivante);
  }

  async function envoyer(evenement) {
    evenement.preventDefault();
    if (description.trim() === '') {
      setRefus('Racontez en quelques mots ce que montre cette preuve.');
      return;
    }
    if (nature.accepte && fichiers.length === 0) {
      setRefus(
        {
          PHOTO: 'Joignez au moins une photo.',
          VIDEO: 'Joignez au moins une vidéo.',
        }[nature.cle] ?? 'Joignez au moins un fichier.'
      );
      return;
    }

    setEnvoi(true);
    setRefus('');
    try {
      await service.ajouterPreuve(projet.id, {
        proofType: nature.cle,
        description: description.trim(),
        occurredOn: date,
        fichiers,
      });
      onAjoutee();
    } catch (echec) {
      setRefus(messageErreur(echec, 'La preuve n’a pas pu être enregistrée.'));
    } finally {
      setEnvoi(false);
    }
  }

  const plein = fichiers.length >= MAX_FICHIERS;

  return (
    <Modale
      ouverte
      titre="Ajouter une preuve terrain"
      sousTitre={projet.name}
      // Pendant l'envoi, fermer abandonnerait un televersement en cours.
      onFermer={envoi ? () => {} : onFermer}
      erreur={refus}
      pied={
        <>
          <button type="button" className="btn btn--neutre" onClick={onFermer} disabled={envoi}>
            Annuler
          </button>
          <button type="submit" form="formulaire-preuve" className="btn btn--principal" disabled={envoi}>
            {envoi ? 'Envoi en cours…' : 'Ajouter la preuve'}
          </button>
        </>
      }
    >
      <form id="formulaire-preuve" className="ajout-preuve" onSubmit={envoyer}>
        <p className="livraison__consigne">
          Une photo et deux lignes suffisent : montrez ce qui a été fait sur le terrain. La preuve
          rejoint l’impact du projet ; l’équipe HOPE et les bénévoles la voient.
        </p>

        <fieldset className="ajout-preuve__natures">
          <legend className="ajout-preuve__libelle">Nature de la preuve</legend>
          {NATURES.map((element) => (
            <label
              key={element.cle}
              className={`ajout-preuve__nature${nature.cle === element.cle ? ' ajout-preuve__nature--choisie' : ''}`}
            >
              <input
                type="radio"
                name="nature"
                value={element.cle}
                checked={nature.cle === element.cle}
                onChange={() => choisirNature(element)}
                disabled={envoi}
              />
              {element.libelle}
            </label>
          ))}
        </fieldset>

        <label className="ajout-preuve__champ" htmlFor="preuve-description">
          <span className="ajout-preuve__libelle">Ce qui s’est passé</span>
          <textarea
            id="preuve-description"
            value={description}
            onChange={(evenement) => setDescription(evenement.target.value)}
            maxLength={2000}
            rows={3}
            placeholder="Les kits ont été remis ce matin aux 30 enfants de l’école d’Ankadifotsy."
            disabled={envoi}
            required
          />
        </label>

        <label className="ajout-preuve__champ ajout-preuve__champ--date" htmlFor="preuve-date">
          <span className="ajout-preuve__libelle">Date de l’action</span>
          <input
            id="preuve-date"
            type="date"
            value={date}
            max={fmt.aujourdhui()}
            onChange={(evenement) => setDate(evenement.target.value)}
            disabled={envoi}
          />
        </label>

        {nature.accepte && (
          <>
            {/* La zone de depot est aussi un bouton : on clique, ou on glisse. */}
            <label
              className={`livraison__depot${survol ? ' livraison__depot--survol' : ''}${
                plein ? ' livraison__depot--plein' : ''
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
                type="file"
                accept={nature.accepte}
                multiple
                disabled={envoi || plein}
                onChange={(evenement) => {
                  ajouter([...(evenement.target.files ?? [])]);
                  // Sans cela, rechoisir le meme fichier n'emettrait rien.
                  evenement.target.value = '';
                }}
              />
              <span className="livraison__depot-titre">
                {plein
                  ? 'Douze fichiers : c’est le maximum'
                  : {
                      PHOTO: 'Importer des photos',
                      VIDEO: 'Importer une vidéo',
                      DOCUMENT: 'Importer un document (PDF ou photo)',
                    }[nature.cle]}
              </span>
              <span className="livraison__depot-aide">
                Touchez ou glissez vos fichiers ici · Photos et PDF 10 Mo, vidéos 50 Mo · 12 fichiers
                au plus
              </span>
            </label>

            {fichiers.length > 0 && (
              <ul className="livraison__fichiers">
                {fichiers.map((fichier) => {
                  const estVideo = fichier.type.startsWith('video/');
                  const estImage = fichier.type.startsWith('image/');
                  return (
                    <li className="livraison__fichier" key={`${fichier.name}-${fichier.lastModified}`}>
                      <span className="livraison__apercu">
                        {estVideo ? (
                          <video src={apercu(fichier)} muted playsInline preload="metadata" />
                        ) : estImage ? (
                          <img src={apercu(fichier)} alt="" />
                        ) : (
                          <span className="ajout-preuve__pdf" aria-hidden="true">
                            PDF
                          </span>
                        )}
                      </span>
                      <span className="livraison__infos">
                        <span className="livraison__nom">{fichier.name}</span>
                        <span className="livraison__taille">
                          {estVideo ? 'Vidéo' : estImage ? 'Photo' : 'Document'} ·{' '}
                          {fmt.tailleFichier(fichier.size)}
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
          </>
        )}
      </form>
    </Modale>
  );
}
