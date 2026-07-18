import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    // Spotify requires HTTPS or the 127.0.0.1 loopback for redirect URIs,
    // so develop against http://127.0.0.1:5173/ (not localhost).
    host: '127.0.0.1',
    port: 5173,
  },
});
