// Invólucro mínimo de IndexedDB: `frames` guarda as molduras cadastradas,
// `kv` guarda o projeto em andamento.

type StoreName = 'frames' | 'kv'

let opening: Promise<IDBDatabase> | undefined

function open() {
  opening ??= new Promise<IDBDatabase>((res, rej) => {
    const req = indexedDB.open('token-builder', 1)
    req.onupgradeneeded = () => {
      req.result.createObjectStore('frames', { keyPath: 'id' })
      req.result.createObjectStore('kv')
    }
    req.onsuccess = () => res(req.result)
    req.onerror = () => rej(req.error)
  })
  return opening
}

async function run<T>(store: StoreName, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>) {
  const database = await open()
  return new Promise<T>((res, rej) => {
    const req = fn(database.transaction(store, mode).objectStore(store))
    req.onsuccess = () => res(req.result)
    req.onerror = () => rej(req.error)
  })
}

export const db = {
  get: <T>(store: StoreName, key: string) => run<T | undefined>(store, 'readonly', (s) => s.get(key)),
  all: <T>(store: StoreName) => run<T[]>(store, 'readonly', (s) => s.getAll()),
  put: (store: StoreName, value: unknown, key?: string) => run(store, 'readwrite', (s) => s.put(value, key)),
  del: (store: StoreName, key: string) => run(store, 'readwrite', (s) => s.delete(key)),
}
