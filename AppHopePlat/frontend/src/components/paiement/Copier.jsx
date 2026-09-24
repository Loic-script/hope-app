import { useEffect, useState } from 'react';

/**
 * Un bouton "Copier" pour une coordonnee de paiement (RIB, IBAN, motif,
 * numero). Il dit "Copie" un instant, et l'annonce aux lecteurs d'ecran.
 *
 * Le presse-papiers peut etre refuse (page non securisee, navigateur
 * ancien) : la valeur reste alors affichee et selectionnable a la main.
 */
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
      /* la valeur reste lisible et selectionnable */
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
