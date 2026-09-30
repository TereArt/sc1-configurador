import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Modo normal: un solo HTML con todo incluido (para hosting / Wix).
// Modo "artifact": HTML + archivos JS/CSS separados (la demo en Claude altera el JS incrustado en el HTML).
export default defineConfig(({ mode }) =>
  mode === 'artifact'
    ? {
        plugins: [react()],
        base: './',
        build: {
          outDir: 'dist-artifact',
          chunkSizeWarningLimit: 4000,
          rollupOptions: { output: { entryFileNames: 'assets/app.js', assetFileNames: 'assets/[name][extname]' } },
        },
      }
    : {
        plugins: [react(), viteSingleFile()],
        build: { outDir: 'dist', assetsInlineLimit: 100000000, chunkSizeWarningLimit: 4000 },
      }
);
