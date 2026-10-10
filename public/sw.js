// Rede primeiro, cache como reserva: sempre atualizado online, funcional offline.
const CACHE = 'token-builder-v1'

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))

self.addEventListener('fetch', (e) => {
  const { request } = e
  if (request.method !== 'GET' || new URL(request.url).origin !== location.origin) return
  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      try {
        const res = await fetch(request)
        if (res.ok) cache.put(request, res.clone())
        return res
      } catch {
        return (await cache.match(request, { ignoreSearch: true })) ?? Response.error()
      }
    }),
  )
})
