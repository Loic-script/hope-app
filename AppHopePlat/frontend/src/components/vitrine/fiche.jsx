import { Link } from 'react-router-dom';

/**
 * Ce que partagent les fiches du site (un projet, une actualite) : le
 * texte libre en paragraphes, et la page quand la fiche manque.
 */

/** Un texte libre, un paragraphe par retour a la ligne. */
export function Paragraphes({ texte }) {
  return texte
    .split(/\r?\n+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p, i) => <p key={i}>{p}</p>);
}

/** La fiche est introuvable, ou ne se charge pas : le dire, et proposer la liste. */
export function MessageFiche({ titre, texte, retour, libelleRetour }) {
  return (
    <section className="realisation__message" aria-labelledby="realisation-message-titre">
      <h1 id="realisation-message-titre">{titre}</h1>
      <p>{texte}</p>
      <Link to={retour} className="v-bouton-contour">
        {libelleRetour}
      </Link>
    </section>
  );
}
