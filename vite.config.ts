import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    open: true,
    proxy: {
      '/auth':        { target: 'http://localhost:3001', changeOrigin: true },
      '/rates':       { target: 'http://localhost:3001', changeOrigin: true },
      '/transfers':   { target: 'http://localhost:3001', changeOrigin: true },
      '/inward':      { target: 'http://localhost:3001', changeOrigin: true },
      '/users':       { target: 'http://localhost:3001', changeOrigin: true },
      '/wallet':      { target: 'http://localhost:3001', changeOrigin: true },
      '/compliance':  { target: 'http://localhost:3001', changeOrigin: true },
      '/webhooks':    { target: 'http://localhost:3001', changeOrigin: true },
      '/kyc':         { target: 'http://localhost:3001', changeOrigin: true },
      '/admin':       { target: 'http://localhost:3001', changeOrigin: true },
      '/dev':         { target: 'http://localhost:3001', changeOrigin: true },
      '/ca':          { target: 'http://localhost:3001', changeOrigin: true },
      '/health':      { target: 'http://localhost:3001', changeOrigin: true },
      '/ca-dashboard.html': { target: 'http://localhost:3001', changeOrigin: true },
    },
  },
})
