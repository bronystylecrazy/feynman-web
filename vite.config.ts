import { defineConfig, loadEnv } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { createBridge } from './server/bridge.mjs';

export default defineConfig(({ mode }) => ({
  plugins: [
    svelte(),
    {
      name: 'feynman-local-bridge',
      configureServer(server) {
        server.middlewares.use(
          createBridge({ ...loadEnv(mode, process.cwd(), ''), ...process.env }),
        );
      },
    },
  ],
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
}));
