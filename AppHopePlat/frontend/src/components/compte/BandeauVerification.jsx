import { useEffect, useState } from 'react';

import { messageErreur } from '../../services/api.js';
import { apiBailleur } from '../../services/apiBailleur.js';
import { apiBenevole } from '../../services/apiBenevole.js';
import { apiDonateur } from '../../services/apiDonateur.js';

const CLIENTS = { donateur: apiDonateur, benevole: apiBenevole, bailleur: apiBailleur };
const CLE_MASQUE = 'hope.verification.masquee';

export default function BandeauVerification({ espace }) {
  const client = CLIENTS[espace];
  const [etat, setEtat] = useState(null);
  const [message, setMessage] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [masque, setMasque] = useState(() => {
    try {
      return sessionStorage.getItem(CLE_MASQUE) === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    let actif = true;
    client
      .get('/espace/compte')
      .then(({ data }) => actif && setEtat(data))
      .catch(() => {});
    return () => {
      actif = false;
    };
  }, [client]);

  if (!etat || etat.emailVerifie || masque) return null;

  async function renvoyer() {
    setEnvoi(true);
    try {
      const { data } = await client.post('/espace/compte/verification');
      setMessage(data.message);
      if (data.emailVerifie) setEtat((e) => ({ ...e, emailVerifie: true }));
    } catch (echec) {
      setMessage(messageErreur(echec, 'Le lien n’a pas pu être renvoyé. Réessayez dans quelques minutes.'));
    } finally {
      setEnvoi(false);
    }
  }

  function masquer() {
    setMasque(true);
    try {
      sessionStorage.setItem(CLE_MASQUE, '1');
    } catch {
    }
  }

  return (
    <div className="bandeau-verif" role="status">
      <span className="bandeau-verif__icone" aria-hidden="true">
        <svg viewBox="0 0 24 24">
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="M3 7l9 6 9-6" />
        </svg>
      </span>
      <p className="bandeau-verif__texte">
        {message || (
          <>
            Confirmez votre adresse <strong>{etat.email}</strong> : le lien vous attend dans votre boîte de réception.
          </>
        )}
      </p>
      <div className="bandeau-verif__actions">
        {!message && (
          <button type="button" className="bandeau-verif__bouton" onClick={renvoyer} disabled={envoi}>
            {envoi ? 'Envoi…' : 'Renvoyer le lien'}
          </button>
        )}
        <button type="button" className="bandeau-verif__fermer" onClick={masquer} aria-label="Masquer ce rappel">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>
    </div>
  );
}
