import { useRef, useState } from 'react';

import { IconeCroix, IconeTelechargement } from './AdminIcons.jsx';
import { ChampTexte } from './forms.jsx';
import { messageErreur, urlMedia } from '../../services/api.js';
import * as projectService from '../../services/project.service.js';
import * as fmt from '../../utils/format.js';

/**
 * Choix de la photo ou de la video qui illustre un projet.
 *
 * Deux façons d'importer, presentees comme deux onglets :
 *   * depuis votre PC — le fichier est televerse et stocke par HOPE ;
 *   * depuis une URL  — l'adresse d'un media deja en ligne.
 *
 * Dans les deux cas, le parent ne recoit qu'une adresse et une nature
 * (PHOTO ou VIDEO), et un apercu s'affiche des que le media est connu.
 *
 * @param {{ valeur: string, type: 'PHOTO'|'VIDEO',
 *           onChange: (adresse: string, type: string) => void,
 *           desactive?: boolean }} props
 */
export default function ChampMedia({ valeur, type = 'PHOTO', onChange, desactive = false }) {
  // L'import depuis le poste est le cas courant : c'est le mode par defaut.
  // On ne bascule sur URL que si le projet porte deja une adresse externe.
  const [mode, setMode] = useState(() =>
    /^(https?:)?\/\//.test(valeur ?? '') ? 'URL' : 'FICHIER'
  );
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState('');
  const [nomFichier, setNomFichier] = useState('');
  const [taille, setTaille] = useState(null);

  const champFichier = useRef(null);

  async function importerFichier(evenement) {
    const fichier = evenement.target.files?.[0];
    if (!fichier) return;

    setErreur('');
    setEnvoi(true);
    try {
      const media = await projectService.televerserMedia(fichier);
      setNomFichier(media.fileName);
      setTaille(media.size);
      onChange(media.url, media.type);
    } catch (echec) {
      setErreur(messageErreur(echec, "L'import du fichier a échoué."));
      // Le champ est vide : on peut reselectionner le meme fichier.
      if (champFichier.current) champFichier.current.value = '';
    } finally {
      setEnvoi(false);
    }
  }

  function changerMode(nouveauMode) {
    if (nouveauMode === mode) return;
    setMode(nouveauMode);
    setErreur('');
    // Passer d'un mode a l'autre repart d'un media vide, pour eviter de
    // laisser une adresse qui ne correspond plus au mode affiche.
    retirer();
  }

  function retirer() {
    setNomFichier('');
    setTaille(null);
    if (champFichier.current) champFichier.current.value = '';
    onChange('', type);
  }

  const apercu = urlMedia(valeur);

  return (
    <div className="champ-admin champ-admin--pleine-largeur">
      <span className="champ-admin__label">
        Photo ou vidéo du projet<span>(facultatif)</span>
      </span>

      <div className="media-import">
        {/* --- Les deux façons d'importer --- */}
        <div className="filtres media-import__modes" role="group" aria-label="Mode d’import">
          <button
            type="button"
            className={`filtres__bouton${mode === 'FICHIER' ? ' filtres__bouton--actif' : ''}`}
            onClick={() => changerMode('FICHIER')}
            disabled={desactive || envoi}
            aria-pressed={mode === 'FICHIER'}
          >
            Depuis votre PC
          </button>
          <button
            type="button"
            className={`filtres__bouton${mode === 'URL' ? ' filtres__bouton--actif' : ''}`}
            onClick={() => changerMode('URL')}
            disabled={desactive || envoi}
            aria-pressed={mode === 'URL'}
          >
            Depuis une URL
          </button>
        </div>

        {/* --- Import d'un fichier --- */}
        {mode === 'FICHIER' && (
          <div className="media-import__zone">
            <input
              ref={champFichier}
              id="mediaFichier"
              type="file"
              accept=".jpg,.jpeg,.png,.webp,.mp4,.webm,image/jpeg,image/png,image/webp,video/mp4,video/webm"
              onChange={importerFichier}
              disabled={desactive || envoi}
              className="media-import__fichier"
            />
            <label htmlFor="mediaFichier" className="btn btn--neutre">
              <IconeTelechargement />
              {envoi ? 'Import en cours…' : 'Choisir un fichier'}
            </label>

            <p className="champ-admin__aide" style={{ marginTop: 0 }}>
              {nomFichier
                ? `${nomFichier} — ${fmt.tailleFichier(taille)}`
                : 'Photos : JPG, PNG, WEBP. Vidéos : MP4, WEBM. 50 Mo maximum.'}
            </p>
          </div>
        )}

        {/* --- Adresse d'un media deja en ligne --- */}
        {mode === 'URL' && (
          <>
            <ChampTexte
              label="Adresse du média"
              id="mediaUrl"
              type="url"
              value={valeur ?? ''}
              onChange={(e) => onChange(e.target.value, type)}
              placeholder="https://…"
              disabled={desactive}
              pleineLargeur
              aide="Adresse d’une image ou d’une vidéo déjà en ligne."
            />
            <div className="champ-admin" style={{ maxWidth: '220px' }}>
              <label className="champ-admin__label" htmlFor="mediaType">
                Nature du média
              </label>
              <select
                id="mediaType"
                value={type}
                onChange={(e) => onChange(valeur ?? '', e.target.value)}
                disabled={desactive || !valeur}
              >
                <option value="PHOTO">Photo</option>
                <option value="VIDEO">Vidéo</option>
              </select>
            </div>
          </>
        )}

        {erreur && <p className="champ-admin__message">{erreur}</p>}

        {/* --- Apercu --- */}
        {apercu && (
          <figure className="media-import__apercu">
            {type === 'VIDEO' ? (
              <video src={apercu} controls preload="metadata" />
            ) : (
              <img src={apercu} alt="Aperçu du média du projet" />
            )}
            <figcaption>
              <span>{type === 'VIDEO' ? 'Vidéo' : 'Photo'} rattachée au projet</span>
              <button
                type="button"
                className="lien-action lien-action--danger"
                onClick={retirer}
                disabled={desactive || envoi}
              >
                <IconeCroix />
                Retirer
              </button>
            </figcaption>
          </figure>
        )}
      </div>
    </div>
  );
}
