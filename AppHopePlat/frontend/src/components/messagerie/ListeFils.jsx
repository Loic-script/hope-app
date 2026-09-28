import { useEffect, useMemo, useRef, useState } from 'react';

import { IconeRecherche } from '../admin/AdminIcons.jsx';
import Avatar from './Avatar.jsx';
import { apercu, correspond, heureRelative } from './outils.js';

/** Les groupes de contacts, dans l'ordre ou ils se lisent. */
const GROUPES = [
  { cle: 'equipe', titre: 'Équipe HOPE' },
  { cle: 'donateur', titre: 'Donateurs' },
  { cle: 'bailleur', titre: 'Partenaires' },
  { cle: 'benevole', titre: 'Bénévoles' },
  { cle: 'autre', titre: 'Autres' },
];

/** Le groupe d'une personne de l'annuaire. */
function groupeDe(personne) {
  if (personne.type === 'equipe' || personne.role === 'equipe') return 'equipe';
  return GROUPES.some((g) => g.cle === personne.role) ? personne.role : 'autre';
}

/**
 * La liste des conversations, et sous elle les contacts.
 *
 * Les conversations d'abord, par activite. Puis, sans attendre de
 * recherche, les personnes avec qui aucun echange n'existe encore --
 * l'equipe HOPE en tete, puis donateurs, partenaires, benevoles : on
 * voit a qui l'on peut ecrire, et un clic ouvre la conversation.
 *
 * La recherche porte sur le nom, le sous-titre et l'apercu, sans accents
 * ni casse, et filtre les deux listes a la fois.
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

  // L'annuaire se charge a l'ouverture : les contacts s'affichent sous
  // les conversations, sans qu'il faille chercher.
  //
  // Il se relit quand une conversation s'ajoute (on vient d'ecrire a un
  // contact : il passe dans les conversations). La liste affichee n'est
  // jamais videe pendant ce temps : la nouvelle la remplace a son arrivee.
  // Un echec (reseau coupe, serveur qui redemarre) est retente trois fois,
  // a intervalles croissants.
  const [version, setVersion] = useState(0);
  const [essai, setEssai] = useState(0);
  useEffect(() => {
    let annule = false;
    let reprise = null;
    chargerJoignables()
      .then((items) => {
        if (!annule) setJoignables(items);
      })
      .catch(() => {
        if (annule) return;
        if (essai < 3) reprise = setTimeout(() => setEssai((n) => n + 1), 1500 * (essai + 1));
        else setJoignables((actuels) => actuels ?? []);
      });
    return () => {
      annule = true;
      clearTimeout(reprise);
    };
  }, [chargerJoignables, version, essai]);

  const nombreFils = fils.length;
  const nombreConnu = useRef(null);
  useEffect(() => {
    // Le premier nombre connu n'est pas un ajout.
    if (nombreConnu.current !== null && nombreConnu.current !== nombreFils) setVersion((v) => v + 1);
    nombreConnu.current = nombreFils;
  }, [nombreFils]);

  const filsFiltres = useMemo(
    () => fils.filter((fil) => correspond(recherche, fil.nom, fil.sousTitre, apercu(fil))),
    [fils, recherche]
  );

  // Les contacts sans conversation, filtres par la recherche, par groupe.
  const contacts = useMemo(() => {
    if (!joignables) return [];
    const libres = joignables.filter(
      (p) => !p.filId && (recherche.trim() === '' || correspond(recherche, p.nom, p.sousTitre))
    );
    return GROUPES.map((g) => ({
      ...g,
      personnes: libres
        .filter((p) => groupeDe(p) === g.cle)
        .sort((a, b) => String(a.nom).localeCompare(String(b.nom), 'fr')),
    })).filter((g) => g.personnes.length > 0);
  }, [joignables, recherche]);
  const nombreContacts = contacts.reduce((total, g) => total + g.personnes.length, 0);

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
                {nombreContacts > 0
                  ? 'Aucune conversation pour l’instant. Écrivez à l’une des personnes ci-dessous.'
                  : 'Aucune conversation pour l’instant.'}
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

            {recherche.trim() !== '' && filsFiltres.length === 0 && nombreContacts === 0 && joignables !== null && (
              <p className="msg-liste__vide">Rien ne correspond à « {recherche} ».</p>
            )}

            {contacts.map((groupe) => (
              <div key={groupe.cle} className="msg-contacts">
                <p className="msg-liste__section">
                  {groupe.titre}
                  <span className="msg-liste__compte">{groupe.personnes.length}</span>
                </p>
                <ul className="msg-liste__lignes">
                  {groupe.personnes.map((personne) => {
                    const cle = `${personne.type}:${personne.id}`;
                    return (
                      <li key={cle}>
                        <button
                          type="button"
                          data-ligne
                          className="msg-ligne msg-ligne--nouvelle"
                          onClick={() => nouvelle(personne)}
                          disabled={ouverture !== null}
                          aria-label={`Écrire à ${personne.nom}`}
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
                          <span className="msg-ligne__ecrire" aria-hidden="true">
                            Écrire
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </>
        )}
      </div>
    </section>
  );
}
