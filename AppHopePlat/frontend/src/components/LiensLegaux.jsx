import { Link } from 'react-router-dom';

/**
 * Les deux textes qui encadrent l'usage de HOPE, en pied des pages
 * publiques (connexion, inscription, mot de passe oublie).
 */
export default function LiensLegaux({ className = '' }) {
  return (
    <nav className={`liens-legaux ${className}`.trim()} aria-label="Informations légales">
      <Link to="/conditions-utilisation">Conditions d’utilisation</Link>
      <span aria-hidden="true">·</span>
      <Link to="/confidentialite">Confidentialité</Link>
    </nav>
  );
}
