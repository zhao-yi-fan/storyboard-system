import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      // Alias @ to the src directory
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: process.env.VITE_API_PROXY_TARGET || 'http://127.0.0.1:8083',
        changeOrigin: true,
      },
    },
  },
  build: {
    assetsInlineLimit(filePath) {
      return filePath.endsWith('login_bg_video.mp4') ? true : undefined
    },
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return undefined
          }

          if (id.includes('/react-router')) {
            return 'router'
          }

          if (id.includes('/@radix-ui/')) {
            return 'radix'
          }

          if (id.includes('/recharts/') || id.includes('/date-fns/')) {
            return 'charts'
          }

          if (
            id.includes('/motion/') ||
            id.includes('/canvas-confetti/') ||
            id.includes('/embla-carousel-react/') ||
            id.includes('/react-slick/')
          ) {
            return 'motion-media'
          }

          if (id.includes('/lucide-react/')) {
            return 'icons'
          }

          if (id.includes('/react-dnd/') || id.includes('/react-dnd-html5-backend/')) {
            return 'dnd'
          }

          if (id.includes('/sonner/')) {
            return 'toast'
          }

          if (id.includes('/@emotion/') || id.includes('/@mui/')) {
            return 'mui'
          }

          return 'vendor'
        },
      },
    },
  },

  // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
  assetsInclude: ['**/*.svg', '**/*.csv'],
})
