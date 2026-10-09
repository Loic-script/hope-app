import { Link } from 'react-router-dom';

export default function Redirection() {
  return (
    <main className="redirection">
      <h1 className="redirection__titre">Espace de redirection</h1>

      <nav className="redirection__choix" aria-label="Choix de l’espace">
        <Link className="redirection__lien" to="/authentification?type=aucun">
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
