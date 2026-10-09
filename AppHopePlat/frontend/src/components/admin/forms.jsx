import { useEffect } from 'react';
import { createPortal } from 'react-dom';

import { IconeCroix } from './AdminIcons.jsx';
import { Alerte } from './ui.jsx';

export function Champ({ label, id, obligatoire, aide, erreur, pleineLargeur, children }) {
  return (
    <div
      className={
        'champ-admin' +
        (pleineLargeur ? ' champ-admin--pleine-largeur' : '') +
        (erreur ? ' champ-admin--erreur' : '')
      }
    >
      <label className="champ-admin__label" htmlFor={id}>
        {label}
        {!obligatoire && <span>(facultatif)</span>}
      </label>
      {children}
      {aide && !erreur && <p className="champ-admin__aide">{aide}</p>}
      {erreur && <p className="champ-admin__message">{erreur}</p>}
    </div>
  );
}

export function ChampTexte({ label, id, obligatoire, aide, erreur, pleineLargeur, ...reste }) {
  return (
    <Champ
      label={label}
      id={id}
      obligatoire={obligatoire}
      aide={aide}
      erreur={erreur}
      pleineLargeur={pleineLargeur}
    >
      <input id={id} name={id} {...reste} />
    </Champ>
  );
}

export function ChampTexteLong({ label, id, obligatoire, aide, erreur, ...reste }) {
  return (
    <Champ label={label} id={id} obligatoire={obligatoire} aide={aide} erreur={erreur} pleineLargeur>
      <textarea id={id} name={id} {...reste} />
    </Champ>
  );
}

export function ChampSelection({
  label,
  id,
  options = [],
  groupes = null,
  vide,
  obligatoire,
  aide,
  erreur,
  pleineLargeur,
  ...reste
}) {
  return (
    <Champ
      label={label}
      id={id}
      obligatoire={obligatoire}
      aide={aide}
      erreur={erreur}
      pleineLargeur={pleineLargeur}
    >
      <select id={id} name={id} {...reste}>
        {vide !== undefined && <option value="">{vide}</option>}
        {groupes
          ? groupes.map((groupe) => (
              <optgroup key={groupe.libelle} label={groupe.libelle}>
                {groupe.options.map((option) => (
                  <option key={option.valeur} value={option.valeur}>
                    {option.label}
                  </option>
                ))}
              </optgroup>
            ))
          : options.map((option) => (
              <option key={option.valeur} value={option.valeur}>
                {option.label}
              </option>
            ))}
      </select>
    </Champ>
  );
}

export function ChampMontant({ label, id, devise = 'Ar', ...reste }) {
  return (
    <ChampTexte
      label={label}
      id={id}
      type="text"
      inputMode="decimal"
      placeholder="0"
      aide={`Montant en ${devise}, sans séparateur de milliers.`}
      {...reste}
    />
  );
}

export function optionsDepuisLibelles(libelles = {}, cles = null) {
  const source = cles ?? Object.keys(libelles);
  return source.map((cle) => ({ valeur: cle, label: libelles[cle] ?? cle }));
}

export function Modale({ ouverte, titre, sousTitre, onFermer, pied, large, erreur, children }) {
  useEffect(() => {
    if (!ouverte) return undefined;

    const surTouche = (evenement) => {
      if (evenement.key === 'Escape' && !evenement.defaultPrevented) onFermer();
    };
    document.addEventListener('keydown', surTouche);

    const debordementInitial = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', surTouche);
      document.body.style.overflow = debordementInitial;
    };
  }, [ouverte, onFermer]);

  if (!ouverte) return null;

  return createPortal(
    <div
      className="modale-fond"
      role="presentation"
      onMouseDown={(evenement) => {
        if (evenement.target === evenement.currentTarget) onFermer();
      }}
    >
      <div
        className={`modale${large ? ' modale--large' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={titre}
      >
        <header className="modale__entete">
          <div>
            <h2 className="modale__titre">{titre}</h2>
            {sousTitre && <p className="modale__sous-titre">{sousTitre}</p>}
          </div>
          <button type="button" className="modale__fermer" onClick={onFermer} aria-label="Fermer">
            <IconeCroix />
          </button>
        </header>

        <div className="modale__corps">
          {erreur && <Alerte>{erreur}</Alerte>}
          {children}
        </div>

        {pied && <footer className="modale__pied">{pied}</footer>}
      </div>
    </div>,
    document.body
  );
}

export function ModaleFormulaire({
  ouverte,
  titre,
  sousTitre,
  onFermer,
  onSoumettre,
  envoi = false,
  erreur,
  libelleValider = 'Enregistrer',
  large,
  actionGauche = null,
  children,
}) {
  return (
    <Modale
      ouverte={ouverte}
      titre={titre}
      sousTitre={sousTitre}
      onFermer={onFermer}
      erreur={erreur}
      large={large}
    >
      <form
        id="formulaire-modale"
        onSubmit={(evenement) => {
          evenement.preventDefault();
          onSoumettre(evenement);
        }}
      >
        {children}

        <div className="formulaire-actions">
          {actionGauche && <div className="formulaire-actions__gauche">{actionGauche}</div>}
          <button type="button" className="btn btn--neutre" onClick={onFermer} disabled={envoi}>
            Annuler
          </button>
          <button type="submit" className="btn btn--principal" disabled={envoi}>
            {envoi ? 'Enregistrement…' : libelleValider}
          </button>
        </div>
      </form>
    </Modale>
  );
}

export function ModaleConfirmation({
  ouverte,
  titre,
  message,
  onFermer,
  onConfirmer,
  envoi = false,
  erreur,
  libelleConfirmer = 'Confirmer',
  danger = false,
  actionSecondaire = null,
}) {
  return (
    <Modale
      ouverte={ouverte}
      titre={titre}
      onFermer={onFermer}
      erreur={erreur}
      pied={
        <>
          <button type="button" className="btn btn--neutre" onClick={onFermer} disabled={envoi}>
            Annuler
          </button>
          {actionSecondaire && (
            <button
              type="button"
              className="btn btn--danger"
              onClick={actionSecondaire.onAction}
              disabled={envoi}
            >
              {actionSecondaire.libelle}
            </button>
          )}
          <button
            type="button"
            className={`btn ${danger ? 'btn--danger' : 'btn--principal'}`}
            onClick={onConfirmer}
            disabled={envoi}
          >
            {envoi ? 'En cours…' : libelleConfirmer}
          </button>
        </>
      }
    >
      <p style={{ fontSize: '14.5px', lineHeight: 1.55, color: 'var(--admin-texte-doux)' }}>
        {message}
      </p>
    </Modale>
  );
}
