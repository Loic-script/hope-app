import silhouette from '../assets/hope-madagascar.png';

/**
 * Silhouette de Madagascar, motif decoratif du bas du panneau d'illustration.
 *
 * Le trace est repris de la maquette HOPE (image detouree en transparence),
 * plutot qu'approxime a la main : le contour reste fidele au pays.
 * Purement graphique, donc masquee aux lecteurs d'ecran.
 */
export default function MadagascarSilhouette({ className = '' }) {
  return <img className={className} src={silhouette} alt="" aria-hidden="true" />;
}
