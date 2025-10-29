import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    // 优化构建性能
    minify: 'esbuild',
    target: 'esnext',
    rollupOptions: {
      output: {
        manualChunks: undefined,
      },
    },
    // 减少构建时间
    sourcemap: false,
    reportCompressedSize: false,
  },
  // 优化依赖预构建
  optimizeDeps: {
    include: ['react', 'react-dom'],
  },
})
