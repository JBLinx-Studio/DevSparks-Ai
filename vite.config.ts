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
        'app': resolve(__dirname, 'app.js'),
        'chatManager': resolve(__dirname, 'chatManager.js'),
        'githubManager': resolve(__dirname, 'githubManager.js'),
        'previewManager': resolve(__dirname, 'previewManager.js'),
        'fileManager': resolve(__dirname, 'fileManager.js'),
        'buildManager': resolve(__dirname, 'buildManager.js'),
        'projectManager': resolve(__dirname, 'projectManager.js'),
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
    }
  };
});