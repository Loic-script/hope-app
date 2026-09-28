/**
 * Le fil d'actualite des espaces benevole et bailleur : les projets et
 * les actualites de HOPE dans un meme fil, avec trois filtres.
 */

/** Les filtres du fil, dans leur ordre d'affichage. */
export const FILTRES_FIL = [
  { cle: 'tout', label: 'Tout' },
  { cle: 'projet', label: 'Projets' },
  { cle: 'actualite', label: 'Actualités' },
];

/** Une date lisible, ou 0 : un element sans date passe en fin de fil. */
function horodatage(valeur) {
  const temps = valeur ? new Date(valeur).getTime() : Number.NaN;
  return Number.isNaN(temps) ? 0 : temps;
}

/**
 * Les elements du fil, selon le filtre.
 *
 * "Tout" melange projets et actualites du plus recent au plus ancien : un
 * projet se date de son lancement, une actualite de sa publication.
 * "Projets" et "Actualites" gardent l'ordre de l'API -- chez le bailleur,
 * les projets qu'il finance d'abord.
 *
 * @param {object[]} projets
 * @param {object[]} actualites
 * @param {string} filtre  'tout', 'projet' ou 'actualite'
 * @returns {{ type: 'projet'|'actualite', cle: string, element: object }[]}
 */
export function elementsDuFil(projets, actualites, filtre) {
  const deProjets = projets.map((projet) => ({
    type: 'projet',
    cle: `projet-${projet.id}`,
    date: horodatage(projet.startDate ?? projet.createdAt),
    element: projet,
  }));
  const dActualites = actualites.map((publication) => ({
    type: 'actualite',
    cle: `actualite-${publication.id}`,
    date: horodatage(publication.publieLe),
    element: publication,
  }));

  if (filtre === 'projet') return deProjets;
  if (filtre === 'actualite') return dActualites;
  return [...deProjets, ...dActualites].sort((a, b) => b.date - a.date);
}

/**
 * Les trois filtres, en pastilles. Chacun dit combien il porte
 * d'elements : on sait avant de cliquer s'il y a quelque chose a lire.
 */
export function FiltresFil({ actif, onChange, compteurs }) {
  return (
    <div className="filtres filtres-fil" role="group" aria-label="Filtrer le fil">
      {FILTRES_FIL.map(({ cle, label }) => (
        <button
          key={cle}
          type="button"
          aria-pressed={actif === cle}
          className={`filtres__bouton${actif === cle ? ' filtres__bouton--actif' : ''}`}
          onClick={() => onChange(cle)}
        >
          {label}
          <span className="filtres-fil__compte">{compteurs[cle] ?? 0}</span>
        </button>
      ))}
    </div>
  );
}
