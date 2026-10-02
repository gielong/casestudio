import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
  // Branch previews override this path in GitHub Actions; production keeps /casestudio/.
  base: process.env.VITE_BASE_PATH || '/casestudio/',
  build: {
    outDir: 'dist',
  },
})
