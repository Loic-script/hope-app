import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Configuration Vite du frontend HOPE.
// Le port 5173 est celui autorise par la configuration CORS du backend.

/*
 * Le backend, que le serveur de developpement relaie.
 *
 * Le navigateur appelle "/api" et "/media" sur l'adresse meme de la page,
 * et Vite transmet au backend. Sans ce relais, la page appelait
 * "http://localhost:3000" : sur l'ordinateur, c'est bien le backend ; sur
 * un telephone qui ouvre la page par le reseau, "localhost" designe le
 * telephone lui-meme -- rien ne se chargeait, et la liste des types
 * d'utilisateur restait vide.
 */
const BACKEND = process.env.HOPE_BACKEND ?? 'http://localhost:3000';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    open: false,
    proxy: {
      '/api': BACKEND,
      '/media': BACKEND,
    },
  },
});
