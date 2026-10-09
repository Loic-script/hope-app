import { useId } from 'react';

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
