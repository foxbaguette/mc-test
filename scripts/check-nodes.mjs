/**
 * Weekly health check of the WAX nodes the site reads from (run by .github/workflows/check-nodes.yml,
 * or by hand: `node scripts/check-nodes.mjs`). It never runs in a player's browser.
 *
 * Tests every node listed in src/chain/config.ts, and every endpoint the active block producers
 * publish in their bp.json, the way the site uses them:
 * - chain API: the right chain, browser access (CORS), close to the chain head, table reads work;
 * - history (Hyperion): browser access, compact results, page size, how complete last month is,
 *   and whether it lists an action twice.
 *
 * Writes a Markdown report to stdout (and the job summary), and `problems` / `suggestions` to the
 * job outputs: problems are listed nodes that fail; suggestions are working nodes of operators
 * the lists do not have yet.
 */
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs'

const CHAIN_ID = '1064487b3cd1a897ce03ae5b6a865651747e2e152090f99c1d19d44e01aea5a4'
const ORIGIN = 'https://foxbaguette.github.io'
const MAX_LAG_SECONDS = 120
/** A history node this far below the fullest for last month is missing records. */
const COMPLETE = 0.995
const TIMEOUT_MS = 15_000
/** Endpoints tested at once. Each is asked only a handful of times. */
const PARALLEL = 8

const config = readFileSync(new URL('../src/chain/config.ts', import.meta.url), 'utf8')
const listed = (name) => {
  const block = new RegExp(`export const ${name}[^=]*=\\s*\\[([\\s\\S]*?)\\]`).exec(config)?.[1] ?? ''
  return [...block.matchAll(/'(https:\/\/[^']+)'/g)].map((m) => m[1])
}
const RPC_NODES = listed('RPC_NODES')
const HISTORY_NODES = listed('HISTORY_NODES')

const clean = (url) => url.trim().replace(/\/+$/, '')
/** One operator often runs several addresses on one domain, behind one rate limit. */
const domain = (url) => new URL(url).hostname.split('.').slice(-2).join('.')
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function fetchJson(url, init = {}) {
  const res = await fetch(url, { ...init, headers: { Origin: ORIGIN, ...init.headers }, signal: AbortSignal.timeout(TIMEOUT_MS) })
  const cors = !!res.headers.get('access-control-allow-origin')
  const body = await res.json().catch(() => null)
  return { status: res.status, cors, body }
}

const post = (url, body) =>
  fetchJson(url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=UTF-8' }, body: JSON.stringify(body) })

/** Every https endpoint the active producers publish, from their chains.json / bp.json. */
async function producerEndpoints() {
  const { body } = await post(`${RPC_NODES[0]}/v1/chain/get_producers`, { json: true, limit: 150 })
  const producers = (body?.rows ?? []).filter((p) => p.is_active && p.url)
  const found = []
  await Promise.all(
    producers.map(async (p) => {
      let base = clean(p.url)
      if (!/^https?:/.test(base)) base = `https://${base}`
      try {
        let path = '/bp.json'
        const chains = await fetchJson(`${base}/chains.json`).catch(() => null)
        if (chains?.body?.chains?.[CHAIN_ID]) path = chains.body.chains[CHAIN_ID]
        const bp = (await fetchJson(base + (path.startsWith('/') ? path : `/${path}`))).body
        for (const node of bp?.nodes ?? [])
          for (const url of [node.ssl_endpoint, node.api_endpoint])
            if (typeof url === 'string' && url.startsWith('https://')) found.push({ url: clean(url), owner: p.owner })
      } catch {
        // A producer whose files do not load publishes nothing usable.
      }
    })
  )
  return [...new Map(found.map((e) => [e.url, e])).values()]
}

async function checkChain(url) {
  try {
    const started = Date.now()
    const info = await post(`${url}/v1/chain/get_info`, {})
    const ms = Date.now() - started
    if (info.body?.chain_id !== CHAIN_ID) return { ok: false, why: 'not a WAX chain API' }
    if (!info.cors) return { ok: false, why: 'no browser access (CORS)' }
    const lag = Math.round((Date.now() - Date.parse(`${info.body.head_block_time}Z`)) / 1000)
    if (lag > MAX_LAG_SECONDS) return { ok: false, why: `${lag} s behind the chain`, ms }
    const rows = await post(`${url}/v1/chain/get_table_rows`, {
      code: 'uspts.worlds',
      scope: 'uspts.worlds',
      table: 'userpoints',
      limit: 1,
      json: true
    })
    if (!Array.isArray(rows.body?.rows) || rows.body.rows.length !== 1) return { ok: false, why: 'table reads fail', ms }
    return { ok: true, ms, lag }
  } catch (err) {
    return { ok: false, why: err.name === 'TimeoutError' ? 'no answer (timeout)' : 'no answer' }
  }
}

/** Last full month, the window completeness is judged on. */
const now = new Date()
const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)).toISOString()
const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString()
const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 10)).toISOString()
const dayEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 11)).toISOString()

const payouts = (url, after, before, limit) =>
  fetchJson(
    `${url}/v2/history/get_actions?account=ptpxy.worlds&filter=ptpxy.worlds:addpoints&after=${after}&before=${before}` +
      `&limit=${limit}&sort=asc&simple=true&track=true`
  )

async function checkHistory(url) {
  try {
    const started = Date.now()
    const count = await payouts(url, monthStart, monthEnd, 1)
    const ms = Date.now() - started
    if (!Array.isArray(count.body?.simple_actions)) return { ok: false, why: `no history API (HTTP ${count.status})` }
    if (!count.cors) return { ok: false, why: 'no browser access (CORS)' }
    await sleep(1000)
    // A full page, or the node's own limit.
    let pageSize = 1000
    let page = await payouts(url, dayStart, dayEnd, 1000)
    const max = /maximum:\s*(\d+)/.exec(page.body?.message ?? '')?.[1]
    if (max) {
      pageSize = Number(max)
      await sleep(1000)
      page = await payouts(url, dayStart, dayEnd, pageSize)
    }
    const rows = page.body?.simple_actions ?? []
    const unique = new Set(rows.map((a) => `${a.transaction_id}:${a.data?.user}:${a.data?.points}:${a.data?.points_manager}`))
    const duplicates = rows.length - unique.size
    return {
      ok: duplicates === 0,
      why: duplicates ? `lists ${duplicates} of ${rows.length} actions twice` : '',
      ms,
      total: count.body.total?.value ?? 0,
      pageSize,
      duplicates
    }
  } catch (err) {
    return { ok: false, why: err.name === 'TimeoutError' ? 'no answer (timeout)' : 'no answer' }
  }
}

async function inBatches(items, run) {
  const out = []
  for (let i = 0; i < items.length; i += PARALLEL) out.push(...(await Promise.all(items.slice(i, i + PARALLEL).map(run))))
  return out
}

const published = await producerEndpoints()
const candidates = [...new Set([...RPC_NODES, ...HISTORY_NODES, ...published.map((e) => e.url)])]
const results = await inBatches(candidates, async (url) => ({
  url,
  owner: published.find((e) => e.url === url)?.owner ?? '',
  chain: await checkChain(url),
  history: await checkHistory(url)
}))
const byUrl = new Map(results.map((r) => [r.url, r]))

// A listed node that failed gets one more try after a pause: a node that was only busy is no problem.
const failing = [
  ...RPC_NODES.filter((url) => !byUrl.get(url).chain.ok).map((url) => [url, 'chain', checkChain]),
  ...HISTORY_NODES.filter((url) => !byUrl.get(url).history.ok).map((url) => [url, 'history', checkHistory])
]
if (failing.length) {
  await sleep(30_000)
  for (const [url, kind, check] of failing) byUrl.get(url)[kind] = await check(url)
}

// How complete each working history node is, against the fullest.
const fullest = Math.max(0, ...results.filter((r) => r.history.ok).map((r) => r.history.total))
for (const r of results) if (r.history.ok) r.history.complete = fullest > 0 && r.history.total >= fullest * COMPLETE

const problems = [
  ...RPC_NODES.filter((url) => !byUrl.get(url).chain.ok).map((url) => `Chain API **${url}**: ${byUrl.get(url).chain.why}`),
  ...HISTORY_NODES.filter((url) => !byUrl.get(url).history.ok).map((url) => `History **${url}**: ${byUrl.get(url).history.why}`)
]

const rpcDomains = new Set(RPC_NODES.map(domain))
const historyDomains = new Set(HISTORY_NODES.map(domain))
const pick = (list, key) => [...new Map(list.map((r) => [domain(r.url), r])).values()].sort((a, b) => a[key].ms - b[key].ms)
const suggestions = [
  ...pick(
    results.filter((r) => r.chain.ok && !rpcDomains.has(domain(r.url))),
    'chain'
  ).map((r) => `Chain API **${r.url}** (${r.owner || 'unknown operator'}, ${r.chain.ms} ms)`),
  ...pick(
    results.filter((r) => r.history.ok && r.history.complete && r.history.pageSize >= 1000 && !historyDomains.has(domain(r.url))),
    'history'
  ).map((r) => `History **${r.url}** (${r.owner || 'unknown operator'}, complete, ${r.history.ms} ms)`)
]

const line = (r, kind) => {
  const c = r[kind]
  if (!c.ok) return `| ${r.url} | ✗ ${c.why} |`
  if (kind === 'chain') return `| ${r.url} | ✓ ${c.ms} ms, ${c.lag} s behind |`
  return `| ${r.url} | ✓ ${c.ms} ms, ${c.total.toLocaleString('en-US')} payouts last month${c.complete ? '' : ' (incomplete)'}, ${c.pageSize} per page |`
}

const report = [
  `## Node health check, ${now.toISOString().slice(0, 10)}`,
  '',
  problems.length ? '### Listed nodes that fail\n\n' + problems.map((p) => `- ${p}`).join('\n') : 'All listed nodes work.',
  '',
  suggestions.length
    ? '### Working nodes of operators not listed yet\n\n' + suggestions.map((s) => `- ${s}`).join('\n')
    : 'No new operators with working nodes.',
  '',
  '### Chain API (`RPC_NODES`)',
  '',
  '| Node | Result |',
  '|---|---|',
  ...RPC_NODES.map((url) => line(byUrl.get(url), 'chain')),
  '',
  '### History (`HISTORY_NODES`)',
  '',
  '| Node | Result |',
  '|---|---|',
  ...HISTORY_NODES.map((url) => line(byUrl.get(url), 'history')),
  '',
  `Tested ${candidates.length} endpoints: the listed ones and those ${published.length ? 'the active producers publish' : 'listed (producer files did not load)'}.`
].join('\n')

console.log(report)
writeFileSync('node-health.md', report)
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, report + '\n')
if (process.env.GITHUB_OUTPUT)
  appendFileSync(process.env.GITHUB_OUTPUT, `problems=${problems.length}\nsuggestions=${suggestions.length}\n`)
