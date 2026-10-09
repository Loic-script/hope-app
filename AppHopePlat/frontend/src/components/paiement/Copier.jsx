import { useEffect, useState } from 'react';

export default function Copier({ valeur, libelle, className = '', texte = 'Copier', fait = 'Copié' }) {
  const [copie, setCopie] = useState(false);

  useEffect(() => {
    if (!copie) return undefined;
    const minuterie = setTimeout(() => setCopie(false), 1800);
    return () => clearTimeout(minuterie);
  }, [copie]);

  async function copier() {
    try {
      await navigator.clipboard.writeText(String(valeur));
      setCopie(true);
    } catch {
    }
  }

  return (
    <>
      <button
        type="button"
        className={`${className}${copie ? ` ${className}--fait` : ''}`}
        onClick={copier}
        aria-label={`Copier : ${libelle}`}
      >
        {copie ? fait : texte}
      </button>
      <span className="sr-only" aria-live="polite">
        {copie ? `${libelle} copié` : ''}
      </span>
    </>
  );
}
