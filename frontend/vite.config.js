import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/',
  build: {
    target: 'es2022',
    outDir: process.env.VITE_BUILD_OUT_DIR || '../backend/public/dist',
    emptyOutDir: true,
  },
})
