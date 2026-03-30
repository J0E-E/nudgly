import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Allow access from Docker network and ngrok tunnel
    host: true,
    allowedHosts: ['joey-dev.ngrok.app'],
    // HMR through nginx proxy
    hmr: {
      clientPort: parseInt(process.env.VITE_HMR_CLIENT_PORT || '9000'),
    },
    // Enable polling so file changes on Windows propagate into Docker containers
    watch: {
      usePolling: true,
      interval: 1000,
    },
  },
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: './src/test/setup.ts',
    pool: 'threads',
  },
})
