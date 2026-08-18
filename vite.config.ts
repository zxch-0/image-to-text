import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    allowedHosts: ['5173-ingiwprjrm1mfbuxms900.e2b.app', '.e2b.app'],
  },
})
