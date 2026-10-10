import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base relativo para funcionar em subpastas; o build vai para docs/, que é
// a pasta publicada pelo GitHub Pages
export default defineConfig({
  base: './',
  build: { outDir: 'docs' },
  plugins: [react()],
})
