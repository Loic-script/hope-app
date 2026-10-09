import { Link } from 'react-router-dom';

export function Paragraphes({ texte }) {
  return texte
    .split(/\r?\n+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p, i) => <p key={i}>{p}</p>);
}

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
