import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    environmentMatchGlobs: [['src/test/api/**', 'node'], ['src/test/api-helpers.js', 'node']],
    setupFiles: ['src/test/setup.js'],
  },
})
