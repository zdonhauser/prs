/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url'
import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Set by the deploy workflow for the /staging/ build so the installed
// staging PWA is distinguishable from prod on a home screen.
const isStaging = process.env.VITE_APP_ENV === 'staging'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8'))

export default defineConfig({
  base: './',
  build: {
    rollupOptions: {
      // Multi-page suite: static landing at the root, one sub-app per tool.
      // Each tool is a real directory so its URL works as a direct link on
      // GitHub Pages (no SPA fallback needed).
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        'success-story': fileURLToPath(new URL('./success-story/index.html', import.meta.url)),
        'event-flyer': fileURLToPath(new URL('./event-flyer/index.html', import.meta.url)),
        // Not linked from the landing page or either tool — reached only
        // by typing the URL. See template-creator/index.html.
        'template-creator': fileURLToPath(new URL('./template-creator/index.html', import.meta.url)),
      },
    },
  },
  define: {
    // Shown in the header so a glance at the live site confirms which
    // build is deployed — bump package.json's version with each push.
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'node',
  },
  plugins: [
    react(),
    // The web manifest is static data, but vite-plugin-pwa can only inject a
    // "./manifest.webmanifest" link relative to each page — which 404s for
    // the nested tool pages (/success-story/ etc.). So the plugin's manifest
    // handling is disabled (manifest: false) and the file is emitted here
    // instead; each HTML page links it with its own correct relative path.
    // (Still generated rather than dropped in public/ because the staging
    // build needs a different name so the two installs are distinguishable
    // on a home screen.)
    {
      name: 'emit-web-manifest',
      generateBundle() {
        this.emitFile({
          type: 'asset',
          fileName: 'manifest.webmanifest',
          source: JSON.stringify({
            name: isStaging ? 'PRS Tools (Staging)' : 'PRS Tools',
            short_name: isStaging ? 'PRS (Stg)' : 'PRS Tools',
            description: 'PRS Good Neighbor Program document builders',
            theme_color: '#1e3a5f',
            background_color: '#ffffff',
            display: 'standalone',
            orientation: 'portrait',
            start_url: './',
            scope: './',
            icons: [
              { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
              { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
            ],
          }),
        })
      },
    },
    VitePWA({
      registerType: 'autoUpdate',
      // The plugin's automatic registerSW injection also uses "./..."
      // relative to the page, 404ing for nested tool pages — each HTML file
      // registers the suite-root sw.js itself instead.
      injectRegister: false,
      manifest: false,
      // The prod service worker's scope (site root) contains /staging/,
      // and workbox's default navigation fallback would answer staging
      // navigations with prod's cached index.html — silently serving the
      // old build on the staging URL. Deny staging paths so the staging
      // site always loads its own build.
      workbox: {
        // The default pattern set is js/css/html only. The theme logos are
        // now hashed build assets rather than public/ files listed in
        // includeAssets, so images have to be globbed explicitly or the
        // printed page loses its logo offline. `webmanifest` is added for
        // the same reason as the images: it's emitted by the local
        // emit-web-manifest plugin above rather than shipped from public/,
        // so without it here an offline first load has no manifest (and no
        // install prompt).
        globPatterns: ['**/*.{js,css,html,png,svg,webmanifest}'],
        navigateFallbackDenylist: [/\/staging\//],
        // heic-to's bundled libheif WASM decoder chunk is ~3 MB, over
        // workbox's default 2 MiB precache limit. It's dynamically
        // imported (see src/services/imageConversion.ts) and only
        // fetched when a user actually uploads a HEIC/HEIF photo, so
        // raising this ceiling just lets the service worker precache it
        // like any other asset rather than excluding it from offline use.
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
    })
  ]
})
