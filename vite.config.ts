import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { crx } from '@crxjs/vite-plugin';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import manifest from './manifest.config';

const root = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react(), crx({ manifest })],
  resolve: {
    alias: {
      '@': resolve(root, 'src'),
    },
  },
  build: {
    rollupOptions: {
      input: {
        sidepanel: resolve(root, 'src/pages/sidepanel/index.html'),
        editor: resolve(root, 'src/pages/editor/index.html'),
        runner: resolve(root, 'src/pages/runner/index.html'),
        offscreen: resolve(root, 'src/pages/offscreen/index.html'),
      },
    },
  },
  server: {
    host: '127.0.0.1',
    port: 5001,
    strictPort: true,
    // Bắt buộc: cho phép chrome-extension:// import module từ Vite (SW / content / side panel)
    cors: {
      origin: true,
    },
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': '*',
    },
    hmr: {
      host: '127.0.0.1',
      port: 5001,
      protocol: 'ws',
    },
  },
});
