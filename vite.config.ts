import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import react from '@vitejs/plugin-react';
import legacy from '@vitejs/plugin-legacy';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import solidPlugin from 'vite-plugin-solid';
import { resolve } from 'path';

// ...existing code...
// New Vite configuration enabling multi-framework compilation and PostCSS/Tailwind
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
      vue(),
      svelte(),
      solidPlugin(),
      legacy({
        targets: ['defaults', 'not IE 11'],
      }),
    ],
    css: {
      postcss: {
        plugins: [
          require('tailwindcss'),
          require('autoprefixer'),
        ],
      },
      preprocessorOptions: {
        scss: { /* ...existing code... */ },
        less: { /* ...existing code... */ },
      },
    },
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
      port: 5173,
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