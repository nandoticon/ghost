import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
// https://vite.dev/config/
export default defineConfig({
    plugins: [
        react(),
        VitePWA({
            registerType: 'autoUpdate',
            includeAssets: [
                'favicon.ico',
                'favicon-16x16.webp',
                'favicon-32x32.webp',
                'favicon-48x48.webp',
                'favicon-16x16.png',
                'favicon-32x32.png',
                'favicon-48x48.png',
                'apple-touch-icon.png',
                'og-image.jpg',
                'og-image.webp',
                'icons/*.webp',
                'icons/*.png'
            ],
            manifest: false, // using our own manifest.json
            workbox: {
                globPatterns: ['**/*.{js,css,html,ico,png,webp,svg,woff2}'],
                cleanupOutdatedCaches: true,
                navigateFallbackDenylist: [
                    /^\/assets\//,
                    /\/[^/?]+\.[^/]+$/,
                ],
                runtimeCaching: []
            }
        })
    ],
    build: {
        target: 'es2020',
        rollupOptions: {
            output: {
                manualChunks: {
                    'react-vendor': ['react', 'react-dom', 'react-router-dom'],
                    'supabase-vendor': ['@supabase/supabase-js'],
                    'ui-vendor': ['lucide-react', 'clsx', 'tailwind-merge', 'date-fns'],
                    'dnd-vendor': ['@hello-pangea/dnd']
                }
            }
        }
    }
});
