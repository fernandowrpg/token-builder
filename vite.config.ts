import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base relativo para funcionar em subpastas (ex.: GitHub Pages)
export default defineConfig({
  base: './',
  plugins: [react()],
})
