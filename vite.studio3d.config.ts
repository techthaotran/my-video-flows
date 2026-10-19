import { defineConfig } from 'vite';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));

/** Studio 3D chạy như trang web dev độc lập (không qua @crxjs, không nằm trong extension). */
export default defineConfig({
  root: resolve(root, 'studio3d'),
  publicDir: resolve(root, 'studio3d/public'),
  resolve: { alias: { '@': resolve(root, 'src') } },
  server: { host: '127.0.0.1', port: 5002, strictPort: true, hmr: { host: '127.0.0.1' }, fs: { allow: [root] } },
});
