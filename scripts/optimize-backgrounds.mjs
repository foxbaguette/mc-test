// Re-encodes the page banner and background images in public/assets/background as WebP.
// Several ".jpeg" files there were really PNGs (up to 500 kB for a 165 px tall banner).
// Keeps each image's size, so every screen width still shows the same part of it.
// Safe to run again: a WebP is only rewritten when that saves at least 20%.
// Usage: node scripts/optimize-backgrounds.mjs

import { readdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { dirname, extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const here = dirname(fileURLToPath(import.meta.url))
const DIR = join(here, '..', 'public', 'assets', 'background')
const QUALITY = 80

let before = 0
let after = 0
const renamed = []

for (const file of await readdir(DIR)) {
  const ext = extname(file).toLowerCase()
  if (!['.jpeg', '.jpg', '.png', '.webp'].includes(ext)) continue

  const input = join(DIR, file)
  const original = await readFile(input)
  const encoded = await sharp(original).webp({ quality: QUALITY, effort: 6 }).toBuffer()
  const output = join(DIR, file.slice(0, -ext.length) + '.webp')

  if (ext === '.webp' && encoded.length > original.length * 0.8) continue
  before += original.length
  after += encoded.length
  await writeFile(output, encoded)
  if (ext !== '.webp') {
    await rm(input)
    renamed.push(file)
  }
}

const kb = (n) => `${Math.round(n / 1024)} kB`
console.log(`Backgrounds: ${kb(before)} -> ${kb(after)}`)
if (renamed.length) console.log(`Now .webp (update references): ${renamed.join(', ')}`)
// The folder is small; list what is there for a quick check.
for (const file of (await readdir(DIR)).sort()) console.log(`  ${file.padEnd(34)} ${kb((await stat(join(DIR, file))).size)}`)
