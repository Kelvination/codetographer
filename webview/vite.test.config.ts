import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

// Vite config for standalone test builds
export default defineConfig({
  plugins: [react()],
  root: __dirname,
  build: {
    outDir: '../test-output/app',
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(__dirname, 'test.html'),
      output: {
        entryFileNames: 'main.js',
        chunkFileNames: '[name].js',
        assetFileNames: '[name].[ext]',
      },
    },
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
});
