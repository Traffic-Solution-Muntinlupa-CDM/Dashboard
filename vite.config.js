import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import process from 'node:process'

// The deployed Pi controller sends no CORS headers, so the browser talks to it
// through this proxy under /pi. Point VITE_PI_URL at the Pi (or at the local
// mock controller) and every page stays same-origin — including PUT /config.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const target = env.VITE_PI_URL || 'http://127.0.0.1:8080'

  const proxy = {
    '/pi': {
      target,
      changeOrigin: true,
      rewrite: (path) => path.replace(/^\/pi/, ''),
    },
  }

  return {
    base: process.env.FIGMA ? '/' : '/Dashboard/',
    plugins: [react()],
    server: { proxy },
    preview: { proxy },
  }
})
