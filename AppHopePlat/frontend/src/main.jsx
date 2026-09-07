import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import App from './App.jsx';

// Feuilles de style globales, chargees une seule fois.
import './styles/theme.css';
import './styles/hope-logo.css';
import './styles/admin-login.css';
import './styles/login-success.css';
import './styles/admin.css';
import './styles/admin-entete.css';
import './styles/admin-modules.css';
import './styles/admin-publications.css';
import './styles/admin-media.css';
import './styles/admin-messagerie.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);
