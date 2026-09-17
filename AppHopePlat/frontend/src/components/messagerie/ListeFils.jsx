import { useEffect, useMemo, useRef, useState } from 'react';

import { IconeRecherche } from '../admin/AdminIcons.jsx';
import Avatar from './Avatar.jsx';
import { apercu, correspond, heureRelative } from './outils.js';

/**
 * La liste des conversations.
 *
 * La recherche porte sur le nom, le sous-titre et l'apercu, sans accents
 * ni casse. Elle propose aussi, sous "Nouvelle conversation", les
 * personnes avec qui aucun echange n'existe encore : chercher quelqu'un
 * et lui ecrire sont le meme geste.
 *
 * @param {{
 *   fils: object[], actif: number|null, chargement: boolean,
 *   onOuvrir: (id: number) => void,
 *   onNouvelle: (personne: object) => Promise<void>,
 *   chargerJoignables: () => Promise<object[]>,
 *   actions?: React.ReactNode,
 * }} props
 */
export default function ListeFils({ fils, actif, chargement, onOuvrir, onNouvelle, chargerJoignables, actions }) {
  const [recherche, setRecherche] = useState('');
  const [joignables, setJoignables] = useState(null);
  const [ouverture, setOuverture] = useState(null);
  const liste = useRef(null);

  // L'annuaire ne se charge qu'au premier caractere tape : la plupart des
  // visites ne cherchent personne.
  useEffect(() => {
    if (recherche.trim() === '' || joignables !== null) return;
    let annule = false;
    chargerJoignables()
      .then((items) => {
        if (!annule) setJoignables(items);
      })
      .catch(() => {
        if (!annule) setJoignables([]);
      });
    return () => {
      annule = true;
    };
  }, [recherche, joignables, chargerJoignables]);

  const filsFiltres = useMemo(
    () => fils.filter((fil) => correspond(recherche, fil.nom, fil.sousTitre, apercu(fil))),
    [fils, recherche]
  );

  const nouvelles = useMemo(() => {
    if (recherche.trim() === '' || !joignables) return [];
    return joignables.filter((p) => !p.filId && correspond(recherche, p.nom, p.sousTitre));
  }, [joignables, recherche]);

  /** Fleches haut et bas pour passer d'une ligne a l'autre. */
  function surTouche(evenement) {
    if (evenement.key !== 'ArrowDown' && evenement.key !== 'ArrowUp') return;
    const lignes = [...liste.current.querySelectorAll('[data-ligne]')];
    const index = lignes.indexOf(document.activeElement);
    if (index === -1) return;
    evenement.preventDefault();
    const suivant = evenement.key === 'ArrowDown' ? index + 1 : index - 1;
    lignes[Math.max(0, Math.min(lignes.length - 1, suivant))]?.focus();
  }

  async function nouvelle(personne) {
    setOuverture(`${personne.type}:${personne.id}`);
    try {
      await onNouvelle(personne);
      setRecherche('');
    } finally {
      setOuverture(null);
    }
  }

  return (
    <section className="msg-liste" aria-label="Conversations">
      <div className="msg-liste__outils">
        <label className="msg-recherche">
          <IconeRecherche aria-hidden="true" />
          <span className="sr-only">Rechercher une conversation ou une personne</span>
          <input
            type="search"
            value={recherche}
            onChange={(evenement) => setRecherche(evenement.target.value)}
            placeholder="Rechercher…"
          />
        </label>
        {actions}
      </div>

      <div className="msg-liste__defilement" ref={liste} onKeyDown={surTouche}>
        {chargement && fils.length === 0 ? (
          <p className="msg-liste__vide">Chargement…</p>
        ) : (
          <>
            {filsFiltres.length === 0 && recherche.trim() === '' && (
              <p className="msg-liste__vide">
                Aucune conversation. Cherchez une personne pour lui écrire.
              </p>
            )}

            <ul className="msg-liste__lignes">
              {filsFiltres.map((fil) => (
                <li key={fil.id}>
                  <button
                    type="button"
                    data-ligne
                    className={`msg-ligne${fil.id === actif ? ' msg-ligne--active' : ''}${
                      fil.nonLus > 0 ? ' msg-ligne--non-lue' : ''
                    }`}
                    aria-current={fil.id === actif ? 'true' : undefined}
                    onClick={() => onOuvrir(fil.id)}
                  >
                    <Avatar nom={fil.nom} photoUrl={fil.photoUrl} src={fil.photoSrc} equipe={fil.equipe} />
                    <span className="msg-ligne__corps">
                      <span className="msg-ligne__haut">
                        <span className="msg-ligne__nom">{fil.nom}</span>
                        <span className="msg-ligne__heure">
                          {heureRelative(fil.dernier?.creeLe ?? fil.creeLe)}
                        </span>
                      </span>
                      {fil.sousTitre && <span className="msg-ligne__sous-titre">{fil.sousTitre}</span>}
                      <span className="msg-ligne__bas">
                        <span className="msg-ligne__apercu">{apercu(fil)}</span>
                        {fil.nonLus > 0 && (
                          <span className="msg-pastille" aria-label={`${fil.nonLus} non lu${fil.nonLus > 1 ? 's' : ''}`}>
                            {fil.nonLus > 99 ? '99+' : fil.nonLus}
                          </span>
                        )}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>

            {recherche.trim() !== '' && filsFiltres.length === 0 && nouvelles.length === 0 && joignables !== null && (
              <p className="msg-liste__vide">Rien ne correspond à « {recherche} ».</p>
            )}

            {nouvelles.length > 0 && (
              <>
                <p className="msg-liste__section">Nouvelle conversation</p>
                <ul className="msg-liste__lignes">
                  {nouvelles.map((personne) => {
                    const cle = `${personne.type}:${personne.id}`;
                    return (
                      <li key={cle}>
                        <button
                          type="button"
                          data-ligne
                          className="msg-ligne msg-ligne--nouvelle"
                          onClick={() => nouvelle(personne)}
                          disabled={ouverture !== null}
                        >
                          <Avatar nom={personne.nom} photoUrl={personne.photoUrl} equipe={personne.type === 'equipe'} />
                          <span className="msg-ligne__corps">
                            <span className="msg-ligne__haut">
                              <span className="msg-ligne__nom">{personne.nom}</span>
                            </span>
                            <span className="msg-ligne__sous-titre">
                              {ouverture === cle ? 'Ouverture…' : personne.sousTitre}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </>
        )}
      </div>
    </section>
  );
}
