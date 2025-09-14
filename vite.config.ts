import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig(({ mode }) => {
  const isDev = mode === 'development';
  return {
    root: '.',
    base: './',
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
      },
    },
    plugins: [
      react(),
    ],
    build: {
      outDir: 'dist',
      sourcemap: isDev,
      rollupOptions: {
        output: {
          assetFileNames: 'assets/[name]-[hash][extname]',
          chunkFileNames: 'assets/[name]-[hash].js',
          entryFileNames: 'assets/[name]-[hash].js',
        }
      },
      target: 'es2019',
      assetsInlineLimit: 4096,
    },
    server: {
      port: 8080,
      open: false,
      fs: {
        strict: false,
      },
    },
    optimizeDeps: {
      esbuildOptions: {
        target: 'es2019',
      }
    },
    css: {
      // Force inline PostCSS config so Vite doesn't try to load postcss.config.js (ESM-incompatible here)
      postcss: {
        plugins: []
      }
    }
  };
});