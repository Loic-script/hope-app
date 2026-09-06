import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Configuration Vite du frontend HOPE.
// Le port 5173 est celui autorise par la configuration CORS du backend.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    open: false,
  },
});
