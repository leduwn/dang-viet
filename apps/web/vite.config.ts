import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  const rootDir = path.resolve(__dirname, '../..');
  const env = loadEnv(mode, rootDir, '');
  const backendPort = process.env.PORT || env.PORT || '3088';
  const backendHost = process.env.HOST || env.HOST || '127.0.0.1';

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@dangviet/contracts': path.resolve(__dirname, '../../packages/contracts/src/index.ts'),
        '@dangviet/domain': path.resolve(__dirname, '../../packages/domain/src/index.ts'),
      },
    },
    server: {
      port: 5188,
      strictPort: true,
      host: '127.0.0.1',
      proxy: {
        '/api': {
          target: `http://${backendHost}:${backendPort}`,
          changeOrigin: true,
        },
      },
    },
  };
});
