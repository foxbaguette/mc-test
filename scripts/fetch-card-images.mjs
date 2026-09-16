// Downloads the card image of every alien.worlds template in the schemas the Adventures
// picker shows, for any template that has no copy in public/assets/aw-nft-images yet.
// New card releases (new races, weapons, ...) otherwise fall back to IPFS in the browser.
// Usage: node scripts/fetch-card-images.mjs   (safe to re-run; existing files are skipped)

import { mkdir, readdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const TARGET = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'assets', 'aw-nft-images')
// Must match ADVENTURE_SCHEMAS in src/data/adventures.ts.
const SCHEMAS = ['crew.worlds', 'arms.worlds', 'tool.worlds', 'level.worlds', 'faces.worlds']
const ATOMIC = ['https://wax.api.atomicassets.io', 'https://aa.wax.blacklusion.io', 'https://atomic-wax.tacocrypto.io']
const GATEWAYS = ['https://ipfs.alienworlds.io', 'https://gateway.pinata.cloud', 'https://ipfs.filebase.io']

async function getJson(path) {
  for (const host of ATOMIC) {
    try {
      const res = await fetch(host + path, { signal: AbortSignal.timeout(15_000) })
      if (res.ok) return (await res.json()).data
    } catch {
      // try the next host
    }
  }
  throw new Error(`No AtomicAssets host answered ${path}`)
}

async function templates(schema) {
  const out = []
  for (let page = 1; page <= 20; page++) {
    const batch = await getJson(`/atomicassets/v1/templates?collection_name=alien.worlds&schema_name=${schema}&limit=1000&page=${page}`)
    out.push(...batch)
    if (batch.length < 1000) break
  }
  return out
}

async function download(hash) {
  for (const gateway of GATEWAYS) {
    try {
      const res = await fetch(`${gateway}/ipfs/${hash}`, { signal: AbortSignal.timeout(30_000) })
      if (res.ok && res.headers.get('content-type')?.startsWith('image/')) return Buffer.from(await res.arrayBuffer())
    } catch {
      // try the next gateway
    }
  }
  return null
}

await mkdir(TARGET, { recursive: true })
const have = new Set((await readdir(TARGET)).map((file) => file.replace(/\.webp$/, '')))

let written = 0
const failed = []
for (const schema of SCHEMAS) {
  const rows = await templates(schema)
  const missing = rows.filter((row) => !have.has(String(row.template_id)) && row.immutable_data?.img)
  console.log(`${schema}: ${rows.length} templates, ${missing.length} without a local image`)
  for (const row of missing) {
    const image = await download(row.immutable_data.img)
    if (!image) {
      failed.push(`${row.template_id} (${row.immutable_data.name})`)
      continue
    }
    // Same format as the existing cards: 440px wide (2x the card size) webp.
    await sharp(image).resize({ width: 440, withoutEnlargement: true }).webp({ quality: 82 }).toFile(join(TARGET, `${row.template_id}.webp`))
    written++
    console.log(`  ${row.template_id} ${row.immutable_data.name}`)
  }
}

console.log(`Written ${written} card images.`)
if (failed.length) console.log(`Could not download: ${failed.join(', ')}`)
