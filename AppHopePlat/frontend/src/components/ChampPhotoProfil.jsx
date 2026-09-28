import { useState } from 'react';

import { messageErreur, urlMedia } from '../services/api.js';
import { initiales } from '../utils/format.js';
import { PhotoAgrandissable } from './VisionneuseImage.jsx';

/**
 * Le champ de photo de profil, partage par les trois espaces.
 *
 * Il ne sait pas ou televerser : la fonction lui est donnee, et c'est
 * elle qui differe d'un espace a l'autre -- chacun a son client axios et
 * sa route. Le reste est identique, et l'ecrire trois fois aurait fait
 * diverger trois formulaires pour le meme geste.
 *
 * Choisir un fichier l'envoie aussitot et rend son adresse au
 * formulaire ; c'est l'enregistrement de celui-ci qui la rattache au
 * compte. Un televersement abandonne laisse donc un fichier orphelin,
 * comme cote projet : c'est le prix d'un apercu immediat.
 */
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
      // Sans cela, rechoisir le meme fichier n'emettrait aucun evenement.
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
