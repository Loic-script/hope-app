import { useEffect, useId, useMemo, useRef, useState } from 'react';

import { Champ } from './forms.jsx';

export default function ChampCombo({
  label,
  id,
  value,
  onChange,
  options = [],
  placeholder = 'Choisir ou taper…',
  max = 60,
  disabled = false,
  aide,
  obligatoire,
  pleineLargeur,
}) {
  const [ouvert, setOuvert] = useState(false);
  const [actif, setActif] = useState(-1);
  const enveloppe = useRef(null);
  const liste = useRef(null);
  const idListe = `${useId()}-liste`;

  const plier = (texte) =>
    String(texte ?? '')
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase()
      .trim();

  const propositions = useMemo(() => {
    const saisie = plier(value);
    const filtrees = saisie ? options.filter((o) => plier(o).includes(saisie)) : options;
    const connue = options.some((o) => plier(o) === saisie);
    const nouvelle = value.trim() && !connue ? [{ nouvelle: true, valeur: value.trim() }] : [];
    return [...filtrees.map((o) => ({ nouvelle: false, valeur: o })), ...nouvelle];
  }, [value, options]);

  useEffect(() => {
    if (!ouvert) return undefined;
    const fermer = (evenement) => {
      if (!enveloppe.current?.contains(evenement.target)) setOuvert(false);
    };
    document.addEventListener('pointerdown', fermer);
    return () => document.removeEventListener('pointerdown', fermer);
  }, [ouvert]);

  useEffect(() => {
    if (actif < 0) return;
    liste.current?.children[actif]?.scrollIntoView({ block: 'nearest' });
  }, [actif]);

  function choisir(valeur) {
    onChange(valeur.slice(0, max));
    setOuvert(false);
    setActif(-1);
  }

  function auClavier(evenement) {
    if (evenement.key === 'ArrowDown') {
      evenement.preventDefault();
      setOuvert(true);
      setActif((i) => Math.min(propositions.length - 1, i + 1));
    } else if (evenement.key === 'ArrowUp') {
      evenement.preventDefault();
      setActif((i) => Math.max(0, i - 1));
    } else if (evenement.key === 'Enter' && ouvert && actif >= 0 && propositions[actif]) {
      evenement.preventDefault();
      choisir(propositions[actif].valeur);
    } else if (evenement.key === 'Escape' && ouvert) {
      evenement.preventDefault();
      evenement.stopPropagation();
      setOuvert(false);
    }
  }

  return (
    <Champ label={label} id={id} obligatoire={obligatoire} aide={aide} pleineLargeur={pleineLargeur}>
      <div className={`champ-combo${ouvert ? ' champ-combo--ouvert' : ''}`} ref={enveloppe}>
        <input
          id={id}
          name={id}
          type="text"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={ouvert && propositions.length > 0}
          aria-controls={idListe}
          aria-activedescendant={ouvert && actif >= 0 ? `${idListe}-${actif}` : undefined}
          autoComplete="off"
          value={value}
          maxLength={max}
          placeholder={placeholder}
          disabled={disabled}
          onChange={(e) => {
            onChange(e.target.value);
            setOuvert(true);
            setActif(-1);
          }}
          onFocus={() => setOuvert(true)}
          onClick={() => setOuvert(true)}
          onKeyDown={auClavier}
        />
        <button
          type="button"
          className="champ-combo__bascule"
          tabIndex={-1}
          aria-label={ouvert ? 'Fermer la liste' : 'Ouvrir la liste'}
          disabled={disabled}
          onClick={() => setOuvert((o) => !o)}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="m6 9.5 6 6 6-6" />
          </svg>
        </button>
        {value && !disabled && (
          <button type="button" className="champ-combo__vider" aria-label="Effacer" onClick={() => choisir('')}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        )}

        {ouvert && propositions.length > 0 && !disabled && (
          <ul className="champ-combo__liste" id={idListe} role="listbox" ref={liste}>
            {propositions.map((p, rang) => (
              <li
                key={`${p.nouvelle ? 'n' : 'o'}-${p.valeur}`}
                id={`${idListe}-${rang}`}
                role="option"
                aria-selected={rang === actif || (!p.nouvelle && p.valeur === value)}
                className={[
                  'champ-combo__option',
                  rang === actif ? 'champ-combo__option--active' : '',
                  p.nouvelle ? 'champ-combo__option--nouvelle' : '',
                  !p.nouvelle && p.valeur === value ? 'champ-combo__option--choisie' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => choisir(p.valeur)}
                onMouseEnter={() => setActif(rang)}
              >
                {p.nouvelle ? (
                  <>
                    <span className="champ-combo__plus" aria-hidden="true">
                      +
                    </span>
                    Utiliser « {p.valeur} »
                  </>
                ) : (
                  p.valeur
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Champ>
  );
}
