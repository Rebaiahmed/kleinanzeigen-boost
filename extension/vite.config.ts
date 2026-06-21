import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        background: resolve(__dirname, 'src/background/index.ts'),
        content: resolve(__dirname, 'src/content/index.ts'),
        overlay: resolve(__dirname, 'src/content/overlay.ts'), // document_start repost overlay
        dashboard: resolve(__dirname, 'src/content/dashboard.ts'), // ← keep .ts
        popup: resolve(__dirname, 'src/popup/index.html'),
      },
      output: {
        entryFileNames: '[name].js', // This converts .ts to .js in output
      },
    },
  },
})