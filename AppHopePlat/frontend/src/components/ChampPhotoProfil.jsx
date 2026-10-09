import { useState } from 'react';

import { messageErreur, urlMedia } from '../services/api.js';
import { initiales } from '../utils/format.js';
import { PhotoAgrandissable } from './VisionneuseImage.jsx';

export default function ChampPhotoProfil({
  valeur,
  nom,
  televerser,
  onChange,
  disabled = false,
  aide = 'Une image — JPEG, PNG ou WebP.',
}) {
  const [envoi, setEnvoi] = useState(false);
  const [refus, setRefus] = useState('');

  async function choisir(evenement) {
    const fichier = evenement.target.files?.[0];
    if (!fichier) return;

    setEnvoi(true);
    setRefus('');
    try {
      const media = await televerser(fichier);
      onChange(media.url);
    } catch (echec) {
      setRefus(messageErreur(echec, 'Le téléversement a échoué.'));
    } finally {
      setEnvoi(false);
      evenement.target.value = '';
    }
  }

  return (
    <div className="photo-profil">
      <span className="photo-profil__apercu">
        {valeur ? (
          <PhotoAgrandissable src={urlMedia(valeur)} alt={nom ? `Photo de ${nom}` : 'Photo'} />
        ) : (
          <span aria-hidden="true">{initiales(nom)}</span>
        )}
      </span>

      <div className="photo-profil__actions">
        <label className="btn btn--neutre photo-profil__choisir">
          {envoi ? 'Envoi…' : valeur ? 'Changer la photo' : 'Ajouter une photo'}
          <input type="file" accept="image/*" onChange={choisir} disabled={disabled || envoi} />
        </label>

        {valeur && (
          <button
            type="button"
            className="lien-action lien-action--danger"
            onClick={() => onChange('')}
            disabled={disabled || envoi}
          >
            Retirer
          </button>
        )}

        <p className="photo-profil__aide">{refus || aide}</p>
      </div>
    </div>
  );
}
