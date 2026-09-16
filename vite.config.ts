import { copyFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * Clean URLs (/menu instead of /#/menu) need the host to serve index.html for
 * unknown paths. Static hosts such as GitHub Pages do that via 404.html.
 */
function spaFallback(): Plugin {
  return {
    name: 'spa-fallback',
    apply: 'build',
    closeBundle() {
      const dist = resolve(fileURLToPath(new URL('.', import.meta.url)), 'dist')
      copyFileSync(resolve(dist, 'index.html'), resolve(dist, '404.html'))
    }
  }
}

export default defineConfig({
  // '/' locally; the Pages workflow builds with BASE_PATH=/mc-test/ for the project site.
  base: process.env.BASE_PATH ?? '/',
  plugins: [react(), spaFallback()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) }
  },
  server: { port: 5180, strictPort: true },
  preview: { port: 5181, strictPort: true },
  build: {
    target: 'es2022',
    outDir: 'dist',
    emptyOutDir: true,
    // WharfKit is imported dynamically (src/wallet/session.ts) and split by Rollup on its own. A forced
    // manual chunk would also collect shared helpers the entry needs and load the wallet at startup.
    chunkSizeWarningLimit: 700
  }
})
