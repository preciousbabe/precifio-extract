const { defineConfig } = require('vite');
const react = require('@vitejs/plugin-react');
const path = require('path');

module.exports = defineConfig({
  plugins: [
    react(),
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
    host: true,        // ← ADD THIS
    port: 5173,
    strictPort: true,
    proxy: {
      '/.netlify/functions': {
        target: 'http://localhost:8888',
        changeOrigin: true,
      },
    },
  },
});