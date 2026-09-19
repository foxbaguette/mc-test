import { copyFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

import { ATOMIC_NODES, AW_IMAGE_URL, HISTORY_NODES, RPC_NODES } from './src/chain/config'

/**
 * Clean URLs (/menu instead of /#/menu) need the host to serve index.html for
 * unknown paths. Static hosts such as GitHub Pages do that via 404.html.
 */
function spaFallback(): Plugin {
  let outDir = 'dist'
  return {
    name: 'spa-fallback',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir)
    },
    closeBundle() {
      copyFileSync(resolve(outDir, 'index.html'), resolve(outDir, '404.html'))
    }
  }
}

/**
 * Content Security Policy, as a <meta> tag because GitHub Pages cannot send headers. Scripts may
 * only come from the site itself (and wallet browser extensions, which inject their own); every
 * connection must go to a known chain, AtomicAssets, history, news or wallet host. Production
 * builds only: the dev server relies on inline scripts for hot reloading.
 */
function contentSecurityPolicy(): Plugin {
  const connect = [
    "'self'",
    ...RPC_NODES,
    ...HISTORY_NODES,
    ...ATOMIC_NODES,
    AW_IMAGE_URL,
    'https://api.alienworlds.io', // DAO candidate profiles
    'https://api.rss2json.com', // news feeds
    'https://gateway.pinata.cloud', // IPFS fallback
    // Anchor: the Buoy relay the wallet answers through.
    'https://cb.anchor.link',
    'wss://cb.anchor.link',
    // Wombat speaks the Scatter protocol: to the wallet on this machine, or through Scatter's relay.
    'https://relay.get-scatter.com',
    'wss://relay.get-scatter.com',
    'https://local.get-scatter.com:*',
    'wss://local.get-scatter.com:*',
    'http://127.0.0.1:*',
    'ws://127.0.0.1:*'
  ]
  const policy = [
    "default-src 'self'",
    "script-src 'self' chrome-extension: moz-extension:",
    // Inline styles: React style attributes and the wallet dialog's own styles.
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    // NFT, avatar, news and candidate images come from many hosts, all over HTTPS.
    "img-src 'self' data: blob: https:",
    'media-src https://play.alienworlds.io',
    `connect-src ${[...new Set(connect)].join(' ')}`,
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'"
  ].join('; ')

  return {
    name: 'content-security-policy',
    apply: 'build',
    transformIndexHtml(html) {
      return html.replace('<head>', `<head>\n    <meta http-equiv="Content-Security-Policy" content="${policy}" />`)
    }
  }
}

export default defineConfig({
  // '/' locally; the Pages workflow builds with BASE_PATH=/mc-test/ for the project site.
  base: process.env.BASE_PATH ?? '/',
  plugins: [react(), spaFallback(), contentSecurityPolicy()],
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
