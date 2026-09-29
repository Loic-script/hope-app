import { useId } from 'react';

/**
 * Le champ de recherche des listes du site : un champ et son bouton
 * orange, d'un seul tenant. La liste se filtre au fil de la frappe
 * (recherche.js) ; le bouton ne fait que valider.
 */
export default function Recherche({ valeur, onChange, libelle = 'Rechercher' }) {
  const id = useId();
  return (
    <form className="v-recherche" role="search" onSubmit={(e) => e.preventDefault()}>
      <label htmlFor={id} className="sr-only">
        {libelle}
      </label>
      <input
        id={id}
        className="v-recherche__champ"
        type="search"
        placeholder="Rechercher..."
        autoComplete="off"
        value={valeur}
        onChange={(e) => onChange(e.target.value)}
      />
      <button type="submit" className="v-recherche__bouton" aria-label={libelle}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="10.5" cy="10.5" r="6.5" />
          <path d="m15.5 15.5 5 5" />
        </svg>
      </button>
    </form>
  );
}
