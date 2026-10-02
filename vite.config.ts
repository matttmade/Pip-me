/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  // three.js lives in its own lazy chunk (~600 kB); the main bundle stays small.
  build: { chunkSizeWarningLimit: 700 },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
  },
})
