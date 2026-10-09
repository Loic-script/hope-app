export const FILTRES_FIL = [
  { cle: 'tout', label: 'Tout' },
  { cle: 'projet', label: 'Projets' },
  { cle: 'actualite', label: 'Actualités' },
];

function horodatage(valeur) {
  const temps = valeur ? new Date(valeur).getTime() : Number.NaN;
  return Number.isNaN(temps) ? 0 : temps;
}

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
