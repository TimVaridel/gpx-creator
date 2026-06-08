import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { cloudflare } from "@cloudflare/vite-plugin";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), cloudflare()],
  server: {
    proxy: {
      '/api/nominatim': {
        target: 'https://nominatim.openstreetmap.org',
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            const url = new URL(req.url ?? '', 'http://localhost');
            const lat = url.searchParams.get('lat');
            const lon = url.searchParams.get('lon');
            const q = url.searchParams.get('q');

            if (lat && lon) {
              proxyReq.path = '/reverse' + url.search;
            } else if (q) {
              proxyReq.path = '/search' + url.search;
            }

            proxyReq.setHeader('User-Agent', 'GPX-Creator-App/1.0');
            proxyReq.setHeader('Accept-Language', 'fr');
          });
        },
      },
    },
  },
})