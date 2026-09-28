/**
 * L'attente d'une page chargee a la demande : chaque espace n'embarque
 * ses ecrans qu'au moment d'y entrer. Discrete, dans la zone de contenu --
 * le menu et l'en-tete de l'espace restent en place.
 */
export default function ChargementPage() {
  return (
    <div className="chargement-page" role="status" aria-live="polite">
      <span className="chargement-page__rotation" aria-hidden="true" />
      <span className="sr-only">Chargement de la page…</span>
    </div>
  );
}
