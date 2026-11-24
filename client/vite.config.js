import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const api = process.env.VITE_API_URL || 'http://localhost:5000';
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy: { '/api': api, '/socket.io': { target: api, ws: true } } },
});
