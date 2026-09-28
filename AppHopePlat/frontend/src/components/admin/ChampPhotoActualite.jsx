import { useId, useRef, useState } from 'react';

import { IconeTelechargement } from './AdminIcons.jsx';
import { messageErreur, urlMedia } from '../../services/api.js';
import * as publicationService from '../../services/publication.service.js';

/**
 * La photo d'une actualite, rattachee a son projet.
 *
 * Par defaut, l'actualite montre la photo du projet lie -- et la suit :
 * si l'equipe change la photo du projet, l'actualite change avec elle.
 * On peut la remplacer par une photo propre, puis revenir a celle du
 * projet.
 *
 * @param {{ photoPropre: string, photoProjet: string|null, nomProjet?: string,
 *           onChange: (adresse: string) => void, desactive?: boolean }} props
 *   photoPropre : l'adresse televersee, '' si l'actualite suit le projet
 */
export default function ChampPhotoActualite({
  photoPropre,
  photoProjet,
  nomProjet,
  onChange,
  desactive = false,
}) {
  const id = useId();
  const champ = useRef(null);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState('');

  async function importer(evenement) {
    const fichier = evenement.target.files?.[0];
    if (!fichier) return;
    setErreur('');
    setEnvoi(true);
    try {
      const media = await publicationService.televerserPhoto(fichier);
      onChange(media.url);
    } catch (echec) {
      setErreur(messageErreur(echec, 'L’import de la photo a échoué.'));
    } finally {
      setEnvoi(false);
      // Le meme fichier doit pouvoir etre choisi a nouveau.
      if (champ.current) champ.current.value = '';
    }
  }

  const affichee = photoPropre || photoProjet;
  const suitLeProjet = !photoPropre && Boolean(photoProjet);

  const boutonFichier = (libelle) => (
    <>
      <input
        ref={champ}
        id={id}
        type="file"
        accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
        onChange={importer}
        disabled={desactive || envoi}
        className="media-import__fichier"
      />
      <label htmlFor={id} className="btn btn--neutre btn--petit">
        <IconeTelechargement />
        {envoi ? 'Import en cours…' : libelle}
      </label>
    </>
  );

  return (
    <div className="champ-admin champ-admin--pleine-largeur">
      <span className="champ-admin__label">
        Photo<span>(facultatif)</span>
      </span>

      <div className="media-import">
        {affichee ? (
          <figure className="media-import__apercu">
            <img src={urlMedia(affichee)} alt="" />
            <figcaption className="photo-actualite__legende">
              <span>
                {suitLeProjet
                  ? `Photo du projet${nomProjet ? ` « ${nomProjet} »` : ''} — elle suit le projet`
                  : 'Photo propre à cette actualité'}
              </span>
              <span className="photo-actualite__actions">
                {boutonFichier(suitLeProjet ? 'Choisir une autre photo' : 'Remplacer')}
                {!suitLeProjet && (
                  <button
                    type="button"
                    className="lien-action"
                    onClick={() => onChange('')}
                    disabled={desactive || envoi}
                  >
                    {photoProjet ? 'Reprendre la photo du projet' : 'Retirer la photo'}
                  </button>
                )}
              </span>
            </figcaption>
          </figure>
        ) : (
          <div className="media-import__zone">
            {boutonFichier('Choisir une photo')}
            <p className="champ-admin__aide" style={{ marginTop: 0 }}>
              {nomProjet
                ? 'Ce projet n’a pas de photo. JPG, PNG ou WEBP.'
                : 'JPG, PNG ou WEBP. Liée à un projet, l’actualité reprend sa photo.'}
            </p>
          </div>
        )}

        {erreur && <p className="champ-admin__message">{erreur}</p>}
      </div>
    </div>
  );
}
