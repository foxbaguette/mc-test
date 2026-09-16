// Copies the Alien Worlds tool card images the Mining page shows (one per
// hq.mu awtools template) from the old site's asset folder, resized for the
// 220x325 cards, into public/assets/aw-nft-images.
// Usage: node scripts/optimize-tool-images.mjs [sourceDir]

import { mkdir, readdir, stat } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const here = dirname(fileURLToPath(import.meta.url))
const SOURCE = process.argv[2] ?? join(here, '..', '..', 'ref', 'aw-quest-internal', 'public', 'assets', 'aw-nft-images')
const TARGET = join(here, '..', 'public', 'assets', 'aw-nft-images')

async function toolTemplates() {
  const ids = new Set()
  let lower = ''
  for (let page = 0; page < 20; page++) {
    const res = await fetch('https://wax.greymass.com/v1/chain/get_table_rows', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ json: true, code: 'hq.mu', scope: 'hq.mu', table: 'awtools', limit: 1000, lower_bound: lower })
    })
    const json = await res.json()
    for (const row of json.rows) ids.add(String(row.template_id))
    if (!json.more || !json.next_key) break
    lower = json.next_key
  }
  return ids
}

const wanted = await toolTemplates()
const available = new Set((await readdir(SOURCE)).map((f) => f.replace(/\.webp$/, '')))
await mkdir(TARGET, { recursive: true })

let before = 0
let after = 0
const missing = []
for (const id of wanted) {
  if (!available.has(id)) {
    missing.push(id)
    continue
  }
  const input = join(SOURCE, `${id}.webp`)
  const output = join(TARGET, `${id}.webp`)
  before += (await stat(input)).size
  // 2x the 220px card width keeps them sharp on high-density screens.
  await sharp(input).resize({ width: 440, withoutEnlargement: true }).webp({ quality: 82 }).toFile(output)
  after += (await stat(output)).size
}

const mb = (n) => (n / 1024 / 1024).toFixed(1)
console.log(`Tool images: ${wanted.size - missing.length}/${wanted.size} written, ${mb(before)} MB -> ${mb(after)} MB`)
if (missing.length) console.log(`No source image for templates: ${missing.join(', ')}`)
