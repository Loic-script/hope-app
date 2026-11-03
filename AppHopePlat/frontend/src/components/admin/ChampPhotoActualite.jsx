import { useEffect, useId, useRef, useState } from 'react';

import { IconeTelechargement } from './AdminIcons.jsx';
import RecadragePhoto from './RecadragePhoto.jsx';
import { messageErreur, urlMedia } from '../../services/api.js';
import * as publicationService from '../../services/publication.service.js';

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
  const [recadrage, setRecadrage] = useState(null);

  useEffect(() => () => recadrage && URL.revokeObjectURL(recadrage), [recadrage]);

  async function envoyer(fichier) {
    setErreur('');
    setEnvoi(true);
    try {
      const media = await publicationService.televerserPhoto(fichier);
      onChange(media.url);
      return true;
    } catch (echec) {
      setErreur(messageErreur(echec, 'L’import de la photo a échoué.'));
      return false;
    } finally {
      setEnvoi(false);
    }
  }

  async function importer(evenement) {
    const fichier = evenement.target.files?.[0];
    if (!fichier) return;
    await envoyer(fichier);
    if (champ.current) champ.current.value = '';
  }

  async function ouvrirRecadrage() {
    setErreur('');
    try {
      const reponse = await fetch(urlMedia(affichee));
      if (!reponse.ok) throw new Error();
      setRecadrage(URL.createObjectURL(await reponse.blob()));
    } catch {
      setErreur('La photo n’a pas pu être ouverte pour la redimensionner.');
    }
  }

  async function validerRecadrage(blob) {
    const fichier = new File([blob], 'photo-recadree.jpg', { type: 'image/jpeg' });
    if (await envoyer(fichier)) setRecadrage(null);
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
        {recadrage ? (
          <RecadragePhoto
            source={recadrage}
            onValider={validerRecadrage}
            onAnnuler={() => setRecadrage(null)}
            envoi={envoi}
          />
        ) : affichee ? (
          <figure className="media-import__apercu photo-actualite__apercu">
            <img src={urlMedia(affichee)} alt="" />
            <figcaption className="photo-actualite__legende">
              <span>
                {suitLeProjet
                  ? `Photo du projet${nomProjet ? ` « ${nomProjet} »` : ''} — elle suit le projet`
                  : 'Photo propre à cette actualité'}
              </span>
              <span className="photo-actualite__actions">
                <button
                  type="button"
                  className="btn btn--neutre btn--petit"
                  onClick={ouvrirRecadrage}
                  disabled={desactive || envoi}
                >
                  Redimensionner
                </button>
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
