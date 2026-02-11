import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
    base: '/admin/',
    plugins: [react()],
    build: {
        outDir: '../public/admin',
        emptyOutDir: true,
        minify: 'esbuild',
        rollupOptions: {
            output: {
                manualChunks: undefined
            }
        }
    }
})
