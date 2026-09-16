/** Statut d'une tache. */
export const STATUTS_TACHE = {
  a_faire: 'À faire',
  en_cours: 'En cours',
  livree: 'Livrée',
};

/** Une pastille de statut, quel que soit le domaine. */
export function Pastille({ valeur, libelles, teinte }) {
  return (
    <span className={`pastille pastille--${teinte ?? 'gris'}`}>
      {libelles?.[valeur] ?? valeur}
    </span>
  );
}
