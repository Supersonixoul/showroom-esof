import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/tv': 'http://localhost:3000',
      '/catalog': 'http://localhost:3000',
      '/uploads': 'http://localhost:3000',
    },
  },
})
