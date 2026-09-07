import { useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';

import * as authService from '../services/auth.service.js';
import { URL_API } from '../services/api.js';

/**
 * Page de confirmation de connexion.
 *
 * Volontairement minimaliste : elle ne sert qu'a prouver que la chaine
 * complete fonctionne (React -> API Node -> PostgreSQL -> bcrypt -> JWT).
 * Le tableau de bord sera developpe dans une etape ulterieure.
 *
 * L'acces est controle en amont par RequireAuth, qui appelle
 * GET /api/admin/me avant d'afficher quoi que ce soit.
 */
export default function AdminLoginSuccess() {
  const navigate = useNavigate();
  const { admin } = useOutletContext();
  const [deconnexionEnCours, setDeconnexionEnCours] = useState(false);

  async function seDeconnecter() {
    setDeconnexionEnCours(true);
    await authService.deconnecter();
    navigate('/admin/login', { replace: true });
  }

  return (
    <main className="succes">
      <div className="succes__contenu">
        <div className="succes__pastille">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="m4.5 12.5 5 5 10-11"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        <h1 className="succes__titre">LOGIN SUCCESS</h1>

        <p className="succes__bienvenue">Bienvenue {admin?.adminLog ?? 'AdminHope'}</p>
        <p className="succes__message">Connexion administrateur réussie.</p>

        <div className="succes__details">
          <dl>
            <dt>Identifiant</dt>
            <dd>{admin?.adminLog ?? '-'}</dd>

            <dt>ID en base</dt>
            <dd>{admin?.id ?? '-'}</dd>

            <dt>Vérifié par</dt>
            <dd>GET {URL_API}/admin/me</dd>

            <dt>Chaîne validée</dt>
            <dd>React → API Node → PostgreSQL → bcrypt → JWT</dd>
          </dl>
        </div>

        <button
          type="button"
          className="succes__deconnexion"
          onClick={seDeconnecter}
          disabled={deconnexionEnCours}
        >
          {deconnexionEnCours ? 'Déconnexion…' : 'Se déconnecter'}
        </button>
      </div>
    </main>
  );
}
