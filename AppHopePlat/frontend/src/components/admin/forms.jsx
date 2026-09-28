/**
 * Champs de formulaire et modale de l'espace administrateur.
 *
 * Les regles de saisie restent volontairement legeres cote navigateur : le
 * backend reste la source de verite. Ces composants servent surtout a
 * afficher les messages qu'il renvoie.
 */
import { useEffect } from 'react';
import { createPortal } from 'react-dom';

import { IconeCroix } from './AdminIcons.jsx';
import { Alerte } from './ui.jsx';

/* ------------------------------------------------------------------
   Champs
   ------------------------------------------------------------------ */

/**
 * @param {{ label: string, id: string, obligatoire?: boolean, aide?: string,
 *           erreur?: string, pleineLargeur?: boolean, children: React.ReactNode }} props
 */
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

/** Champ texte, nombre ou date. */
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

/** Zone de texte multiligne. */
export function ChampTexteLong({ label, id, obligatoire, aide, erreur, ...reste }) {
  return (
    <Champ label={label} id={id} obligatoire={obligatoire} aide={aide} erreur={erreur} pleineLargeur>
      <textarea id={id} name={id} {...reste} />
    </Champ>
  );
}

/**
 * Liste deroulante.
 * @param {{ options: {valeur: string|number, label: string}[], vide?: string }} props
 */
export function ChampSelection({
  label,
  id,
  options = [],
  // Des options rangees par famille : [{ libelle, options }]. Le
  // navigateur les presente en sections, dans la liste comme dans la
  // roue d un telephone.
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

/** Champ de montant : saisie libre, controle final cote backend. */
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

/** Transforme un dictionnaire de libelles en options de <select>. */
export function optionsDepuisLibelles(libelles = {}, cles = null) {
  const source = cles ?? Object.keys(libelles);
  return source.map((cle) => ({ valeur: cle, label: libelles[cle] ?? cle }));
}

/* ------------------------------------------------------------------
   Modale
   ------------------------------------------------------------------ */

/**
 * Fenetre modale. Le rendu passe par un portail pour ne pas etre limite
 * par le defilement ou le rognage de la zone de contenu.
 *
 * @param {{ ouverte: boolean, titre: string, sousTitre?: string,
 *           onFermer: Function, pied?: React.ReactNode, large?: boolean,
 *           erreur?: string, children: React.ReactNode }} props
 */
export function Modale({ ouverte, titre, sousTitre, onFermer, pied, large, erreur, children }) {
  // Fermeture au clavier et blocage du defilement de la page derriere.
  useEffect(() => {
    if (!ouverte) return undefined;

    const surTouche = (evenement) => {
      // Un champ qui a deja traite Echap (une liste deroulante qui se
      // referme) le signale : la fenetre, elle, reste ouverte.
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
        // Un clic sur le fond ferme ; un clic dans la carte ne ferme pas.
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

/**
 * Modale portant un formulaire : gere la soumission et les boutons.
 *
 * @param {{ onSoumettre: Function, envoi?: boolean, libelleValider?: string }} props
 */
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
  // Une action a gauche du pied, a l'ecart des deux autres : "Supprimer",
  // quand la fenetre modifie un element existant.
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

/**
 * Modale de confirmation pour une action courte (archiver, annuler,
 * supprimer). Conforme a la section 46 du cahier des charges : petites
 * actions en modale, actions complexes sur une page dediee.
 */
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
