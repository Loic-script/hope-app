import { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';

import * as authService from '../services/auth.service.js';

/**
 * Garde de route : protege les pages reservees a l'administrateur connecte.
 *
 * On ne se contente pas de constater la presence d'un jeton dans le
 * navigateur : le jeton est soumis au backend via GET /api/admin/me. C'est
 * lui qui verifie la signature, l'expiration et l'existence du compte. Sans
 * confirmation du serveur, l'utilisateur est renvoye vers /admin/login.
 */
export default function RequireAuth() {
  const emplacement = useLocation();
  // 'verification' -> 'authentifie' -> ou 'refuse'
  const [etat, setEtat] = useState('verification');
  const [admin, setAdmin] = useState(null);

  useEffect(() => {
    let annule = false;

    async function verifier() {
      if (!authService.lireJeton()) {
        if (!annule) setEtat('refuse');
        return;
      }

      try {
        const profil = await authService.recupererProfil();
        if (annule) return;
        setAdmin(profil);
        setEtat('authentifie');
      } catch {
        if (annule) return;
        authService.effacerSession();
        setEtat('refuse');
      }
    }

    verifier();

    return () => {
      annule = true;
    };
  }, []);

  if (etat === 'verification') {
    return (
      <div className="verification" role="status" aria-live="polite">
        <span className="verification__rotation" aria-hidden="true" />
        <p>Vérification de la session…</p>
      </div>
    );
  }

  if (etat === 'refuse') {
    return <Navigate to="/admin/login" replace state={{ depuis: emplacement.pathname }} />;
  }

  return <Outlet context={{ admin }} />;
}
