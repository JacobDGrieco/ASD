import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: process.env.VITE_API_PROXY_TARGET || 'http://127.0.0.1:3000',
        changeOrigin: true,
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    environmentMatchGlobs: [['src/test/api/**', 'node'], ['src/test/api-helpers.js', 'node']],
    setupFiles: ['src/test/setup.js'],
  },
})
