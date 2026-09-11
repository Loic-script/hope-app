import { Link } from 'react-router-dom';

/**
 * Page d'entree du site.
 *
 * Deux portes, et non quatre : l'administration d'un cote, les
 * utilisateurs de l'autre. Donateur, benevole et bailleur passent par le
 * meme formulaire, qui leur demande ce qu'ils viennent faire -- leur
 * proposer trois boutons ici puis reposer la question ensuite serait
 * demander deux fois la meme chose.
 */
export default function Redirection() {
  return (
    <main className="redirection">
      <h1 className="redirection__titre">Espace de redirection</h1>

      <nav className="redirection__choix" aria-label="Choix de l’espace">
        <Link className="redirection__lien" to="/admin/login">
          Admin
        </Link>
        <Link
          className="redirection__lien redirection__lien--utilisateur"
          to="/authentification"
        >
          Donateur, bénévole ou bailleur
        </Link>
      </nav>
    </main>
  );
}
