/**
 * Shard History's memory in the player's browser (IndexedDB): the player's payouts for each day
 * that is over, and their lifetime Shard count at moments that are past. Neither changes once
 * settled, so a month read once never needs reading again, and the current one only its new days.
 * Everything here is a convenience: without storage (private windows, blocked site data) every
 * call quietly finds nothing and the history is read from the chain as before.
 */

const DB_NAME = 'shard-history'
const STORE = 'entries'
/**
 * Bump when what a stored day means changes (new labels, sources or fixes): days stored under an
 * older format are then read again from the chain.
 */
const FORMAT = 1

let opening: Promise<IDBDatabase | null> | null = null

function open(): Promise<IDBDatabase | null> {
  opening ??= new Promise((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, 1)
      request.onupgradeneeded = () => request.result.createObjectStore(STORE)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => resolve(null)
      request.onblocked = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
  return opening
}

const entryKey = (account: string, what: string) => `${FORMAT}:${account}:${what}`

/** The stored values for `keys` that exist, by key. */
export async function readEntries<T>(account: string, keys: string[]): Promise<Map<string, T>> {
  const found = new Map<string, T>()
  const db = await open()
  if (!db || keys.length === 0) return found
  return new Promise((resolve) => {
    try {
      const store = db.transaction(STORE, 'readonly').objectStore(STORE)
      let pending = keys.length
      for (const key of keys) {
        const request = store.get(entryKey(account, key))
        request.onsuccess = () => {
          if (request.result !== undefined) found.set(key, request.result as T)
          if (--pending === 0) resolve(found)
        }
        request.onerror = () => {
          if (--pending === 0) resolve(found)
        }
      }
    } catch {
      resolve(found)
    }
  })
}

/** Stores the values, by key. A failed write only means reading them from the chain next time. */
export async function writeEntries<T>(account: string, entries: Map<string, T>): Promise<void> {
  const db = await open()
  if (!db || entries.size === 0) return
  await new Promise<void>((resolve) => {
    try {
      const transaction = db.transaction(STORE, 'readwrite')
      const store = transaction.objectStore(STORE)
      for (const [key, value] of entries) store.put(value, entryKey(account, key))
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => resolve()
      transaction.onabort = () => resolve()
    } catch {
      resolve()
    }
  })
}
