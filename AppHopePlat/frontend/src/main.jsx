import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import App from './App.jsx';

// Feuilles de style globales, chargees une seule fois.
import './styles/theme.css';
import './styles/hope-logo.css';
import './styles/redirection.css';
import './styles/admin-login.css';
// Apres admin-login.css : l'espace benevole reprend sa carte de
// connexion et en ajuste quelques regles.
import './styles/benevole.css';
// Apres admin-login.css : la porte unique des utilisateurs reprend sa
// coquille et en ajuste quelques regles.
import './styles/authentification.css';
import './styles/login-success.css';
import './styles/admin.css';
import './styles/admin-entete.css';
import './styles/admin-modules.css';
import './styles/admin-publications.css';
import './styles/admin-media.css';
import './styles/admin-actualites.css';
import './styles/admin-messagerie.css';
import './styles/messagerie.css';
// Apres admin.css : l'espace benevole connecte reprend ses variables
// (--admin-*), ses boutons et son tableau.
import './styles/benevole-espace.css';
import './styles/mes-taches.css';
import './styles/bailleur.css';
import './styles/fiche-projet.css';
import './styles/donateur-espace.css';
import './styles/feuille.css';
import './styles/parcours-donateur.css';
import './styles/paiement-mvola.css';
import './styles/paiement-orange-money.css';
import './styles/paiement-carte.css';
import './styles/paiement-virement.css';
import './styles/paiement-depot.css';
import './styles/paiement-especes.css';
import './styles/paiement-international.css';
import './styles/paiement-plateforme.css';
import './styles/parcours-benevole.css';
import './styles/choix-page.css';
import './styles/legal.css';
import './styles/securite-compte.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);
