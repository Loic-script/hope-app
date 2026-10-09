import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

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
