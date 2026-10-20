/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

/** Where the dev server forwards `/api` – the backend from `cargo run`. */
const backend = process.env.TEAGAN_BACKEND ?? 'http://localhost:3000'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: { '/api': backend },
  },
  test: {
    include: ['src/**/*.test.ts'],
  },
})
