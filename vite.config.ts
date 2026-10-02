/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  // three.js and maplibre-gl live in their own lazy chunks; the main bundle stays small.
  build: { chunkSizeWarningLimit: 1100 },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
  },
})
