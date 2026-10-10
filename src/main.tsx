import { createRoot } from 'react-dom/client'
import { App } from './App'
import './styles.css'

createRoot(document.getElementById('root')!).render(<App />)

// Offline: o service worker só passa a controlar a página depois do primeiro
// carregamento, então os arquivos já baixados são colocados no cache aqui.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      await navigator.serviceWorker.register('./sw.js')
      const cache = await caches.open('token-builder-v1')
      const loaded = performance
        .getEntriesByType('resource')
        .map((e) => e.name)
        .filter((u) => u.startsWith(location.origin))
      await cache.addAll(['./', ...loaded])
    } catch (err) {
      console.warn('Modo offline indisponível', err)
    }
  })
}
