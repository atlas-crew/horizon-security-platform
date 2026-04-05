import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5180,
    // Avoid "random port" fallbacks that silently break CORS expectations.
    strictPort: true,
    proxy: {
      // Only proxy the API namespace; do not catch UI routes like "/api-intelligence".
      '/api/v1': {
        target: 'http://localhost:3100',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:3100',
        ws: true,
      },
    },
  },
  // `vite preview` defaults to 4173; keep it aligned with dev/docs (5180).
  preview: {
    port: 5180,
    strictPort: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: !process.env.VITE_DEMO_MODE,
  },
});
