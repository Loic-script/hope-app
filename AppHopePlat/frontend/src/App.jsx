import { BrowserRouter } from 'react-router-dom';

import AppRoutes from './routes/index.jsx';

/** Racine de l'application HOPE : installe le routeur puis les routes. */
export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
