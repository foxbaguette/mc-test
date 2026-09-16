// Downloads every IPFS image the site references on chain into public/ipfs/<hash>,
// so avatars and tutorial images are served locally instead of from Pinata.
// Usage: node scripts/fetch-ipfs.mjs   (safe to re-run; existing files are skipped)

import { mkdir, stat, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'ipfs')
const RPC = ['https://wax.greymass.com', 'https://wax.eosphere.io', 'https://wax.cryptolions.io']
// ipfs.alienworlds.io can't resolve "<cid>/<file>" paths; the public Pinata and Filebase gateways can.
const GATEWAYS = ['https://ipfs.alienworlds.io', 'https://gateway.pinata.cloud', 'https://ipfs.filebase.io', 'https://ipfs.io']

async function rows(code, table, extra = {}) {
  const out = []
  let lower = ''
  for (let page = 0; page < 50; page++) {
    let json
    for (const node of RPC) {
      try {
        const res = await fetch(`${node}/v1/chain/get_table_rows`, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain' },
          body: JSON.stringify({ json: true, code, scope: code, table, limit: 1000, lower_bound: lower, ...extra })
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

const hashOf = (avatar) =>
  String(avatar ?? '')
    .split(';')[0]
    .trim()

async function exists(path) {
  try {
    return (await stat(path)).size > 0
  } catch {
    return false
  }
}

async function download(hash) {
  const target = join(ROOT, hash)
  if (await exists(target)) return 'skipped'
  for (const gateway of GATEWAYS) {
    try {
      const res = await fetch(`${gateway}/ipfs/${hash}`, { signal: AbortSignal.timeout(30_000) })
      const type = res.headers.get('content-type') ?? ''
      if (!res.ok || !type.startsWith('image/')) continue
      await mkdir(dirname(target), { recursive: true })
      await writeFile(target, Buffer.from(await res.arrayBuffer()))
      return 'downloaded'
    } catch {
      /* next gateway */
    }
  }
  return 'failed'
}

const [members, activity, sponsors, tutorials, settings] = await Promise.all([
  rows('members.mc', 'mcmembers'),
  rows('members.mc', 'activitylog'),
  rows('members.mc', 'sponsorlog'),
  rows('missions.mc', 'tutorials'),
  rows('members.mc', 'settings')
])

const hashes = new Set(
  [
    ...members.map((r) => hashOf(r.avatar)),
    ...activity.map((r) => hashOf(r.avatar)),
    ...sponsors.map((r) => hashOf(r.avatar)),
    ...tutorials.map((r) => String(r.image ?? '').trim()),
    ...settings.map((r) => String(r.standard_avatar ?? '').trim())
  ].filter((h) => h && h !== '-')
)

const counts = { downloaded: 0, skipped: 0, failed: 0 }
const failed = []
for (const hash of hashes) {
  const result = await download(hash)
  counts[result]++
  if (result === 'failed') failed.push(hash)
}

console.log(
  `IPFS images: ${hashes.size} referenced, ${counts.downloaded} downloaded, ${counts.skipped} already present, ${counts.failed} failed`
)
if (failed.length) console.log(`Failed:\n  ${failed.join('\n  ')}`)
