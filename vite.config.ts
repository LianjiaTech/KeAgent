import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

const isTest = !!process.env.VITEST;

// https://vitejs.dev/config/
export default defineConfig(async () => {
  // Electron plugins are only needed for dev/build, not for unit tests.
  // Dynamic import prevents vite-plugin-electron from loading in test mode.
  const electronPlugins = isTest
    ? []
    : await (async () => {
        const { default: electron } = await import('vite-plugin-electron');
        const { default: renderer } = await import('vite-plugin-electron-renderer');
        return [
          electron([
            {
              // Main process entry file
              entry: 'electron/main/index.ts',
              onstart(options) {
                options.startup();
              },
              vite: {
                build: {
                  outDir: 'dist-electron/main',
                  rollupOptions: {
                    external: ['electron-store', 'electron-updater', 'ws'],
                  },
                },
              },
            },
            {
              // Preload scripts entry file
              entry: 'electron/preload/index.ts',
              onstart(options) {
                options.reload();
              },
              vite: {
                build: {
                  outDir: 'dist-electron/preload',
                  rollupOptions: {
                    external: ['electron'],
                  },
                },
              },
            },
          ]),
          renderer(),
        ];
      })();

  return {
    // Required for Electron: all asset URLs must be relative because the renderer
    // loads via file:// in production. vite-plugin-electron-renderer sets this
    // automatically, but we declare it explicitly so the intent is clear and the
    // build remains correct even if plugin order ever changes.
    base: './',
    plugins: [react(), ...electronPlugins],
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
        '@electron': resolve(__dirname, 'electron'),
      },
    },
    server: {
      port: 5173,
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['./tests/setup.ts'],
      include: ['tests/**/*.{test,spec}.{ts,tsx}'],
      coverage: {
        reporter: ['text', 'json', 'html'],
        exclude: ['node_modules/', 'tests/'],
      },
    },
  };
});
