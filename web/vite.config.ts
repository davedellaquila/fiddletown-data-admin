import { defineConfig } from 'vite'
import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
// Two pages ship from this build:
//   index.html       — the public Fiddletown Events listing (site root)
//   admin/index.html — the SSA Admin app (served at /admin)
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        admin: resolve(__dirname, 'admin/index.html')
      }
    }
  }
})
