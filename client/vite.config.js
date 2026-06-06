import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],

  // ---------------------------------------------------------------------------
  // Vitest configuration — frontend unit tests
  // ---------------------------------------------------------------------------
  test: {
    // Use jsdom to simulate a browser environment
    environment: 'jsdom',

    // Import jest-dom matchers globally in every test file
    setupFiles: ['./src/tests/setup.js'],

    // Allow describe/it/expect etc. without explicit imports
    globals: true,

    coverage: {
      provider: 'v8',
      include: ['src/**/*.{js,jsx}'],
      exclude: ['src/tests/**', 'src/main.jsx']
    }
  },

  server: {
    port: 3000
  },

  build: {
    // Raise warning threshold slightly — our budget is ~700 KB pre-split
    chunkSizeWarningLimit: 600,

    rollupOptions: {
      output: {
        // Vendor code-split: separate heavy third-party libraries from app code
        manualChunks: {
          // React ecosystem
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          // Animation & drag
          'vendor-motion': ['framer-motion', '@hello-pangea/dnd'],
          // Network & realtime
          'vendor-io': ['axios', 'socket.io-client'],
          // Security / sanitize
          'vendor-purify': ['dompurify']
        }
      }
    }
  }
});
