import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    // ✅ Add this small plugin — rewrites /terms → /terms.html during dev
    {
      name: 'html-routes',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          const cleanUrl = req.url.replace(/\/$/, '');
          if (cleanUrl === '/terms') req.url = '/terms.html';
          else if (cleanUrl === '/privacy') req.url = '/privacy.html';
          else if (cleanUrl === '/support') req.url = '/support.html';
          next();
        });
      }
    }
  ],
  root: '.',
  publicDir: 'public',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/.netlify/functions': {
        target: 'http://localhost:8888',
        changeOrigin: true,
      },
    },
  },
});