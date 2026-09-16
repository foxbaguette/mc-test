// Downloads every image the Adventures page shows into the site, resized and converted to webp:
//   - adventure artwork (adventure.mc adventures + predefs) -> public/assets/adventures/<slug>.webp
//   - NFT card art for the schemas adventures accept (adventure.mc advtemplates) -> public/assets/aw-nft-images/<templateid>.webp
// Usage: node scripts/fetch-adventure-images.mjs   (safe to re-run; existing files are skipped)

import { mkdir, stat } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const ASSETS = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'assets')
const RPC = ['https://wax.greymass.com', 'https://wax.eosphere.io', 'https://wax.cryptolions.io']
// Artwork uses "<cid>/<file>" paths, which ipfs.alienworlds.io can't resolve, so the public gateways go first.
const GATEWAYS = ['https://gateway.pinata.cloud', 'https://ipfs.filebase.io', 'https://ipfs.alienworlds.io', 'https://ipfs.io']
const CARD_SCHEMAS = new Set(['crew.worlds', 'arms.worlds', 'tool.worlds', 'level.worlds', 'faces.worlds'])

// Must match adventureImageSlug() in src/data/adventures.ts.
const slug = (image) =>
  image
    .trim()
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '_')

async function rows(code, table) {
  const out = []
  let lower = ''
  for (let page = 0; page < 50; page++) {
    let json
    for (const node of RPC) {
      try {
        const res = await fetch(`${node}/v1/chain/get_table_rows`, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain' },
          body: JSON.stringify({ json: true, code, scope: code, table, limit: 1000, lower_bound: lower })
        })
        if (res.ok) {
          json = await res.json()
          break
        }
      } catch {
        /* next node */
      }
    }
    if (!json) throw new Error(`Could not read ${code}/${table}`)
    out.push(...json.rows)
    if (!json.more || !json.next_key) break
    lower = json.next_key
  }
  return out
}

async function exists(path) {
  try {
    return (await stat(path)).size > 0
  } catch {
    return false
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function fetchImage(path) {
  // Two passes: public gateways rate limit (429) bursts, and uncached files can take close to a minute.
  for (let pass = 0; pass < 2; pass++) {
    for (const gateway of GATEWAYS) {
      try {
        const res = await fetch(`${gateway}/ipfs/${path}`, { signal: AbortSignal.timeout(90_000) })
        if (res.status === 429) {
          await sleep(3000)
          continue
        }
        const type = res.headers.get('content-type') ?? ''
        if (!res.ok || type.includes('text/html') || type.includes('json')) continue
        const buffer = Buffer.from(await res.arrayBuffer())
        await sharp(buffer).metadata() // throws if the gateway sent something that isn't an image
        return buffer
      } catch {
        /* next gateway */
      }
    }
    await sleep(5000)
  }
  return null
}

async function save({ path, target, width }) {
  if (await exists(target)) return 'skipped'
  const buffer = await fetchImage(path)
  if (!buffer) return 'failed'
  await mkdir(dirname(target), { recursive: true })
  await sharp(buffer).resize({ width, withoutEnlargement: true }).webp({ quality: 80 }).toFile(target)
  return 'downloaded'
}

async function runAll(label, jobs, concurrency = 6) {
  const counts = { downloaded: 0, skipped: 0, failed: 0 }
  const failed = []
  let next = 0
  async function worker() {
    while (next < jobs.length) {
      const job = jobs[next++]
      const result = await save(job).catch(() => 'failed')
      counts[result]++
      if (result === 'failed') failed.push(job.path)
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker))
  console.log(
    `${label}: ${jobs.length} referenced, ${counts.downloaded} downloaded, ${counts.skipped} already present, ${counts.failed} failed`
  )
  if (failed.length) console.log(`  Failed:\n    ${failed.join('\n    ')}`)
}

const [adventures, predefs, templates] = await Promise.all([
  rows('adventure.mc', 'adventures'),
  rows('adventure.mc', 'predefs'),
  rows('adventure.mc', 'advtemplates')
])

const artwork = [...new Set([...adventures, ...predefs].map((r) => String(r.image ?? '').trim()).filter((i) => i && i !== '-'))]
await runAll(
  'Adventure artwork',
  artwork.map((image) => ({ path: image, target: join(ASSETS, 'adventures', `${slug(image)}.webp`), width: 1200 }))
)

const cards = templates.filter((t) => CARD_SCHEMAS.has(t.schema) && t.nftimage && t.nftimage !== '-')
await runAll(
  'NFT card images',
  cards.map((t) => ({ path: t.nftimage.trim(), target: join(ASSETS, 'aw-nft-images', `${t.templateid}.webp`), width: 440 }))
)
