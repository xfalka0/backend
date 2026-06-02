process.env.ESBUILD_WORKER_THREADS = '1';
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
    base: '/',
    plugins: [react()],
    server: {
        proxy: {
            '/api': 'https://backend-kj17.onrender.com',
            '/uploads': 'https://backend-kj17.onrender.com'
        }
    },
    build: {
        outDir: '../public/admin',
        emptyOutDir: true,
        minify: 'esbuild',
        sourcemap: false,
        rollupOptions: {
            output: {
                manualChunks: undefined
            }
        }
    }
})
