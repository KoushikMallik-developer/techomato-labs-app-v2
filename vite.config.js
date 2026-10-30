import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  build: {
    rollupOptions: {
      // Firebase is big and changes rarely: its own file stays cached across deploys of app code.
      output: { manualChunks: { firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/app-check'] } },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    // Dummy values so firebase.js can initialise (without network) in tests that don't mock it.
    env: { VITE_FIREBASE_API_KEY: 'test-key', VITE_FIREBASE_PROJECT_ID: 'test', VITE_FIREBASE_APP_ID: 'test' },
    setupFiles: ['./src/setupTests.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'json-summary'],
      include: ['src/**/*.{js,jsx}'],
      exclude: ['src/**/*.test.{js,jsx}', 'src/setupTests.js', 'src/main.jsx', 'src/test-utils.jsx'],
    },
  },
});
