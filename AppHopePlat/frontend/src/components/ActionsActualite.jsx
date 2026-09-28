import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { messageErreur } from '../services/api.js';
import { apiBailleur } from '../services/apiBailleur.js';
import { apiBenevole } from '../services/apiBenevole.js';
import { apiDonateur } from '../services/apiDonateur.js';

/**
 * « J'aime » et « Commenter », au pied d'une actualite de HOPE dans les
 * accueils des espaces.
 *
 * Le nombre de J'aime se voit de tous. Un commentaire part a l'equipe
 * HOPE seule : il n'apparait pas dans le fil -- la zone le dit avant
 * l'envoi.
 */
const CLIENTS = { donateur: apiDonateur, benevole: apiBenevole, bailleur: apiBailleur };

/** Les identifiants des actualites d'un fil. */
export function idsActualites(actualites) {
  return (actualites ?? []).map((a) => a.id).filter(Boolean);
}

/**
 * L'etat des reactions de toutes les actualites d'un fil, en une requete.
 * @param {'donateur'|'benevole'|'bailleur'} espace
 * @param {string[]} ids les identifiants des actualites affichees
 */
export function useReactionsActualites(espace, ids) {
  const client = CLIENTS[espace];
  const [etats, setEtats] = useState({});
  const cle = useMemo(() => [...ids].sort().join(','), [ids]);

  useEffect(() => {
    if (!cle) return undefined;
    let actif = true;
    client
      .get('/espace/actualites/reactions', { params: { ids: cle } })
      .then(({ data }) => actif && setEtats(data.items ?? {}))
      .catch(() => {});
    return () => {
      actif = false;
    };
  }, [client, cle]);

  const basculer = useCallback(
    async (id) => {
      // Reponse immediate a l'ecran, corrigee par le serveur.
      setEtats((e) => {
        const actuel = e[id] ?? { jaimes: 0, jaime: false };
        return { ...e, [id]: { jaime: !actuel.jaime, jaimes: Math.max(0, actuel.jaimes + (actuel.jaime ? -1 : 1)) } };
      });
      try {
        const { data } = await client.post(`/espace/actualites/${id}/jaime`);
        setEtats((e) => ({ ...e, [id]: data }));
      } catch {
        setEtats((e) => {
          const actuel = e[id];
          return { ...e, [id]: { jaime: !actuel.jaime, jaimes: Math.max(0, actuel.jaimes + (actuel.jaime ? -1 : 1)) } };
        });
      }
    },
    [client]
  );

  const commenter = useCallback(
    async (id, texte) => (await client.post(`/espace/actualites/${id}/commentaires`, { texte })).data,
    [client]
  );

  return { etats, basculer, commenter };
}

function Coeur({ plein }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={plein ? 'actualite-action__coeur--plein' : undefined}>
      <path d="M12 20s-7-4.4-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.6-7 10-7 10z" />
    </svg>
  );
}

function Bulle() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 5.5A2.5 2.5 0 016.5 3h11A2.5 2.5 0 0120 5.5v8a2.5 2.5 0 01-2.5 2.5H10l-4.5 4v-4h0A2.5 2.5 0 014 13.5z" />
    </svg>
  );
}

/**
 * Les deux boutons, et la zone de commentaire qui se deplie dessous.
 * @param {{ publication: object, etat?: { jaimes: number, jaime: boolean },
 *           onJaime: (id: string) => void, onCommenter: (id: string, texte: string) => Promise<{message: string}> }} props
 */
export default function ActionsActualite({ publication, etat, onJaime, onCommenter }) {
  const [ouvert, setOuvert] = useState(false);
  const [texte, setTexte] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [merci, setMerci] = useState('');
  const [refus, setRefus] = useState('');
  const [battement, setBattement] = useState(false);
  const zone = useRef(null);
  const jaime = Boolean(etat?.jaime);
  const jaimes = etat?.jaimes ?? 0;

  useEffect(() => {
    if (ouvert) zone.current?.focus();
  }, [ouvert]);

  async function envoyer(evenement) {
    evenement.preventDefault();
    if (!texte.trim()) return;
    setEnvoi(true);
    setRefus('');
    try {
      const resultat = await onCommenter(publication.id, texte.trim());
      setMerci(resultat.message);
      setTexte('');
      setOuvert(false);
    } catch (echec) {
      setRefus(messageErreur(echec, 'Le commentaire n’a pas pu partir. Réessayez dans un instant.'));
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <div className="actualite-actions">
      <div className="fil-post__actions fil-post__actions--double">
        <button
          type="button"
          className={`fil-post__action actualite-action${jaime ? ' actualite-action--aime' : ''}${battement ? ' actualite-action--bat' : ''}`}
          aria-pressed={jaime}
          aria-label={`${jaime ? 'Je n’aime plus' : 'J’aime'} cette actualité${jaimes ? ` (${jaimes} j’aime)` : ''}`}
          onClick={() => {
            if (!jaime) {
              setBattement(true);
              setTimeout(() => setBattement(false), 450);
            }
            onJaime(publication.id);
          }}
        >
          <Coeur plein={jaime} />
          J’aime
          {jaimes > 0 && <span className="actualite-action__nombre">{jaimes}</span>}
        </button>
        <button
          type="button"
          className={`fil-post__action actualite-action${ouvert ? ' actualite-action--actif' : ''}`}
          aria-expanded={ouvert}
          onClick={() => {
            setOuvert((o) => !o);
            setMerci('');
          }}
        >
          <Bulle />
          Commenter
        </button>
      </div>

      {merci && (
        <p className="actualite-commentaire__merci" role="status">
          {merci}
        </p>
      )}

      {ouvert && (
        <form className="actualite-commentaire" onSubmit={envoyer}>
          <label className="sr-only" htmlFor={`commentaire-${publication.id}`}>
            Votre commentaire
          </label>
          <textarea
            ref={zone}
            id={`commentaire-${publication.id}`}
            value={texte}
            maxLength={1000}
            rows={3}
            placeholder="Écrivez à l’équipe HOPE…"
            onChange={(e) => setTexte(e.target.value)}
            disabled={envoi}
          />
          <div className="actualite-commentaire__pied">
            <span className="actualite-commentaire__aide">Seule l’équipe HOPE lira votre commentaire.</span>
            <span className="actualite-commentaire__boutons">
              <button type="button" className="actualite-commentaire__annuler" onClick={() => setOuvert(false)} disabled={envoi}>
                Annuler
              </button>
              <button type="submit" className="actualite-commentaire__envoyer" disabled={envoi || !texte.trim()}>
                {envoi ? 'Envoi…' : 'Envoyer'}
              </button>
            </span>
          </div>
          {refus && (
            <p className="actualite-commentaire__refus" role="alert">
              {refus}
            </p>
          )}
        </form>
      )}
    </div>
  );
}
