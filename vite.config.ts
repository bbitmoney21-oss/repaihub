import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    open: true,
    proxy: {
      // Forward CA API calls and the dashboard HTML to the Express backend
      '/ca': { target: 'http://localhost:3001', changeOrigin: true },
      '/health': { target: 'http://localhost:3001', changeOrigin: true },
      '/ca-dashboard.html': { target: 'http://localhost:3001', changeOrigin: true },
    },
  },
})
