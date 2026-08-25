import { defineConfig } from 'vite';

export default defineConfig({
  server: { host: '0.0.0.0', port: 8082, open: false },
  build: {
    outDir: 'dist',
    target: 'esnext',
    rollupOptions: { input: './index.html' },
  },
  esbuild: { target: 'esnext' },
  optimizeDeps: { esbuildOptions: { target: 'esnext' } },
  base: './',
});
