import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

// 获取当前文件的目录（ES模块兼容）
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
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
